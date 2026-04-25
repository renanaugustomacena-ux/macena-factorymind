/**
 * WebSocket server — broadcasts MQTT messages to subscribed browsers.
 *
 * Clients connect to /ws and optionally send a JSON subscription envelope:
 *   { "type": "subscribe", "topics": ["factory/mozzecane/line-01/+/telemetry"] }
 * Subscriptions use the same pattern syntax as MQTT (+ and #). A ping frame
 * is emitted every 20 s to keep intermediaries from dropping the socket.
 */

'use strict';

const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');
const topics = require('../mqtt/topics');
const mqttHandler = require('../services/mqtt-handler');

function attach(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set();

  wss.on('connection', (ws) => {
    ws.patterns = [];
    ws.isAlive = true;
    clients.add(ws);
    logger.info({ clientCount: clients.size }, '[ws] client connected');

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('close', () => {
      clients.delete(ws);
      logger.info({ clientCount: clients.size }, '[ws] client disconnected');
    });
    ws.on('error', (err) => {
      logger.warn({ err: err.message }, '[ws] client error');
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && Array.isArray(msg.topics)) {
          ws.patterns = msg.topics.slice(0, 32);
          ws.send(JSON.stringify({ type: 'subscribed', topics: ws.patterns }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: 'invalid subscribe frame' }));
      }
    });
  });

  const pingInterval = setInterval(() => {
    for (const ws of clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch (_) { /* ignore */ }
    }
  }, 20_000);
  pingInterval.unref?.();

  const unsubscribe = mqttHandler.onMessage(({ topic, parsed, payload }) => {
    const envelope = JSON.stringify({ type: 'mqtt', topic, parsed, payload, ts: new Date().toISOString() });
    for (const ws of clients) {
      if (ws.readyState !== ws.OPEN) continue;
      if (ws.patterns.length === 0) { ws.send(envelope); continue; }
      if (ws.patterns.some((p) => topics.matches(p, topic))) {
        ws.send(envelope);
      }
    }
  });

  return {
    wss,
    close() {
      clearInterval(pingInterval);
      unsubscribe();
      for (const ws of clients) { try { ws.close(); } catch (_) { /* ignore */ } }
      wss.close();
    }
  };
}

module.exports = { attach };
