/**
 * R-WS-AUTH-001 — closes F-HIGH-010.
 * WebSocket handshake validates JWT from header / cookie / subprotocol /
 * query, rejects with 401 in production when missing or invalid.
 *
 * Boots a real http.Server bound to a random port, attaches the WS
 * server, and exercises the upgrade with the `ws` client.
 */

'use strict';

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

// Stub services so wsServer.attach doesn't open MQTT/Influx connections.
jest.mock('../src/services/mqtt-handler', () => ({
  onMessage: jest.fn().mockReturnValue(() => undefined),
  publish: jest.fn().mockResolvedValue(undefined)
}));

const http = require('http');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

let wsServer, config, SESSION_COOKIE;

beforeAll(() => {
  const saved = {};
  for (const k of Object.keys(PROD_ENV)) {
    saved[k] = process.env[k];
    process.env[k] = PROD_ENV[k];
  }
  jest.isolateModules(() => {
    config = require('../src/config');
    ({ SESSION_COOKIE } = require('../src/middleware/auth'));
    wsServer = require('../src/ws/server');
  });
  for (const k of Object.keys(PROD_ENV)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function freshToken(payload = {}) {
  return jwt.sign({ sub: 'u-1', email: 'mario@example.it', role: 'operator', ...payload }, config.security.jwtSecret, {
    algorithm: 'HS256'
  });
}

function bootStack() {
  return new Promise((resolve) => {
    const server = http.createServer();
    const ws = wsServer.attach(server);
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, ws, port });
    });
  });
}

function tryConnect(url, opts = {}, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const sock = new WebSocket(url, opts.protocol, opts.options || opts);
    const timer = setTimeout(() => {
      try { sock.terminate(); } catch (_) { /* ignore */ }
      resolve({ status: 'timeout' });
    }, timeoutMs);
    sock.on('open', () => {
      clearTimeout(timer);
      sock.close();
      resolve({ status: 'open' });
    });
    sock.on('unexpected-response', (_req, res) => {
      clearTimeout(timer);
      resolve({ status: 'unexpected', code: res.statusCode });
    });
    sock.on('error', (err) => {
      clearTimeout(timer);
      resolve({ status: 'error', error: err.message });
    });
  });
}

describe('WebSocket handshake auth (R-WS-AUTH-001)', () => {
  let stack;

  beforeAll(async () => {
    stack = await bootStack();
  });

  afterAll(() => {
    try { stack.ws.close(); } catch (_) { /* ignore */ }
    return new Promise((resolve) => stack.server.close(resolve));
  });

  it('rejects missing-token in production with 401', async () => {
    const r = await tryConnect(`ws://localhost:${stack.port}/ws`);
    expect(r.status === 'unexpected' || r.status === 'error').toBe(true);
    if (r.status === 'unexpected') expect(r.code).toBe(401);
  });

  it('rejects invalid token with 401', async () => {
    const r = await tryConnect(`ws://localhost:${stack.port}/ws`, {
      options: { headers: { Authorization: 'Bearer not-a-jwt' } }
    });
    expect(r.status === 'unexpected' || r.status === 'error').toBe(true);
    if (r.status === 'unexpected') expect(r.code).toBe(401);
  });

  it('rejects refresh-typed token', async () => {
    const refreshTok = freshToken({ typ: 'refresh' });
    const r = await tryConnect(`ws://localhost:${stack.port}/ws`, {
      options: { headers: { Authorization: `Bearer ${refreshTok}` } }
    });
    expect(r.status === 'unexpected' || r.status === 'error').toBe(true);
    if (r.status === 'unexpected') expect(r.code).toBe(401);
  });

  it('accepts a valid Bearer header', async () => {
    const tok = freshToken();
    const r = await tryConnect(`ws://localhost:${stack.port}/ws`, {
      options: { headers: { Authorization: `Bearer ${tok}` } }
    });
    expect(r.status).toBe('open');
  });

  it('accepts a valid session cookie', async () => {
    const tok = freshToken();
    const r = await tryConnect(`ws://localhost:${stack.port}/ws`, {
      options: { headers: { Cookie: `${SESSION_COOKIE}=${tok}` } }
    });
    expect(r.status).toBe('open');
  });

  it('accepts a valid token via query string', async () => {
    const tok = freshToken();
    const r = await tryConnect(`ws://localhost:${stack.port}/ws?access_token=${encodeURIComponent(tok)}`);
    expect(r.status).toBe('open');
  });

  it('accepts a valid token via Sec-WebSocket-Protocol subprotocol', async () => {
    const tok = freshToken();
    const r = await tryConnect(`ws://localhost:${stack.port}/ws`, {
      protocol: `bearer.${tok}`
    });
    expect(r.status).toBe('open');
  });
});
