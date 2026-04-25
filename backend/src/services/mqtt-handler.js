/**
 * MQTT handler — connects to the broker, subscribes to the canonical topic
 * hierarchy, and dispatches incoming messages to the appropriate downstream
 * (InfluxDB writer, alert engine, WebSocket fan-out).
 */

'use strict';

const mqtt = require('mqtt');
const config = require('../config');
const logger = require('../utils/logger');
const topics = require('../mqtt/topics');
const influx = require('./influx-writer');

let client = null;
let connected = false;
const listeners = new Set();

/**
 * Register a listener that receives parsed MQTT messages.
 * Listeners are called for every inbound message regardless of kind.
 *
 * @param {(message: { topic: string, parsed: object, payload: object }) => void} fn
 * @returns {() => void} unsubscribe
 */
function onMessage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(message) {
  for (const fn of listeners) {
    try {
      fn(message);
    } catch (err) {
      logger.error({ err: err.message }, '[mqtt] listener error');
    }
  }
}

function parsePayload(buffer) {
  const text = buffer.toString('utf8');
  try {
    return { ok: true, payload: JSON.parse(text) };
  } catch (err) {
    return { ok: false, payload: null, error: err.message, raw: text };
  }
}

function handleTelemetry(parsed, payload) {
  const { facility, line, machine } = parsed;
  if (payload == null) return;
  const samples = Array.isArray(payload) ? payload : [payload];
  for (const s of samples) {
    if (typeof s !== 'object' || s === null) continue;
    if (s.metric === undefined || s.value === undefined) continue;
    influx.writeTelemetry({
      facility,
      line,
      machine,
      metric: String(s.metric),
      value: Number(s.value),
      unit: s.unit ? String(s.unit) : undefined,
      quality: s.quality,
      ts: s.ts
    });
  }
}

function handleStatus(parsed, payload) {
  const { facility, line, machine } = parsed;
  if (typeof payload?.state !== 'string') return;
  influx.writeStatus({
    facility,
    line,
    machine,
    state: payload.state,
    reasonCode: payload.reason_code || payload.reasonCode,
    ts: payload.ts
  });
}

function handleAlarm(parsed, payload) {
  const { facility, line, machine } = parsed;
  if (typeof payload !== 'object' || payload === null) return;
  influx.writeAlarm({
    facility,
    line,
    machine,
    code: String(payload.code || 'UNKNOWN'),
    severity: payload.severity || 'warning',
    message: payload.message || '',
    ts: payload.ts
  });
}

async function connect() {
  if (client) return client;

  const clientOptions = {
    clientId: config.mqtt.clientId,
    keepalive: config.mqtt.keepAlive,
    reconnectPeriod: config.mqtt.reconnectPeriod,
    connectTimeout: 10_000,
    clean: true,
    queueQoSZero: false,
    protocolVersion: 4,
    resubscribe: true
  };
  if (config.mqtt.username) {
    clientOptions.username = config.mqtt.username;
    clientOptions.password = config.mqtt.password;
  }

  client = mqtt.connect(config.mqtt.url, clientOptions);

  client.on('connect', () => {
    connected = true;
    logger.info({ broker: config.mqtt.url }, '[mqtt] connected');
    // Subscribe to all factory traffic using a single wildcard subscription.
    const subject = `${topics.TOPIC_ROOT}/+/+/+/+`;
    client.subscribe(subject, { qos: config.mqtt.qos.alarms }, (err, granted) => {
      if (err) {
        logger.error({ err: err.message }, '[mqtt] subscribe failed');
        return;
      }
      logger.info({ granted }, '[mqtt] subscription active');
    });
  });

  client.on('reconnect', () => {
    logger.warn('[mqtt] reconnecting');
  });

  client.on('offline', () => {
    connected = false;
    logger.warn('[mqtt] offline');
  });

  client.on('close', () => {
    connected = false;
    logger.info('[mqtt] connection closed');
  });

  client.on('error', (err) => {
    logger.error({ err: err.message }, '[mqtt] client error');
  });

  client.on('message', (topic, buffer) => {
    const parsed = topics.parse(topic);
    if (!parsed) return;
    const { ok, payload, error } = parsePayload(buffer);
    if (!ok) {
      logger.warn({ topic, error }, '[mqtt] non-JSON payload discarded');
      return;
    }
    switch (parsed.kind) {
      case topics.KINDS.TELEMETRY:
        handleTelemetry(parsed, payload);
        break;
      case topics.KINDS.STATUS:
        handleStatus(parsed, payload);
        break;
      case topics.KINDS.ALARMS:
        handleAlarm(parsed, payload);
        break;
      default:
        // commands come back from the server → downstream fan-out only.
        break;
    }
    emit({ topic, parsed, payload });
  });

  return client;
}

async function publish(topic, payload, { qos = 0, retain = false } = {}) {
  if (!client || !connected) {
    throw new Error('MQTT client not connected');
  }
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    client.publish(topic, body, { qos, retain }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function close() {
  return new Promise((resolve) => {
    if (!client) return resolve();
    client.end(false, {}, () => {
      logger.info('[mqtt] client ended');
      resolve();
    });
  });
}

function ping() {
  const ok = !!(client && connected);
  return { ok, latency_ms: 0, message: ok ? undefined : 'not connected' };
}

module.exports = {
  connect,
  close,
  publish,
  onMessage,
  ping
};
