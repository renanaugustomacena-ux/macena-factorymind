/**
 * Verifica la gerarchia ruoli introdotta in middleware/auth.js:
 *   admin(3) > supervisor(2) > operator(1) > viewer(0)
 *
 * Chi ha rank >= rank_minimo richiesto passa; chi non ha ruolo riconosciuto
 * o è sotto soglia riceve 403 con dettaglio del ruolo attuale.
 */

'use strict';

jest.mock('../src/db/pool', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }), end: jest.fn() }
}));

const { requireRole } = require('../src/middleware/auth');

function mkRes() {
  const captured = { status: null, body: null };
  const res = {
    status: (code) => { captured.status = code; return res; },
    set: () => res,
    json: (body) => { captured.body = body; return res; },
    _captured: captured
  };
  return res;
}

function runMiddleware(userRole, minRole) {
  const req = { user: userRole ? { role: userRole, sub: 'u1' } : null, originalUrl: '/t', headers: {} };
  const res = mkRes();
  let called = false;
  requireRole(minRole)(req, res, () => { called = true; });
  return { called, status: res._captured.status, body: res._captured.body };
}

describe('requireRole hierarchy', () => {
  it('admin passa qualunque minimo', () => {
    expect(runMiddleware('admin', 'admin').called).toBe(true);
    expect(runMiddleware('admin', 'supervisor').called).toBe(true);
    expect(runMiddleware('admin', 'operator').called).toBe(true);
    expect(runMiddleware('admin', 'viewer').called).toBe(true);
  });

  it('supervisor passa supervisor-e-inferiori, blocca admin', () => {
    expect(runMiddleware('supervisor', 'supervisor').called).toBe(true);
    expect(runMiddleware('supervisor', 'operator').called).toBe(true);
    expect(runMiddleware('supervisor', 'viewer').called).toBe(true);
    const denied = runMiddleware('supervisor', 'admin');
    expect(denied.called).toBe(false);
    expect(denied.status).toBe(403);
  });

  it('operator è bloccato su supervisor e admin', () => {
    expect(runMiddleware('operator', 'operator').called).toBe(true);
    expect(runMiddleware('operator', 'viewer').called).toBe(true);
    expect(runMiddleware('operator', 'supervisor').called).toBe(false);
    expect(runMiddleware('operator', 'admin').called).toBe(false);
  });

  it('viewer passa solo se min=viewer', () => {
    expect(runMiddleware('viewer', 'viewer').called).toBe(true);
    expect(runMiddleware('viewer', 'operator').called).toBe(false);
  });

  it('utente non autenticato sempre 403', () => {
    const r = runMiddleware(null, 'viewer');
    expect(r.called).toBe(false);
    expect(r.status).toBe(403);
  });

  it('body 403 include ruolo corrente e ruoli richiesti', () => {
    const r = runMiddleware('viewer', 'admin');
    expect(r.body && r.body.your_role).toBe('viewer');
    expect(r.body && r.body.required_roles).toEqual(['admin']);
  });

  it('ruolo sconosciuto = 403', () => {
    const r = runMiddleware('root', 'viewer');
    expect(r.called).toBe(false);
    expect(r.status).toBe(403);
  });
});
