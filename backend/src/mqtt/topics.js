/**
 * Canonical MQTT topic builders and parsers for FactoryMind.
 *
 * Topic taxonomy:
 *   factory/{facility_id}/{line_id}/{machine_id}/telemetry
 *   factory/{facility_id}/{line_id}/{machine_id}/alarms
 *   factory/{facility_id}/{line_id}/{machine_id}/commands
 *   factory/{facility_id}/{line_id}/{machine_id}/status
 *
 * Payload standard (JSON):
 *   { ts: ISO-8601, metric: string, value: number, unit: string, quality: 0..100 }
 *
 * Sparkplug B compatibility notes
 * -------------------------------
 * When Sparkplug B is required for interoperability with Ignition, AVEVA, or
 * any other mainstream Sparkplug consumer, the broker runs both topic
 * hierarchies in parallel. Sparkplug topics take the canonical form:
 *   spBv1.0/{group_id}/{message_type}/{edge_node_id}/{device_id}
 * where message_type ∈ {NBIRTH, NDEATH, NDATA, NCMD, DBIRTH, DDEATH, DDATA, DCMD, STATE}.
 * We map FactoryMind's facility→group, line+machine→edge_node+device; payloads
 * are encoded with the Eclipse Tahu protobuf schema (sparkplug-payload npm module).
 * A separate `sparkplug-bridge` worker can be added later to translate between
 * JSON topic hierarchy and Sparkplug protobuf in either direction.
 */

'use strict';

const TOPIC_ROOT = 'factory';

const KINDS = Object.freeze({
  TELEMETRY: 'telemetry',
  ALARMS: 'alarms',
  COMMANDS: 'commands',
  STATUS: 'status'
});

const KIND_VALUES = new Set(Object.values(KINDS));

const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/i;

function assertId(name, value) {
  if (typeof value !== 'string' || !ID_REGEX.test(value)) {
    throw new Error(`invalid ${name}: "${value}" — must match /^[a-z0-9][a-z0-9-]{0,62}$/i`);
  }
}

function build({ facility, line, machine, kind }) {
  assertId('facility', facility);
  assertId('line', line);
  assertId('machine', machine);
  if (!KIND_VALUES.has(kind)) {
    throw new Error(`invalid kind: "${kind}" — expected one of ${[...KIND_VALUES].join(', ')}`);
  }
  return `${TOPIC_ROOT}/${facility}/${line}/${machine}/${kind}`;
}

/**
 * Parse a topic string into its structured components.
 * Returns null if the topic does not match the canonical pattern.
 */
function parse(topic) {
  if (typeof topic !== 'string') return null;
  const parts = topic.split('/');
  if (parts.length !== 5) return null;
  const [root, facility, line, machine, kind] = parts;
  if (root !== TOPIC_ROOT) return null;
  if (!KIND_VALUES.has(kind)) return null;
  if (!ID_REGEX.test(facility) || !ID_REGEX.test(line) || !ID_REGEX.test(machine)) return null;
  return { root, facility, line, machine, kind };
}

/**
 * Build a wildcard subscription topic.
 * e.g. subscriptionTopic({ kind: 'telemetry' }) => "factory/+/+/+/telemetry"
 */
function subscriptionTopic({ facility = '+', line = '+', machine = '+', kind }) {
  if (kind === undefined) {
    return `${TOPIC_ROOT}/${facility}/${line}/${machine}/#`;
  }
  if (!KIND_VALUES.has(kind)) {
    throw new Error(`invalid kind: "${kind}"`);
  }
  return `${TOPIC_ROOT}/${facility}/${line}/${machine}/${kind}`;
}

/**
 * Match a concrete topic against a pattern containing MQTT wildcards (+ and #).
 */
function matches(pattern, topic) {
  const pParts = pattern.split('/');
  const tParts = topic.split('/');
  for (let i = 0; i < pParts.length; i += 1) {
    const p = pParts[i];
    if (p === '#') return true;
    if (i >= tParts.length) return false;
    if (p !== '+' && p !== tParts[i]) return false;
  }
  return pParts.length === tParts.length;
}

module.exports = {
  TOPIC_ROOT,
  KINDS,
  KIND_VALUES: [...KIND_VALUES],
  build,
  parse,
  subscriptionTopic,
  matches,
  assertId
};
