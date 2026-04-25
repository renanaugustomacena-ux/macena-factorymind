/**
 * /api/alerts — list, acknowledge, resolve alerts; manage alert rules.
 */

'use strict';

const { Router } = require('express');
const Joi = require('joi');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
// `sendProblem` non serve qui: il router si appoggia al global error handler
// di errorHandler.js via `next(err)`. Tenuto commentato per memoria futura.
// const { sendProblem } = require('../middleware/errorHandler');

const router = Router();
router.use(requireAuth);
router.use(auditMiddleware);

const ruleSchema = Joi.object({
  name: Joi.string().required(),
  facility_id: Joi.string().allow('', null).default(null),
  line_id: Joi.string().allow('', null).default(null),
  machine_id: Joi.string().allow('', null).default(null),
  metric: Joi.string().required(),
  severity: Joi.string().valid('warning', 'major', 'critical').default('warning'),
  expression: Joi.object({
    kind: Joi.string().valid('threshold').required(),
    operator: Joi.string().valid('>', '>=', '<', '<=', '==', 'between').required(),
    threshold: Joi.number(),
    range: Joi.array().length(2).items(Joi.number()),
    hysteresis: Joi.number().default(0),
    debounce_sec: Joi.number().default(0)
  }).required(),
  enabled: Joi.boolean().default(true)
});

// Active alerts feed
router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    const { rows } = await pool.query(
      `SELECT id, rule_id, facility_id, line_id, machine_id, metric, value, severity,
              message, status, fired_at, acknowledged_at, acknowledged_by, resolved_at, escalated_at
       FROM alerts
       WHERE status = $1
       ORDER BY fired_at DESC
       LIMIT 500`,
      [status]
    );
    res.json({ items: rows, count: rows.length });
  } catch (err) { next(err); }
});

router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE alerts SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $1
       WHERE id = $2 AND status = 'open' RETURNING *`,
      [req.user?.sub || 'anonymous', req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'alert not found or not open' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/:id/resolve', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE alerts SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1 AND status IN ('open', 'acknowledged') RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'alert not found or already resolved' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Rule CRUD
router.get('/rules', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM alert_rules ORDER BY created_at DESC'
    );
    res.json({ items: rows, count: rows.length });
  } catch (err) { next(err); }
});

router.post('/rules', async (req, res, next) => {
  try {
    const { value, error } = ruleSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });
    const { rows } = await pool.query(
      `INSERT INTO alert_rules (name, facility_id, line_id, machine_id, metric, severity, expression, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        value.name, value.facility_id || null, value.line_id || null, value.machine_id || null,
        value.metric, value.severity, JSON.stringify(value.expression), value.enabled
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/rules/:id', async (req, res, next) => {
  try {
    const { value, error } = ruleSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });
    const { rows } = await pool.query(
      `UPDATE alert_rules SET name=$1, facility_id=$2, line_id=$3, machine_id=$4,
              metric=$5, severity=$6, expression=$7, enabled=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [
        value.name, value.facility_id || null, value.line_id || null, value.machine_id || null,
        value.metric, value.severity, JSON.stringify(value.expression), value.enabled,
        req.params.id
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'rule not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/rules/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM alert_rules WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'rule not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
