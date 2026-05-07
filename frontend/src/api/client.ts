import axios, { AxiosInstance } from 'axios';
import type { Alert, Device, Facility, OEELineRollup, ProductionLine } from '@/types';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

// R-FRONTEND-COOKIE-AUTH-001 (F-HIGH-001): the SPA now relies on the
// HttpOnly `factorymind_session` cookie set by /api/users/login.
// `withCredentials: true` makes axios send the cookie on cross-origin
// requests (the dev `vite` server proxies same-origin so this is a
// no-op there; the prod nginx surface is same-origin so the cookie
// flows automatically).
//
// Bearer fallback: during the dual-mode transition we still attach
// `Authorization: Bearer` if `localStorage` carries a token. The
// localStorage path is deprecated and will be retired (R-FRONTEND-
// BEARER-RETIRE-001 in W2); the cookie path is XSS-immune.
const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

http.interceptors.request.use((config) => {
  const legacyTok = localStorage.getItem('factorymind:jwt');
  if (legacyTok) config.headers.Authorization = `Bearer ${legacyTok}`;
  // CSRF double-submit: the backend sets `factorymind_csrf` (non-HttpOnly)
  // on every response; we mirror it in the request header. Only required
  // for cookie-auth state-changing requests, but always sending is harmless
  // (the backend exempts Bearer + safe methods).
  const csrf = readCookie('factorymind_csrf');
  if (csrf && /^(post|put|patch|delete)$/i.test(String(config.method || ''))) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

function readCookie(name: string): string | null {
  const c = document.cookie.split(';').map((s) => s.trim());
  for (const piece of c) {
    if (piece.startsWith(`${name}=`)) {
      return decodeURIComponent(piece.slice(name.length + 1));
    }
  }
  return null;
}

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('factorymind:jwt');
      // Cookie-auth tokens are cleared server-side on /logout; on a 401
      // for a non-public route, redirect to /login to force re-auth.
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login?next=${next}`);
      }
    }
    return Promise.reject(err);
  }
);

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: { id: string; email: string; role: string; facility_scope: string[] };
};

export const api = {
  health: () => http.get('/api/health').then((r) => r.data),

  login: (email: string, password: string) =>
    http.post<LoginResponse>('/api/users/login', { email, password }).then((r) => r.data),

  logout: () => http.post<void>('/api/users/logout').then(() => undefined),

  me: () =>
    http.get<{ user: { sub: string; email: string; role: string } }>('/api/users/me')
      .then((r) => r.data.user),

  facilities: {
    list: () => http.get<{ items: Facility[] }>('/api/facilities').then((r) => r.data.items)
  },

  lines: {
    list: (facility_id?: string) =>
      http.get<{ items: ProductionLine[] }>('/api/lines', { params: { facility_id } })
        .then((r) => r.data.items)
  },

  devices: {
    list: (facility_id?: string, line_id?: string) =>
      http.get<{ items: Device[] }>('/api/devices', { params: { facility_id, line_id } })
        .then((r) => r.data.items),
    get: (id: string) => http.get<Device>(`/api/devices/${id}`).then((r) => r.data)
  },

  oee: {
    forLine: (facility: string, line?: string) =>
      http.get<OEELineRollup>('/api/oee', { params: { facility, line, start: '-8h' } })
        .then((r) => r.data)
  },

  alerts: {
    open: () => http.get<{ items: Alert[] }>('/api/alerts').then((r) => r.data.items),
    acknowledge: (id: string) =>
      http.post<Alert>(`/api/alerts/${id}/acknowledge`).then((r) => r.data),
    resolve: (id: string) =>
      http.post<Alert>(`/api/alerts/${id}/resolve`).then((r) => r.data)
  },

  metrics: {
    timeseries: (params: {
      facility: string; line: string; machine: string; metric: string;
      start?: string; stop?: string; window?: 'raw' | '1m' | '1h' | '1d';
    }) => http.get('/api/metrics', { params }).then((r) => r.data),
    downtimes: (params: {
      facility: string; line?: string; machine?: string;
      start?: string; stop?: string;
    }) => http.get<{
      pareto: Array<{ reason_code: string; total_seconds: number; occurrences: number }>;
      total_downtime_seconds: number;
      total_events: number;
    }>('/api/metrics/downtimes', { params }).then((r) => r.data)
  },

  contact: (payload: {
    nome: string; azienda: string; email: string;
    telefono?: string; messaggio: string; website?: string;
  }) => http.post<{ status: string }>('/api/contact', payload).then((r) => r.data),

  attestazione: {
    preview: (deviceId: string, body: unknown) =>
      http.post(`/api/devices/${deviceId}/attestazione/preview`, body).then((r) => r.data),
    pdf: (deviceId: string, body: unknown) =>
      http.post(`/api/devices/${deviceId}/attestazione/pdf`, body, { responseType: 'blob' })
        .then((r) => ({
          blob: r.data as Blob,
          numero: String(r.headers['x-attestazione-numero'] || ''),
          hash: String(r.headers['x-attestazione-hash'] || '')
        })),
    verify: (numero: string) =>
      http.get<{ numero: string; status: string; match: boolean }>(`/api/attestazione/${numero}/verify`)
        .then((r) => r.data)
  }
};

export default http;
