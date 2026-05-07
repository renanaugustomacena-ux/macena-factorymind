# FactoryMind — Data Governance

**Version:** 1.0.0
**Regulatory frame:** GDPR (Reg. UE 2016/679), Codice Privacy (D.Lgs. 196/2003 as amended by D.Lgs. 101/2018), NIS2 where industrial telemetry qualifies as essential-service data.
**Data controller reference:** the FactoryMind tenant (the manufacturer operating the platform). FactoryMind SaaS acts as a Data Processor per Art. 28 GDPR; a template DPA ("Accordo sul trattamento dei dati") is available on request.

This document maps every data class the platform handles to its
classification, retention, access-control, and subject-rights posture.
Aligns with v2.0 Section 15 of the internal delivery plan.

## 1. Data classification matrix

| Class | Description | Examples | GDPR Art. category |
|-------|-------------|----------|---------------------|
| C1 — Public | Non-sensitive marketing / docs | Landing page, OpenAPI | n/a |
| C2 — Internal operational | Machine telemetry, status, alarms | `telemetry.value`, `status.state`, `alarm.code` | Non-personal industrial data |
| C3 — Tenant confidential | Recipe, part program, production schedule | `devices.metadata.recipe_id`, `shifts.*` | Commercial secret; not personal data |
| C4 — Personal (PII) | User accounts, audit log actors | `users.email`, `users.full_name`, `audit_log.actor_email` | Art. 4(1) personal data |
| C5 — Credentials / secrets | JWT secret, DB password, Influx token, MQTT passwords | env vars, Secrets Manager | Protection per Art. 32 |

Field-level map (by storage):

### PostgreSQL
- `users.email` — C4 PII
- `users.full_name` — C4 PII
- `users.password_hash`, `users.password_salt` — C5
- `audit_log.actor_email`, `audit_log.ip_address` — C4 PII
- `devices.metadata` (JSON) — C3; MAY contain PII if the integrator stores
  operator names in free-form metadata. Integrators are instructed NOT to.
- All other columns — C2 or lower.

### InfluxDB
- `telemetry`, `status`, `alarm`, `counters` measurements — C2 only.
  Tags (`facility`, `line`, `machine`) are industrial identifiers, NOT PII.

### Mosquitto
- Payloads are ephemeral (broker is a pass-through). Retained messages
  use QoS 1 only for alarms (policy: alarms never retained > 24 h).

## 2. Personal-data inventory (GDPR Art. 30 register)

| # | Data subject | Categories of data | Purpose | Legal basis | Retention |
|---|--------------|--------------------|---------|-------------|-----------|
| 1 | FactoryMind admin / supervisor / operator / viewer users | Email, full name, hashed password, facility scope, IP, action audit | Platform operation, access control, security investigations | Art. 6(1)(b) contract + (f) legitimate interest (security) | Account lifetime + 24 months; audit records 24 months |
| 2 | Integrators / DPO contacts | Email, phone (metadata free-form) | Support contact | Art. 6(1)(f) | Until support contract expiry + 12 months |
| 3 | Workers identified indirectly via shift assignment (operator ID) | Free-form `shifts.metadata` when integrator opts in | Operational scheduling | Art. 6(1)(b) + (f) | Rolling 24 months |

Nothing special-category (Art. 9) is ever collected. If a customer starts
feeding biometric or health data (e.g. worker fatigue sensors), a DPIA
under Art. 35 is mandatory and FactoryMind requires the customer to sign
an addendum before the data is accepted.

## 3. Data flow

```
+-------------+     MQTT     +-------------+      +--------------+
|   Machines  | -----------> |  Mosquitto  | ---> |   Backend    |
| (PLC/PLCng) |  QoS 0/1/2   |   broker    |      |  handler     |
+-------------+              +-------------+      +------+-------+
                                                         |
                                                    +----+----+---------+
                                                    |         |         |
                                                    v         v         v
                                              +--------+ +---------+ +--------+
                                              | Influx | | Postgres| |  WS    |
                                              | series | | meta/   | | fan-out|
                                              +--------+ | audit   | +---+----+
                                                         +---------+     |
                                                              ^          |
                                                              | CRUD     | realtime
                                                         +----+-----+    |
                                                         | React UI | <--+
                                                         +----------+
```

