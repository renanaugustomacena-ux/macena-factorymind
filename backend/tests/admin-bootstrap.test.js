/**
 * admin-bootstrap: verifica che il backend carichi l'admin reale
 * da env, disattivi il seed demo in produzione, e rifiuti il boot
 * quando necessario.
 */

'use strict';

const mockPoolQuery = jest.fn();
jest.mock('../src/db/pool', () => ({
  pool: { query: (...a) => mockPoolQuery(...a), end: jest.fn() }
}));

// config.isProduction deve essere mockabile per test
let mockIsProduction = false;
jest.mock('../src/config', () => ({
  isProduction: false,
  logLevel: 'error',
  env: 'test',
  service: { name: 'test', version: '0.0.0' },
  get __isProdFlag() { return mockIsProduction; }
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn()
}));

const adminBootstrap = require('../src/services/admin-bootstrap');
const { _internals } = adminBootstrap;

describe('parseHashEnvelope', () => {
  it('accetta formato scrypt$salt_b64$hash_b64', () => {
    const salt = Buffer.from('saltsaltsaltsalt'); // 16 byte
    const hash = Buffer.alloc(64, 0xaa); // 64 byte
    const raw = `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
    const parsed = _internals.parseHashEnvelope(raw);
    expect(parsed).not.toBeNull();
    expect(parsed.saltHex).toBe(salt.toString('hex'));
    expect(parsed.hashHex).toBe(hash.toString('hex'));
  });

  it('accetta formato legacy salt_hex:hash_hex', () => {
    const raw = '0123456789abcdef:' + 'a'.repeat(128);
    const parsed = _internals.parseHashEnvelope(raw);
    expect(parsed).not.toBeNull();
    expect(parsed.saltHex).toBe('0123456789abcdef');
    expect(parsed.hashHex).toBe('a'.repeat(128));
  });

  it('rifiuta formato malformato', () => {
    expect(_internals.parseHashEnvelope('')).toBeNull();
    expect(_internals.parseHashEnvelope(null)).toBeNull();
    expect(_internals.parseHashEnvelope('scrypt$abc')).toBeNull();
    expect(_internals.parseHashEnvelope('scrypt$c2FsdA==$' + Buffer.alloc(32).toString('base64'))).toBeNull();
    expect(_internals.parseHashEnvelope('0123:abc')).toBeNull();  // hash troppo corto
  });
});

describe('ensureAdmin', () => {
  const validHash = 'scrypt$' +
    Buffer.from('0123456789abcdef').toString('base64') + '$' +
    Buffer.alloc(64, 0xaa).toString('base64');

  beforeEach(() => {
    mockPoolQuery.mockReset();
    delete process.env.FM_ADMIN_EMAIL;
    delete process.env.FM_ADMIN_PASSWORD_HASH;
    delete process.env.FM_REQUIRE_CUSTOM_ADMIN;
    mockIsProduction = false;
  });

  it('in dev senza env non blocca ma logga skip', async () => {
    const result = await adminBootstrap.ensureAdmin();
    expect(result.action).toBe('skip');
  });

  it('in dev con FM_REQUIRE_CUSTOM_ADMIN=true senza env blocca', async () => {
    process.env.FM_REQUIRE_CUSTOM_ADMIN = 'true';
    await expect(adminBootstrap.ensureAdmin()).rejects.toThrow(/FM_ADMIN_EMAIL/);
  });

  it('crea nuovo admin quando email non esiste', async () => {
    process.env.FM_ADMIN_EMAIL = 'capo@acme.it';
    process.env.FM_ADMIN_PASSWORD_HASH = validHash;
    mockPoolQuery
      .mockResolvedValueOnce({ rowCount: 0 })           // BEGIN
      .mockResolvedValueOnce({ rows: [] })              // SELECT existing
      .mockResolvedValueOnce({ rowCount: 1 })           // INSERT
      .mockResolvedValueOnce({ rows: [] })              // UPDATE seed disabled
      .mockResolvedValueOnce({ rowCount: 0 });          // COMMIT

    const result = await adminBootstrap.ensureAdmin();
    expect(result.action).toBe('created');
    const insertQuery = mockPoolQuery.mock.calls.find((c) => /INSERT INTO users/i.test(c[0]));
    expect(insertQuery).toBeDefined();
    expect(insertQuery[1][0]).toBe('capo@acme.it');
  });

  it('aggiorna admin esistente senza duplicarlo', async () => {
    process.env.FM_ADMIN_EMAIL = 'capo@acme.it';
    process.env.FM_ADMIN_PASSWORD_HASH = validHash;
    mockPoolQuery
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 'u-1', role: 'admin', password_hash: 'old' }] })
      .mockResolvedValueOnce({ rowCount: 1 })    // UPDATE
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 0 });

    const result = await adminBootstrap.ensureAdmin();
    expect(result.action).toBe('updated');
    const updateQuery = mockPoolQuery.mock.calls.find((c) => /UPDATE users\s+SET password_salt/i.test(c[0]));
    expect(updateQuery).toBeDefined();
  });

  it('rifiuta hash malformato senza toccare il DB', async () => {
    process.env.FM_ADMIN_EMAIL = 'capo@acme.it';
    process.env.FM_ADMIN_PASSWORD_HASH = 'garbage';
    await expect(adminBootstrap.ensureAdmin()).rejects.toThrow(/malformato/);
    // Nessuna query eseguita
    const writes = mockPoolQuery.mock.calls.filter((c) => !/SELECT/i.test(c[0] || ''));
    expect(writes).toHaveLength(0);
  });
});

describe('detectDefaultSeedAdmin', () => {
  beforeEach(() => mockPoolQuery.mockReset());

  it('true se lo seed admin è ancora attivo con hash di default', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ email: 'admin@factorymind.local', active: true }]
    });
    const r = await adminBootstrap.detectDefaultSeedAdmin();
    expect(r.present).toBe(true);
    expect(r.email).toBe('admin@factorymind.local');
  });

  it('false se rimosso/disattivato', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const r = await adminBootstrap.detectDefaultSeedAdmin();
    expect(r.present).toBe(false);
  });
});
