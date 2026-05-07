/**
 * R-CONTACT-ESCAPE-001 — closes F-HIGH-005.
 * The contact route uses nodemailer's `text` field only (no `html`), so
 * user input is delivered as plain text and cannot become an XSS or
 * template-injection vector in the recipient's email client. This test
 * locks that property in: re-introducing an `html:` field in the
 * sendMail call without escaping fails the suite.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROUTE = path.resolve(__dirname, '../src/routes/contact.js');

describe('contact route email body (R-CONTACT-ESCAPE-001)', () => {
  let source;

  beforeAll(() => {
    source = fs.readFileSync(ROUTE, 'utf8');
  });

  it('does not pass an `html:` field to nodemailer', () => {
    // Allow the literal token in comments; check sendMail call sites only.
    const sendMailCalls = source.match(/sendMail\s*\(\s*\{[\s\S]*?\}\s*\)/g) || [];
    expect(sendMailCalls.length).toBeGreaterThan(0);
    for (const call of sendMailCalls) {
      expect(call).not.toMatch(/^\s*html\s*:/m);
    }
  });

  it('sendMail calls include a `text:` body', () => {
    const sendMailCalls = source.match(/sendMail\s*\(\s*\{[\s\S]*?\}\s*\)/g) || [];
    for (const call of sendMailCalls) {
      expect(call).toMatch(/^\s*text\s*:/m);
    }
  });

  it('honeypot field is processed before sendMail', () => {
    // Spam protection invariant — the `website` honeypot short-circuits
    // before email delivery. If a refactor moves it after, automated
    // bots flood the mailbox.
    const honeypotIdx = source.indexOf('honeypot');
    const sendMailIdx = source.indexOf('sendMail');
    expect(honeypotIdx).toBeGreaterThan(0);
    expect(honeypotIdx).toBeLessThan(sendMailIdx);
  });
});
