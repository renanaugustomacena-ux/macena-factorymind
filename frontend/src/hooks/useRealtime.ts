import { useEffect, useRef, useState } from 'react';
import type { TelemetryEnvelope } from '@/types';

type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

/**
 * Open a WebSocket connection to the backend and feed the caller a rolling
 * buffer of MQTT-fanout envelopes. The buffer keeps the last `max` items.
 *
 * The hook auto-reconnects with linear backoff (1s … 10s).
 */
export function useRealtime(options: {
  url?: string;
  topics?: string[];
  max?: number;
} = {}) {
  const url = options.url || import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`;
  const topics = options.topics || [];
  const max = options.max || 200;
  // Stringa stabile delle topic: evita il warning di useEffect su array inline.
  const topicsKey = topics.join('|');

  const [state, setState] = useState<ConnectionState>('connecting');
  const [messages, setMessages] = useState<TelemetryEnvelope[]>([]);
  const backoffRef = useRef(1_000);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setState('connecting');
      try {
        const s = new WebSocket(url.replace(/^http/, 'ws') + (url.includes('/ws') ? '' : '/ws'));
        socketRef.current = s;

        s.onopen = () => {
          if (cancelled) return;
          setState('open');
          backoffRef.current = 1_000;
          if (topics.length > 0) {
            s.send(JSON.stringify({ type: 'subscribe', topics }));
          }
        };

        s.onmessage = (evt) => {
          try {
            const parsed: TelemetryEnvelope = JSON.parse(evt.data);
            if (parsed.type !== 'mqtt') return;
            setMessages((prev) => {
              const next = [...prev, parsed];
              return next.length > max ? next.slice(next.length - max) : next;
            });
          } catch { /* ignore malformed */ }
        };

        s.onerror = () => setState('error');

        s.onclose = () => {
          if (cancelled) return;
          setState('closed');
          const delay = Math.min(10_000, backoffRef.current);
          backoffRef.current = Math.min(10_000, backoffRef.current + 1_000);
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        };
      } catch {
        setState('error');
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
    };
    // topicsKey è derivata da topics.join('|') (stringa stabile).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, topicsKey, max]);

  return { state, messages };
}
