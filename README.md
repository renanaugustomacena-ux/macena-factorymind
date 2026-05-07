# FactoryMind

**Monitora la Tua Produzione in Tempo Reale | Real-Time Production Monitoring for Italian SMEs**

FactoryMind is a production-ready Industrial IoT template that turns a Mosquitto MQTT broker, an InfluxDB 2.x time-series store, a PostgreSQL metadata store, and Grafana into a cohesive OEE-tracking, alerting, and Piano Transizione 4.0 / 5.0 attestation platform for discrete and process manufacturers in Veneto and beyond.

## Why FactoryMind?

- **OEE that is always live.** Availability × Performance × Quality computed on a rolling window from MQTT telemetry and shift plans, with SEMI E10 / VDI 2884 lineage.
- **Piano Transizione 4.0 / 5.0 eligibility, built in.** Every machine interconnected through FactoryMind satisfies the "caratteristiche tecnologiche" — telematic interconnection, automated data collection, IT-system integration — required for 5–20% (T4.0) or 5–45% (T5.0) tax-credit eligibility.
- **Open industrial protocols.** OPC UA (via node-opcua), Modbus RTU/TCP (via modbus-serial), and MQTT Sparkplug B for semantic payloads.
- **Italian context.** Mozzecane manufacturing cluster (86+ firms), Distretto del Mobile di Verona, Quadrante Europa just-in-time logistics — the product is designed for this geography.

## Stack

| Layer          | Technology                                      |
|----------------|-------------------------------------------------|
| Backend        | Node.js 20 + Express 4 + MQTT.js + Pino         |
| Time-series DB | InfluxDB 2.7                                    |
| Metadata DB    | PostgreSQL 16                                   |
| Broker         | Eclipse Mosquitto 2.x (1883 TCP + 9001 WSS)     |
| Frontend       | React 18 + Vite 5 + TypeScript 5 + Tailwind 3   |
| Dashboards     | Grafana (provisioned datasources + JSON boards) |
| Simulator      | Node.js CLI publishing MQTT at 1 Hz             |
| Observability  | OpenTelemetry (traces + metrics)                |
| IaC            | Terraform (AWS IoT Core + ECS reference)        |

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

Then open:

| Service                     | URL                     |
|-----------------------------|-------------------------|
| Backend API                 | http://localhost:3002   |
| Frontend dashboard          | http://localhost:5173   |
| Grafana                     | http://localhost:3000   |
| InfluxDB UI                 | http://localhost:8086   |
| MQTT broker (TCP)           | mqtt://localhost:1883   |
| MQTT broker (WebSocket)     | ws://localhost:9001     |

The `iot-simulator` service will begin publishing realistic telemetry to `factory/mozzecane/line-01/machine-01/telemetry` once the broker is healthy; Grafana's "Factory Overview" dashboard will populate within a minute.

## Health Check

```bash
curl http://localhost:3002/api/health | jq
```

Returns: `{ status, service, version, uptime_seconds, time, dependencies: { postgres, influxdb, mosquitto } }`.

## Documentation

The canonical FactoryMind documentation is the **four-document set** published as v1.0 baseline on 2026-05-07. Each document is dense (≥ 20 000 words), cross-referenced with stable anchors, reviewed quarterly.

- [`docs/HANDOFF.md`](docs/HANDOFF.md) — Software Handoff & Operations Manual. Bilingual (IT + EN). 22 doctrine rules; full architecture, code map, operational lifecycle, API reference, data governance, SRE runbooks, compliance baseline, cross-product integration, glossary, bus-factor onboarding. ≈ 22 000 words.
- [`docs/AUDIT.md`](docs/AUDIT.md) — Full-Sweep Audit. Independent technical assessment under NIST CSF 2.0 + MITRE ATT&CK ICS + OWASP API/IoT + IEC 62443-3-3 + CIS Controls v8 + AgID Misure Minime. 31 catalogued findings (7 Critical, 10 High, 11 Medium, 3 Low) with file:line evidence, CVSS scoring, MITRE technique mapping, reproduction commands, attack-tree analysis. ≈ 20 000 words.
- [`docs/REMEDIATION.md`](docs/REMEDIATION.md) — Remediation Plan. 60+ remediation tickets in W0/W1/W2/W3/Continuous waves; each ticket carries exit criteria, regression test, blast radius, rollback plan, RACI, communication plan. ≈ 20 000 words.
- [`docs/UPLIFT.md`](docs/UPLIFT.md) — Polishing & Excellence Plan. DORA Four Keys baseline + targets, Spotify Tech Radar, GreenMetrics-style Abstraction Ledger, five-track polish (DX / OX / Security / Commercial / Compliance), 30+ initiatives, 10 explicit anti-goals, 5-year horizon, customer-success cadence. ≈ 20 000 words.

Plus the machine-readable [`docs/openapi.yaml`](docs/openapi.yaml) — canonical API specification, prose companion at HANDOFF § 6.

The legacy documents (`MODUS_OPERANDI.md`, `ARCHITECTURE.md`, `API.md`, `ITALIAN-COMPLIANCE.md`, `DATA_GOVERNANCE.md`, `SLO.md`, `A11Y.md`) have been superseded and moved to [`docs/legacy/`](docs/legacy/) — see [`docs/legacy/README.md`](docs/legacy/README.md) for the supersession map.

## Piano Transizione 4.0 / 5.0 Eligibility

FactoryMind is engineered to satisfy the three "caratteristiche tecnologiche obbligatorie" that qualify a machine for the T4.0 / T5.0 tax credit:

1. **Telematic interconnection** — OPC UA, Modbus TCP, or MQTT Sparkplug B to the factory MIS/ERP.
2. **Automated data collection** — InfluxDB ingests every sample at 1 Hz or higher with guaranteed idempotency.
3. **Integration with the corporate IT system** — a REST surface documented in [`docs/HANDOFF.md`](docs/HANDOFF.md) § 6 and an ERP-oriented event feed.

A one-time `T4.0 attestazione` report can be generated for each interconnected machine; the regulatory baseline is documented in [`docs/HANDOFF.md`](docs/HANDOFF.md) § 9 (Compliance baseline) and [`docs/AUDIT.md`](docs/AUDIT.md) § 7 (legal & GDPR findings).

The perizia tecnica giurata asseverata required ex art. 1, c. 11, della Legge 232/2016 e successive modifiche per investimenti superiori a € 300 000 remains the customer's perito's responsibility (HANDOFF doctrine **H-16**).

## License

MIT — see [`LICENSE`](LICENSE).

---

Made in Mozzecane (VR) — Veneto, Italy.
