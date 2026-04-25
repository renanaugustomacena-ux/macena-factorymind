/**
 * Predictive maintenance — placeholder interface.
 *
 * The production implementation is a two-tier model:
 *   1. A rolling-statistics anomaly detector (z-score / EWMA) runs in-process
 *      for sub-second detection of sensor drift.
 *   2. A batch-trained ML degradation model (gradient-boosted trees over a
 *      feature set assembled from the last 90 days of 1-minute downsampled
 *      telemetry) produces a Remaining Useful Life (RUL) estimate per asset,
 *      refreshed every 6 hours and exposed via `/api/devices/:id/rul`.
 *
 * For the template, this module exposes the interface the rest of the system
 * expects, with a simple EWMA implementation for the in-process tier and a
 * stub for the ML tier.
 */

'use strict';

const logger = require('../utils/logger');

const seriesState = new Map(); // key -> { mean, variance, count }

/**
 * Update EWMA for a given series and return a z-score.
 * Alpha of 0.05 approximates a 20-sample time-constant.
 */
function ingest(key, value, alpha = 0.05) {
  const s = seriesState.get(key) || { mean: value, variance: 0, count: 0 };
  const diff = value - s.mean;
  const newMean = s.mean + alpha * diff;
  const newVar = (1 - alpha) * (s.variance + alpha * diff * diff);
  s.mean = newMean;
  s.variance = newVar;
  s.count += 1;
  seriesState.set(key, s);
  const std = Math.sqrt(newVar);
  return std > 0 ? (value - newMean) / std : 0;
}

function anomalous(key, value, threshold = 3) {
  if (!Number.isFinite(value)) return false;
  const z = ingest(key, value);
  return Math.abs(z) >= threshold;
}

/**
 * Stub: return an RUL estimate in hours. Real implementation uses xgboost or
 * scikit-survival trained on labelled failure history.
 */
async function estimateRUL(_deviceId) {
  logger.debug({ deviceId: _deviceId }, '[pdm] RUL estimate requested — returning placeholder');
  return { device_id: _deviceId, rul_hours_p50: null, rul_hours_p90: null, model_version: 'stub-0.1' };
}

function reset() {
  seriesState.clear();
}

module.exports = { ingest, anomalous, estimateRUL, reset };
