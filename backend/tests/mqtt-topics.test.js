/**
 * R-MQTT-TOPIC-VALIDATION-001 — F-MED-DATA-004 closure regression.
 *
 * Locks down the canonical topic grammar:
 *   factory/{facility}/{line}/{machine}/(telemetry|status|alarms|counters|commands)
 *   per-segment: lower-case alphanumeric + hyphen, 1–32 chars.
 *
 * The 32-char ceiling and lower-case constraint are part of cardinality
 * control (R-INFLUX-CARDINALITY-AUDIT-001 covers the ongoing scrutiny);
 * `counters` was previously absent from KIND_VALUES, so any payload from a
 * counter producer would silently fail `parse()`.
 */

'use strict';

const topics = require('../src/mqtt/topics');

describe('KIND_VALUES (R-MQTT-TOPIC-VALIDATION-001)', () => {
  it('includes the five canonical kinds', () => {
    expect([...topics.KIND_VALUES].sort()).toEqual(
      ['alarms', 'commands', 'counters', 'status', 'telemetry'].sort()
    );
  });

  it('exposes counters in KINDS (was absent pre-fix)', () => {
    expect(topics.KINDS.COUNTERS).toBe('counters');
  });
});

describe('CANONICAL_TOPIC_REGEX', () => {
  const goodTopics = [
    'factory/mozzecane/linea1/cnc01/telemetry',
    'factory/mozzecane/linea1/cnc01/status',
    'factory/mozzecane/linea1/cnc01/alarms',
    'factory/mozzecane/linea1/cnc01/counters',
    'factory/mozzecane/linea1/cnc01/commands',
    'factory/x/y/z/telemetry',
    'factory/a-b-c/d-e-f/g-h-i/telemetry',
    'factory/12345678901234567890123456789012/y/z/telemetry'
  ];

  const badTopics = [
    'factory/Mozzecane/linea1/cnc01/telemetry',
    'factory/mozzecane/linea1/cnc01/UNKNOWN',
    'factory/mozzecane/linea1/cnc01/',
    'factory/mozzecane/linea1/cnc01',
    'factory/mozzecane/linea1/cnc01/telemetry/extra',
    'factory//linea1/cnc01/telemetry',
    'spBv1.0/group/NDATA/edge/dev',
    'factory/mozzecane/linea1/cnc01/Telemetry',
    'factory/mozzecane/linea1/cnc01/telemetria',
    'factory/123456789012345678901234567890123/y/z/telemetry',
    'factory/has space/linea1/cnc01/telemetry',
    'factory/has_underscore/linea1/cnc01/telemetry',
    'factory/has.dot/linea1/cnc01/telemetry'
  ];

  for (const t of goodTopics) {
    it(`accepts: ${t}`, () => expect(topics.validate(t)).toBe(true));
  }

  for (const t of badTopics) {
    it(`rejects: ${t}`, () => expect(topics.validate(t)).toBe(false));
  }

  it('rejects non-strings (number, null, undefined, object)', () => {
    expect(topics.validate(42)).toBe(false);
    expect(topics.validate(null)).toBe(false);
    expect(topics.validate(undefined)).toBe(false);
    expect(topics.validate({})).toBe(false);
  });
});

describe('parse()', () => {
  it('round-trips each canonical kind', () => {
    for (const kind of topics.KIND_VALUES) {
      const t = `factory/x/y/z/${kind}`;
      expect(topics.parse(t)).toEqual({
        root: 'factory', facility: 'x', line: 'y', machine: 'z', kind
      });
    }
  });

  it('returns null for invalid topics', () => {
    expect(topics.parse('factory/X/y/z/telemetry')).toBeNull();
    expect(topics.parse('factory/x/y/z/unknown')).toBeNull();
    expect(topics.parse('garbage')).toBeNull();
  });
});

describe('build()', () => {
  it('builds canonical topics that pass validate()', () => {
    for (const kind of topics.KIND_VALUES) {
      const t = topics.build({ facility: 'mozzecane', line: 'linea1', machine: 'cnc01', kind });
      expect(topics.validate(t)).toBe(true);
    }
  });

  it('throws on invalid kind', () => {
    expect(() =>
      topics.build({ facility: 'x', line: 'y', machine: 'z', kind: 'invalid' })
    ).toThrow(/invalid kind/);
  });

  it('throws on facility/line/machine that violates per-segment regex', () => {
    expect(() =>
      topics.build({ facility: 'A', line: 'y', machine: 'z', kind: 'telemetry' })
    ).toThrow(/invalid facility/);
    expect(() =>
      topics.build({ facility: 'x', line: 'has_underscore', machine: 'z', kind: 'telemetry' })
    ).toThrow(/invalid line/);
    expect(() =>
      topics.build({
        facility: 'x',
        line: 'y',
        machine: 'a'.repeat(33),
        kind: 'telemetry'
      })
    ).toThrow(/invalid machine/);
  });
});

describe('iot-simulator topic compatibility (forward-canonical)', () => {
  // The default simulator emits these literals (per
  // iot-simulator/simulator.js:111-127 and config.sample.json):
  //   facility = 'mozzecane' (CLI default), line_id = 'line-NN', machine = 'machine-NN'.
  // These are the actual production-like topics the test must accept
  // verbatim — no .toLowerCase() shim, since shimming the input in the
  // test would mask a regression where the simulator's source values
  // diverged from the canonical regex (advisor catch).
  const simulatorTopics = [
    'factory/mozzecane/line-01/machine-01/telemetry',
    'factory/mozzecane/line-01/machine-02/status',
    'factory/mozzecane/line-02/machine-01/alarms'
  ];
  for (const t of simulatorTopics) {
    it(`simulator emits canonical-valid (verbatim): ${t}`, () =>
      expect(topics.validate(t)).toBe(true));
  }
});

describe('subscriptionTopic + matches', () => {
  it('all-wildcards yields factory/+/+/+/#', () => {
    expect(topics.subscriptionTopic({})).toBe('factory/+/+/+/#');
  });

  it('matches with + and #', () => {
    expect(topics.matches('factory/+/+/+/telemetry', 'factory/x/y/z/telemetry')).toBe(true);
    expect(topics.matches('factory/+/+/+/#', 'factory/x/y/z/anything')).toBe(true);
    expect(topics.matches('factory/x/+/+/telemetry', 'factory/y/a/b/telemetry')).toBe(false);
  });
});

describe('ID_REGEX edge cases', () => {
  it('accepts single-char segment', () => {
    expect(topics.validate('factory/x/y/z/telemetry')).toBe(true);
  });

  it('accepts 32-char segment (boundary)', () => {
    const seg = 'a'.repeat(32);
    expect(topics.validate(`factory/${seg}/${seg}/${seg}/telemetry`)).toBe(true);
  });

  it('rejects 33-char segment (over boundary)', () => {
    const seg = 'a'.repeat(33);
    expect(topics.validate(`factory/${seg}/y/z/telemetry`)).toBe(false);
  });

  it('accepts hyphen anywhere in a segment', () => {
    expect(topics.validate('factory/a-b-c/d/e/telemetry')).toBe(true);
  });
});
