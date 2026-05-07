/**
 * /api/attestazione endpoints (route-level, mock DB).
 *
 * Verifica il flusso completo di emissione/verify/revoke senza container reali.
 */

'use strict';

// Variabile prefissata con "mock" per soddisfare la convenzione Jest e
// poterla referenziare all'interno della factory di jest.mock(). Le chiamate
// pool.connect() (R-ATTESTAZIONE-IDEMPOTENCY-001 force=true tx) condividono
// la stessa coda di mock — i test che esercitano transazioni accodano
// BEGIN / UPDATE / INSERT / COMMIT in ordine come query response.
const mockPoolQuery = jest.fn();
const mockClientRelease = jest.fn();
jest.mock('../src/db/pool', () => ({
  pool: {
    query: (...args) => mockPoolQuery(...args),
    connect: () => Promise.resolve({
      query: (...args) => mockPoolQuery(...args),
      release: () => mockClientRelease()
    }),
    end: jest.fn()
  }
}));

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (_req, _res, next) => { _req.user = { sub: 'u-admin', role: 'admin', email: 'a@f.it' }; next(); },
  requireRole: () => (_req, _res, next) => next(),
  PINNED_ALGORITHMS: ['HS256']
}));

const express = require('express');
const request = require('supertest');
const attestazioneRouter = require('../src/routes/attestazione');
const { _internals } = require('../src/services/piano4-attestazione-pdf');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', attestazioneRouter);
  return app;
}

const validDestinatario = {
  ragione_sociale: 'Test SpA',
  partita_iva: 'IT12345678901',
  sede_operativa: 'Via Roma 1, 37060 Mozzecane (VR)',
  legale_rappresentante: 'Mario Rossi'
};

const deviceRow = {
  id: 'dev-1',
  facility_id: 'mozzecane',
  line_id: 'line-01',
  machine_id: 'machine-01',
  vendor: 'FANUC',
  model: 'Test',
  protocol: 'opcua',
  acquisition_year: 2025,
  acquisition_value_eur: '180000.00'
};

describe('POST /api/devices/:id/attestazione/preview', () => {
  beforeEach(() => mockPoolQuery.mockReset());

  it('404 se device non trovato', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/preview')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(404);
  });

  it('400 se destinatario mancante', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [deviceRow] });
    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/preview')
      .send({ year: 2026 });
    expect(res.status).toBe(400);
  });

  it('400 se partita_iva non IT+11 cifre', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [deviceRow] });
    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/preview')
      .send({
        year: 2026,
        destinatario: { ...validDestinatario, partita_iva: '12345678901' }
      });
    expect(res.status).toBe(400);
  });

  it('200 + payload attestazione valido', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [deviceRow] });
    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/preview')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.destinatario.ragione_sociale).toBe('Test SpA');
    expect(res.body.year).toBe(2026);
    expect(res.body.attestazione).toBeDefined();
  });
});

