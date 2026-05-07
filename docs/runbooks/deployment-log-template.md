<!--
Deployment-log runbook (R-RUNBOOK-DEPLOY-001 closure; doctrine H-12).

H-12 reads: "First production deployment is a ceremony, not a script."
This template is the operational artefact that records each ceremony.
The doctrine itself lives in HANDOFF.md § 0.2 (Rules), with the long-form
explanation in the H-12 narrative; the 12 checkpoints are listed inline
in that narrative — duplicated here as the operational checklist so the
on-call engineer can copy this file at cutover time without scrolling
back through HANDOFF.

Process per cutover:
  1. Copy this file to `docs/deployment-logs/<YYYY-MM-DD>-<customer-slug>.md`.
  2. Strip this comment block.
  3. Fill the metadata block.
  4. Walk the checkpoints in numerical order. Each MUST be initialled
     by the named witness with a timestamp before the next can start.
  5. The customer's responsabile IT signs the acceptance form at the
     end. Without that signature, the cutover is not complete (regardless
     of whether the system is technically functional).
  6. Commit. The deployment log is part of the four-document set's
     evidence trail and may be referenced in a customer audit (cfr.
     `docs/customer-audits/`).
-->

# Production deployment log — `<Customer>` — `<YYYY-MM-DD>`

## Metadata

- **Customer:** `<Ragione sociale + sede>`
- **Tier:** `<2 / 3 / 4>` (per HANDOFF § 1; Tier 1 / self-hosted does not require this ceremony)
- **Cutover lead (FactoryMind):** `<name>` `<role>`
- **Witness #1 (FactoryMind):** `<name>` `<role>` (cannot be the same person as the cutover lead — R-14 doctrine: review by non-implementer)
- **Witness #2 (customer):** `<name>` `<role>`, `<customer org>`
- **Cutover window:** `<start UTC>` → `<end UTC>` (planned)
- **Maintenance notice sent:** `<date>` (per contractual SLA — see `legal/CONTRATTO-SAAS-B2B.md` art. 6)

## Pre-flight

- [ ] All 12 H-12 checkpoint owners have confirmed availability for the cutover window
- [ ] `monitoring/alerts.yml` runbook URLs resolve (run docs-lint job in CI on the cutover branch)
- [ ] Backup of customer's existing data (if migrating) verified restorable (R-DR-DRILL-001 quarterly rule)
- [ ] DR runbook (HANDOFF § 8.11) re-read by cutover lead in the last 7 days
- [ ] Rollback plan documented inline below (NOT just "redeploy previous tag")

## Checkpoints (H-12 — twelve numbered, witnessed)

Each checkpoint is initialled by the witness with a UTC timestamp once verified. Sequencing **cannot proceed past an un-initialled checkpoint**.

### 1. Secrets in AWS Secrets Manager / Aruba Vault (not in `.env`)

- Verify: `aws secretsmanager list-secrets --query 'SecretList[?starts_with(Name, ' factorymind/')].Name'` returns the expected entries (DATABASE_URL, INFLUX_TOKEN, MQTT_PASSWORD, JWT_SECRET, ADMIN_PASSWORD_HASH).
- Verify: `git grep -E '^(DATABASE_URL|INFLUX_TOKEN|MQTT_PASSWORD|JWT_SECRET)=' .env` returns nothing or only placeholder values.
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 2. Database migration applied + verified via `psql` row count

- Apply: `node-pg-migrate up` (or equivalent) against the customer's RDS endpoint.
- Verify: `psql -c "SELECT count(*) FROM users"` returns the expected seed count; `SELECT count(*) FROM attestazioni_idempotency_test` (per migration 008) returns 0.
- Verify: `SELECT version FROM pgmigrations ORDER BY id DESC LIMIT 1` returns the latest migration ID.
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 3. Broker TLS certificate verified via `openssl s_client`

- Run: `openssl s_client -connect <broker>:8883 -showcerts -CAfile <production-CA.crt> </dev/null`
- Verify: certificate chain validates; `Verify return code: 0 (ok)`; subject CN matches the broker hostname.
- Confirm: the production CA is the customer's CA / cert-manager output, NOT the install.sh dev CA (HANDOFF § 5 swap-point — TLS hardening pre-condition).
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 4. MQTT credentials provisioned per `mosquitto_passwd`

- Verify: `cat /mosquitto/config/passwd` (in the broker container) lists the customer-specific `backend` user.
- Verify: `mosquitto_pub -h <broker> -p 8883 --cafile <ca> -u backend -P <password> -t 'test/cutover' -m hello` succeeds.
- Verify: anonymous publish refused: `mosquitto_pub -h <broker> -p 8883 --cafile <ca> -t 'test/cutover' -m hello` returns "Connection Refused: not authorised".
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 5. ACL file deployed

- Verify: `cat /mosquitto/config/acl.conf` contains the customer-specific topic-prefix grants for `backend` user (publish + subscribe to `factory/<facility-id>/#`).
- Verify: cross-tenant publish attempt refused (if multi-tenant Tier 4): `mosquitto_pub -u backend-tenantA -t 'factory/tenantB/...' -m foo` → not authorised.
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 6. Influx bucket + retention policy + downsampling tasks all present

