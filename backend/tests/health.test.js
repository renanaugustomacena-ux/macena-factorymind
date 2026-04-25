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

describe('GET /api/health', () => {
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
        mosquitto: { ok: true }
      }
    });
    expect(typeof res.body.uptime_seconds).toBe('number');
    expect(typeof res.body.time).toBe('string');
    expect(typeof res.body.version).toBe('string');
  });
});
