/**
 * /api/devices — CRUD for machines/devices.
 *
 * A device is a PLC, gateway, or individual machine published under a
 * facility/line combination. Devices carry the OPC UA tag mapping and
 * the Modbus register map used by the respective bridges.
 */

'use strict';

const { Router } = require('express');
const Joi = require('joi');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const { sendProblem } = require('../middleware/errorHandler');
const { generateAttestazione } = require('../services/piano4-attestazione');
const logger = require('../utils/logger');

const router = Router();
router.use(requireAuth);
router.use(auditMiddleware);

const deviceSchema = Joi.object({
  facility_id: Joi.string().required(),
  line_id: Joi.string().required(),
  machine_id: Joi.string().required(),
  name: Joi.string().required(),
  vendor: Joi.string().allow('').default(''),
  model: Joi.string().allow('').default(''),
  serial: Joi.string().allow('').default(''),
  protocol: Joi.string().valid('mqtt', 'opcua', 'modbus_tcp', 'modbus_rtu', 'sparkplug').required(),
  ideal_cycle_time_sec: Joi.number().min(0).default(0),
  opcua_tags: Joi.array().items(Joi.object()).default([]),
  modbus_map: Joi.array().items(Joi.object()).default([]),
  metadata: Joi.object().default({})
});

router.get('/', async (req, res, next) => {
  try {
    const { facility_id, line_id } = req.query;
    const params = [];
    const clauses = [];
    if (facility_id) { params.push(facility_id); clauses.push(`facility_id = $${params.length}`); }
    if (line_id) { params.push(line_id); clauses.push(`line_id = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT id, facility_id, line_id, machine_id, name, vendor, model, serial,
              protocol, ideal_cycle_time_sec, opcua_tags, modbus_map, metadata,
              created_at, updated_at
       FROM devices ${where} ORDER BY facility_id, line_id, machine_id`,
      params
    );
    res.json({ items: rows, count: rows.length });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM devices WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'device not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { value, error } = deviceSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });
    const { rows } = await pool.query(
      `INSERT INTO devices (facility_id, line_id, machine_id, name, vendor, model, serial,
                            protocol, ideal_cycle_time_sec, opcua_tags, modbus_map, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        value.facility_id, value.line_id, value.machine_id, value.name,
        value.vendor, value.model, value.serial, value.protocol,
        value.ideal_cycle_time_sec, JSON.stringify(value.opcua_tags),
        JSON.stringify(value.modbus_map), JSON.stringify(value.metadata)
      ]
    );
    logger.info({ id: rows[0].id }, '[devices] created');
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { value, error } = deviceSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });
    const { rows } = await pool.query(
      `UPDATE devices SET facility_id=$1, line_id=$2, machine_id=$3, name=$4,
              vendor=$5, model=$6, serial=$7, protocol=$8, ideal_cycle_time_sec=$9,
              opcua_tags=$10, modbus_map=$11, metadata=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [
        value.facility_id, value.line_id, value.machine_id, value.name,
        value.vendor, value.model, value.serial, value.protocol,
        value.ideal_cycle_time_sec, JSON.stringify(value.opcua_tags),
        JSON.stringify(value.modbus_map), JSON.stringify(value.metadata),
        req.params.id
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'device not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM devices WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return sendProblem(res, 404, 'device not found', req);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ==========================================================================
// POST /api/devices/:id/attestazione/piano4
// ==========================================================================
router.post('/:id/attestazione/piano4', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM devices WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return sendProblem(res, 404, 'device not found', req);
    const device = rows[0];
    const body = req.body || {};
    const result = generateAttestazione({
      device: {
        facility_id: device.facility_id,
        line_id: device.line_id,
        machine_id: device.machine_id,
        vendor: device.vendor,
        model: device.model,
        protocol: device.protocol,
        acquisition_year: body.acquisition_year || null,
        acquisition_value_eur: body.acquisition_value_eur || null
      },
      year: body.year || new Date().getFullYear(),
      telemetrySampleCount: body.telemetry_sample_count || 0,
      commandEvents: body.command_events || [],
      integrationEvents: body.integration_events || [],
      alarmEvents: body.alarm_events || [],
      predictiveEvents: body.predictive_events || []
    });
    logger.info({ id: req.params.id, eligible: result.eligibility }, '[devices] piano4 attestazione generated');
    return res.json(result);
  } catch (err) { return next(err); }
});

module.exports = router;
