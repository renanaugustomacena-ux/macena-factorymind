import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';

/**
 * /login — credential entry for cookie-auth (R-FRONTEND-AUTH-001 / F-HIGH-002).
 *
 * On successful POST /api/users/login the backend sets the HttpOnly
 * `factorymind_session` cookie; the SPA needs no in-memory token. The
 * `next` query parameter (set by the axios 401-redirect interceptor)
 * preserves the route the user was originally trying to reach.
 *
 * The server-side credential checks (lockout, rate-limit, audit) are
 * doing the heavy lifting; this page is intentionally a thin form so
 * the security posture lives in one place. The legacy localStorage
 * Bearer path stays alive during the transition (R-FRONTEND-COOKIE-
 * AUTH-001 dual-mode); on success we still write the access_token to
 * localStorage so any service worker / older fetch path keeps working.
 */
export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await api.login(email, password);
      // Dual-mode: the cookie is set server-side, but we also persist
      // the access token in localStorage so legacy axios paths still work.
      // After R-FRONTEND-BEARER-RETIRE-001 this line goes away.
      if (r.access_token) localStorage.setItem('factorymind:jwt', r.access_token);
      navigate(next, { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      if (e.response?.status === 429) {
        setError('Troppi tentativi. Riprovi tra qualche minuto.');
      } else if (e.response?.status === 401) {
        setError('Credenziali non valide.');
      } else {
        setError(e.response?.data?.detail || 'Errore durante il login.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-steel-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded border border-steel-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-bold text-steel-900">FactoryMind</h1>
        <p className="mb-4 text-sm text-steel-600">Accesso al cruscotto operatore</p>

        {error && (
          <div
            role="alert"
            className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {error}
          </div>
        )}

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-steel-700">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-steel-300 px-2 py-1.5 focus:border-steel-500 focus:outline-none"
          />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-steel-700">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-steel-300 px-2 py-1.5 focus:border-steel-500 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-steel-900 px-3 py-2 text-sm font-medium text-white hover:bg-steel-800 disabled:opacity-60"
        >
          {submitting ? 'Accesso in corso…' : 'Accedi'}
        </button>

        <p className="mt-4 text-xs text-steel-500">
          Difficoltà ad accedere? Contatti l'amministratore di sistema.
        </p>
      </form>
    </div>
  );
}
