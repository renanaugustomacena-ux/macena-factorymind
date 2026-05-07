/**
 * R-ERROR-SAFE-001 — F-MED-CODE-005 closure regression.
 *
 * Locks down two surfaces:
 *  - `backend/src/utils/safe-error.js#safeInternal` — direct response helper
 *    that emits a generic 500 problem+json without `err.message` and logs
 *    the full error server-side.
 *  - `backend/src/middleware/errorHandler.js` central handler — for status
 *    >= 500 the detail field is the canonical generic message, NOT
 *    `err.message`. For 4xx the existing Joi-style behavior is preserved
 *    (Joi messages are user-facing safe; do not regress that path).
 */

'use strict';

const errorCalls = [];
const warnCalls = [];

jest.mock('../src/utils/logger', () => ({
  error: jest.fn((obj, msg) => { errorCalls.push({ obj, msg }); }),
  warn: jest.fn((obj, msg) => { warnCalls.push({ obj, msg }); }),
  info: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const { safeInternal, GENERIC_DETAIL } = require('../src/utils/safe-error');
const { errorHandler } = require('../src/middleware/errorHandler');

beforeEach(() => {
  errorCalls.length = 0;
  warnCalls.length = 0;
});

describe('safeInternal helper (R-ERROR-SAFE-001)', () => {
  function buildApp(handler) {
    const app = express();
    app.use(express.json());
    app.get('/test', handler);
    return app;
  }

  it('returns 500 problem+json with generic detail (no err.message leak)', async () => {
    const app = buildApp((req, res) =>
      safeInternal(res, 'OEE_CALC_FAILED', new Error('connection refused 10.42.0.7:5432'), req)
    );
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({
      type: 'https://factorymind.example/problems/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      code: 'OEE_CALC_FAILED'
    });
    expect(res.body.detail).toBe(GENERIC_DETAIL);
    expect(res.body.detail).not.toMatch(/connection refused/i);
    expect(res.body.detail).not.toMatch(/10\.42\.0\.7/);
    expect(typeof res.body.event_id).toBe('string');
    expect(res.body.event_id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('logs full err.message + stack + event_id at ERROR server-side', async () => {
    const err = new Error('postgres ECONNREFUSED 10.0.0.1:5432');
    const app = buildApp((req, res) => safeInternal(res, 'DB_FAIL', err, req));
    await request(app).get('/test');
    expect(errorCalls.length).toBe(1);
    const { obj } = errorCalls[0];
    expect(obj.err).toBe('postgres ECONNREFUSED 10.0.0.1:5432');
    expect(obj.code).toBe('DB_FAIL');
    expect(typeof obj.event_id).toBe('string');
    expect(obj.event_id).toMatch(/^[0-9a-f]{16}$/);
    expect(typeof obj.stack).toBe('string');
  });

  it('falls back to INTERNAL code when none provided', async () => {
    const app = buildApp((req, res) => safeInternal(res, undefined, new Error('boom'), req));
    const res = await request(app).get('/test');
    expect(res.body.code).toBe('INTERNAL');
  });

  it('handles err being undefined gracefully', async () => {
    const app = buildApp((req, res) => safeInternal(res, 'NO_ERR', undefined, req));
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.detail).toBe(GENERIC_DETAIL);
  });

  it('event_id in response body matches event_id logged', async () => {
    const app = buildApp((req, res) => safeInternal(res, 'X', new Error('y'), req));
    const res = await request(app).get('/test');
    expect(errorCalls.length).toBe(1);
    expect(errorCalls[0].obj.event_id).toBe(res.body.event_id);
  });
});

describe('errorHandler central middleware (R-ERROR-SAFE-001)', () => {
  function buildApp(throwError) {
    const app = express();
    app.use(express.json());
    app.get('/test', (req, res, next) => next(throwError));
    app.use(errorHandler);
    return app;
  }

  it('SUPPRESSES err.message in detail for status 500', async () => {
    const err = Object.assign(new Error('SELECT failed: relation "users" does not exist'), {
      status: 500
    });
    const app = buildApp(err);
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.detail).not.toMatch(/relation "users"/);
    expect(res.body.detail).not.toMatch(/SELECT failed/);
    expect(res.body.detail).toMatch(/log del server/i);
    expect(typeof res.body.event_id).toBe('string');
    expect(res.body.code).toBe('INTERNAL');
  });

  it('SUPPRESSES err.message in detail for status 503 (any 5xx)', async () => {
    const err = Object.assign(new Error('influxdb timeout'), { status: 503 });
    const app = buildApp(err);
    const res = await request(app).get('/test');
    expect(res.status).toBe(503);
    expect(res.body.detail).not.toMatch(/influxdb/i);
  });

  it('PRESERVES err.message in detail for status 400 (Joi-style path unchanged)', async () => {
    const err = Object.assign(new Error('"facility" must be a string'), { status: 400 });
    const app = buildApp(err);
    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.detail).toBe('"facility" must be a string');
    expect(res.body.event_id).toBeUndefined();
  });

  it('PRESERVES err.message for 401, 403, 404, 409, 422 (4xx user-facing)', async () => {
    for (const status of [401, 403, 404, 409, 422]) {
      const err = Object.assign(new Error(`forbidden ${status}`), { status });
      const app = buildApp(err);
      const res = await request(app).get('/test');
      expect(res.status).toBe(status);
      expect(res.body.detail).toBe(`forbidden ${status}`);
    }
  });

  it('logs at ERROR for 500+ with event_id, at WARN for 4xx without', async () => {
    const err500 = Object.assign(new Error('boom'), { status: 500 });
    await request(buildApp(err500)).get('/test');
    expect(errorCalls.length).toBe(1);
    expect(errorCalls[0].obj.event_id).toMatch(/^[0-9a-f]{16}$/);

    errorCalls.length = 0;
    warnCalls.length = 0;

    const err400 = Object.assign(new Error('bad'), { status: 400 });
    await request(buildApp(err400)).get('/test');
    expect(warnCalls.length).toBe(1);
    expect(errorCalls.length).toBe(0);
  });
});
