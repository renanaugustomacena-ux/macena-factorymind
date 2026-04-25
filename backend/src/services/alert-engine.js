/**
 * Alert engine.
 *
 * Evaluates rules stored in PostgreSQL against incoming MQTT telemetry
 * plus short-window InfluxDB aggregates. Fires events on breach, tracks
 * state in the `alerts` table, escalates on timeout, and publishes
 * both an MQTT alarm topic and an internal WebSocket event.
 *
 * Rule expression language (stored as JSONB).
 *
 * Three rule kinds are supported:
 *
 *   (a) "threshold" — compare instantaneous value against a fixed threshold.
 *     {"kind":"threshold","operator":">=","threshold":85,"hysteresis":2,"debounce_sec":15}
 *
 *   (b) "statistical" — fires when value exceeds mean ± k*σ for N consecutive
 *       samples (rolling baseline over `window_sec` seconds).
 *     {"kind":"statistical","k_sigma":2,"window_sec":300,"consecutive":5}
 *
 *   (c) "oee_sustained" — fires when the machine-rolled OEE stays below
 *       `threshold` for `sustain_sec` consecutive seconds. Evaluated on a 1Hz
 *       timer against the last computed OEE snapshot from InfluxDB.
 *     {"kind":"oee_sustained","threshold":0.40,"sustain_sec":600}
 *
 * All kinds support hysteresis, debounce_sec, and dedup via the state key
 * `(rule_id, facility, line, machine)`.
 *
 * The engine is a pure in-memory dispatcher; persistence is delegated to
 * PostgreSQL so that multiple backend replicas can coexist (classical
 * leader-follower election via advisory lock is suggested for HA — see
 * docs/ARCHITECTURE.md for deployment guidance).
 */

'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const pgPool = require('../db/pool').pool;
const mqttHandler = require('./mqtt-handler');
const topics = require('../mqtt/topics');

const ruleState = new Map(); // key -> { lastFireTs, debouncedUntilTs, breachCount, samples: [], lastTouchedTs }

// Bound massimo sul numero di chiavi attive. Protegge da crescita incontrollata
// in ambienti con cardinalità alta (molte regole × molte macchine). Oltre il
// bound, la chiave meno recentemente toccata viene eliminata (LRU approssimato).
const RULE_STATE_MAX_KEYS = 10_000;
// TTL per chiavi non aggiornate: se una regola/macchina smette di ricevere
// campioni per più di 24 ore, lo stato in memoria viene scartato.
const RULE_STATE_TTL_MS = 24 * 60 * 60 * 1000;
// Intervallo di pulizia periodica.
const RULE_STATE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function key(rule, parsed) {
  return `${rule.id}|${parsed.facility}|${parsed.line}|${parsed.machine}`;
}

function touchState(k, state) {
  state.lastTouchedTs = Date.now();
  ruleState.set(k, state);
  // Eviction se sforiamo il bound: rimuovo la chiave più vecchia per lastTouchedTs.
  if (ruleState.size > RULE_STATE_MAX_KEYS) {
    let oldestKey = null;
    let oldestTs = Infinity;
    for (const [kk, ss] of ruleState) {
      const ts = ss.lastTouchedTs || 0;
      if (ts < oldestTs) { oldestTs = ts; oldestKey = kk; }
    }
    if (oldestKey) ruleState.delete(oldestKey);
  }
}

function pruneStaleState() {
  const cutoff = Date.now() - RULE_STATE_TTL_MS;
  let removed = 0;
  for (const [k, s] of ruleState) {
    if ((s.lastTouchedTs || 0) < cutoff) {
      ruleState.delete(k);
      removed += 1;
    }
  }
  if (removed > 0) {
    logger.debug({ removed, remaining: ruleState.size }, '[alerts] ruleState TTL cleanup');
  }
}

/**
 * Rolling statistics over a sample window. Stored per (rule,facility,line,machine).
 * O(window_sec) memory per key; pruned on each sample so bounded over time.
 */
function pushSample(state, windowSec, value, ts) {
  state.samples = state.samples || [];
  state.samples.push({ value: Number(value), ts: ts || Date.now() });
  const cutoff = (ts || Date.now()) - windowSec * 1000;
  while (state.samples.length > 0 && state.samples[0].ts < cutoff) state.samples.shift();
}

function statsFor(state) {
  const xs = (state.samples || []).map((s) => s.value).filter((v) => Number.isFinite(v));
  if (xs.length < 2) return { mean: NaN, sigma: NaN, n: xs.length };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return { mean, sigma: Math.sqrt(variance), n: xs.length };
}

function evaluateThreshold(rule, value) {
  const { operator, threshold, hysteresis = 0 } = rule.expression;
  switch (operator) {
    case '>=':
      return value >= threshold + hysteresis;
    case '<=':
      return value <= threshold - hysteresis;
    case '==':
      return value === threshold;
    case '>':
      return value > threshold + hysteresis;
    case '<':
      return value < threshold - hysteresis;
    case 'between': {
      const [lo, hi] = rule.expression.range || [];
      return value >= lo && value <= hi;
    }
    default:
      return false;
  }
}

