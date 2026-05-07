/**
 * R-FRONTEND-COOKIE-AUTH-001 — closes F-HIGH-001.
 * Dual-mode auth middleware: Bearer header AND HttpOnly session cookie.
 */

'use strict';

// Load config + auth in production mode using jest.isolateModules so that
// prior test files (which load config in test mode) don't pollute the
// require cache for this suite.
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');

const PROD_ENV = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://u:strong@db.example.com/db',
  INFLUX_URL: 'http://localhost:8086',
  INFLUX_TOKEN: 'x'.repeat(40),
  INFLUX_ORG: 'o',
  INFLUX_BUCKET: 'b',
  MQTT_BROKER_URL: 'mqtts://broker.example.com',
  MQTT_PASSWORD: 's'.repeat(20),
  JWT_SECRET: 'a'.repeat(40),
  CORS_ALLOWED_ORIGINS: 'https://factorymind.example'
};

let requireAuth, SESSION_COOKIE, extractToken, config;

beforeAll(() => {
  const saved = {};
  for (const k of Object.keys(PROD_ENV)) {
    saved[k] = process.env[k];
    process.env[k] = PROD_ENV[k];
  }
  jest.isolateModules(() => {
    config = require('../src/config');
    ({ requireAuth, SESSION_COOKIE, extractToken } = require('../src/middleware/auth'));
  });
  // Restore env so other tests don't see the prod overrides.
  for (const k of Object.keys(PROD_ENV)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function appUnderTest() {
  const app = express();
  app.use(express.json());
  app.get('/api/protected', requireAuth, (req, res) => {
    res.json({ user: req.user, authSource: req.authSource });
  });
  return app;
}

function freshToken(payload = {}) {
  return jwt.sign({ sub: 'u-1', email: 'mario@example.it', role: 'operator', ...payload }, config.security.jwtSecret, {
    algorithm: 'HS256'
  });
}

describe('requireAuth dual-mode (R-FRONTEND-COOKIE-AUTH-001)', () => {
  it('accepts a valid Bearer token', async () => {
    const tok = freshToken();
    const res = await request(appUnderTest())
      .get('/api/protected')
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.user.sub).toBe('u-1');
    expect(res.body.authSource).toBe('bearer');
  });

  it('accepts a valid factorymind_session cookie', async () => {
    const tok = freshToken();
    const res = await request(appUnderTest())
      .get('/api/protected')
      .set('Cookie', `${SESSION_COOKIE}=${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.user.sub).toBe('u-1');
    expect(res.body.authSource).toBe('cookie');
  });

  it('Bearer wins over cookie when both are present', async () => {
    const bearerTok = freshToken({ sub: 'bearer-user' });
    const cookieTok = freshToken({ sub: 'cookie-user' });
    const res = await request(appUnderTest())
      .get('/api/protected')
      .set('Authorization', `Bearer ${bearerTok}`)
      .set('Cookie', `${SESSION_COOKIE}=${cookieTok}`);
    expect(res.status).toBe(200);
    expect(res.body.user.sub).toBe('bearer-user');
    expect(res.body.authSource).toBe('bearer');
  });

  it('rejects request with neither Bearer nor cookie in production', async () => {
    const res = await request(appUnderTest()).get('/api/protected');
    expect(res.status).toBe(401);
    expect(res.body.detail || res.body.title).toMatch(/Missing/i);
  });

  it('rejects refresh-typed token used at protected endpoint', async () => {
    const refreshTok = freshToken({ typ: 'refresh' });
    const res = await request(appUnderTest())
      .get('/api/protected')
      .set('Cookie', `${SESSION_COOKIE}=${refreshTok}`);
    expect(res.status).toBe(401);
  });

  it('rejects malformed cookie token', async () => {
    const res = await request(appUnderTest())
      .get('/api/protected')
      .set('Cookie', `${SESSION_COOKIE}=not-a-jwt`);
    expect(res.status).toBe(401);
  });

  it('extractToken returns null source/token when neither present', () => {
    const fake = { headers: {} };
    expect(extractToken(fake)).toEqual({ source: null, token: null });
  });
});
