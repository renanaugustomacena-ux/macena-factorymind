#!/usr/bin/env node
/**
 * FactoryMind IoT Simulator.
 *
 * Publishes realistic industrial telemetry onto the Mosquitto broker using
 * the canonical FactoryMind topic hierarchy. Intended for development,
 * training, sales demos, and CI smoke tests.
 *
 * Usage:
 *   node simulator.js                    # defaults from env
 *   node simulator.js --config ./my.json # load machine list from JSON
 *   node simulator.js --lines 3 --machines-per-line 6 --interval 500
 *
 * Telemetry generation is a Gaussian random walk around a configured mean,
 * with state transitions (RUN → IDLE → DOWN) driven by a configurable
 * fault probability.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const mqtt = require('mqtt');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('broker', {
    type: 'string',
    default: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    describe: 'MQTT broker URL'
  })
  .option('username', { type: 'string', default: process.env.MQTT_USERNAME || '' })
  .option('password', { type: 'string', default: process.env.MQTT_PASSWORD || '' })
  .option('facility', { type: 'string', default: process.env.SIM_FACILITY || 'mozzecane' })
  .option('lines', { type: 'number', default: Number(process.env.SIM_LINES || 2) })
  .option('machines-per-line', {
    type: 'number',
    default: Number(process.env.SIM_MACHINES_PER_LINE || 4)
  })
  .option('interval', {
    type: 'number',
    default: Number(process.env.SIM_INTERVAL_MS || 1000),
    describe: 'Publish interval in milliseconds'
  })
  .option('rate', {
    type: 'string',
    describe: 'Human-friendly publish rate: "1hz" | "10hz" | "0.1hz" | "250ms". Overrides --interval when present.'
  })
  .option('fault-probability', {
    type: 'number',
    default: Number(process.env.SIM_FAULT_PROBABILITY || 0.01),
    describe: 'Per-machine probability, per tick, of transitioning into a DOWN state'
  })
  .option('anomaly-probability', {
    type: 'number',
    default: Number(process.env.SIM_ANOMALY_PROBABILITY || 0.003),
    describe: 'Per-machine probability, per tick, of emitting an off-baseline anomaly (spindle over-temp, vibration spike, power surge)'
  })
  .option('config', { type: 'string', describe: 'JSON config file path' })
  .strict()
  .help()
  .argv;

/**
 * Parse "1hz", "10hz", "0.1hz", "250ms", "2s" into milliseconds.
 * Matches the Grafana/InfluxDB convention so demos can request "1hz" verbatim.
 */
function parseRate(s) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  const hzMatch = t.match(/^([0-9]*\.?[0-9]+)\s*hz$/);
  if (hzMatch) {
    const hz = parseFloat(hzMatch[1]);
    if (!Number.isFinite(hz) || hz <= 0) throw new Error(`invalid rate: ${s}`);
    return Math.max(1, Math.round(1000 / hz));
  }
  const msMatch = t.match(/^([0-9]+)\s*ms$/);
  if (msMatch) return Math.max(1, parseInt(msMatch[1], 10));
  const sMatch = t.match(/^([0-9]*\.?[0-9]+)\s*s$/);
  if (sMatch) return Math.max(1, Math.round(parseFloat(sMatch[1]) * 1000));
  throw new Error(`unparseable --rate: ${s}. Use "1hz", "10hz", "250ms", "2s".`);
}

if (argv.rate) {
  argv.interval = parseRate(argv.rate);
}

function randn() {
  // Box–Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function loadConfig() {
  if (argv.config && fs.existsSync(argv.config)) {
    const full = path.resolve(argv.config);
    console.info(`[sim] loading config from ${full}`);
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  }

  const lines = [];
  for (let l = 1; l <= argv.lines; l += 1) {
    const machines = [];
    for (let m = 1; m <= argv['machines-per-line']; m += 1) {
      machines.push({
        machine_id: `machine-${String(m).padStart(2, '0')}`,
        vendor: l === 1 ? 'Mazak' : 'Beckhoff',
        model: l === 1 ? 'Quick Turn 250' : 'CX5140',
        ideal_cycle_time_sec: l === 1 ? 18 : 35,
        metrics: [
          { name: 'spindle_speed',  unit: 'rpm',     mean: 3000 + (m * 25), stdDev: 80, min: 0,    max: 4500 },
          { name: 'spindle_temp_c', unit: '°C',      mean: 62  + (m * 1.2), stdDev: 2.5, min: 20,  max: 95 },
          { name: 'feed_rate',      unit: 'mm/min',  mean: 210,             stdDev: 10,  min: 0,   max: 500 },
          { name: 'power_kw',       unit: 'kW',      mean: 7.3,             stdDev: 1.0, min: 0.2, max: 15 },
          { name: 'vibration_mm_s', unit: 'mm/s',    mean: 3.0,             stdDev: 0.4, min: 0,   max: 18 }
        ]
      });
    }
    lines.push({ line_id: `line-${String(l).padStart(2, '0')}`, machines });
  }
  return { facility: argv.facility, lines };
}

