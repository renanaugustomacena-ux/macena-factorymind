/**
 * FactoryMind — centralised configuration with Joi validation.
 *
 * Environment variables are loaded once at process boot via dotenv, validated
 * via a Joi schema, and re-exported as an immutable object. Any service that
 * needs configuration imports this module and reads from the returned object;
 * no service should read `process.env` directly.
 */

'use strict';

require('dotenv').config();

const Joi = require('joi');

const schema = Joi.object({
  APP_ENV: Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
  APP_PORT: Joi.number().integer().min(1).max(65535).default(3002),
  LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),

  INFLUX_URL: Joi.string().uri().required(),
  INFLUX_TOKEN: Joi.string().min(16).required(),
  INFLUX_ORG: Joi.string().required(),
  INFLUX_BUCKET: Joi.string().required(),
  INFLUX_RETENTION_DAYS_RAW: Joi.number().integer().min(1).max(3650).default(30),
  INFLUX_RETENTION_DAYS_1M: Joi.number().integer().min(1).max(3650).default(365),
  INFLUX_RETENTION_DAYS_1H: Joi.number().integer().min(1).max(3650).default(1095),

  MQTT_BROKER_URL: Joi.string().uri({ scheme: ['mqtt', 'mqtts', 'ws', 'wss'] }).required(),
  MQTT_USERNAME: Joi.string().allow('').default(''),
  MQTT_PASSWORD: Joi.string().allow('').default(''),
  MQTT_CLIENT_ID: Joi.string().default('factorymind-backend'),
  MQTT_KEEP_ALIVE: Joi.number().integer().min(10).max(300).default(30),
  MQTT_RECONNECT_PERIOD: Joi.number().integer().min(500).max(60000).default(2000),
  MQTT_QOS_TELEMETRY: Joi.number().integer().min(0).max(2).default(0),
  MQTT_QOS_ALARMS: Joi.number().integer().min(0).max(2).default(1),
  MQTT_QOS_COMMANDS: Joi.number().integer().min(0).max(2).default(2),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_ALGORITHM: Joi.string().valid('HS256').default('HS256'),
  JWT_REFRESH_TTL_HOURS: Joi.number().integer().min(1).max(168).default(12),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  CORS_ALLOWED_ORIGINS: Joi.string().default('http://localhost:5173'),
  API_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  API_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(60),
  SESSION_IDLE_TIMEOUT_MIN: Joi.number().integer().min(1).max(1440).default(15),
  SESSION_ABSOLUTE_TIMEOUT_HR: Joi.number().integer().min(1).max(24).default(12),
  ACCOUNT_LOCKOUT_THRESHOLD: Joi.number().integer().min(1).max(50).default(5),
  ACCOUNT_LOCKOUT_CAP_SECONDS: Joi.number().integer().min(30).max(86400).default(900),
  PASSWORD_MIN_LENGTH: Joi.number().integer().min(8).max(64).default(12),
  SPARKPLUG_ENABLED: Joi.boolean().default(false),
  HIBP_API_URL: Joi.string().allow('').default('https://api.pwnedpasswords.com/range'),
  HIBP_DISABLED: Joi.boolean().default(false),

  OTEL_SERVICE_NAME: Joi.string().default('factorymind-backend'),
  OTEL_SERVICE_VERSION: Joi.string().default('1.0.0'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().allow('').default(''),
  OTEL_EXPORTER_OTLP_PROTOCOL: Joi.string().valid('grpc', 'http/protobuf').default('grpc'),
  OTEL_TRACES_SAMPLER: Joi.string().default('parentbased_traceidratio'),
  OTEL_TRACES_SAMPLER_ARG: Joi.number().min(0).max(1).default(0.05),

  OPCUA_ENABLED: Joi.boolean().default(false),
  OPCUA_ENDPOINT: Joi.string().allow('').default(''),
  OPCUA_SECURITY_POLICY: Joi.string().default('Basic256Sha256'),
  OPCUA_SECURITY_MODE: Joi.string().default('SignAndEncrypt'),
  OPCUA_USERNAME: Joi.string().allow('').default(''),
  OPCUA_PASSWORD: Joi.string().allow('').default(''),
  OPCUA_SAMPLING_INTERVAL_MS: Joi.number().integer().min(100).default(1000),
  OPCUA_PUBLISHING_INTERVAL_MS: Joi.number().integer().min(100).default(1000),

  MODBUS_ENABLED: Joi.boolean().default(false),
  MODBUS_TCP_HOST: Joi.string().allow('').default(''),
  MODBUS_TCP_PORT: Joi.number().integer().min(1).max(65535).default(502),
  MODBUS_UNIT_ID: Joi.number().integer().min(0).max(255).default(1),
  MODBUS_POLL_INTERVAL_MS: Joi.number().integer().min(100).default(2000),

  ALERT_EVAL_INTERVAL_MS: Joi.number().integer().min(500).default(5000),
  ALERT_ESCALATION_INTERVAL_MS: Joi.number().integer().min(1000).default(300000),
  ALERT_SMTP_HOST: Joi.string().allow('').default(''),
  ALERT_SMTP_PORT: Joi.number().integer().default(587),
  ALERT_SMTP_USER: Joi.string().allow('').default(''),
  ALERT_SMTP_PASSWORD: Joi.string().allow('').default(''),
  ALERT_SMTP_FROM: Joi.string().allow('').default('')
}).unknown(true);