let rulesCache = [];
let rulesCacheTs = 0;
const RULES_CACHE_TTL_MS = 15_000;

async function loadRules() {
  const now = Date.now();
  if (now - rulesCacheTs < RULES_CACHE_TTL_MS) return rulesCache;
  try {
    const { rows } = await pgPool.query(
      `SELECT id, name, facility_id, line_id, machine_id, metric, expression, severity, enabled
       FROM alert_rules WHERE enabled = TRUE`
    );
    rulesCache = rows;
    rulesCacheTs = now;
  } catch (err) {
    logger.error({ err: err.message }, '[alerts] failed to load rules');
  }
  return rulesCache;
}

function applies(rule, parsed, metric) {
  if (rule.facility_id && rule.facility_id !== parsed.facility) return false;
  if (rule.line_id && rule.line_id !== parsed.line) return false;
  if (rule.machine_id && rule.machine_id !== parsed.machine) return false;
  if (rule.metric && rule.metric !== metric) return false;
  return true;
}

async function fireAlert({ rule, parsed, sample }) {
  const topic = topics.build({
    facility: parsed.facility,
    line: parsed.line,
    machine: parsed.machine,
    kind: topics.KINDS.ALARMS
  });
  const payload = {
    ts: new Date().toISOString(),
    code: rule.name,
    severity: rule.severity || 'warning',
    message: `Rule ${rule.name} breached: ${sample.metric}=${sample.value}`,
    rule_id: rule.id,
    metric: sample.metric,
    value: sample.value
  };
  try {
    await mqttHandler.publish(topic, payload, { qos: config.mqtt.qos.alarms });
  } catch (err) {
    logger.warn({ err: err.message }, '[alerts] failed to publish MQTT alarm');
  }
  try {
    await pgPool.query(
      `INSERT INTO alerts (rule_id, facility_id, line_id, machine_id, metric, value, severity, message, fired_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'open')`,
      [
        rule.id,
        parsed.facility,
        parsed.line,
        parsed.machine,
        sample.metric,
        sample.value,
        rule.severity || 'warning',
        payload.message
      ]
    );
  } catch (err) {
    logger.warn({ err: err.message }, '[alerts] failed to persist alert');
  }
  logger.info(
    { rule: rule.name, machine: parsed.machine, value: sample.value, severity: rule.severity },
    '[alerts] rule fired'
  );
}

async function evaluate(parsed, sample) {
  if (typeof sample?.value !== 'number' || !sample.metric) return;
  const rules = await loadRules();
  for (const rule of rules) {
    if (!applies(rule, parsed, sample.metric)) continue;
    const expr = rule.expression || {};

    const k = key(rule, parsed);
    const state = ruleState.get(k) || {
      breachCount: 0,
      lastFireTs: 0,
      debouncedUntilTs: 0,
      samples: [],
      sustainedSince: 0
    };
    const now = Date.now();

    let breached = false;
    try {
      if (expr.kind === 'threshold') {
        breached = evaluateThreshold(rule, sample.value);
      } else if (expr.kind === 'statistical') {
        const windowSec = Number(expr.window_sec) || 300;
        const k_sigma = Number(expr.k_sigma) || 2;
        pushSample(state, windowSec, sample.value, now);
        const { mean, sigma, n } = statsFor(state);
        if (Number.isFinite(sigma) && n >= 10) {
          breached = Math.abs(sample.value - mean) > k_sigma * sigma;
        }
      } else if (expr.kind === 'oee_sustained') {
        // Valutato dal timer evaluateSustained(); qui non facciamo nulla.
        continue;
      } else {
        // Kind sconosciuto — probabile dato corrotto su alert_rules.expression.
        // Logghiamo a WARN con rule_id per triage, ma non interrompiamo il loop.
        logger.warn(
          { rule_id: rule.id, rule_name: rule.name, kind: expr.kind },
          '[alerts] kind regola non riconosciuto — saltata'
        );
        continue;
      }
    } catch (err) {
      logger.error(
        { err: err.message, rule_id: rule.id, rule_name: rule.name },
        '[alerts] errore valutazione regola — saltata'
      );
      continue;
    }

    if (breached) {
      state.breachCount += 1;
      const debounceMs = (expr.debounce_sec || 0) * 1000;
      const required = Number(expr.consecutive) || 1;

      // Debounce: once armed, wait the debounce window before firing.
      if (now < state.debouncedUntilTs) {
        touchState(k, state);
        continue;
      }
      if (debounceMs > 0 && state.breachCount === 1) {
        state.debouncedUntilTs = now + debounceMs;
        touchState(k, state);
        continue;
      }
      // Dedup: require N consecutive breaches before firing.
      if (state.breachCount < required) {
        touchState(k, state);
        continue;
      }
      // Dedup: never re-fire within debounce window after a fire.
      if (debounceMs > 0 && now - state.lastFireTs < debounceMs) {
        touchState(k, state);
        continue;
      }
      state.debouncedUntilTs = 0;
      state.breachCount = 0;
      state.lastFireTs = now;
      touchState(k, state);
      await fireAlert({ rule, parsed, sample });
    } else {
      // Hysteresis: a clean sample resets the breach count but NOT the rolling
      // samples, so the statistical baseline keeps accreting history.
      state.breachCount = 0;
      state.debouncedUntilTs = 0;
      touchState(k, state);
    }
  }
}

