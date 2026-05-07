# FactoryMind — Architecture

## 1. System Context

FactoryMind is an Industrial-IoT platform targeting discrete and process
manufacturers across Veneto and the broader north-Italian industrial belt.
The system comprises five cooperating tiers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TIER 1 — FIELD / SHOP FLOOR                    │
│   PLC · CNC · Robot · VFD · Energy Meter · PV Inverter · Sensori        │
│   Protocolli: OPC UA, Modbus RTU/TCP, MQTT, Sparkplug B, Ethernet/IP    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ TLS + X.509 (mTLS on cloud leg)
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        TIER 2 — EDGE GATEWAY                            │
│   Mosquitto bridge · OPC UA client · Modbus poller · Sparkplug bridge   │
│   Local store-and-forward (90 s buffer) · SIM ↔ 4G / Ethernet failover  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ MQTT 1883 / 8883
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        TIER 3 — MESSAGE BROKER                          │
│   Mosquitto (single-tenant) OR EMQX/HiveMQ cluster (multi-tenant)       │
└─────┬────────────────────────────────────────────┬──────────────────────┘
      │ subscribe                                   │ subscribe
┌─────▼──────────────┐                         ┌───▼───────────────────┐
│  FactoryMind API   │                         │ Grafana Alertmanager  │
│  (Node + Express)  │                         │ (optional)            │
│  - MQTT handler    │                         └───────────────────────┘
│  - InfluxDB writer │
│  - Alert engine    │
│  - OEE engine      │
└───┬─────────────┬──┘
    │             │
┌───▼────────┐ ┌──▼───────┐
│ InfluxDB 2 │ │PostgreSQL│
│ series     │ │meta/RBAC │
└────────────┘ └──────────┘
      │
┌─────▼──────┐
│ Grafana    │
└────────────┘
```

## 2. Data Model (PostgreSQL)

| Table           | Purpose                                                                                   |
|-----------------|-------------------------------------------------------------------------------------------|
| `facilities`    | Stabilimenti (plants). One row per physical site.                                         |
| `lines`         | Linee di produzione. `(facility_id, line_id)` unique.                                     |
| `devices`       | Machines + PLCs. Holds `ideal_cycle_time_sec`, `opcua_tags`, `modbus_map`.                |
| `shifts`        | Planned shift windows with break deductions.                                              |
| `downtimes`     | Unplanned + planned stoppage records, with reason codes and Pareto keys.                  |
| `alert_rules`   | Threshold-based rule definitions (JSONB expression).                                      |
| `alerts`        | Materialised alert instances; lifecycle open → acknowledged → resolved with escalation.   |
| `users`         | Local identities + RBAC (`admin`, `supervisor`, `operator`, `viewer`).                    |
| `audit_log`     | Write-only audit trail of all authorised actions (RBAC-mutating, device mutations, etc.). |

Keys and indexes are defined in `backend/src/db/migrations/001_initial.sql`.

### InfluxDB 2.x — Time-series

Bucket `factory-telemetry` contains four measurements:

| Measurement   | Fields                                   | Tags                                                     |
|---------------|------------------------------------------|----------------------------------------------------------|
| `telemetry`   | `value (float)`, `quality (int)`         | `facility`, `line`, `machine`, `metric`, `unit`          |
| `status`      | `reason_code (string)`                   | `facility`, `line`, `machine`, `state`                   |
| `alarm`       | `message (string)`                       | `facility`, `line`, `machine`, `code`, `severity`        |
| `counters`    | `good (int)`, `reject (int)`, `total (int)` | `facility`, `line`, `machine`                         |

Downsampling tasks (provisioned at first start by the backend):

- `downsample_1m` — runs every 1 minute; writes to `telemetry_1m`.
- `downsample_1h` — runs every 1 hour; writes to `telemetry_1h`.
- `downsample_1d` — runs every 1 day; writes to `telemetry_1d`.

Retention policies: 30 days (raw), 365 days (1-minute), 3 years (1-hour + 1-day).
See `.env.example` variables `INFLUX_RETENTION_DAYS_*` to tune.

## 3. Sequence Diagrams

### 3.1 MQTT ingestion → Influx write → alert evaluation

```
Machine     Mosquitto     Backend         InfluxDB       PostgreSQL        Browser
   │            │             │                │              │                │
   │──telemetry>│             │                │              │                │
   │            │──PUBLISH───>│                │              │                │
   │            │             │──Point─────────>│             │                │
   │            │             │  (batched 1s)  │              │                │
   │            │             │──eval rule────────────────── >│                │
   │            │             │                │              │  │  breach?    │
   │            │             │<──INSERT alert─────────────── │                │
   │            │<──PUBLISH alarms (qos=1)────────────────────│                │
   │            │──WS fanout───────────────────────────────────── ──>alert feed│
