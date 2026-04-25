# FactoryMind — Service Level Objectives (SLO)

**Version:** 1.0.0
**Owner:** FactoryMind SRE
**Reviewed:** 2026-04-18
**Scope:** Production environment, single-tenant or multi-tenant SaaS.

This document defines the quantitative reliability targets the FactoryMind
platform commits to, the error-budget policy that governs release behaviour,
and the measurement + alerting wiring that makes each SLO operational.
Aligns with v2.0 Section 13 of the internal delivery plan.

## 1. Service Level Indicators (SLI)

For each customer-facing capability we capture a single Service Level
Indicator (SLI) — a time-series metric that measures what "working" means.

| # | SLI | Definition | Measurement source |
|---|-----|------------|--------------------|
| SLI-1 | HTTP availability | `(1 - http_5xx_rate)` over rolling 5 min, `/api/*` | `factorymind_http_requests_total` (Prometheus histogram) |
| SLI-2 | HTTP latency (P95) | 95th percentile end-to-end round-trip time, `/api/metrics`, `/api/oee`, `/api/alerts` | `http_request_duration_seconds_bucket` |
| SLI-3 | MQTT end-to-end latency | median + P95 delay between a simulator publish and the corresponding InfluxDB write | synthetic probe (`tests/performance/k6-mqtt.js`) |
| SLI-4 | Alert correctness | (true alerts fired / ground-truth anomalies injected by synthetic probe) over 24 h | `factorymind_alerts_fired_total` cross-referenced with probe log |
| SLI-5 | WebSocket freshness | age of the last telemetry frame pushed to connected clients | `factorymind_ws_last_push_age_seconds` gauge |
| SLI-6 | Data durability | successful Influx writes / total attempted writes | `influx_points_written_total` divided by `influx_points_dropped_total` |
| SLI-7 | Grafana dashboard render | 90th percentile latency of the panel query `/api/datasources/proxy/1/query` | Grafana `api_datasource_query_duration_seconds` |

## 2. Service Level Objectives (SLO)

| # | SLO | Target (MVP) | Target (GA v1.0) | Window |
|---|-----|--------------|------------------|--------|
| SLO-1 | HTTP availability | >= 99.5% | >= 99.9% | 30-day rolling |
| SLO-2 | HTTP latency P95 | < 300 ms | < 200 ms | 7-day rolling |
| SLO-3 | HTTP latency P99 | < 800 ms | < 500 ms | 7-day rolling |
| SLO-4 | MQTT end-to-end latency P95 | < 2 s | < 1 s | 1-h rolling |
| SLO-5 | Alert correctness | >= 98% precision | >= 99% precision | 24-h rolling |
| SLO-6 | WebSocket freshness | < 5 s staleness | < 2 s staleness | 5-min rolling |
| SLO-7 | Data durability | >= 99.95% | >= 99.99% | 30-day rolling |
| SLO-8 | Recovery Time Objective (RTO) | <= 4 h | <= 1 h | per incident |
| SLO-9 | Recovery Point Objective (RPO) | <= 15 min | <= 5 min | per incident |

Rationale: an industrial shop floor can tolerate brief interruptions of the
reporting plane (FactoryMind is a monitoring overlay, not an interlock in
the control path) but NOT silent data loss. Durability therefore wins over
raw availability.

## 3. Error-budget policy

Each SLO implies an error budget. Example: SLO-1 = 99.5% over 30 days
=> budget = 0.5% of 30 days = 3h 36min of permitted error per month.

| State | Budget consumed | Actions |
|-------|-----------------|---------|
| Green | < 25% | Ship new features freely, routine deploys during business hours. |
| Yellow | 25-75% | Require post-deploy smoke + canary for any change to MQTT / Influx / alert paths. |
| Red | 75-100% | Freeze feature deploys. Only fixes for known reliability bugs. Incident postmortem required if budget exhausted. |
| Blown | > 100% | Full change freeze. Executive review. Budget window extended only after documented root cause + mitigation. |

Budget burn is tracked by a Prometheus recording rule and surfaced on the
Errors dashboard (see `grafana/provisioning/dashboards/errors.json`).

## 4. Measurement protocol

- All percentile latency measurements are computed with the Prometheus
  `histogram_quantile` function over the exported buckets
  `{0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10}` seconds. The buckets are defined
  inside the backend's pino-http middleware and exposed via `/metrics`.
- Synthetic MQTT probes run every 60 s in staging (k6 script), every
  5 min in production (scheduled job). Median + P95 are captured per run
  and aggregated hourly.
- Alert correctness is sampled weekly by a manual review + nightly
  synthetic-anomaly injector that intentionally breaches known thresholds.
- Every SLI is visible on the `api-performance` Grafana dashboard.

## 5. Alerting tiers

Alertmanager rules live in `monitoring/alerts.yml`. They fire into
two routes: `pager` (on-call paging) and `ticket` (business-hours
Jira/Linear item).

| Alert | Condition | Severity | Route |
|-------|-----------|----------|-------|
| `FactoryMindAPIDown` | `up{job="factorymind-backend"} == 0` for 2 min | critical | pager |
| `FactoryMindHighErrorRate` | 5xx rate > 1% over 10 min | critical | pager |
| `FactoryMindLatencyBurn` | P95 latency > 500 ms over 15 min | warning | pager |
| `FactoryMindLatencyBudget` | 14-day burn rate > 3x | warning | ticket |
| `FactoryMindMQTTDisconnected` | backend `mqtt_connected == 0` for 1 min | critical | pager |
| `FactoryMindInfluxWriteFailures` | write-failure ratio > 0.1% over 10 min | warning | pager |
| `FactoryMindHeapPressure` | heap / heap_limit > 0.8 over 10 min | warning | ticket |
| `FactoryMindReadinessFlap` | `/api/ready` flaps > 3 times in 15 min | warning | ticket |

Each alert emits the SLO it defends and a runbook URL.

## 6. Runbooks

Runbooks live under `docs/runbooks/` (to be populated). Each alert above
has an associated runbook stub: `<alert-name>.md`. Runbooks document:

1. Diagnosis (which dashboards to open first).
2. Mitigation (rate-limit tweak, restart, scale-out).
3. Escalation path.
4. Postmortem template link.

## 7. Review cadence

SLOs are reviewed quarterly. A review is triggered early if:

- Any SLO blows through budget two consecutive months.
- A product launch adds a new critical user journey.
- An architecture change alters the measurement semantics.

## 8. Out-of-scope

- Customer-provided Grafana alerting on their own ad-hoc dashboards.
- Third-party ingress availability (CDN, WAF) — covered by upstream SLAs.
- Device-side (PLC / gateway) availability — the customer controls the
  physical network layer; FactoryMind reports what it receives.

---

**Acknowledgement.** This SLO document is part of FactoryMind's commitment
to operational transparency. It is reviewed by the product team and the
customer-success team before every GA release. Signed-off revisions are
tagged in git alongside the corresponding `v*` release tag.