const { value, error } = schema.validate(process.env, {
  abortEarly: false,
  convert: true,
  stripUnknown: false
});

if (error) {
  const details = error.details.map((d) => `  - ${d.message}`).join('\n');

  console.error(`[config] environment validation failed:\n${details}`);
  throw new Error('FactoryMind configuration invalid — see validation errors above.');
}

// =============================================================================
// Production guardrails — rifiuta il boot con segreti di default.
// In produzione NON deve esistere alcun placeholder documentato nel repo:
//   - JWT_SECRET placeholder → forgia di token arbitrari
//   - POSTGRES_PASSWORD default → accesso DB diretto
//   - INFLUX_TOKEN default → lettura/scrittura metriche
//   - MQTT_PASSWORD vuota → pubblicazione dati falsi sul broker
// Questi controlli sono FAIL-CLOSED: nessun workaround, nessun flag "ignore".
// Se il cliente ha una ragione legittima per usare credenziali custom in
// prod, deve comunque sostituire questi valori; non accettiamo il default.
// =============================================================================
if (value.APP_ENV === 'production') {
  const forbidden = [];
  if (
    value.JWT_SECRET === 'please-generate-at-least-32-character-secret-here' ||
    value.JWT_SECRET.length < 32
  ) {
    forbidden.push('JWT_SECRET deve essere un segreto privato di almeno 32 caratteri (non il placeholder di .env.example).');
  }
  if (/change_me|change-me|please-generate/i.test(value.DATABASE_URL)) {
    forbidden.push('DATABASE_URL contiene ancora un placeholder (es. change_me_in_production).');
  }
  if (
    value.INFLUX_TOKEN === 'please-generate-long-random-token-and-set-here' ||
    value.INFLUX_TOKEN.length < 32
  ) {
    forbidden.push('INFLUX_TOKEN deve essere un token casuale di almeno 32 caratteri.');
  }
  if (value.MQTT_BROKER_URL && !/^mqtts|wss/i.test(value.MQTT_BROKER_URL)) {
    forbidden.push('MQTT_BROKER_URL deve usare TLS in produzione (mqtts:// o wss://).');
  }
  if (value.CORS_ALLOWED_ORIGINS && /\*|localhost|127\.0\.0\.1/i.test(value.CORS_ALLOWED_ORIGINS)) {
    forbidden.push('CORS_ALLOWED_ORIGINS non può contenere "*" o host locali in produzione.');
  }
  if (forbidden.length > 0) {
    const lines = forbidden.map((l) => `  - ${l}`).join('\n');

    console.error(
      `[config] PRODUCTION BOOT BLOCCATO per valori insicuri:\n${lines}\n` +
      '        Aggiornare .env o gestore di segreti prima di riprovare.'
    );
    throw new Error('Segreti di default rilevati in produzione: boot annullato.');
  }
}

