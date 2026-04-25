/**
 * GET /api/ready
 *
 * Readiness probe — distinct from liveness (/api/health). Returns 200 ONLY
 * when every downstream dependency has been verified reachable AT LEAST
 * ONCE since process start AND is currently healthy.
 *
 * Kubernetes uses this to gate traffic to new pods; Envoy / NGINX use it
 * to pull a backend out of the pool if dependencies flap without killing
 * the pod (which liveness would).
 *
 * Contract per v2.0 Section 13 (readiness semantics):
 *   - Postgres: one successful SELECT 1 required.
 *   - Mosquitto: one successful connect event required.
 *   - InfluxDB: one successful ping required.
 */

'use strict';

const { Router } = require('express');
const pkg = require('../../package.json');
const pg = require('../db/pool');
const influx = require('../services/influx-writer');
const mqtt = require('../services/mqtt-handler');

const router = Router();
const STARTED_AT = Date.now();

// "High water mark" — once a dependency has been seen healthy, we remember
// that; readiness still requires current health but the boot-time guarantee
// is that we never return ready before every dep has been verified at least
// once.
const firstSeenHealthy = {
  postgres: false,
  influxdb: false,
  mosquitto: false
};

router.get('/', async (_req, res) => {
  const [pgState, influxState] = await Promise.all([pg.ping(), influx.ping()]);
  const mqttState = mqtt.ping();

  if (pgState.ok) firstSeenHealthy.postgres = true;
  if (influxState.ok) firstSeenHealthy.influxdb = true;
  if (mqttState.ok) firstSeenHealthy.mosquitto = true;

  const allPrimed =
    firstSeenHealthy.postgres && firstSeenHealthy.influxdb && firstSeenHealthy.mosquitto;
  const allHealthy = pgState.ok && influxState.ok && mqttState.ok;
  const ready = allPrimed && allHealthy;

  const body = {
    status: ready ? 'ready' : 'not-ready',
    service: 'factorymind-backend',
    version: pkg.version,
    uptime_seconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    time: new Date().toISOString(),
    checks: {
      postgres: {
        ok: pgState.ok,
        primed: firstSeenHealthy.postgres,
        latency_ms: pgState.latency_ms,
        message: pgState.message
      },
      influxdb: {
        ok: influxState.ok,
        primed: firstSeenHealthy.influxdb,
        latency_ms: influxState.latency_ms,
        message: influxState.message
      },
      mosquitto: {
        ok: mqttState.ok,
        primed: firstSeenHealthy.mosquitto,
        message: mqttState.message
      }
    }
  };

  if (!ready) {
    res.set('Content-Type', 'application/problem+json; charset=utf-8');
    return res.status(503).json({
      type: 'https://factorymind.example/problems/not-ready',
      title: 'Service not ready',
      status: 503,
      detail: 'One or more dependencies are unavailable or not yet primed',
      instance: '/api/ready',
      ...body
    });
  }

  return res.status(200).json(body);
});

module.exports = router;
