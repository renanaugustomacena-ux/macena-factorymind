/**
 * Supplementary security-headers middleware.
 *
 * Complements `helmet` (installed in src/index.js) with headers that
 * helmet does not set by default, and with stricter defaults for the
 * ones it does:
 *
 *   - Permissions-Policy (formerly Feature-Policy)
 *   - Cross-Origin-Opener-Policy
 *   - Cross-Origin-Resource-Policy
 *   - Cross-Origin-Embedder-Policy
 *   - Strict-Transport-Security (overrides helmet default, 1-year + preload)
 *   - Cache-Control on /api/* (no-store by default)
 *
 * All headers are applied unconditionally; /metrics and static assets
 * are handled by dedicated routers upstream.
 */

'use strict';

const HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Permitted-Cross-Domain-Policies': 'none'
});

function securityHeaders(_req, res, next) {
  for (const [name, value] of Object.entries(HEADERS)) {
    res.setHeader(name, value);
  }
  return next();
}

function apiCacheControl(req, res, next) {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  return next();
}

module.exports = { securityHeaders, apiCacheControl };
