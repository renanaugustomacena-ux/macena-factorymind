/**
 * Canonical MQTT topic builders, parsers, and validators for FactoryMind.
 *
 * Topic taxonomy v2 (R-MQTT-TOPIC-VALIDATION-001):
 *   factory/{facility_id}/{line_id}/{machine_id}/{kind}
 *   kind ∈ telemetry | status | alarms | counters | commands
 *
 * Per-segment grammar: lower-case alphanumeric or hyphen, 1–32 chars.
 * The 32-char ceiling is part of cardinality control — InfluxDB tag values
 * become time-series identities, and unbounded segment lengths invite
 * cardinality blow-ups (R-INFLUX-CARDINALITY-AUDIT-001 covers ongoing
 * scrutiny). The lower-case constraint matches MQTT topic conventions and
 * eliminates case-folding ambiguity across brokers.
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
 * The `sparkplug-bridge` worker translates between the JSON topic hierarchy
 * and Sparkplug protobuf. Validation here applies to the canonical
 * `factory/...` hierarchy only; Sparkplug topics have their own grammar.
 */

'use strict';

const TOPIC_ROOT = 'factory';

const KINDS = Object.freeze({
  TELEMETRY: 'telemetry',
  STATUS: 'status',
  ALARMS: 'alarms',
  COUNTERS: 'counters',
  COMMANDS: 'commands'
});

const KIND_VALUES = new Set(Object.values(KINDS));

// Per-segment regex (R-MQTT-TOPIC-VALIDATION-001).
// Lower-case alphanumeric or hyphen, 1–32 chars, case-sensitive.
const ID_REGEX = /^[a-z0-9-]{1,32}$/;

// Canonical topic regex — verbatim from the R-MQTT-TOPIC-VALIDATION-001
// spec. Use `validate(topic)` when checking topics received from external
// systems (broker bridges, replay services, simulator).
const CANONICAL_TOPIC_REGEX =
  /^factory\/[a-z0-9-]{1,32}\/[a-z0-9-]{1,32}\/[a-z0-9-]{1,32}\/(telemetry|status|alarms|counters|commands)$/;

function assertId(name, value) {
  if (typeof value !== 'string' || !ID_REGEX.test(value)) {
    throw new Error(`invalid ${name}: "${value}" — must match /^[a-z0-9-]{1,32}$/`);
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
  if (!validate(topic)) return null;
  const parts = topic.split('/');
  const [root, facility, line, machine, kind] = parts;
  return { root, facility, line, machine, kind };
}

/**
 * Validate a topic string against the canonical regex.
 * Strict — does not accept wildcards. For wildcard matching use `matches`.
 */
function validate(topic) {
  return typeof topic === 'string' && CANONICAL_TOPIC_REGEX.test(topic);
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
  ID_REGEX,
  CANONICAL_TOPIC_REGEX,
  build,
  parse,
  validate,
  subscriptionTopic,
  matches,
  assertId
};
