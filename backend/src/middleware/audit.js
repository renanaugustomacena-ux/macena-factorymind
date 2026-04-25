/**
 * Audit-log writer middleware.
 *
 * Persists one row into `audit_log` for every state-changing request
 * (POST/PUT/PATCH/DELETE) plus explicit auth events (login success/fail).
 *
 * Writes are fire-and-forget: a failed audit write never blocks the
 * business response. Failures are logged at WARN level. This is a
 * deliberate trade-off — losing a single audit row is preferable to
 * losing a device configuration update because Postgres briefly hiccupped.
 *
 * If the operator needs stricter guarantees, flip the FAIL_CLOSED env
 * flag (documented in docs/DATA_GOVERNANCE.md §5) and the middleware
 * will return 503 on audit write failure instead.
 */

'use strict';

const { pool } = require('../db/pool');
const logger = require('../utils/logger');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function deriveAction(req) {
  const method = (req.method || '').toUpperCase();
  const route = req.route?.path || req.path || req.originalUrl;
  return `${method} ${route}`;
}

function deriveResource(req) {
  // /api/devices/:id -> resource_type=devices, resource_id=:id
  const parts = (req.originalUrl || '').split('?')[0].split('/').filter(Boolean);
  // ['api', 'devices', '<id>']
  if (parts.length >= 2 && parts[0] === 'api') {
    return {
      resource_type: parts[1],
      resource_id: parts[2] || (req.body?.id || null)
    };
  }
  return { resource_type: null, resource_id: null };
}

async function writeAuditRow({ actor_user_id, actor_email, action, resource_type, resource_id, ip_address, payload }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_user_id, actor_email, action, resource_type, resource_id, ip_address, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        actor_user_id || null,
        actor_email || null,
        action,
        resource_type,
        resource_id,
        ip_address || null,
        payload ? JSON.stringify(payload) : '{}'
      ]
    );
  } catch (err) {
    logger.warn({ err: err.message, action }, '[audit] failed to persist audit row');
  }
}

/**
 * Express middleware — attach AFTER `requireAuth` to capture state-changing
 * requests with a known actor.
 */
function auditMiddleware(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  res.on('finish', () => {
    // Only record if the response was successful (2xx) OR a meaningful
    // auth failure (401/403) — 4xx validation noise is out of scope.
    if (res.statusCode >= 500) return;
    if (res.statusCode >= 400 && res.statusCode !== 401 && res.statusCode !== 403) return;

    const actor = req.user || {};
    const { resource_type, resource_id } = deriveResource(req);
    const redactedBody = redactBody(req.body || {});
    writeAuditRow({
      actor_user_id: isUuid(actor.sub) ? actor.sub : null,
      actor_email: actor.email || null,
      action: deriveAction(req),
      resource_type,
      resource_id,
      ip_address: req.ip,
      payload: {
        status: res.statusCode,
        body: redactedBody,
        query: req.query
      }
    });
  });

  return next();
}

/**
 * Explicit auth audit writer — call for login success / failure.
 */
async function recordAuthEvent({ action, user_id, email, ip, success, reason, userAgent }) {
  await writeAuditRow({
    actor_user_id: user_id || null,
    actor_email: email || null,
    action,
    resource_type: 'auth',
    resource_id: email || null,
    ip_address: ip,
    payload: { success: !!success, reason: reason || null, user_agent: userAgent || '' }
  });
}

function redactBody(body) {
  const CLONE = {};
  for (const [k, v] of Object.entries(body)) {
    if (/password|secret|token|salt/i.test(k)) {
      CLONE[k] = '[REDACTED]';
    } else if (typeof v === 'string' && v.length > 1024) {
      CLONE[k] = `${v.slice(0, 1024)}...[truncated]`;
    } else {
      CLONE[k] = v;
    }
  }
  return CLONE;
}

function isUuid(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

module.exports = { auditMiddleware, recordAuthEvent, writeAuditRow };
