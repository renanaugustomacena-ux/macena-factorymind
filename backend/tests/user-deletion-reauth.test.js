/**
 * DELETE /api/users/me — password re-auth required.
 *
 * Un JWT rubato NON basta a cancellare l'account: il middleware richiede
 * password in chiaro + stringa di conferma esatta.
 */

'use strict';

const crypto = require('crypto');

// Pool stub: queue of { query, connect } responses. The route does
// (1) pool.query for password-creds, (2) gdpr.eraseSubject which calls
// pool.query for findUserByEmail then pool.connect for the transaction.
const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
jest.mock('../src/db/pool', () => ({
  pool: {
    query: (...a) => mockPoolQuery(...a),
    connect: jest.fn().mockImplementation(async () => ({
      query: (...a) => mockClientQuery(...a),
      release: mockClientRelease
    })),
    end: jest.fn()
  }
}));

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { sub: 'u-1', email: 'victim@example.com', role: 'admin' };
    next();
  },
  requireRole: () => (_req, _res, next) => next(),
  PINNED_ALGORITHMS: ['HS256']
}));

jest.mock('../src/middleware/audit', () => ({
  auditMiddleware: (_req, _res, next) => next(),
  recordAuthEvent: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/middleware/lockout', () => ({
  recordFailure: jest.fn().mockResolvedValue(null),
  isLocked: jest.fn().mockResolvedValue({ locked: false }),
  recordSuccess: jest.fn().mockResolvedValue(undefined),
  THRESHOLD: 5,
  CAP_SECONDS: 900
}));

jest.mock('../src/services/auth-tokens', () => ({
  mintAccessToken: jest.fn(),
  mintRefreshToken: jest.fn(),
  rotateRefreshToken: jest.fn(),
  revokeAllForUser: jest.fn().mockResolvedValue(undefined)
}));

const express = require('express');
const request = require('supertest');
const usersRouter = require('../src/routes/users');

// Helper: genera salt/hash validi per "ValidaPassword123!"
const SALT = crypto.randomBytes(16).toString('hex');
const PWD = 'ValidaPassword123!';
const HASH = crypto.scryptSync(PWD, SALT, 64).toString('hex');

function buildApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/users', usersRouter);
  return app;
}

describe('DELETE /api/users/me (password re-auth)', () => {
  beforeEach(() => {
    mockPoolQuery.mockReset();
    mockClientQuery.mockReset();
    mockClientRelease.mockReset();
  });

  // Wires the gdpr.eraseSubject transaction path: BEGIN → UPDATE → INSERT → COMMIT.
  // The test asserts route behaviour; whether the service uses pool.query or a
  // pool.connect()/transaction is an implementation detail.
  function wireEraseTransaction({ updateRowCount }) {
    mockClientQuery.mockImplementation(async (sql) => {
      if (/BEGIN|COMMIT|ROLLBACK/i.test(sql)) return { rowCount: 0, rows: [] };
      if (/UPDATE users[\s\S]*deletion_requested_at = NOW\(\)/i.test(sql)) {
        return { rowCount: updateRowCount, rows: [] };
      }
      if (/INSERT INTO audit_log/i.test(sql)) return { rowCount: 1, rows: [] };
      throw new Error(`unexpected client.query: ${sql}`);
    });
  }

  it('400 se manca password', async () => {
    const res = await request(buildApp())
      .delete('/api/users/me')
      .send({ confirm: 'CANCELLA IL MIO ACCOUNT' });
    expect(res.status).toBe(400);
  });

  it('400 se manca stringa di conferma', async () => {
    const res = await request(buildApp())
      .delete('/api/users/me')
      .send({ password: PWD });
    expect(res.status).toBe(400);
  });

  it('400 se stringa di conferma sbagliata', async () => {
    const res = await request(buildApp())
      .delete('/api/users/me')
      .send({ password: PWD, confirm: 'delete me' });
    expect(res.status).toBe(400);
  });

  it('404 se utente non attivo', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .delete('/api/users/me')
      .send({ password: PWD, confirm: 'CANCELLA IL MIO ACCOUNT' });
    expect(res.status).toBe(404);
  });

  it('401 se password sbagliata', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ password_salt: SALT, password_hash: HASH }]
    });
    const res = await request(buildApp())
      .delete('/api/users/me')
      .send({ password: 'PasswordCompletamenteSbagliata!', confirm: 'CANCELLA IL MIO ACCOUNT' });
    expect(res.status).toBe(401);
  });

  it('200 + deletion_scheduled se password corretta + conferma esatta', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ password_salt: SALT, password_hash: HASH }] }) // route password-creds lookup
      .mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'victim@example.com', deletion_requested_at: null }] }); // gdpr findUserByEmail
    wireEraseTransaction({ updateRowCount: 1 });

    const res = await request(buildApp())
      .delete('/api/users/me')
      .send({ password: PWD, confirm: 'CANCELLA IL MIO ACCOUNT' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('deletion_scheduled');
    expect(res.body.grace_period_days).toBe(30);
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('409 se cancellazione già richiesta', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ password_salt: SALT, password_hash: HASH }] })
      .mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'victim@example.com', deletion_requested_at: new Date() }] });
    // gdpr.eraseSubject sees deletion_requested_at not null → throws ALREADY_ERASED before BEGIN.

    const res = await request(buildApp())
      .delete('/api/users/me')
      .send({ password: PWD, confirm: 'CANCELLA IL MIO ACCOUNT' });
    expect(res.status).toBe(409);
  });
});
