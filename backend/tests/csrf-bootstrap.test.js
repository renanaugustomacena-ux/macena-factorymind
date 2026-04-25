/**
 * CSRF bootstrap exemption regression tests.
 *
 * Verifica che il middleware csrf non blocchi gli endpoint bootstrap
 * (login, refresh, contact) e che continui a bloccare le POST generiche
 * senza cookie+header match.
 */

'use strict';

jest.mock('../src/db/pool', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }), end: jest.fn() }
}));

const { csrfMiddleware } = require('../src/middleware/csrf');

function mkReq({ method = 'POST', path = '/', headers = {}, originalUrl } = {}) {
  return {
    method,
    path,
    baseUrl: '',
    originalUrl: originalUrl || path,
    headers
  };
}

function mkRes() {
  const calls = [];
  const res = {
    append: (k, v) => { calls.push({ k, v }); return res; },
    status: () => res,
    set: () => res,
    json: () => res,
    _appended: calls
  };
  return res;
}

describe('CSRF bootstrap exemption', () => {
  const BOOTSTRAP_URLS = [
    '/api/users/login',
    '/api/users/token/refresh',
    '/api/contact'
  ];

  it.each(BOOTSTRAP_URLS)('lascia passare POST su %s senza cookie/header', (url) => {
    const req = mkReq({ method: 'POST', path: url, originalUrl: url });
    const res = mkRes();
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocca POST generica senza cookie/header (non bootstrap)', () => {
    const req = mkReq({ method: 'POST', path: '/api/devices', originalUrl: '/api/devices' });
    const res = mkRes();
    let responded = false;
    res.status = () => res;
    res.set = () => res;
    res.json = (body) => { responded = body; return res; };
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(responded && responded.status).toBe(403);
  });

  it('lascia passare qualsiasi POST con Authorization: Bearer', () => {
    const req = mkReq({
      method: 'POST',
      path: '/api/devices',
      originalUrl: '/api/devices',
      headers: { authorization: 'Bearer abc.def.ghi' }
    });
    const res = mkRes();
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('lascia passare GET/HEAD/OPTIONS senza controllo', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const req = mkReq({ method, path: '/api/devices', originalUrl: '/api/devices' });
      const res = mkRes();
      const next = jest.fn();
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it('emette Set-Cookie al primo hit anche su endpoint bootstrap', () => {
    const req = mkReq({ method: 'POST', path: '/api/users/login', originalUrl: '/api/users/login' });
    const res = mkRes();
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    const setCookie = res._appended.find((c) => c.k === 'Set-Cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie.v).toMatch(/factorymind_csrf=/);
  });
});
