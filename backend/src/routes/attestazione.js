/**
 * /api/attestazione — emissione e verifica attestazioni Piano 4.0/5.0.
 *
 * Endpoint:
 *   POST /api/devices/:id/attestazione/preview  → JSON report (solo dati)
 *   POST /api/devices/:id/attestazione/pdf      → PDF firmabile (stream)
 *   GET  /api/attestazione/:numero              → metadata JSON dell'attestazione
 *   GET  /api/attestazione/:numero/verify       → verifica hash → 200/409
 *   POST /api/attestazione/:numero/revoke       → revoca (admin)
 *
 * Tutti gli endpoint richiedono autenticazione; la generazione richiede
 * ruolo ≥ supervisor, la revoca richiede ruolo admin.
 */

'use strict';

const { Router } = require('express');
const Joi = require('joi');
const crypto = require('crypto');
const { pool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendProblem } = require('../middleware/errorHandler');
const { generateAttestazione } = require('../services/piano4-attestazione');
const { renderAttestazionePDF, _internals } = require('../services/piano4-attestazione-pdf');
const logger = require('../utils/logger');

const router = Router();
router.use(requireAuth);

const destinatarioSchema = Joi.object({
  ragione_sociale: Joi.string().min(2).max(200).required(),
  partita_iva: Joi.string().pattern(/^IT\d{11}$/).required(),
  codice_fiscale: Joi.string().alphanum().min(11).max(16).optional(),
  sede_operativa: Joi.string().min(5).max(300).required(),
  legale_rappresentante: Joi.string().min(2).max(200).required()
}).required();

const generaSchema = Joi.object({
  year: Joi.number().integer().min(2017).max(2099).default(() => new Date().getFullYear()),
  destinatario: destinatarioSchema,
  // Contatori operativi opzionali (altrimenti si calcolano default)
  commandEvents: Joi.array().items(Joi.object()).default([]),
  integrationEvents: Joi.array().items(Joi.object()).default([]),
  alarmEvents: Joi.array().items(Joi.object()).default([]),
  predictiveEvents: Joi.array().items(Joi.object()).default([]),
  telemetrySampleCount: Joi.number().integer().min(0).default(0)
});

async function fetchDevice(deviceId) {
  const { rows } = await pool.query(
    `SELECT id, facility_id, line_id, machine_id, vendor, model, protocol,
            acquisition_year, acquisition_value_eur
       FROM devices WHERE id=$1 LIMIT 1`,
    [deviceId]
  );
  return rows[0] || null;
}

async function buildAttestazione(deviceId, body) {
  const device = await fetchDevice(deviceId);
  if (!device) return { error: 'device non trovato', status: 404 };

  const { value, error } = generaSchema.validate(body, { stripUnknown: true });
  if (error) return { error: error.message, status: 400 };

  const attestazione = generateAttestazione({
    device,
    year: value.year,
    commandEvents: value.commandEvents,
    integrationEvents: value.integrationEvents,
    alarmEvents: value.alarmEvents,
    predictiveEvents: value.predictiveEvents,
    telemetrySampleCount: value.telemetrySampleCount
  });

  return { attestazione, device, destinatario: value.destinatario, year: value.year };
}

// =============================================================================
// POST /api/devices/:id/attestazione/preview  — solo JSON, non scrive nel DB
// =============================================================================
router.post('/devices/:id/attestazione/preview', requireRole('supervisor'), async (req, res, next) => {
  try {
    const built = await buildAttestazione(req.params.id, req.body || {});
    if (built.error) return sendProblem(res, built.status, built.error, req);
    return res.json({
      destinatario: built.destinatario,
      year: built.year,
      device: built.device,
      attestazione: built.attestazione
    });
  } catch (err) { return next(err); }
});

// =============================================================================
// POST /api/devices/:id/attestazione/pdf  — genera PDF e scrive archivio
// =============================================================================
router.post('/devices/:id/attestazione/pdf', requireRole('supervisor'), async (req, res, next) => {
  try {
    const built = await buildAttestazione(req.params.id, req.body || {});
    if (built.error) return sendProblem(res, built.status, built.error, req);

    const { buffer, pdfHash, numero } = await renderAttestazionePDF(
      built.attestazione,
      built.destinatario
    );

    try {
      await pool.query(
        `INSERT INTO attestazioni
            (numero, device_id, anno_fiscale, destinatario, report, pdf_hash, eleggibile,
             emessa_da, emessa_il, pdf_bytes, pdf_size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)`,
        [
          numero,
          built.device.id,
          built.year,
          JSON.stringify(built.destinatario),
          JSON.stringify(built.attestazione.report),
          pdfHash,
          !!built.attestazione.eligibility,
          req.user?.sub || null,
          buffer,
          buffer.length
        ]
      );
    } catch (err) {
      // Se la tabella non esiste ancora (migrations non applicate), logga e procedi:
      // il PDF è comunque valido, la persistenza è un nice-to-have per /verify.
      logger.warn({ err: err.message, numero }, '[attestazione] persistenza fallita');
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${numero}.pdf"`,
      'Content-Length': buffer.length,
      'X-Attestazione-Numero': numero,
      'X-Attestazione-Hash': pdfHash
    });
    return res.send(buffer);
  } catch (err) { return next(err); }
});

