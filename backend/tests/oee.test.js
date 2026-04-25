/**
 * OEE calculator — unit coverage of the Availability × Performance × Quality
 * formula and the classification thresholds.
 */

'use strict';

const { computeOEE, aggregateOEE } = require('../src/services/oee-calculator');

describe('computeOEE', () => {
  it('returns zeroes on insufficient data', () => {
    const r = computeOEE({
      plannedProductionTimeSec: 0,
      downtimeSec: 0,
      idealCycleTimeSec: 0,
      totalCount: 0,
      goodCount: 0
    });
    expect(r.oee).toBe(0);
    expect(r.classification).toBe('insufficient-data');
  });

  it('computes a world-class result (≥ 85%)', () => {
    // 8 h shift, 15 min downtime, 18 s cycle, 1500 produced with 1490 good.
    const r = computeOEE({
      plannedProductionTimeSec: 28800,
      downtimeSec: 900,
      idealCycleTimeSec: 18,
      totalCount: 1500,
      goodCount: 1490
    });
    expect(r.availability).toBeGreaterThan(0.95);
    expect(r.quality).toBeCloseTo(0.9933, 3);
    expect(r.oee).toBeGreaterThan(0.85);
    expect(r.classification).toBe('world-class');
  });

  it('clamps performance to a maximum of 1.0', () => {
    // Scenario: total count * ideal cycle > operating time (sensor over-counted)
    const r = computeOEE({
      plannedProductionTimeSec: 3600,
      downtimeSec: 0,
      idealCycleTimeSec: 10,
      totalCount: 10_000,
      goodCount: 9_000
    });
    expect(r.performance).toBeLessThanOrEqual(1);
  });

  it('honours the 50% threshold for the average bucket', () => {
    const r = computeOEE({
      plannedProductionTimeSec: 28800,
      downtimeSec: 4500,
      idealCycleTimeSec: 30,
      totalCount: 600,
      goodCount: 540
    });
    expect(r.oee).toBeGreaterThan(0.45);
    expect(r.oee).toBeLessThan(0.65);
    expect(['average', 'above-average', 'below-target']).toContain(r.classification);
  });

  it('distingue zero-production (configurato ma nessuna unità) da insufficient-data', () => {
    // Macchina con turno pianificato e ideal cycle time configurato,
    // ma totalCount=0 → deve classificare come zero-production, non insufficient-data.
    const r = computeOEE({
      plannedProductionTimeSec: 28800,
      downtimeSec: 0,
      idealCycleTimeSec: 30,
      totalCount: 0,
      goodCount: 0
    });
    expect(r.classification).toBe('zero-production');
    expect(r.oee).toBe(0);
  });

  it('rimane insufficient-data se manca ideal cycle time', () => {
    const r = computeOEE({
      plannedProductionTimeSec: 28800,
      downtimeSec: 0,
      idealCycleTimeSec: 0,   // non configurato
      totalCount: 500,
      goodCount: 500
    });
    expect(r.classification).toBe('insufficient-data');
  });

  it('clamps downtime to planned time', () => {
    const r = computeOEE({
      plannedProductionTimeSec: 3600,
      downtimeSec: 10_000,
      idealCycleTimeSec: 30,
      totalCount: 10,
      goodCount: 10
    });
    expect(r.operating_time_sec).toBe(0);
    expect(r.availability).toBe(0);
  });
});

describe('aggregateOEE', () => {
  it('weights planned time across multiple machines', () => {
    const a = computeOEE({
      plannedProductionTimeSec: 28800,
      downtimeSec: 900,
      idealCycleTimeSec: 18,
      totalCount: 1500,
      goodCount: 1490
    });
    const b = computeOEE({
      plannedProductionTimeSec: 28800,
      downtimeSec: 3000,
      idealCycleTimeSec: 18,
      totalCount: 1200,
      goodCount: 1100
    });
    const agg = aggregateOEE([a, b]);
    expect(agg.planned_time_sec).toBe(57600);
    expect(agg.total_count).toBe(2700);
    expect(agg.good_count).toBe(2590);
    expect(agg.oee).toBeGreaterThan(0);
    expect(agg.oee).toBeLessThan(1);
  });
});