describe('POST /api/devices/:id/attestazione/pdf', () => {
  beforeEach(() => mockPoolQuery.mockReset());

  it('200 + Buffer PDF con header X-Attestazione-Numero', async () => {
    // R-ATTESTAZIONE-IDEMPOTENCY-001 inserisce un SELECT di idempotency
    // tra fetchDevice e INSERT. La sequenza ora è:
    //   1) fetchDevice → [deviceRow]
    //   2) SELECT existing → [] (nessuna emissione precedente)
    //   3) INSERT → rowCount 1
    mockPoolQuery.mockResolvedValueOnce({ rows: [deviceRow] });
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/application\/pdf/);
    expect(res.header['x-attestazione-numero']).toMatch(/^FM-\d{4}-[0-9A-F]{8}$/);
    expect(res.header['x-attestazione-hash']).toMatch(/^[0-9a-f]{64}$/);
    expect(res.header['x-attestazione-cached']).toBe('false');
    // Magic bytes PDF
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('200 anche se INSERT fallisce (persistenza best-effort)', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [deviceRow] });
    mockPoolQuery.mockResolvedValueOnce({ rows: [] }); // idempotency lookup
    mockPoolQuery.mockRejectedValueOnce(new Error('relation attestazioni does not exist'));

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('200 anche se idempotency lookup fallisce (pre-008 schema)', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [deviceRow] });
    // Lookup fails — column `plan` doesn't exist yet.
    mockPoolQuery.mockRejectedValueOnce(new Error('column "plan" does not exist'));
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

// =============================================================================
// R-ATTESTAZIONE-IDEMPOTENCY-001 — F-MED-DATA-003 closure regression
// =============================================================================
describe('POST /api/devices/:id/attestazione/pdf — idempotency (R-ATTESTAZIONE-IDEMPOTENCY-001)', () => {
  beforeEach(() => mockPoolQuery.mockReset());

  // Use the same content-sha helper the route uses, so the test can assemble
  // a "matching" cached row deterministically.
  const { _internals } = require('../src/routes/attestazione');
  const { generateAttestazione } = require('../src/services/piano4-attestazione');

  function expectedContentSha(year, plan, destinatario) {
    const att = generateAttestazione({
      device: deviceRow, year, commandEvents: [], integrationEvents: [],
      alarmEvents: [], predictiveEvents: [], telemetrySampleCount: 0
    });
    return _internals.computeContentSha256(destinatario, att.report, year, plan);
  }

  it('cache hit: stesso contenuto → restituisce PDF cached, X-Attestazione-Cached=true, no INSERT', async () => {
    const cachedPdf = Buffer.from('%PDF-1.4\nCACHED-CONTENT\n%%EOF');
    const cachedHash = 'b'.repeat(64);
    const sha = expectedContentSha(2026, 'piano-4.0', validDestinatario);

    mockPoolQuery
      .mockResolvedValueOnce({ rows: [deviceRow] })  // fetchDevice
      .mockResolvedValueOnce({                        // idempotency lookup hits
        rows: [{
          numero: 'FM-2026-CACHED01',
          pdf_bytes: cachedPdf,
          pdf_hash: cachedHash,
          content_sha256: sha
        }]
      });

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });

    expect(res.status).toBe(200);
    expect(res.header['x-attestazione-numero']).toBe('FM-2026-CACHED01');
    expect(res.header['x-attestazione-hash']).toBe(cachedHash);
    expect(res.header['x-attestazione-cached']).toBe('true');
    expect(res.body.equals(cachedPdf)).toBe(true);

    // Crucially: no INSERT was issued (only 2 query calls).
    expect(mockPoolQuery.mock.calls.length).toBe(2);
  });

  it('integration regression: due richieste consecutive con stesso payload → bytes identici', async () => {
    // Simula la prima emissione (insert), poi la seconda (cache hit).
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [deviceRow] })   // 1st: fetchDevice
      .mockResolvedValueOnce({ rows: [] })             // 1st: lookup empty
      .mockResolvedValueOnce({ rowCount: 1 });         // 1st: INSERT

    const res1 = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res1.status).toBe(200);
    const numero1 = res1.header['x-attestazione-numero'];
    const sha = expectedContentSha(2026, 'piano-4.0', validDestinatario);

    // Seconda chiamata: lookup trova la riga della prima → cache hit.
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [deviceRow] })
      .mockResolvedValueOnce({
        rows: [{
          numero: numero1,
          pdf_bytes: res1.body,
          pdf_hash: res1.header['x-attestazione-hash'],
          content_sha256: sha
        }]
      });

    const res2 = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res2.status).toBe(200);
    expect(res2.header['x-attestazione-numero']).toBe(numero1);
    expect(res2.header['x-attestazione-cached']).toBe('true');
    // The exit criterion's "asserts identical bytes":
    expect(res2.body.equals(res1.body)).toBe(true);
  });

  it('content differs + no force → 409 con existing_numero', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [deviceRow] })
      .mockResolvedValueOnce({
        rows: [{
          numero: 'FM-2026-DIFFEREN',
          pdf_bytes: Buffer.from('%PDF'),
          pdf_hash: 'a'.repeat(64),
          content_sha256: 'a'.repeat(64) // intentionally != computed sha
        }]
      });

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(409);
    expect(res.body.detail).toMatch(/contenuto diverso/i);
    expect(res.body.existing_numero).toBe('FM-2026-DIFFEREN');
  });

  it('?force=true ma role != admin → 403', async () => {
    // Override the auth mock for this case to put the user into supervisor role.
    jest.resetModules();
    jest.doMock('../src/middleware/auth', () => ({
      requireAuth: (_req, _res, next) => { _req.user = { sub: 'u-sup', role: 'supervisor' }; next(); },
      requireRole: () => (_req, _res, next) => next(),
      PINNED_ALGORITHMS: ['HS256']
    }));
    jest.doMock('../src/db/pool', () => ({
      pool: { query: (...args) => mockPoolQuery(...args), end: jest.fn() }
    }));
    const expressLocal = require('express');
    const requestLocal = require('supertest');
    const routerLocal = require('../src/routes/attestazione');
    const app = expressLocal();
    app.use(expressLocal.json());
    app.use('/api', routerLocal);

    const res = await requestLocal(app)
      .post('/api/devices/dev-1/attestazione/pdf?force=true')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(403);
    expect(res.body.detail).toMatch(/admin/i);

    jest.resetModules();
  });

  it('?force=true + admin + content differs → revoca il vecchio + emette nuovo (TX atomic)', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [deviceRow] })   // fetchDevice
      .mockResolvedValueOnce({                          // lookup → existing differs
        rows: [{
          numero: 'FM-2026-FORCEOLD',
          pdf_bytes: Buffer.from('%PDF'),
          pdf_hash: 'c'.repeat(64),
          content_sha256: 'c'.repeat(64)
        }]
      })
      // R-ATTESTAZIONE-IDEMPOTENCY-001: force path uses a transaction:
      // BEGIN, UPDATE revoca, INSERT new, COMMIT.
      .mockResolvedValueOnce({})                        // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 })           // UPDATE revoca
      .mockResolvedValueOnce({ rowCount: 1 })           // INSERT new
      .mockResolvedValueOnce({});                       // COMMIT

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf?force=true')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(200);
    expect(res.header['x-attestazione-numero']).not.toBe('FM-2026-FORCEOLD');
    expect(res.header['x-attestazione-cached']).toBe('false');

    // Verifica che UPDATE revoca sia stato chiamato dentro la TX.
    const updateCalls = mockPoolQuery.mock.calls.filter((c) =>
      /UPDATE attestazioni SET revocata_il/i.test(c[0] || '')
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    expect(updateCalls[0][0]).toMatch(/re-emission via force=true/);

    // Verifica BEGIN + COMMIT (transazione completata).
    const stmts = mockPoolQuery.mock.calls.map((c) => c[0]);
    expect(stmts).toContain('BEGIN');
    expect(stmts).toContain('COMMIT');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  // R-ATTESTAZIONE-IDEMPOTENCY-001 advisor catch (concurrency).
  it('force=true TX failure (INSERT throws) → ROLLBACK + 200 served best-effort', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [deviceRow] })
      .mockResolvedValueOnce({                          // lookup → existing differs
        rows: [{
          numero: 'FM-2026-FORCEOLD2',
          pdf_bytes: Buffer.from('%PDF'),
          pdf_hash: 'd'.repeat(64),
          content_sha256: 'd'.repeat(64)
        }]
      })
      .mockResolvedValueOnce({})                        // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 })           // UPDATE revoca
      .mockRejectedValueOnce(new Error('connection terminated unexpectedly'))  // INSERT fails
      .mockResolvedValueOnce({});                       // ROLLBACK

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf?force=true')
      .send({ destinatario: validDestinatario, year: 2026 });
    // Best-effort contract: client still gets the PDF buffer.
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');

    const stmts = mockPoolQuery.mock.calls.map((c) => c[0]);
    expect(stmts).toContain('BEGIN');
    expect(stmts).toContain('ROLLBACK');
    expect(stmts).not.toContain('COMMIT');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  // R-ATTESTAZIONE-IDEMPOTENCY-001 advisor catch (concurrency).
  it('non-force INSERT race (23505) + winner has same content → cache-hit recovery', async () => {
    const winnerPdf = Buffer.from('%PDF-1.4\nWINNER-CONTENT\n%%EOF');
    const winnerHash = 'e'.repeat(64);
    const sha = expectedContentSha(2026, 'piano-4.0', validDestinatario);

    const uniqueViolation = Object.assign(new Error('duplicate key value'), { code: '23505' });

    mockPoolQuery
      .mockResolvedValueOnce({ rows: [deviceRow] })   // fetchDevice
      .mockResolvedValueOnce({ rows: [] })             // 1st lookup: no row yet
      .mockRejectedValueOnce(uniqueViolation)          // INSERT loses race
      .mockResolvedValueOnce({                          // race-recovery SELECT
        rows: [{
          numero: 'FM-2026-WINNER01',
          pdf_bytes: winnerPdf,
          pdf_hash: winnerHash,
          content_sha256: sha
        }]
      });

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(200);
    expect(res.header['x-attestazione-numero']).toBe('FM-2026-WINNER01');
    expect(res.header['x-attestazione-cached']).toBe('true');
    expect(res.header['x-attestazione-race-recovery']).toBe('true');
    expect(res.body.equals(winnerPdf)).toBe(true);
  });

  // R-ATTESTAZIONE-IDEMPOTENCY-001 advisor catch (concurrency divergent).
  it('non-force INSERT race (23505) + winner has different content → 409 with existing_numero', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate key value'), { code: '23505' });

    mockPoolQuery
      .mockResolvedValueOnce({ rows: [deviceRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(uniqueViolation)
      .mockResolvedValueOnce({
        rows: [{
          numero: 'FM-2026-WINNERDIFF',
          pdf_bytes: Buffer.from('%PDF'),
          pdf_hash: 'f'.repeat(64),
          content_sha256: 'f'.repeat(64) // != computed sha
        }]
      });

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(409);
    expect(res.body.detail).toMatch(/concorrente|diverso/i);
    expect(res.body.existing_numero).toBe('FM-2026-WINNERDIFF');
  });

  it('plan piano-5.0 esplicito si propaga in INSERT', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [deviceRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026, plan: 'piano-5.0' });
    expect(res.status).toBe(200);

    const insertCall = mockPoolQuery.mock.calls.find((c) => /INSERT INTO attestazioni/i.test(c[0] || ''));
    expect(insertCall).toBeDefined();
    // The 4th positional parameter (index 3) is `plan`.
    expect(insertCall[1][3]).toBe('piano-5.0');
  });

  it('plan invalido → 400', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [deviceRow] });
    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026, plan: 'piano-99' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/attestazione/:numero/pdf (re-download)', () => {
  beforeEach(() => mockPoolQuery.mockReset());

  it('400 numero malformato', async () => {
    const res = await request(buildApp()).get('/api/attestazione/NO-NUMBER/pdf');
    expect(res.status).toBe(400);
  });

  it('404 se non esiste', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp()).get('/api/attestazione/FM-2026-ABCDEF12/pdf');
    expect(res.status).toBe(404);
  });

  it('410 se revocata (download disabilitato)', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ pdf_bytes: Buffer.from('fake'), pdf_hash: 'a'.repeat(64), revocata_il: new Date() }]
    });
    const res = await request(buildApp()).get('/api/attestazione/FM-2026-ABCDEF12/pdf');
    expect(res.status).toBe(410);
  });

  it('410 se pdf_bytes NULL (attestazione legacy pre-007)', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ pdf_bytes: null, pdf_hash: 'a'.repeat(64), revocata_il: null }]
    });
    const res = await request(buildApp()).get('/api/attestazione/FM-2026-ABCDEF12/pdf');
    expect(res.status).toBe(410);
    expect(res.body.detail).toMatch(/non archiviato/i);
  });

  it('200 + PDF buffer + incrementa scaricata_count', async () => {
    const pdfBuf = Buffer.from('%PDF-1.3\nfake-pdf-content\n%%EOF');
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ pdf_bytes: pdfBuf, pdf_hash: 'a'.repeat(64), revocata_il: null }] })
      .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE scaricata_count

    const res = await request(buildApp()).get('/api/attestazione/FM-2026-ABCDEF12/pdf');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/application\/pdf/);
    expect(res.header['x-attestazione-numero']).toBe('FM-2026-ABCDEF12');
    // Verifica che UPDATE scaricata_count sia stato chiamato
    const updateCalls = mockPoolQuery.mock.calls.filter((c) => /UPDATE attestazioni/i.test(c[0] || ''));
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/attestazione/:numero', () => {
  beforeEach(() => mockPoolQuery.mockReset());

  it('400 numero non valido', async () => {
    const res = await request(buildApp()).get('/api/attestazione/INVALID');
    expect(res.status).toBe(400);
  });

  it('404 se non esiste', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp()).get('/api/attestazione/FM-2026-ABCDEF12');
    expect(res.status).toBe(404);
  });

  it('200 con metadata se presente', async () => {
    const row = {
      numero: 'FM-2026-ABCDEF12',
      anno_fiscale: 2026,
      pdf_hash: 'x'.repeat(64),
      eleggibile: true,
      emessa_il: new Date('2026-04-22T10:00:00Z'),
      revocata_il: null,
      motivo_revoca: null
    };
    mockPoolQuery.mockResolvedValueOnce({ rows: [row] });
    const res = await request(buildApp()).get('/api/attestazione/FM-2026-ABCDEF12');
    expect(res.status).toBe(200);
    expect(res.body.numero).toBe('FM-2026-ABCDEF12');
  });
});

