/**
 * Password policy — NIST SP 800-63B aligned.
 *
 * Rules enforced:
 *   - Minimum length 12 (configurable via PASSWORD_MIN_LENGTH env).
 *   - Maximum length 128 (prevents DoS via scrypt on huge input).
 *   - Unicode allowed; no forced composition (NIST explicitly deprecates
 *     "must contain uppercase + digit + symbol" rules).
 *   - Deny-list: common passwords + obvious project-name variants.
 *   - Breach-check hook: stub that POSTs a SHA-1 5-char prefix to an
 *     HIBP-compatible service; if the env HIBP_API_URL is unset the
 *     check is skipped (not a blocking error).
 *
 * Returns { ok: true } on acceptance or { ok: false, reason } on reject.
 */

'use strict';

const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

const COMMON_DENYLIST = new Set([
  'password', 'password1', 'password123', 'qwerty123456',
  'letmein12345', '123456789012', 'administrator', 'factorymind',
  'factorymind123', 'changeme1234', 'welcome12345', 'iloveyou1234'
]);

function validate(password, options = {}) {
  const minLen = Number(options.minLength || process.env.PASSWORD_MIN_LENGTH || 12);
  const maxLen = Number(options.maxLength || 128);

  if (typeof password !== 'string') return { ok: false, reason: 'password must be a string' };
  if (password.length < minLen) return { ok: false, reason: `password must be at least ${minLen} characters` };
  if (password.length > maxLen) return { ok: false, reason: `password must be at most ${maxLen} characters` };

  const normalized = password.trim().toLowerCase();
  if (COMMON_DENYLIST.has(normalized)) {
    return { ok: false, reason: 'password appears in common-password deny-list' };
  }
  if (/^(.)\1{4,}$/.test(password)) {
    return { ok: false, reason: 'password is a repeated character' };
  }

  return { ok: true };
}

/**
 * Check a password against an HIBP-compatible range-query API
 * (https://api.pwnedpasswords.com/range/<5-char-prefix>).
 *
 * Returns 0 if the password is NOT found in breaches, a positive integer
 * equal to the number of times the hash has been seen if found, or null
 * if the check could not be executed (network error, env unset, ...).
 *
 * The prefix-range protocol (k-anonymity) means the full password hash
 * never leaves this process.
 */
function checkBreached(password) {
  const endpoint = process.env.HIBP_API_URL || 'https://api.pwnedpasswords.com/range';
  if (!endpoint || process.env.HIBP_DISABLED === 'true') {
    return Promise.resolve(null);
  }
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(`${endpoint}/${prefix}`);
    } catch {
      return resolve(null);
    }
    const req = https.request({
      method: 'GET',
      host: url.hostname,
      path: url.pathname,
      timeout: 3_000,
      headers: { 'User-Agent': 'factorymind-password-policy' }
    }, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString('utf8'); });
      res.on('end', () => {
        const lines = data.split(/\r?\n/);
        for (const line of lines) {
          const [hashSuffix, count] = line.split(':');
          if (hashSuffix && hashSuffix.trim().toUpperCase() === suffix) {
            return resolve(Number(count) || 1);
          }
        }
        return resolve(0);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

module.exports = { validate, checkBreached, COMMON_DENYLIST };
