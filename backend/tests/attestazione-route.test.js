/**
 * /api/attestazione endpoints (route-level, mock DB).
 *
 * Verifica il flusso completo di emissione/verify/revoke senza container reali.
 */

'use strict';

// Variabile prefissata con "mock" per soddisfare la convenzione Jest e
// poterla referenziare all'interno della factory di jest.mock().
const mockPoolQuery = jest.fn();
jest.mock('../src/db/pool', () => ({
  pool: { query: (...args) => mockPoolQuery(...args), end: jest.fn() }
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
    // 1) fetchDevice, 2) INSERT attestazioni
    mockPoolQuery.mockResolvedValueOnce({ rows: [deviceRow] });
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/application\/pdf/);
    expect(res.header['x-attestazione-numero']).toMatch(/^FM-\d{4}-[0-9A-F]{8}$/);
    expect(res.header['x-attestazione-hash']).toMatch(/^[0-9a-f]{64}$/);
    // Magic bytes PDF
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('200 anche se INSERT fallisce (persistenza best-effort)', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [deviceRow] });
    mockPoolQuery.mockRejectedValueOnce(new Error('relation attestazioni does not exist'));

    const res = await request(buildApp())
      .post('/api/devices/dev-1/attestazione/pdf')
      .send({ destinatario: validDestinatario, year: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
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
