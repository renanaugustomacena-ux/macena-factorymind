/**
 * R-OPCUA-VALIDATE-001 — closes F-CRIT-003 (SSRF / metadata pivot).
 * Verifies the OPC UA endpoint allow-list validator rejects every
 * documented attack vector and accepts the canonical PLC hostname.
 */

'use strict';

const { validateOpcuaEndpoint } = require('../src/services/opcua-endpoint-validator');

const ALLOWED = ['plc01.factory.local', 'plc02.factory.local'];

describe('validateOpcuaEndpoint (R-OPCUA-VALIDATE-001)', () => {
  describe('rejects', () => {
    it('empty endpoint', () => {
      expect(validateOpcuaEndpoint('', { allowedHosts: ALLOWED })).toMatchObject({
        ok: false
      });
    });

    it('non-string endpoint', () => {
      expect(validateOpcuaEndpoint(null, { allowedHosts: ALLOWED }).ok).toBe(false);
    });

    it('http scheme', () => {
      expect(
        validateOpcuaEndpoint('http://plc01.factory.local:80/', { allowedHosts: ALLOWED })
      ).toMatchObject({ ok: false, reason: expect.stringMatching(/Schema/i) });
    });

    it('file scheme (config-injection vector)', () => {
      expect(
        validateOpcuaEndpoint('file:///etc/passwd', { allowedHosts: ALLOWED }).ok
      ).toBe(false);
    });

    it('AWS metadata IP literal', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://169.254.169.254:4840/', { allowedHosts: ALLOWED })
      ).toMatchObject({ ok: false, reason: expect.stringMatching(/metadata|link-local|RFC1918/i) });
    });

    it('GCP metadata hostname', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://metadata.google.internal:4840/', { allowedHosts: ALLOWED }).ok
      ).toBe(false);
    });

    it('Alibaba metadata IP literal', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://100.100.100.200:4840/', { allowedHosts: ALLOWED }).ok
      ).toBe(false);
    });

    it('loopback 127.0.0.1', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://127.0.0.1:4840/', { allowedHosts: ALLOWED }).ok
      ).toBe(false);
    });

    it('IPv6 loopback ::1', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://[::1]:4840/', { allowedHosts: ALLOWED }).ok
      ).toBe(false);
    });

    it('localhost hostname', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://localhost:4840/', { allowedHosts: ALLOWED }).ok
      ).toBe(false);
    });

    it('RFC1918 IP literal even when listed in allow-list', () => {
      // Doctrine: allow-list must contain hostnames, not IP literals — the
      // intent should be documented. Accepting `10.0.0.5` directly bypasses
      // the documentation discipline.
      expect(
        validateOpcuaEndpoint('opc.tcp://10.0.0.5:4840/', {
          allowedHosts: ['10.0.0.5']
        }).ok
      ).toBe(false);
    });

    it('host not in allow-list', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://malicious.example.com:4840/', { allowedHosts: ALLOWED })
      ).toMatchObject({ ok: false, reason: expect.stringMatching(/non in OPCUA_ALLOWED_HOSTS/i) });
    });

    it('empty allow-list rejects everything', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://plc01.factory.local:4840/', { allowedHosts: [] }).ok
      ).toBe(false);
    });

    it('malformed URL', () => {
      expect(
        validateOpcuaEndpoint('not a url at all', { allowedHosts: ALLOWED }).ok
      ).toBe(false);
    });
  });

  describe('accepts', () => {
    it('opc.tcp://allowed-host:port/', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://plc01.factory.local:4840/', { allowedHosts: ALLOWED })
      ).toEqual({ ok: true });
    });

    it('opc.tls:// for TLS-protected PLCs', () => {
      expect(
        validateOpcuaEndpoint('opc.tls://plc02.factory.local:4843/Server', { allowedHosts: ALLOWED })
      ).toEqual({ ok: true });
    });

    it('case-insensitive hostname match', () => {
      expect(
        validateOpcuaEndpoint('opc.tcp://PLC01.factory.local:4840/', { allowedHosts: ALLOWED })
      ).toEqual({ ok: true });
    });
  });
});
