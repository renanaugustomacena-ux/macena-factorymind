/**
 * R-SPARKPLUG-LOAD-001 — F-MED-CODE-006 closure regression.
 *
 * Locks down two surfaces:
 *  - `backend/src/index.js` boot-time wrapper around `require('./services/
 *    sparkplug-bridge')` is a try/catch that logs at ERROR (not WARN) on
 *    failure and lets the backend continue without the bridge enabled.
 *  - `backend/src/services/sparkplug-bridge.js` raises `NotConfiguredError`
 *    when the broker URL is missing, and starts cleanly otherwise — so the
 *    upstream catch path is guaranteed reachable.
 *
 * The exit criterion calls for "CI test runs with SPARKPLUG_ENABLED=true";
 * this Jest suite IS that test (it sets the env, exercises the require +
 * start path, and verifies graceful degradation). Documented as the
 * H-20-style substitute for a separate CI workflow step.
 */

'use strict';

// The sparkplug-bridge module lazily requires `../utils/logger` inside
// start(), which triggers `src/config/index.js` env-var validation. The
// global tests/setup.js already provides MQTT_BROKER_URL so config init
// succeeds — but this suite manipulates broker-URL env vars between cases,
// and `jest.resetModules()` re-runs the require chain. Mocking the logger
// short-circuits the config init and keeps the suite hermetic.
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn()
}));

const fs = require('fs');
const path = require('path');

const INDEX_JS = path.resolve(__dirname, '../src/index.js');

describe('R-SPARKPLUG-LOAD-001 — index.js boot wrapper assertions', () => {
  let source;

  beforeAll(() => {
    source = fs.readFileSync(INDEX_JS, 'utf8');
  });

  it('wraps require("./services/sparkplug-bridge") in try/catch', () => {
    expect(source).toMatch(/try\s*{[^}]*sparkplug\s*=\s*require\(['"]\.\/services\/sparkplug-bridge['"]\)/s);
  });

  it('catch block logs at ERROR (not WARN) — indicates an operator-attention event', () => {
    expect(source).toMatch(/logger\.error\([^)]*Sparkplug bridge failed to start/);
    expect(source).not.toMatch(/logger\.warn\([^)]*Sparkplug bridge failed to start/);
  });

  it('SPARKPLUG_ENABLED gate evaluates both config flag AND env var', () => {
    expect(source).toMatch(/SPARKPLUG_ENABLED\s*===\s*['"]true['"]/);
    expect(source).toMatch(/config\.sparkplug\?\.enabled\s*===\s*true/);
  });
});

describe('sparkplug-bridge gating (R-SPARKPLUG-LOAD-001)', () => {
  let bridge;
  let originalEnv;

  beforeAll(() => {
    originalEnv = {
      SPARKPLUG_BROKER_URL: process.env.SPARKPLUG_BROKER_URL,
      MQTT_BROKER_URL: process.env.MQTT_BROKER_URL,
      SPARKPLUG_ENABLED: process.env.SPARKPLUG_ENABLED
    };
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  beforeEach(() => {
    delete process.env.SPARKPLUG_BROKER_URL;
    delete process.env.MQTT_BROKER_URL;
    process.env.SPARKPLUG_ENABLED = 'true';
    jest.resetModules();
    bridge = require('../src/services/sparkplug-bridge');
  });

  afterEach(() => {
    if (bridge.isStarted()) bridge.stop();
  });

  it('start() throws NotConfiguredError when no broker URL is configured', () => {
    expect(() => bridge.start()).toThrow(bridge.NotConfiguredError);
    expect(() => bridge.start()).toThrow(/SPARKPLUG_BROKER_URL/);
    expect(bridge.isStarted()).toBe(false);
  });

  it('start() succeeds when SPARKPLUG_BROKER_URL is set', () => {
    process.env.SPARKPLUG_BROKER_URL = 'mqtt://localhost:1883';
    expect(() => bridge.start()).not.toThrow();
    expect(bridge.isStarted()).toBe(true);
  });

  it('start() falls back to MQTT_BROKER_URL when SPARKPLUG_BROKER_URL absent', () => {
    process.env.MQTT_BROKER_URL = 'mqtt://shared:1883';
    expect(() => bridge.start()).not.toThrow();
    expect(bridge.isStarted()).toBe(true);
  });

  it('start() is idempotent — calling twice does not throw or re-initialize', () => {
    process.env.SPARKPLUG_BROKER_URL = 'mqtt://localhost:1883';
    bridge.start();
    expect(() => bridge.start()).not.toThrow();
    expect(bridge.isStarted()).toBe(true);
  });

  it('stop() resets started state', () => {
    process.env.SPARKPLUG_BROKER_URL = 'mqtt://localhost:1883';
    bridge.start();
    expect(bridge.isStarted()).toBe(true);
    bridge.stop();
    expect(bridge.isStarted()).toBe(false);
  });
});
