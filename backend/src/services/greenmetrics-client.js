/**
 * GreenMetrics client — Piano Transizione 5.0 energy-saving verification.
 *
 * Piano 5.0 (D.L. 19/2024, attuato dal DM 24/07/2024) ties the tax credit
 * amount to *documented* energy savings, computed as
 *     risparmio% = (baseline_kWh - monitored_kWh) / baseline_kWh
 * on comparable production volumes.
 *
 * This client:
 *   1. Discovers the energy-meter service via DNS-SD (_greenmetrics._tcp).
 *   2. Fetches /api/v1/energy/baseline and /api/v1/energy/monitored.
 *   3. Computes risparmio%.
 *
 * If discovery fails, or the env var GREENMETRICS_URL is unset AND
 * GREENMETRICS_REQUIRED is "true", we raise `NotConfiguredError`. By default
 * (Piano 5.0 opt-in) the client returns a structured { ok: false, reason }
 * so the caller can decide whether to treat it as a hard failure.
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

class NotConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotConfiguredError';
  }
}

async function discoverEndpoint() {
  const explicit = process.env.GREENMETRICS_URL;
  if (explicit) return explicit;
  // Best-effort DNS-SD via Node's built-in `dns` — Node doesn't ship an
  // mDNS resolver by default so we look up an A record for a conventional
  // name first, then return null.
  try {
     
    const dns = require('dns').promises;
    const records = await dns.resolveSrv('_greenmetrics._tcp.local').catch(() => []);
    if (records && records.length > 0) {
      const { name, port } = records[0];
      return `http://${name}:${port}`;
    }
  } catch {
    // no-op
  }
  return null;
}

function fetchJson(endpoint, path) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(path, endpoint); } catch (err) { return reject(err); }
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request({
      method: 'GET',
      host: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + (url.search || ''),
      timeout: 5_000,
      headers: { 'User-Agent': 'factorymind-greenmetrics', Accept: 'application/json' }
    }, (res) => {
      let buf = '';
      res.on('data', (chunk) => { buf += chunk.toString('utf8'); });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { return resolve(JSON.parse(buf)); } catch (err) { return reject(err); }
        }
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

/**
 * Compute Piano 5.0 risparmio% for a given facility/line over a window.
 *
 * @param {{facility_id: string, line_id: string, window_days?: number}} params
 * @returns {Promise<{ok: boolean, risparmio_pct?: number, baseline_kwh?: number,
 *                    monitored_kwh?: number, reason?: string}>}
 */
async function computeRisparmio(params) {
  const endpoint = await discoverEndpoint();
  if (!endpoint) {
    if (process.env.GREENMETRICS_REQUIRED === 'true') {
      throw new NotConfiguredError(
        'Piano 5.0 requires GREENMETRICS_URL env or DNS-SD _greenmetrics._tcp.local service. None found.'
      );
    }
    return { ok: false, reason: 'greenmetrics_endpoint_not_discovered' };
  }
  const windowDays = params.window_days || 30;
  try {
    const [baseline, monitored] = await Promise.all([
      fetchJson(endpoint, `/api/v1/energy/baseline?facility_id=${encodeURIComponent(params.facility_id)}&line_id=${encodeURIComponent(params.line_id)}&window_days=${windowDays}`),
      fetchJson(endpoint, `/api/v1/energy/monitored?facility_id=${encodeURIComponent(params.facility_id)}&line_id=${encodeURIComponent(params.line_id)}&window_days=${windowDays}`)
    ]);
    const baselineKwh = Number(baseline?.kwh || baseline?.total_kwh || 0);
    const monitoredKwh = Number(monitored?.kwh || monitored?.total_kwh || 0);
    if (!Number.isFinite(baselineKwh) || baselineKwh <= 0) {
      return { ok: false, reason: 'baseline_kwh_invalid_or_zero' };
    }
    const risparmio = (baselineKwh - monitoredKwh) / baselineKwh;
    return {
      ok: true,
      baseline_kwh: baselineKwh,
      monitored_kwh: monitoredKwh,
      risparmio_pct: Math.round(risparmio * 10000) / 100, // two decimals
      window_days: windowDays,
      endpoint
    };
  } catch (err) {
    return { ok: false, reason: `greenmetrics_fetch_failed: ${err.message}` };
  }
}

module.exports = { computeRisparmio, NotConfiguredError };