Cross-border transfers: none by default. All processing occurs within the
tenant-configured region (default `eu-south-1` Milano). If a tenant pins
backups to an off-region bucket (e.g. `eu-central-1` Frankfurt), that
cross-border is documented in the tenant's DPA annex.

## 4. Retention schedule

| Store | Dataset | Retention | Deletion mechanism |
|-------|---------|-----------|--------------------|
| Influx | `telemetry` (raw, 1-s) | 30 days | InfluxDB bucket retention policy |
| Influx | `telemetry_1m` | 365 days | Separate bucket / retention task |
| Influx | `telemetry_1h` | 1095 days (3 years) | Separate bucket / retention task |
| Influx | `telemetry_1d` | Indefinite (small) | Manual prune on request |
| Postgres | `facilities`, `lines`, `devices` | Indefinite while active | Soft-delete on customer request |
| Postgres | `shifts`, `downtimes` | 7 years (fiscal, Italian Codice Civile Art. 2220) | Cron archival to S3 after 24 months, delete from DB after 7y |
| Postgres | `users` | Account lifetime + 24 months | `DELETE FROM users` after offboarding + audit copy |
| Postgres | `audit_log` | 24 months (reg.), 7 y on customer opt-in (fiscal trace) | Partitioned monthly; drop old partitions |
| Postgres | `refresh_tokens` | token lifetime + 24 h | Row removed on rotation or TTL job |
| Backups (S3) | Postgres dumps | 30 days | Lifecycle policy on bucket |
| Backups (S3) | Influx snapshots | 30 days | Lifecycle policy on bucket |

## 5. Access control (Art. 32 GDPR)

- **Authentication.** Bearer JWT, algorithm pinned to HS256, access token
  TTL 15 min, refresh token TTL 12 h absolute, 15 min sliding.
- **Authorisation.** RBAC with 4 roles: `admin`, `supervisor`, `operator`,
  `viewer`. Facility-scoped (`facility_scope[]`) so integrators managing
  multiple customers can be scoped per-tenant.
- **Audit.** Every state-changing endpoint writes to `audit_log` via
  `src/middleware/audit.js`. Read accesses are sampled (10%) in
  production to balance traceability with table growth.
- **Secrets.** Loaded from environment in dev; from AWS Secrets Manager
  (or equivalent KMS-backed store) in staging/prod. Never persisted in
  logs (`pino` redactor at `src/utils/logger.js` strips password / token
  / jwtSecret fields).

## 6. Encryption

| Layer | Mechanism | Status |
|-------|-----------|--------|
| In transit (public) | TLS 1.3 via ingress (`k8s/ingress.yaml` or CloudFront) | Enforced via HSTS 1 year |
| In transit (MQTT) | TLS 1.2+ on port 8883 in production; ACL + per-tenant credentials on 1883 in dev | Dev allows anonymous; production entrypoint refuses |
| At rest — Postgres | Disk-level encryption by managed service (AWS RDS KMS) | Default for all environments |
| At rest — Influx | Disk-level encryption by managed service or filesystem-level LUKS | Default |
| At rest — backups | S3 SSE-KMS | Default |
| Field-level — passwords | scrypt (16-byte salt, N=16384 default) per `src/routes/users.js` | Production |
| Field-level — refresh tokens | SHA-256 of the opaque token is stored; raw never persisted | Production |

FactoryMind does not currently implement column-level encryption for
`users.email` because the RDS-level KMS protection is considered
sufficient by industrial-sector norm. Customers with heightened
requirements can opt into `pgcrypto` column encryption; doc how in
`docs/runbooks/pgcrypto-enable.md` (to be populated).

## 7. Subject rights (GDPR Artt. 15-22)

Request channel: `privacy@<tenant-domain>`. Response SLA 30 days.