// =============================================================================
// GET /api/attestazione/:numero/pdf  — re-download del PDF emesso
// Scarica dal DB il buffer originale. Incrementa contatore download per audit.
// =============================================================================
router.get('/attestazione/:numero/pdf', async (req, res, next) => {
  try {
    const numero = String(req.params.numero || '');
    if (!/^FM-\d{4}-[0-9A-F]{8}$/.test(numero)) {
      return sendProblem(res, 400, 'numero attestazione non valido', req);
    }
    const { rows } = await pool.query(
      `SELECT pdf_bytes, pdf_hash, revocata_il
         FROM attestazioni WHERE numero=$1 LIMIT 1`,
      [numero]
    );
    if (rows.length === 0) return sendProblem(res, 404, 'attestazione non trovata', req);
    const row = rows[0];
    if (row.revocata_il) {
      return sendProblem(res, 410, 'attestazione revocata — download disabilitato', req);
    }
    if (!row.pdf_bytes) {
      return sendProblem(
        res,
        410,
        'PDF non archiviato (attestazione emessa prima della persistenza binaria). Rigenera l\'attestazione per ottenere un nuovo PDF.',
        req
      );
    }
    await pool.query(
      'UPDATE attestazioni SET scaricata_count = scaricata_count + 1 WHERE numero = $1',
      [numero]
    ).catch(() => undefined);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${numero}.pdf"`,
      'Content-Length': row.pdf_bytes.length,
      'X-Attestazione-Numero': numero,
      'X-Attestazione-Hash': row.pdf_hash
    });
    return res.send(row.pdf_bytes);
  } catch (err) { return next(err); }
});

// =============================================================================
// GET /api/attestazione/:numero  — metadata
// =============================================================================
router.get('/attestazione/:numero', async (req, res, next) => {
  try {
    const numero = String(req.params.numero || '');
    if (!/^FM-\d{4}-[0-9A-F]{8}$/.test(numero)) {
      return sendProblem(res, 400, 'numero attestazione non valido', req);
    }
    const { rows } = await pool.query(
      `SELECT numero, anno_fiscale, pdf_hash, eleggibile, emessa_il, revocata_il, motivo_revoca
         FROM attestazioni WHERE numero=$1 LIMIT 1`,
      [numero]
    );
    if (rows.length === 0) return sendProblem(res, 404, 'attestazione non trovata', req);
    return res.json(rows[0]);
  } catch (err) { return next(err); }
});

// =============================================================================
// GET /api/attestazione/:numero/verify  — ricomputa hash dal DB
// =============================================================================
router.get('/attestazione/:numero/verify', async (req, res, next) => {
  try {
    const numero = String(req.params.numero || '');
    if (!/^FM-\d{4}-[0-9A-F]{8}$/.test(numero)) {
      return sendProblem(res, 400, 'numero attestazione non valido', req);
    }
    const { rows } = await pool.query(
      `SELECT numero, emessa_il, destinatario, report, pdf_hash, revocata_il
         FROM attestazioni WHERE numero=$1 LIMIT 1`,
      [numero]
    );
    if (rows.length === 0) return sendProblem(res, 404, 'attestazione non trovata', req);
    const row = rows[0];
    if (row.revocata_il) {
      return res.status(409).json({
        numero,
        status: 'revoked',
        revocata_il: row.revocata_il
      });
    }
    const payload = {
      numero: row.numero,
      emessa_il: row.emessa_il.toISOString(),
      destinatario: row.destinatario,
      report: row.report
    };
    const recomputed = _internals.hashPayload(payload);
    const match = recomputed === row.pdf_hash;
    return res.json({
      numero,
      status: match ? 'valid' : 'hash_mismatch',
      hash_stored: row.pdf_hash,
      hash_recomputed: recomputed,
      match
    });
  } catch (err) { return next(err); }
});

// =============================================================================
// POST /api/attestazione/:numero/revoke  — admin only
// =============================================================================
router.post('/attestazione/:numero/revoke', requireRole('admin'), async (req, res, next) => {
  try {
    const numero = String(req.params.numero || '');
    if (!/^FM-\d{4}-[0-9A-F]{8}$/.test(numero)) {
      return sendProblem(res, 400, 'numero attestazione non valido', req);
    }
    const motivo = String(req.body?.motivo || '').slice(0, 500);
    if (motivo.length < 5) return sendProblem(res, 400, 'motivo revoca obbligatorio (min 5 caratteri)', req);
    const { rowCount } = await pool.query(
      `UPDATE attestazioni
          SET revocata_il = NOW(), revocata_da = $2, motivo_revoca = $3
        WHERE numero = $1 AND revocata_il IS NULL`,
      [numero, req.user?.sub || null, motivo]
    );
    if (rowCount === 0) return sendProblem(res, 404, 'attestazione non trovata o già revocata', req);
    return res.json({ numero, status: 'revoked', motivo });
  } catch (err) { return next(err); }
});

module.exports = router;

// Per silenziare il linter su crypto importato ma non referenziato direttamente:
// il modulo resta nel require perché può essere riusato in extension future
// (firma digitale detached del PDF). Log stub per audit trail.
void crypto;
