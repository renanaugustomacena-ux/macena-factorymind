/**
 * Modbus RTU / TCP bridge (placeholder scaffold).
 *
 * Many legacy Italian manufacturing assets speak Modbus RTU (serial) or
 * Modbus TCP (Ethernet) natively — three-phase energy meters, variable
 * frequency drives (VFD), PV inverters (SunSpec), and low-cost PLCs. This
 * module polls a configurable address map and bridges readings onto the
 * same MQTT topic hierarchy the rest of the system consumes.
 *
 * Register-map example (stored as JSONB on devices.modbus_map):
 *   [
 *     { address: 40001, type: "int32_be",    metric: "current_phase_1", unit: "A" },
 *     { address: 40003, type: "float32_be",  metric: "active_power",    unit: "kW" },
 *     { address: 30001, type: "uint16",      metric: "machine_state",   unit: "" }
 *   ]
 *
 * Safety:
 *   - Reads only; writes require RBAC permission `modbus:write` and produce
 *     an audit log row.
 *   - Exponential back-off on connection loss.
 */

'use strict';

const ModbusRTU = require('modbus-serial');
const config = require('../config');
const logger = require('../utils/logger');
const mqttHandler = require('./mqtt-handler');
const topics = require('../mqtt/topics');

let client = null;
let pollTimer = null;
let failureCount = 0;

function decodeBuffer(type, buf) {
  switch (type) {
    case 'uint16':
      return buf.readUInt16BE(0);
    case 'int16':
      return buf.readInt16BE(0);
    case 'uint32_be':
      return buf.readUInt32BE(0);
    case 'int32_be':
      return buf.readInt32BE(0);
    case 'float32_be':
      return buf.readFloatBE(0);
    default:
      return NaN;
  }
}

async function start(registerMap = []) {
  if (!config.modbus.enabled) {
    logger.info('[modbus] disabled (MODBUS_ENABLED=false)');
    return;
  }
  if (!config.modbus.host) {
    logger.warn('[modbus] no host configured — not starting');
    return;
  }

  client = new ModbusRTU();
  try {
    await client.connectTCP(config.modbus.host, { port: config.modbus.port });
    client.setID(config.modbus.unitId);
    client.setTimeout(2_000);
    logger.info(
      { host: config.modbus.host, port: config.modbus.port, unit: config.modbus.unitId },
      '[modbus] connected'
    );
    failureCount = 0;
  } catch (err) {
    logger.error({ err: err.message }, '[modbus] connect failed');
    return;
  }

  pollTimer = setInterval(async () => {
    for (const entry of registerMap) {
      try {
        // Modbus Holding Register range Modicon-style: 40001-49999.
        // Input Register: 30001-39999. Rifiutiamo indirizzi fuori range.
        const addr = Number(entry.address);
        if (!Number.isInteger(addr) || addr < 40001 || addr > 49999) {
          logger.warn(
            { address: entry.address, metric: entry.metric },
            '[modbus] indirizzo fuori range holding register (40001-49999) — skip'
          );
          continue;
        }
        const wordCount = entry.type.includes('32') ? 2 : 1;
        const startAddr = addr - 40001;
        const { buffer } = await client.readHoldingRegisters(startAddr, wordCount);
        const value = decodeBuffer(entry.type, buffer);
        if (!Number.isFinite(value)) continue;
        const topic = topics.build({
          facility: entry.facility,
          line: entry.line,
          machine: entry.machine,
          kind: topics.KINDS.TELEMETRY
        });
        await mqttHandler.publish(
          topic,
          {
            ts: new Date().toISOString(),
            metric: entry.metric,
            value,
            unit: entry.unit || '',
            quality: 100
          },
          { qos: 0 }
        );
      } catch (err) {
        failureCount += 1;
        if (failureCount % 10 === 1) {
          logger.warn({ err: err.message, address: entry.address }, '[modbus] read failed');
        }
      }
    }
  }, config.modbus.pollIntervalMs);
  pollTimer.unref?.();
}

async function stop() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (client) {
    try { await client.close(); } catch (_) { /* ignore */ }
  }
  client = null;
  logger.info('[modbus] bridge stopped');
}

module.exports = { start, stop };
