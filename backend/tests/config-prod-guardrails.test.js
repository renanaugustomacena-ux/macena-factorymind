/**
 * Verifica i guardrails di produzione in src/config/index.js.
 *
 * Il modulo config valida l'ambiente al require. Per testare scenari
 * diversi usiamo `jest.isolateModules` che ricarica il modulo ogni volta.
 * Applichiamo variabili d'ambiente prima del require.
 */

'use strict';

function withEnv(env, run) {
  const keys = Object.keys(env);
  const saved = {};
  for (const k of keys) {
    saved[k] = process.env[k];
    process.env[k] = env[k];
  }
  try {
    return run();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

function loadConfig() {
  let loaded;
  jest.isolateModules(() => {
    loaded = require('../src/config');
  });
  return loaded;
}

const BASE_DEV = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  INFLUX_URL: 'http://localhost:8086',
  INFLUX_TOKEN: 'x'.repeat(32),
  INFLUX_ORG: 'o',
  INFLUX_BUCKET: 'b',
  MQTT_BROKER_URL: 'mqtt://localhost:1883',
  JWT_SECRET: 'a'.repeat(40)
};

describe('config production guardrails', () => {
  it('APP_ENV=development accetta placeholder noti', () => {
    withEnv({
      ...BASE_DEV,
      JWT_SECRET: 'please-generate-at-least-32-character-secret-here',
      DATABASE_URL: 'postgresql://u:change_me_in_production@localhost:5432/db'
    }, () => {
      const cfg = loadConfig();
      expect(cfg.env).toBe('development');
      expect(cfg.isProduction).toBe(false);
    });
  });

  it('APP_ENV=production rifiuta JWT_SECRET placeholder', () => {
    expect(() => withEnv({
      ...BASE_DEV,
      APP_ENV: 'production',
      JWT_SECRET: 'please-generate-at-least-32-character-secret-here',
      MQTT_BROKER_URL: 'mqtts://broker.example.com:8883',
      CORS_ALLOWED_ORIGINS: 'https://factorymind.example.com'
    }, loadConfig)).toThrow(/Segreti di default rilevati/);
  });

  it('APP_ENV=production rifiuta JWT_SECRET troppo corto', () => {
    expect(() => withEnv({
      ...BASE_DEV,
      APP_ENV: 'production',
      JWT_SECRET: 'a'.repeat(16),
      MQTT_BROKER_URL: 'mqtts://broker.example.com',
      CORS_ALLOWED_ORIGINS: 'https://x.example.com'
    }, loadConfig)).toThrow(/Segreti di default rilevati/);
  });

  it('APP_ENV=production rifiuta DATABASE_URL con change_me', () => {
    expect(() => withEnv({
      ...BASE_DEV,
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://u:change_me_in_production@host/db',
      MQTT_BROKER_URL: 'mqtts://broker.example.com',
      CORS_ALLOWED_ORIGINS: 'https://x.example.com'
    }, loadConfig)).toThrow(/Segreti di default/);
  });

  it('APP_ENV=production rifiuta INFLUX_TOKEN placeholder', () => {
    expect(() => withEnv({
      ...BASE_DEV,
      APP_ENV: 'production',
      INFLUX_TOKEN: 'please-generate-long-random-token-and-set-here',
      MQTT_BROKER_URL: 'mqtts://broker.example.com',
      CORS_ALLOWED_ORIGINS: 'https://x.example.com'
    }, loadConfig)).toThrow(/Segreti di default/);
  });

  it('APP_ENV=production rifiuta MQTT non-TLS', () => {
    expect(() => withEnv({
      ...BASE_DEV,
      APP_ENV: 'production',
      MQTT_BROKER_URL: 'mqtt://broker.example.com:1883',
      CORS_ALLOWED_ORIGINS: 'https://x.example.com'
    }, loadConfig)).toThrow(/Segreti di default/);
  });

  it('APP_ENV=production rifiuta CORS localhost', () => {
    expect(() => withEnv({
      ...BASE_DEV,
      APP_ENV: 'production',
      MQTT_BROKER_URL: 'mqtts://broker.example.com',
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173'
    }, loadConfig)).toThrow(/Segreti di default/);
  });

  it('APP_ENV=production rifiuta CORS wildcard', () => {
    expect(() => withEnv({
      ...BASE_DEV,
      APP_ENV: 'production',
      MQTT_BROKER_URL: 'mqtts://broker.example.com',
      MQTT_PASSWORD: 's'.repeat(20),
      CORS_ALLOWED_ORIGINS: '*'
    }, loadConfig)).toThrow(/Segreti di default/);
  });

  // R-CONFIG-MQTT-001 — chiusura F-MED-005.
  it('APP_ENV=production rifiuta MQTT_PASSWORD vuota', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => withEnv({
        ...BASE_DEV,
        APP_ENV: 'production',
        MQTT_BROKER_URL: 'mqtts://broker.example.com:8883',
        MQTT_PASSWORD: '',
        CORS_ALLOWED_ORIGINS: 'https://x.example.com'
      }, loadConfig)).toThrow(/Segreti di default/);
      expect(errSpy.mock.calls.flat().join(' ')).toMatch(/MQTT_PASSWORD/);
    } finally {
      errSpy.mockRestore();
    }
  });

  it('APP_ENV=production rifiuta MQTT_PASSWORD troppo corta', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => withEnv({
        ...BASE_DEV,
        APP_ENV: 'production',
        MQTT_BROKER_URL: 'mqtts://broker.example.com:8883',
        MQTT_PASSWORD: 'short',
        CORS_ALLOWED_ORIGINS: 'https://x.example.com'
      }, loadConfig)).toThrow(/Segreti di default/);
      expect(errSpy.mock.calls.flat().join(' ')).toMatch(/MQTT_PASSWORD/);
    } finally {
      errSpy.mockRestore();
    }
  });

  it('APP_ENV=production accetta configurazione sana', () => {
    withEnv({
      ...BASE_DEV,
      APP_ENV: 'production',
      JWT_SECRET: 'z'.repeat(40),
      INFLUX_TOKEN: 'z'.repeat(40),
      DATABASE_URL: 'postgresql://u:strongSecretHere@db.example.com:5432/prod',
      MQTT_BROKER_URL: 'mqtts://broker.example.com:8883',
      MQTT_PASSWORD: 's'.repeat(20),
      CORS_ALLOWED_ORIGINS: 'https://app.factorymind.it,https://admin.factorymind.it'
    }, () => {
      const cfg = loadConfig();
      expect(cfg.isProduction).toBe(true);
      expect(cfg.security.corsOrigins).toEqual([
        'https://app.factorymind.it',
        'https://admin.factorymind.it'
      ]);
    });
  });
});
