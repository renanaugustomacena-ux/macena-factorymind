-- =========================================================================
-- FactoryMind — initial schema.
-- Loaded automatically by PostgreSQL on first start via docker-entrypoint-initdb.d.
-- For migrations after the first deployment, switch to node-pg-migrate:
--   npm run migrate:create -- <name>
--   npm run migrate:up
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------- facilities
CREATE TABLE IF NOT EXISTS facilities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  address           TEXT NOT NULL DEFAULT '',
  city              TEXT NOT NULL DEFAULT '',
  province          TEXT NOT NULL DEFAULT '',
  country           TEXT NOT NULL DEFAULT 'IT',
  timezone          TEXT NOT NULL DEFAULT 'Europe/Rome',
  metadata          JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------- lines
CREATE TABLE IF NOT EXISTS lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       TEXT NOT NULL,
  line_id           TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  target_oee        NUMERIC(4,3) NOT NULL DEFAULT 0.60,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (facility_id, line_id)
);

-- -------------------------------------------------------------------- devices
CREATE TABLE IF NOT EXISTS devices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id           TEXT NOT NULL,
  line_id               TEXT NOT NULL,
  machine_id            TEXT NOT NULL,
  name                  TEXT NOT NULL,
  vendor                TEXT NOT NULL DEFAULT '',
  model                 TEXT NOT NULL DEFAULT '',
  serial                TEXT NOT NULL DEFAULT '',
  protocol              TEXT NOT NULL CHECK (protocol IN ('mqtt','opcua','modbus_tcp','modbus_rtu','sparkplug')),
  ideal_cycle_time_sec  NUMERIC(10,3) NOT NULL DEFAULT 0,
  opcua_tags            JSONB NOT NULL DEFAULT '[]'::JSONB,
  modbus_map            JSONB NOT NULL DEFAULT '[]'::JSONB,
  metadata              JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (facility_id, line_id, machine_id)
);
CREATE INDEX IF NOT EXISTS devices_facility_line_idx ON devices(facility_id, line_id);

-- --------------------------------------------------------------------- shifts
CREATE TABLE IF NOT EXISTS shifts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       TEXT NOT NULL,
  line_id           TEXT NOT NULL,
  shift_name        TEXT NOT NULL,
  start_at          TIMESTAMPTZ NOT NULL,
  end_at            TIMESTAMPTZ NOT NULL,
  planned_breaks_sec INTEGER NOT NULL DEFAULT 1800,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS shifts_facility_line_start_idx ON shifts(facility_id, line_id, start_at DESC);

-- ------------------------------------------------------------------ downtimes
CREATE TABLE IF NOT EXISTS downtimes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       TEXT NOT NULL,
  line_id           TEXT NOT NULL,
  machine_id        TEXT NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ,
  duration_sec      INTEGER NOT NULL DEFAULT 0,
  reason_code       TEXT,
  classification    TEXT NOT NULL DEFAULT 'unplanned' CHECK (classification IN ('planned', 'unplanned')),
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS downtimes_machine_started_idx ON downtimes(facility_id, line_id, machine_id, started_at DESC);
CREATE INDEX IF NOT EXISTS downtimes_reason_idx ON downtimes(reason_code);

-- ---------------------------------------------------------------- alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  facility_id       TEXT,
  line_id           TEXT,
  machine_id        TEXT,
  metric            TEXT NOT NULL,
  severity          TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning','major','critical')),
  expression        JSONB NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------- alerts
CREATE TABLE IF NOT EXISTS alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id           UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  facility_id       TEXT NOT NULL,
  line_id           TEXT NOT NULL,
  machine_id        TEXT NOT NULL,
  metric            TEXT NOT NULL,
  value             NUMERIC(20,6),
  severity          TEXT NOT NULL,
  message           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  fired_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at   TIMESTAMPTZ,
  acknowledged_by   TEXT,
  resolved_at       TIMESTAMPTZ,
  escalated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS alerts_status_fired_idx ON alerts(status, fired_at DESC);
CREATE INDEX IF NOT EXISTS alerts_machine_idx ON alerts(facility_id, line_id, machine_id);

-- ---------------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL UNIQUE,
  full_name         TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','supervisor','operator','viewer')),
  facility_scope    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  password_salt     TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------- audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id     UUID,
  actor_email       TEXT,
  action            TEXT NOT NULL,
  resource_type     TEXT,
  resource_id       TEXT,
  ip_address        INET,
  payload           JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx ON audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);