/**
 * Evaluate sustained OEE-below-threshold rules on a 1 Hz timer.
 * This complements evaluate() (which is message-driven); sustained rules need
 * time-based evaluation independent of telemetry arrival rate.
 */
async function evaluateSustained() {
  const rules = await loadRules();
  const sustainedRules = rules.filter((r) => r.expression?.kind === 'oee_sustained');
  if (sustainedRules.length === 0) return;
  // Caller provides the OEE snapshot via setOeeSnapshot(); default is empty.
  const snap = _oeeSnapshot;
  for (const rule of sustainedRules) {
    const threshold = Number(rule.expression.threshold) || 0.40;
    const sustainMs = (Number(rule.expression.sustain_sec) || 600) * 1000;
    for (const [snapKey, sample] of Object.entries(snap)) {
      const [facility, line, machine] = snapKey.split('|');
      if (rule.facility_id && rule.facility_id !== facility) continue;
      if (rule.line_id && rule.line_id !== line) continue;
      if (rule.machine_id && rule.machine_id !== machine) continue;
      const k = `${rule.id}|${facility}|${line}|${machine}`;
      const state = ruleState.get(k) || { sustainedSince: 0, lastFireTs: 0 };
      const now = Date.now();
      if (sample.oee < threshold) {
        if (!state.sustainedSince) state.sustainedSince = now;
        if (now - state.sustainedSince >= sustainMs && now - state.lastFireTs >= sustainMs) {
          state.lastFireTs = now;
          touchState(k, state);
          await fireAlert({
            rule,
            parsed: { facility, line, machine, kind: 'telemetry' },
            sample: { metric: 'oee', value: sample.oee }
          });
        } else {
          touchState(k, state);
        }
      } else {
        state.sustainedSince = 0;
        touchState(k, state);
      }
    }
  }
}

let _oeeSnapshot = {};
function setOeeSnapshot(map) {
  _oeeSnapshot = map || {};
}

/**
 * Escalation loop — every ALERT_ESCALATION_INTERVAL_MS, promote alerts that
 * remain open to the next severity tier and re-notify.
 */
let escalationTimer = null;
let sustainedTimer = null;
let cleanupTimer = null;
function start() {
  if (escalationTimer) return;
  mqttHandler.onMessage(({ parsed, payload }) => {
    if (!parsed || parsed.kind !== topics.KINDS.TELEMETRY) return;
    const samples = Array.isArray(payload) ? payload : [payload];
    for (const s of samples) {
      evaluate(parsed, s).catch((err) =>
        logger.error({ err: err.message }, '[alerts] evaluate error')
      );
    }
  });
  sustainedTimer = setInterval(() => {
    evaluateSustained().catch((err) =>
      logger.warn({ err: err.message }, '[alerts] sustained-rule pass failed')
    );
  }, 1000);
  sustainedTimer.unref?.();
  escalationTimer = setInterval(async () => {
    try {
      await pgPool.query(
        `UPDATE alerts
         SET severity = CASE severity
           WHEN 'warning' THEN 'major'
           WHEN 'major' THEN 'critical'
           ELSE severity
         END,
         escalated_at = NOW()
         WHERE status = 'open'
           AND (escalated_at IS NULL OR escalated_at < NOW() - INTERVAL '${Math.floor(config.alerts.escalationIntervalMs / 1000)} seconds')`
      );
    } catch (err) {
      logger.warn({ err: err.message }, '[alerts] escalation pass failed');
    }
  }, config.alerts.escalationIntervalMs);
  escalationTimer.unref?.();
  // Cleanup periodico delle chiavi ruleState non toccate oltre il TTL.
  // Previene memory leak su cardinalità alta regole × macchine.
  cleanupTimer = setInterval(() => {
    try { pruneStaleState(); }
    catch (err) { logger.warn({ err: err.message }, '[alerts] pruneStaleState failed'); }
  }, RULE_STATE_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
  logger.info('[alerts] engine started');
}

function stop() {
  if (escalationTimer) {
    clearInterval(escalationTimer);
    escalationTimer = null;
  }
  if (sustainedTimer) {
    clearInterval(sustainedTimer);
    sustainedTimer = null;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  ruleState.clear();
  logger.info('[alerts] engine stopped');
}

function _resetRulesCache() {
  rulesCache = [];
  rulesCacheTs = 0;
}

module.exports = {
  start,
  stop,
  evaluate,
  evaluateSustained,
  setOeeSnapshot,
  loadRules,
  // exported for testing:
  _internals: {
    ruleState,
    pushSample,
    statsFor,
    resetRulesCache: _resetRulesCache,
    pruneStaleState,
    RULE_STATE_MAX_KEYS,
    RULE_STATE_TTL_MS
  }
};
