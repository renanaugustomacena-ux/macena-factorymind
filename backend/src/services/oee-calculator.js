/**
 * OEE calculator.
 *
 * OEE = Availability × Performance × Quality
 *
 *   Availability  = Operating Time / Planned Production Time
 *   Performance   = (Ideal Cycle Time × Total Count) / Operating Time
 *   Quality       = Good Count / Total Count
 *
 * References:
 *   - SEMI E10 — semiconductor equipment metrics standard
 *   - VDI 2884 — availability, performance, quality indices
 *   - "World Class OEE" threshold: ≥ 85 %
 *   - Industry average: ~ 60 %
 *   - FactoryMind initial target baseline: ≥ 50 %
 *
 * Input parameters use seconds for times and integer counts.
 */

'use strict';

/**
 * @param {object} params
 * @param {number} params.plannedProductionTimeSec   total seconds in the planned shift minus planned stops
 * @param {number} params.downtimeSec                total unplanned stoppage within the planned window
 * @param {number} params.idealCycleTimeSec          target cycle time per unit under nominal conditions
 * @param {number} params.totalCount                 units produced (good + reject)
 * @param {number} params.goodCount                  units accepted as first-pass good
 * @returns {{
 *   availability: number,
 *   performance: number,
 *   quality: number,
 *   oee: number,
 *   operating_time_sec: number,
 *   planned_time_sec: number,
 *   downtime_sec: number,
 *   total_count: number,
 *   good_count: number,
 *   reject_count: number,
 *   cycle_time_actual_sec: number,
 *   classification: 'world-class'|'above-average'|'average'|'below-target'|'zero-production'|'insufficient-data'
 * }}
 *
 * Classification semantics:
 *   - 'insufficient-data' : dati di configurazione mancanti (ideal cycle time
 *                           non definito o tempo pianificato nullo)
 *   - 'zero-production'   : configurazione completa ma nessuna unità prodotta
 *                           nel periodo (macchina ferma per tutto il turno)
 *   - 'below-target'      : OEE < 0.50
 *   - 'average'           : 0.50 <= OEE < 0.60
 *   - 'above-average'     : 0.60 <= OEE < 0.85
 *   - 'world-class'       : OEE >= 0.85
 */
function computeOEE({
  plannedProductionTimeSec,
  downtimeSec,
  idealCycleTimeSec,
  totalCount,
  goodCount
}) {
  const planned = Math.max(0, Number(plannedProductionTimeSec) || 0);
  const downtime = Math.max(0, Math.min(planned, Number(downtimeSec) || 0));
  const total = Math.max(0, Math.floor(Number(totalCount) || 0));
  const good = Math.max(0, Math.min(total, Math.floor(Number(goodCount) || 0)));
  const ideal = Math.max(0, Number(idealCycleTimeSec) || 0);

  const operating = Math.max(0, planned - downtime);

  const availability = planned > 0 ? operating / planned : 0;
  const performance =
    operating > 0 && ideal > 0
      ? Math.min(1, (ideal * total) / operating)
      : 0;
  const quality = total > 0 ? good / total : 0;
  const oee = availability * performance * quality;

  const actualCycle = total > 0 && operating > 0 ? operating / total : 0;

  let classification = 'below-target';
  if (planned === 0 || ideal === 0) {
    // Configurazione mancante: non possiamo interpretare la metrica.
    classification = 'insufficient-data';
  } else if (total === 0) {
    // Configurazione presente ma nessuna produzione registrata.
    classification = 'zero-production';
  } else if (oee >= 0.85) classification = 'world-class';
  else if (oee >= 0.60) classification = 'above-average';
  else if (oee >= 0.50) classification = 'average';

  return {
    availability: Number(availability.toFixed(4)),
    performance: Number(performance.toFixed(4)),
    quality: Number(quality.toFixed(4)),
    oee: Number(oee.toFixed(4)),
    operating_time_sec: operating,
    planned_time_sec: planned,
    downtime_sec: downtime,
    total_count: total,
    good_count: good,
    reject_count: total - good,
    cycle_time_actual_sec: Number(actualCycle.toFixed(3)),
    classification
  };
}

/**
 * Roll up OEE across a group (line, facility) using weighted aggregation.
 * Weighting is by planned_time_sec so that longer-running machines
 * dominate the line average — this matches SEMI E10 practice.
 *
 * @param {Array<ReturnType<typeof computeOEE>>} items
 */
function aggregateOEE(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return computeOEE({
      plannedProductionTimeSec: 0,
      downtimeSec: 0,
      idealCycleTimeSec: 0,
      totalCount: 0,
      goodCount: 0
    });
  }
  let plannedSum = 0;
  let downtimeSum = 0;
  let totalCount = 0;
  let goodCount = 0;
  let cycleNumerator = 0;
  for (const i of items) {
    plannedSum += i.planned_time_sec || 0;
    downtimeSum += i.downtime_sec || 0;
    totalCount += i.total_count || 0;
    goodCount += i.good_count || 0;
    cycleNumerator += (i.cycle_time_actual_sec || 0) * (i.total_count || 0);
  }
  const idealEstimate = totalCount > 0 ? cycleNumerator / totalCount : 0;
  return computeOEE({
    plannedProductionTimeSec: plannedSum,
    downtimeSec: downtimeSum,
    idealCycleTimeSec: idealEstimate,
    totalCount,
    goodCount
  });
}

module.exports = { computeOEE, aggregateOEE };
