/**
 * PostgreSQL connection pool.
 *
 * pg.Pool is lazy-initialised on first import. The pool is shared across
 * the process and is closed by the shutdown handler in src/index.js.
 */

'use strict';

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.postgres.url,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: config.service.name
});

pool.on('connect', () => {
  logger.debug('[pg] new client connected');
});

pool.on('error', (err) => {
  logger.error({ err }, '[pg] idle client error');
});

/**
 * Probe PostgreSQL liveness.
 *
 * @returns {Promise<{ok: boolean, latency_ms: number, message?: string}>}
 */
async function ping() {
  const started = Date.now();
  try {
    const res = await pool.query('SELECT 1 AS alive');
    return { ok: res.rows[0].alive === 1, latency_ms: Date.now() - started };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - started, message: err.message };
  }
}

async function close() {
  try {
    await pool.end();
    logger.info('[pg] pool closed');
  } catch (err) {
    logger.error({ err }, '[pg] error while closing pool');
  }
}

module.exports = { pool, ping, close };
