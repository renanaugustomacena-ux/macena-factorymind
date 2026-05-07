/**
 * Health endpoint shape test.
 *
 * Stubs the pool/influx/mqtt health probes so the test runs without
 * external dependencies and verifies the response envelope matches the
 * contract consumed by k8s liveness and Compose healthchecks.
 */

'use strict';

jest.mock('../src/db/pool', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [{ alive: 1 }] }), end: jest.fn() },
  ping: jest.fn().mockResolvedValue({ ok: true, latency_ms: 2 }),
  close: jest.fn()
}));

jest.mock('../src/services/influx-writer', () => ({
  ping: jest.fn().mockResolvedValue({ ok: true, latency_ms: 3 }),
  // R-INFLUX-TASK-001: /api/health now AND-s in tasksHealth(), so the mock
  // must answer this. Default mock is "all 3 canonical tasks present" so
  // the existing "happy-path 200" assertion still holds.
  tasksHealth: jest.fn().mockResolvedValue({
    ok: true,
    present: ['downsample_1m', 'downsample_1h', 'downsample_1d'],
    missing: []
  }),
  EXPECTED_DOWNSAMPLING_TASKS: Object.freeze([
    'downsample_1m', 'downsample_1h', 'downsample_1d'
  ]),
  writeTelemetry: jest.fn(),
  writeStatus: jest.fn(),
  writeAlarm: jest.fn(),
  writeCounters: jest.fn(),
  flush: jest.fn(),
  close: jest.fn(),
  bootstrapTasks: jest.fn(),
  queryApi: { queryRows: jest.fn() }
}));

jest.mock('../src/services/mqtt-handler', () => ({
  ping: jest.fn().mockReturnValue({ ok: true, latency_ms: 0 }),
  connect: jest.fn(),
  close: jest.fn(),
  publish: jest.fn(),
  onMessage: jest.fn(() => () => undefined)
}));

const request = require('supertest');
const { buildApp } = require('../src/index');

const influxMock = require('../src/services/influx-writer');

describe('GET /api/health', () => {
  beforeEach(() => {
    influxMock.tasksHealth.mockResolvedValue({
      ok: true,
      present: ['downsample_1m', 'downsample_1h', 'downsample_1d'],
      missing: []
    });
  });

  it('returns 200 and the documented envelope when all deps are OK', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'factorymind-backend',
      dependencies: {
        postgres: { ok: true },
        influxdb: { ok: true },
        influxdb_tasks: { ok: true, missing: [] },
        mosquitto: { ok: true }
      }
    });
    expect(typeof res.body.uptime_seconds).toBe('number');
    expect(typeof res.body.time).toBe('string');
    expect(typeof res.body.version).toBe('string');
  });

  // R-INFLUX-TASK-001 — F-MED-DATA-001 closure regression.
  it('returns 503 when any of the three downsampling tasks is missing', async () => {
    influxMock.tasksHealth.mockResolvedValueOnce({
      ok: false,
      present: ['downsample_1m', 'downsample_1d'],
      missing: ['downsample_1h']
    });
    const app = buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.influxdb_tasks.ok).toBe(false);
    expect(res.body.dependencies.influxdb_tasks.missing).toEqual(['downsample_1h']);
  });

  it('returns 503 when all three downsampling tasks are missing', async () => {
    influxMock.tasksHealth.mockResolvedValueOnce({
      ok: false,
      present: [],
      missing: ['downsample_1m', 'downsample_1h', 'downsample_1d']
    });
    const app = buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.dependencies.influxdb_tasks.missing.length).toBe(3);
  });
});
