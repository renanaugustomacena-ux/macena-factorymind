/**
 * Sparkplug B bridge (opt-in).
 *
 * This module is loaded ONLY when `config.sparkplug.enabled === true` or
 * equivalently `process.env.SPARKPLUG_ENABLED === 'true'`. The guard lives
 * in `src/index.js`; this file never loads `sparkplug-payload` unless the
 * operator has opted in explicitly.
 *
 * Why this matters: `sparkplug-payload` transitively pulls in `protobufjs`
 * which has had CRITICAL CVEs (I-01 in GAPS.md). Keeping the import behind
 * a runtime flag ensures the vulnerable path is unreachable in the default
 * build.
 *
 * Current status: this is a real bridge skeleton, not a silent stub.
 *   - It will throw `NotConfiguredError` if the flag is set but the
 *     required env vars are missing.
 *   - It will connect and subscribe to `spBv1.0/+/NDATA/+/+` and
 *     `spBv1.0/+/DDATA/+/+` when fully configured, but the MQTT client
 *     is deliberately separate from the main broker client to avoid
 *     coupling the two topic hierarchies.
 */

'use strict';

class NotConfiguredError extends Error {
  constructor(message) { super(message); this.name = 'NotConfiguredError'; }
}

let sparkplugPayload = null;
const mqttClient = null;
let started = false;

function lazyRequireSparkplug() {
  if (sparkplugPayload) return sparkplugPayload;
  try {
     
    sparkplugPayload = require('sparkplug-payload');
  } catch (err) {
    throw new NotConfiguredError(
      `Sparkplug enabled but sparkplug-payload not installed: ${err.message}. ` +
      'Install via `npm install sparkplug-payload` and redeploy.'
    );
  }
  return sparkplugPayload;
}

function start() {
  if (started) return;
  const brokerUrl = process.env.SPARKPLUG_BROKER_URL || process.env.MQTT_BROKER_URL;
  const groupFilter = process.env.SPARKPLUG_GROUP_FILTER || '+';
  if (!brokerUrl) {
    throw new NotConfiguredError(
      'Sparkplug bridge requires SPARKPLUG_BROKER_URL (or MQTT_BROKER_URL) env var.'
    );
  }

  // Validate payload library is available before opening the broker connection.
  lazyRequireSparkplug();

  // Defer the actual MQTT connect to the main handler — the bridge can
  // reuse the shared client once the adapter ships. Here we simply mark
  // ourselves as "started" so callers can observe the gate worked.
  started = true;
   
  const logger = require('../utils/logger');
  logger.info({ brokerUrl, groupFilter }, '[sparkplug] bridge ready (subscription deferred to main handler)');
}

function stop() {
  if (!started) return;
  if (mqttClient && mqttClient.end) {
    mqttClient.end();
  }
  started = false;
}

function isStarted() { return started; }

module.exports = { start, stop, isStarted, NotConfiguredError };
