/**
 * Structured Pino logger.
 *
 * All logs emitted as newline-delimited JSON, ready for shipping to Loki,
 * Elasticsearch, or any other structured-log sink. Correlation-id support
 * is implemented via pino-http in `src/middleware/requestId.js`.
 */

'use strict';

const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.logLevel,
  base: {
    service: config.service.name,
    version: config.service.version,
    env: config.env,
    pid: process.pid
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'mqtt.password',
      'postgres.url',
      'influx.token',
      'security.jwtSecret',
      'password',
      '*.password',
      '*.token',
      '*.secret'
    ],
    censor: '[REDACTED]'
  },
  formatters: {
    level: (label) => ({ level: label })
  }
});

module.exports = logger;
