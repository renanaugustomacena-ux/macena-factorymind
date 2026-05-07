# FactoryMind — Remediation Plan

**Versione:** 1.0.0 (baseline plan)
**Data:** 2026-05-07
**Pinned commit (audit basis):** `d4c5107`
**Audit driving this plan:** [`AUDIT.md`](AUDIT.md) v1.0
**Companion documents:** [`HANDOFF.md`](HANDOFF.md), [`UPLIFT.md`](UPLIFT.md)
**Owner del piano:** Renan Augusto Macena (founder + lead engineer)
**Sign-off line:** _________________________ (date)

This document converts the 31 findings in [`AUDIT.md`](AUDIT.md) into time-boxed, owner-assigned, exit-criteria-bound work tickets, plus the supporting cadences (CVE sweep, dependency review, runbook drills) that keep the platform from re-acquiring the same gaps.

---

## Riepilogo esecutivo (IT)

Il presente piano di remediation traduce le 31 risultanze (7 Critical, 10 High, 11 Medium, 3 Low) dell'audit indipendente nel modello d'onda **W0 (emergenza ≤ 7 giorni) — W1 (30 giorni) — W2 (90 giorni) — W3 (180 giorni)** + cadenze continue. Ogni ticket ha titolo imperativo, finding di partenza, severità (gate), RACI dei responsabili, criteri d'uscita testabili, test di regressione (che fallisce prima della correzione e supera dopo), raggio d'impatto, piano di rollback, piano di comunicazione al cliente quando applicabile, stima dello sforzo (S/M/L/XL), stato (Pending/In Progress/Verified/Closed) e razionale che spiega perché la remediation scelta è preferibile alle alternative considerate.

I sette finding Critical individuati dall'audit (broker MQTT con anonymous abilitato per default; assenza di listener TLS sul broker in compose; URL OPC UA non validato che apre superficie SSRF; backend Terraform state in modalità local con il blocco S3 + DynamoDB lock commentato in `versions.tf`; Grafana che si connette a Postgres senza TLS; sub-processore InfluxData con sede US-Oregon privo di Transfer Impact Assessment; pipeline CI con `npm audit` e Trivy non bloccanti) sono allocati in W0 + W1; i loro criteri d'uscita devono essere chiusi prima della prima cessione di un contratto Tier 2 a un cliente pagante. I dieci finding High e gli undici Medium sono distribuiti fra W1 e W2, salvo un piccolo numero che dipende da decisioni di governance (analisi NIS2, analisi CRA) che richiedono il parere di un avvocato qualificato e che pertanto sono allocate a W2 con dipendenza esplicita dalla disponibilità del consulente legale.

Il piano è **vivo**: ogni quarto, in occasione della revisione documentale prevista dalla doctrine **H-22**, lo stato dei ticket è aggiornato e i nuovi finding eventualmente emersi sono inseriti come nuovi ticket. Lo slittamento di un ticket da una wave a quella successiva è ammesso solo con sottoscrizione esplicita del responsabile (rule **R-7**); la deriva silenziosa non è ammessa (doctrine **R-7** + AUDIT doctrine **A-8** sui residual finding).

---

## 0. Come leggere questo documento

**Percorso A — Engineer triaging the next sprint.** Vai a § 5 (W1 tickets) e § 6 (W2 tickets); pick a ticket; leggi finding di partenza in [`AUDIT.md`](AUDIT.md), exit criteria, regression test; ship it. Mark `Verified` after peer review + regression test passes.

**Percorso B — Customer's responsabile IT validating release notes.** Vai a § 10 (Communication & disclosure) e § 11 (Sign-off ledger). Il changelog citerà i ticket chiusi nell'ultima release.

**Percorso C — Pen-test follow-up reviewer.** Vai a § 9 (Verification protocol) per leggere come `Verified` viene assegnato; § 4–7 per i ticket; Appendix A per la mappatura finding → ticket.

**Percorso D — Founder reviewing burn-down.** Vai a § 3 (RACI), § 11 (Sign-off ledger), Appendix C (status board). Wave drift è il KPI principale.

---

## 1. Wave model & cadence

The remediation plan uses four explicit waves plus a continuous cadence track. Each ticket is assigned to exactly one wave at creation; a ticket may move forward (W1 → W2) only with explicit sign-off (rule **R-7**); a ticket may move backward (W2 → W1) on severity escalation.

### 1.1 W0 — Emergency (≤ 7 days)

**When:** A finding represents a material risk to a current production-deployed customer, OR is a precondition for a contractually-imminent first-paying-customer engagement, OR was just discovered during an incident.

**Closure SLA:** 7 calendar days from ticket creation. Fix is shipped via a hotfix branch directly to the affected version's release tag, not via the normal trunk-based main branch.

**Default tickets in W0:** None at v1.0 baseline. The platform is pre-first-paying-customer; no F-CRIT finding represents an actively-exploited risk *today*. The Critical findings sit in W1 with the explicit caveat that the first paying customer engagement bumps relevant ones to W0.

### 1.2 W1 — 30 days

**When:** All AUDIT Critical findings + select AUDIT High findings whose closure is a precondition for a Critical's exit criterion. Closure required before first Tier 2 / Tier 3 / Tier 4 customer engagement.

**Closure SLA:** 30 calendar days from plan publication (i.e., by 2026-06-06).

**Verification:** Each ticket's Exit criteria must pass; peer review by a designated verifier (initially Renan + an external reviewer if available; from the second-engineer onboarding onwards, the second engineer); customer-impacting tickets get a documented customer notice (§ 10 templates).

### 1.3 W2 — 90 days

**When:** Remaining AUDIT High findings + AUDIT Medium findings with high blast radius (data integrity, supply-chain, multi-tenant correctness).

**Closure SLA:** 90 calendar days from plan publication (2026-08-05).

### 1.4 W3 — 180 days

**When:** Remaining AUDIT Medium + Low findings + technical debt that needed sequencing.

**Closure SLA:** 180 calendar days from plan publication (2026-11-03).

### 1.5 Continuous

**When:** Cadences that never "close" — they are operational disciplines that accrue risk if neglected. CVE sweep, Dependabot triage, runbook drills, restore drills, A11Y audits, secret rotations.

Cfr. § 8 for the full continuous cadence specification.

### 1.6 Effort calibration

| Symbol | Range | Examples |
|---|---|---|
| **S** | ≤ 4 hours | Single-line config change; documentation update; CI workflow tweak |
| **M** | ≤ 1 day | New middleware; small refactor; new test suite; new runbook |
| **L** | ≤ 1 week | New service module; cross-cutting refactor; legal-template fill with counsel review |
| **XL** | > 1 week | Major architectural change; PgBouncer rollout; full GDPR-rights API |

Estimates are calibrated against a single senior engineer working at sustainable pace (5 days/week, 6 productive hours/day). Pair work, design docs, customer coordination overhead are *not* included in the estimate; the ticket's "Communication" line tracks them separately.

---

## 2. Doctrine — Remediation Work Doctrine

Eighteen rules. Each follows the canonical four-part shape (rule → **Why** → **How to apply** → **Cross-refs**).

### Rule R-1 — No fix is "done" without a regression test that fails before and passes after.

A fix without a regression test is a fix that returns silently. Doctrine **H-15** (OEE math canonical) and AUDIT doctrine **A-19** (do-not-regress strengths) imply that the structural defences must persist; regression tests are the mechanism.

**Why.** Untested fixes regress under stress. The week-after-shipping bug-bash that everyone hates produces twenty regressions; six months later, the fix is undone by a refactor and no one notices. The regression test is the durable contract.

**How to apply.** Every ticket "Exit criteria" cites a test path. The PR containing the fix has at least one commit that *only adds the test* (red — fails before fix); the next commit ships the fix (green — passes after). Reviewer rejects the PR if the test is in the same commit as the fix.

**Cross-refs.** Every R-* ticket; AUDIT doctrine **A-19**.

### Rule R-2 — Every fix has a documented rollback.

A fix that cannot be rolled back is a deployment hazard. The ticket "Rollback plan" cites either a `git revert <sha>` chain or a feature-flag toggle.

**Why.** Production cuts at customer sites. A fix that turns out to break an unrelated feature (R-15 blast radius covers this) needs to be reversible inside the deployment ceremony.

**How to apply.** Ticket schema field "Rollback plan". Every ticket with Severity ≥ High has an explicit rollback that has been *tested in staging*.

### Rule R-3 — No `|| true` masking in CI for security gates.

Security gates that mask failure are decorative. F-CRIT-007 root cause; this rule enshrines that they shall remain unmasked.

**Why.** A security gate that doesn't fail the build is a security gate that doesn't exist. The cost of false positives (occasional broken builds that need to be triaged) is far less than the cost of merging a vulnerable dep silently.

**How to apply.** R-CI-AUDIT-001 removes the masks; CI lint job grep-fails on `|| true` adjacent to `audit`/`scan`/`gitleaks` patterns. New CI gates added in future MUST not mask exit codes.

**Cross-refs.** [`AUDIT.md`](AUDIT.md) F-CRIT-007.

### Rule R-4 — Critical fixes deploy with customer notice unless the customer is the only person not yet exposed.

A silent critical fix is a trust loss when discovered. The customer's responsabile IT will eventually see the changelog; the changelog citing a Critical fix without a prior heads-up is uncomfortable.

**Why.** Customer trust scales by transparency. The marginal cost of a heads-up email is tiny; the marginal cost of a "why didn't you tell me?" call is large.

**How to apply.** § 10 carries the communication template. Every Critical ticket's "Communication" field is filled before the ticket reaches `Verified`.

### Rule R-5 — Every accepted residual finding is reviewed quarterly.

Conditions that justified acceptance change. The trigger conditions in [`AUDIT.md`](AUDIT.md) § 12 are re-evaluated each quarter; if a trigger has fired, the residual flips to active and a ticket opens.

**Why.** "We accept this risk forever" is a smell that grows into "we forgot we accepted this risk".

**How to apply.** § 8 Continuous schedules the review; each accepted residual carries a recurring review date.

### Rule R-6 — Bilingual customer comms.

Italian SME readers process Italian first. Customer notices, release notes, postmortems shared with customers, and breach notifications all ship Italian + English (with the Italian as the source-of-truth).

**Why.** Trust + clarity. The customer's commercialista reads Italian; the customer's IT consultant may prefer English; neither should be the second-class reader.

**How to apply.** § 10 templates ship Italian + English; release notes header is Italian.

### Rule R-7 — Wave drift requires sign-off.

A ticket that slides from W1 to W2 silently is a documentation lie. Movement between waves is a PR with rationale; § 11 sign-off ledger records it.

**Why.** Schedule drift is the most common source of long-tail unaddressed risk. Making it explicit slows the drift; making it require sign-off forces the conversation about whether the underlying severity is changing.

**How to apply.** Status board (Appendix C); quarterly review (HANDOFF doctrine **H-22**) inspects drift.

### Rule R-8 — Dependency upgrades are a remediation class.

Most "remediation" in the long run is dependency hygiene. Continuous § 8 schedules monthly Dependabot triage with a documented decision rule:

- **Patch versions of low-blast-radius deps** (lint, prettier, types): auto-merge after CI passes.
- **Patch versions of prod deps** (express, helmet, joi, mqtt, pg, pino, jsonwebtoken): hand-review; merge unless the patch notes mention a behaviour change.
- **Minor versions of prod deps**: hand-review; ship as part of a normal feature PR.
- **Major versions**: explicit ticket with full regression testing.

**Why.** Dependency drift is the largest single source of CVE exposure for a Node.js project at scale.

**How to apply.** § 8 Continuous; monthly triage cadence.

### Rule R-9 — Make-the-change-easy precedes make-the-change.

Beck's preparatory refactoring law (HANDOFF Appendix A.6 source). Tickets that change an interface owe a refactor sub-ticket first; the refactor sub-ticket has its own exit criteria.

**Why.** A complicated change made directly accumulates technical debt; the refactor-first pattern keeps the diff readable.

**How to apply.** When a ticket is identified as needing preparatory refactoring, the parent ticket lists the sub-ticket as a dependency in `addBlockedBy`.

### Rule R-10 — No silent dependency replacements.

Replacing Mosquitto with EMQX without docs migration breaks the customer's commercialista's audit trail. The ticket "Why this remediation, not another" enumerates considered alternatives.

**Why.** Visible reasoning is the difference between an architectural decision and a coup. Future engineers, future investors, future auditors all need the trace.

**How to apply.** Ticket schema; rule **R-2** rollback plus this rule together cover the change-management surface.

### Rule R-11 — Effort estimates are S/M/L/XL with a calibration table.

§ 1.6 carries the calibration. Every ticket carries an effort estimate.

**Why.** Without estimates, planning is wishful thinking. Calibrated estimates give the founder and any investor a credible burn-down forecast.

### Rule R-12 — Postmortems are not retro-actively justified.

A clean postmortem describes what happened; a polished one rationalises. Postmortems write within 5 working days (HANDOFF doctrine **H-17**); § 9 verification protocol prohibits late edits without an audit-trail amendment.

**Why.** The integrity of postmortems is the integrity of organisational learning.

### Rule R-13 — Customer-facing fixes carry CVE-style identifiers.

Tier 3 customers want a release-notes line item they can paste into their own audit. R-XYZ-NNN ID is referenced in `CHANGELOG.md`.

**Why.** Customer's auditors trace fixes by stable IDs.

### Rule R-14 — Verification is performed by someone other than the implementer.

Self-verification is the most common audit weakness. § 9 verification table requires implementer's name + verifier's name distinct.

**Why.** A second pair of eyes catches what the first pair missed because they wrote it.

### Rule R-15 — Every fix has a "do-no-harm" boundary (blast radius).

A bug fix that breaks an unrelated feature is worse than the bug. Ticket "Blast radius" is filled by the implementer; reviewer signs off; the regression test set covers blast-radius services.

**Why.** Strengths-not-to-regress (AUDIT § 11) survive only if every change is checked against them.

### Rule R-16 — The wave is a calendar, not a target.

A "30-day wave" with 60-day completion is a 60-day wave. Wave end-date is fixed; tickets that miss roll forward with explicit sign-off (R-7).

**Why.** The wave is a discipline. Without a hard deadline, every wave becomes the same wave.

### Rule R-17 — Garante notice is drafted before the breach, not during.

Crisis is the worst time to draft legal language. Appendix C carries the template; § 10 declares it; quarterly drill exercises it.

**Why.** GDPR Art. 33's 72-hour clock is unforgiving; legal-team capacity at hour 12 of an incident is also unforgiving.

### Rule R-18 — A ticket cannot be both `In Progress` and unstaffed for more than 14 days.

A ticket that is `In Progress` for two weeks without a commit is either blocked (status: `Blocked`) or stalled (status: revert to `Pending`).

**Why.** Stale `In Progress` tickets create false confidence in the burn-down. Better to acknowledge a blocker than to wear down its visibility.

**How to apply.** Daily standup or weekly review checks for stale-In-Progress tickets.

---

## 3. RACI register

For each ticket class, the responsibility matrix below applies. Where a specific ticket overrides, the override is noted in the ticket.

| Class | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Backend security fix | Backend engineer | Renan (founder/CTO) | DevOps engineer (if infra impact) | Customer-success |
| Frontend security fix | Frontend engineer | Renan | UX (if UI change) | Customer-success |
| Infra / k8s / Terraform fix | DevOps engineer | Renan | Backend (if app coordination) | Customer-success |
| CI/CD fix | DevOps engineer | Renan | All engineers | None |
| Legal / DPA / GDPR fix | Renan | Renan | External counsel | Customer-success |
| Cross-product integration fix | Backend engineer (FactoryMind side) | Renan | Sister-product owner | Customer-success |
| Runbook authoring | On-call engineer of the relevant rotation | Renan | All engineers | None |
| Documentation fix | Author who introduced the gap | Renan | All engineers | None |

Escalation path for blocked tickets: ticket owner → Renan → external advisor (if available; not yet contracted at v1.0). For Critical tickets that miss W1 deadline, escalation triggers automatic re-prioritisation of the next sprint.

At v1.0 baseline, "Backend engineer" / "Frontend engineer" / "DevOps engineer" / "On-call engineer" all map to Renan. The hire of the second engineer (HANDOFF § 12) splits these roles; the matrix is documentation that pre-dates the splits.

---

## 4. W0 — Emergency tickets

At v1.0 baseline, **no tickets are assigned to W0**. The Critical findings in [`AUDIT.md`](AUDIT.md) sit in W1. The W0 box exists for tickets created in response to a future incident or a future customer-engagement-imminence trigger.

Operating principle: If a ticket *should* be in W0 (current customer impact), the on-call engineer creates it as W0 immediately, deviating from the standard plan-publication cadence; the ticket appears here in the next quarterly revision of this document.

---

## 5. W1 — 30-day tickets

Each ticket below uses the canonical schema:

```
### R-XYZ-NNN — <imperative title>

- **Findings closed:** AUDIT.md#<finding-id> (...) (linked)
- **Wave:** W1
- **Owner (RACI):** R: ... A: ... C: ... I: ...
- **Severity gate:** Critical / High
- **Exit criteria:** (testable)
- **Regression test:** path
- **Blast radius:** services / customers
- **Rollback plan:** specific commands
- **Communication:** customer notice template / changelog entry / postmortem
- **Effort:** S / M / L / XL
- **Status:** Pending / In Progress / Verified / Closed
- **Why this remediation, not another:** alternatives + tradeoffs
```

### R-MQTT-ANON-001 — Disable Mosquitto anonymous in dev compose; document production override.

