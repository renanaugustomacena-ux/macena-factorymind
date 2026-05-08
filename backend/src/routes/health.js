/**
 * GET /api/health
 *
 * Returns a JSON health envelope exercising every dependency: Postgres,
 * InfluxDB, Mosquitto. Suitable for k8s liveness and Compose healthchecks.
 */

'use strict';

const { Router } = require('express');
const os = require('os');

const pkg = require('../../package.json');
const pg = require('../db/pool');
const influx = require('../services/influx-writer');
const mqtt = require('../services/mqtt-handler');

const router = Router();
const STARTED_AT = Date.now();

router.get('/', async (_req, res) => {
  // R-INFLUX-TASK-001: live tasksHealth() query — returns ok=false if any of
  // the three canonical downsampling tasks is missing (deleted at runtime,
  // never created, etc). Live not cached: a task deleted in InfluxDB UI
  // surfaces on the next health hit.
  const [pgState, influxState, influxTasksState] = await Promise.all([
    pg.ping(),
    influx.ping(),
    influx.tasksHealth()
  ]);
  const mqttState = mqtt.ping();

  const dependencies = {
    postgres: pgState,
    influxdb: influxState,
    influxdb_tasks: influxTasksState,
    mosquitto: mqttState
  };

  const allOk = pgState.ok && influxState.ok && influxTasksState.ok && mqttState.ok;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    service: 'factorymind-backend',
    version: pkg.version,
    uptime_seconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    time: new Date().toISOString(),
    host: os.hostname(),
    dependencies
  });
});

module.exports = router;
