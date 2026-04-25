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
  const [pgState, influxState] = await Promise.all([pg.ping(), influx.ping()]);
  const mqttState = mqtt.ping();

  const dependencies = {
    postgres: pgState,
    influxdb: influxState,
    mosquitto: mqttState
  };

  const allOk = pgState.ok && influxState.ok && mqttState.ok;

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