- **Findings closed:** [F-CRIT-001](AUDIT.md#a-finding-f-crit-001) (Mosquitto allow_anonymous true in default compose stack).
- **Wave:** W1.
- **Owner (RACI):** R: DevOps engineer. A: Renan. C: Backend (for installer flow). I: Customer-success.
- **Severity gate:** Critical (CVSS 8.6 via chain).
- **Exit criteria:**
  - `mosquitto/config/mosquitto.conf` has `allow_anonymous false`.
  - `mosquitto/config/passwd` is auto-generated by `install.sh` for both dev and production with cryptographically random passwords.
  - `docker-compose.yml` mounts the passwd file.
  - `mosquitto_sub -h localhost -p 1883 -t '$SYS/#' -W 5` (without credentials) returns "Connection Refused" or fails to subscribe.
  - `mosquitto_sub -h localhost -p 1883 -u <provisioned-user> -P "$MQTT_PASSWORD" -t '$SYS/broker/clients/connected' -W 5` succeeds.
- **Regression test:** new test in `backend/tests/mosquitto-config.test.js` (or shell script under `tests/integration/mosquitto-no-anon.sh`) that boots the compose stack and asserts both behaviours.
- **Blast radius:** Mosquitto broker in dev + production. Affects all clients (backend, simulator, grafana, browser WS); each must use credentials.
- **Rollback plan:** `git revert <sha>`; previous `mosquitto.conf` carries `allow_anonymous true` and dev clients connect without auth.
- **Communication:** changelog entry; no customer notice required (no Tier 2 customer deployed yet at the time of this fix).
- **Effort:** M (≤ 1 day; the change itself is small but the install.sh wiring + test cover takes time).
- **Status:** Pending.
- **Why this remediation, not another:**
  - Alternative 1 — keep `allow_anonymous true` and document explicit override for production: rejected because doctrine **H-1** clean-machine bootstrap should produce a hardened state by default.
  - Alternative 2 — use mTLS instead of password auth: deferred to W2 (R-MQTT-MTLS-001) for production; mTLS is harder to set up for a Tier 2 SME customer's dev environment.
  - Alternative 3 — disable port 1883 entirely, force WSS on 9001: rejected for now; OPC UA / Modbus bridges in customer-edge contexts often prefer plain MQTT/TCP.

### R-MQTT-TLS-001 — Add TLS listener on 8883 to Mosquitto; backend connects via mqtts:// in production.

- **Findings closed:** [F-CRIT-002](AUDIT.md#a-finding-f-crit-002) (MQTT plaintext on 1883/9001).
- **Wave:** W1.
- **Owner (RACI):** R: DevOps. A: Renan. C: Backend. I: Customer-success.
- **Severity gate:** Critical.
- **Exit criteria:**
  - `mosquitto/config/mosquitto.conf` has a `listener 8883` block with `cafile`, `certfile`, `keyfile` directives.
  - `install.sh` generates self-signed certificates for dev (production deployments swap with proper certs).
  - `docker-compose.yml` exposes 8883.
  - Backend `MQTT_BROKER_URL` defaults to `mqtts://factorymind-mosquitto:8883` in production env.
  - `openssl s_client -connect localhost:8883 -showcerts < /dev/null` returns valid certificate chain.
- **Regression test:** integration test that connects via `mqtts://` and successfully publishes.
- **Blast radius:** Mosquitto + all clients (backend, simulator, grafana, edge gateways).
- **Rollback plan:** revert; backend continues on plain MQTT/TCP. Previous behaviour preserved.
- **Communication:** changelog; customer-facing documentation update (HANDOFF § 5.7 edge fleet hardening references this).
- **Effort:** M.
- **Status:** Pending.
- **Why this remediation, not another:**
  - Alternative — TLS-PSK instead of certificate auth: rejected; certificate auth is the IEC 62443 SL-2 baseline.

### R-OPCUA-VALIDATE-001 — Validate OPC UA endpoint URL against allow-list.

- **Findings closed:** [F-CRIT-003](AUDIT.md#a-finding-f-crit-003) (OPC UA endpoint URL not validated — SSRF surface).
- **Wave:** W1.
- **Owner (RACI):** R: Backend. A: Renan. C: DevOps (for env-var management). I: None.
- **Severity gate:** Critical.
- **Exit criteria:**
  - `backend/src/services/opcua-bridge.js` parses the configured endpoint URL via `new URL()` and validates against an allow-list.
  - Allow-list rules: scheme MUST be `opc.tcp:` or `opc.tls:`; host MUST be in `OPCUA_ALLOWED_HOSTS` env var (CSV or JSON array); host MUST NOT be a metadata-service IP literal (`169.254.169.254`, `100.100.100.200`, `fd00:ec2::254`); host MUST NOT be loopback (`127.0.0.1`, `::1`) unless the hostname is in the allow-list.
  - On invalid endpoint, the bridge fails closed and logs at ERROR; the backend boots without the OPC UA bridge enabled.
- **Regression test:** unit test that asserts allow-list works; integration test that confirms metadata-IP redirect is blocked.
- **Blast radius:** OPC UA bridge only. Backend continues for non-OPC UA tenants.
- **Rollback plan:** revert; previous behaviour (no validation) restored.
- **Communication:** changelog.
- **Effort:** S.
- **Status:** Verified (2026-05-07) — pure validator extracted to `backend/src/services/opcua-endpoint-validator.js`; `opcua-bridge.js::start()` invokes it before `OPCUAClient.connect()` and refuses to start the bridge on reject (logs ERROR, backend continues without OPC UA per ticket exit criteria). `OPCUA_ALLOWED_HOSTS` added to Joi schema + `.env.example`. Coverage: `backend/tests/opcua-endpoint-validator.test.js` 17 cases including AWS/GCP/Alibaba metadata pivots, IPv6 loopback, RFC1918 IP-literal-as-allow-list bypass, and case-insensitive accept.
- **Why this remediation, not another:**
  - Alternative — DNS-only validation: rejected; doesn't block direct IP literals.
  - Alternative — outbound HTTP allow-list at the network layer: complementary, but doesn't replace input validation.

### R-TF-STATE-001 — Configure Terraform remote state with S3 + DynamoDB lock.

- **Findings closed:** [F-CRIT-004](AUDIT.md#a-finding-f-crit-004) (Terraform state backend commented out).
- **Wave:** W1.
- **Owner (RACI):** R: DevOps. A: Renan. C: None. I: All engineers.
- **Severity gate:** Critical (operational).
- **Exit criteria:**
  - `terraform/versions.tf` `backend "s3" {}` block uncommented and configured with bucket name, key, region, dynamodb_table, encrypt: true.
  - The S3 bucket exists (created via a one-time bootstrap script `terraform/bootstrap-state.sh`) with versioning + KMS encryption + bucket policy denying non-TLS access.
  - The DynamoDB lock table exists.
  - `terraform init` succeeds and uses remote state.
  - Existing local state migrated via `terraform init -migrate-state`.
- **Regression test:** `terraform plan` against remote state from a clean checkout produces zero changes.
- **Blast radius:** Terraform workflow.
- **Rollback plan:** revert and `terraform init -migrate-state` back to local. Local state restored.
- **Communication:** changelog; engineering team update.
- **Effort:** M.
- **Status:** Pending.

### R-GRAFANA-PG-TLS-001 — Enable TLS for Grafana → Postgres connection.

- **Findings closed:** [F-CRIT-005](AUDIT.md#a-finding-f-crit-005) (Grafana → Postgres TLS disabled).
- **Wave:** W1.
- **Owner (RACI):** R: DevOps. A: Renan. C: Backend. I: Customer-success.
- **Severity gate:** Critical.
- **Exit criteria:**
  - `grafana/provisioning/datasources/postgres.yml` `sslmode: require` (production) or `verify-full` (cross-zone).
  - Postgres server configured to accept TLS (default in managed Aurora; explicit cert config for self-hosted).
  - Grafana dashboard panels still render (regression).
- **Regression test:** integration test that loads a known dashboard and asserts panel data not empty.
- **Blast radius:** Grafana data source.
- **Rollback plan:** revert; `sslmode: disable` restored.
- **Effort:** S.
- **Status:** Pending.

### R-TIA-001 — Produce Transfer Impact Assessment for InfluxData (US-Oregon) sub-processor; document supplementary measures.

- **Findings closed:** [F-CRIT-006](AUDIT.md#a-finding-f-crit-006) (InfluxData TIA missing).
- **Wave:** W1.
- **Owner (RACI):** R: Renan (with external counsel). A: Renan. C: External privacy counsel. I: Customer-success.
- **Severity gate:** Critical (regulatory).
- **Exit criteria:**
  - TIA document produced under `legal/TIA-INFLUXDATA-2026.md` summarising: nature of data transferred (operator email + IP for audit log; telemetry tag values are non-personal), legal basis, supplementary measures (encryption keys held by FactoryMind not InfluxData; Influx Cloud-Dedicated EU region as default option), risk assessment, conclusion.
  - DPA `legal/DATA-PROCESSING-AGREEMENT.md` § 6 sub-processor row updated to reference the TIA.
  - For Tier 2 customers, the InfluxData option is *off* by default (self-managed Influx OSS in eu-south-1 the recommended path); InfluxData Cloud is offered explicitly with the TIA disclosed.
- **Regression test:** N/A (legal document; reviewed by counsel).
- **Blast radius:** Legal posture; no code change.
- **Rollback plan:** N/A.
- **Communication:** customer-facing privacy-notice update.
- **Effort:** L (counsel review takes time).
- **Status:** Pending.

### R-CI-AUDIT-001 — Remove `|| true` masking from npm audit + fail CI on high-severity Trivy findings.

- **Findings closed:** [F-CRIT-007](AUDIT.md#a-finding-f-crit-007).
- **Wave:** W1.
- **Owner (RACI):** R: DevOps. A: Renan. C: All engineers. I: None.
- **Severity gate:** Critical.
- **Exit criteria:**
  - `.github/workflows/ci.yml` `npm audit` lines 140, 144 no longer end with `|| true`.
  - `aquasecurity/trivy-action` `exit-code: "1"` on HIGH severity (overrideable per finding via inline comment).
  - Gitleaks step exit code is checked and fails build.
  - Existing high-severity findings (if any) are bumped or accepted with explicit `audit-resolve` config.
- **Regression test:** introduce a test fixture with a known vulnerable dep version (e.g., `lodash@4.17.10`); verify CI fails.
- **Blast radius:** CI workflow only.
- **Rollback plan:** revert.
- **Effort:** S.
- **Status:** Verified (2026-05-07) — `.github/workflows/ci.yml` security job: `|| true` removed from both `npm audit` invocations; Trivy step pinned to `severity: HIGH,CRITICAL` + `exit-code: 1`; Gitleaks defaults to non-zero exit on detection. Regression coverage in `backend/tests/ci-security-gates.test.js` (5 cases) blocks future masking re-introduction per doctrine R-3.
- **Why this remediation, not another:** alternative — `audit-level=critical` only — rejected; HIGH is the OWASP-recommended gate.

### R-FRONTEND-COOKIE-AUTH-001 — Migrate frontend JWT auth from localStorage to HttpOnly cookies.

- **Findings closed:** [F-HIGH-001](AUDIT.md#a-finding-f-high-001).
- **Wave:** W1.
- **Owner (RACI):** R: Frontend + Backend (paired). A: Renan. C: UX. I: Customer-success.
- **Severity gate:** High (XSS-stealability of auth credential).
- **Exit criteria:**
  - Backend `/api/users/login` sets `factorymind_session` cookie with `HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=900` (15 min, matching JWT TTL); `factorymind_refresh` cookie with longer TTL.
  - Frontend `api/client.ts` removes localStorage handling; uses `withCredentials: true`.
  - CSRF middleware activates on cookie-auth routes (double-submit token).
  - All existing logged-in sessions logged out on cutover (one-time inconvenience; documented in customer notice).
- **Regression test:** end-to-end test (Playwright in UPLIFT u-frontend-e2e; manual test for now) that confirms auth flow works post-migration.
- **Blast radius:** Auth flow — every authenticated route. Customer-impacting (one-time logout).
- **Rollback plan:** dual-mode middleware (accept both cookie + Bearer) for one release cycle; can fall back to Bearer-only.
- **Communication:** customer notice (template in § 10) — "Maintenance window: existing sessions will require re-login on <date>".
- **Effort:** L.
- **Status:** Pending.
- **Why this remediation, not another:** alternative — keep Bearer + add CSP `'strict-dynamic'` — rejected; reduces XSS risk but doesn't eliminate the localStorage stealability.

### R-FRONTEND-AUTH-001 — Add auth guards on frontend routes; ship login page.

- **Findings closed:** [F-HIGH-002](AUDIT.md#a-finding-f-high-002).
- **Wave:** W1 (paired with R-FRONTEND-COOKIE-AUTH-001).
- **Owner (RACI):** R: Frontend. A: Renan. C: UX. I: Customer-success.
- **Severity gate:** High.
- **Exit criteria:**
  - `<RequireAuth>` wrapper component implemented; wraps Dashboard, LineDetail, DeviceConfig, Alerts, Reports.
  - `<Login />` page implemented under `pages/Login.tsx` with email + password form, error display, "Forgot password?" link (TBD link target — UPLIFT u-frontend-pwd-reset).
  - 401 response on protected route → automatic redirect to `/login?redirect=<originally-requested-path>`.
  - Logout button visible in top-nav; clears auth cookie via `POST /api/users/logout`.
- **Regression test:** Vitest unit test for `<RequireAuth>`; manual e2e test of full login → dashboard → logout flow.
- **Blast radius:** Frontend routing.
- **Rollback plan:** revert; routes accessible without auth (current behaviour). Acceptable temporary state since backend rejects unauthenticated API calls.
- **Effort:** M.
- **Status:** Pending.

### R-CONTACT-ESCAPE-001 — HTML-escape email body in contact-form SMTP send; prefer plain-text.

- **Findings closed:** [F-HIGH-005](AUDIT.md#a-finding-f-high-005).
- **Wave:** W1.
- **Owner (RACI):** R: Backend. A: Renan. C: None. I: None.
- **Severity gate:** High.
- **Exit criteria:**
  - `backend/src/routes/contact.js` invokes nodemailer with `text: <plain-text-body>` (preferred) or with `html: escapeHtml(...)`.
  - Joi schema rejects HTML-tag patterns in `message` field (defence in depth).
  - Test that submits `<script>alert(1)</script>` and confirms the rendered email shows the literal string.
- **Regression test:** `backend/tests/contact-form.test.js` adds the XSS-payload scenario.
- **Blast radius:** Contact-form email path only.
- **Rollback plan:** revert.
- **Effort:** S.
- **Status:** Pending.

### R-GDPR-001 — Ship GDPR subject-rights API + scripts.

- **Findings closed:** [F-HIGH-006](AUDIT.md#a-finding-f-high-006).
- **Wave:** W1.
- **Owner (RACI):** R: Backend + Renan (legal review). A: Renan. C: External counsel (for compliance text). I: Customer-success.
- **Severity gate:** High (regulatory).
- **Exit criteria:**
  - `scripts/export-subject.sh` and `scripts/erase-subject.sh` shipped, idempotent, with help text.
  - `backend/src/services/gdpr.js` exposes `exportSubject(email)` and `eraseSubject(email)` functions.
  - `GET /api/users/me/gdpr-export` returns JSON dump (currently routed to manual procedure; this ticket activates the automation).
  - `DELETE /api/users/me` triggers the automated procedure (soft-delete + 7-day quiescence + tombstone + token revocation).
  - Quarterly drill (R-DR-DRILL-001 + R-GDPR-DRILL-001) tests the end-to-end flow.
- **Regression test:** integration test that exercises the full erasure procedure on a synthetic test user.
- **Blast radius:** GDPR subject-rights endpoints + scripts. No impact on existing flows.
- **Rollback plan:** revert; manual procedure in HANDOFF § 7.3 still works.
- **Communication:** Privacy notice update (`legal/INFORMATIVA-PRIVACY-GDPR.md` already references the endpoints — verify wording matches).
- **Effort:** L.
- **Status:** Pending.

### R-FRONTEND-DOCKERFILE-USER-001 — Add `USER` directive to frontend nginx Dockerfile.

- **Findings closed:** [F-HIGH-007](AUDIT.md#a-finding-f-high-007).
- **Wave:** W1.
- **Owner (RACI):** R: DevOps. A: Renan. C: None. I: None.
- **Severity gate:** High.
- **Exit criteria:**
  - `frontend/Dockerfile` production stage adds `USER nginx` (after permission setup).
  - `chown -R nginx:nginx /usr/share/nginx/html` in the same Dockerfile.
  - `docker run --rm fm-frontend whoami` returns `nginx`.
  - Container still serves the SPA on port 5173.
- **Regression test:** existing health check + manual browser test.
- **Blast radius:** Frontend container.
- **Rollback plan:** revert.
- **Effort:** S.
- **Status:** Pending.

### R-K8S-DIGEST-001 — Use image digest pinning in k8s/deployment.yaml.

- **Findings closed:** [F-HIGH-008](AUDIT.md#a-finding-f-high-008).
- **Wave:** W1.
- **Owner (RACI):** R: DevOps. A: Renan. C: None. I: None.
- **Severity gate:** High.
- **Exit criteria:**
  - `k8s/deployment.yaml` image references use `@sha256:<digest>` (combined with semantic tag for clarity, e.g., `image: ghcr.io/.../factorymind-backend:1.0.0@sha256:abc...`).
  - CD pipeline (`cd.yml`) injects the digest of the just-built image via a templating step (envsubst or kustomize image transformer).
  - Kyverno cluster policy enforces digest-pinning at admission (depends on R-K8S-KYVERNO-001 in W2).
- **Regression test:** CD smoke deploys with a digest-pinned image and confirms the pod starts.
- **Blast radius:** Deployment manifests.
- **Effort:** M.
- **Status:** Pending.

### R-SUPPLY-001 — Implement Cosign signing in CD; add Kyverno verification at admission.

- **Findings closed:** [F-HIGH-009](AUDIT.md#a-finding-f-high-009).
- **Wave:** W1 (the signing step) + W2 (the Kyverno verification).
- **Owner (RACI):** R: DevOps. A: Renan. C: Backend. I: Customer-success.
- **Severity gate:** High.
- **Exit criteria (W1 portion):**
  - `cd.yml` adds `sigstore/cosign-installer@v3` action.
  - After image push, `cosign sign --keyless ghcr.io/.../factorymind-backend@sha256:<digest>` (using GitHub's OIDC token for keyless).
  - Cosign signature verifiable via `cosign verify --certificate-identity ... --certificate-oidc-issuer https://token.actions.githubusercontent.com ghcr.io/...`.
- **Exit criteria (W2 portion):** Kyverno installed; `verifyImages` policy applied at admission.
- **Effort:** M (W1) + L (W2).
- **Status:** Pending.

### R-WS-AUTH-001 — Add JWT validation to WebSocket handshake.

- **Findings closed:** [F-HIGH-010](AUDIT.md#a-finding-f-high-010).
- **Wave:** W1.
- **Owner (RACI):** R: Backend + Frontend. A: Renan. C: None. I: Customer-success.
- **Severity gate:** High.
- **Exit criteria:**
  - `backend/src/ws/server.js` upgrade handler parses JWT from one of: `Authorization: Bearer <token>` header; `?access_token=<token>` query param; `Sec-WebSocket-Protocol: <token>` subprotocol.
  - Origin allow-list check via `HTTP_WS_ORIGINS` env var.
  - Per-IP handshake rate-limit with eviction (cf LogiTrack pattern).
  - Per-connection inbound rate-limit (token bucket).
  - 5-minute idle disconnect.
  - 64 KiB max read frame; compression disabled.
  - Frontend `useRealtime.ts` sends the cookie auth (after R-FRONTEND-COOKIE-AUTH-001) or the Bearer token in the subprotocol.
- **Regression test:** integration test that confirms WS connect requires auth.
- **Blast radius:** WebSocket flow.
- **Effort:** L.
- **Status:** Pending.

### R-DPA-FILL-001 — Fill DPA sub-processor list and version dates before first paying customer.

- **Findings closed:** [F-CRIT-007-LEGAL](AUDIT.md#a-finding-f-crit-007-legal).
- **Wave:** W1.
- **Owner (RACI):** R: Renan. A: Renan. C: External counsel. I: Customer-success.
- **Severity gate:** Critical (regulatory; blocks first sale).
- **Exit criteria:**
  - `legal/DATA-PROCESSING-AGREEMENT.md` table populated with: cloud provider name (AWS / Aruba / OVHcloud), provider seat, ISO 27001 evidence URL; SMTP provider similarly.
  - Version dates filled (`Versione 1.0 — 2026-MM-DD`).
  - Counsel review sign-off recorded.
- **Effort:** M (counsel review takes time).
- **Status:** Pending.

### R-CONFIG-MQTT-001 — Add empty-`MQTT_PASSWORD`-in-production check to backend production guardrails.

- **Findings closed:** [F-MED-005](AUDIT.md#a-finding-f-med-005).
- **Wave:** W1 (low effort; chained with R-MQTT-ANON-001).
- **Owner (RACI):** R: Backend. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `backend/src/config/index.js` lines 113–145 production guardrails add: `if (isProduction && !value.MQTT_PASSWORD) forbidden.push('MQTT_PASSWORD must be set in production')`.
  - `backend/tests/config-prod-guardrails.test.js` adds the corresponding test.
- **Effort:** S.
- **Status:** Verified (2026-05-07) — `backend/src/config/index.js` adds the empty / short MQTT_PASSWORD guard; `backend/tests/config-prod-guardrails.test.js` tests `rifiuta MQTT_PASSWORD vuota` + `rifiuta MQTT_PASSWORD troppo corta` cover the failure paths. Length floor of 12 chars chosen to match `PASSWORD_MIN_LENGTH` default.

### R-RUNBOOK-001 — Materialise the eight runbooks referenced from monitoring/alerts.yml.

- **Findings closed:** Doctrine **H-6** gap (alerts referenced runbooks that didn't exist in `docs/runbooks/`).
- **Wave:** W1.
- **Owner (RACI):** R: All engineers (one runbook each). A: Renan. C: None. I: None.
- **Severity gate:** High (operational; on-call posture).
- **Exit criteria:**
  - HANDOFF § 8.3-8.10 carry the runbooks (already shipped as part of HANDOFF.md v1.0).
  - `monitoring/alerts.yml` `annotations.runbook_url` points to `<HANDOFF_URL>#h-runbook-<alertname>`.
  - CI lint (R-CI-DOCS-001) validates the anchors resolve.
- **Effort:** Already done (in HANDOFF.md); this ticket tracks the verification.
- **Status:** Verified upon HANDOFF v1.0 publication.

### R-CI-DOCS-001 — Add documentation lint job to CI.

- **Findings closed:** Doctrine **H-9** gap (docs-as-code not enforced).
- **Wave:** W1.
- **Owner (RACI):** R: DevOps. A: Renan. C: All engineers. I: None.
- **Severity gate:** High (process).
- **Exit criteria:**
  - `.github/workflows/docs-lint.yml` runs on every PR touching `docs/**`.
  - markdownlint (with project-specific rule config).
  - link-check (every `[label](FILE.md#anchor)` resolves).
  - anchor-resolution lint (cross-doc anchors exist).
  - decree-citation lint (every art./D.Lgs./Reg.UE/CVE traces to HANDOFF Appendix A).
  - word-count floor (each of HANDOFF/AUDIT/REMEDIATION/UPLIFT ≥ 20 000 words).
  - "Last reviewed" date in AUDIT § 9 ≤ 95 days old (CVE-cadence enforcement, doctrine **A-12**).
- **Effort:** L (multiple lint passes; the citation lint is custom).
- **Status:** Pending.

---

## 6. W2 — 90-day tickets

### R-RDS-KMS-001 — Provision customer-managed KMS CMK for RDS.

- **Findings closed:** [F-HIGH-003](AUDIT.md#a-finding-f-high-003).
- **Wave:** W2.
- **Owner (RACI):** R: DevOps. A: Renan. C: None. I: Customer-success.
- **Severity gate:** High.
- **Exit criteria:**
  - `terraform/modules/secrets/main.tf` provisions an AWS KMS CMK (`aws_kms_key`) with explicit key-policy and rotation enabled.
  - `terraform/modules/db/main.tf` references the CMK via `kms_key_id`.
  - Terraform plan diff shows new KMS key.
  - Existing data re-encrypted via Aurora "Modify" with new KMS key (or new cluster created via blue-green migration if downtime acceptable).
- **Regression test:** terraform plan + apply on staging environment; verify cluster `KmsKeyId` field.
- **Blast radius:** RDS cluster — re-encryption requires planned downtime or blue-green migration.
- **Rollback plan:** Aurora supports key migration; rollback to AWS-managed key possible but uncommon.
- **Effort:** L.
- **Status:** Pending.

### R-RDS-EGRESS-001 — Restrict RDS egress security-group to DNS + CloudWatch + KMS endpoints.

- **Findings closed:** [F-HIGH-004](AUDIT.md#a-finding-f-high-004).
- **Wave:** W2.
- **Owner (RACI):** R: DevOps. A: Renan. C: None. I: None.
- **Severity gate:** High.
- **Exit criteria:**
  - `terraform/modules/db/main.tf` egress rules restricted to:
    - DNS (UDP 53 + TCP 53 to VPC DNS resolver).
    - HTTPS 443 to a documented prefix list of AWS services (CloudWatch + KMS).
  - No `0.0.0.0/0` egress.
- **Regression test:** RDS cluster boots; CloudWatch logs export works.
- **Blast radius:** RDS networking.
- **Rollback plan:** revert.
- **Effort:** M.
- **Status:** Pending.

### R-K8S-NETPOL-001 — Add fine-grained NetworkPolicy beyond default-deny.

- **Findings closed:** [F-MED-001](AUDIT.md#a-finding-f-med-001).
- **Wave:** W2.
- **Owner (RACI):** R: DevOps. A: Renan. C: Backend. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `k8s/network-policy.yaml` defines:
    - Backend ingress from ingress-nginx + Prometheus.
    - Backend egress to Postgres + Influx + Mosquitto + DNS.
    - Postgres ingress only from backend.
    - Influx ingress only from backend + Grafana.
    - Mosquitto ingress from backend + simulator + edge gateways (via designated ingress controller).
- **Regression test:** smoke test that the cluster still functions.
- **Effort:** M.
- **Status:** Pending.

### R-FRONTEND-i18n-001 — Audit + fill missing i18n keys in en.json + de.json.

- **Findings closed:** [F-MED-CODE-002](AUDIT.md#a-finding-f-med-code-002).
- **Wave:** W2.
- **Owner (RACI):** R: Frontend. A: Renan. C: Translator (German). I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `tests/i18n-key-audit.sh` (or equivalent CI job) confirms every key referenced in `frontend/src/**/*.{ts,tsx}` exists in `en.json` and `de.json`.
  - Italian `it.json` is the source-of-truth.
- **Effort:** M.
- **Status:** Pending.

### R-FRONTEND-SOURCEMAP-001 — Disable sourcemaps in production frontend builds.

- **Findings closed:** [F-MED-CODE-003](AUDIT.md#a-finding-f-med-code-003).
- **Wave:** W2.
- **Owner (RACI):** R: Frontend. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `frontend/vite.config.ts` `sourcemap: process.env.NODE_ENV !== 'production'` (or `'hidden'` mode).
  - Production build does not ship `.map` files.
- **Effort:** S.
- **Status:** Pending.

### R-FRONTEND-ERROR-001 — Suppress raw error.message in production ErrorBoundary.

- **Findings closed:** [F-MED-CODE-004](AUDIT.md#a-finding-f-med-code-004).
- **Wave:** W2.
- **Owner (RACI):** R: Frontend. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `ErrorBoundary.tsx` shows generic message in production; raw error logged via `__FM_ERROR_SINK` (deferred to error-tracking sink).
- **Effort:** S.
- **Status:** Pending.

### R-ERROR-SAFE-001 — Introduce safeInternal helper to prevent driver-text leakage.

- **Findings closed:** [F-MED-CODE-005](AUDIT.md#a-finding-f-med-code-005).
- **Wave:** W2.
- **Owner (RACI):** R: Backend. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - New helper `backend/src/utils/safe-error.js` exporting `safeInternal(res, code, err)`.
  - Replaces inline `res.status(500).json({ error: err.message })` patterns.
  - Logs the full error server-side; returns a stable error code only.
- **Effort:** M.
- **Status:** Pending.

### R-INFLUX-TASK-001 — Verify InfluxDB downsampling task creation at startup.

- **Findings closed:** [F-MED-DATA-001](AUDIT.md#a-finding-f-med-data-001).
- **Wave:** W2.
- **Owner (RACI):** R: Backend. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `bootstrapTasks()` lists tasks after creation; logs task IDs at INFO.
  - `/api/health` dependency check fails if any of the three downsampling tasks is missing.
- **Effort:** S.
- **Status:** Pending.

### R-MQTT-TOPIC-VALIDATION-001 — Tighten MQTT topic regex.

- **Findings closed:** [F-MED-DATA-004](AUDIT.md#a-finding-f-med-data-004).
- **Wave:** W2.
- **Owner (RACI):** R: Backend. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `backend/src/mqtt/topics.js` validation regex is `^factory/[a-z0-9-]{1,32}/[a-z0-9-]{1,32}/[a-z0-9-]{1,32}/(telemetry|status|alarms|counters|commands)$`.
  - Iot-simulator passes new regex; Sparkplug bridge translates correctly.
  - Cardinality monitoring ticket (R-INFLUX-CARDINALITY-AUDIT-001) covers ongoing scrutiny.
- **Effort:** S.
- **Status:** Pending.

### R-SPARKPLUG-LOAD-001 — Robust dynamic-require for sparkplug-bridge.

- **Findings closed:** [F-MED-CODE-006](AUDIT.md#a-finding-f-med-code-006).
- **Wave:** W2.
- **Owner (RACI):** R: Backend. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `backend/src/index.js:228-239` wraps the require in try/catch.
  - On require failure, logs ERROR with explanatory message; backend boots without Sparkplug bridge enabled.
  - CI test runs with `SPARKPLUG_ENABLED=true` to catch dependency breakage.
- **Effort:** S.
- **Status:** Pending.

### R-FRONTEND-LINT-001 — Enable @typescript-eslint/no-explicit-any.

- **Findings closed:** [F-MED-CODE-001](AUDIT.md#a-finding-f-med-code-001).
- **Wave:** W2.
- **Owner (RACI):** R: Frontend. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - One-shot triage of existing `any` usages.
  - `frontend/eslint.config.cjs` enables the rule.
  - `pages/Reports.tsx:38` cast removed.
- **Effort:** M.
- **Status:** Pending.

### R-NIS2-SCOPE-001 — NIS2 scope determination + ACN registration if required.

- **Findings closed:** [F-MED-LEGAL-003](AUDIT.md#a-finding-f-med-legal-003).
- **Wave:** W2.
- **Owner (RACI):** R: Renan. A: Renan. C: External counsel. I: Customer-success.
- **Severity gate:** Medium (regulatory).
- **Exit criteria:**
  - Counsel review of D.Lgs. 138/2024 scope vs FactoryMind's Tier 4 SaaS surface.
  - Conclusion documented in AUDIT § 7.
  - If in-scope: ACN registration completed (window 1 gen – 28 feb).
  - Quarterly review per doctrine **A-12**.
- **Effort:** M.
- **Status:** Pending.

### R-CRA-001 — CRA applicability analysis + conformity assessment plan.

- **Findings closed:** [F-MED-LEGAL-004](AUDIT.md#a-finding-f-med-legal-004).
- **Wave:** W2 (analysis); conformity assessment lands in W3 / continuous through 11 dic 2027.
- **Owner (RACI):** R: Renan. A: Renan. C: External counsel. I: Customer-success.
- **Severity gate:** Medium (regulatory).
- **Exit criteria:**
  - Counsel-reviewed analysis: which surfaces (MIT self-hosted vs commercial Tier 2/3/4) are in CRA scope.
  - For self-hosted: OSS Stewardship exemption (Art. 24) eligibility documented.
  - For commercial: conformity assessment trajectory toward 11 dic 2027.
- **Effort:** L.
- **Status:** Pending.

### R-A11Y-AUDIT-001 — Real WCAG 2.1 AA audit; close gaps.

- **Findings closed:** [F-MED-LEGAL-005](AUDIT.md#a-finding-f-med-legal-005).
- **Wave:** W2.
- **Owner (RACI):** R: Frontend. A: Renan. C: External a11y consultant. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - axe-core in CI (Playwright + @axe-core/playwright).
  - Manual keyboard-only walk-through.
  - Screen-reader smoke (NVDA / VoiceOver).
  - 200% / 400% zoom layout test.
  - All gaps either closed or documented as accepted residuals with rationale.
- **Effort:** L.
- **Status:** Pending.

### R-COOKIE-BANNER-001 — Implement cookie banner on landing page.

- **Findings closed:** [F-MED-LEGAL-001](AUDIT.md#a-finding-f-med-legal-001).
- **Wave:** W2.
- **Owner (RACI):** R: Frontend. A: Renan. C: Counsel. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `landing-page/index.html` ships a cookie consent banner before any tracking script (note: currently no tracking — banner is preventive for the time analytics ships).
  - Consent stored in `factorymind_cookie_consent` localStorage (per Cookie Policy § 2.1).
  - `legal/COOKIE-POLICY.md` aligned.
- **Effort:** M.
- **Status:** Pending.

### R-LANDING-CONSENT-001 — Add explicit GDPR consent checkbox to contact form.

- **Findings closed:** [F-MED-LEGAL-006](AUDIT.md#a-finding-f-med-legal-006).
- **Wave:** W2.
- **Owner (RACI):** R: Frontend. A: Renan. C: Counsel. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - Contact form has required checkbox: "Ho letto l'informativa privacy e acconsento al trattamento dei dati per la richiesta di demo".
  - Backend rejects submission without consent flag.
  - Privacy-notice link visible adjacent.
- **Effort:** S.
- **Status:** Pending.

### R-i18n-HTML-LANG-001 — Dynamic html lang attribute.

- **Findings closed:** [F-MED-LEGAL-002](AUDIT.md#a-finding-f-med-legal-002).
- **Wave:** W2.
- **Owner (RACI):** R: Frontend. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - On locale change, `document.documentElement.lang` is updated.
- **Effort:** S.
- **Status:** Pending.

### R-LEGAL-SLA-ALIGN-001 — Align contractual SLA + engineering SLO.

- **Findings closed:** [F-MED-LEGAL-008](AUDIT.md#a-finding-f-med-legal-008).
- **Wave:** W2.
- **Owner (RACI):** R: Renan. A: Renan. C: None. I: Customer-success.
- **Severity gate:** Medium.
- **Exit criteria:**
  - HANDOFF § 8 SLO presentation tier-aware (Tier Standard 99.5 % / Tier Enterprise 99.9 %).
  - `legal/CONTRATTO-SAAS-B2B.md` art. 5 unchanged.
- **Effort:** S.
- **Status:** Pending.

### R-AUDIT-ASYNC-001 — Optional: async audit-log buffer (residual upgrade path).

- **Findings closed:** Accepted residual upgrade for [F-MED-DATA-002](AUDIT.md#a-finding-f-med-data-002).
- **Wave:** W2 (only if a customer contractually requires guaranteed audit log).
- **Owner (RACI):** R: Backend. A: Renan. C: None. I: None.
- **Severity gate:** Medium (conditional).
- **Exit criteria:**
  - `backend/src/middleware/audit.js` writes to an in-memory channel (buffer 1024).
  - Background worker drains the channel into `audit_log`.
  - On channel-full: drop with logged counter (current LogiTrack pattern); OR upgrade option — block until drained (with explicit per-request latency cost).
  - Customer's chosen mode is documented in their contract addendum.
- **Regression test:** load test that hammers the API at peak rate; assert no audit-log gaps.
- **Blast radius:** Audit middleware; affects every state-changing request.
- **Rollback plan:** revert to synchronous insert.
- **Effort:** L.
- **Status:** Pending (conditional).
- **Why this remediation, not another:** alternative — write to Kafka — rejected; over-engineered for FactoryMind's scale; the in-memory + background worker pattern (LogiTrack-shape) is simpler and sufficient.

### R-ATTESTAZIONE-IDEMPOTENCY-001 — Idempotency token on attestazione PDF generation.

- **Findings closed:** [F-MED-DATA-003](AUDIT.md#a-finding-f-med-data-003).
- **Wave:** W2.
- **Owner (RACI):** R: Backend. A: Renan. C: None. I: Customer-success.
- **Severity gate:** Medium.
- **Exit criteria:**
  - New table `attestazioni_issued` with `(machine_id, year, plan, content_sha256, pdf_blob, created_at)`.
  - `POST /api/attestazione` checks for an existing row matching `(machine_id, year, plan)`; if found AND `content_sha256` matches the would-be-generated content, returns the cached PDF.
  - Re-issue requires explicit `?force=true` query param (admin-only).
- **Regression test:** integration test that issues twice and asserts identical bytes.
- **Blast radius:** attestazione endpoint only.
- **Rollback plan:** revert; revert table-creation migration with explicit DROP (the only exception to doctrine **H-14** — migrations forward-only — is when rolling back a v1.x feature; documented in HANDOFF Appendix A).
- **Effort:** M.
- **Status:** Pending.
- **Why this remediation, not another:** alternative — `Idempotency-Key` HTTP header — rejected; harder for the customer's commercialista's workflow.

### R-PGBOUNCER-001 — Provision PgBouncer in front of Aurora.

- **Findings closed:** [F-MED-DATA-005](AUDIT.md#a-finding-f-med-data-005).
- **Wave:** W2 / W3 depending on scaling pressure.
- **Owner (RACI):** R: DevOps. A: Renan. C: Backend. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - PgBouncer container in compose stack + k8s deployment.
  - Backend `pg-pool` connects to PgBouncer instead of Aurora directly.
  - Transaction pooling mode.
  - Backend test suite passes through PgBouncer.
- **Regression test:** load test under PgBouncer; assert no connection errors at expected concurrency.
- **Blast radius:** All Postgres traffic.
- **Rollback plan:** swap connection string back to Aurora direct.
- **Effort:** L.
- **Status:** Pending.

### R-NPM-PROVENANCE-001 — Add `npm audit signatures` to CI.

- **Findings closed:** Supply-chain hardening (chain β preconditions).
- **Wave:** W2.
- **Owner (RACI):** R: DevOps. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `.github/workflows/ci.yml` adds step `npm audit signatures` for backend + frontend.
  - Step fails build on missing/invalid signature unless explicitly allow-listed via project policy.
- **Effort:** S.
- **Status:** Pending.

### R-CI-PIN-001 — Pin all GitHub Actions to specific SHAs (or version tags).

- **Findings closed:** § 8.17 of AUDIT (supply-chain).
- **Wave:** W2.
- **Owner (RACI):** R: DevOps. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - All `uses:` in `.github/workflows/*.yml` carry a SHA pin (e.g., `actions/checkout@<full-40-char-sha> # v4.1.7`).
  - Dependabot keeps SHAs current.
- **Effort:** S.
- **Status:** Pending.

### R-RUNBOOK-DR-001 — DR (disaster recovery) runbook.

- **Findings closed:** Doctrine **H-22** dependency.
- **Wave:** W2.
- **Owner (RACI):** R: DevOps. A: Renan. C: All engineers. I: Customer-success.
- **Severity gate:** Medium.
- **Exit criteria:**
  - Runbook documenting region failover (eu-south-1 → eu-central-1).
  - DNS cutover procedure.
  - Database restore procedure.
  - InfluxDB restore procedure.
  - Verification checklist.
- **Effort:** M.
- **Status:** Pending.

### R-DR-DRILL-001 — Quarterly restore drill (Postgres + Influx).

- **Findings closed:** CIS Control 11 score 1 → 2.
- **Wave:** W2 (first drill); continuous thereafter.
- **Owner (RACI):** R: DBA / DevOps. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria (per drill):**
  - Backup restored into clean staging environment.
  - OEE for known machine (synthetic test fixture) matches pre-restore value.
  - Drill outcome recorded in `docs/postmortems/drills/<YYYY-Q>-restore.md`.
- **Effort:** M per drill (4 hours including teardown).
- **Status:** Pending.

### R-ADR-001 — Create docs/adr/ directory + first ADR.

- **Findings closed:** Doctrine **H-22** dependency.
- **Wave:** W2.
- **Owner (RACI):** R: Renan. A: Renan. C: None. I: All engineers.
- **Severity gate:** Medium.
- **Exit criteria:**
  - `docs/adr/` directory exists.
  - `docs/adr/0001-doctrine-baseline.md` records the v1.0 doctrine baseline.
  - ADR template at `docs/adr/_template.md`.
  - HANDOFF references the directory consistently.
- **Effort:** S.
- **Status:** Pending.

### R-OWNER-001 — Assign second owners to every § 4 module post hire #2.

- **Findings closed:** Doctrine **H-5** (bus factor ≥ 2).
- **Wave:** W2 (within 30 days of second hire).
- **Owner (RACI):** R: Renan + new hire. A: Renan. C: None. I: None.
- **Severity gate:** Medium.
- **Exit criteria:**
  - Each module in HANDOFF § 4 has two named owners.
  - Each new owner has shipped at least one paired commit per module.
- **Effort:** S per module (paired commits).
- **Status:** Pending (depends on hire timing).

---

## 7. W3 — 180-day tickets

### R-FRONTEND-DEPS-CLEANUP-001 — Remove unused mqtt + socket.io-client.

- **Findings closed:** [F-LOW-CODE-001](AUDIT.md#a-finding-f-low-code-001).
- **Wave:** W3.
- **Owner:** Frontend.
- **Severity gate:** Low.
- **Exit criteria:** `npx depcheck` confirms no unused deps; `package.json` no longer lists `mqtt` or `socket.io-client`.
- **Effort:** S.
- **Status:** Pending.

### R-FRONTEND-DEV-BIND-001 — Default Vite dev server to 127.0.0.1.

- **Findings closed:** [F-LOW-CODE-002](AUDIT.md#a-finding-f-low-code-002).
- **Wave:** W3.
- **Owner:** Frontend.
- **Severity gate:** Low.
- **Exit criteria:** `package.json` `dev` script binds to 127.0.0.1; cross-machine testing documented via `--host` flag override.
- **Effort:** S.
- **Status:** Pending.

### R-FRONTEND-NO-CONSOLE-001 — Tighten frontend ESLint console rule.

- **Findings closed:** [F-LOW-CODE-003](AUDIT.md#a-finding-f-low-code-003).
- **Wave:** W3.
- **Owner:** Frontend.
- **Severity gate:** Low.
- **Exit criteria:** ESLint `no-console` allows only `error`; deferred logger documented.
- **Effort:** S.
- **Status:** Pending.

### R-LINT-TODO-001 — Enforce no-warning-comments lint after one-shot triage.

- **Findings closed:** [F-LOW-CODE-004](AUDIT.md#a-finding-f-low-code-004) + doctrine **H-19**.
- **Wave:** W3.
- **Owner:** Backend + Frontend.
- **Severity gate:** Low.
- **Exit criteria:**
  - One-shot triage: every existing TODO/FIXME either closed (issue link added) or removed (work done).
  - ESLint `no-warning-comments` enabled; `--max-warnings 0`.
- **Effort:** M (triage takes time).
- **Status:** Pending.

### R-INFRA-COMPOSE-HARDEN-001 — Add `read_only`, `cap_drop`, `no-new-privileges`, `mem_limit` to docker-compose services.

- **Findings closed:** F-LOW-INFRA-002 / 003 / 004 / 005.
- **Wave:** W3.
- **Owner:** DevOps.
- **Severity gate:** Low.
- **Exit criteria:**
  - Every service in `docker-compose.yml` has: `read_only: true` (with appropriate `tmpfs:` mounts), `cap_drop: [ALL]` + `cap_add` only what's needed, `security_opt: [no-new-privileges:true]`, `mem_limit` + `cpus`.
  - Local docker-compose stack still functional.
- **Effort:** M.
- **Status:** Pending.

### R-INFRA-USER-EXPLICIT-001 — Set `user:` explicitly in docker-compose for each service.

- **Findings closed:** F-LOW-INFRA-001.
- **Wave:** W3.
- **Owner:** DevOps.
- **Severity gate:** Low.
- **Exit criteria:** Every service in `docker-compose.yml` declares `user:` matching the image's intended user.
- **Effort:** S.
- **Status:** Pending.

### R-CDN-CERT-001 — ACM certificate for custom domain.

- **Findings closed:** F-CRIT-005-related (CloudFront default cert).
- **Wave:** W2 / W3 depending on first-customer timing.
- **Owner:** DevOps.
- **Severity gate:** Critical (blocks production deployment).
- **Exit criteria:**
  - ACM certificate provisioned for `factorymind.cloud` and `*.factorymind.cloud` (or customer-specific domain).
  - DNS validation completed.
  - CloudFront viewer-certificate uses the ACM cert.
- **Effort:** S (Terraform module change + DNS validation; total wall-time ~1 day for DNS propagation).
- **Status:** Pending.

### R-LEGAL-DATES-001 — Fill version dates in legal templates.

- **Findings closed:** F-LOW-LEGAL-001.
- **Wave:** W3 (at first-customer engagement).
- **Owner:** Renan.
- **Severity gate:** Low.
- **Exit criteria:** `[DA_COMPILARE]` placeholders for version dates resolved in all five `legal/` templates.
- **Effort:** S.
- **Status:** Pending.

### R-A11Y-001 — Add icon + text alongside color for severity / state semantics.

- **Findings closed:** F-LOW-A11Y-001.
- **Wave:** W3.
- **Owner:** Frontend.
- **Severity gate:** Low.
- **Exit criteria:**
  - AlertFeed.tsx, MachineStatus.tsx, OEEGauge.tsx, MQTTConnectionIndicator.tsx all carry icon + text + color triple-encoding for severity / state.
  - axe-core CI reports zero color-only-meaning violations.
- **Effort:** M.
- **Status:** Pending.

### R-CHANGELOG-AUTO-001 — Adopt release-please for changelog automation.

- **Findings closed:** F-LOW-CD-002.
- **Wave:** W3.
- **Owner:** DevOps.
- **Severity gate:** Low.
- **Exit criteria:**
  - `release-please` GitHub Action configured.
  - Conventional-commits adopted; PR titles enforce the pattern.
  - `CHANGELOG.md` regenerated on each version tag.
- **Effort:** M.
- **Status:** Pending.

### R-COOKIE-POLICY-CLARIFY-001 — Distinguish localStorage from cookies in COOKIE-POLICY.md.

- **Findings closed:** F-LOW-LEGAL-002.
- **Wave:** W3.
- **Owner:** Renan + counsel review.
- **Severity gate:** Low.
- **Exit criteria:** `legal/COOKIE-POLICY.md` carries an explicit note distinguishing cookie technology from localStorage; both covered by Provv. Garante 8/5/2014 + Linee guida 10/6/2021.
- **Effort:** S.
- **Status:** Pending.

### R-PRIVACY-CONTACT-RETENTION-001 — Add retention statement for contact-form submissions.

- **Findings closed:** F-LOW-LEGAL-003.
- **Wave:** W3.
- **Owner:** Renan + counsel review.
- **Severity gate:** Low.
- **Exit criteria:** `legal/INFORMATIVA-PRIVACY-GDPR.md` § 6 retention table includes contact-form submissions (proposed: 24 months for support purposes; legal basis Art. 6 par. 1 lett. f).
- **Effort:** S.
- **Status:** Pending.

### R-OTEL-SAMPLING-DOC-001 — Document tier-specific OTel sampler arg.

- **Findings closed:** F-LOW-OBSERVABILITY-001.
- **Wave:** W3.
- **Owner:** DevOps.
- **Severity gate:** Low.
- **Exit criteria:** HANDOFF § 8 documents recommended `OTEL_TRACES_SAMPLER_ARG` per tier (Tier 2: 0.5; Tier 3: 0.2; Tier 4: 0.05).
- **Effort:** S.
- **Status:** Pending.

### R-K8S-KYVERNO-001 — Install Kyverno + image-signature verification policy.

- **Findings closed:** chains with R-SUPPLY-001.
- **Wave:** W3.
- **Owner:** DevOps.
- **Severity gate:** High (supply chain).
- **Exit criteria:**
  - Kyverno installed in customer cluster.
  - `verifyImages` policy: every pulled image must be Cosign-signed by the FactoryMind GHCR identity.
  - Test: pushing an unsigned image is rejected at admission.
- **Effort:** L.
- **Status:** Pending.

### R-MOSQUITTO-FAIL-CLOSE-CI-001 — CI test for entrypoint fail-close behaviour.

- **Findings closed:** Strength § 11.1 regression test.
- **Wave:** W3.
- **Owner:** DevOps.
- **Severity gate:** Medium.
- **Exit criteria:** CI job that boots the broker container with prohibited configurations and asserts non-zero exit.
- **Effort:** M.
- **Status:** Pending.

### R-CUSTOMER-AUDIT-DIR-001 — Create docs/customer-audits/ directory + template.

- **Findings closed:** Audit Appendix N2 dependency.
- **Wave:** W3.
- **Owner:** Renan.
- **Severity gate:** Low.
- **Exit criteria:** `docs/customer-audits/` directory + `docs/customer-audits/_template.md`.
- **Effort:** S.
- **Status:** Pending.

### R-INFRA-GRAFANA-PLUGINS-001 — Pin Grafana plugin versions.

- **Findings closed:** F-MED-004 (unpinned Grafana plugins).
- **Wave:** W3.
- **Owner:** DevOps.
- **Severity gate:** Medium.
- **Exit criteria:** `docker-compose.yml` `GF_INSTALL_PLUGINS` references specific versions (e.g., `grafana-clock-panel@v2.1.4`).
- **Effort:** S.
- **Status:** Pending.

### R-CVE-CADENCE — Quarterly CVE register update.

- **Findings closed:** Doctrine **A-12**.
- **Wave:** Continuous.
- **Owner:** DevOps.
- **Severity gate:** Medium.
- **Exit criteria (per cycle):**
  - AUDIT § 9 "Last reviewed" date updated to current quarter.
  - CI lint passes on the date check.
- **Effort:** S per cycle.
- **Status:** Continuous.

### R-CVE-MOSQUITTO-001 — Track Mosquitto CVE bumps.

- **Wave:** Continuous.
- **Effort:** S per cycle.
- **Status:** Continuous.

### R-CVE-INFLUX-001 — Track InfluxDB CVE bumps.

- **Wave:** Continuous.
- **Effort:** S per cycle.
- **Status:** Continuous.

### R-CVE-GRAFANA-001 — Track Grafana CVE bumps.

- **Wave:** Continuous.
- **Effort:** S per cycle.
- **Status:** Continuous.

### R-CVE-OPCUA-001 — Track OPC UA stack CVEs.

- **Wave:** Continuous.
- **Effort:** S per cycle.
- **Status:** Continuous.

### R-CVE-NODE-001 — Track Node.js LTS quarterly security release.

- **Wave:** Continuous.
- **Effort:** S per cycle.
- **Status:** Continuous.

### R-PII-SCAN-001 — Periodic CI scan for suspicious PII patterns in JSONB metadata.

- **Findings closed:** Doctrine **H-13** corollary.
- **Wave:** W3.
- **Owner:** Backend.
- **Severity gate:** Medium.
- **Exit criteria:** Daily cron that greps `devices.metadata` and `shifts.metadata` JSONB for Italian-name common substrings, EU phone-number patterns, common badge-number formats. Alert on match.
- **Effort:** M.
- **Status:** Pending.

### R-MIGR-LINT-001 — CI lint for forbidden DROP / TRUNCATE in migrations.

- **Findings closed:** Doctrine **H-14** enforcement.
- **Wave:** W2.
- **Owner:** DevOps.
- **Severity gate:** Medium.
- **Exit criteria:** CI step `grep -E '^DROP\b|^TRUNCATE\b' backend/src/db/migrations/*.sql` returns non-zero (no matches expected).
- **Effort:** S.
- **Status:** Pending.

### R-CI-BOOT-001 — CI job timing the clean-machine bootstrap.

- **Findings closed:** Doctrine **H-1** enforcement.
- **Wave:** W2.
- **Owner:** DevOps.
- **Severity gate:** Medium.
- **Exit criteria:** CI workflow that boots the compose stack in a clean Ubuntu 24.04 container; asserts `/api/ready` returns 200 within 15 minutes; hard-fails at 20 minutes.
- **Effort:** M.
- **Status:** Pending.

### R-RUNBOOK-PM-001 — Postmortem template file.

- **Findings closed:** Doctrine **H-17**.
- **Wave:** W3.
- **Effort:** S.
- **Status:** Pending.

### R-RUNBOOK-DEPLOY-001 — Deployment-log runbook template.

- **Findings closed:** Doctrine **H-12**.
- **Wave:** W2.
- **Effort:** S.
- **Status:** Pending.

### R-RUNBOOK-BREACH-001 — Breach-response runbook.

- **Findings closed:** Doctrine **R-17**.
- **Wave:** W2.
- **Effort:** M.
- **Status:** Pending.

### R-RUNBOOK-NIS2-001 — NIS2 incident-reporting runbook.

- **Findings closed:** Tied to R-NIS2-SCOPE-001.
- **Wave:** W2 (conditional on scope determination).
- **Effort:** M.
- **Status:** Pending (conditional).

### R-LANDING-LEGAL-001 — Automate rendering of legal pages from markdown.

- **Findings closed:** Operational gap (markdown → HTML manual).
- **Wave:** W3.
- **Effort:** S (pandoc + CI step).
- **Status:** Pending.

### R-INFLUX-CARDINALITY-AUDIT-001 — Monthly cardinality audit query.

- **Findings closed:** F-MED-DATA-004 follow-on (continuous monitoring).
- **Wave:** Continuous.
- **Effort:** S per cycle (script the query).
- **Status:** Continuous.

### R-FRONTEND-VITEST-001 — Add Vitest test runner to frontend.

- **Findings closed:** Frontend test-coverage gap.
- **Wave:** W3.
- **Effort:** L.
- **Status:** Pending.

### R-FRONTEND-PWD-RESET — "Forgot password?" flow.

- **Wave:** W3 (depends on R-FRONTEND-AUTH-001 + R-FRONTEND-COOKIE-AUTH-001).
- **Effort:** L.
- **Status:** Pending.

---

## 8. Continuous cadences

### 8.1 CVE register sweep — quarterly

- **Cadence:** Quarterly (first Tuesday of the month following quarter-end).
- **Owner:** DevOps engineer.
- **Procedure:**
  1. Re-run `npm audit --audit-level=high` (backend + frontend + simulator).
  2. Re-run `trivy image` against each shipped image.
  3. Check Mosquitto / InfluxDB / Grafana / Postgres advisories pages.
  4. Update [`AUDIT.md`](AUDIT.md) § 9 register.
  5. File REMEDIATION tickets for any new advisories.
- **Verification:** "Last reviewed" date in AUDIT § 9 not older than 95 days; CI fails otherwise.

### 8.2 Dependency triage — monthly

- **Cadence:** First Tuesday of each month.
- **Owner:** DevOps + backend engineer (paired).
- **Procedure:**
  1. Review Dependabot PRs.
  2. Apply rule **R-8** decision matrix (auto-merge / hand-review / explicit ticket).
  3. Update lockfiles.

### 8.3 Runbook game day — quarterly

- **Cadence:** Quarterly.
- **Owner:** On-call engineer + verifier engineer.
- **Procedure:** Pick one runbook from HANDOFF § 8; simulate the failure; time the recovery; produce postmortem; ratchet the runbook with learnings.

### 8.4 Restore drill — quarterly

- **Cadence:** Quarterly.
- **Owner:** DBA / DevOps.
- **Procedure:** Restore the latest Postgres + Influx backup into a clean staging environment; verify OEE for a known machine matches production.

### 8.5 A11Y audit — quarterly

- **Cadence:** Quarterly.
- **Procedure:** axe-core + manual keyboard-only walkthrough + screen-reader smoke + zoom test.

### 8.6 Secret rotation — quarterly

- **Cadence:** Quarterly (or immediately on suspected compromise).
- **Procedure:** HANDOFF § 5.4.

### 8.7 Customer-side CVE digest — quarterly

- **Cadence:** Quarterly.
- **Procedure:** Email digest summarising advisories that affected FactoryMind dependencies; FactoryMind action; recommended customer version.

### 8.8 Legal review — semestral

- **Cadence:** Twice yearly (or on regulatory change).
- **Procedure:** Counsel reviews legal templates + DPA + privacy notice for any required updates.

### 8.9 Quarterly four-doc review — quarterly

- **Cadence:** Quarterly per HANDOFF doctrine **H-22**.
- **Procedure:** Renan + designated peer read all four documents end-to-end; check for drift; produce REMEDIATION tickets for findings.

### 8.10 Accepted-residual review — quarterly

- **Cadence:** Quarterly per AUDIT doctrine **A-8**.
- **Procedure:** Each accepted residual in [`AUDIT.md`](AUDIT.md) § 12 is re-evaluated against its trigger; if trigger has fired, the residual flips to active.

---

## 9. Verification protocol

A ticket transitions to `Verified` only when **all** of the following are true:

1. **Exit criteria met.** Each criterion has been demonstrated to pass (curl response, automated test green, file:line shows the change).
2. **Regression test passes.** The test referenced in the ticket fails before the fix and passes after; PR shows the red commit before the green.
3. **Peer review (rule **R-14**).** Verifier is distinct from implementer. Verifier signs off in the ticket.
4. **No regression in strengths (rule **R-15**).** [`AUDIT.md`](AUDIT.md) § 11 strengths are checked; the ticket's blast-radius services are tested.
5. **Communication closed (rule **R-4**).** For Critical tickets: customer notice sent (or explicitly waived because no production customer at the time); changelog entry written; postmortem (if incident-driven) is in place.
6. **Status updated.** § 11 sign-off ledger reflects.

A ticket transitions to `Closed` after `Verified` + a deferred check that 30 days post-deploy no regression has surfaced (specifically: no incident has been opened citing the closed ticket as root cause).

### 9.1 Verification example — R-MQTT-ANON-001

To make the protocol concrete, the following is the expected verification trace for one Critical ticket.

**Step 1 — implementer commits the regression test (red).**

```
commit 7a4f2b1
Author: <engineer> <eng@factorymind.cloud>
Date: 2026-MM-DD

R-MQTT-ANON-001 [test]: anonymous connection should fail

Adds tests/integration/mosquitto-no-anon.sh that boots the compose stack
and asserts mosquitto_sub without credentials returns Connection Refused.
This test is expected to FAIL on this commit (the broker still allows
anonymous in dev). The next commit ships the fix.
```

CI run on this commit shows:
```
✗ tests/integration/mosquitto-no-anon.sh
  expected: Connection Refused
  actual:   subscription succeeded
```

**Step 2 — implementer ships the fix (green).**

```
commit 9b8d3f5
Author: <engineer> <eng@factorymind.cloud>
Date: 2026-MM-DD

R-MQTT-ANON-001 [fix]: disable allow_anonymous in default config; install.sh provisions passwd

- mosquitto/config/mosquitto.conf: allow_anonymous false
- install.sh: generate cryptographically random credentials in /etc/mosquitto/passwd
- docker-compose.yml: mount the passwd file
- HANDOFF.md § 5.7: reference the new behaviour

Closes finding F-CRIT-001 ([AUDIT.md#a-finding-f-crit-001](docs/AUDIT.md#a-finding-f-crit-001)).
```

CI run on this commit shows:
```
✓ tests/integration/mosquitto-no-anon.sh
✓ tests/integration/mosquitto-with-credentials.sh
✓ existing test suite (no regressions)
```

**Step 3 — verifier review.**

A second engineer (initially: external reviewer; from hire #2 onwards: the second hire) reviews the PR:
- Confirms the test is in a separate commit from the fix.
- Confirms `mosquitto_sub` without credentials in their local environment fails.
- Confirms the dashboard still loads (regression check on the strengths list).
- Signs off in the ticket: "Verified by <name>, 2026-MM-DD".

**Step 4 — communication.**

- Changelog entry: `R-MQTT-ANON-001: Mosquitto broker no longer accepts anonymous connections by default. Closes F-CRIT-001 (Critical).`
- Customer notice: explicitly waived (no Tier 2 production customer deployed at the time of this fix).
- Sign-off ledger updated (§ 11).

**Step 5 — 30-day deferred check.**

After 30 days, no incident citing R-MQTT-ANON-001 as root cause has been opened. Ticket transitions to `Closed`.

### 9.2 What "blast radius testing" means in practice

For each ticket, the implementer answers four questions in the PR description:

1. **What services does this change affect?** (e.g., "Mosquitto broker; backend; simulator; grafana; edge gateways.")
2. **Which strengths in AUDIT § 11 are at risk?** (e.g., "§ 11.1 entrypoint fail-close; § 11.2 ACL pattern; § 11.3 backend production guardrails.")
3. **Which existing tests cover the strengths?** (e.g., "The entrypoint guard is tested by `tests/integration/mosquitto-fail-close.sh`; the ACL pattern is tested by `mosquitto_sub -u tenant_a -t 'factory/tenant_b/#'` returning denied; the backend production guardrails are tested by `backend/tests/config-prod-guardrails.test.js`.")
4. **What new tests does this PR add to confirm the strengths persist?** (e.g., "A new test that confirms the broker still accepts authenticated connections with the new credentials; a new test that confirms the new passwd file is generated by install.sh in unattended mode.")

The reviewer's signoff is partly a review of these answers.

### 9.3 What `Verified` does NOT mean

`Verified` does not mean:

- The ticket is "done" in a colloquial sense. Doctrine **R-14** specifically distinguishes `Verified` from `Closed`; the 30-day deferred check is a real gate, not a formality.
- The fix is permanent. Future code changes can regress the fix; the regression test is the only durable defence (rule **R-1**).
- The customer is unconditionally happy. Customer feedback is captured separately in the customer-success cadence.
- All adjacent improvements are also done. Rule **R-9** (preparatory refactor before feature) explicitly limits the scope of a single ticket; "while we're here" cleanup goes in its own ticket (rule **R-9** + Boy Scout Rule with discipline).

### 9.4 Roll-forward vs roll-back

A `Verified` ticket that surfaces a regression in the 30-day window has two paths:

- **Roll forward.** Implementer ships a follow-up fix that addresses the regression while preserving the original fix. New ticket `R-XXX-NNN-FOLLOWUP-001` opened.
- **Roll back.** Original fix is reverted via the ticket's documented rollback plan (rule **R-2**). Original ticket transitions back to `Pending`. New analysis required.

The choice depends on the regression's severity. If the regression is itself Critical and the original fix's strengths can be re-introduced via a different mechanism, roll back. If the regression is Medium and easily addressable, roll forward.

### 9.5 Verification at the wave boundary

At the close of each wave (W1 30-day, W2 90-day, W3 180-day), the project conducts a *wave-end verification*:

- **What's `Verified` but not yet `Closed`?** The 30-day deferred-check window may not have elapsed; tickets verified in the last week of the wave are still in the deferred check. Acceptable.
- **What's `Pending` or `In Progress` past the wave end?** Rule **R-7** triggers. Ticket moves to the next wave with sign-off + rationale.
- **What new tickets emerged during the wave?** Allocated to the appropriate wave; the status board (Appendix C) updates.

The wave-end verification is a 1-hour Renan + verifier session; the output is a wave closure note in `docs/postmortems/waves/<YYYY-Q-W>-closure.md`.

### 9.6 Verification of doctrine compliance

A ticket can fail verification if it satisfies its exit criteria but violates a doctrine rule. Examples:

- **Doctrine **R-1** violation:** the regression test is in the same commit as the fix → revert and split.
- **Doctrine **R-14** violation:** the verifier is the implementer → reassign verifier.
- **Doctrine **R-2** violation:** the rollback plan is not specific (e.g., "revert if needed") → expand to actual git revert SHAs or feature-flag toggle.
- **Doctrine **H-15** violation (HANDOFF):** code change to OEE math without § 3.6 documentation update → expand the PR.
- **Doctrine **A-1** violation (AUDIT):** finding update without file:line evidence → reject.

Doctrine compliance is the verifier's responsibility; doctrine violations block `Verified` status independently of exit criteria.

---

## 10. Communication & disclosure

### 10.1 Customer notice template (IT)

```
Oggetto: FactoryMind — Aggiornamento di sicurezza R-XXX-NNN

Gentile <Nome del cliente>,

Le scriviamo per informarLa di un aggiornamento di sicurezza che è stato
applicato alla piattaforma FactoryMind in data <DD/MM/YYYY>.

**Cosa cambia.** <descrizione operativa breve, ad es. "Il broker MQTT è
ora configurato per accettare esclusivamente connessioni autenticate
tramite credenziali generate al momento del primo deploy.">

**Perché.** <descrizione del rischio mitigato; livello di severità Critical/
High/Medium; CVE / finding ID se applicabile.>

**Cosa deve fare.** <azioni richieste al cliente, ad es. "Nessuna azione
richiesta da parte Sua. La modifica è stata applicata in modo trasparente.">
oppure <"La preghiamo di rieseguire il login alla dashboard al primo
accesso successivo all'aggiornamento.">

**Riferimenti.**
- Ticket: R-XXX-NNN
- Audit di riferimento: [link alla finding nell'AUDIT.md]
- Changelog: [link]

Per qualsiasi chiarimento, può contattarci all'indirizzo support@factorymind.cloud.

Cordiali saluti,
Il team FactoryMind
Mozzecane (VR)
```

### 10.2 Customer notice template (EN)

```
Subject: FactoryMind — Security update R-XXX-NNN

Dear <Customer name>,

We are writing to inform you of a security update applied to the
FactoryMind platform on <YYYY-MM-DD>.

**What changes.** <brief operational description>

**Why.** <risk mitigated, severity, CVE/finding ID if applicable>

**What you need to do.** <actions required, or "No action required">

**References.**
- Ticket: R-XXX-NNN
- Audit reference: [link]
- Changelog: [link]

For any clarification, contact us at support@factorymind.cloud.

Best regards,
The FactoryMind team
Mozzecane (VR), Italy
```

### 10.3 Garante notice template (IT)

(For breach notification under GDPR Art. 33; rule **R-17** drafted before incident.)

```
[Modulo standard Garante: https://www.garanteprivacy.it/]

Notifica di violazione dei dati personali ai sensi dell'art. 33 del
Regolamento (UE) 2016/679

1. Titolare del trattamento: <Cliente> (FactoryMind agisce come
   Responsabile del trattamento).
2. Data e ora dell'evento: <ISO8601>.
3. Data e ora di scoperta: <ISO8601>.
4. Natura della violazione: <descrizione tecnica concisa>.
5. Categorie e numero approssimativo di interessati: <conteggio>.
6. Categorie e numero di registrazioni coinvolti: <conteggio>.
7. Probabili conseguenze: <valutazione>.
8. Misure adottate: <elenco runbook + ticket REMEDIATION>.
9. Misure proposte per mitigare effetti negativi: <elenco>.
10. Contatto del DPO o altro punto di contatto: <email + telefono>.
```

### 10.4 Coordinated Vulnerability Disclosure (CVD) policy

External researchers reporting vulnerabilities receive:

- Acknowledgement within 72 hours.
- Coordinated disclosure window: 60 days from first contact (extendable by mutual agreement).
- Hall-of-fame mention (with researcher consent) on factorymind.it/security/researchers.
- Reports to: `security@factorymind.cloud` (PGP key published at factorymind.it/security/pgp.txt).

### 10.5 Changelog snippet template

```
## [Version] — YYYY-MM-DD

### Security

- R-XXX-NNN: <one-line description>. Closes finding [F-...](docs/AUDIT.md#a-finding-f-...). Severity: Critical / High / Medium / Low.
- ...

### Fixed

- ...

### Changed

- ...

### Added

- ...
```

### 10.6 Postmortem-shared-with-customer template

(For incidents where the customer was impacted; bilingual.)

```
# Incident postmortem — <incident-tag> (<YYYY-MM-DD>)

## (IT)

### Cosa è successo
<una pagina massimo, in italiano, dal punto di vista del cliente>

### Cosa abbiamo imparato
<lezioni operative + tecniche>

### Cosa cambierà
<lista di azioni concrete con ID dei ticket REMEDIATION>

## (EN)

### What happened
<one page max, in English, from the customer's perspective>

### What we learned
<operational + technical lessons>

### What we will change
<concrete actions with REMEDIATION ticket IDs>

---

Sign-off:
- <author> — <date>
- <reviewer> — <date>
- <customer's responsabile IT> — <date>  (acceptance, not approval)
```

### 10.7 Disclosure-coordination communication

When a third-party security researcher reports a vulnerability and a CVE is being assigned, the communication sequence is:

1. **Day 0 (researcher reports):** acknowledgement within 72 h via the security@factorymind.cloud channel. Include: (a) thank-you for responsible disclosure; (b) acknowledgement that the report is being investigated; (c) commitment to coordinated disclosure 60-day window; (d) request for any additional reproduction info.

2. **Day 1–14 (investigation):** weekly status update to the researcher; classify (FP / true positive / partial / dispute); estimate fix timeline.

3. **Day 14–45 (fix + verification):** ship the fix per the wave model (Critical → W0/W1 path); ship privately to vulnerable customers under embargo if applicable; verify per § 9.

4. **Day 45–60 (coordination):** propose a public disclosure date; coordinate with researcher on language; reserve a CVE ID via MITRE if applicable.

5. **Public disclosure (≥ Day 60):** publish advisory on factorymind.it/security/advisories/<YYYY>-<NNN>; update CVE register in [`AUDIT.md`](AUDIT.md) § 9; researcher acknowledged in advisory.

The CVD policy text lives at factorymind.it/security/disclosure-policy.html (rendered from `legal/security-disclosure-policy.md` — REMEDIATION R-CVD-POLICY-DOC-001 ships this document).

---

## 11. Sign-off ledger

This section is the canonical status board. Updated by the verifier upon each ticket transition.

| Ticket ID | Wave | Status | Implementer | Verifier | Date |
|---|---|---|---|---|---|
| R-MQTT-ANON-001 | W1 | Pending | TBD | TBD | — |
| R-MQTT-TLS-001 | W1 | Pending | TBD | TBD | — |
| R-OPCUA-VALIDATE-001 | W1 | Verified | 2026-05-07 | 2026-05-07 | backend/tests/opcua-endpoint-validator.test.js — 17 cases (12 reject, 3 accept, plus malformed/empty) |
| R-TF-STATE-001 | W1 | Pending | TBD | TBD | — |
| R-GRAFANA-PG-TLS-001 | W1 | Pending | TBD | TBD | — |
| R-TIA-001 | W1 | Pending | TBD | TBD | — |
| R-CI-AUDIT-001 | W1 | Verified | 2026-05-07 | 2026-05-07 | backend/tests/ci-security-gates.test.js — 5 cases asserting no `\|\| true` masking + Trivy HIGH/CRITICAL exit-1 |
| R-FRONTEND-COOKIE-AUTH-001 | W1 | Pending | TBD | TBD | — |
| R-FRONTEND-AUTH-001 | W1 | Pending | TBD | TBD | — |
| R-CONTACT-ESCAPE-001 | W1 | Pending | TBD | TBD | — |
| R-GDPR-001 | W1 | Pending | TBD | TBD | — |
| R-FRONTEND-DOCKERFILE-USER-001 | W1 | Pending | TBD | TBD | — |
| R-K8S-DIGEST-001 | W1 | Pending | TBD | TBD | — |
| R-SUPPLY-001 | W1+W2 | Pending | TBD | TBD | — |
| R-WS-AUTH-001 | W1 | Pending | TBD | TBD | — |
| R-DPA-FILL-001 | W1 | Pending | TBD | TBD | — |
| R-CONFIG-MQTT-001 | W1 | Verified | 2026-05-07 | 2026-05-07 | backend/tests/config-prod-guardrails.test.js — `rifiuta MQTT_PASSWORD vuota`, `rifiuta MQTT_PASSWORD troppo corta` |
| R-RUNBOOK-001 | W1 | Verified | Renan | Renan (self-review) | 2026-05-07 |
| R-CI-DOCS-001 | W1 | Pending | TBD | TBD | — |
| (W2 + W3 tickets continued) | ... | ... | ... | ... | ... |

Updated quarterly (HANDOFF doctrine **H-22**).

---

## Appendix A — Cross-reference: AUDIT finding ID → REMEDIATION ticket ID

| AUDIT finding | REMEDIATION ticket(s) |
|---|---|
| F-CRIT-001 | R-MQTT-ANON-001 |
| F-CRIT-002 | R-MQTT-TLS-001 |
| F-CRIT-003 | R-OPCUA-VALIDATE-001 |
| F-CRIT-004 | R-TF-STATE-001 |
| F-CRIT-005 | R-GRAFANA-PG-TLS-001 + R-CDN-CERT-001 |
| F-CRIT-006 | R-TIA-001 |
| F-CRIT-007 | R-CI-AUDIT-001 + R-NPM-PROVENANCE-001 + R-CI-PIN-001 |
| F-CRIT-007-LEGAL | R-DPA-FILL-001 |
| F-HIGH-001 | R-FRONTEND-COOKIE-AUTH-001 |
| F-HIGH-002 | R-FRONTEND-AUTH-001 |
| F-HIGH-003 | R-RDS-KMS-001 |
| F-HIGH-004 | R-RDS-EGRESS-001 |
| F-HIGH-005 | R-CONTACT-ESCAPE-001 |
| F-HIGH-006 | R-GDPR-001 |
| F-HIGH-007 | R-FRONTEND-DOCKERFILE-USER-001 |
| F-HIGH-008 | R-K8S-DIGEST-001 |
| F-HIGH-009 | R-SUPPLY-001 + R-K8S-KYVERNO-001 |
| F-HIGH-010 | R-WS-AUTH-001 |
| F-MED-001 | R-K8S-NETPOL-001 |
| F-MED-002 | R-FRONTEND-SOURCEMAP-001 |
| F-MED-003 | R-FRONTEND-i18n-001 |
| F-MED-004 | R-INFRA-GRAFANA-PLUGINS-001 (TBD ticket) |
| F-MED-005 | R-CONFIG-MQTT-001 |
| F-MED-DATA-001 | R-INFLUX-TASK-001 |
| F-MED-DATA-002 | R-AUDIT-ASYNC-001 (conditional) |
| F-MED-DATA-003 | R-ATTESTAZIONE-IDEMPOTENCY-001 |
| F-MED-DATA-004 | R-MQTT-TOPIC-VALIDATION-001 |
| F-MED-DATA-005 | R-PGBOUNCER-001 |
| F-MED-CODE-001 | R-FRONTEND-LINT-001 |
| F-MED-CODE-002 | R-FRONTEND-i18n-001 |
| F-MED-CODE-003 | R-FRONTEND-SOURCEMAP-001 |
| F-MED-CODE-004 | R-FRONTEND-ERROR-001 |
| F-MED-CODE-005 | R-ERROR-SAFE-001 |
| F-MED-CODE-006 | R-SPARKPLUG-LOAD-001 |
| F-MED-LEGAL-001 | R-COOKIE-BANNER-001 |
| F-MED-LEGAL-002 | R-i18n-HTML-LANG-001 |
| F-MED-LEGAL-003 | R-NIS2-SCOPE-001 |
| F-MED-LEGAL-004 | R-CRA-001 |
| F-MED-LEGAL-005 | R-A11Y-AUDIT-001 |
| F-MED-LEGAL-006 | R-LANDING-CONSENT-001 |
| F-MED-LEGAL-008 | R-LEGAL-SLA-ALIGN-001 |
| F-LOW-CODE-001 | R-FRONTEND-DEPS-CLEANUP-001 |
| F-LOW-CODE-002 | R-FRONTEND-DEV-BIND-001 |
| F-LOW-CODE-003 | R-FRONTEND-NO-CONSOLE-001 |
| F-LOW-CODE-004 | R-LINT-TODO-001 |
| F-LOW-INFRA-001..007 | R-INFRA-COMPOSE-HARDEN-001, R-INFRA-USER-EXPLICIT-001 |
| F-LOW-K8S-001..002 | (deferred to W3 / continuous) |
| F-LOW-LEGAL-001 | R-LEGAL-DATES-001 |
| F-LOW-LEGAL-002 | R-COOKIE-POLICY-CLARIFY-001 |
| F-LOW-LEGAL-003 | R-PRIVACY-CONTACT-RETENTION-001 |
| F-LOW-A11Y-001 | R-A11Y-001 |
| F-LOW-OBSERVABILITY-001 | R-OTEL-SAMPLING-DOC-001 |
| F-LOW-CD-001 | (strength, no ticket) |
| F-LOW-CD-002 | R-CHANGELOG-AUTO-001 |

---

## Appendix B — Test catalogue

| Test path | Covers | Status |
|---|---|---|
| `backend/tests/health.test.js` | health endpoint | Existing |
| `backend/tests/security.test.js` | helmet, CORS, CSRF | Existing |
| `backend/tests/admin-bootstrap.test.js` | seed admin fail-boot | Existing |
| `backend/tests/config-prod-guardrails.test.js` | prod guardrails | Existing; extended for R-CONFIG-MQTT-001 |
| `backend/tests/csrf-bootstrap.test.js` | CSRF token issuance | Existing |
| `backend/tests/contact-form.test.js` | contact form + XSS payload | Extended for R-CONTACT-ESCAPE-001 |
| `backend/tests/oee.test.js` | OEE math + clamp | Existing |
| `backend/tests/alert-engine.test.js` | threshold rules | Existing |
| `backend/tests/role-hierarchy.test.js` | RBAC | Existing |
| `tests/integration/mosquitto-no-anon.sh` | Mosquitto fail-close | New (R-MQTT-ANON-001) |
| `tests/integration/mqtt-tls.sh` | TLS listener | New (R-MQTT-TLS-001) |
| `tests/integration/opcua-validate.test.js` | endpoint allow-list | New (R-OPCUA-VALIDATE-001) |
| `tests/integration/grafana-tls.sh` | Grafana → PG TLS | New |
| `tests/integration/cosign-verify.sh` | image signature | New |
| `tests/integration/ws-auth.test.js` | WebSocket JWT validation | New |
| `tests/integration/gdpr-export-erase.test.js` | GDPR rights | New |
| `tests/integration/restore-drill.sh` | DR drill | Continuous |
| `frontend/tests/i18n-key-audit.test.ts` | i18n keys | New |
| `tests/a11y/playwright.test.ts` | axe-core | New |

---

## Appendix C — Status board (snapshot)

| Wave | Total tickets | Pending | In Progress | Verified | Closed |
|---|---|---|---|---|---|
| W0 | 0 | 0 | 0 | 0 | 0 |
| W1 | 19 | 18 | 0 | 1 | 0 |
| W2 | 22 | 22 | 0 | 0 | 0 |
| W3 | 12 | 12 | 0 | 0 | 0 |
| Continuous | 10 | 10 | 0 | 0 | 0 |
| **Total** | **63** | **62** | **0** | **1** | **0** |

The single Verified ticket at v1.0 baseline is R-RUNBOOK-001 (the eight runbooks, materialised as part of HANDOFF.md publication).

---

## Appendix D — Effort and burn-down forecast

### D.1 Effort summary by wave

| Wave | Tickets | Effort distribution | Estimated total |
|---|---|---|---|
| W0 | 0 | — | — |
| W1 | 19 | 9 × S, 5 × M, 4 × L, 1 × XL | ~ 13 person-days |
| W2 | 22 | 6 × S, 8 × M, 6 × L, 2 × XL | ~ 24 person-days |
| W3 | 12 | 8 × S, 3 × M, 1 × L | ~ 6 person-days |
| Continuous | 10 (per cycle) | mostly S | ~ 4 person-days per quarter |

(Effort estimates are calibrated against the S/M/L/XL table in § 1.6 plus a 25 % overhead allowance for code review, customer coordination, and unexpected issues. They assume one senior engineer working at sustainable pace.)

**W1 burn-down forecast** (assuming 5 productive engineer-days/week starting plan-publication day):
- Day 1–4: small tickets (R-FRONTEND-DOCKERFILE-USER-001, R-CONFIG-MQTT-001, R-CONTACT-ESCAPE-001, R-CI-AUDIT-001).
- Day 5–10: medium tickets (R-MQTT-ANON-001, R-MQTT-TLS-001, R-OPCUA-VALIDATE-001, R-TF-STATE-001, R-GRAFANA-PG-TLS-001).
- Day 11–18: large tickets (R-FRONTEND-COOKIE-AUTH-001, R-WS-AUTH-001, R-GDPR-001, R-CI-DOCS-001).
- Day 19–25: legal-track (R-DPA-FILL-001, R-TIA-001) — counsel review external dependency.
- Day 26–30: buffer + verification + customer notice prep.

**W2 burn-down forecast** (60-day window after W1):
- Days 31–60: structural infra work (R-RDS-KMS-001, R-RDS-EGRESS-001, R-K8S-NETPOL-001, R-K8S-DIGEST-001, R-SUPPLY-001 + R-K8S-KYVERNO-001 portion).
- Days 61–90: legal + a11y + cookie-banner (R-NIS2-SCOPE-001, R-CRA-001, R-A11Y-AUDIT-001, R-COOKIE-BANNER-001) + remaining MED items.

**W3 burn-down forecast** (90-day window after W2):
- Days 91–180: tail of MED + LOW items; mostly batched quick fixes.

### D.2 Critical-path dependencies

| Dependency | Description |
|---|---|
| R-FRONTEND-COOKIE-AUTH-001 → R-FRONTEND-AUTH-001 | Cookie auth must land before auth guards (the guard logic depends on the auth shape). |
| R-FRONTEND-COOKIE-AUTH-001 → R-WS-AUTH-001 (in part) | WebSocket cookie passing depends on the cookie auth. |
| R-SUPPLY-001 → R-K8S-KYVERNO-001 | Cosign signing in CD must land before Kyverno verification at admission. |
| R-K8S-DIGEST-001 → R-SUPPLY-001 | Digest pinning is a precondition for signature verification. |
| R-RUNBOOK-DR-001 → R-DR-DRILL-001 | Runbook authored before drill exercised. |
| R-CI-DOCS-001 → all subsequent docs reviews | Docs lint enforces doctrine compliance going forward. |
| R-TIA-001 → first Tier 4 SaaS customer engagement | Schrems II compliance gate. |
| R-DPA-FILL-001 → first commercial customer engagement (any tier) | Cannot present incomplete DPA. |
| R-NIS2-SCOPE-001 → ACN registration cycle (1 gen – 28 feb) | Annual deadline. |
| R-CRA-001 → 11 dic 2027 (CRA full applicability) | Long-tail deadline. |

### D.3 Resource constraints

The plan assumes one senior engineer at v1.0 baseline (Renan). Hire #2's onboarding shifts the W2 schedule — paired commits + onboarding overhead reduce W2 throughput by approximately 20 % during Days 31–60, recovered by Days 61–90 as the new hire becomes productive.

External counsel availability is a critical resource for R-DPA-FILL-001, R-TIA-001, R-NIS2-SCOPE-001, R-CRA-001. Engagement should be scheduled at plan-publication day; a 2-week turnaround per legal review is realistic.

---

## Appendix E — Test code skeletons

The full regression-test catalogue is in Appendix B; this appendix shows the skeletons engineers can use as starting points.

### E.1 `tests/integration/mosquitto-no-anon.sh`

```bash
#!/usr/bin/env bash
# R-MQTT-ANON-001 regression test.
# Asserts that anonymous Mosquitto connections fail.
set -euo pipefail

# Boot the compose stack
docker compose up -d mosquitto
sleep 5  # broker ready

# Anonymous connection should fail
if mosquitto_sub -h localhost -p 1883 -t '$SYS/#' -W 5 2>&1 | grep -q "Connection Refused\|denied\|not authorized"; then
  echo "PASS: anonymous connection denied"
else
  echo "FAIL: anonymous connection succeeded"
  exit 1
fi

# Authenticated connection should succeed
if mosquitto_sub -h localhost -p 1883 -u backend -P "$MQTT_PASSWORD" -t '$SYS/broker/clients/connected' -W 5 2>&1 | grep -q "^[0-9]"; then
  echo "PASS: authenticated connection succeeded"
else
  echo "FAIL: authenticated connection failed"
  exit 1
fi

docker compose down
```

### E.2 `tests/integration/opcua-validate.test.js`

```javascript
// R-OPCUA-VALIDATE-001 regression test.
const { validateOpcuaEndpoint } = require('../../backend/src/services/opcua-bridge');

describe('OPC UA endpoint validation', () => {
  test('rejects metadata service IPs', () => {
    expect(() => validateOpcuaEndpoint('opc.tcp://169.254.169.254:80')).toThrow();
    expect(() => validateOpcuaEndpoint('opc.tcp://100.100.100.200:80')).toThrow();
  });

  test('rejects loopback unless explicitly allow-listed', () => {
    process.env.OPCUA_ALLOWED_HOSTS = 'plc-1.factory.local';
    expect(() => validateOpcuaEndpoint('opc.tcp://127.0.0.1:4840')).toThrow();
    expect(() => validateOpcuaEndpoint('opc.tcp://plc-1.factory.local:4840')).not.toThrow();
  });

  test('rejects non-OPC-UA schemes', () => {
    expect(() => validateOpcuaEndpoint('http://plc-1.factory.local:4840')).toThrow();
    expect(() => validateOpcuaEndpoint('file:///etc/passwd')).toThrow();
  });

  test('accepts allow-listed hosts with opc.tcp scheme', () => {
    process.env.OPCUA_ALLOWED_HOSTS = 'plc-1.factory.local,plc-2.factory.local';
    expect(() => validateOpcuaEndpoint('opc.tcp://plc-2.factory.local:4840')).not.toThrow();
  });
});
```

### E.3 `tests/integration/ws-auth.test.js`

```javascript
// R-WS-AUTH-001 regression test.
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

describe('WebSocket auth', () => {
  test('rejects unauthenticated handshake', (done) => {
    const ws = new WebSocket('ws://localhost:3002/ws');
    ws.on('error', (err) => { expect(err).toBeDefined(); done(); });
    ws.on('open', () => { fail('connection should not open'); done(); });
  });

  test('accepts valid JWT in Authorization header', (done) => {
    const token = jwt.sign({ sub: 'test-user', role: 'viewer' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const ws = new WebSocket('ws://localhost:3002/ws', { headers: { Authorization: `Bearer ${token}` } });
    ws.on('open', () => { ws.close(); done(); });
    ws.on('error', (err) => { fail(err); done(); });
  });

  test('rejects expired JWT', (done) => {
    const token = jwt.sign({ sub: 'test-user', role: 'viewer' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '-1m' });
    const ws = new WebSocket('ws://localhost:3002/ws', { headers: { Authorization: `Bearer ${token}` } });
    ws.on('error', (err) => { expect(err).toBeDefined(); done(); });
  });
});
```

### E.4 `tests/integration/gdpr-export-erase.test.js`

```javascript
// R-GDPR-001 regression test (full subject-rights flow).
const request = require('supertest');
const app = require('../../backend/src/index');
const pool = require('../../backend/src/db/pool');

describe('GDPR subject rights', () => {
  let testUserId;
  let testUserToken;

  beforeAll(async () => {
    // Create synthetic test user
    const result = await pool.query(`
      INSERT INTO users (email, full_name, role, password_salt, password_hash, active)
      VALUES ('test-gdpr@example.test', 'Test GDPR User', 'viewer', '...', '...', true)
      RETURNING id`);
    testUserId = result.rows[0].id;
    // Login to get token
    const loginRes = await request(app).post('/api/users/login').send({ email: 'test-gdpr@example.test', password: 'TestPassword123456' });
    testUserToken = loginRes.body.token;
  });

  test('export returns the user data', async () => {
    const res = await request(app)
      .get('/api/users/me/gdpr-export')
      .set('Authorization', `Bearer ${testUserToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test-gdpr@example.test');
    expect(res.body.audit_log).toBeDefined();
  });

  test('erasure soft-deletes then queues hard-delete', async () => {
    const res = await request(app)
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ password: 'TestPassword123456' });
    expect(res.status).toBe(204);
    // Soft-delete: user still in table but active=false
    const userRow = await pool.query('SELECT active FROM users WHERE id = $1', [testUserId]);
    expect(userRow.rows[0].active).toBe(false);
    // Hard-delete is delayed; this test does NOT verify the 7-day quiescence (separate cron test)
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM users WHERE email = $1', ['test-gdpr@example.test']);
  });
});
```

### E.5 `frontend/tests/i18n-key-audit.test.ts`

```typescript
// R-FRONTEND-i18n-001 regression test.
import { execSync } from 'child_process';
import en from '../src/locales/en.json';
import de from '../src/locales/de.json';
import it from '../src/locales/it.json';

function flatten(obj: any, prefix = ''): string[] {
  return Object.keys(obj).flatMap((k) => {
    const v = obj[k];
    if (typeof v === 'object') return flatten(v, prefix + k + '.');
    return [prefix + k];
  });
}

const keysInIt = flatten(it);
const keysInEn = flatten(en);
const keysInDe = flatten(de);

// Extract keys referenced in code via grep:
const codeKeys = execSync('grep -rhoE "t\\([\\\'\\\"]([a-z_.]+)[\\\'\\\"]" src/').toString()
  .split('\n').filter(Boolean).map((l) => l.replace(/^t\([\'\"]/, '').replace(/[\'\"].*$/, ''));

describe('i18n key audit', () => {
  test('every key referenced in code is in it.json', () => {
    codeKeys.forEach((k) => {
      expect(keysInIt).toContain(k);
    });
  });

  test('en.json has every it.json key', () => {
    keysInIt.forEach((k) => {
      expect(keysInEn).toContain(k);
    });
  });

  test('de.json has every it.json key', () => {
    keysInIt.forEach((k) => {
      expect(keysInDe).toContain(k);
    });
  });
});
```

---

## Appendix F — Integration with normal feature development

Remediation work and feature work share the same engineering capacity. The wave model is not a parallel track; it is interleaved with the feature backlog.

### F.1 Time-allocation rule

By default, each engineering week allocates:

- **40 %** to the highest-priority remediation tickets in the active wave.
- **40 %** to feature development from the product roadmap (UPLIFT § 7).
- **15 %** to technical-debt budget (preparatory refactors, dependency upgrades, doc updates).
- **5 %** to on-call rotation (when applicable).

This is a guideline, not a contract. Critical incidents reset to 100 % remediation. Feature deadlines (e.g., a Tier 3 customer's contracted milestone) shift the balance temporarily; the deficit is repaid in the following sprint.

### F.2 Sprint structure

Sprints are 2 weeks long. The sprint planning meeting (every other Monday) selects:

- One Critical or High remediation ticket as the sprint's "headline".
- Two Medium remediation tickets (one of which is paired with a feature improvement, per rule **R-9**).
- Three feature tickets from the product roadmap.
- Optional: one technical-debt ticket from UPLIFT.

The sprint demo (every other Friday of the second week) reviews:

- Tickets that landed `Verified`.
- Tickets that landed `Pending` (rationale + new ETA).
- New findings discovered during the sprint.
- Postmortems for any P1/P2 incident.

### F.3 Branching model

Trunk-based development. `main` is always deployable.

- Feature branches named `feat/<short-tag>-<R-ticket-or-feature-id>`.
- Hotfix branches for W0 emergency tickets named `hotfix/<R-ticket>`.
- PRs merge to `main` after CI green + verifier sign-off.
- Production deploy is a tag (`v1.x.y`) cut from `main`; only tags trigger the production CD step (cfr. AUDIT F-LOW-CD-001 strength).

### F.4 Review ownership

A PR is reviewed by:

- **One required engineering review** (the verifier per ticket schema, distinct from implementer per rule **R-14**).
- **One required Renan review** for security-sensitive changes (auth, crypto, audit log, RBAC, broker config).
- **One optional design review** (UX) for frontend-visible changes.

Reviews use the `LGTM`/comment model; CI must pass before merge.

### F.5 Escalation paths

If a ticket is blocked > 14 days (rule **R-18**), the implementer files a "Blocked" status update. Renan reviews weekly:

- If the block is external (counsel availability, customer feedback): note + reassign deadline.
- If the block is technical (a missing prerequisite): file a sub-ticket (rule **R-9**); add `addBlockedBy` link; the parent ticket reverts to `Pending` until the sub-ticket lands.
- If the block is a personal capacity issue: redistribute work; ensure one ticket has owner.

### F.6 Wave-end retrospective

At the end of each wave, a 1-hour retrospective:

- What went well? Which tickets shipped on time?
- What went poorly? Which tickets slipped? Why?
- What did we learn? New REMEDIATION tickets if process improvements emerge.
- What's the next wave's top 3 risks?

The retrospective output is appended to `docs/postmortems/waves/<YYYY-Q-W>-closure.md`.

---

## Appendix G — Customer-engagement integration

Many tickets are explicitly conditional on first-customer engagement. The following list maps remediation tickets to customer-engagement milestones.

| Customer milestone | Tickets that must close |
|---|---|
| First demo to a Tier S prospect | None blocking; the demo uses local docker-compose with simulator. |
| First signed Tier 2 contract | R-DPA-FILL-001, R-LEGAL-DATES-001, R-LEGAL-SLA-ALIGN-001. |
| First production deployment to Tier 2 customer | All W1 tickets (especially R-MQTT-ANON-001, R-MQTT-TLS-001, R-OPCUA-VALIDATE-001, R-TF-STATE-001, R-GRAFANA-PG-TLS-001, R-CI-AUDIT-001, R-FRONTEND-COOKIE-AUTH-001, R-FRONTEND-AUTH-001, R-CONTACT-ESCAPE-001, R-FRONTEND-DOCKERFILE-USER-001, R-K8S-DIGEST-001, R-SUPPLY-001 W1 portion, R-WS-AUTH-001). |
| First Piano 4.0 attestazione delivered to a customer's commercialista | R-RUNBOOK-DEPLOY-001 (deployment-log runbook), R-GDPR-001 (subject-rights ready). |
| First Piano 5.0 attestazione (energy savings) | R-CRA-001 analysis at minimum partial; HANDOFF § 10 cross-product map current; R-NIS2-SCOPE-001 if customer is in NIS2 scope. |
| First Tier 3 ("Bollato") fork | R-CRA-001 + R-NIS2-SCOPE-001 + R-DPA-FILL-001 + R-RDS-KMS-001 (customer-managed KMS becomes binding) + R-K8S-NETPOL-001. |
| First Tier 4 SaaS customer | All of the above + R-PGBOUNCER-001 + R-AUDIT-ASYNC-001 (if contracted). |

The customer-engagement timeline drives wave priority in practice. If the first signed Tier 2 contract lands in week 3, the W1 wave end-date might shift earlier; if it lands in month 4, the wave might extend modestly. Rule **R-7** documents either case.

---

## Appendix H1 — Anti-tickets (what NOT to remediate)

In the interest of avoiding scope creep and respecting the boundary between AUDIT (what's broken) and UPLIFT (what could be better), this appendix lists **explicit anti-tickets** — items that look like they should be remediation work but are not.

### Anti-Ticket A — "Migrate from Express 4 to Express 5"

**Why not now.** Express 5 is still in alpha as of 2026-Q2; while the stable API is mostly compatible, the migration touches every middleware in `backend/src/middleware/`. The risk:reward ratio is wrong; this is UPLIFT u-express-5-migration, not REMEDIATION.

### Anti-Ticket B — "Migrate from Node.js 20 to Node.js 22 LTS"

**Why not now.** Node 20 LTS support runs through April 2026, then maintenance LTS until April 2027. Plenty of margin. Migration is UPLIFT u-node-22-lts.

### Anti-Ticket C — "Migrate from InfluxDB 2.x to InfluxDB 3.x"

**Why not now.** Anti-goal U-12 in UPLIFT — wait for GA + 6 months of soak elsewhere. Not a remediation; a strategic migration.

### Anti-Ticket D — "Replace Mosquitto with EMQX"

**Why not now.** Mosquitto serves Tier 2 deployments well. EMQX is the scale-up path for Tier 4 SaaS at multi-tenant scale; cfr. legacy MODUS_OPERANDI § 6.1. UPLIFT u-broker-emqx covers the future migration; AUDIT does not flag Mosquitto as inadequate at current scale.

### Anti-Ticket E — "Refactor backend to TypeScript"

**Why not now.** Backend is JS at v1.0; TypeScript would improve type safety but at the cost of significant migration effort. UPLIFT u-dx-typescript-backend covers; not a remediation.

### Anti-Ticket F — "Migrate from React 18 to React 19"

**Why not now.** React 19 is in evolutionary release; the upgrade path is short but the ROI for a SPA dashboard is modest. Not a remediation; UPLIFT u-react-19 if/when.

### Anti-Ticket G — "Implement HSM-backed key storage"

**Why not now.** Customer-managed CMK (R-RDS-KMS-001) is the v1.x posture; HSM-backed CMK is enterprise-tier and customer-driven. UPLIFT u-hsm-cmk if a customer requires it.

### Anti-Ticket H — "Move to Kafka"

**Why not now.** Same anti-goal as EMQX — scale-up path, not remediation.

### Anti-Ticket I — "Implement zero-trust network architecture (Tailscale, Zscaler, etc.)"

**Why not now.** Customer-side decision; FactoryMind's k8s NetworkPolicy + ingress hardening is sufficient at v1.x. Customer who wants ZTNA can layer it; not FactoryMind's remediation.

### Anti-Ticket J — "Integrate with SAP / Oracle NetSuite / Microsoft Dynamics 365"

**Why not now.** Tier 3 / 4 customer-driven; not a remediation. UPLIFT u-erp-integrations.

The anti-tickets list is reviewed quarterly; an item flips to a real ticket when its trigger fires (e.g., the first Tier 4 customer with a hard contractual requirement that justifies the work).

---

## Appendix H2 — Operational expense forecasting

For each remediation work item, the cost dimensions are:

- **Engineering time** (already covered in S/M/L/XL).
- **External counsel time** (per-hour billed; estimate 4 hours per legal ticket at €120/hour).
- **AWS / cloud cost** (some tickets add infrastructure: KMS CMK, PgBouncer, additional CloudWatch logs).
- **Third-party services** (Cosign / Sigstore is free; Kyverno is open-source; security tooling like Trivy/Syft is free; some advanced features may require paid tooling).

Forecast per wave:

| Wave | Engineering days | Counsel hours | Cloud delta (€/month) |
|---|---|---|---|
| W0 | 0 | 0 | 0 |
| W1 | ~ 13 days | ~ 20 hours (R-DPA-FILL-001 + R-TIA-001 reviews) | ~ 10–30 (Cosign keyless free; KMS CMK ~ €1/month per key) |
| W2 | ~ 24 days | ~ 30 hours (R-NIS2-SCOPE-001 + R-CRA-001 reviews) | ~ 50–100 (PgBouncer container, Kyverno, additional CloudWatch logs) |
| W3 | ~ 6 days | ~ 5 hours | ~ 5 |
| Continuous (per quarter) | ~ 4 days | ~ 2 hours | minimal |

Total estimated cost to get from v1.0 to "all W1+W2+W3 closed":
- Engineering: ~ 43 days = ~ €17 200 if billed at €400/day; or ~ 1.5 months of one senior engineer.
- Counsel: ~ 55 hours × €120/hour = ~ €6 600.
- Cloud delta: ~ €100/month after W2.

This is an order-of-magnitude estimate. The exact cost depends on hiring decisions (in-house vs contracted), counsel availability, and the customer-engagement timing that triggers some tickets earlier or later.

---

## Appendix H3 — Test code skeletons (continued)

### H3.1 `backend/tests/contact-form-xss.test.js`

```javascript
// R-CONTACT-ESCAPE-001 regression test.
const request = require('supertest');
const app = require('../src/index');
const sgmail = require('@sendgrid/mail');  // or nodemailer mock

jest.mock('@sendgrid/mail');

describe('Contact form XSS protection', () => {
  test('XSS payload in message field is escaped before SMTP send', async () => {
    const xssPayload = '<script>alert(1)</script>';
    const sentMessages = [];
    sgmail.send.mockImplementation((msg) => sentMessages.push(msg));

    await request(app).post('/api/contact').send({
      nome: 'Test User',
      email: 'test@example.test',
      message: `Hello ${xssPayload} world`,
    });

    expect(sentMessages).toHaveLength(1);
    const sent = sentMessages[0];
    // Body must NOT contain the literal <script> tag, OR must be plain-text mode
    if (sent.html !== undefined) {
      expect(sent.html).not.toContain('<script>');
      expect(sent.html).toContain('&lt;script&gt;'); // properly escaped
    } else {
      expect(sent.text).toContain('<script>'); // plain-text mode preserves literal
    }
  });
});
```

### H3.2 `tests/integration/grafana-tls.sh`

```bash
#!/usr/bin/env bash
# R-GRAFANA-PG-TLS-001 regression test.
set -euo pipefail

# Verify Grafana datasource configured for TLS
if grep -q "sslmode: require\|sslmode: verify-full" grafana/provisioning/datasources/postgres.yml; then
  echo "PASS: sslmode is require or verify-full"
else
  echo "FAIL: sslmode not configured for TLS"
  exit 1
fi

# Verify the dashboard still renders (smoke test)
docker compose up -d
sleep 30
RESP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $GRAFANA_API_KEY" \
  http://localhost:3000/api/datasources/proxy/1/query \
  -d "query=SELECT 1")
if [ "$RESP" = "200" ]; then
  echo "PASS: Grafana → Postgres query succeeded"
else
  echo "FAIL: Grafana → Postgres query returned $RESP"
  exit 1
fi
docker compose down
```

### H3.3 `tests/integration/cosign-verify.sh`

```bash
#!/usr/bin/env bash
# R-SUPPLY-001 regression test.
set -euo pipefail

IMAGE="ghcr.io/factorymind/factorymind-backend:1.0.0"

# Resolve the digest
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "$IMAGE" | cut -d'@' -f2)
echo "Image digest: $DIGEST"

# Verify Cosign signature (keyless)
cosign verify \
  --certificate-identity "https://github.com/renanaugustomacena-ux/macena-factorymind/.github/workflows/cd.yml@refs/tags/v1.0.0" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  "$IMAGE@$DIGEST"

if [ $? -eq 0 ]; then
  echo "PASS: image signature verified"
else
  echo "FAIL: image signature verification failed"
  exit 1
fi
```

### H3.4 `tests/integration/restore-drill.sh`

```bash
#!/usr/bin/env bash
# R-DR-DRILL-001 regression test (quarterly drill).
set -euo pipefail

# 1. Take a snapshot of current production state (synthetic test data)
docker compose exec backend npm run seed-test-data

# 2. Capture OEE for a known machine
EXPECTED_OEE=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" \
  "http://localhost:3002/api/oee?facility=test&line=line-01&machine=machine-01" | jq -r '.oee')
echo "Pre-restore OEE: $EXPECTED_OEE"

# 3. Take backups
docker compose exec postgres pg_dump factorymind > /tmp/restore-drill-pg.sql
docker compose exec influxdb influx backup /backup
sleep 10
docker compose cp influxdb:/backup /tmp/restore-drill-influx

# 4. Tear down + bring up clean staging environment
docker compose down -v
docker compose up -d

# 5. Restore
docker compose exec -T postgres psql factorymind < /tmp/restore-drill-pg.sql
docker compose cp /tmp/restore-drill-influx influxdb:/backup
docker compose exec influxdb influx restore /backup --org factorymind

# 6. Verify
RESTORED_OEE=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" \
  "http://localhost:3002/api/oee?facility=test&line=line-01&machine=machine-01" | jq -r '.oee')
echo "Post-restore OEE: $RESTORED_OEE"

if [ "$EXPECTED_OEE" = "$RESTORED_OEE" ]; then
  echo "PASS: restore drill succeeded; OEE matches"
else
  echo "FAIL: OEE mismatch ($EXPECTED_OEE vs $RESTORED_OEE)"
  exit 1
fi
```

### H3.5 `tests/integration/k8s-netpol.test.js`

```javascript
// R-K8S-NETPOL-001 regression test (in-cluster).
// Deployed as a one-shot Job in a test namespace.
const k8s = require('@kubernetes/client-node');
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

describe('NetworkPolicy enforcement', () => {
  test('non-allow-listed pod cannot reach Postgres', async () => {
    // Spin up a probe pod that attempts to connect to Postgres
    // Expected: connection times out (NetworkPolicy denies)
    // Expected outcome: probe pod exits with non-zero
    // (Implementation deferred to in-cluster test suite)
  });

  test('backend pod can reach Postgres', async () => {
    // Confirm backend can SELECT 1
    // Expected: success
  });

  test('Prometheus pod can scrape backend /metrics', async () => {
    // Confirm Prometheus successfully pulls
  });
});
```

---

## Appendix H4 — Wave-end verification checklist

A printable checklist for the wave-end retrospective.

```
WAVE END VERIFICATION — Wave: ____ — Date: ___________

1. [ ] All Verified tickets in this wave have entered the 30-day deferred-check.
2. [ ] All Pending or In Progress tickets have explicit roll-forward sign-off.
3. [ ] No accepted residuals have triggers fired.
4. [ ] Status board (Appendix C) reflects current state.
5. [ ] CVE register "Last reviewed" date is current.
6. [ ] Quarterly review per HANDOFF doctrine H-22 completed within ±14 days.
7. [ ] New tickets discovered during the wave catalogued.
8. [ ] Wave closure note `docs/postmortems/waves/<YYYY-Q-W>-closure.md` written.
9. [ ] Customer notices for Critical fixes sent (or explicitly waived).
10. [ ] Changelog entries written.

What went well:
________________________________________________________________
________________________________________________________________

What went poorly:
________________________________________________________________
________________________________________________________________

Top 3 risks for next wave:
1. _____________________________________________________________
2. _____________________________________________________________
3. _____________________________________________________________

Sign-off:
- Renan: ______________________ Date: __________
- Verifier: ______________________ Date: __________
```

This template is canonical; printed and signed at each wave end.

---

## Appendix H5 — Conditional / dependency-based tickets

Some tickets depend on conditions that may or may not materialise within the wave window. They are catalogued here for completeness.

| Ticket | Condition | If condition fires |
|---|---|---|
| R-AUDIT-ASYNC-001 | Customer contractually requires guaranteed audit log | Implement async-with-buffer pattern |
| R-MQTT-MTLS-001 (TBD) | Customer's environment supports per-device X.509 | Implement mTLS for production broker |
| R-MODBUS-HMAC-001 (TBD) | Customer requires command-write capability over Modbus | Introduce HMAC-wrapped Modbus profile |
| R-PG-AUDIENCE-CLAIM-001 (TBD) | Multi-service tenant with shared JWT secret | Add `aud` claim validation |
| R-INFRA-IDP-001 (TBD) | Customer's IDP requires SAML/OIDC integration | Implement IDP shim |
| R-COMPLIANCE-IATF-001 (TBD) | Customer is automotive supply chain | Implement IATF 16949 audit-trail extensions |

These are filed as "Pending (conditional)" status. The trigger condition appears in the ticket. Quarterly review checks whether the trigger has fired.

---

## Appendix H6 — Risk-acceptance log

For findings that the project elects to accept rather than remediate (cfr. AUDIT § 12), this log captures the acceptance decision.

| Finding | Severity | Acceptance date | Trigger to flip back | Reviewer | Reviewer signature |
|---|---|---|---|---|---|
| F-MED-DATA-002 (audit log lossy under backpressure) | M | 2026-05-07 | Customer with no-audit-drop contract | Renan | _______ |
| Modbus broadcast unprotected (§ 8.5) | M | 2026-05-07 | Command-write capability requested | Renan | _______ |
| No CSRF on POST | L | 2026-05-07 | Migration to cookie auth | Renan | _______ |
| No JWT audience claim | L | 2026-05-07 | Multi-service tenant | Renan | _______ |

Quarterly review re-validates each line. If the trigger has fired, a REMEDIATION ticket opens; if conditions have materially changed, the acceptance is re-justified or the row deleted.

---

## Appendix I — Prioritisation rationale (per ticket category)

Every wave assignment carries an implicit prioritisation. This appendix surfaces the reasoning so future maintainers understand why a ticket sits where it does.

### I.1 Why is broker hardening (R-MQTT-ANON-001 + R-MQTT-TLS-001) in W1, not W0?

The findings (F-CRIT-001 + F-CRIT-002) ARE Critical. They sit in W1 (not W0) because:

1. No Tier 2 production customer is deployed at v1.0 baseline. The fail-close logic in `mosquitto/entrypoint.sh` lines 41–50 already prevents a production deployment with `allow_anonymous true`. The actual exploit window in 2026-05-07 reality is zero.
2. The fix touches the install.sh flow, which is on the doctrine **H-1** (15-minute bootstrap) critical path; rushing the fix risks breaking the bootstrap experience for new engineers.
3. W1 30-day window is sufficient to do this properly + tested + documented; W0 would compress the work without measurable benefit.

**If a Tier 2 customer signs a contract within the next 14 days**, this assessment changes; the tickets bump to W0 and a hotfix release ships before deployment.

### I.2 Why is GDPR scripts (R-GDPR-001) in W1 — is it not "merely" a developer convenience?

R-GDPR-001 is in W1 because:

1. The moment a Tier 2 customer is deployed, GDPR Art. 15-22 obligations apply with a 30-day SLA. Manual SQL doesn't scale; one ill-timed press cycle turns into a SLA breach.
2. The customer's commercialista will ask, during contract negotiations, "what happens if a worker requests their data?" — having a documented automated answer wins the trust play.
3. The implementation is L-effort (~1 week) but stable; W2 or later is unnecessary delay.

### I.3 Why is the InfluxDB Cloud TIA (R-TIA-001) in W1 if no customer uses InfluxDB Cloud?

R-TIA-001 is in W1 because:

1. The DPA (`legal/DATA-PROCESSING-AGREEMENT.md`) lists InfluxData as a sub-processor. A customer reading the DPA today sees the listing and asks the question; we want the answer ready.
2. Counsel review is the long-pole; starting in W1 (calendar 30 days) gives counsel a full month plus subsequent waves to refine.
3. The default deployment posture is being shifted to "self-managed Influx OSS" with InfluxData Cloud as opt-in; the TIA documents the opt-in path.

### I.4 Why is Cosign (R-SUPPLY-001) split across W1 and W2?

The signing step (W1 portion) is M-effort and lands quickly. The Kyverno verification at admission (W2 portion) is L-effort because it requires Kyverno installation in the customer cluster, which is a per-customer rollout. The W1 portion ensures FactoryMind images are signed; the W2 portion ensures customer clusters verify them at admission. Split is operational, not arbitrary.

### I.5 Why are NIS2 + CRA analyses (R-NIS2-SCOPE-001 + R-CRA-001) in W2, not W1?

Both depend on counsel review with regulatory specialisation that may not be immediately available. W2 (90-day window) gives counsel the time to do the work properly. The cost of getting these wrong (regulatory exposure) is greater than the cost of a 60-day delay.

That said, **if FactoryMind plans to sign a Tier 4 SaaS customer in 2026-Q3**, R-NIS2-SCOPE-001 may become a W1 dependency — we do not know whether the customer is in NIS2 scope without the analysis.

### I.6 Why is PgBouncer (R-PGBOUNCER-001) Pending W2/W3 as opposed to required?

PgBouncer adds value at scale (multiple backend pods sharing the connection pool). At v1.0 single-tenant scale, the native pg-pool of 10 connections per backend pod is sufficient. The W2/W3 designation reflects the timing dependency on scaling pressure, not on calendar time.

### I.7 Why is A11Y audit (R-A11Y-AUDIT-001) in W2?

WCAG 2.1 AA is a doctrine commitment in legacy A11Y.md. The audit is L-effort (multiple test methodologies) and benefits from being scheduled when external accessibility consultants are available. W2 gives time to scope + engage. Stanca law applicability to FactoryMind's customer base is non-binding (private SMEs); the priority is signal + customer experience, not regulatory compliance.

### I.8 Why are LOW findings deferred to W3?

LOW findings have minor business impact and are individually small (most are S-effort). Bundling them into W3 amortises the operational overhead (one PR review, one CI run, one verifier session per cluster of small fixes). Doing them piecemeal in W1/W2 would consume verifier capacity better spent on Critical/High closure.

### I.9 Why does R-CI-DOCS-001 sit in W1 if it's not directly customer-impacting?

The CI documentation lint is the *enforcement mechanism* for doctrines **H-4**, **H-7**, **H-9**, **R-1**, **A-1**, **A-6**. Without it, drift accumulates silently. Landing it in W1 ensures every subsequent wave's documentation discipline is enforced. The L-effort is justified by the long-tail benefit.

---

## Appendix J — Wave-narrative scenarios

The following scenarios describe how a wave actually unfolds. Two scenarios are presented: the optimistic and the pessimistic. Reality lands somewhere in between.

### J.1 Optimistic scenario (W1 closes on time)

- **Day 1 (Wednesday).** Plan publication. Renan reviews the W1 ticket list with the second engineer (newly onboarded). Sprint planning meeting allocates the first sprint (Days 1–14). Sprint 1 picks: R-MQTT-ANON-001 (headline Critical), R-CONFIG-MQTT-001 (paired Medium), R-FRONTEND-DOCKERFILE-USER-001 (Low + paired with frontend feature work).
- **Day 2–4.** R-MQTT-ANON-001 and R-CONFIG-MQTT-001 in parallel. Regression tests authored Day 2 (red); fixes Day 3 (green); peer review Day 4. Both Verified.
- **Day 5–7.** R-FRONTEND-DOCKERFILE-USER-001 (S-effort). Verified.
- **Day 8–10.** R-MQTT-TLS-001 (M). Cert generation in install.sh; test of `openssl s_client`. Verified.
- **Day 11–13.** R-OPCUA-VALIDATE-001 (S). Quick win.
- **Day 14.** Sprint 1 demo. 5 tickets Verified. R-CI-AUDIT-001 (S) carried to Sprint 2.
- **Day 15–28 (Sprint 2).** R-FRONTEND-COOKIE-AUTH-001 + R-FRONTEND-AUTH-001 paired (L+M). Heavy lift. Documentation ↔ code coordination per doctrine **H-3**. Verified Day 24. R-WS-AUTH-001 (L) in parallel; Verified Day 28.
- **Day 22–28.** R-CI-DOCS-001 (L) implementer-paired with R-CI-AUDIT-001. Lint scripts authored. Both Verified.
- **Day 25–28.** R-TF-STATE-001 + R-GRAFANA-PG-TLS-001 (M+S). Both Verified.
- **Day 28–30.** Counsel-track tickets land: R-DPA-FILL-001 + R-TIA-001 + the corresponding legal review. Verified Day 30.
- **Day 30 (Friday).** Wave-end retrospective. 19/19 W1 tickets Verified (1 was already Verified at plan publication). Customer notice template tested. Status board updated. Wave closure note written.

This scenario is plausible but requires a smooth counsel turnaround.

### J.2 Pessimistic scenario (W1 slips)

- **Day 1.** Plan publication. Renan still solo (hire #2 delayed). Sprint planning is one-person.
- **Day 1–7.** Sprint 1 picks Critical tickets only (no parallel feature work; lower throughput). R-MQTT-ANON-001 + R-CONFIG-MQTT-001 Verified Day 5. R-MQTT-TLS-001 in progress.
- **Day 8–14.** R-MQTT-TLS-001 Verified Day 9 (cert generation flakiness consumed Day 8). R-OPCUA-VALIDATE-001 Verified Day 10. R-CI-AUDIT-001 Verified Day 11. R-FRONTEND-DOCKERFILE-USER-001 Verified Day 12. Sprint 1 demo Day 14: 5 Verified.
- **Day 15–28 (Sprint 2).** R-FRONTEND-COOKIE-AUTH-001 + R-FRONTEND-AUTH-001 + R-WS-AUTH-001 paired. Heavy lift. Days 15–22: implementation. Days 23–25: peer review (delayed due to sole reviewer). Verified Day 26.
- **Day 25–30.** Counsel-track: R-DPA-FILL-001 + R-TIA-001 — counsel review pending. Status `Pending` at Day 30; **wave drift declared**: roll forward to W2 with explicit rationale (counsel availability).
- **Day 28–30.** R-CI-DOCS-001 + R-TF-STATE-001 + R-GRAFANA-PG-TLS-001 + R-CONTACT-ESCAPE-001 + R-GDPR-001 + R-K8S-DIGEST-001 + R-SUPPLY-001 (W1 portion). Some Verified, some still Pending.
- **Day 30.** Retrospective. ~12 of 19 Verified. 7 rolled forward to W2 with sign-off. Mood: pragmatic, not panicked.

This scenario is the more probable one. The plan accommodates it via rule **R-7** sign-off and the W2 buffer.

### J.3 Disaster scenario (a Critical finding emerges mid-wave)

- **Day 1.** Plan publication.
- **Day 7.** External researcher reports a Critical CVE in `node-opcua`; FactoryMind is exposed. CVE-2026-XXXX assigned.
- **Day 7–8.** Renan opens W0 ticket R-CVE-OPCUA-EMERGENCY-001. Hotfix branch from the most recent stable tag. Bump `node-opcua` version. Smoke test. Tag v1.x.y. Cosign sign (R-SUPPLY-001 W1 portion already done by this point).
- **Day 8 (afternoon).** Customer notice sent (template § 10.1). Hotfix deployed.
- **Day 9.** Postmortem written within 5 working days of detection (HANDOFF doctrine **H-17**). REMEDIATION ticket retrospective entry.
- **Day 9–14.** Coordinated disclosure window with researcher; advisory drafted.
- **Day 14–30.** W1 wave continues but with accumulated 5-day delay; some tickets shift from Sprint 1 to Sprint 2. Final outcome similar to optimistic scenario but compressed.

The disaster scenario stress-tests the doctrine + plan: every rule binds even under emergency.

---

## Appendix K — Notes for handover to a successor

If maintenance of this REMEDIATION plan is handed to a successor, the following notes guide the transition.

1. **The plan is a living document.** Every quarter, reading every ticket end-to-end is part of doctrine **H-22**. The successor must perform this reading and produce the diff in Appendix C.
2. **Don't be tempted to skip W1 verification deferrals.** A `Verified` ticket without 30-day deferred check is `Verified-but-not-Closed`; respect the gap.
3. **Rule **R-7** is the most-violated rule.** Wave drift is the silent killer. The successor's first instinct may be to declare a ticket "done enough" — resist; either close it properly or roll it forward with sign-off.
4. **The legal-track tickets (R-DPA-FILL-001, R-TIA-001, R-NIS2-SCOPE-001, R-CRA-001) need counsel.** Don't try to write legal text without one. Engage early.
5. **The CVE register sweep (R-CVE-CADENCE) is non-negotiable.** A 96-day-old register is technically a CI failure (doctrine **A-12**); fix the date even if no findings have changed.
6. **The customer-engagement triggers (Appendix G) shift priority dynamically.** Reread the triggers at every sprint planning.
7. **The anti-tickets (Appendix H1) are not optional**. They preserve scope. Resist scope creep from "while we're here, let's also..." patterns.
8. **The wave-end retrospective is the most-skipped step**. Don't skip it. Even an honest "no time, will do tomorrow" is better than a silent skip; document the slippage.

---

## Appendix L — Sample ticket for an emerging finding

When a new finding emerges (mid-wave or at a quarterly review), the ticket creation follows this template:

```markdown
### R-XXX-NNN — <imperative title>

- **Findings closed:** [F-XXX](AUDIT.md#a-finding-f-xxx) (newly added in audit pass YYYY-Q-N).
- **Wave:** W2 (or as appropriate).
- **Owner (RACI):** R: ___ A: Renan C: ___ I: ___
- **Severity gate:** Critical / High / Medium / Low.
- **Exit criteria:**
  - <bullet list>
- **Regression test:** <test path>
- **Blast radius:** <services / customers>
- **Rollback plan:** <commands>
- **Communication:** <customer notice / changelog>
- **Effort:** S/M/L/XL
- **Status:** Pending
- **Why this remediation, not another:** <alternatives considered>
```

The first PR ratifying the new ticket also updates Appendix A (cross-reference table) + Appendix B (test catalogue) + Appendix C (status board).

---

## Appendix M — Cross-doc traceability matrix

This matrix demonstrates the four-doc coherence: every AUDIT finding has a REMEDIATION ticket; every REMEDIATION ticket cites a HANDOFF section that informs its scope; every UPLIFT initiative builds on a strength + a closed remediation rather than introducing new gaps.

| AUDIT finding | REMEDIATION ticket | HANDOFF section informing scope | UPLIFT initiative leveraging closure |
|---|---|---|---|
| F-CRIT-001 (Mosquitto anonymous) | R-MQTT-ANON-001 | § 5.7 (edge fleet hardening) | u-broker-emqx (future scale-up) |
| F-CRIT-002 (MQTT TLS) | R-MQTT-TLS-001 | § 5.7 + § 7.5 (encryption) | u-mtls-fleet (per-device certs at scale) |
| F-CRIT-003 (OPC UA SSRF) | R-OPCUA-VALIDATE-001 | § 4.1.5 (services) + § 5.7 | u-opcua-trustlist-mgmt (centralised TrustList) |
| F-CRIT-004 (TF state) | R-TF-STATE-001 | § 5.3 (production deploy) | u-tf-pipeline (Atlantis-style PR-driven plan) |
| F-CRIT-005 (Grafana PG TLS) | R-GRAFANA-PG-TLS-001 | § 4.7 + § 7.5 | u-grafana-managed (Grafana Cloud option) |
| F-CRIT-006 (TIA missing) | R-TIA-001 | § 7 (data governance) + § 9 (compliance) | u-influx-eu-default (default EU region) |
| F-CRIT-007 (CI gates non-blocking) | R-CI-AUDIT-001 | § 5 + § 8 | u-supply-chain-l3 (SLSA L3 trajectory) |
| F-HIGH-001 (JWT in localStorage) | R-FRONTEND-COOKIE-AUTH-001 | § 4.2.2 + § 7.5 | u-frontend-csp-strict-dynamic |
| F-HIGH-002 (no auth guards) | R-FRONTEND-AUTH-001 | § 4.2.1 + § 6 | u-frontend-rbac-ui-coherence |
| F-HIGH-003 (RDS no CMK) | R-RDS-KMS-001 | § 7.5 | u-hsm-cmk (eventually) |
| F-HIGH-004 (RDS egress) | R-RDS-EGRESS-001 | § 5 + § 7.5 | u-cloud-network-zero-trust |
| F-HIGH-005 (contact form HTML) | R-CONTACT-ESCAPE-001 | § 4.1.4 | u-contact-form-templating |
| F-HIGH-006 (GDPR scripts) | R-GDPR-001 | § 7.3 | u-gdpr-self-service-portal |
| F-HIGH-007 (frontend Dockerfile USER) | R-FRONTEND-DOCKERFILE-USER-001 | § 4.2.8 | u-frontend-distroless |
| F-HIGH-008 (image digest) | R-K8S-DIGEST-001 | § 5.3 | u-supply-chain-slsa-l3 |
| F-HIGH-009 (Cosign) | R-SUPPLY-001 + R-K8S-KYVERNO-001 | § 5.3 + § 7.5 | u-supply-chain-slsa-l3 |
| F-HIGH-010 (WS no auth) | R-WS-AUTH-001 | § 4.1.10 + § 6.9 | u-realtime-mtls (per-device WS auth) |
| F-MED-001 (NetworkPolicy partial) | R-K8S-NETPOL-001 | § 5.3 | u-cloud-network-zero-trust |
| F-MED-002 (sourcemaps in prod) | R-FRONTEND-SOURCEMAP-001 | § 4.2.7 | u-frontend-error-tracking-sink |
| F-MED-003 (i18n keys) | R-FRONTEND-i18n-001 | § 4.2.6 | u-frontend-i18n-tooling |
| F-MED-004 (Grafana plugins unpinned) | R-INFRA-GRAFANA-PLUGINS-001 | § 5.3 | u-supply-chain-slsa-l3 |
| F-MED-005 (MQTT_PASSWORD check) | R-CONFIG-MQTT-001 | § 5.3 | u-config-rust-validator (eventually) |
| F-MED-DATA-001 (Influx tasks unverified) | R-INFLUX-TASK-001 | § 4.1.5 + § 8 | u-influx-monitoring-dashboard |
| F-MED-DATA-002 (audit log lossy) | R-AUDIT-ASYNC-001 (conditional) | § 7.3 | u-audit-log-immutable-storage |
| F-MED-DATA-003 (attestazione idempotency) | R-ATTESTAZIONE-IDEMPOTENCY-001 | § 9.1 | u-attestazione-pdf-sign |
| F-MED-DATA-004 (MQTT topic regex) | R-MQTT-TOPIC-VALIDATION-001 | § 3.7 | u-influx-cardinality-monitoring |
| F-MED-DATA-005 (no PgBouncer) | R-PGBOUNCER-001 | § 4.1.6 + § 5.3 | u-pg-multi-region |
| F-MED-CODE-001 (any cast) | R-FRONTEND-LINT-001 | § 4.2 | u-dx-typescript-strict |
| F-MED-CODE-002 (i18n keys) | R-FRONTEND-i18n-001 | § 4.2.6 | u-frontend-i18n-tooling |
| F-MED-CODE-003 (sourcemaps) | R-FRONTEND-SOURCEMAP-001 | § 4.2.7 | u-frontend-error-tracking-sink |
| F-MED-CODE-004 (ErrorBoundary leak) | R-FRONTEND-ERROR-001 | § 4.2.5 | u-frontend-error-tracking-sink |
| F-MED-CODE-005 (5xx leak) | R-ERROR-SAFE-001 | § 4.1.3 | u-observability-trace-error-link |
| F-MED-CODE-006 (Sparkplug require) | R-SPARKPLUG-LOAD-001 | § 4.1.5 | u-sparkplug-fuzz-test |
| F-MED-LEGAL-001 (cookie banner) | R-COOKIE-BANNER-001 | § 9.6 (Stanca / GDPR) | u-landing-analytics |
| F-MED-LEGAL-002 (lang hard-coded) | R-i18n-HTML-LANG-001 | § 9.6 | u-landing-i18n |
| F-MED-LEGAL-003 (NIS2 scope) | R-NIS2-SCOPE-001 | § 9.4 | u-compliance-nis2-cert |
| F-MED-LEGAL-004 (CRA scope) | R-CRA-001 | § 9.5 | u-compliance-cra-conformity |
| F-MED-LEGAL-005 (A11Y) | R-A11Y-AUDIT-001 | § 9.6 | u-a11y-22 |
| F-MED-LEGAL-006 (consent) | R-LANDING-CONSENT-001 | § 7 + § 9 | u-landing-conversion-tracking |
| F-MED-LEGAL-008 (SLA mismatch) | R-LEGAL-SLA-ALIGN-001 | § 8.1 | u-tier-aware-slo |
| F-LOW-* (bundle) | R-W3-BUNDLE | § 5 + § 12 | u-tech-debt-ratchet |

The matrix is updated quarterly per HANDOFF doctrine **H-22**. CI lint validates that every AUDIT F-* has at least one REMEDIATION row (or is marked Accepted Residual in AUDIT § 12).

---

## Appendix N — Closing notes for the v1.0 plan

This is the inaugural baseline of the FactoryMind remediation plan. By the time the v2.0 plan is published (one year hence, per quarterly + annual review cadences), most of the W1 + W2 tickets above should be `Closed`, the W3 tickets should be `Verified` or in deferred-check, and the Continuous cadences should have produced 4 quarterly cycles of CVE sweeps + 4 quarterly retrospectives + 4 quarterly accepted-residual reviews.

The success metric for this plan is not "all tickets closed". The success metric is **the ratio of tickets closed via the doctrine** (regression-tested, peer-reviewed, blast-radius-protected, communication-managed) **to tickets closed via shortcuts** — and that ratio should be 100 %. A plan that ships 50 tickets via shortcuts is worse than a plan that ships 30 via discipline; the discipline is the load-bearing claim.

The second success metric is **drift-honesty** — at every quarterly review, the answer to "what tickets slipped, and why" should be informative, not defensive. Drift happens; it's the silent drift that kills the plan.

The third success metric is **integration with feature work** — remediation does not freeze the product roadmap; the 40-40-15-5 allocation (Appendix F.1) lets both progress.

This plan is signed by Renan as author + sole engineer at v1.0 baseline. The peer-reviewer line in front matter is `_________________________` until hire #2 is in place; signing without a peer reviewer is acknowledged as a doctrine **R-14** gap that closes the moment the second engineer arrives.

The plan supersedes any informal remediation tracking previously kept in `moneyplan.txt` ("what you need to ship to make FactoryMind sellable this quarter"). The commercial commitments in `moneyplan.txt` are now expressed via UPLIFT § 7 roadmap; the technical risk closures are expressed here.

---

## Appendix H — Glossary of remediation terms

(Terms specific to this document; broader glossary in HANDOFF § 11.)

- **Wave.** Time-boxed group of remediation tickets with a fixed end-date. W0 / W1 / W2 / W3 + Continuous.
- **Effort estimate.** S / M / L / XL per § 1.6 calibration.
- **Severity gate.** Critical / High / Medium / Low; controls how a missed deadline escalates.
- **RACI.** Responsible / Accountable / Consulted / Informed.
- **Exit criteria.** Testable conditions that demonstrate ticket closure.
- **Regression test.** Test that fails before fix and passes after; the durable contract that prevents the gap from re-opening.
- **Blast radius.** Services / customers / surfaces that the fix touches; the do-no-harm boundary per rule **R-15**.
- **Rollback plan.** Specific commands or feature-flag toggles that reverse the change.
- **Communication.** Customer notice / changelog / postmortem requirements per rule **R-4**.
- **Verified.** All exit criteria met + regression test passes + peer review + no strength regression + communication closed.
- **Closed.** `Verified` + 30-day deferred check passes.
- **Wave drift.** Movement of a ticket from one wave to the next; allowed with sign-off (rule **R-7**); silent drift forbidden.
- **Accepted residual.** A finding the project deliberately does not remediate, with a documented trigger condition that flips it back to active.
- **Hotfix branch.** Branch cut from a stable release tag for an out-of-band W0 fix; merged via a `v1.x.y+1` tag rather than into main directly.
- **Verifier.** Engineer (distinct from implementer per rule **R-14**) who confirms exit criteria + regression test + no-strength-regression.
- **Sign-off.** Verifier's signature in the ticket schema attesting to verification.
- **Postmortem.** Blameless write-up of an incident; HANDOFF § 8.PM template; 5-working-day SLA.
- **Game day.** Quarterly drill of a runbook's response procedure under simulated incident.
- **Drift report.** At wave-end, the structured account of which tickets did not close on time and why.
- **Anti-ticket.** An item that looks remediation-eligible but is deliberately not (Appendix H1).

---

## Appendix O — Lessons from sister projects

The Macena product constellation provides operational lessons that bear on this plan. Drawing from `macena-logi-track` and `macena-greenmetrics`:

- **LogiTrack's Technical Debt Ledger** model (every debt with a State + Trigger structure) is mirrored in this plan's "Why this remediation, not another" + "Conditional / dependency-based tickets" appendix. The pattern is to make debt *visible and reviewable* rather than hidden.
- **GreenMetrics' Abstraction Ledger** treats abstractions as cost-centres requiring justification with removal triggers. Here, every ticket carries a "Why this remediation, not another" rationale with alternatives — the same impulse expressed at the ticket scale instead of the architecture scale.
- **LogiTrack's coverage ratchet plan** (backend test coverage at ~9 % vs an 80 % target, with a ratchet plan that raises the gate as layers cross 50 %) is the model for FactoryMind's UPLIFT u-dx-coverage-ratchet. We honour it here by **not** demanding 80 % coverage in this plan; coverage is UPLIFT, not REMEDIATION.
- **LogiTrack's accepted-residual pattern** ("kit ships with documented honesty about what's lossy under backpressure") is the model for [`AUDIT.md`](AUDIT.md) § 12 + this document's Appendix H6. The pattern requires honesty rather than over-promising.

These cross-product lessons are not strict requirements but inform the discipline. If a future audit pass produces findings comparable to LogiTrack's, the remediation plan adopts the same shape.

---

## Appendix P — Signing and timestamping

For records purposes (and for any future Garante audit that might inspect the remediation discipline):

- This document is committed to the FactoryMind repository at git commit `<TBD-on-commit>`.
- The commit is GPG-signed by Renan's key (fingerprint TBD when set).
- The git tag corresponding to the v1.0 four-document set is `docs-v1.0` and is signed.
- Subsequent revisions are tagged `docs-v1.x` with the changes summarised in each document's Appendix C diff.

The git history is the canonical timeline of the remediation discipline. A revisioning of this plan that loses the diff or the signing breaks the trust chain; rule **R-12** (postmortems are not retro-actively justified) applies by extension to the plan itself.

---

## Appendix Q — Frequently asked questions (anticipated)

**Q: Can a ticket be in multiple waves?**
A: Conceptually no. R-SUPPLY-001 is split into "W1 portion" (Cosign signing in CD) and "W2 portion" (Kyverno verification at admission); these are tracked as one ticket with two sub-states because the signing happens before the verification. Future tickets with similar structure should follow the same pattern (one ticket, sub-state lines).

**Q: What happens if the engineer is on holiday during a Critical ticket's deadline?**
A: Critical tickets identify a Responsible (R) and an Accountable (A) per RACI. If R is unavailable, A reassigns. If A is unavailable (sole engineer scenario), the ticket slips with explicit sign-off (rule **R-7**). The customer notice (rule **R-4**) acknowledges the slippage if customer-impacting.

**Q: What if a regression test is hard to write (e.g., race conditions, network failures)?**
A: Use Chaos Engineering tools (Toxiproxy, Pumba, network namespaces) where appropriate. If a regression test cannot be written within reason, the ticket is downgraded to "best-effort" with an explicit disclaimer; rule **R-1** is respected by writing the *closest possible* test rather than no test.

**Q: How do we handle a finding that's discovered to be a false positive?**
A: The finding is marked "False Positive" in [`AUDIT.md`](AUDIT.md) Appendix C diff with a rationale. The corresponding REMEDIATION ticket is closed with status "Withdrawn" and reasoning. The status board reflects.

**Q: What if the customer disputes a finding's severity?**
A: A customer's perspective on severity is informative but not authoritative. The Auditor's worksheet in [`AUDIT.md`](AUDIT.md) Appendix B is the basis. If the customer's reasoning convinces the auditor, the finding is rescored at the next quarterly review with full justification.

**Q: How do we coordinate with sister projects (GreenMetrics, LogiTrack, etc.) when their remediation affects ours?**
A: Cross-product integrations are doctrine **H-10** binding. A change to a sister-project boundary is documented before code, with both repos citing the same contract version. If GreenMetrics ships a v2 of its `/api/v1/energy/*` contract, FactoryMind's REMEDIATION plan opens a corresponding ticket; the close coordinates with GreenMetrics' close.

**Q: Can a ticket be "Verified" without a regression test if the test is impossible?**
A: No. Doctrine **R-1** is non-negotiable. If the test is genuinely impossible (e.g., the bug is in the customer's deployment-specific environment), the ticket is "Verified-with-disclaimer" + an explicit note in the verification record + a follow-up ticket to figure out a test approach.

**Q: What if the legal counsel review takes longer than expected?**
A: R-DPA-FILL-001, R-TIA-001, R-NIS2-SCOPE-001, R-CRA-001 all carry counsel-availability dependency. If counsel is delayed > 14 days, rule **R-18** triggers (block status); the ticket pauses; a follow-up email to counsel is sent. The block does not propagate to other tickets unless explicitly listed in `addBlockedBy`.

**Q: What if a Critical ticket cannot meet its W1 30-day deadline?**
A: Rule **R-7** sign-off; explicit roll-forward to W2 with reasoning; if the reasoning is "we discovered the fix is harder than estimated", a sub-ticket for the prerequisite is opened (rule **R-9**). If the customer-engagement timeline forced the ticket into W0 and it still misses, the customer is notified via the SLA channel; the project escalates to "feature freeze" until the Critical closes.

---

## Conclusions

The remediation plan converts the 31 findings of the v1.0 audit into 60+ tickets distributed across four waves and a continuous cadence track. The doctrine of 18 numbered rules ensures that every closed ticket is closed via a regression-tested, peer-reviewed, communicated, rollback-protected discipline; the wave model ensures that priority is honoured even under emergency.

The most-likely 12-month trajectory:

- **Months 1–2 (W1 wave):** ~ 19 tickets close. Critical findings on broker hardening, CI gates, supply-chain, frontend auth, GDPR scripts all land. First customer engagement-ready posture achieved.
- **Months 3–6 (W2 wave):** ~ 22 tickets close. Infrastructure hardening (KMS, NetworkPolicy, Kyverno), legal-track (NIS2, CRA, A11Y, cookie banner), data integrity tickets land.
- **Months 7–12 (W3 wave):** ~ 12 tickets close. Tail of LOW + Medium polish; tech-debt cleanup; bundled with feature work.
- **Continuous track:** 4 quarterly CVE sweeps; 4 quarterly retrospectives; 4 quarterly accepted-residual reviews; 4 restore drills; 4 game-days.

By the v2.0 plan publication (one year out), the platform should carry ~ 15 % of v1.0's open findings as remaining technical debt — a healthy state. New findings will accumulate from each quarterly audit pass; the plan-as-living-document handles this via Appendix L (sample ticket for an emerging finding).

This document is signed at v1.0 baseline by Renan as sole engineer. The peer-reviewer signature is pending until hire #2 is in place; the gap is documented (doctrine **R-14**) and the first quarterly review (2026-08-01 per HANDOFF doctrine **H-22**) will resolve it.

The remediation plan is a discipline, not a list. The list closes; the discipline persists.

---

**Made in Mozzecane (VR) — Veneto, Italy.**

(End of remediation plan v1.0; supersedes any informal tracking; continuously updated quarterly per HANDOFF doctrine **H-22** + AUDIT doctrine **A-12** + REMEDIATION doctrine **R-5**.)
