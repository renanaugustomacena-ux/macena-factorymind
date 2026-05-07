/**
 * R-LANDING-CONSENT-001 — closes F-MED-LEGAL-006.
 *
 * GDPR consent on the contact form is required, separable, and
 * opt-in (Reg. UE 2016/679 art. 7). The Joi schema must reject any
 * submission where `privacy_consent` is missing, false, or non-true.
 * This regression locks the schema-level guard so a future refactor
 * cannot silently make the consent optional.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Joi = require('joi');

const ROUTE = path.resolve(__dirname, '../src/routes/contact.js');

describe('contact route privacy consent (R-LANDING-CONSENT-001)', () => {
  let source;

  beforeAll(() => {
    source = fs.readFileSync(ROUTE, 'utf8');
  });

  it('Joi schema declares privacy_consent as required boolean strictly true', () => {
    expect(source).toMatch(
      /privacy_consent\s*:\s*Joi\.boolean\(\)\s*\.valid\(true\)\s*\.required\(\)/
    );
  });

  it('schema does not allow privacy_consent to be optional', () => {
    expect(source).not.toMatch(/privacy_consent\s*:\s*Joi\.boolean\(\)[^,]*\.optional\(\)/);
  });

  it('Joi rule rejects payloads without privacy_consent', () => {
    const schema = Joi.object({
      privacy_consent: Joi.boolean().valid(true).required()
    });
    const { error } = schema.validate({}, { stripUnknown: false });
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/privacy_consent/);
  });

  it('Joi rule rejects privacy_consent === false', () => {
    const schema = Joi.object({
      privacy_consent: Joi.boolean().valid(true).required()
    });
    const { error } = schema.validate({ privacy_consent: false });
    expect(error).toBeTruthy();
  });

  it('Joi rule accepts privacy_consent === true', () => {
    const schema = Joi.object({
      privacy_consent: Joi.boolean().valid(true).required()
    });
    const { error, value } = schema.validate({ privacy_consent: true });
    expect(error).toBeFalsy();
    expect(value.privacy_consent).toBe(true);
  });
});
