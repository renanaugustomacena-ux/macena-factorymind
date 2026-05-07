/**
 * JWT middleware — extracts Bearer token, verifies with the configured
 * secret pinned to HS256, populates req.user = {sub, email, role, scope}.
 *
 * SECURITY NOTES
 *   - Algorithm is EXPLICITLY pinned to HS256 on verify. This blocks the
 *     classic "alg: none" and the HS/RS confusion attack vector.
 *   - The short-circuit dev identity is active only when
 *     config.isProduction === false AND no Authorization header is given;
 *     in production the middleware always returns 401 on missing header.
 *
 * For the refresh-token path see src/routes/users.js + src/services/auth-tokens.js.
 */

'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { sendProblem } = require('./errorHandler');

const PINNED_ALGORITHMS = ['HS256'];

// R-FRONTEND-COOKIE-AUTH-001 (F-HIGH-001): dual-mode auth.
// The middleware accepts EITHER:
//   1. `Authorization: Bearer <token>` header (legacy SPA path).
//   2. `factorymind_session` HttpOnly cookie (new path; XSS cannot read).
// During the transition both work; once the frontend cuts over to cookie-only
// the Bearer path can be retired (a follow-up R-FRONTEND-BEARER-RETIRE-001).
const SESSION_COOKIE = 'factorymind_session';

function parseCookieValue(req, name) {
  const header = req.headers.cookie || '';
  for (const piece of header.split(';')) {
    const [k, ...rest] = piece.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('=') || '');
  }
  return null;
}

function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return { source: 'bearer', token: auth.slice(7).trim() };
  }
  const cookieTok = parseCookieValue(req, SESSION_COOKIE);
  if (cookieTok) return { source: 'cookie', token: cookieTok };
  return { source: null, token: null };
}

function requireAuth(req, res, next) {
  const { source, token } = extractToken(req);

  if (!token) {
    if (!config.isProduction) {
      req.user = { sub: 'dev-anonymous', role: 'admin', email: 'dev@factorymind.local', scope: [] };
      return next();
    }
    return sendProblem(res, 401, 'Missing authentication (cookie or bearer)', req);
  }
  try {
    const payload = jwt.verify(token, config.security.jwtSecret, {
      algorithms: PINNED_ALGORITHMS
    });
    // Reject refresh tokens used on any endpoint other than /api/users/token/refresh.
    // Refresh tokens carry a typ: "refresh" claim.
    if (payload && payload.typ === 'refresh') {
      return sendProblem(res, 401, 'Refresh token not accepted on protected endpoint', req);
    }
    req.user = payload;
    req.authSource = source;
    return next();
  } catch (err) {
    return sendProblem(res, 401, `Invalid token: ${err.message}`, req);
  }
}

// Gerarchia ruoli:
//   admin      > supervisor > operator > viewer
// Chi ha un ruolo "superiore" eredita le capacità di quelli inferiori.
// Questo semplifica la logica lato endpoint: basta esprimere il minimo
// richiesto (es. `requireRole('supervisor')`) e l'admin passa comunque.
const ROLE_RANK = { viewer: 0, operator: 1, supervisor: 2, admin: 3 };

function requireRole(...roles) {
  const minRank = Math.min(...roles.map((r) => ROLE_RANK[r] ?? 99));
  return (req, res, next) => {
    const userRank = ROLE_RANK[req.user?.role] ?? -1;
    if (!req.user || userRank < minRank) {
      return sendProblem(
        res,
        403,
        'Forbidden: insufficient role',
        req,
        { required_roles: roles, your_role: req.user?.role || 'anonymous' }
      );
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, PINNED_ALGORITHMS, SESSION_COOKIE, extractToken };
