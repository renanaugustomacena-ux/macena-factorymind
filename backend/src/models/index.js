/**
 * Consolidated data-access helpers.
 *
 * Each function wraps a parameterised SQL query against the PostgreSQL
 * pool. Route handlers are free to compose these helpers or to write
 * their own queries directly — the model layer is pragmatic, not
 * heavyweight.
 */

'use strict';

const { pool } = require('../db/pool');

// ------------------------------------------------------------------ devices
const devices = {
  async findAll(filters = {}) {
    const params = [];
    const clauses = [];
    if (filters.facility_id) { params.push(filters.facility_id); clauses.push(`facility_id = $${params.length}`); }
    if (filters.line_id) { params.push(filters.line_id); clauses.push(`line_id = $${params.length}`); }
    if (filters.protocol) { params.push(filters.protocol); clauses.push(`protocol = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT * FROM devices ${where} ORDER BY facility_id, line_id, machine_id`, params);
    return rows;
  },
  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM devices WHERE id=$1', [id]);
    return rows[0] || null;
  },
  async findByMachineKey({ facility_id, line_id, machine_id }) {
    const { rows } = await pool.query(
      'SELECT * FROM devices WHERE facility_id=$1 AND line_id=$2 AND machine_id=$3',
      [facility_id, line_id, machine_id]
    );
    return rows[0] || null;
  }
};

// -------------------------------------------------------------------- lines
const lines = {
  async findAll(facilityId) {
    const params = facilityId ? [facilityId] : [];
    const where = facilityId ? 'WHERE facility_id=$1' : '';
    const { rows } = await pool.query(`SELECT * FROM lines ${where} ORDER BY facility_id, line_id`, params);
    return rows;
  },
  async findByKey({ facility_id, line_id }) {
    const { rows } = await pool.query(
      'SELECT * FROM lines WHERE facility_id=$1 AND line_id=$2',
      [facility_id, line_id]
    );
    return rows[0] || null;
  }
};

// --------------------------------------------------------------- facilities
const facilities = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM facilities ORDER BY name');
    return rows;
  },
  async findByKey(facility_id) {
    const { rows } = await pool.query('SELECT * FROM facilities WHERE facility_id=$1', [facility_id]);
    return rows[0] || null;
  }
};

// ------------------------------------------------------------------- alerts
const alerts = {
  async open(limit = 200) {
    const { rows } = await pool.query(
      `SELECT * FROM alerts WHERE status='open' ORDER BY fired_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  },
  async rules() {
    const { rows } = await pool.query('SELECT * FROM alert_rules WHERE enabled=TRUE ORDER BY name');
    return rows;
  }
};

// ------------------------------------------------------------------- shifts
const shifts = {
  async currentShift({ facility_id, line_id }, at = new Date()) {
    const { rows } = await pool.query(
      `SELECT * FROM shifts
       WHERE facility_id=$1 AND line_id=$2
         AND start_at <= $3 AND end_at > $3
       ORDER BY start_at DESC LIMIT 1`,
      [facility_id, line_id, at]
    );
    return rows[0] || null;
  },
  async plannedSecondsInWindow({ facility_id, line_id }, windowStart, windowEnd) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(
         EXTRACT(EPOCH FROM (LEAST(end_at, $4) - GREATEST(start_at, $3)))
       ), 0)::BIGINT AS seconds
       FROM shifts
       WHERE facility_id=$1 AND line_id=$2
         AND start_at < $4 AND end_at > $3`,
      [facility_id, line_id, windowStart, windowEnd]
    );
    return Number(rows[0].seconds) || 0;
  }
};

// ---------------------------------------------------------------- downtimes
const downtimes = {
  async record({ facility_id, line_id, machine_id, started_at, ended_at, reason_code, classification }) {
    const durationSec = Math.max(0, Math.round((new Date(ended_at) - new Date(started_at)) / 1000));
    const { rows } = await pool.query(
      `INSERT INTO downtimes (facility_id, line_id, machine_id, started_at, ended_at,
                              duration_sec, reason_code, classification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [facility_id, line_id, machine_id, started_at, ended_at, durationSec, reason_code, classification]
    );
    return rows[0];
  },
  async paretoTopReasons({ facility_id, line_id, start, end, limit = 10 }) {
    const { rows } = await pool.query(
      `SELECT reason_code, COUNT(*) AS occurrences, SUM(duration_sec) AS total_seconds
       FROM downtimes
       WHERE facility_id=$1 AND ($2::TEXT IS NULL OR line_id=$2)
         AND started_at >= $3 AND started_at <= $4
       GROUP BY reason_code
       ORDER BY total_seconds DESC
       LIMIT $5`,
      [facility_id, line_id || null, start, end, limit]
    );
    return rows;
  }
};

// -------------------------------------------------------------------- users
const users = {
  async findByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    return rows[0] || null;
  },
  async findById(id) {
    const { rows } = await pool.query(
      'SELECT id, email, full_name, role, facility_scope, active, created_at FROM users WHERE id=$1',
      [id]
    );
    return rows[0] || null;
  }
};

module.exports = { devices, lines, facilities, alerts, shifts, downtimes, users };
