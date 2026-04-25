/**
 * Piano Transizione 4.0 attestazione generator — unit tests.
 *
 * Checks the decision logic for the 5 caratteristiche tecnologiche and the
 * 2 caratteristiche di interconnessione, plus the overall eligibility verdict.
 */

'use strict';

const {
  generateAttestazione,
  CHARACTERISTICS,
  INTERCONNECTION
} = require('../src/services/piano4-attestazione');

describe('Piano 4.0 attestazione — constants', () => {
  it('defines exactly 5 caratteristiche tecnologiche', () => {
    expect(CHARACTERISTICS).toHaveLength(5);
  });
  it('defines 3 possible caratteristiche di interconnessione', () => {
    expect(INTERCONNECTION).toHaveLength(3);
    expect(INTERCONNECTION.filter((i) => i.mandatory)).toHaveLength(1);
  });
});

describe('Piano 4.0 attestazione — eligibility verdict', () => {
  const mkDevice = (overrides = {}) => ({
    facility_id: 'mozzecane',
    line_id: 'line-01',
    machine_id: 'machine-01',
    vendor: 'Mazak',
    model: 'Quick Turn 250',
    protocol: 'opcua',
    acquisition_year: 2024,
    acquisition_value_eur: 185_000,
    ...overrides
  });

  it('awards eligibility when all 5 chars + I1 + ≥1 other I are satisfied', () => {
    const { eligibility, report } = generateAttestazione({
      device: mkDevice(),
      commandEvents: [{ ts: 1 }, { ts: 2 }],
      integrationEvents: [{ ts: 3 }],
      alarmEvents: [],
      predictiveEvents: [{ ts: 4 }]
    });
    expect(eligibility).toBe(true);
    expect(report.eligibility.eligible).toBe(true);
    expect(report.characteristics.every((c) => c.satisfied)).toBe(true);
    expect(report.interconnection.find((i) => i.mandatory).satisfied).toBe(true);
  });

  it('denies eligibility when the protocol is not industrial-standard', () => {
    const { eligibility, report } = generateAttestazione({
      device: mkDevice({ protocol: 'proprietary-serial' }),
      commandEvents: [{ ts: 1 }]
    });
    expect(eligibility).toBe(false);
    expect(report.characteristics.find((c) => c.id === 'C1_CNC_PLC').satisfied).toBe(false);
  });

  it('denies eligibility when remote program-load never happened and no predictive events', () => {
    const { eligibility, report } = generateAttestazione({
      device: mkDevice(),
      commandEvents: [],
      integrationEvents: [{ ts: 1 }],
      predictiveEvents: []
    });
    // Without any commandEvents, C2_INTERCONNECTION_REMOTE_PROGRAM_LOAD fails
    // AND I2 + I3 of interconnection fail. Both conditions yield ineligible;
    // verify the report surfaces at least one unsatisfied item.
    expect(eligibility).toBe(false);
    const unsatisfiedChars = report.characteristics.filter((c) => !c.satisfied);
    const unsatisfiedInterconnect = report.interconnection.filter((i) => !i.satisfied);
    expect(unsatisfiedChars.length + unsatisfiedInterconnect.length).toBeGreaterThan(0);
    expect(unsatisfiedChars.map((c) => c.id)).toContain('C2_INTERCONNECTION_REMOTE_PROGRAM_LOAD');
  });

  it('emits legal basis references in the report envelope', () => {
    const { report } = generateAttestazione({
      device: mkDevice(),
      commandEvents: [{ ts: 1 }],
      predictiveEvents: [{ ts: 1 }]
    });
    expect(report.legal_basis).toEqual(expect.arrayContaining([
      expect.stringMatching(/L\. 232\/2016/),
      expect.stringMatching(/4\/E/),
      expect.stringMatching(/9\/E/)
    ]));
  });
});
