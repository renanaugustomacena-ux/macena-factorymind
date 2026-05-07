/**
 * /api/contact — endpoint pubblico del form contatti della landing page.
 *
 * Invio via SMTP tramite nodemailer. Rate-limit stretto per bloccare spam.
 * Honeypot silenzioso: se il campo "website" è popolato assumiamo bot e
 * ritorniamo 200 OK senza inviare email (il bot non si accorge).
 *
 * Variabili d'ambiente:
 *   SMTP_URL              — stringa connessione nodemailer (es. smtps://user:pass@smtp.gmail.com:465)
 *   CONTACT_DEST_EMAIL    — mailbox che riceve i lead (default: renan@factorymind.it)
 *   CONTACT_FROM_EMAIL    — mittente del messaggio (default: no-reply@factorymind.it)
 *   CONTACT_DISABLED=true — disabilita l'invio (endpoint ritorna 503)
 *
 * Se SMTP_URL non è configurato l'endpoint ritorna 503, segnalando che
 * la configurazione email non è pronta. Il form sul lato landing mostra
 * un messaggio all'utente invitandolo a contattare il supporto direttamente.
 */

'use strict';

const { Router } = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const router = Router();

// Rate-limit a due strati contro lo spam:
//   - orario: 3 invii/IP/ora (usabilità quotidiana: un utente legittimo
//     compila il form una volta; una PMI con 10 dipendenti resta sotto)
//   - giornaliero: 20 invii/IP/giorno (blocca botnet con rotazione IP lenta,
//     tipica degli spammer che comprano proxy residenziali al giorno).
const contactHourLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://factorymind.example/problems/too-many-requests',
    title: 'Troppe richieste',
    status: 429,
    detail: 'Ha inviato troppi messaggi. Riprovi tra un\'ora.'
  }
});
const contactDayLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  standardHeaders: false,
  legacyHeaders: false,
  message: {
    type: 'https://factorymind.example/problems/too-many-requests',
    title: 'Limite giornaliero superato',
    status: 429,
    detail: 'Limite giornaliero di 20 messaggi per IP superato.'
  }
});

const contactSchema = Joi.object({
  nome: Joi.string().min(2).max(100).required(),
  azienda: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().required(),
  telefono: Joi.string().max(30).allow('').optional(),
  messaggio: Joi.string().min(10).max(3000).required(),
  // R-LANDING-CONSENT-001 (F-MED-LEGAL-006): GDPR consent must be
  // explicit, opt-in, separable from other terms (Reg. UE 2016/679
  // art. 7 + Considerando 32 + 42). Frontend ships an unchecked
  // checkbox; backend rejects submissions where the consent flag
  // isn't strictly true.
  privacy_consent: Joi.boolean().valid(true).required().messages({
    'any.only': 'Il consenso al trattamento dei dati è obbligatorio per la richiesta di demo.',
    'any.required': 'Il consenso al trattamento dei dati è obbligatorio per la richiesta di demo.'
  }),
  // Honeypot: campo invisibile nel form. Se popolato = bot.
  website: Joi.string().max(200).allow('').optional()
}).unknown(false);

function maskEmail(email) {
  const [local, domain] = (email || '').split('@');
  if (!local || !domain) return '[invalid]';
  return `${local.slice(0, 2)}***@${domain}`;
}

async function getTransporter() {
  const smtpUrl = process.env.SMTP_URL;
  if (!smtpUrl) return null;
  // Import dinamico per evitare che nodemailer carichi a boot se non necessario.
   
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport(smtpUrl);
}

router.post('/', contactDayLimiter, contactHourLimiter, async (req, res, next) => {
  try {
    if (process.env.CONTACT_DISABLED === 'true') {
      return res.status(503).json({
        status: 'disabled',
        message: 'Il servizio contatti è temporaneamente disabilitato.'
      });
    }

    const { value, error } = contactSchema.validate(req.body || {}, { stripUnknown: false });
    if (error) {
      return res.status(400).json({
        status: 'invalid',
        message: error.message
      });
    }

    // Honeypot: bot rilevato → fingiamo successo, non inviamo nulla.
    if (value.website && value.website.trim().length > 0) {
      logger.debug({ ip: req.ip }, '[contact] honeypot triggered — silently dropping');
      return res.json({ status: 'ok' });
    }

    const transporter = await getTransporter();
    if (!transporter) {
      logger.warn('[contact] SMTP_URL non configurato — form disabilitato');
      return res.status(503).json({
        status: 'smtp_not_configured',
        message: 'Invio email non disponibile al momento. Scrivici direttamente.'
      });
    }

    const dest = process.env.CONTACT_DEST_EMAIL || 'renan@factorymind.it';
    const from = process.env.CONTACT_FROM_EMAIL || 'no-reply@factorymind.it';

    await transporter.sendMail({
      from,
      to: dest,
      subject: `[FactoryMind landing] Richiesta da ${value.nome} — ${value.azienda}`,
      text: [
        `Nome: ${value.nome}`,
        `Azienda: ${value.azienda}`,
        `Email: ${value.email}`,
        `Telefono: ${value.telefono || '(non fornito)'}`,
        '',
        'Messaggio:',
        value.messaggio,
        '',
        '---',
        `IP origine: ${req.ip}`,
        `User-Agent: ${req.headers['user-agent'] || 'n/d'}`,
        `Ricevuto: ${new Date().toISOString()}`
      ].join('\n'),
      replyTo: value.email
    });

    // Autoreply al mittente — cortesia + conferma ricezione.
    try {
      await transporter.sendMail({
        from,
        to: value.email,
        subject: 'Abbiamo ricevuto la sua richiesta — FactoryMind',
        text: [
          `Buongiorno ${value.nome},`,
          '',
          'grazie per averci contattato. Il suo messaggio è arrivato correttamente e ' +
          'riceverà una risposta entro 24 ore lavorative.',
          '',
          'Nel frattempo può consultare la documentazione del prodotto su ' +
          'https://factorymind.it/docs oppure scaricare un\'attestazione Piano 4.0 di esempio.',
          '',
          'Cordiali saluti,',
          'Renan Macena — FactoryMind',
          'Mozzecane (VR)'
        ].join('\n')
      });
    } catch (err) {
      // L'autoreply non è critico: se fallisce logghiamo e proseguiamo.
      logger.warn({ err: err.message }, '[contact] autoreply non inviato');
    }

    logger.info(
      { email: maskEmail(value.email), azienda: value.azienda, ip: req.ip },
      '[contact] messaggio inoltrato'
    );
    return res.json({ status: 'ok' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