describe('GET /api/attestazione/:numero/verify', () => {
  beforeEach(() => mockPoolQuery.mockReset());

  it('valid quando hash ricomputato corrisponde', async () => {
    const emessaIl = new Date('2026-04-22T10:00:00Z');
    const report = { year: 2026, device: deviceRow };
    const payload = {
      numero: 'FM-2026-ABCDEF12',
      emessa_il: emessaIl.toISOString(),
      destinatario: validDestinatario,
      report
    };
    const pdfHash = _internals.hashPayload(payload);
    mockPoolQuery.mockResolvedValueOnce({ rows: [{
      numero: 'FM-2026-ABCDEF12',
      emessa_il: emessaIl,
      destinatario: validDestinatario,
      report,
      pdf_hash: pdfHash,
      revocata_il: null
    }] });
    const res = await request(buildApp()).get('/api/attestazione/FM-2026-ABCDEF12/verify');
    expect(res.status).toBe(200);
    expect(res.body.match).toBe(true);
    expect(res.body.status).toBe('valid');
  });

  it('409 status=revoked se revocata', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{
      numero: 'FM-2026-ABCDEF12',
      emessa_il: new Date(),
      destinatario: validDestinatario,
      report: { year: 2026 },
      pdf_hash: 'x'.repeat(64),
      revocata_il: new Date()
    }] });
    const res = await request(buildApp()).get('/api/attestazione/FM-2026-ABCDEF12/verify');
    expect(res.status).toBe(409);
    expect(res.body.status).toBe('revoked');
  });

  it('hash_mismatch se qualcuno ha modificato payload in DB', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{
      numero: 'FM-2026-ABCDEF12',
      emessa_il: new Date('2026-04-22T10:00:00Z'),
      destinatario: validDestinatario,
      report: { year: 2026 },
      pdf_hash: 'e'.repeat(64),  // hash manomesso
      revocata_il: null
    }] });
    const res = await request(buildApp()).get('/api/attestazione/FM-2026-ABCDEF12/verify');
    expect(res.status).toBe(200);
    expect(res.body.match).toBe(false);
    expect(res.body.status).toBe('hash_mismatch');
  });
});

describe('POST /api/attestazione/:numero/revoke', () => {
  beforeEach(() => mockPoolQuery.mockReset());

  it('400 se motivo troppo corto', async () => {
    const res = await request(buildApp())
      .post('/api/attestazione/FM-2026-ABCDEF12/revoke')
      .send({ motivo: 'err' });
    expect(res.status).toBe(400);
  });

  it('404 se attestazione inesistente o già revocata', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0 });
    const res = await request(buildApp())
      .post('/api/attestazione/FM-2026-ABCDEF12/revoke')
      .send({ motivo: 'motivo valido e lungo abbastanza' });
    expect(res.status).toBe(404);
  });

  it('200 con status=revoked se update riesce', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(buildApp())
      .post('/api/attestazione/FM-2026-ABCDEF12/revoke')
      .send({ motivo: 'errore in anagrafica macchina' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('revoked');
  });
});
