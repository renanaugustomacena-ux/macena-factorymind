/**
 * /api/users — RBAC user administration + login + token refresh.
 *
 * Password hashing is delegated to the Node.js built-in `scrypt` so no
 * extra native dependency is introduced. Production deployments are free
 * to swap argon2 into the password-hasher with no public-API change.
 *
 * Changes vs. Mission II baseline (Mission II.5 remediation):
 *   - Joi minimum password length raised to 12 (NIST 800-63B).
 *   - Password validated via `middleware/passwordPolicy.js` (deny-list +
 *     optional breach check).
 *   - Login protected by account-lockout middleware (`middleware/lockout.js`).
 *   - JWT signing + verification pinned to HS256.
 *   - Refresh-token endpoint + rotation + revoke endpoints.
 *   - Every auth event + every user CRUD mutation is written to audit_log.
 */

'use strict';

const { Router } = require('express');
const Joi = require('joi');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendProblem } = require('../middleware/errorHandler');
const passwordPolicy = require('../middleware/passwordPolicy');
const lockout = require('../middleware/lockout');
const audit = require('../middleware/audit');
const tokens = require('../services/auth-tokens');
const gdpr = require('../services/gdpr');

const router = Router();

// Rate-limit per endpoint GDPR autenticati: l'export intero profilo + audit log
// è costoso (fino a 5000 righe) e, se compromesso il JWT, un attaccante
// potrebbe esfiltrare rapidamente dati storici. 10 richieste/h/user è più che
// sufficiente per l'uso legittimo (l'interessato esporta 1-2 volte l'anno).
const gdprLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: {
    type: 'https://factorymind.example/problems/too-many-requests',
    title: 'Troppe richieste GDPR',
    status: 429,
    detail: 'Limite di 10 richieste all\'ora per i diritti GDPR (esportazione/cancellazione).'
  }
});

const ROLES = ['admin', 'supervisor', 'operator', 'viewer'];

const userSchema = Joi.object({
  email: Joi.string().email({ minDomainSegments: 2, tlds: false }).required(),
  full_name: Joi.string().required(),
  role: Joi.string().valid(...ROLES).default('viewer'),
  facility_scope: Joi.array().items(Joi.string()).default([]),
  active: Joi.boolean().default(true),
  password: Joi.string().min(12).max(128).required()
});

function hash(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(password, s, 64).toString('hex');
  return { salt: s, hash: h };
}

function verifyPassword(password, salt, storedHash) {
  // Difesa: se il record in DB ha un hash corrotto (lunghezza diversa) non
  // vogliamo che timingSafeEqual lanci — trattiamo la credenziale come
  // errata e restituiamo false. Impedisce 500 su account con seed malformato
  // o migrazione parziale.
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(String(storedHash || ''), 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

// ==========================================================================
// POST /api/users/login  (public)
// ==========================================================================
router.post('/login', async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email({ minDomainSegments: 2, tlds: false }).required(),
      password: Joi.string().required()
    });
    const { value, error } = schema.validate(req.body, { stripUnknown: true });
    if (error) return sendProblem(res, 400, error.message, req);

    // 1. Lockout gate
    const locked = await lockout.isLocked(value.email);
    if (locked.locked) {
      await audit.recordAuthEvent({
        action: 'POST /api/users/login',
        email: value.email,
        ip: req.ip,
        success: false,
        reason: 'account_locked',
        userAgent: req.headers['user-agent'] || ''
      });
      res.set('Retry-After', String(locked.retry_after_seconds));
      return sendProblem(res, 429, `Account locked. Retry after ${locked.retry_after_seconds} seconds.`, req, {
        retry_after_seconds: locked.retry_after_seconds
      });
    }

    // 2. Credential check
    const { rows } = await pool.query(
      'SELECT id, email, role, facility_scope, password_salt, password_hash, active FROM users WHERE email=$1',
      [value.email]
    );
    if (rows.length === 0 || !rows[0].active) {
      await lockout.recordFailure(value.email).catch(() => undefined);
      await audit.recordAuthEvent({
        action: 'POST /api/users/login',
        email: value.email,
        ip: req.ip,
        success: false,
        reason: rows.length === 0 ? 'no_such_user' : 'inactive',
        userAgent: req.headers['user-agent'] || ''
      });
      return sendProblem(res, 401, 'invalid credentials', req);
    }
    const u = rows[0];
    if (!verifyPassword(value.password, u.password_salt, u.password_hash)) {
      const result = await lockout.recordFailure(value.email).catch(() => null);
      await audit.recordAuthEvent({
        action: 'POST /api/users/login',
        user_id: u.id,
        email: value.email,
        ip: req.ip,
        success: false,
        reason: 'bad_password',
        userAgent: req.headers['user-agent'] || ''
      });
      if (result && result.lockout_seconds > 0) {
        res.set('Retry-After', String(result.lockout_seconds));
        return sendProblem(res, 429, `Too many failed attempts. Locked for ${result.lockout_seconds} seconds.`, req);
      }
      return sendProblem(res, 401, 'invalid credentials', req);
    }

    // 3. Reset failure state and mint access + refresh tokens
    await lockout.recordSuccess(value.email).catch(() => undefined);
    const accessToken = tokens.mintAccessToken(u);
    const { refreshToken, expiresAt } = await tokens.mintRefreshToken(pool, u, {
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip
    });

    await audit.recordAuthEvent({
      action: 'POST /api/users/login',
      user_id: u.id,
      email: u.email,
      ip: req.ip,
      success: true,
      userAgent: req.headers['user-agent'] || ''
    });

    return res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      refresh_expires_at: expiresAt.toISOString(),
      token_type: 'Bearer',
      user: { id: u.id, email: u.email, role: u.role, facility_scope: u.facility_scope }
    });
  } catch (err) { return next(err); }
});

