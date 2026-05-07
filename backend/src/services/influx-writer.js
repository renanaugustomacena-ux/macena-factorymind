/**
 * InfluxDB 2.x writer.
 *
 * Exposes a batched write API plus health probe. Uses the official
 * @influxdata/influxdb-client library; batching is handled at the
 * WriteApi level with explicit flush intervals.
 *
 * Downsampling (1s → 1m → 1h → 1d) is implemented via InfluxDB tasks
 * that are provisioned once at first start; see `bootstrapTasks` below.
 */

'use strict';

const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { OrgsAPI, BucketsAPI, TasksAPI } = require('@influxdata/influxdb-client-apis');

const config = require('../config');
const logger = require('../utils/logger');

const client = new InfluxDB({
  url: config.influx.url,
  token: config.influx.token,
  timeout: 10_000
});

const writeApi = client.getWriteApi(config.influx.org, config.influx.bucket, 'ns', {
  batchSize: 500,
  flushInterval: 1_000,
  maxRetries: 3,
  maxBufferLines: 50_000,
  maxRetryDelay: 15_000,
  minRetryDelay: 1_000,
  retryJitter: 200,
  writeFailed(_error, _lines, _attempt) {
    logger.warn({ attempt: _attempt, lineCount: _lines.length }, '[influx] write batch failed, retrying');
  },
  writeSuccess(lines) {
    logger.debug({ lineCount: lines.length }, '[influx] write batch succeeded');
  }
});

const queryApi = client.getQueryApi(config.influx.org);

/**
 * Ingest a single telemetry sample (one metric, one value).
 */
function writeTelemetry(sample) {
  const { facility, line, machine, metric, value, unit, quality, ts } = sample;
  const point = new Point('telemetry')
    .tag('facility', facility)
    .tag('line', line)
    .tag('machine', machine)
    .tag('metric', metric);
  if (unit) point.tag('unit', unit);
  if (quality !== undefined && quality !== null) point.intField('quality', Number(quality));
  point.floatField('value', Number(value));
  if (ts) point.timestamp(new Date(ts));
  writeApi.writePoint(point);
}

/**
 * Ingest a machine-status transition (RUN/IDLE/DOWN).
 */
function writeStatus({ facility, line, machine, state, reasonCode, ts }) {
  const point = new Point('status')
    .tag('facility', facility)
    .tag('line', line)
    .tag('machine', machine)
    .tag('state', state)
    .stringField('reason_code', reasonCode || 'none');
  if (ts) point.timestamp(new Date(ts));
  writeApi.writePoint(point);
}

/**
 * Ingest an alarm event.
 */
function writeAlarm({ facility, line, machine, code, severity, message, ts }) {
  const point = new Point('alarm')
    .tag('facility', facility)
    .tag('line', line)
    .tag('machine', machine)
    .tag('code', code)
    .tag('severity', severity || 'warning')
    .stringField('message', message || '');
  if (ts) point.timestamp(new Date(ts));
  writeApi.writePoint(point);
}

/**
 * Ingest a counter snapshot (Good / Total / Reject counts).
 */
function writeCounters({ facility, line, machine, good, reject, total, ts }) {
  const point = new Point('counters')
    .tag('facility', facility)
    .tag('line', line)
    .tag('machine', machine)
    .intField('good', good | 0)
    .intField('reject', reject | 0)
    .intField('total', total | 0);
  if (ts) point.timestamp(new Date(ts));
  writeApi.writePoint(point);
}

/**
 * Explicit flush. Called on shutdown and can be called mid-flight for
 * deterministic end-to-end testing.
 */
async function flush() {
  try {
    await writeApi.flush(true);
  } catch (err) {
    logger.warn({ err: err.message }, '[influx] flush error');
  }
}

async function close() {
  try {
    await writeApi.close();
    logger.info('[influx] write API closed');
  } catch (err) {
    logger.error({ err }, '[influx] error closing writer');
  }
}

/**
 * InfluxDB liveness probe.
 *
 * The v1.x `@influxdata/influxdb-client` class does not expose a `.ping()`
 * method on the root client (the API was removed / never exposed). We probe
 * the official `/health` endpoint directly over HTTP — transport-agnostic
 * and independent of client-library version drift.
 */