| Right | Implementation |
|-------|----------------|
| Access (Art. 15) | Operator runs `scripts/export-subject.sh <email>` which emits Postgres row + JSON audit history + any keyed Influx series. |
| Rectification (Art. 16) | Admin via UI or `PUT /api/users/:id` (to be added). |
| Erasure (Art. 17) | Operator runs `scripts/erase-subject.sh <email>` — cascades to `users`, nullifies `audit_log.actor_email` (keeps action for legal-interest audit trail, replaces email with hashed tombstone). |
| Portability (Art. 20) | Export in machine-readable formats: Postgres rows as JSON, Influx series as CSV (via Influx query API). |
| Restriction (Art. 18) | `active=false` on user; `acknowledged_at` freeze on any pending claim. |
| Objection (Art. 21) | Free-form ticket; handled manually by DPO. |
| Automated decisions (Art. 22) | N/A — FactoryMind uses threshold alarms, not profiling. |

Erasure procedure:

```sh
# 1. Verify the subject
psql -c "SELECT id, email FROM users WHERE email = '<subject>'"
# 2. Soft-delete (active=false) — ensures no new tokens issued.
psql -c "UPDATE users SET active=false WHERE email = '<subject>'"
# 3. Wait 7 days (audit quiescence).
# 4. Hard-delete + audit tombstone.
psql -c "DELETE FROM users WHERE email = '<subject>'"
psql -c "UPDATE audit_log SET actor_email = 'erased:' || encode(digest(actor_email, 'sha256'), 'hex') WHERE actor_email = '<subject>'"
# 5. Revoke any outstanding refresh tokens.
psql -c "DELETE FROM refresh_tokens WHERE user_id = '<id>'"
```

## 8. Breach notification (GDPR Art. 33 / 34)

- Detection: Alertmanager routes `FactoryMindHighErrorRate` +
  `FactoryMindLoginAnomalies` to the on-call on-prem SRE + security DL.
- Containment: credential rotation via `terraform apply -target
  module.secrets.aws_secretsmanager_secret_version.factorymind`.
- Assessment: DPO convenes within 24 h to assess Art. 33 threshold.
- Notification: Garante Privacy within 72 h if threshold met; affected
  data subjects notified without undue delay if Art. 34 risk exists.

## 9. Backup, RPO, RTO

See also `docs/SLO.md` §2.

- **Postgres.** Aurora Serverless v2 automated backups retained 14 days;
  PITR granularity 5 min. RPO <= 5 min, RTO <= 1 h (GA) / 4 h (MVP).
- **InfluxDB.** Daily snapshot via `influx backup`; shipped to S3. RPO
  <= 24 h on MVP (acceptable — downsampled series recoverable from raw
  within the same window). GA target RPO <= 1 h via continuous replication.
- **Configuration.** GitOps. Losing the cluster means re-applying
  terraform + k8s manifests; RTO of the platform is bounded by image
  pull + DB restore.

## 10. Data processor sub-processors

FactoryMind relies on:
- AWS (eu-south-1) — infrastructure provider. DPA signed.
- Grafana Labs (self-hosted OSS) — no data processing by Grafana Labs
  when running OSS image on AWS-managed infrastructure.
- Optional: InfluxData Cloud (eu-central-1) if customer pins hosted
  Influx. DPA signed with InfluxData.
- GitHub — source code hosting; no customer data.

A current list with DPA dates is published on
`https://factorymind.example/privacy/subprocessors`. Customers get 30
days notice before any addition.

## 11. Right-to-erasure automation verification

Quarterly: run `scripts/erase-subject.sh test-user@example.test` against
staging, verify:
- Row removed from `users`.
- `audit_log.actor_email` becomes `erased:<sha256>`.
- No trace of email in Influx (none expected by schema).
- JWT refresh tokens no longer issue new access tokens.
- Reports snapshot run before erasure still pivot-joins against
  `audit_log.actor_user_id` (so legal traceability is retained even after
  email tombstoning).

---

**Acknowledgement.** This document is maintained by the FactoryMind DPO.
Major changes trigger a re-publication notice to customer tenants. The
version log lives in this file's git history.
