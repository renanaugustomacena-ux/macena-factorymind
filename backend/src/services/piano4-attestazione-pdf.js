/**
 * Renderer PDF dell'attestazione Piano Transizione 4.0 / 5.0.
 *
 * Produce un documento PDF strutturato, italiano, firmabile, pronto da
 * consegnare al commercialista del cliente per la pratica del credito d'imposta.
 *
 * Input:  output di `piano4-attestazione.generateAttestazione()` + metadati
 *         del destinatario (ragione sociale, P.IVA, legale rappresentante).
 * Output: Buffer del PDF + hash SHA-256 del contenuto + numero univoco.
 *
 * Il PDF è self-contained: nessuna dipendenza esterna in runtime
 * (no Chrome headless, no font remoti). Usa font Helvetica built-in di pdfkit.
 *
 * Ogni attestazione include:
 *   - Numero univoco (FM-YYYY-XXXXXXXX) per riferimento fiscale
 *   - Hash SHA-256 del payload per verificabilità
 *   - Data emissione RFC 3339 UTC
 *   - Citazioni normative puntuali (L. 232/2016, Circolari AdE, D.L. 19/2024)
 *   - Checklist tecnica con evidenze
 *   - Campo firma legale rappresentante
 *
 * NOTA LEGALE: questo documento è un ausilio operativo. Per investimenti
 * > €300.000 è richiesta perizia giurata di ingegnere/perito industriale
 * iscritto all'albo ex art. 1 co. 11 L. 232/2016.
 */

'use strict';

const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

const PAGE_MARGIN = 56;
const COLOR_PRIMARY = '#1e293b';    // slate-800
const COLOR_MUTED = '#64748b';       // slate-500
const COLOR_ACCENT = '#d97706';      // amber-600 (safety yellow attenuato)
const COLOR_SUCCESS = '#16a34a';     // green-600
const COLOR_DANGER = '#dc2626';      // red-600

function generaNumeroUnivoco(year) {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `FM-${year}-${random}`;
}

function hashPayload(payload) {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function formatData(isoString) {
  const d = isoString ? new Date(isoString) : new Date();
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function intestazione(doc, { numeroUnivoco, destinatario, emessaIl }) {
  doc
    .fillColor(COLOR_PRIMARY)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('ATTESTAZIONE DI CONFORMITÀ', PAGE_MARGIN, PAGE_MARGIN);

  doc
    .fillColor(COLOR_ACCENT)
    .fontSize(12)
    .text('Piano Transizione 4.0 / 5.0 — Credito d\'Imposta Beni Strumentali');

  doc.moveDown(0.5);
  doc
    .fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text(`Numero: ${numeroUnivoco}`, { continued: true })
    .text(`   Emessa il: ${formatData(emessaIl)}`, { align: 'right' });

  doc
    .moveTo(PAGE_MARGIN, doc.y + 8)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y + 8)
    .strokeColor(COLOR_ACCENT)
    .lineWidth(1.5)
    .stroke();

  doc.moveDown(2);

  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(11).text('Destinatario:');
  doc.font('Helvetica').fontSize(10);
  doc.text(`Ragione sociale: ${destinatario?.ragione_sociale || 'N.D.'}`);
  doc.text(`P. IVA: ${destinatario?.partita_iva || 'N.D.'}`);
  if (destinatario?.codice_fiscale) doc.text(`Codice fiscale: ${destinatario.codice_fiscale}`);
  doc.text(`Sede operativa: ${destinatario?.sede_operativa || 'N.D.'}`);
  doc.text(`Legale rappresentante: ${destinatario?.legale_rappresentante || 'N.D.'}`);
  doc.moveDown();
}

function sezioneOggetto(doc, { device, year }) {
  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(13).text('Oggetto');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);
  doc.text(
    `Attestazione di conformità ai requisiti tecnologici previsti per il credito d'imposta ` +
    `beni strumentali funzionali alla trasformazione tecnologica e digitale delle imprese, ` +
    `di cui all'art. 1 commi 9-13 della L. 11 dicembre 2016 n. 232 (Piano Transizione 4.0) e ` +
    `all'art. 38 del D.L. 2 marzo 2024 n. 19, convertito dalla L. 29 aprile 2024 n. 56 ` +
    `(Piano Transizione 5.0).`,
    { align: 'justify' }
  );
  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(10).text(`Macchina oggetto dell'attestazione:`);
  doc.font('Helvetica').fontSize(9).fillColor(COLOR_MUTED);
  doc.text(`Matricola / machine_id: ${device?.machine_id || 'N.D.'}`);
  doc.text(`Linea produttiva: ${device?.line_id || 'N.D.'}`);
  doc.text(`Stabilimento: ${device?.facility_id || 'N.D.'}`);
  doc.text(`Costruttore: ${device?.vendor || 'N.D.'}  —  Modello: ${device?.model || 'N.D.'}`);
  doc.text(`Protocollo di interconnessione: ${device?.protocol || 'N.D.'}`);
  if (device?.acquisition_year) doc.text(`Anno di acquisizione: ${device.acquisition_year}`);
  if (device?.acquisition_value_eur) {
    const formatted = Number(device.acquisition_value_eur).toLocaleString('it-IT', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    });
    doc.text(`Valore di acquisizione: ${formatted}`);
  }
  doc.fillColor(COLOR_PRIMARY).moveDown();
  doc.font('Helvetica').fontSize(10).text(`Anno fiscale di riferimento: ${year}`);
  doc.moveDown();
}

