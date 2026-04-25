/**
 * /api/facilities — facility (plant) CRUD.
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

const facilitySchema = Joi.object({
  facility_id: Joi.string().required(),
  name: Joi.string().required(),
  address: Joi.string().allow('').default(''),
  city: Joi.string().allow('').default(''),
  province: Joi.string().allow('').default(''),
  country: Joi.string().default('IT'),
  timezone: Joi.string().default('Europe/Rome'),
  metadata: Joi.object().default({})
});

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM facilities ORDER BY name');
    res.json({ items: rows, count: rows.length });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { value, error } = facilitySchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });
    const { rows } = await pool.query(
      `INSERT INTO facilities (facility_id, name, address, city, province, country, timezone, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [value.facility_id, value.name, value.address, value.city, value.province,
       value.country, value.timezone, JSON.stringify(value.metadata)]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { value, error } = facilitySchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });
    const { rows } = await pool.query(
      `UPDATE facilities SET facility_id=$1, name=$2, address=$3, city=$4, province=$5,
              country=$6, timezone=$7, metadata=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [value.facility_id, value.name, value.address, value.city, value.province,
       value.country, value.timezone, JSON.stringify(value.metadata), req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'facility not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM facilities WHERE id=$1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'facility not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
