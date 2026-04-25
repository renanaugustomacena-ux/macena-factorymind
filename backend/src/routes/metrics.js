/**
 * /api/metrics — query InfluxDB for telemetry time-series.
 *
 * Uses the Flux query API. Supports aggregation windows and resolution
 * selection (raw, 1m, 1h, 1d). Always bounded by rangeStart/rangeStop to
 * prevent unbounded scans.
 */

'use strict';

const { Router } = require('express');
const Joi = require('joi');
const { queryApi } = require('../services/influx-writer');
const { requireAuth } = require('../middleware/auth');
const config = require('../config');

const router = Router();
router.use(requireAuth);

const querySchema = Joi.object({
  facility: Joi.string().required(),
  line: Joi.string().required(),
  machine: Joi.string().required(),
  metric: Joi.string().required(),
  start: Joi.string().default('-1h'),
  stop: Joi.string().default('now()'),
  window: Joi.string().valid('raw', '1m', '1h', '1d').default('raw'),
  agg: Joi.string().valid('mean', 'max', 'min', 'sum').default('mean')
});

function measurementFor(window) {
  switch (window) {
    case '1m': return 'telemetry_1m';
    case '1h': return 'telemetry_1h';
    case '1d': return 'telemetry_1d';
    default: return 'telemetry';
  }
}

// Regex whitelist per tag Flux (protezione anti-injection su stringhe interpolate).
const SAFE_TAG = /^[A-Za-z0-9_.-]{1,64}$/;
const SAFE_RANGE = /^(-?\d+[smhdwMy]|now\(\))$/;

const downtimesSchema = Joi.object({
  facility: Joi.string().pattern(SAFE_TAG).required(),
  line: Joi.string().pattern(SAFE_TAG).optional(),
  machine: Joi.string().pattern(SAFE_TAG).optional(),
  start: Joi.string().pattern(SAFE_RANGE).default('-24h'),
  stop: Joi.string().pattern(SAFE_RANGE).default('now()')
});

/**
 * GET /api/metrics/downtimes — Pareto dei fermi DOWN raggruppato per reason_code.
 *
 * Fetcha gli eventi status nel range, li ordina per macchina+tempo, e calcola
 * la durata di ciascun segmento DOWN come delta tra il record DOWN e il record
 * di stato successivo (quando la macchina torna RUN/IDLE o cambia reason_code).
 *
 * Se non esiste un record successivo, il segmento DOWN è "aperto" (machine
 * tuttora ferma) e si usa `stop` come upper bound.
 */
router.get('/downtimes', async (req, res, next) => {
  try {
    const { value, error } = downtimesSchema.validate(req.query, { convert: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });

    const filters = [`r._measurement == "status"`, `r.facility == "${value.facility}"`];
    if (value.line) filters.push(`r.line == "${value.line}"`);
    if (value.machine) filters.push(`r.machine == "${value.machine}"`);

    const flux = `
      from(bucket: "${config.influx.bucket}")
        |> range(start: ${value.start}, stop: ${value.stop})
        |> filter(fn: (r) => ${filters.join(' and ')})
        |> filter(fn: (r) => r._field == "reason_code")
        |> keep(columns: ["_time", "_value", "facility", "line", "machine", "state"])
        |> sort(columns: ["facility", "line", "machine", "_time"])
        |> limit(n: 50000)
    `;

    const rows = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(flux, {
        next(row, meta) {
          const o = meta.toObject(row);
          rows.push({
            ts: new Date(o._time).getTime(),
            reason_code: o._value || 'none',
            facility: o.facility,
            line: o.line,
            machine: o.machine,
            state: o.state
          });
        },
        error: reject,
        complete: resolve
      });
    });

    // Calcolo durate: per ogni segmento DOWN, la durata va dal ts del record
    // DOWN al ts del record successivo della stessa macchina (o a 'stop' se
    // il segmento è ancora aperto).
    const stopTs = value.stop === 'now()' ? Date.now() : Date.parse(value.stop) || Date.now();
    const byReason = new Map();
    const byMachine = new Map();
    for (const r of rows) {
      const key = `${r.facility}/${r.line}/${r.machine}`;
      if (!byMachine.has(key)) byMachine.set(key, []);
      byMachine.get(key).push(r);
    }
    for (const series of byMachine.values()) {
      for (let i = 0; i < series.length; i += 1) {
        const cur = series[i];
        if (cur.state !== 'DOWN') continue;
        const nextTs = i + 1 < series.length ? series[i + 1].ts : stopTs;
        const durSec = Math.max(0, Math.round((nextTs - cur.ts) / 1000));
        const agg = byReason.get(cur.reason_code) || {
          reason_code: cur.reason_code,
          total_seconds: 0,
          occurrences: 0
        };
        agg.total_seconds += durSec;
        agg.occurrences += 1;
        byReason.set(cur.reason_code, agg);
      }
    }

    const pareto = [...byReason.values()].sort((a, b) => b.total_seconds - a.total_seconds);
    res.json({
      facility: value.facility,
      line: value.line || null,
      machine: value.machine || null,
      range: { start: value.start, stop: value.stop },
      pareto,
      total_downtime_seconds: pareto.reduce((s, r) => s + r.total_seconds, 0),
      total_events: pareto.reduce((s, r) => s + r.occurrences, 0)
    });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { value, error } = querySchema.validate(req.query, { convert: true, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });

    const measurement = measurementFor(value.window);
    const flux = `
      from(bucket: "${config.influx.bucket}")
        |> range(start: ${value.start}, stop: ${value.stop})
        |> filter(fn: (r) => r._measurement == "${measurement}")
        |> filter(fn: (r) => r.facility == "${value.facility}")
        |> filter(fn: (r) => r.line == "${value.line}")
        |> filter(fn: (r) => r.machine == "${value.machine}")
        |> filter(fn: (r) => r.metric == "${value.metric}")
        |> filter(fn: (r) => r._field == "value")
        |> aggregateWindow(every: ${value.window === 'raw' ? '10s' : value.window}, fn: ${value.agg}, createEmpty: false)
        |> keep(columns: ["_time", "_value"])
        |> sort(columns: ["_time"])
        |> limit(n: 5000)
    `;
    const rows = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(flux, {
        next(row, meta) {
          const o = meta.toObject(row);
          rows.push({ ts: o._time, value: o._value });
        },
        error: reject,
        complete: resolve
      });
    });
    res.json({
      facility: value.facility,
      line: value.line,
      machine: value.machine,
      metric: value.metric,
      window: value.window,
      agg: value.agg,
      points: rows,
      count: rows.length
    });
  } catch (err) { next(err); }
});

module.exports = router;