- Verify: `influx bucket list` shows the customer's bucket with the contractual retention (e.g., `30d` for Tier 2, `90d` for Tier 3, `365d` for Tier 4 — match the contract).
- Verify: `influx task list` shows three tasks: `downsample_1m`, `downsample_1h`, `downsample_1d` (R-INFLUX-TASK-001 — cross-checked via `/api/health` `dependencies.influxdb_tasks.ok = true`).
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 7. First machine telemetry observed in Grafana within 5 minutes of bridge connect

- Connect the customer's first physical machine (or a witnessed simulator stand-in) to the broker.
- Open the Grafana dashboard "Live telemetry — `<facility>`".
- Verify: telemetry points appear within 5 minutes; OEE gauge resolves to a meaningful value (not `insufficient-data`) within 30 minutes.
- If telemetry doesn't appear: STOP. Engage the on-call to walk § 8.4 (FactoryMindMQTTDisconnected) or § 8.7 (FactoryMindInfluxWriteFailures) runbook before continuing.
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 8. First attestazione PDF rendered for the customer's first machine

- POST to `/api/devices/<id>/attestazione/pdf` with the customer's destinatario data.
- Verify: response is a 200 with `Content-Type: application/pdf`; magic bytes `%PDF-` open in a PDF reader.
- Verify: the PDF carries the customer's ragione sociale, P.IVA, and sede operativa (per the destinatario block).
- This is the load-bearing deliverable per H-16 / § 9.1 — sanity-check by scrolling through the rendered document yourself, not just by status code.
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 9. Audit log writing verified by inserting a test action and `SELECT`ing it back

- Issue a test action: `POST /api/users/me/audit-test` (or equivalent test endpoint).
- Verify: `SELECT * FROM audit_log WHERE actor='cutover-test' ORDER BY ts DESC LIMIT 1` returns a row with ts within the last 60 seconds.
- Verify: the customer's GDPR DPO contact (or the customer's sign-off witness if no DPO yet) has been told that audit-log entries are retained per `legal/PRIVACY-POLICY.md` retention.
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 10. Backup job runs successfully

- Trigger the backup job (or wait for the scheduled run if within 1 hour).
- Verify: backup artefact lands in S3 (`s3://factorymind-backups-<customer>/<YYYY>/<MM>/<DD>/`) within 30 minutes of trigger.
- Verify: artefact size is plausible (compare against the dev backup size; should be within 10× for a fresh customer or within 50% for a migrating customer).
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 11. Restore drill runs successfully on a copy

- Restore the artefact from checkpoint 10 into a clean staging RDS instance.
- Verify: row counts on the restored DB match the source (modulo any in-flight writes during the drill window).
- Verify: schema matches (`pg_dump --schema-only` diff is empty).
- This is also the entrance ticket for R-DR-DRILL-001's first drill — record the outcome inline at the end of this log.
- **Initialled by:** `<witness>` `<HH:MM UTC>`

### 12. Customer's responsabile IT signs the acceptance form

The acceptance form below is signed by the customer's `responsabile IT` (or equivalent named role per the SaaS contract). Without this signature, the cutover is **not complete** even if all 11 prior checkpoints are initialled.

---

## Acceptance form

I, the undersigned, confirm that I have observed the FactoryMind cutover ceremony for `<Customer>` on `<YYYY-MM-DD>` and that all 12 H-12 checkpoints completed without uncorrected anomalies.

I understand that:

- The Piano 4.0 / 5.0 attestazione PDF generated by FactoryMind is a technical aid and does NOT replace the perizia tecnica giurata (per HANDOFF § 9.1 + doctrine H-16).
- Operational responsibility for the customer's facility production process remains with the customer (per `legal/CONTRATTO-SAAS-B2B.md` art. 7).
- Any post-cutover anomalies must be reported to FactoryMind's on-call within the contractual SLA window (per § 8.1 SLI / SLO).

Signed: `<customer-responsabile-IT-name>` `<role>` `<date>`
Counter-signed (FactoryMind cutover lead): `<name>` `<date>`

---

## Post-cutover

- [ ] DR runbook freshness re-validated against the customer's actual eu-region setup (HANDOFF § 8.11 pre-conditions inventory)
- [ ] Customer's responsabile IT added to the alerting Slack channel / email distribution
- [ ] Initial post-cutover sync scheduled (T+1 day, T+1 week, T+1 month)
- [ ] Cutover postmortem (use `docs/postmortems/_template.md`) filed if any checkpoint took longer than 2× its planned window — celebrate-the-norm if not, but a smooth cutover is itself a data point worth recording

## Doctrine references

- **H-12** — first production deployment is a ceremony (this runbook is the operational artefact)
- **H-16** — perizia stays with customer's perito (acceptance form acknowledgement)
- **R-14** — review by non-implementer (witness #1 ≠ cutover lead)
- **A-12** — cadence review (deployment-log template re-validated quarterly)
- **H-22** — quarterly review of the four-document set covers this template
