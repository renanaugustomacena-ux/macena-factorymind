/**
 * R-GDPR-001 — closes F-HIGH-006.
 * Unit-tests `backend/src/services/gdpr.js` against a synthetic pg pool stub.
 * Integration coverage (real DB; round-trip through the operator scripts)
 * lives in `tests/integration/gdpr-erasure.sh`, gated by the running stack.
 */

'use strict';

jest.mock('../src/services/auth-tokens', () => ({
  revokeAllForUser: jest.fn().mockResolvedValue(undefined)
}));

const gdpr = require('../src/services/gdpr');
const tokens = require('../src/services/auth-tokens');

function makePool(scenario) {
  // scenario: { user, audit, refresh, deleteCount }
  const calls = [];
  const client = {
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return { rowCount: 0, rows: [] };
      if (/UPDATE users[\s\S]*deletion_requested_at = NOW\(\)/.test(sql)) {
        return { rowCount: scenario.deleteCount ?? 1, rows: [] };
      }
      if (/INSERT INTO audit_log/.test(sql)) {
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`unexpected client.query: ${sql}`);
    }),
    release: jest.fn()
  };
  const pool = {
    connect: jest.fn().mockResolvedValue(client),
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      if (/FROM users\s+WHERE LOWER\(email\)/i.test(sql)) {
        return { rows: scenario.user ? [scenario.user] : [] };
      }
      if (/FROM audit_log WHERE actor_user_id/.test(sql)) {
        return { rows: scenario.audit || [] };
      }
      if (/FROM refresh_tokens WHERE user_id/.test(sql)) {
        return { rows: scenario.refresh || [] };
      }
      if (/DELETE FROM users[\s\S]*deletion_requested_at IS NOT NULL/.test(sql)) {
        return { rows: scenario.finalizeRows || [] };
      }
      throw new Error(`unexpected pool.query: ${sql}`);
    })
  };
  return { pool, client, calls };
}

const SAMPLE_USER = {
  id: 42,
  email: 'mario.rossi@example.it',
  full_name: 'Mario Rossi',
  role: 'operator',
  facility_scope: ['mozzecane'],
  active: true,
  created_at: new Date('2026-01-15T10:00:00Z'),
  password_changed_at: new Date('2026-04-01T10:00:00Z'),
  last_login_at: new Date('2026-05-06T08:30:00Z'),
  deletion_requested_at: null
};

describe('gdpr.exportSubject', () => {
  it('returns Art. 15/20 dump with stable shape', async () => {
    const { pool } = makePool({
      user: SAMPLE_USER,
      audit: [{ action: 'login', resource_type: 'session', resource_id: '1', payload: {}, created_at: new Date() }],
      refresh: [{ id: 'rt-1', created_at: new Date(), expires_at: new Date(), consumed_at: null, revoked_at: null, user_agent: 'curl', ip: '127.0.0.1' }]
    });

    const out = await gdpr.exportSubject(pool, { email: 'MARIO.ROSSI@EXAMPLE.IT' });

    expect(out.export_format_version).toBe('1.0');
    expect(out.legal_basis).toMatch(/Art\. 15 e 20 Reg\. UE 2016\/679/);
    expect(out.user.id).toBe(42);
    expect(Array.isArray(out.audit_log)).toBe(true);
    expect(out.audit_log).toHaveLength(1);
    expect(Array.isArray(out.refresh_tokens)).toBe(true);
    expect(out.refresh_tokens).toHaveLength(1);
    expect(typeof out.export_generated_at).toBe('string');
  });

  it('throws SubjectNotFoundError when no user matches email', async () => {
    const { pool } = makePool({ user: null });
    await expect(gdpr.exportSubject(pool, { email: 'nobody@nowhere.it' })).rejects.toMatchObject({
      code: 'SUBJECT_NOT_FOUND'
    });
  });

  it('rejects missing email', async () => {
    const { pool } = makePool({});
    await expect(gdpr.exportSubject(pool, {})).rejects.toThrow(TypeError);
  });
});

describe('gdpr.eraseSubject', () => {
  it('soft-deletes, audit-logs, revokes tokens', async () => {
    const { pool, client, calls } = makePool({ user: SAMPLE_USER, deleteCount: 1 });

    const result = await gdpr.eraseSubject(pool, { email: SAMPLE_USER.email, reason: 'subject_request' });

    expect(result.status).toBe('deletion_scheduled');
    expect(result.user_id).toBe(42);
    expect(result.grace_period_days).toBe(30);

    const sqls = calls.map((c) => c.sql);
    expect(sqls.some((s) => /BEGIN/.test(s))).toBe(true);
    expect(sqls.some((s) => /UPDATE users[\s\S]*deletion_requested_at = NOW\(\)/.test(s))).toBe(true);
    expect(sqls.some((s) => /INSERT INTO audit_log/.test(s))).toBe(true);
    expect(sqls.some((s) => /COMMIT/.test(s))).toBe(true);
    expect(client.release).toHaveBeenCalled();
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith(pool, 42);
  });

  it('throws SubjectAlreadyErasedError when user already soft-deleted', async () => {
    const userAlreadyErased = { ...SAMPLE_USER, deletion_requested_at: new Date() };
    const { pool } = makePool({ user: userAlreadyErased });
    await expect(gdpr.eraseSubject(pool, { email: SAMPLE_USER.email, reason: 'x' })).rejects.toMatchObject({
      code: 'ALREADY_ERASED'
    });
  });

  it('throws SubjectNotFoundError on missing user', async () => {
    const { pool } = makePool({ user: null });
    await expect(gdpr.eraseSubject(pool, { email: 'nope@nope.it', reason: 'x' })).rejects.toMatchObject({
      code: 'SUBJECT_NOT_FOUND'
    });
  });
});

describe('gdpr.finalizeErasures', () => {
  it('hard-deletes users past 30-day grace', async () => {
    const { pool } = makePool({ finalizeRows: [{ id: 1, email: 'a@b' }, { id: 2, email: 'c@d' }] });
    const out = await gdpr.finalizeErasures(pool, { now: new Date('2026-06-15T00:00:00Z') });
    expect(out.deleted).toBe(2);
    expect(out.ids).toEqual([1, 2]);
  });

  it('returns 0 when nothing to delete', async () => {
    const { pool } = makePool({ finalizeRows: [] });
    const out = await gdpr.finalizeErasures(pool);
    expect(out.deleted).toBe(0);
    expect(out.ids).toEqual([]);
  });
});

describe('exposed constants', () => {
  it('ERASURE_GRACE_DAYS is 30 (matches contract art. 11)', () => {
    expect(gdpr.ERASURE_GRACE_DAYS).toBe(30);
  });
});
