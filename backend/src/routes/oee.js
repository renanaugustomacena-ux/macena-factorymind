/**
 * /api/oee — compute OEE per machine, line, or facility for a given window.
 *
 * Inputs are read from:
 *   - PostgreSQL `shifts` table (planned production time)
 *   - PostgreSQL `downtimes` table (unplanned stoppage)
 *   - InfluxDB `counters` measurement (good + total counts)
 *   - PostgreSQL `devices.ideal_cycle_time_sec` (ideal cycle time)
 */

'use strict';

const { Router } = require('express');
const Joi = require('joi');
const { pool } = require('../db/pool');
const { queryApi } = require('../services/influx-writer');
const { computeOEE, aggregateOEE } = require('../services/oee-calculator');
const { requireAuth } = require('../middleware/auth');
const config = require('../config');

const router = Router();
router.use(requireAuth);

// Whitelist stretto per qualunque stringa iniettata in Flux: solo caratteri
// alfanumerici minuscoli, trattini, underscore e punti. Blocca virgolette,
// parentesi, pipe, e tutto il resto utilizzabile per injection Flux.
const FLUX_SAFE_IDENT = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const fluxIdent = Joi.string().pattern(FLUX_SAFE_IDENT).max(64);

// Range Flux: solo negative durations (es. `-8h`, `-30m`) o `now()`.
// Blocca iniezione di sottoespressioni Flux nel range.
const FLUX_RANGE = /^(?:-\d{1,5}(?:ns|us|ms|s|m|h|d|w|mo|y)|now\(\)|0)$/;
const fluxRange = Joi.string().pattern(FLUX_RANGE).max(16);

const querySchema = Joi.object({
  facility: fluxIdent.required(),
  line: fluxIdent.optional(),
  machine: fluxIdent.optional(),
  start: fluxRange.default('-8h'),
  stop: fluxRange.default('now()')
});

// Nome bucket validato alla partenza processo — non proveniente da input utente,
// ma validato per coerenza con il resto della pipeline.
const BUCKET = (config.influx.bucket || '').match(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/)
  ? config.influx.bucket
  : 'factory-telemetry';

async function machineCounters({ facility, line, machine, start, stop }) {
  // Tutti i parametri sono già validati dal querySchema; il bucket è validato
  // a tempo di boot. Nessuna interpolazione di input non-whitelisted.
  const flux = `
    from(bucket: "${BUCKET}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r._measurement == "counters")
      |> filter(fn: (r) => r.facility == "${facility}")
      |> filter(fn: (r) => r.line == "${line}")
      |> filter(fn: (r) => r.machine == "${machine}")
      |> last()
      |> keep(columns: ["_field", "_value"])
  `;
  const out = { good: 0, total: 0 };
  await new Promise((resolve, reject) => {
    queryApi.queryRows(flux, {
      next(row, meta) {
        const o = meta.toObject(row);
        if (o._field === 'good') out.good = Number(o._value) || 0;
        if (o._field === 'total') out.total = Number(o._value) || 0;
      },
      error: reject,
      complete: resolve
    });
  });
  return out;
}

async function machineOEE({ facility, line, machine, start, stop }) {
  const [{ rows: deviceRows }, counters] = await Promise.all([
    pool.query(
      `SELECT ideal_cycle_time_sec FROM devices
       WHERE facility_id=$1 AND line_id=$2 AND machine_id=$3 LIMIT 1`,
      [facility, line, machine]
    ),
    machineCounters({ facility, line, machine, start, stop })
  ]);

  const ideal = deviceRows[0]?.ideal_cycle_time_sec || 0;

  // Planned time = shift duration intersecting [start,stop].
  const plannedRes = await pool.query(
    `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(end_at, NOW()) - start_at))), 0) AS seconds
     FROM shifts WHERE facility_id=$1 AND line_id=$2
       AND start_at < NOW() AND end_at > NOW() - INTERVAL '24 hours'`,
    [facility, line]
  );
  const planned = Number(plannedRes.rows[0].seconds) || 28_800; // default to 8 h if no shift defined

  const downRes = await pool.query(
    `SELECT COALESCE(SUM(duration_sec), 0) AS seconds
     FROM downtimes
     WHERE facility_id=$1 AND line_id=$2 AND machine_id=$3
       AND started_at > NOW() - INTERVAL '24 hours'
       AND (classification = 'unplanned' OR classification IS NULL)`,
    [facility, line, machine]
  );
  const downtime = Number(downRes.rows[0].seconds) || 0;

  const result = computeOEE({
    plannedProductionTimeSec: planned,
    downtimeSec: downtime,
    idealCycleTimeSec: ideal,
    totalCount: counters.total,
    goodCount: counters.good
  });
  return { facility, line, machine, ...result };
}

router.get('/', async (req, res, next) => {
  try {
    const { value, error } = querySchema.validate(req.query, { convert: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });

    if (value.machine && value.line) {
      const oee = await machineOEE(value);
      return res.json(oee);
    }

    const { rows } = await pool.query(
      `SELECT DISTINCT facility_id, line_id, machine_id FROM devices
       WHERE facility_id = $1 ${value.line ? 'AND line_id = $2' : ''}`,
      value.line ? [value.facility, value.line] : [value.facility]
    );

    const items = await Promise.all(rows.map((r) =>
      machineOEE({
        facility: r.facility_id,
        line: r.line_id,
        machine: r.machine_id,
        start: value.start,
        stop: value.stop
      })
    ));

    const aggregate = aggregateOEE(items);
    res.json({
      facility: value.facility,
      line: value.line,
      machines: items,
      aggregate
    });
  } catch (err) { next(err); }
});

module.exports = router;
