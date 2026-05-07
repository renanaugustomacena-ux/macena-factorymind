import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '@/api/client';

/**
 * <RequireAuth> wrapper — closes F-HIGH-002.
 *
 * Polls `/api/users/me` once on mount to confirm the cookie or Bearer
 * carries a valid identity. Three outcomes:
 *   - 200 with a user → render `children`.
 *   - 401 (no auth or expired) → redirect to /login?next=<path>.
 *   - error other than 401 → render an error UI; the user can retry
 *     (typically a transient backend/network issue).
 */
type Status = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(() => {
        if (!cancelled) setStatus('authenticated');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { response?: { status?: number } };
        if (e.response?.status === 401) {
          setStatus('unauthenticated');
        } else {
          setErrorMsg(e?.toString?.() || 'Errore di rete');
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
    // intentionally re-run on pathname change so navigating with an
    // expired session re-validates rather than caching across routes.
  }, [location.pathname]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-steel-50">
        <div className="text-sm text-steel-600">Verifica sessione…</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-steel-50 text-sm">
        <div className="text-amber-700">Sessione non verificabile.</div>
        <div className="text-steel-500">{errorMsg}</div>
        <button
          type="button"
          className="rounded bg-steel-900 px-3 py-1.5 text-white"
          onClick={() => window.location.reload()}
        >
          Riprova
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