// ==========================================================================
// POST /api/users/token/refresh  (public — uses refresh token)
// ==========================================================================
router.post('/token/refresh', async (req, res, next) => {
  try {
    const schema = Joi.object({ refresh_token: Joi.string().required() });
    const { value, error } = schema.validate(req.body, { stripUnknown: true });
    if (error) return sendProblem(res, 400, error.message, req);
    const result = await tokens.rotateRefreshToken(pool, value.refresh_token, {
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip
    });
    await audit.recordAuthEvent({
      action: 'POST /api/users/token/refresh',
      user_id: result.user.id,
      email: result.user.email,
      ip: req.ip,
      success: true,
      userAgent: req.headers['user-agent'] || ''
    });
    return res.json({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      refresh_expires_at: result.expiresAt.toISOString(),
      token_type: 'Bearer'
    });
  } catch (err) {
    if (err.status) {
      await audit.recordAuthEvent({
        action: 'POST /api/users/token/refresh',
        ip: req.ip,
        success: false,
        reason: err.message,
        userAgent: req.headers['user-agent'] || ''
      });
      return sendProblem(res, err.status, err.message, req);
    }
    return next(err);
  }
});

// ==========================================================================
// POST /api/users/logout  (authenticated)
// ==========================================================================
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await tokens.revokeAllForUser(pool, req.user.sub);
    await audit.recordAuthEvent({
      action: 'POST /api/users/logout',
      user_id: req.user.sub,
      email: req.user.email,
      ip: req.ip,
      success: true,
      userAgent: req.headers['user-agent'] || ''
    });
    return res.status(204).send();
  } catch (err) { return next(err); }
});

// ==========================================================================
// From here on all endpoints require a valid bearer access token.
// ==========================================================================
router.use(requireAuth);
router.use(audit.auditMiddleware);

router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

