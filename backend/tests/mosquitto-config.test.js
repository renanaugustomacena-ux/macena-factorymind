/**
 * R-MQTT-ANON-001 — closes F-CRIT-001 (Mosquitto allow_anonymous true).
 * Asserts mosquitto.conf disables anonymous, points at the passwd file,
 * and references the per-user ACL. Doctrine R-3 (no security-gate
 * masking) extended to broker config: a `# allow_anonymous true` comment
 * is fine, but no executable line may set it to true.
 *
 * Integration coverage (boots the compose stack and verifies that
 * `mosquitto_sub -h localhost` without credentials is refused) lives in
 * `tests/integration/mosquitto-no-anon.sh`; that script runs in CI on a
 * dedicated job (R-CI-INTEGRATION-001 in [`docs/UPLIFT.md`](../docs/UPLIFT.md)).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CONF = path.resolve(__dirname, '../../mosquitto/config/mosquitto.conf');
const ACL = path.resolve(__dirname, '../../mosquitto/config/acl');

function executableLines(text) {
  return text
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l && !/^\s*#/.test(l));
}

describe('mosquitto.conf (R-MQTT-ANON-001)', () => {
  let conf;
  let confLines;

  beforeAll(() => {
    conf = fs.readFileSync(CONF, 'utf8');
    confLines = executableLines(conf);
  });

  it('declares allow_anonymous false', () => {
    const anon = confLines.filter((l) => /^\s*allow_anonymous\b/.test(l));
    expect(anon.length).toBe(1);
    expect(anon[0]).toMatch(/allow_anonymous\s+false/);
  });

  it('has no executable allow_anonymous true line', () => {
    const offenders = confLines.filter((l) => /allow_anonymous\s+true/.test(l));
    expect(offenders).toEqual([]);
  });

  it('configures password_file', () => {
    const pwd = confLines.filter((l) => /^\s*password_file\b/.test(l));
    expect(pwd.length).toBe(1);
    expect(pwd[0]).toMatch(/password_file\s+\/mosquitto\/config\/passwd/);
  });

  it('configures acl_file', () => {
    const acl = confLines.filter((l) => /^\s*acl_file\b/.test(l));
    expect(acl.length).toBe(1);
    expect(acl[0]).toMatch(/acl_file\s+\/mosquitto\/config\/acl/);
  });

  it('ACL grants the canonical "backend" privileged user', () => {
    const aclText = fs.readFileSync(ACL, 'utf8');
    expect(aclText).toMatch(/^\s*user\s+backend\s*$/m);
    expect(aclText).toMatch(/^\s*topic\s+readwrite\s+factory\/#/m);
  });

  // R-MQTT-TLS-001 (F-CRIT-002).
  describe('TLS listener 8883 (R-MQTT-TLS-001)', () => {
    it('declares listener 8883', () => {
      expect(confLines.some((l) => /^\s*listener\s+8883\b/.test(l))).toBe(true);
    });

    it('points cafile / certfile / keyfile at /mosquitto/certs', () => {
      const ca = confLines.find((l) => /^\s*cafile\s+/.test(l));
      const crt = confLines.find((l) => /^\s*certfile\s+/.test(l));
      const key = confLines.find((l) => /^\s*keyfile\s+/.test(l));
      expect(ca).toMatch(/\/mosquitto\/certs\/ca\.crt/);
      expect(crt).toMatch(/\/mosquitto\/certs\/server\.crt/);
      expect(key).toMatch(/\/mosquitto\/certs\/server\.key/);
    });

    it('pins TLS to v1.2 minimum', () => {
      expect(confLines.some((l) => /^\s*tls_version\s+tlsv1\.2/.test(l))).toBe(true);
    });
  });
});