function checklistSezione(doc, titolo, voci) {
  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(12).text(titolo);
  doc.moveDown(0.3);

  for (const v of voci) {
    const simbolo = v.satisfied ? '[SI]' : '[NO]';
    const colore = v.satisfied ? COLOR_SUCCESS : COLOR_DANGER;

    doc.fillColor(colore).font('Helvetica-Bold').fontSize(10)
      .text(simbolo, { continued: true });
    doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(10)
      .text(`  ${v.id}: ${v.label}`);

    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(8.5);
    if (v.circolareRef) doc.text(`   Riferimento normativo: ${v.circolareRef}`);
    if (v.evidence) doc.text(`   Evidenza: ${v.evidence}`);
    if (v.source) doc.text(`   Fonte dati: ${v.source}`);
    if (v.mandatory === false) doc.text('   (caratteristica aggiuntiva — facoltativa)');
    if (v.mandatory === true) doc.text('   (caratteristica obbligatoria)');

    doc.moveDown(0.5);
  }
  doc.fillColor(COLOR_PRIMARY);
  doc.moveDown();
}

function verdetto(doc, eligibility) {
  const colore = eligibility.eligible ? COLOR_SUCCESS : COLOR_DANGER;
  const testo = eligibility.eligible ? 'AMMESSO AL CREDITO' : 'NON AMMESSO';

  doc.moveDown();
  doc.fillColor(colore).font('Helvetica-Bold').fontSize(16).text(`Verdetto: ${testo}`);
  doc.fillColor(COLOR_PRIMARY).font('Helvetica').fontSize(10).text(eligibility.reason, { align: 'justify' });
  doc.moveDown();
}

function riferimentiNormativi(doc, legalBasis) {
  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(12).text('Riferimenti normativi');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9);
  for (const l of legalBasis || []) doc.text(`•  ${l}`);
  doc.moveDown();
}

function firmaLegaleRappresentante(doc, { destinatario }) {
  // Forza nuova pagina se vicino al fondo.
  if (doc.y > doc.page.height - 200) doc.addPage();
  doc.moveDown(2);
  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(11).text('Sottoscrizione');
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9);
  doc.text(
    `Il sottoscritto ${destinatario?.legale_rappresentante || '__________________________'}, ` +
    `in qualità di legale rappresentante di ${destinatario?.ragione_sociale || '__________________________'}, ` +
    `dichiara ai sensi e per gli effetti degli artt. 46 e 47 del D.P.R. 28 dicembre 2000, n. 445, ` +
    `consapevole delle sanzioni penali previste per le dichiarazioni mendaci dall'art. 76 del medesimo ` +
    `decreto, che i dati contenuti nella presente attestazione sono veritieri e fanno fede del possesso ` +
    `dei requisiti tecnologici di cui all'art. 1 comma 11 della L. 232/2016.`,
    { align: 'justify' }
  );
  doc.moveDown(3);
  doc.text('Luogo e data: _______________________________________', PAGE_MARGIN);
  doc.moveDown(2);
  doc.text('Firma del legale rappresentante:', PAGE_MARGIN);
  doc.moveDown(2);
  doc.text('_______________________________________');
}

