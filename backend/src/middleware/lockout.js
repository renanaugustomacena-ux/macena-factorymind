/**
 * Account lockout — tracks failed-login attempts per email and enforces
 * exponential backoff with a configurable hard cap.
 *
 * Algorithm (per user):
 *   1. On failed login: increment `failed_login_count`, set
 *      `last_failed_login_at = NOW()`, and compute lockout window:
 *          lockout_seconds = min(2 ^ (n - threshold), CAP_SECONDS)
 *      where n is the new failed count and threshold = 5.
 *   2. On successful login: reset `failed_login_count` to 0, clear
 *      `locked_until`, set `last_login_at = NOW()`.
 *   3. If `locked_until > NOW()`, login attempts are rejected with 429.
 *
 * This frustrates credential-stuffing without locking out a legitimate
 * user who mistypes once. The CAP_SECONDS (default 900 s = 15 min) caps
 * the worst-case lockout.
 */

'use strict';

const { pool } = require('../db/pool');

const THRESHOLD = Number(process.env.ACCOUNT_LOCKOUT_THRESHOLD || 5);
const CAP_SECONDS = Number(process.env.ACCOUNT_LOCKOUT_CAP_SECONDS || 900);

// Cap esplicito dell'esponente a 20 per evitare qualunque overflow/Infinity
// sul calcolo 2^n anche quando failedCount è patologicamente alto (es. bot
// che martella il login). 2^20 = ~1.05M secondi, ampiamente sopra CAP_SECONDS.
const MAX_EXPONENT = 20;

function computeLockoutSeconds(failedCount) {
  if (failedCount <= THRESHOLD) return 0;
  const over = Math.min(failedCount - THRESHOLD, MAX_EXPONENT);
  const seconds = Math.min(2 ** over, CAP_SECONDS);
  return seconds;
}

async function isLocked(email) {
  const { rows } = await pool.query(
    `SELECT locked_until FROM users WHERE email = $1`,
    [email]
  );
  if (rows.length === 0) return { locked: false };
  const lockedUntil = rows[0].locked_until;
  if (!lockedUntil) return { locked: false };
  const until = new Date(lockedUntil);
  if (until > new Date()) {
    return { locked: true, retry_after_seconds: Math.ceil((until.getTime() - Date.now()) / 1000) };
  }
  return { locked: false };
}

async function recordFailure(email) {
  const { rows } = await pool.query(
    `UPDATE users
     SET failed_login_count = failed_login_count + 1,
         last_failed_login_at = NOW(),
         locked_until = CASE
           WHEN failed_login_count + 1 > $2 THEN NOW() + ($3::int * INTERVAL '1 second')
           ELSE locked_until
         END
     WHERE email = $1
     RETURNING failed_login_count, locked_until`,
    [email, THRESHOLD, Math.max(1, Math.floor(2 ** 1))]
  );
  if (rows.length === 0) return null;
  // Re-compute a better lockout interval now that we know the count.
  const count = rows[0].failed_login_count;
  const seconds = computeLockoutSeconds(count);
  if (seconds > 0) {
    await pool.query(
      `UPDATE users SET locked_until = NOW() + ($2::int * INTERVAL '1 second') WHERE email = $1`,
      [email, seconds]
    );
  }
  return { failed_count: count, lockout_seconds: seconds };
}

async function recordSuccess(email) {
  await pool.query(
    `UPDATE users
     SET failed_login_count = 0,
         locked_until = NULL,
         last_login_at = NOW()
     WHERE email = $1`,
    [email]
  );
}

module.exports = { isLocked, recordFailure, recordSuccess, THRESHOLD, CAP_SECONDS, computeLockoutSeconds };
