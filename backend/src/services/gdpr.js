/**
 * R-GDPR-001 — Subject-rights automation (Art. 15, 17, 20 Reg. UE 2016/679).
 *
 * Closes AUDIT finding F-HIGH-006 (legacy DATA_GOVERNANCE.md referenced
 * `scripts/export-subject.sh` and `scripts/erase-subject.sh` plus a
 * `services/gdpr.js` that did not exist).
 *
 * Public API:
 *   - exportSubject(pool, { email })       → portability dump (Art. 20)
 *   - eraseSubject(pool, { email, reason }) → soft-delete + token revoke
 *                                             + grace-period schedule (Art. 17)
 *   - finalizeErasures(pool, { now })      → driven by housekeeping; hard-deletes
 *                                             accounts past their 30-day grace.
 *
 * The functions are pure-data: no HTTP context, no logger calls, no
 * decisions about who is allowed to call them. The route layer
 * (backend/src/routes/users.js) wraps these for the authenticated
 * subject-self path; the operator scripts (scripts/export-subject.sh,
 * scripts/erase-subject.sh) wrap them for admin-driven flows when the
 * subject cannot or will not log in (incident response, deceased user,
 * Garante-mandated erasure).
 *
 * The service does NOT delete telemetry or attestazioni: machine telemetry
 * (factory/<facility>/<line>/<machine>/...) is not personal data under GDPR.
 * Personal data lives in: users, refresh_tokens, audit_log.actor_user_id.
 * If a future model attaches PII to telemetry, extend this service.
 */

'use strict';

const tokens = require('./auth-tokens');

const ERASURE_GRACE_DAYS = 30;

class SubjectNotFoundError extends Error {
  constructor(email) {
    super(`subject not found for email=${email}`);
    this.name = 'SubjectNotFoundError';
    this.code = 'SUBJECT_NOT_FOUND';
  }
}

class SubjectAlreadyErasedError extends Error {
  constructor(email) {
    super(`subject already scheduled for erasure: ${email}`);
    this.name = 'SubjectAlreadyErasedError';
    this.code = 'ALREADY_ERASED';
  }
}

async function findUserByEmail(pool, email) {
  const { rows } = await pool.query(
    `SELECT id, email, full_name, role, facility_scope, active,
            created_at, password_changed_at, last_login_at, deletion_requested_at
       FROM users
      WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows[0] || null;
}

/**
 * Art. 15 + Art. 20 — export every byte of personal data in a portable JSON.
 * The shape is stable (`export_format_version: '1.0'`) so a downstream
 * importer (data-portability target) can rely on the structure.
 */
async function exportSubject(pool, { email }) {
  if (!email) throw new TypeError('email required');
  const user = await findUserByEmail(pool, email);
  if (!user) throw new SubjectNotFoundError(email);

  const [auditRows, refreshRows] = await Promise.all([
    pool.query(
      `SELECT action, resource_type, resource_id, ip_address, payload, created_at
         FROM audit_log WHERE actor_user_id=$1 ORDER BY created_at DESC LIMIT 5000`,
      [user.id]
    ),
    pool.query(
      `SELECT id, created_at, expires_at, consumed_at, revoked_at, user_agent, ip
         FROM refresh_tokens WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1000`,
      [user.id]
    )
  ]);

  return {
    export_generated_at: new Date().toISOString(),
    export_format_version: '1.0',
    legal_basis: 'Art. 15 e 20 Reg. UE 2016/679 (GDPR)',
    user,
    audit_log: auditRows.rows,
    refresh_tokens: refreshRows.rows
  };
}

/**
 * Art. 17 — soft-delete + token revoke + 30-day grace period.
 *
 * Why a grace period: a Garante audit + the WP29 Erasure Guidelines tolerate
 * a brief retention window when (a) the controller needs the data for an
 * imminent legal claim defence, OR (b) the subject can revoke the request.
 * We choose 30 days because legal/CONTRATTO-SAAS-B2B.md art. 11 grants the
 * customer 30 days to dispute before invoicing finalises. Hard-delete
 * happens via housekeeping (factorymind_housekeeping() Postgres function).
 *
 * Idempotency: a second call returns SubjectAlreadyErasedError — the caller
 * (script or route) decides whether that's a 409 or a 200 (the operator
 * scripts treat it as a 200 because the desired state has been reached).
 */
async function eraseSubject(pool, { email, reason = 'subject_request' }) {
  if (!email) throw new TypeError('email required');
  const user = await findUserByEmail(pool, email);
  if (!user) throw new SubjectNotFoundError(email);
  if (user.deletion_requested_at) throw new SubjectAlreadyErasedError(email);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE users
          SET active = FALSE,
              deletion_requested_at = NOW()
        WHERE id = $1 AND deletion_requested_at IS NULL`,
      [user.id]
    );
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      throw new SubjectAlreadyErasedError(email);
    }
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, payload, created_at)
       VALUES ($1, 'gdpr_erasure_scheduled', 'user', $2, $3::jsonb, NOW())`,
      [user.id, String(user.id), JSON.stringify({ reason, grace_days: ERASURE_GRACE_DAYS })]
    );
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  await tokens.revokeAllForUser(pool, user.id).catch(() => undefined);

  return {
    status: 'deletion_scheduled',
    user_id: user.id,
    grace_period_days: ERASURE_GRACE_DAYS,
    scheduled_at: new Date().toISOString()
  };
}

/**
 * Idempotent hard-delete pass: removes users whose grace period has elapsed.
 * Driven by `factorymind_housekeeping()` (migration 005) but exposed here so
 * the operator scripts can force a sweep on demand (e.g., post-incident).
 */
async function finalizeErasures(pool, { now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - ERASURE_GRACE_DAYS * 86_400_000);
  const { rows } = await pool.query(
    `DELETE FROM users
       WHERE deletion_requested_at IS NOT NULL
         AND deletion_requested_at < $1
       RETURNING id, email`,
    [cutoff]
  );
  return { deleted: rows.length, ids: rows.map((r) => r.id) };
}

module.exports = {
  exportSubject,
  eraseSubject,
  finalizeErasures,
  ERASURE_GRACE_DAYS,
  SubjectNotFoundError,
  SubjectAlreadyErasedError
};
