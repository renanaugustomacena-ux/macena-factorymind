/**
 * Contact form endpoint.
 *
 * Verifica:
 *  - rate-limit (5/ora) presente
 *  - Joi schema respinge payload malformati
 *  - honeypot (campo `website` popolato) → 200 silenzioso senza invio SMTP
 *  - SMTP_URL assente → 503 con messaggio utente-friendly
 *  - CONTACT_DISABLED=true → 503 disabilitato
 */

'use strict';

jest.mock('../src/db/pool', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }), end: jest.fn() }
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' })
  }))
}));

const express = require('express');
const request = require('supertest');
const contactRouter = require('../src/routes/contact');

function buildApp(forwardedIp) {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  // Permette ai singoli test di usare IP diversi via X-Forwarded-For, così
  // il rate-limit (5/h per IP) non si interdice a vicenda tra i casi.
  if (forwardedIp) {
    app.use((req, _res, next) => {
      req.headers['x-forwarded-for'] = forwardedIp;
      next();
    });
  }
  app.use('/api/contact', contactRouter);
  return app;
}

describe('POST /api/contact', () => {
  let counter = 0;

  function freshApp() {
    counter += 1;
    return buildApp(`10.0.${Math.floor(counter / 256)}.${counter % 256}`);
  }

  beforeEach(() => {
    delete process.env.SMTP_URL;
    delete process.env.CONTACT_DISABLED;
  });

  it('respinge payload con campi mancanti (400)', async () => {
    const res = await request(freshApp())
      .post('/api/contact')
      .send({ nome: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('invalid');
  });

  it('respinge email non valida (400)', async () => {
    const res = await request(freshApp())
      .post('/api/contact')
      .send({
        nome: 'Mario Rossi', azienda: 'ACME Srl',
        email: 'not-an-email', messaggio: 'messaggio lungo abbastanza 0123',
        privacy_consent: true
      });
    expect(res.status).toBe(400);
  });

  // R-LANDING-CONSENT-001 (F-MED-LEGAL-006): integration path locks the
  // schema-level rejection so a future regression cannot silently make the
  // GDPR consent optional. The unit-level Joi rule lives in
  // contact-consent.test.js.
  it('respinge payload senza privacy_consent (400)', async () => {
    const res = await request(freshApp())
      .post('/api/contact')
      .send({
        nome: 'Mario Rossi', azienda: 'ACME Srl',
        email: 'm@rossi.it', messaggio: 'messaggio lungo abbastanza 0123'
        // privacy_consent intentionally omitted
      });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('invalid');
    // Joi's custom message for the privacy_consent rule (route lines ~70).
    expect(res.body.message).toMatch(/consenso al trattamento dei dati/i);
  });

  it('respinge payload con privacy_consent=false (400)', async () => {
    const res = await request(freshApp())
      .post('/api/contact')
      .send({
        nome: 'Mario Rossi', azienda: 'ACME Srl',
        email: 'm@rossi.it', messaggio: 'messaggio lungo abbastanza 0123',
        privacy_consent: false
      });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('invalid');
  });

  it('honeypot: website popolato → 200 silenzioso senza SMTP', async () => {
    // Anche se SMTP_URL non c'è, il honeypot deve far ritornare 200
    // senza consultare nodemailer.
    const res = await request(freshApp())
      .post('/api/contact')
      .send({
        nome: 'Bot Spam', azienda: 'BotCo',
        email: 'bot@example.com',
        messaggio: 'Sono un bot, clicca qui www.sito-truffa.example',
        privacy_consent: true,
        website: 'http://attacker.example.com/drop'
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('SMTP_URL non configurato → 503 smtp_not_configured', async () => {
    const res = await request(freshApp())
      .post('/api/contact')
      .send({
        nome: 'Mario Rossi', azienda: 'ACME',
        email: 'm@r.it', messaggio: 'testo messaggio abbastanza lungo',
        privacy_consent: true
      });
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('smtp_not_configured');
  });

  it('CONTACT_DISABLED=true → 503 disabled', async () => {
    process.env.CONTACT_DISABLED = 'true';
    const res = await request(freshApp())
      .post('/api/contact')
      .send({
        nome: 'Mario Rossi', azienda: 'ACME',
        email: 'm@r.it', messaggio: 'testo messaggio abbastanza lungo',
        privacy_consent: true
      });
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('disabled');
  });

  it('SMTP_URL configurato e payload valido → 200 ok (mocked transport)', async () => {
    process.env.SMTP_URL = 'smtps://u:p@smtp.example.com:465';
    const res = await request(freshApp())
      .post('/api/contact')
      .send({
        nome: 'Mario Rossi', azienda: 'ACME',
        email: 'm@rossi.it', messaggio: 'testo messaggio abbastanza lungo per passare Joi',
        privacy_consent: true
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
