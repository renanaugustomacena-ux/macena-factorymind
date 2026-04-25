/**
 * Token service — mints / verifies / rotates access + refresh tokens.
 *
 * Access token: JWT, HS256, TTL 15 min (configurable). Stateless; carries
 *               the minimal claims needed for authz (`sub`, `email`, `role`,
 *               `scope`, `typ: 'access'`).
 *
 * Refresh token: opaque 32-byte random string, stored as SHA-256 hash in
 *                Postgres (`refresh_tokens` table). TTL 12 h absolute,
 *                rotated on every use. Reuse-detection: if a previously
 *                consumed token is presented, the entire family is revoked.
 *                This is RFC 6749 §10.4 compliant.
 *
 * Migration: 003_refresh_tokens.sql adds the backing table.
 */

'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const ACCESS_ALGORITHM = 'HS256';

function hashOpaque(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function mintAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      scope: user.facility_scope || [],
      typ: 'access'
    },
    config.security.jwtSecret,
    {
      algorithm: ACCESS_ALGORITHM,
      expiresIn: config.security.accessTokenTtl || '15m',
      issuer: 'factorymind',
      audience: 'factorymind-api'
    }
  );
}

/**
 * Mint an opaque refresh token and persist its hash for later verification.
 *
 * @param {import('pg').Pool} pool
 * @param {{ id: string }} user
 * @param {{ family?: string, userAgent?: string, ip?: string }} [meta]
 * @returns {Promise<{ refreshToken: string, family: string, expiresAt: Date }>}
 */
async function mintRefreshToken(pool, user, meta = {}) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const hash = hashOpaque(raw);
  const family = meta.family || crypto.randomUUID();
  const absoluteTtlHours = Number(config.security.refreshTokenTtlHours || 12);
  const expiresAt = new Date(Date.now() + absoluteTtlHours * 3600 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, family, expires_at, user_agent, ip)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [hash, user.id, family, expiresAt, meta.userAgent || '', meta.ip || null]
  );
  return { refreshToken: raw, family, expiresAt };
}

/**
 * Consume a refresh token:
 *   1. Lookup by hash. If missing / revoked / expired -> reject.
 *   2. If already consumed -> revoke the whole family (reuse detection).
 *   3. Otherwise mark consumed, mint new access + refresh within same family.
 */
async function rotateRefreshToken(pool, rawToken, meta = {}) {
  const hash = hashOpaque(rawToken);
  const { rows } = await pool.query(
    `SELECT id, user_id, family, expires_at, revoked_at, consumed_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [hash]
  );
  if (rows.length === 0) {
    const err = new Error('refresh token not found');
    err.status = 401;
    throw err;
  }
  const record = rows[0];
  if (record.revoked_at) {
    const err = new Error('refresh token revoked');
    err.status = 401;
    throw err;
  }
  if (record.consumed_at) {
    // Reuse detected — revoke the whole family.
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE family = $1 AND revoked_at IS NULL`,
      [record.family]
    );
    const err = new Error('refresh token reuse detected; family revoked');
    err.status = 401;
    throw err;
  }
  if (new Date(record.expires_at) < new Date()) {
    const err = new Error('refresh token expired');
    err.status = 401;
    throw err;
  }

  await pool.query(
    `UPDATE refresh_tokens SET consumed_at = NOW() WHERE id = $1`,
    [record.id]
  );

  // Mint new pair within the same family.
  const userRes = await pool.query(
    `SELECT id, email, role, facility_scope FROM users WHERE id = $1 AND active = TRUE`,
    [record.user_id]
  );
  if (userRes.rows.length === 0) {
    const err = new Error('user inactive or removed');
    err.status = 401;
    throw err;
  }
  const user = userRes.rows[0];
  const access = mintAccessToken(user);
  const refresh = await mintRefreshToken(pool, user, { ...meta, family: record.family });
  return { accessToken: access, ...refresh, user };
}

async function revokeAllForUser(pool, userId) {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

module.exports = {
  mintAccessToken,
  mintRefreshToken,
  rotateRefreshToken,
  revokeAllForUser,
  ACCESS_ALGORITHM,
  hashOpaque
};