async function ping() {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${config.influx.url.replace(/\/+$/, '')}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    const ok = response.ok && body.status === 'pass';
    return ok
      ? { ok: true, latency_ms: Date.now() - started }
      : { ok: false, latency_ms: Date.now() - started, message: `HTTP ${response.status} ${body.message || ''}`.trim() };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'timeout after 5s' : err.message;
    return { ok: false, latency_ms: Date.now() - started, message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Canonical downsampling task names — must match the `name:` field in each
 * task's `option task = {...}` line below. R-INFLUX-TASK-001 wires
 * `tasksHealth()` and `/api/health` to fail-close if any of these is missing
 * at runtime, so do not rename without coordinating both ends.
 */
const EXPECTED_DOWNSAMPLING_TASKS = Object.freeze([
  'downsample_1m',
  'downsample_1h',
  'downsample_1d'
]);

/**
 * R-INFLUX-TASK-001 — F-MED-DATA-001 closure. Live health probe for the
 * three downsampling tasks. Queries InfluxDB on every call (per-call cost
 * is one /api/v2/tasks GET) so the result is always current truth, not a
 * boot-time snapshot — a task deleted at runtime surfaces as missing on
 * the next /api/health hit.
 *
 * Returns:
 *   { ok: boolean, present: string[], missing: string[], error?: string }
 */
async function tasksHealth() {
  try {
    const orgsApi = new OrgsAPI(client);
    const tasksApi = new TasksAPI(client);
    const orgs = await orgsApi.getOrgs({ org: config.influx.org });
    const orgId = orgs?.orgs?.[0]?.id;
    if (!orgId) {
      return {
        ok: false,
        present: [],
        missing: [...EXPECTED_DOWNSAMPLING_TASKS],
        error: 'org not found'
      };
    }
    const result = await tasksApi.getTasks({ orgID: orgId });
    const presentSet = new Set((result.tasks || []).map((t) => t.name));
    const present = EXPECTED_DOWNSAMPLING_TASKS.filter((n) => presentSet.has(n));
    const missing = EXPECTED_DOWNSAMPLING_TASKS.filter((n) => !presentSet.has(n));
    return { ok: missing.length === 0, present, missing };
  } catch (err) {
    return {
      ok: false,
      present: [],
      missing: [...EXPECTED_DOWNSAMPLING_TASKS],
      error: err.message
    };
  }
}

/**
 * Provision downsampling tasks at startup (idempotent).
 *
 * Three tasks:
 *  - `downsample_1m`: 1 s → 1-minute mean (ran every 1 minute)
 *  - `downsample_1h`: 1 m → 1-hour mean  (ran every 1 hour)
 *  - `downsample_1d`: 1 h → 1-day mean   (ran every 1 day)
 *
 * Each task writes to a separate measurement suffix so the raw stream
 * stays clean and Grafana panels can pick a resolution explicitly.
 *
 * R-INFLUX-TASK-001: after the creation loop, lists the present
 * downsampling tasks and logs their `{name, id}` at INFO so the operator
 * can correlate against the InfluxDB UI / API.
 */
async function bootstrapTasks() {
  try {
    const orgsApi = new OrgsAPI(client);
    const tasksApi = new TasksAPI(client);
    const orgs = await orgsApi.getOrgs({ org: config.influx.org });
    const orgId = orgs?.orgs?.[0]?.id;
    if (!orgId) {
      logger.warn('[influx] unable to locate org — skipping task bootstrap');
      return;
    }

    const existing = await tasksApi.getTasks({ orgID: orgId });
    const existingNames = new Set((existing.tasks || []).map((t) => t.name));

    const tasks = [
      {
        name: 'downsample_1m',
        flux: `option task = {name: "downsample_1m", every: 1m}
from(bucket: "${config.influx.bucket}")
  |> range(start: -2m)
  |> filter(fn: (r) => r._measurement == "telemetry")
  |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
  |> set(key: "_measurement", value: "telemetry_1m")
  |> to(bucket: "${config.influx.bucket}")`
      },
      {
        name: 'downsample_1h',
        flux: `option task = {name: "downsample_1h", every: 1h}
from(bucket: "${config.influx.bucket}")
  |> range(start: -2h)
  |> filter(fn: (r) => r._measurement == "telemetry_1m")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
  |> set(key: "_measurement", value: "telemetry_1h")
  |> to(bucket: "${config.influx.bucket}")`
      },
      {
        name: 'downsample_1d',
        flux: `option task = {name: "downsample_1d", every: 1d}
from(bucket: "${config.influx.bucket}")
  |> range(start: -2d)
  |> filter(fn: (r) => r._measurement == "telemetry_1h")
  |> aggregateWindow(every: 1d, fn: mean, createEmpty: false)
  |> set(key: "_measurement", value: "telemetry_1d")
  |> to(bucket: "${config.influx.bucket}")`
      }
    ];

    for (const task of tasks) {
      if (existingNames.has(task.name)) continue;
      try {
        await tasksApi.postTasks({ body: { orgID: orgId, flux: task.flux } });
        logger.info({ task: task.name }, '[influx] downsampling task created');
      } catch (err) {
        logger.warn({ task: task.name, err: err.message }, '[influx] failed to create task');
      }
    }

    // R-INFLUX-TASK-001: re-list after creation and log task IDs at INFO.
    const refreshed = await tasksApi.getTasks({ orgID: orgId });
    const taskInfo = (refreshed.tasks || [])
      .filter((t) => EXPECTED_DOWNSAMPLING_TASKS.includes(t.name))
      .map((t) => ({ name: t.name, id: t.id, status: t.status }));
    logger.info(
      {
        tasks: taskInfo,
        expected: EXPECTED_DOWNSAMPLING_TASKS,
        present_count: taskInfo.length
      },
      '[influx] downsampling tasks bootstrap complete'
    );

    // Ensure the target bucket exists (noop if pre-provisioned by influxdb env).
    const bucketsApi = new BucketsAPI(client);
    await bucketsApi.getBuckets({ orgID: orgId, name: config.influx.bucket }).catch(() => undefined);
  } catch (err) {
    logger.warn({ err: err.message }, '[influx] bootstrapTasks failed — continuing');
  }
}

module.exports = {
  writeTelemetry,
  writeStatus,
  writeAlarm,
  writeCounters,
  flush,
  close,
  ping,
  bootstrapTasks,
  tasksHealth,
  EXPECTED_DOWNSAMPLING_TASKS,
  queryApi
};
