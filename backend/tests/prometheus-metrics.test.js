/**
 * Prometheus /metrics smoke test.
 * G4 gate requires the endpoint to exist and expose a text/plain scrape body.
 */

'use strict';

jest.mock('../src/db/pool', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }), end: jest.fn() },
  ping: jest.fn().mockResolvedValue({ ok: true, latency_ms: 1 }),
  close: jest.fn()
}));
jest.mock('../src/services/influx-writer', () => ({
  ping: jest.fn().mockResolvedValue({ ok: true, latency_ms: 1 }),
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

describe('GET /metrics', () => {
  it('serves a Prometheus text exposition body', async () => {
    const app = buildApp();
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toMatch(/^# HELP factorymind_build_info/m);
    expect(res.text).toMatch(/^factorymind_uptime_seconds \d+/m);
    expect(res.text).toMatch(/^process_resident_memory_bytes \d+/m);
  });
});
