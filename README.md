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

- [`docs/MODUS_OPERANDI.md`](docs/MODUS_OPERANDI.md) — strategic, technical, operational and commercial playbook (≥ 13 000 words).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, sequence diagrams, deployment topologies.
- [`docs/API.md`](docs/API.md) — every REST endpoint with request / response schemas.

## Piano Transizione 4.0 / 5.0 Eligibility

FactoryMind is engineered to satisfy the three "caratteristiche tecnologiche obbligatorie" that qualify a machine for the T4.0 / T5.0 tax credit:

1. **Telematic interconnection** — OPC UA, Modbus TCP, or MQTT Sparkplug B to the factory MIS/ERP.
2. **Automated data collection** — InfluxDB ingests every sample at 1 Hz or higher with guaranteed idempotency.
3. **Integration with the corporate IT system** — a REST surface documented in `docs/API.md` and an ERP-oriented event feed.

A one-time `T4.0 attestazione` report can be generated for each interconnected machine; refer to `docs/MODUS_OPERANDI.md` Part I §3 for the commercial model that accompanies this.

## License

MIT — see [`LICENSE`](LICENSE).

---

Made in Mozzecane (VR) — Veneto, Italy.
