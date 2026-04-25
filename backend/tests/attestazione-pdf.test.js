/**
 * Test del renderer PDF dell'attestazione Piano 4.0/5.0.
 *
 * Verifica che:
 *   - Il Buffer restituito è un PDF valido (magic bytes %PDF-)
 *   - Il numero univoco segue il formato FM-YYYY-XXXXXXXX
 *   - L'hash ricomputabile sul payload coincide
 *   - Il documento è non vuoto (almeno 3KB di contenuto strutturato)
 */

'use strict';

const { generateAttestazione } = require('../src/services/piano4-attestazione');
const { renderAttestazionePDF, _internals } = require('../src/services/piano4-attestazione-pdf');

describe('renderAttestazionePDF', () => {
  const destinatarioDemo = {
    ragione_sociale: 'Officine Mozzecane S.r.l.',
    partita_iva: 'IT02345678901',
    codice_fiscale: '02345678901',
    sede_operativa: 'Via dell\'Industria 12, 37060 Mozzecane (VR)',
    legale_rappresentante: 'Mario Rossi'
  };

  const deviceDemo = {
    facility_id: 'mozzecane',
    line_id: 'line-01',
    machine_id: 'machine-01',
    vendor: 'FANUC',
    model: 'α-T14iA CNC',
    protocol: 'opcua',
    acquisition_year: 2025,
    acquisition_value_eur: 180_000
  };

  function attestazioneDemo() {
    return generateAttestazione({
      device: deviceDemo,
      year: 2026,
      commandEvents: [{ ts: 'x' }, { ts: 'y' }],
      integrationEvents: [{ ts: 'a' }],
      alarmEvents: [],
      predictiveEvents: [{ ts: 'p' }],
      telemetrySampleCount: 86400
    });
  }

  it('restituisce un Buffer PDF valido', async () => {
    const att = attestazioneDemo();
    const { buffer, pdfHash, numero } = await renderAttestazionePDF(att, destinatarioDemo);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(3_000);
    // Magic bytes PDF
    const magic = buffer.slice(0, 5).toString('ascii');
    expect(magic).toBe('%PDF-');
    // Header hash non vuoto, formato hex 64 chars
    expect(pdfHash).toMatch(/^[0-9a-f]{64}$/);
    // Numero univoco format FM-YYYY-XXXXXXXX
    expect(numero).toMatch(/^FM-\d{4}-[0-9A-F]{8}$/);
  });

  it('genera numeri univoci diversi a ogni invocazione', async () => {
    const att = attestazioneDemo();
    const a = await renderAttestazionePDF(att, destinatarioDemo);
    const b = await renderAttestazionePDF(att, destinatarioDemo);
    expect(a.numero).not.toBe(b.numero);
  });

  it('hashPayload è deterministico e sensibile al payload', () => {
    const { hashPayload } = _internals;
    const p1 = { a: 1, b: 2 };
    const p2 = { b: 2, a: 1 };    // stesso contenuto, ordine chiavi diverso
    const p3 = { a: 1, b: 3 };    // contenuto diverso
    expect(hashPayload(p1)).toBe(hashPayload(p2));
    expect(hashPayload(p1)).not.toBe(hashPayload(p3));
  });

  it('respinge input senza report', async () => {
    await expect(renderAttestazionePDF(null, destinatarioDemo)).rejects.toThrow(/report/);
    await expect(renderAttestazionePDF({}, destinatarioDemo)).rejects.toThrow(/report/);
  });

  it('include catalog, info object e trailer PDF validi', async () => {
    const att = attestazioneDemo();
    const { buffer } = await renderAttestazionePDF(att, destinatarioDemo);
    const body = buffer.toString('latin1');
    // Il dictionary /Info e /Root sono sempre referenziati nel trailer,
    // anche quando gli oggetti metadata sono all'interno di un object stream
    // compresso (PDFKit usa Flate di default per tutto il contenuto strutturato).
    expect(body).toMatch(/\/Info\s+\d+\s+\d+\s+R/);
    expect(body).toMatch(/\/Root\s+\d+\s+\d+\s+R/);
    // Trailer + xref presenti
    expect(body).toContain('startxref');
    expect(body).toContain('%%EOF');
  });
});
