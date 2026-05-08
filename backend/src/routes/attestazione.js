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
  // R-ATTESTAZIONE-IDEMPOTENCY-001: piano fiscale (4.0 vs 5.0). Stesso
  // macchinario può avere una emissione per piano in uno stesso anno.
  plan: Joi.string().valid('piano-4.0', 'piano-5.0').default('piano-4.0'),
  destinatario: destinatarioSchema,
  // Contatori operativi opzionali (altrimenti si calcolano default)
  commandEvents: Joi.array().items(Joi.object()).default([]),
  integrationEvents: Joi.array().items(Joi.object()).default([]),
  alarmEvents: Joi.array().items(Joi.object()).default([]),
  predictiveEvents: Joi.array().items(Joi.object()).default([]),
  telemetrySampleCount: Joi.number().integer().min(0).default(0)
});

/**
 * R-ATTESTAZIONE-IDEMPOTENCY-001: hash deterministico del contenuto
 * (destinatario + report + anno + plan). Distinto da `pdf_hash` perché
 * NON include `numero` univoco né `emessa_il` — è la "firma del contenuto"
 * che la cache di idempotency confronta tra una richiesta e la prossima.
 *
 * Esclusioni intenzionali:
 *  - `report.generated_at`: timestamp di computazione (volatile per design,
 *    cambia a ogni invocazione di generateAttestazione anche con stessi
 *    input); la sua presenza romperebbe l'idempotency rendendo ogni
 *    richiesta un cache miss.
 *
 * Canonicalizzazione minima: JSON.stringify con chiavi ordinate via Object
 * literal layout. Non usa una libreria di canonical-JSON perché destinatario
 * e report sono già strutture controllate dalla pipeline interna; un input
 * con ordine chiavi differente produrrebbe hash diverso, ma in pratica le
 * chiavi vengono sempre nello stesso ordine (Joi.validate normalizza).
 */
