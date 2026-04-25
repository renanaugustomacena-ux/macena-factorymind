-- =========================================================================
-- FactoryMind — 003_refresh_tokens.
-- Adds refresh-token storage + account-lockout tracking columns.
-- Run via node-pg-migrate `npm run migrate:up` or automatically by
-- docker-entrypoint-initdb.d on a fresh database.
-- =========================================================================

-- Refresh tokens: opaque random strings stored as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      TEXT NOT NULL UNIQUE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family          UUID NOT NULL,                      -- rotates together; reuse of any member revokes all
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,                        -- set when token is traded for a new pair
  revoked_at      TIMESTAMPTZ,                        -- explicit revoke
  user_agent      TEXT NOT NULL DEFAULT '',
  ip              INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx      ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx    ON refresh_tokens(family);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx   ON refresh_tokens(expires_at);

-- Account lockout: counters on the users table.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Optional: session_revocation blacklist (used if we ever issue long-lived
-- access tokens; currently unused because TTL is 15 min).
CREATE TABLE IF NOT EXISTS revoked_access_tokens (
  jti             TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason          TEXT
);

-- Housekeeping job placeholder: periodic prune of expired / consumed rows
-- should run daily; implemented as an application-level cron.
