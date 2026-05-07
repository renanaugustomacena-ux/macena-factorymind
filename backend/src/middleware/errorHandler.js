/**
 * Centralised error handler — emits RFC 7807 "Problem Details for HTTP APIs"
 * (application/problem+json).
 *
 * Shape of the response body:
 *   {
 *     type: "https://factorymind.example/problems/<slug>",
 *     title: "<human readable summary>",
 *     status: <HTTP status>,
 *     detail: "<specific error message>",
 *     instance: "<originating URL path>"
 *   }
 *
 * The `type` URI is opaque — it is not fetched. Clients are expected to
 * dispatch on the `title` or the HTTP status. Keeping a stable URI per
 * error class makes it safe to add machine-readable fields later.
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

const PROBLEM_BASE = 'https://factorymind.example/problems';
// R-ERROR-SAFE-001 — F-MED-CODE-005 closure. For status >= 500 the central
// handler MUST NOT echo `err.message` to the client; driver-level text
// (DB DSNs, file paths, MQTT topics) leaks through that field. The full
// error remains in the server-side log under the same `event_id` returned
// in the response so the operator can correlate.
const GENERIC_INTERNAL_DETAIL =
  'Errore interno — i dettagli tecnici sono nei log del server.';

const TITLE_BY_STATUS = Object.freeze({
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
});

const SLUG_BY_STATUS = Object.freeze({
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  405: 'method-not-allowed',
  409: 'conflict',
  413: 'payload-too-large',
  415: 'unsupported-media-type',
  422: 'unprocessable-entity',
  429: 'too-many-requests',
  500: 'internal-server-error',
  501: 'not-implemented',
  502: 'bad-gateway',
  503: 'service-unavailable',
  504: 'gateway-timeout'
});

function buildProblem({ status, title, detail, instance, extra }) {
  const resolved = Number.isInteger(status) && status >= 400 ? status : 500;
  const slug = SLUG_BY_STATUS[resolved] || 'about-blank';
  return {
    type: `${PROBLEM_BASE}/${slug}`,
    title: title || TITLE_BY_STATUS[resolved] || 'Error',
    status: resolved,
    detail: detail || '',
    instance: instance || '',
    ...(extra && typeof extra === 'object' ? extra : {})
  };
}

 
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isInternal = status >= 500;
  const eventId = isInternal ? crypto.randomBytes(8).toString('hex') : undefined;
  const code = typeof err.code === 'string' ? err.code : (isInternal ? 'INTERNAL' : undefined);
  if (isInternal) {
    logger.error(
      {
        err: err.message,
        stack: err.stack,
        code,
        event_id: eventId,
        route: req.originalUrl,
        method: req.method
      },
      '[http] unhandled error'
    );
  } else {
    logger.warn(
      { err: err.message, status, route: req.originalUrl, method: req.method },
      '[http] client error'
    );
  }
  const detail = isInternal ? GENERIC_INTERNAL_DETAIL : (err.message || 'error');
  const extra = {};
  if (eventId) extra.event_id = eventId;
  if (code) extra.code = code;
  const body = buildProblem({
    status,
    title: err.title,
    detail,
    instance: req.originalUrl,
    extra: Object.keys(extra).length > 0 ? extra : undefined
  });
  res.status(body.status);
  res.set('Content-Type', 'application/problem+json; charset=utf-8');
  res.json(body);
}

/**
 * Helper middleware to send a problem-details response directly. Usage:
 *   return sendProblem(res, 404, 'device not found', req);
 */
function sendProblem(res, status, detail, req, extra) {
  const body = buildProblem({
    status,
    detail,
    instance: req?.originalUrl || '',
    extra
  });
  res.status(body.status);
  res.set('Content-Type', 'application/problem+json; charset=utf-8');
  return res.json(body);
}

/**
 * 404 catch-all (must be wired AFTER all routers).
 */
function notFoundHandler(req, res) {
  return sendProblem(res, 404, `Route not found: ${req.method} ${req.originalUrl}`, req);
}

module.exports = { errorHandler, sendProblem, notFoundHandler, buildProblem };