function footerPagina(doc, { numeroUnivoco, pdfHash }) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const bottom = doc.page.height - PAGE_MARGIN + 20;
    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(7);
    doc.text(
      `${numeroUnivoco} — SHA-256: ${pdfHash.substring(0, 16)}…${pdfHash.substring(pdfHash.length - 8)}`,
      PAGE_MARGIN, bottom, { width: doc.page.width - PAGE_MARGIN * 2, align: 'left' }
    );
    doc.text(
      `FactoryMind — Attestazione Piano 4.0/5.0 — Pagina ${i + 1} di ${range.count}`,
      PAGE_MARGIN, bottom, { width: doc.page.width - PAGE_MARGIN * 2, align: 'right' }
    );
  }
}

function disclaimer(doc, testo) {
  doc.fillColor(COLOR_MUTED).font('Helvetica-Oblique').fontSize(8);
  doc.text(testo, { align: 'justify' });
  doc.fillColor(COLOR_PRIMARY);
}

/**
 * Rende l'attestazione in PDF.
 *
 * @param {object} attestazione — output di generateAttestazione({...})
 * @param {object} destinatario — dati del cliente per il documento
 * @param {string} destinatario.ragione_sociale
 * @param {string} destinatario.partita_iva
 * @param {string} [destinatario.codice_fiscale]
 * @param {string} destinatario.sede_operativa
 * @param {string} destinatario.legale_rappresentante
 * @returns {Promise<{ buffer: Buffer, pdfHash: string, numero: string }>}
 */
async function renderAttestazionePDF(attestazione, destinatario = {}) {
  if (!attestazione || !attestazione.report) {
    throw new Error('renderAttestazionePDF: attestazione.report mancante');
  }
  const { report, eligibility } = attestazione;

  const year = report.year || new Date().getFullYear();
  const numeroUnivoco = generaNumeroUnivoco(year);
  const emessaIl = new Date().toISOString();

  // Hash del payload PRIMA di generare il PDF, così il documento
  // riporta lo stesso hash che l'endpoint /verify ricomputa.
  const payloadPerHash = {
    numero: numeroUnivoco,
    emessa_il: emessaIl,
    destinatario,
    report
  };
  const pdfHash = hashPayload(payloadPerHash);

  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: {
      Title: `Attestazione Piano 4.0/5.0 — ${numeroUnivoco}`,
      Author: 'FactoryMind',
      Subject: 'Attestazione credito d\'imposta beni strumentali',
      Keywords: 'Piano Transizione 4.0, 5.0, credito d\'imposta, OEE, interconnessione'
    }
  });

  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const flushed = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  intestazione(doc, { numeroUnivoco, destinatario, emessaIl });
  sezioneOggetto(doc, { device: report.device, year });
  checklistSezione(doc, 'Caratteristiche tecnologiche obbligatorie (5 di 5)', report.characteristics || []);
  doc.addPage();
  checklistSezione(doc, 'Caratteristiche di interconnessione (1 obbligatoria + ≥1 ulteriore)', report.interconnection || []);
  riferimentiNormativi(doc, report.legal_basis);
  verdetto(doc, eligibility ? { eligible: attestazione.eligibility, reason: report.eligibility?.reason || '' } : report.eligibility);
  firmaLegaleRappresentante(doc, { destinatario });

  doc.moveDown(2);
  disclaimer(doc, report.disclaimer || '');

  footerPagina(doc, { numeroUnivoco, pdfHash });

  doc.end();
  const buffer = await flushed;

  logger.info(
    { numero: numeroUnivoco, machine: report?.device?.machine_id, bytes: buffer.length },
    '[attestazione-pdf] documento generato'
  );

  return { buffer, pdfHash, numero: numeroUnivoco };
}

module.exports = {
  renderAttestazionePDF,
  // Utilities esposte per test.
  _internals: { hashPayload, generaNumeroUnivoco }
};
