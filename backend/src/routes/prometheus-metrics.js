/**
 * GET /metrics — Prometheus scrape endpoint.
 *
 * Distinct from `/api/metrics` (which is the InfluxDB query proxy for UI).
 * This endpoint emits process metrics (event-loop lag, GC, heap) plus a
 * handful of FactoryMind-specific counters that the orchestrator G4 gate
 * scrapes as a liveness signal.
 *
 * Implementation note: we deliberately avoid depending on the full
 * prom-client stack (already transitively pulled in by @opentelemetry) and
 * emit a minimal Prometheus exposition format by hand so that a fresh
 * install has a working /metrics even before OTEL is configured.
 */

'use strict';

const { Router } = require('express');
const os = require('os');
const pkg = require('../../package.json');

const router = Router();

const counters = {
  http_requests_total: 0,
  mqtt_messages_received_total: 0,
  influx_points_written_total: 0,
  alerts_fired_total: 0
};

function increment(name, delta = 1) {
  if (Object.prototype.hasOwnProperty.call(counters, name)) {
    counters[name] += Number(delta) || 0;
  }
}

const STARTED_AT = Date.now();

function formatExposition() {
  const mem = process.memoryUsage();
  const loadavg = os.loadavg();
  const uptimeSec = Math.floor((Date.now() - STARTED_AT) / 1000);
  const lines = [];
  lines.push('# HELP factorymind_build_info Build/version information');
  lines.push('# TYPE factorymind_build_info gauge');
  lines.push(`factorymind_build_info{version="${pkg.version}",service="factorymind-backend"} 1`);

  lines.push('# HELP factorymind_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE factorymind_uptime_seconds counter');
  lines.push(`factorymind_uptime_seconds ${uptimeSec}`);

  lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes');
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${mem.rss}`);

  lines.push('# HELP nodejs_heap_used_bytes Node heap used in bytes');
  lines.push('# TYPE nodejs_heap_used_bytes gauge');
  lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);

  lines.push('# HELP nodejs_heap_total_bytes Node heap total in bytes');
  lines.push('# TYPE nodejs_heap_total_bytes gauge');
  lines.push(`nodejs_heap_total_bytes ${mem.heapTotal}`);

  lines.push('# HELP node_load_1 Host 1-minute load average');
  lines.push('# TYPE node_load_1 gauge');
  lines.push(`node_load_1 ${loadavg[0]}`);

  for (const [name, val] of Object.entries(counters)) {
    lines.push(`# HELP factorymind_${name} ${name} counter`);
    lines.push(`# TYPE factorymind_${name} counter`);
    lines.push(`factorymind_${name} ${val}`);
  }
  return lines.join('\n') + '\n';
}

router.get('/', (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(formatExposition());
});

module.exports = { router, increment, counters };