function computeContentSha256(destinatario, report, year, plan) {
  const reportForHash = report ? { ...report } : {};
  delete reportForHash.generated_at;
  const canonical = JSON.stringify({ destinatario, report: reportForHash, year, plan });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

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

  return {
    attestazione,
    device,
    destinatario: value.destinatario,
    year: value.year,
    plan: value.plan
  };
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
//
// R-ATTESTAZIONE-IDEMPOTENCY-001: la tripletta (device_id, anno_fiscale,
// plan) è il chiave di idempotency. Per ogni richiesta:
//   1. costruisci attestazione + content_sha256 (hash del contenuto puro)
//   2. cerca riga esistente non revocata per (device, anno, plan)
//   3. se esiste E content_sha256 combacia → restituisci PDF cached
//      (a meno di ?force=true admin, che ne forza la re-emissione)
//   4. se esiste MA content_sha256 differisce → 409 senza ?force=true
//      (richiede admin perché re-emettere significa revocare la prima)
//   5. altrimenti → genera + INSERT (path normale)
//
// `?force=true` è ammesso solo a `req.user.role === 'admin'`. La riga
// pre-esistente viene marcata `revocata_il = NOW()` con motivo automatico
// "re-emission via force=true" prima dell'INSERT della nuova.
// =============================================================================
router.post('/devices/:id/attestazione/pdf', requireRole('supervisor'), async (req, res, next) => {
  try {
    const force = String(req.query.force || '').toLowerCase() === 'true';
    if (force && req.user?.role !== 'admin') {
      return sendProblem(res, 403, 'force=true richiede ruolo admin', req);
    }

    const built = await buildAttestazione(req.params.id, req.body || {});
    if (built.error) return sendProblem(res, built.status, built.error, req);

    const contentSha = computeContentSha256(
      built.destinatario,
      built.attestazione.report,
      built.year,
      built.plan
    );

    // Idempotency lookup: most recent non-revoked row for (device, anno, plan).
    let existing = null;
    try {
      const { rows } = await pool.query(
        `SELECT numero, pdf_bytes, pdf_hash, content_sha256
           FROM attestazioni
          WHERE device_id=$1 AND anno_fiscale=$2 AND plan=$3 AND revocata_il IS NULL
          LIMIT 1`,
        [built.device.id, built.year, built.plan]
      );
      existing = rows[0] || null;
    } catch (err) {
      // Pre-008 schema (no `plan`/`content_sha256` columns) or table missing:
      // log and proceed with fresh generation (no idempotency check possible).
      logger.warn({ err: err.message }, '[attestazione] idempotency lookup failed — proceeding fresh');
    }

    if (existing && !force) {
      if (existing.content_sha256 === contentSha && existing.pdf_bytes) {
        // Cache hit — return identical bytes from the previous emission.
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${existing.numero}.pdf"`,
          'Content-Length': existing.pdf_bytes.length,
          'X-Attestazione-Numero': existing.numero,
          'X-Attestazione-Hash': existing.pdf_hash,
          'X-Attestazione-Cached': 'true'
        });
        return res.send(existing.pdf_bytes);
      }
      if (existing.content_sha256 && existing.content_sha256 !== contentSha) {
        // Existing emission for the same (device, anno, plan) but content
        // differs — block. The user must either accept the prior emission
        // or escalate to admin + ?force=true to revoke and re-emit.
        return sendProblem(
          res,
          409,
          "esiste già un'attestazione per (device, anno, piano) con contenuto diverso; usa ?force=true (richiede ruolo admin) per re-emettere",
          req,
          { existing_numero: existing.numero }
        );
      }
      // Existing row but no pdf_bytes (pre-007) OR no content_sha256 (pre-008):
      // fall through to fresh generation. The new row will land alongside the
      // legacy one — the partial unique index would fire if both are
      // non-revoked, so revoke the legacy first.
      try {
        await pool.query(
          `UPDATE attestazioni SET revocata_il=NOW(), revocata_da=$1,
                  motivo_revoca='migrazione automatica: riga pre-008 sostituita da emissione idempotente'
            WHERE numero=$2 AND revocata_il IS NULL`,
          [req.user?.sub || null, existing.numero]
        );
      } catch (err) {
        logger.warn({ err: err.message, numero: existing.numero }, '[attestazione] auto-revoke pre-008 failed');
      }
    }

    const { buffer, pdfHash, numero } = await renderAttestazionePDF(
      built.attestazione,
      built.destinatario
    );

    const insertParams = [
      numero, built.device.id, built.year, built.plan, contentSha,
      JSON.stringify(built.destinatario), JSON.stringify(built.attestazione.report),
      pdfHash, !!built.attestazione.eligibility, req.user?.sub || null,
      buffer, buffer.length
    ];
    const INSERT_SQL = `INSERT INTO attestazioni
            (numero, device_id, anno_fiscale, plan, content_sha256, destinatario, report,
             pdf_hash, eleggibile, emessa_da, emessa_il, pdf_bytes, pdf_size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)`;

    if (existing && force) {
      // Admin re-emission — revoke prior + INSERT new ATOMICALLY in a
      // transaction. Without the transaction, a transient INSERT failure
      // leaves the registry with a revoked row and no replacement.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE attestazioni SET revocata_il=NOW(), revocata_da=$1,
                  motivo_revoca='re-emission via force=true'
            WHERE numero=$2 AND revocata_il IS NULL`,
          [req.user?.sub || null, existing.numero]
        );
        await client.query(INSERT_SQL, insertParams);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        logger.warn(
          { err: err.message, numero, existing_numero: existing.numero },
          '[attestazione] force=true TX failed — registry rolled back, PDF still served'
        );
      } finally {
        client.release();
      }
    } else {
      // Non-force path: INSERT directly. The partial unique index
      // (uq_attestazioni_idempotency) is the actual concurrency guard —
      // a 23505 here means another emission won the race between our
      // SELECT lookup and our INSERT. Recover transparently by re-reading
      // the winner and serving cached bytes (so the client gets the
      // idempotent contract they expected).
      try {
        await pool.query(INSERT_SQL, insertParams);
      } catch (err) {
        if (err.code === '23505') {
          try {
            const { rows } = await pool.query(
              `SELECT numero, pdf_bytes, pdf_hash, content_sha256
                 FROM attestazioni
                WHERE device_id=$1 AND anno_fiscale=$2 AND plan=$3 AND revocata_il IS NULL
                LIMIT 1`,
              [built.device.id, built.year, built.plan]
            );
            const winner = rows[0];
            if (winner && winner.content_sha256 === contentSha && winner.pdf_bytes) {
              // Same content — serve cached, transparently.
              res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${winner.numero}.pdf"`,
                'Content-Length': winner.pdf_bytes.length,
                'X-Attestazione-Numero': winner.numero,
                'X-Attestazione-Hash': winner.pdf_hash,
                'X-Attestazione-Cached': 'true',
                'X-Attestazione-Race-Recovery': 'true'
              });
              return res.send(winner.pdf_bytes);
            }
            // Winner has different content or no pdf_bytes — concurrent
            // emission with diverged content; surface 409.
            return sendProblem(
              res,
              409,
              'emissione concorrente con contenuto diverso rilevata',
              req,
              { existing_numero: winner?.numero }
            );
          } catch (lookupErr) {
            logger.warn(
              { err: lookupErr.message, numero },
              '[attestazione] race-recovery lookup failed — best-effort fall-through'
            );
          }
        } else {
          // Pre-008 schema or transient error: log and proceed best-effort.
          logger.warn({ err: err.message, numero }, '[attestazione] persistenza fallita');
        }
      }
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${numero}.pdf"`,
      'Content-Length': buffer.length,
      'X-Attestazione-Numero': numero,
      'X-Attestazione-Hash': pdfHash,
      'X-Attestazione-Cached': 'false'
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
// Internal helpers exposed for regression tests (not part of public API).
// Mirrors the pattern used by `services/piano4-attestazione-pdf.js#_internals`.
module.exports._internals = { computeContentSha256 };

// Per silenziare il linter su crypto importato ma non referenziato direttamente:
// il modulo resta nel require perché può essere riusato in extension future
// (firma digitale detached del PDF). Log stub per audit trail.
void crypto;
