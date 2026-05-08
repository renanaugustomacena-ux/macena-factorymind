# FactoryMind Backend

Node.js 20 + Express 4 + Pino + MQTT.js + Joi + InfluxDB client + pg.

The backend is the integration spine: ingests MQTT telemetry, persists to InfluxDB, exposes the REST API the frontend + customer ERPs consume, evaluates alert rules, generates Piano Transizione 4.0 / 5.0 attestazione PDFs.

## Layout

```
src/
  index.js                # boot — Express app, middleware, route mount, MQTT/Influx/OPC-UA bridge wiring
  config/                 # env-var validation (Joi); fails-closed in production
  middleware/             # auth (JWT + cookie), CSRF, errorHandler (RFC 7807 problem+json), pino-http
  routes/                 # REST handlers (users, devices, lines, facilities, oee, alerts, attestazione, contact, …)
  services/               # influx-writer, mqtt-handler, alert-engine, gdpr, piano4-attestazione, sparkplug-bridge
  db/
    pool.js               # pg.Pool singleton + ping for /api/health
    migrations/           # 001-008: schema, seeds, attestazioni, idempotency
  utils/                  # logger (Pino), safe-error (R-ERROR-SAFE-001 helper)
  mqtt/topics.js          # canonical topic regex + parse/validate (R-MQTT-TOPIC-VALIDATION-001)
  ws/server.js            # WebSocket upgrade with JWT auth (R-WS-AUTH-001)

tests/                    # 340 Jest cases / 32 suites; mocks pg.Pool + MQTT + InfluxDB at the boundary
```

## Dev workflow

```bash
npm install          # installs deps (use `npm ci` in CI for reproducible builds)
npm run lint         # ESLint flat config; `no-warning-comments: error` (R-LINT-TODO-001)
npm test             # Jest 340/340
npm run test:cov     # with coverage; thresholds in jest.config.js (R-COVERAGE-UPLIFT-001 ratchet plan)
npm start            # production (requires .env populated by install.sh)
npm run dev          # nodemon-watched
```

The full local stack (Postgres + Influx + Mosquitto + backend + frontend + Grafana + simulator) starts via `docker compose up -d` from the repo root after `install.sh` has run once.

## Configuration

All env-vars are validated by `src/config/index.js` at boot — missing or invalid values fail-fast with a clear error. The canonical list lives at [`docs/HANDOFF.md`](../docs/HANDOFF.md) § 5.2; the most-frequently-tweaked are `LOG_LEVEL`, `OTEL_TRACES_SAMPLER_ARG` (per-tier table at HANDOFF § 8.12), and `SPARKPLUG_ENABLED`.

Production guardrails (R-CONFIG-MQTT-001): empty `MQTT_PASSWORD` rejected when `APP_ENV=production`. The boot sequence (`src/index.js:170-240`) is documented in HANDOFF § 5.1.

## API

The OpenAPI specification is the canonical interface contract: [`docs/openapi.yaml`](../docs/openapi.yaml). The prose companion lives at [`docs/HANDOFF.md`](../docs/HANDOFF.md) § 6. Both are kept in lockstep by the docs-lint CI job.

`/api/health` returns the four-dependency rollup (`postgres`, `influxdb`, `influxdb_tasks` per R-INFLUX-TASK-001, `mosquitto`); `/api/ready` is the k8s readiness probe with the "primed-once" semantic.

## Doctrine references

- **H-1** — `install.sh` is the canonical bootstrap path. Do NOT add manual setup steps to this README without updating install.sh + HANDOFF § 5.5.
- **H-9** — documentation is code. Any change to the boot sequence, route mount order, or env-var contract MUST land alongside a HANDOFF § 5 update.
- **R-3** — no `|| true` masking. Tests failing or lint failing → fix the root cause, not the gate.

## Testing patterns

- **Boundary mocks only.** Tests mock `pg.Pool`, MQTT client, and InfluxDB at the wire boundary; the service-layer code is exercised end-to-end. See `tests/setup.js` for the env-var defaults.
- **Source-text assertions** for CI-pipeline + workflow-file invariants (e.g., `tests/cd-supply-chain.test.js`, `tests/sparkplug-load.test.js`, `tests/k8s-network-policy.test.js`).
- **Joi-schema regressions** are locked at unit-test level (e.g., `tests/contact-consent.test.js` for R-LANDING-CONSENT-001).
- New test files MUST be named `<feature>.test.js` and live in `tests/`. Do not add tests inline in `src/`.

See [`docs/HANDOFF.md`](../docs/HANDOFF.md) § 4 for the full module catalogue and [`docs/REMEDIATION.md`](../docs/REMEDIATION.md) for the active remediation plan.