// ==========================================================================
// GET /api/users/me/export  — portabilità dati ex art. 20 GDPR
// Esporta in JSON tutti i dati personali dell'utente corrente (profilo +
// audit log). La risposta è marcata come attachment per facilitare il
// download dal browser.
// ==========================================================================
router.get('/me/export', gdprLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return sendProblem(res, 401, 'sessione non autenticata', req);
    const email = req.user?.email;
    if (!email) return sendProblem(res, 401, 'sessione senza email — re-autenticarsi', req);

    const payload = await gdpr.exportSubject(pool, { email });

    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="factorymind-export-${userId}.json"`
    });
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    if (err && err.code === 'SUBJECT_NOT_FOUND') {
      return sendProblem(res, 404, 'utente non trovato', req);
    }
    return next(err);
  }
});

// ==========================================================================
// DELETE /api/users/me  — cancellazione ex art. 17 GDPR
// Soft-delete con grace period di 30 giorni: l'account viene disattivato
// e schedulato per cancellazione hard da cronjob DB (housekeeping).
// L'utente può chiedere il ripristino contattando il supporto entro i 30 giorni.
// ==========================================================================
router.delete('/me', gdprLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return sendProblem(res, 401, 'sessione non autenticata', req);

    // Password re-auth obbligatoria: evita takeover via JWT rubato → un
    // attaccante non ha la password in chiaro e non può innescare la
    // cancellazione con i soli token di sessione.
    const schema = Joi.object({
      password: Joi.string().min(1).required(),
      confirm: Joi.string().valid('CANCELLA IL MIO ACCOUNT').required()
    });
    const { value, error } = schema.validate(req.body || {}, { stripUnknown: true });
    if (error) {
      return sendProblem(
        res,
        400,
        'Cancellazione richiede password e conferma "CANCELLA IL MIO ACCOUNT".',
        req
      );
    }

    // Recupera hash e salt correnti per verifica.
    const { rows: creds } = await pool.query(
      'SELECT password_salt, password_hash FROM users WHERE id = $1 AND active = TRUE',
      [userId]
    );
    if (creds.length === 0) {
      return sendProblem(res, 404, 'utente non attivo o inesistente', req);
    }
    if (!verifyPassword(value.password, creds[0].password_salt, creds[0].password_hash)) {
      // Tracciamo il tentativo fallito nel lockout come se fosse un login errato.
      await lockout.recordFailure(req.user.email).catch(() => undefined);
      return sendProblem(res, 401, 'password errata', req);
    }

    let result;
    try {
      result = await gdpr.eraseSubject(pool, {
        email: req.user.email,
        reason: 'gdpr_erasure_requested'
      });
    } catch (err) {
      if (err && err.code === 'ALREADY_ERASED') {
        return sendProblem(res, 409, 'cancellazione già richiesta', req);
      }
      if (err && err.code === 'SUBJECT_NOT_FOUND') {
        return sendProblem(res, 404, 'utente non trovato', req);
      }
      throw err;
    }

    await audit.recordAuthEvent({
      action: 'DELETE /api/users/me',
      user_id: userId,
      email: req.user.email,
      ip: req.ip,
      success: true,
      reason: 'gdpr_erasure_requested',
      userAgent: req.headers['user-agent'] || ''
    });

    return res.json({
      status: result.status,
      grace_period_days: result.grace_period_days,
      message:
        'Cancellazione programmata. Entro 30 giorni i dati saranno rimossi ' +
        'definitivamente. Per revocare la richiesta contatti il supporto.'
    });
  } catch (err) { return next(err); }
});

router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, facility_scope, active,
              failed_login_count, locked_until, last_login_at, created_at
       FROM users ORDER BY email`
    );
    res.json({ items: rows, count: rows.length });
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { value, error } = userSchema.validate(req.body, { stripUnknown: true });
    if (error) return sendProblem(res, 400, error.message, req);

    const policy = passwordPolicy.validate(value.password);
    if (!policy.ok) return sendProblem(res, 400, policy.reason, req);

    // Fail-closed: se il servizio HIBP è abilitato ma irraggiungibile
    // (timeout / errore rete), rifiutiamo la creazione account con 503.
    // Accettare in silenzio bypasserebbe il controllo breach: un attaccante
    // potrebbe forzare l'uso di password note semplicemente interferendo
    // con la rete verso api.pwnedpasswords.com.
    // Se HIBP è esplicitamente disabilitato (HIBP_DISABLED=true o endpoint
    // non configurato), checkBreached ritorna null e NON è un errore.
    const breached = await passwordPolicy.checkBreached(value.password);
    const hibpDisabled = process.env.HIBP_DISABLED === 'true' || !process.env.HIBP_API_URL;
    if (breached === null && !hibpDisabled) {
      return sendProblem(
        res,
        503,
        'Servizio di verifica password temporaneamente non disponibile. Riprovare tra qualche istante.',
        req
      );
    }
    if (breached && breached > 0) {
      return sendProblem(res, 400, `Password trovata in breach corpus pubblico (${breached} volte). Scegliere una password diversa.`, req);
    }

    const { salt, hash: h } = hash(value.password);
    const { rows } = await pool.query(
      `INSERT INTO users (email, full_name, role, facility_scope, password_salt, password_hash, active, password_changed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
       RETURNING id, email, full_name, role, facility_scope, active, created_at`,
      [value.email, value.full_name, value.role, value.facility_scope, salt, h, value.active]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