class Machine {
  constructor({ facility, line_id, machine, idealCycle }) {
    this.facility = facility;
    this.line_id = line_id;
    this.machine = machine;
    this.state = 'RUN';
    this.counters = { good: 0, reject: 0, total: 0 };
    this.cycleAccumulator = 0;
    this.idealCycle = idealCycle;
    this.metricWalk = new Map();
    this.downUntil = 0;
  }

  step(tickMs) {
    const now = Date.now();
    const prevState = this.state;

    if (this.state === 'DOWN' && now > this.downUntil) {
      this.state = 'IDLE';
    } else if (this.state === 'RUN' && Math.random() < argv['fault-probability']) {
      this.state = 'DOWN';
      this.downUntil = now + 20_000 + Math.random() * 60_000;
    } else if (this.state === 'IDLE' && Math.random() < 0.2) {
      this.state = 'RUN';
    }

    if (this.state === 'RUN') {
      this.cycleAccumulator += tickMs / 1000;
      if (this.cycleAccumulator >= this.idealCycle) {
        const cycles = Math.floor(this.cycleAccumulator / this.idealCycle);
        this.cycleAccumulator -= cycles * this.idealCycle;
        for (let i = 0; i < cycles; i += 1) {
          this.counters.total += 1;
          if (Math.random() < 0.985) this.counters.good += 1;
          else this.counters.reject += 1;
        }
      }
    }

    return { prevState, newState: this.state };
  }

  sampleMetric(def) {
    const prev = this.metricWalk.get(def.name) ?? def.mean;
    const drift = randn() * def.stdDev * (this.state === 'RUN' ? 1 : 0.2);
    const reversion = 0.05 * (def.mean - prev);
    // Occasional anomalies: push to 4σ+ of baseline for 1-3 ticks. Intentionally
    // targets metrics that have alert rules so the alert-engine fires in demos.
    const anomalyKick = (this.state === 'RUN' && Math.random() < argv['anomaly-probability'])
      ? (def.stdDev * (4 + Math.random() * 3)) * (Math.random() < 0.5 ? 1 : -1)
      : 0;
    const next = clamp(prev + drift + reversion + anomalyKick, def.min, def.max);
    this.metricWalk.set(def.name, next);
    return next;
  }
}

async function main() {
  const cfg = loadConfig();
  const machines = [];
  const machineDefs = [];

  for (const line of cfg.lines) {
    for (const m of line.machines) {
      const entity = new Machine({
        facility: cfg.facility,
        line_id: line.line_id,
        machine: m.machine_id,
        idealCycle: m.ideal_cycle_time_sec || 18
      });
      machines.push(entity);
      machineDefs.push(m);
    }
  }

  console.info(
    `[sim] starting: broker=${argv.broker} facility=${cfg.facility} ` +
    `machines=${machines.length} interval=${argv.interval}ms`
  );

  const clientOptions = {
    clientId: `factorymind-simulator-${Math.random().toString(16).slice(2, 10)}`,
    keepalive: 30,
    reconnectPeriod: 2_000
  };
  if (argv.username) {
    clientOptions.username = argv.username;
    clientOptions.password = argv.password;
  }
  const client = mqtt.connect(argv.broker, clientOptions);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), 10_000);
    client.once('connect', () => { clearTimeout(timer); resolve(); });
    client.once('error', reject);
  });
  console.info('[sim] connected to broker');

  const interval = setInterval(() => {
    machines.forEach((m, idx) => {
      const def = machineDefs[idx];
      const { prevState, newState } = m.step(argv.interval);
      const ts = new Date().toISOString();

      // Telemetry publishes (one message per metric or one batch)
      const samples = def.metrics.map((md) => ({
        ts,
        metric: md.name,
        value: Number(m.sampleMetric(md).toFixed(3)),
        unit: md.unit,
        quality: newState === 'RUN' ? 100 : 60
      }));
      client.publish(
        `factory/${m.facility}/${m.line_id}/${m.machine}/telemetry`,
        JSON.stringify(samples),
        { qos: 0 }
      );

      // Status transitions
      if (prevState !== newState) {
        client.publish(
          `factory/${m.facility}/${m.line_id}/${m.machine}/status`,
          JSON.stringify({ ts, state: newState, reason_code: newState === 'DOWN' ? 'SIM_FAULT' : 'none' }),
          { qos: 1, retain: true }
        );
        if (newState === 'DOWN') {
          client.publish(
            `factory/${m.facility}/${m.line_id}/${m.machine}/alarms`,
            JSON.stringify({
              ts,
              code: 'DOWN_SIM',
              severity: 'major',
              message: 'Macchina fermata (simulazione)'
            }),
            { qos: 1 }
          );
        }
      }
    });
  }, argv.interval);
  interval.unref?.();

  function shutdown() {
    clearInterval(interval);
    client.end(false, {}, () => {
      console.info('[sim] shutdown complete');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5_000).unref?.();
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[sim] fatal', err);
  process.exit(1);
});