const config = Object.freeze({
  env: value.APP_ENV,
  isProduction: value.APP_ENV === 'production',
  port: value.APP_PORT,
  logLevel: value.LOG_LEVEL,
  service: {
    name: value.OTEL_SERVICE_NAME,
    version: value.OTEL_SERVICE_VERSION
  },
  postgres: {
    url: value.DATABASE_URL
  },
  influx: {
    url: value.INFLUX_URL,
    token: value.INFLUX_TOKEN,
    org: value.INFLUX_ORG,
    bucket: value.INFLUX_BUCKET,
    retentionDays: {
      raw: value.INFLUX_RETENTION_DAYS_RAW,
      oneMinute: value.INFLUX_RETENTION_DAYS_1M,
      oneHour: value.INFLUX_RETENTION_DAYS_1H
    }
  },
  mqtt: {
    url: value.MQTT_BROKER_URL,
    username: value.MQTT_USERNAME,
    password: value.MQTT_PASSWORD,
    clientId: `${value.MQTT_CLIENT_ID}-${process.pid}`,
    keepAlive: value.MQTT_KEEP_ALIVE,
    reconnectPeriod: value.MQTT_RECONNECT_PERIOD,
    qos: {
      telemetry: value.MQTT_QOS_TELEMETRY,
      alarms: value.MQTT_QOS_ALARMS,
      commands: value.MQTT_QOS_COMMANDS
    }
  },
  security: {
    jwtSecret: value.JWT_SECRET,
    jwtAlgorithm: value.JWT_ALGORITHM,
    jwtExpiresIn: value.JWT_EXPIRES_IN,
    accessTokenTtl: value.JWT_ACCESS_TTL,
    refreshTokenTtlHours: value.JWT_REFRESH_TTL_HOURS,
    corsOrigins: value.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    rateLimit: {
      windowMs: value.API_RATE_LIMIT_WINDOW_MS,
      max: value.API_RATE_LIMIT_MAX
    },
    session: {
      idleTimeoutMin: value.SESSION_IDLE_TIMEOUT_MIN,
      absoluteTimeoutHr: value.SESSION_ABSOLUTE_TIMEOUT_HR
    },
    lockout: {
      threshold: value.ACCOUNT_LOCKOUT_THRESHOLD,
      capSeconds: value.ACCOUNT_LOCKOUT_CAP_SECONDS
    },
    password: {
      minLength: value.PASSWORD_MIN_LENGTH
    },
    hibp: {
      url: value.HIBP_API_URL,
      disabled: value.HIBP_DISABLED
    }
  },
  sparkplug: {
    enabled: value.SPARKPLUG_ENABLED
  },
  otel: {
    endpoint: value.OTEL_EXPORTER_OTLP_ENDPOINT,
    protocol: value.OTEL_EXPORTER_OTLP_PROTOCOL,
    sampler: value.OTEL_TRACES_SAMPLER,
    samplerArg: value.OTEL_TRACES_SAMPLER_ARG
  },
  opcua: {
    enabled: value.OPCUA_ENABLED,
    endpoint: value.OPCUA_ENDPOINT,
    securityPolicy: value.OPCUA_SECURITY_POLICY,
    securityMode: value.OPCUA_SECURITY_MODE,
    username: value.OPCUA_USERNAME,
    password: value.OPCUA_PASSWORD,
    samplingIntervalMs: value.OPCUA_SAMPLING_INTERVAL_MS,
    publishingIntervalMs: value.OPCUA_PUBLISHING_INTERVAL_MS
  },
  modbus: {
    enabled: value.MODBUS_ENABLED,
    host: value.MODBUS_TCP_HOST,
    port: value.MODBUS_TCP_PORT,
    unitId: value.MODBUS_UNIT_ID,
    pollIntervalMs: value.MODBUS_POLL_INTERVAL_MS
  },
  alerts: {
    evalIntervalMs: value.ALERT_EVAL_INTERVAL_MS,
    escalationIntervalMs: value.ALERT_ESCALATION_INTERVAL_MS,
    smtp: {
      host: value.ALERT_SMTP_HOST,
      port: value.ALERT_SMTP_PORT,
      user: value.ALERT_SMTP_USER,
      password: value.ALERT_SMTP_PASSWORD,
      from: value.ALERT_SMTP_FROM
    }
  }
});

module.exports = config;
