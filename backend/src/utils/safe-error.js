/**
 * R-ERROR-SAFE-001 — F-MED-CODE-005 closure.
 *
 * Send a safe internal-server-error response without leaking driver-level
 * `err.message` text (which can include DB DSNs, file paths, MQTT topic
 * patterns, OPC-UA endpoint IPs, and other infrastructure details).
 *
 * Usage in route handlers:
 *
 *   const { safeInternal } = require('../utils/safe-error');
 *   try {
 *     // ... work that may throw ...
 *   } catch (err) {
 *     return safeInternal(res, 'OEE_CALC_FAILED', err, req);
 *   }
 *
 * The full error (message + stack) is logged server-side at ERROR with a
 * random `event_id` that is also returned in the response body, so an
 * end-user can quote it to support and the operator can grep the logs.
 *
 * Use the central `errorHandler` middleware (via `next(err)`) when the
 * handler can let Express propagate; use `safeInternal` directly when the
 * handler wants to return synchronously without invoking `next`.
 */

'use strict';

const crypto = require('crypto');
const logger = require('./logger');

const PROBLEM_BASE = 'https://factorymind.example/problems';
const GENERIC_DETAIL =
  'Errore interno — i dettagli tecnici sono nei log del server.';

function newEventId() {
  return crypto.randomBytes(8).toString('hex');
}

function safeInternal(res, code, err, req) {
  const eventId = newEventId();
  const stableCode = typeof code === 'string' && code.length > 0 ? code : 'INTERNAL';
  logger.error(
    {
      err: err?.message,
      stack: err?.stack,
      code: stableCode,
      event_id: eventId,
      route: req?.originalUrl,
      method: req?.method
    },
    '[http] internal error caught'
  );
  res.status(500);
  res.set('Content-Type', 'application/problem+json; charset=utf-8');
  return res.json({
    type: `${PROBLEM_BASE}/internal-server-error`,
    title: 'Internal Server Error',
    status: 500,
    detail: GENERIC_DETAIL,
    instance: req?.originalUrl || '',
    code: stableCode,
    event_id: eventId
  });
}

module.exports = { safeInternal, GENERIC_DETAIL, newEventId };
