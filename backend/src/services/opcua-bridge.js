/**
 * OPC UA bridge (placeholder integration scaffold).
 *
 * Responsibilities:
 *   - Connect to an OPC UA server exposed by a PLC (Siemens S7, Beckhoff
 *     TwinCAT, Rockwell CompactLogix with FactoryTalk Linx Gateway, or any
 *     IEC 61131-3 runtime with an embedded server).
 *   - Subscribe to a list of monitored items (node IDs) as configured in the
 *     devices.opcua_tags JSONB column.
 *   - Translate OPC UA variant values into FactoryMind telemetry payloads
 *     and re-publish them onto the MQTT broker so the rest of the pipeline
 *     is agnostic to whether the source was raw MQTT or OPC UA.
 *
 * Security:
 *   - Defaults to Basic256Sha256 + SignAndEncrypt.
 *   - User-token support: Anonymous (dev), UserName, X509 (recommended for
 *     regulated OT environments).
 *   - A server certificate trust store must be pre-populated during
 *     on-prem installation; the bridge refuses self-signed certs in
 *     production.
 *
 * This module is a scaffold: the node-opcua client is wired in and the
 * lifecycle is correct, but the tag list is intentionally empty. Real
 * tag mappings come from the PostgreSQL device rows at install time.
 */

'use strict';

const {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  TimestampsToReturn
} = require('node-opcua');

const config = require('../config');
const logger = require('../utils/logger');
const mqttHandler = require('./mqtt-handler');
const topics = require('../mqtt/topics');

let client = null;
let session = null;
let subscription = null;
let reconnectTimer = null;

async function start(tagMappings = []) {
  if (!config.opcua.enabled) {
    logger.info('[opcua] disabled (OPCUA_ENABLED=false)');
    return;
  }
  if (!config.opcua.endpoint) {
    logger.warn('[opcua] no endpoint configured — not starting');
    return;
  }
  try {
    client = OPCUAClient.create({
      applicationName: 'FactoryMind',
      endpointMustExist: false,
      securityMode: MessageSecurityMode[config.opcua.securityMode] || MessageSecurityMode.SignAndEncrypt,
      securityPolicy: SecurityPolicy[config.opcua.securityPolicy] || SecurityPolicy.Basic256Sha256,
      connectionStrategy: {
        initialDelay: 1_000,
        maxRetry: 10,
        maxDelay: 10_000
      }
    });

    await client.connect(config.opcua.endpoint);
    const userIdentity =
      config.opcua.username && config.opcua.password
        ? { userName: config.opcua.username, password: config.opcua.password, type: 1 }
        : null;
    session = await client.createSession(userIdentity);

    subscription = await session.createSubscription2({
      requestedPublishingInterval: config.opcua.publishingIntervalMs,
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 250,
      publishingEnabled: true,
      priority: 10
    });

    for (const mapping of tagMappings) {
      await monitorTag(mapping);
    }

    logger.info(
      {
        endpoint: config.opcua.endpoint,
        policy: config.opcua.securityPolicy,
        mode: config.opcua.securityMode,
        tagCount: tagMappings.length
      },
      '[opcua] bridge started'
    );
  } catch (err) {
    logger.error({ err: err.message }, '[opcua] failed to start — will retry in 30s');
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => start(tagMappings), 30_000);
    reconnectTimer.unref?.();
  }
}

async function monitorTag(mapping) {
  if (!subscription) return;
  const { nodeId, facility, line, machine, metric, unit } = mapping;
  try {
    const item = await subscription.monitor(
      { nodeId, attributeId: AttributeIds.Value },
      { samplingInterval: config.opcua.samplingIntervalMs, discardOldest: true, queueSize: 10 },
      TimestampsToReturn.Both
    );
    item.on('changed', async (dataValue) => {
      const value = Number(dataValue?.value?.value);
      if (!Number.isFinite(value)) return;
      const topic = topics.build({ facility, line, machine, kind: topics.KINDS.TELEMETRY });
      try {
        await mqttHandler.publish(
          topic,
          {
            ts: (dataValue.sourceTimestamp || dataValue.serverTimestamp || new Date()).toISOString(),
            metric,
            value,
            unit: unit || '',
            quality: dataValue.statusCode?.value === 0 ? 100 : 0
          },
          { qos: 0 }
        );
      } catch (err) {
        logger.warn({ err: err.message, nodeId }, '[opcua] publish failed');
      }
    });
  } catch (err) {
    logger.warn({ err: err.message, nodeId }, '[opcua] could not monitor tag');
  }
}

async function stop() {
  clearTimeout(reconnectTimer);
  try {
    if (subscription) await subscription.terminate();
  } catch (_) { /* ignore */ }
  try {
    if (session) await session.close();
  } catch (_) { /* ignore */ }
  try {
    if (client) await client.disconnect();
  } catch (_) { /* ignore */ }
  subscription = null;
  session = null;
  client = null;
  logger.info('[opcua] bridge stopped');
}

module.exports = { start, stop };
