/**
 * R-OPCUA-VALIDATE-001 — OPC UA endpoint URL allow-list validator.
 * Closes AUDIT finding F-CRIT-003 (SSRF / metadata pivot via attacker-
 * controlled OPCUA_ENDPOINT).
 *
 * Rules:
 *   1. Scheme MUST be `opc.tcp:` or `opc.tls:`. No `http`, `file`, `data`.
 *   2. Host MUST be present (no relative or implicit-host endpoints).
 *   3. Host MUST NOT be a known cloud metadata service IP literal.
 *   4. Host MUST NOT be loopback or unspecified (`127.0.0.1`, `::1`,
 *      `0.0.0.0`, `[::]`) — operators occasionally bind to these for
 *      testing, but production must hit a real PLC hostname.
 *   5. Host MUST NOT be RFC1918 / link-local IP literal — the operator
 *      must register the hostname in OPCUA_ALLOWED_HOSTS instead so the
 *      intent is documented.
 *   6. Host MUST appear in the `allowedHosts` allow-list (case-insensitive).
 *
 * The validator is pure: no I/O, no DNS. Returns `{ ok: true }` on accept
 * or `{ ok: false, reason }` on reject. The caller (opcua-bridge.js) logs
 * the reason and refuses to start the bridge.
 */

'use strict';

const ALLOWED_SCHEMES = new Set(['opc.tcp:', 'opc.tls:']);

const METADATA_HOSTS = new Set([
  '169.254.169.254',     // AWS / GCP / Azure IMDS v1+v2
  '100.100.100.200',     // Alibaba Cloud
  'fd00:ec2::254',       // AWS IPv6 IMDS
  'metadata.google.internal',
  'metadata.azure.com'
]);

const LOOPBACK_HOSTS = new Set([
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '[::]',
  'localhost'
]);

// IPv4 literals only — `node-opcua` uses IPv4 by default and IPv6 PLCs
// are vanishingly rare on the shop floor (none observed in any FactoryMind
// pilot to date). If an IPv6 PLC is ever encountered, extend this regex.
const IPV4_LITERAL = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const RFC1918_OR_LINK_LOCAL = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^127\./
];

function isIpv4Private(host) {
  if (!IPV4_LITERAL.test(host)) return false;
  return RFC1918_OR_LINK_LOCAL.some((re) => re.test(host));
}

/**
 * @param {string} endpoint  raw URL string (e.g. `opc.tcp://plc01.factory.local:4840`)
 * @param {{ allowedHosts: string[] }} opts
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateOpcuaEndpoint(endpoint, opts) {
  if (!endpoint || typeof endpoint !== 'string') {
    return { ok: false, reason: 'OPCUA_ENDPOINT vuoto o non stringa.' };
  }
  let url;
  try {
    url = new URL(endpoint);
  } catch (_) {
    return { ok: false, reason: `OPCUA_ENDPOINT non parsabile: ${endpoint}` };
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return {
      ok: false,
      reason: `Schema non permesso (${url.protocol}); attesi opc.tcp: o opc.tls:.`
    };
  }
  const host = (url.hostname || '').toLowerCase();
  if (!host) {
    return { ok: false, reason: 'Host mancante in OPCUA_ENDPOINT.' };
  }
  if (METADATA_HOSTS.has(host)) {
    return { ok: false, reason: `Host metadata-service vietato: ${host}` };
  }
  if (LOOPBACK_HOSTS.has(host)) {
    return { ok: false, reason: `Host loopback / unspecified vietato: ${host}` };
  }
  if (isIpv4Private(host)) {
    return {
      ok: false,
      reason: `Host RFC1918 / link-local vietato come IP literal: ${host}. Registrare un hostname in OPCUA_ALLOWED_HOSTS.`
    };
  }
  const allowed = (opts && opts.allowedHosts) || [];
  if (allowed.length === 0) {
    return { ok: false, reason: 'OPCUA_ALLOWED_HOSTS vuoto: nessun host permesso.' };
  }
  const allowedLower = allowed.map((h) => h.toLowerCase());
  if (!allowedLower.includes(host)) {
    return {
      ok: false,
      reason: `Host ${host} non in OPCUA_ALLOWED_HOSTS (${allowedLower.join(', ')}).`
    };
  }
  return { ok: true };
}

module.exports = { validateOpcuaEndpoint };
