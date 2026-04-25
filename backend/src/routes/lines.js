/**
 * /api/lines — production-line CRUD.
 */

'use strict';

const { Router } = require('express');
const Joi = require('joi');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

const router = Router();
router.use(requireAuth);
router.use(auditMiddleware);

const lineSchema = Joi.object({
  facility_id: Joi.string().required(),
  line_id: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow('').default(''),
  target_oee: Joi.number().min(0).max(1).default(0.60)
});

router.get('/', async (req, res, next) => {
  try {
    const { facility_id } = req.query;
    const params = facility_id ? [facility_id] : [];
    const where = facility_id ? 'WHERE facility_id = $1' : '';
    const { rows } = await pool.query(`SELECT * FROM lines ${where} ORDER BY facility_id, line_id`, params);
    res.json({ items: rows, count: rows.length });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { value, error } = lineSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });
    const { rows } = await pool.query(
      `INSERT INTO lines (facility_id, line_id, name, description, target_oee)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [value.facility_id, value.line_id, value.name, value.description, value.target_oee]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { value, error } = lineSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });
    const { rows } = await pool.query(
      `UPDATE lines SET facility_id=$1, line_id=$2, name=$3, description=$4, target_oee=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [value.facility_id, value.line_id, value.name, value.description, value.target_oee, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'line not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM lines WHERE id=$1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'line not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