```

### 3.2 OEE calculation

```
Browser          Backend            PostgreSQL              InfluxDB
   │                │                    │                     │
   │─GET /api/oee──>│                    │                     │
   │                │── SELECT devices   │                     │
   │                │    SELECT shifts   │                     │
   │                │    SELECT downtimes│                     │
   │                │<───rows────────────│                     │
   │                │────── query counters ────────────────── >│
   │                │<───────── last(good,total) ──────────────│
   │                │ computeOEE()                             │
   │<─── JSON ──────│                                          │
```

### 3.3 OPC UA polling

```
node-opcua client
  │── createSession(policy, mode) ───────> PLC/OPC UA server
  │<──────────────── session ──────────────┤
  │── createSubscription (1s publishing) ──>
  │── monitor(nodeId, samplingInterval) ──>
  │<────── DataChange (value, ts, quality)─┤
  │── translate to FactoryMind envelope ──>
  │── MQTT publish factory/.../telemetry ──>
```

### 3.4 Alert escalation

```
Every 5 min:
  UPDATE alerts
  SET severity = promote(severity),
      escalated_at = NOW()
  WHERE status = 'open'
    AND (escalated_at IS NULL OR escalated_at < NOW() - INTERVAL '5 min')

On promotion:
  - Re-publish the alarm event on MQTT with the new severity.
  - Re-send the WebSocket fanout envelope.
  - Optionally trigger SMTP email / SMS webhook (future).
```

## 4. Failure Modes & Resilience

| Failure                               | Behaviour                                                                        |
|---------------------------------------|----------------------------------------------------------------------------------|
| Broker offline                        | Edge gateway buffers 90 s in local store-and-forward, reconnects automatically.  |
| InfluxDB offline                      | Writer retries with back-off, buffers up to 50 000 line-protocol rows in memory. |
| PostgreSQL offline                    | Read-only paths degrade; write paths return 503; alert engine pauses gracefully. |
| Backend pod OOM                       | Pod restarts; MQTT durable session (clean=false) recovers queued QoS-1 messages. |
| OPC UA server restart                 | node-opcua reconnects with exponential back-off (1s → 10s, max 10 retries).      |
| Modbus slave unreachable              | Read path increments failure counter; logged at INFO every 10 failures.          |

## 5. Deployment Topologies

- **Single-tenant on-premise** — one docker-compose stack per factory, Grafana inside the fabric. Recommended for customers with strict OT/IT segmentation and no public internet in the production network.
- **Hybrid** — Mosquitto broker + edge gateway on-premise; bridge to a cloud broker (AWS IoT Core / EMQX Cloud). Centralised Grafana/InfluxDB/Postgres in an Italian data centre (Aruba Cloud, OVHcloud Milano).
- **Multi-tenant SaaS** — EMQX cluster, InfluxDB Cloud Dedicated, managed PostgreSQL (Aurora Serverless v2). Tenant isolation at the MQTT ACL layer + per-tenant InfluxDB bucket.

## 6. Observability

- **Traces** — OpenTelemetry automatic instrumentation for Express and the `pg`, `mqtt`, `@influxdata/influxdb-client` libraries. Exporter: OTLP/gRPC.
- **Metrics** — `process_*`, MQTT publish/receive counters, InfluxDB batch size, alert-engine evaluations/second, OEE endpoint latency p50/p95/p99.
- **Logs** — Pino JSON. Recommended sink: Grafana Loki or Elastic, correlated by `trace_id` header injected by OTel.

## 7. Security Posture

- TLS 1.3 in front (nginx or ALB). HSTS with 1-year max-age.
- MQTT over TLS (port 8883) with per-device X.509 for production.
- OPC UA Basic256Sha256 + SignAndEncrypt default; Anonymous only in dev.
- JWT-based authentication on the REST API. Password hashing via `scrypt`
  (production deployments should substitute argon2id).
- Helmet-configured CSP, `X-Content-Type-Options`, `Referrer-Policy`.
- Per-IP rate limiting on `/api` (120 req/min by default).
- Every mutation writes to `audit_log` with actor, IP, resource.

See `docs/MODUS_OPERANDI.md` Part III §7 for the full compliance model.
