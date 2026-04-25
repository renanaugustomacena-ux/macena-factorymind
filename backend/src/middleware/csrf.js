/**
 * CSRF protection — double-submit-cookie pattern.
 *
 * For a bearer-token SPA like FactoryMind, CSRF is already mitigated by
 * the fact that browsers do not attach `Authorization` headers cross-origin
 * by default. However v2.0 §12 mandates explicit CSRF protection for
 * state-changing endpoints, so we implement the "Double Submit Cookie"
 * variant from the OWASP CSRF Prevention Cheat Sheet:
 *
 *   1. Server issues a random CSRF token in a SameSite=Strict cookie.
 *   2. Client mirrors the cookie value in a custom header (X-CSRF-Token).
 *   3. Server verifies that the cookie and header match on every
 *      state-changing request.
 *
 * Requests that use Bearer JWT (i.e. not cookie-based) are exempt per the
 * OWASP guidance — they are not vulnerable to CSRF by construction. The
 * exemption is explicit here so that pure-SPA flows continue working
 * while a future cookie-based session can seamlessly enforce CSRF.
 */

'use strict';

const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const COOKIE_NAME = 'factorymind_csrf';
const HEADER_NAME = 'x-csrf-token';

// Endpoint bootstrap che precedono la disponibilità di un Bearer token.
// Sono protetti da rate-limit, honeypot, Joi validation, lockout e CORS —
// il CSRF double-submit fallirebbe perché il client non ha ancora
// l'infrastruttura di cookie/header (es. form landing cross-origin,
// primo login senza sessione SPA). Lista esatta e minima.
const BOOTSTRAP_POSTS = new Set([
  '/api/users/login',
  '/api/users/token/refresh',
  '/api/contact',
  '/api/contact/'
]);

function parseCookies(header = '') {
  const out = {};
  for (const piece of header.split(';')) {
    const [k, ...rest] = piece.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('=') || '');
  }
  return out;
}

function issueTokenIfMissing(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  const token = crypto.randomBytes(24).toString('base64url');
  const secure = process.env.APP_ENV === 'production';
  // Double-submit CSRF richiede che JS legga il cookie per mirrorarlo
  // nell'header X-CSRF-Token; pertanto HttpOnly NON deve essere impostato.
  // L'attributo "HttpOnly=false" NON è sintassi HTTP valida (alcuni browser
  // interpretano la presenza del flag come true ignorando il valore),
  // quindi va omesso del tutto. SameSite=Strict mitiga il CSRF cross-origin.
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; SameSite=Strict${secure ? '; Secure' : ''}`
  );
  return token;
}

function csrfMiddleware(req, res, next) {
  // Always issue a fresh cookie when none is present so that the client
  // can mirror it on its first POST.
  issueTokenIfMissing(req, res);

  if (SAFE_METHODS.has(req.method)) return next();

  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    // Bearer tokens are immune to CSRF by construction.
    return next();
  }

  // Endpoint bootstrap (login, refresh, contact form della landing) sono
  // esentati: prima della login il client non ha cookie/sessione con cui
  // mirroring funzioni, e un attaccante CSRF che forza login altrui
  // fornirebbe comunque credenziali proprie (nessun privilege gain).
  const base = (req.baseUrl || '') + (req.path || '');
  const originalUrl = req.originalUrl || '';
  const pathOnly = originalUrl.split('?')[0];
  if (BOOTSTRAP_POSTS.has(base) || BOOTSTRAP_POSTS.has(pathOnly)) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[COOKIE_NAME];
  const headerToken = req.headers[HEADER_NAME];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403);
    res.set('Content-Type', 'application/problem+json; charset=utf-8');
    return res.json({
      type: 'https://factorymind.example/problems/csrf-mismatch',
      title: 'CSRF Token Missing or Invalid',
      status: 403,
      detail: 'Double-submit CSRF token cookie and header must match',
      instance: req.originalUrl
    });
  }
  return next();
}

module.exports = { csrfMiddleware, COOKIE_NAME, HEADER_NAME };
