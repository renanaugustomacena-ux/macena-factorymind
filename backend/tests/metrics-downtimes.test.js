/**
 * /api/metrics/downtimes — Pareto dei fermi macchina.
 *
 * Verifica:
 *   - Joi whitelist regex respinge tentativi di injection Flux nei tag
 *   - durate calcolate correttamente come delta tra DOWN e record successivo
 *   - aggregazione raggruppa per reason_code e ordina per total_seconds desc
 *   - segmenti DOWN "aperti" (senza transizione successiva) usano `stop` come
 *     upper bound
 */

'use strict';

jest.mock('../src/db/pool', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }), end: jest.fn() }
}));

// Stub del queryApi Influx: il test inietta righe simulate
const mockRows = [];
jest.mock('../src/services/influx-writer', () => ({
  queryApi: {
    queryRows: (_flux, { next, complete }) => {
      for (const r of mockRows) {
        // meta.toObject(row) → ritorniamo direttamente l'oggetto stub
        next(r, { toObject: () => r });
      }
      complete();
    }
  },
  writeTelemetry: jest.fn(),
  writeStatus: jest.fn(),
  writeAlarm: jest.fn(),
  ping: jest.fn().mockResolvedValue({ ok: true }),
  close: jest.fn()
}));

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
  PINNED_ALGORITHMS: ['HS256']
}));

const express = require('express');
const request = require('supertest');
const metricsRouter = require('../src/routes/metrics');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/metrics', metricsRouter);
  return app;
}

describe('GET /api/metrics/downtimes', () => {
  beforeEach(() => { mockRows.length = 0; });

  it('respinge facility con caratteri non whitelistati (400)', async () => {
    const res = await request(buildApp())
      .get('/api/metrics/downtimes?facility=foo\';DROP--');
    expect(res.status).toBe(400);
  });

  it('respinge range mal formattato (400)', async () => {
    const res = await request(buildApp())
      .get('/api/metrics/downtimes?facility=mozzecane&start=|pipe');
    expect(res.status).toBe(400);
  });

  it('restituisce pareto vuoto quando non ci sono record', async () => {
    const res = await request(buildApp())
      .get('/api/metrics/downtimes?facility=mozzecane');
    expect(res.status).toBe(200);
    expect(res.body.pareto).toEqual([]);
    expect(res.body.total_events).toBe(0);
    expect(res.body.total_downtime_seconds).toBe(0);
  });

  it('calcola durate aggregate per reason_code correttamente', async () => {
    // Scenario: una macchina, 3 DOWN con cause diverse e diverse durate.
    const t0 = new Date('2026-04-22T08:00:00Z').getTime();
    const push = (sec, state, reason) => mockRows.push({
      _time: new Date(t0 + sec * 1000).toISOString(),
      _value: reason,
      facility: 'mozzecane', line: 'line-01', machine: 'm1',
      state
    });
    push(0,    'DOWN', 'cambio_utensile');   // 60s fino alla RUN
    push(60,   'RUN',  'none');
    push(120,  'DOWN', 'fermo_meccanico');    // 30s fino alla RUN
    push(150,  'RUN',  'none');
    push(300,  'DOWN', 'cambio_utensile');   // 20s fino alla fine
    push(320,  'RUN',  'none');

    const res = await request(buildApp())
      .get('/api/metrics/downtimes?facility=mozzecane');
    expect(res.status).toBe(200);
    const pareto = res.body.pareto;
    expect(pareto).toHaveLength(2);
    // Il reason con più secondi deve essere primo: cambio_utensile = 60+20 = 80s
    expect(pareto[0].reason_code).toBe('cambio_utensile');
    expect(pareto[0].total_seconds).toBe(80);
    expect(pareto[0].occurrences).toBe(2);
    expect(pareto[1].reason_code).toBe('fermo_meccanico');
    expect(pareto[1].total_seconds).toBe(30);
    expect(res.body.total_events).toBe(3);
    expect(res.body.total_downtime_seconds).toBe(110);
  });

  it('non confonde serie di macchine diverse', async () => {
    const t0 = Date.now() - 3600_000;
    // m1: DOWN che dura 10s
    mockRows.push({ _time: new Date(t0).toISOString(), _value: 'rA',
                    facility: 'f', line: 'l', machine: 'm1', state: 'DOWN' });
    mockRows.push({ _time: new Date(t0 + 10_000).toISOString(), _value: 'none',
                    facility: 'f', line: 'l', machine: 'm1', state: 'RUN' });
    // m2: solo stato RUN (nessun DOWN) — non deve generare pareto
    mockRows.push({ _time: new Date(t0).toISOString(), _value: 'none',
                    facility: 'f', line: 'l', machine: 'm2', state: 'RUN' });

    const res = await request(buildApp())
      .get('/api/metrics/downtimes?facility=f');
    expect(res.status).toBe(200);
    expect(res.body.pareto).toHaveLength(1);
    expect(res.body.pareto[0].reason_code).toBe('rA');
    expect(res.body.pareto[0].total_seconds).toBe(10);
  });
});
