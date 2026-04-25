import axios, { AxiosInstance } from 'axios';
import type { Alert, Device, Facility, OEELineRollup, ProductionLine } from '@/types';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' }
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('factorymind:jwt');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('factorymind:jwt');
    }
    return Promise.reject(err);
  }
);

export const api = {
  health: () => http.get('/api/health').then((r) => r.data),

  login: (email: string, password: string) =>
    http.post<{ token: string }>('/api/users/login', { email, password }).then((r) => r.data),

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
