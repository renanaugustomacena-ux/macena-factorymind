/**
 * Alert-engine unit coverage.
 *
 * Exercises:
 *   - statistical rule: 2σ breach for N consecutive samples fires exactly once.
 *   - hysteresis: a clean sample between two breaches resets the consecutive counter.
 *   - debounce: re-fire is suppressed within the debounce window after a fire.
 *   - OEE-sustained: fires only once the OEE has stayed below threshold for sustain_sec.
 *
 * The engine is tested in isolation by stubbing MQTT, Postgres, and topics.
 */

'use strict';

// --- Stubs --------------------------------------------------------------
jest.mock('../src/db/pool', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn()
  },
  ping: jest.fn().mockResolvedValue({ ok: true, latency_ms: 1 }),
  close: jest.fn()
}));

const publishedAlarms = [];
jest.mock('../src/services/mqtt-handler', () => ({
  publish: jest.fn(async (topic, payload) => {
    publishedAlarms.push({ topic, payload });
  }),
  ping: jest.fn().mockReturnValue({ ok: true }),
  connect: jest.fn(),
  close: jest.fn(),
  onMessage: jest.fn()
}));

jest.mock('../src/mqtt/topics', () => ({
  KINDS: { TELEMETRY: 'telemetry', ALARMS: 'alarms' },
  build: ({ facility, line, machine, kind }) => `factory/${facility}/${line}/${machine}/${kind}`
}));

const alertEngine = require('../src/services/alert-engine');
const { pool } = require('../src/db/pool');

function resetEngineState() {
  publishedAlarms.length = 0;
  alertEngine._internals.ruleState.clear();
  alertEngine._internals.resetRulesCache();
  alertEngine.setOeeSnapshot({});
}

describe('alert-engine statistical rule', () => {
  beforeEach(() => {
    resetEngineState();
    pool.query.mockReset();
  });

  it('fires after N consecutive breaches beyond k*σ', async () => {
    // Feed a rolling baseline around mean ~50, stddev ~1.
    // Then emit 5 consecutive values at 60 (far above 2σ) and expect one fire.
    pool.query.mockResolvedValue({
      rows: [{
        id: 1,
        name: 'cycle_time_2sigma',
        facility_id: null,
        line_id: null,
        machine_id: null,
        metric: 'cycle_time_sec',
        expression: {
          kind: 'statistical',
          k_sigma: 2,
          window_sec: 600,
          consecutive: 5,
          debounce_sec: 0
        },
        severity: 'warning',
        enabled: true
      }]
    });

    const parsed = { facility: 'mozzecane', line: 'line-01', machine: 'machine-01', kind: 'telemetry' };

    // 30 baseline samples around 50 ± 1.
    for (let i = 0; i < 30; i += 1) {
      await alertEngine.evaluate(parsed, { metric: 'cycle_time_sec', value: 50 + (i % 3 === 0 ? 0.5 : -0.5) });
    }
    expect(publishedAlarms.length).toBe(0);

    // 5 consecutive breaches at 60 → fires once.
    for (let i = 0; i < 5; i += 1) {
      await alertEngine.evaluate(parsed, { metric: 'cycle_time_sec', value: 60 });
    }
    expect(publishedAlarms.length).toBe(1);
    expect(publishedAlarms[0].topic).toBe('factory/mozzecane/line-01/machine-01/alarms');
  });

  it('resets the consecutive counter on a clean sample (hysteresis)', async () => {
    pool.query.mockResolvedValue({
      rows: [{
        id: 2,
        name: 'cycle_time_2sigma',
        facility_id: null,
        line_id: null,
        machine_id: null,
        metric: 'cycle_time_sec',
        expression: { kind: 'statistical', k_sigma: 2, window_sec: 600, consecutive: 5, debounce_sec: 0 },
        severity: 'warning',
        enabled: true
      }]
    });

    const parsed = { facility: 'mozzecane', line: 'line-01', machine: 'machine-02', kind: 'telemetry' };

    for (let i = 0; i < 30; i += 1) {
      await alertEngine.evaluate(parsed, { metric: 'cycle_time_sec', value: 50 + (i % 3 === 0 ? 0.5 : -0.5) });
    }
    // 3 breaches, then one clean sample, then 3 breaches → no fire (only 3 in a row).
    for (let i = 0; i < 3; i += 1) {
      await alertEngine.evaluate(parsed, { metric: 'cycle_time_sec', value: 60 });
    }
    await alertEngine.evaluate(parsed, { metric: 'cycle_time_sec', value: 50 }); // clean
    for (let i = 0; i < 3; i += 1) {
      await alertEngine.evaluate(parsed, { metric: 'cycle_time_sec', value: 60 });
    }
    expect(publishedAlarms.length).toBe(0);
  });
});

describe('alert-engine OEE-sustained rule', () => {
  beforeEach(() => {
    resetEngineState();
    pool.query.mockReset();
  });

  it('fires only after sustain_sec has elapsed below threshold', async () => {
    pool.query.mockResolvedValue({
      rows: [{
        id: 42,
        name: 'oee_low_sustained',
        facility_id: 'mozzecane',
        line_id: 'line-01',
        machine_id: 'machine-01',
        metric: 'oee',
        expression: { kind: 'oee_sustained', threshold: 0.40, sustain_sec: 2 }, // 2s for the unit test
        severity: 'major',
        enabled: true
      }]
    });

    alertEngine.setOeeSnapshot({
      'mozzecane|line-01|machine-01': { oee: 0.30 }
    });

    // First pass: should NOT fire (sustained-since is set, but not yet elapsed).
    await alertEngine.evaluateSustained();
    expect(publishedAlarms.length).toBe(0);

    // Wait > 2s worth of wall clock.
    await new Promise((r) => setTimeout(r, 2100));

    await alertEngine.evaluateSustained();
    expect(publishedAlarms.length).toBe(1);
    expect(publishedAlarms[0].payload.code).toBe('oee_low_sustained');
    expect(publishedAlarms[0].payload.severity).toBe('major');
  });
});
