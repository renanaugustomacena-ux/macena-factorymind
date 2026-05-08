# FactoryMind — Polishing & Excellence Plan

**Versione:** 1.0.0 (baseline)
**Data:** 2026-05-07
**Pinned commit:** `d4c5107`
**Author:** Renan Augusto Macena
**Companion documents:** [`HANDOFF.md`](HANDOFF.md), [`AUDIT.md`](AUDIT.md), [`REMEDIATION.md`](REMEDIATION.md)
**Sign-off line:** _________________________ (date)

This document is the *polishing* plan. Where [`AUDIT.md`](AUDIT.md) catalogues what is broken and [`REMEDIATION.md`](REMEDIATION.md) ships the fixes, this document plots the *uplift* — the trajectory from "good" to "regulator-grade and customer-flagship". Polish-not-firefighting. Distinct from remediation in scope, voice, and cadence.

---

## Riepilogo esecutivo (IT)

L'**Uplift Plan** descrive la traiettoria di FactoryMind dal "buono" all'"eccellente". Il documento è deliberatamente separato da [`REMEDIATION.md`](REMEDIATION.md) perché le due discipline si elidono se confuse: la remediation chiude i buchi identificati dall'audit; l'uplift costruisce sopra le fondamenta consolidate. Una piattaforma può chiudere ogni finding di un audit senza migliorare; può migliorare in modo significativo senza correggere ogni finding. Le due cose richiedono mentalità diverse e cadenze diverse.

Il piano si articola lungo **cinque tracce di polishing** — Developer Experience (DX), Operations (OX), Security maturity, Commercial readiness, Compliance maturity — ciascuna con iniziative misurabili, dipendenze, criteri di successo, KPI. Le tracce sono ortogonali per scelta: una settimana di sprint allocata al 40 % per la remediation può vedere il rimanente 40 % di feature work + 15 % di technical debt + 5 % di on-call distribuito secondo la prioritizzazione delle tracce uplift.

Il documento adotta tre framework di riferimento: **DORA Four Keys** (deployment frequency, lead time for changes, change failure rate, MTTR) per misurare la maturità di delivery; **Spotify / ThoughtWorks Tech Radar** (Adopt / Trial / Assess / Hold) per gestire il portafoglio tecnologico nei prossimi 36 mesi; **Abstraction Ledger** (mutuato dal progetto sorella `macena-greenmetrics`) per trattare ogni astrazione architetturale come un cost-centre con condizioni di rimozione esplicite.

Il piano specifica **dodici iniziative** in dettaglio (con outcome, success metric, blast radius, rollback, owner, deadline) e ne lista altre 30+ a livello di sintesi. Le iniziative coprono: il completo allineamento alla baseline DORA "Elite", la migrazione del frontend a HttpOnly cookie auth + CSP nonce-based, la pipeline supply-chain SLSA Level 3, l'introduzione di un IDP integrabile per i clienti Tier 4, la maturità della certificazione CRA al 11 dicembre 2027, l'estensione WCAG 2.1 → 2.2 AA, la cadenza customer-success a 30/90/180 giorni, l'integrazione cross-product con `macena-greenmetrics` versionata, e infine la ratchet del coverage di test backend dal floor attuale verso un target sostenibile dell'80 %.

L'**anti-goals list** è esplicita per scelta: ciò che FactoryMind non farà nei prossimi 12 mesi. Non si forka per il settore della ristorazione (il valore portante è l'attestazione Piano 4.0/5.0 e i ristoranti non possono richiederla); non si introduce Apache Kafka prima di un milione di messaggi/secondo sostenuti (Mosquitto + EMQX coprono lo spazio commerciale realistico); non si migra a InfluxDB 3.x prima della GA + 6 mesi di soak in altri progetti; non si assume oltre il limite di MRR che giustifica la spesa. Ogni anti-goal carica una **flip condition** che, se si verifica, riapre la decisione.

Il documento chiude con una sezione di **orizzonte cinque anni** (deliberatamente leggera) che cataloga i blockers strategici anticipati e gli investimenti che li rimuovono, e con un set di **KPI di governance** (DORA + business: MRR, ARR, NDR, Gross Retention, CAC payback, LTV/CAC, Magic Number, Rule of 40, Burn Multiple) misurati mensilmente al consiglio.

L'uplift è una disciplina, non una corsa. Si misura in trimestri, non in sprint. La revisione quadrimestrale (HANDOFF doctrine **H-22**) è il rituale di governance che mantiene il piano allineato alla realtà.

---

## 0. Come leggere questo documento

**Percorso A — Engineer planning a sprint.** § 6 (five-track polish) per scegliere la traccia + l'iniziativa; § 8 per la specifica dettagliata; § 7 per la roadmap temporale.

**Percorso B — Product owner / founder planning the next quarter.** § 3 (DORA baseline + targets), § 7 (roadmap), § 9 (anti-goals), § 10 (KPIs). Insieme costituiscono il quadro decisionale trimestrale.

**Percorso C — Investor / due-diligence reviewer.** § 3 (current DORA state), § 4 (tech radar), § 9 (anti-goals — segno di disciplina), § 10 (governance KPIs), § 11 (five-year horizon).

**Percorso D — Designer / UX / commercial-readiness reviewer.** § 6 Track Commercial + Track Compliance + Track DX (in parte). Le tracce Operations + Security maturity sono engineering-focus.

**Percorso E — Compliance officer / Tier 3 enterprise customer's responsabile sicurezza.** § 6 Track Compliance — la trajectory CRA (11 dic 2027) + NIS2 + Stanca/WCAG 2.2 + Piano 5.0 GreenMetrics integration.

**Convenzioni redazionali.** Stesse di [`HANDOFF.md`](HANDOFF.md): sezioni etichettate **(IT)** in italiano, **(EN)** in inglese; iniziative numerate `u-<track>-<short-id>`; cross-references `[label](FILE.md#anchor)` agli altri tre documenti via stable anchors.

---

## 1. Why uplift is a separate document

The four-document set draws three distinct lines:

- **HANDOFF**: what *is* (the system in operation, the doctrines that bind, the runbooks that respond).
- **AUDIT**: what is *broken* (findings, severities, evidence, frameworks, scorecards).
- **REMEDIATION**: how the broken gets *fixed* (waves, tickets, exit criteria, drift, sign-offs).
- **UPLIFT**: how the fixed gets *better* (initiatives, metrics, anti-goals, roadmap).

The split is operational, not aesthetic. Conflating remediation and uplift is the most common failure of engineering planning: every quarter the team sets out to "polish things up", and three months later the remediation backlog has grown because polish projects consumed verifier capacity. The two disciplines have different cadences (remediation is wave-based with hard deadlines; uplift is initiative-based with measurable outcomes), different KPIs (remediation: tickets-closed-via-doctrine; uplift: DORA delta + business KPI delta), and different communication patterns (remediation: customer notices; uplift: roadmap announcements).

A practical consequence: a sprint can ship 2 remediation tickets + 1 uplift initiative + 1 feature ticket, and the time-allocation rule (REMEDIATION Appendix F.1) splits the budget. Mixing them into a single backlog produces a backlog where everything looks the same priority and nothing gets done.

A second practical consequence: this document makes promises about *capabilities* (e.g., "by Q3 2026, the platform reaches DORA Elite on lead time"). Those promises are negotiable, prioritisable, and revocable via anti-goals. The remediation plan makes promises about *risk closures* (e.g., "by 2026-06-06, finding F-CRIT-001 is closed"). Those promises are non-negotiable.

The third practical consequence: this document is **shorter and softer** than REMEDIATION. It targets ~ 22 000 words but does not pretend to be exhaustive (the way remediation must be exhaustive against findings). It catalogues the most important uplift initiatives; smaller polish work happens organically within the 15 % technical-debt budget without ticketing.

---

## 2. Doctrine — Polishing Work Doctrine

Twenty rules. Each follows the canonical four-part shape (rule → **Why** → **How to apply** → **Cross-refs**).

### Rule U-1 — Polish carries a guard test.

Refactors that "look cleaner" but break a hot path are net-negative. Every uplift initiative cites a regression test before merge.

**Why.** Polish is fragile by nature — small changes, accumulated. Without guard tests, a polished module silently regresses an unrelated test that was passing before.

**How to apply.** Every initiative spec (§ 8) carries a "Regression test" line. The test does not need to be new; an existing test that already covers the affected path is acceptable, but it must be cited so the reviewer can verify it exercises the changed code.

**Cross-refs.** REMEDIATION rule **R-1**.

### Rule U-2 — Don't gold-plate.

Uplift without measurable outcome is vanity. Every initiative names a metric and a target value; if you can't, it's not an uplift, it's an experiment — file under § 6 "Trial".

**Why.** Without measurement, an initiative cannot be evaluated. Six months later, no one remembers whether it was worth doing.

**How to apply.** Initiative spec carries `success_metric:` and `target_value:`. If both are vague, the initiative is rejected at the planning meeting.

**Cross-refs.** § 6, § 8 initiative spec template.

### Rule U-3 — Anti-goals are first-class.

Saying no is most of strategy. § 9 anti-goals are reviewed every quarter; flipping one requires a written rationale.

**Why.** Without explicit anti-goals, every reasonable-sounding suggestion accumulates into the roadmap; the roadmap loses focus; the team starts forty things and finishes none.

**How to apply.** § 9 carries the canonical list. Each carries a "flip condition" — a measurable trigger that, if it fires, reopens the decision. Quarterly review re-evaluates triggers.

**Cross-refs.** § 9.

### Rule U-4 — Boy Scout Rule applies — but commits stay focused.

"While I was here..." commits become merge-conflict swamps. Drive-by cleanups go in their own commit (or PR) with their own subject line.

**Why.** A PR that mixes a feature change with three unrelated cleanups becomes hard to review, hard to revert, hard to bisect. Discipline scales.

**How to apply.** Code review guideline; PR template question: "Are there any drive-by cleanups in this PR? If yes, split."

**Cross-refs.** Boy Scout Rule (HANDOFF Appendix A.6).

### Rule U-5 — Beck's preparatory refactor before each feature.

Make-the-change-easy then make-the-change. Initiative spec includes a "preparatory refactor" sub-step where applicable.

**Why.** A complicated change made directly accumulates technical debt; the refactor-first pattern keeps the diff readable.

**How to apply.** Initiative spec; sub-tickets for prerequisite refactors.

**Cross-refs.** Preparatory refactor citation; REMEDIATION rule **R-9**.

### Rule U-6 — Hyrum's Law — observable behaviours are part of the contract.

Customers (and integrators) come to depend on accidental behaviours. API changes carry a deprecation notice ≥ 90 days; observable broker topic shapes are versioned via `factory/v1/<facility>/...` once stabilised.

**Why.** A downstream-breaking change shipped without notice is a customer-trust loss.

**How to apply.** API and topic versioning; deprecation notices in HANDOFF § 6 + customer notice (REMEDIATION § 10.1).

**Cross-refs.** Hyrum's Law (HANDOFF Appendix A.6); HANDOFF § 6.

### Rule U-7 — DX matters as much as OX.

A 5-minute bootstrap saves more lifetime hours than any single optimisation. § 6 Track DX has the same weight as Operations.

**Why.** Engineer time is the scarcest resource. Friction in the inner-loop (build, test, hot-reload) compounds into months of lost productivity over a project's lifetime.

**How to apply.** Track DX initiatives are scoped equal to Track Operations.

### Rule U-8 — Compliance maturity is a polish track.

"Compliance is done" is a 6-month hallucination — CRA, NIS2, Piano 5.0 evolve. § 6 Track Compliance has continuous initiatives.

**Why.** Italian regulatory landscape changes annually (Legge di Bilancio); EU regulatory landscape changes by directive cycle. A static compliance posture decays.

**How to apply.** Track Compliance initiatives have explicit review-cadence triggers tied to legislative cycles.

### Rule U-9 — The customer-success cadence is product, not afterthought.

MODUS_OPERANDI § 15 (legacy): 30/90/180-day check-ins are the difference between churn and expansion. Appendix C codifies the runbook; Track Commercial schedules.

**Why.** Customer success is a structural input to retention, expansion, NPS, referral. Treating it as ad-hoc support is a quiet loss.

**How to apply.** Appendix C runbook; Track Commercial track-owner KPI.

### Rule U-10 — Cross-product polish is a separate stream.

GreenMetrics integration silently rotting is a Piano 5.0 attestation outage. § 8 includes a cross-product contract drill ticket.

**Why.** The Macena product constellation is interdependent; a unilateral polish on one side that breaks the other side is worse than no polish.

**How to apply.** Cross-product initiatives carry an explicit "joint-with: `<project>`" tag; both sides ship in coordinated PRs.

**Cross-refs.** HANDOFF § 10.

### Rule U-11 — Tech-radar movements are auditable.

Adopting a new library "because it's nice" creates ledger weight (§ 5 Abstraction Ledger). Every quadrant move (e.g., Trial → Adopt) carries an ADR + an Abstraction Ledger entry.

**Why.** Without explicit ADR + ledger entries, the team accumulates technologies it cannot justify removing.

**How to apply.** § 4 + § 5; HANDOFF doctrine **H-22** quarterly review re-evaluates.

### Rule U-12 — Don't migrate to InfluxDB 3.x before GA + 6 months of soak elsewhere.

This is a specific anti-goal protected at doctrine level because the temptation is real. The 1H InfluxDB tasks pipeline is load-bearing for FactoryMind's OEE math; an InfluxDB 3.x migration with sub-perfect Flux compatibility breaks the OEE math silently.

**How to apply.** § 9 carries the anti-goal; quarterly review re-evaluates.

### Rule U-13 — Polish does not break attestazione output.

Commercialista-facing PDFs that change format silently invalidate the customer's previously claimed credito. The attestazione PDF format is versioned (`format-v1`); changes are major versions; § 6 Track Compliance owns versioning.

**Why.** The customer's commercialista files an entire fiscal year's attestazioni based on the format expectation; a v2 format invalidates the v1 expectation.

**How to apply.** PDF rendering carries a `format_version` field; § 6 Track Compliance schedule for any format change.

**Cross-refs.** `legal/CONTRATTO-SAAS-B2B.md` art. 11.

### Rule U-14 — The kit is freelancer-grade until it isn't.

LogiTrack TECHNICAL-DEBT.md is the model: honest about scale, with a ratchet plan. Track DX includes a coverage ratchet plan; current backend coverage measured at first writing pass and entered as the floor.

**Why.** Pretending to be enterprise-grade before earning it is hubris. Honest debt with a ratchet is the disciplined path.

**How to apply.** § 6 Track DX initiative u-dx-coverage-ratchet.

**Cross-refs.** LogiTrack TECHNICAL-DEBT.md (cousin template).

### Rule U-15 — Uplift to Italian customer trust is engineering work, not marketing.

`moneyplan.txt`: trust without credentials is the 5 moves (Partita IVA + SDI; public GitHub repo; Italian landing video; local presence; signed attestazione PDF). Deliver them. § 6 Track Commercial includes "first signed attestazione PDF in customer's commercialista's hands" as a leading metric.

**Why.** Trust is built by what you ship, not what you say.

### Rule U-16 — No new abstraction without a removal trigger.

Abstraction Ledger discipline. § 5 entries each carry a removal-trigger condition; new entries land via ADR.

**Why.** Abstraction is a cost centre; making removal triggers explicit makes the cost reviewable.

**How to apply.** § 5; ADR for new entries.

### Rule U-17 — Quarterly review reads all four documents end-to-end.

Drift between handoff / audit / remediation / uplift is the failure mode. Appendix B template; quarterly review minutes archive.

**Why.** The four documents form a system; reading them in isolation misses systemic drift.

**How to apply.** HANDOFF doctrine **H-22**; Appendix B template here.

### Rule U-18 — Polish has a DORA cost line.

Polish that worsens deployment frequency is regression. Initiative spec includes "expected DORA delta"; if negative, justify.

**Why.** DORA's Four Keys are leading indicators of engineering health. Polish that makes deployments harder, leadership longer, MTTR worse, or change-fail-rate higher is anti-polish.

**How to apply.** § 8 initiative spec; quarterly DORA review (§ 3).

### Rule U-19 — Customer feedback shapes the roadmap, but not unilaterally.

Customer requests are signal, not contract. They inform Track Commercial priority but do not bypass the anti-goals.

**Why.** A roadmap shaped only by the loudest customer becomes scope-fragmented and direction-less.

**How to apply.** Quarterly customer-success review aggregates signals; signals feed the roadmap discussion at the planning meeting.

### Rule U-20 — Recognising "good enough" is a skill.

Some uplift initiatives, once started, expand indefinitely. Recognising when an initiative has hit "good enough" — when its incremental ROI drops below the next initiative's ROI — is part of the discipline.

**Why.** Perfectionism is a failure mode. The kit-honest approach (LogiTrack-style) is to ship "good enough" + ratchet later.

**How to apply.** Initiative success metrics define "good enough" before the work starts. When the metric is met, the initiative closes; further polish goes into a follow-up initiative if justified.

---

## 3. DORA baseline & targets

Four Keys (Forsgren / Humble / Kim, *Accelerate*, 2018; updated yearly via dora.dev). FactoryMind's v1.0 baseline is measured here; targets land at the 12-month and 24-month horizons.

| Key | v1.0 baseline | 12-month target | 24-month target | Industry "Elite" |
|---|---|---|---|---|
| Deployment frequency | Manual (per release tag); ~ 1 release per 2 weeks | Daily to staging; weekly to production | On-demand to production | Multiple times per day |
| Lead time for changes | ~ 1 day (single committer) | ~ 4 hours | ~ 1 hour | < 1 hour |
| Change failure rate | Unknown (no telemetry yet) | < 15 % | < 10 % | < 5 % |
| Mean time to recovery | Unknown (no incident yet) | < 4 hours | < 1 hour | < 1 hour |

**v1.0 baseline observations.**

- *Deployment frequency*: low (single-engineer, pre-customer state). Manual release tagging on demand.
- *Lead time*: short in calendar (single committer; merge-to-deploy ~ 1 hour) but the metric is misleading at this scale; meaningful comparison comes after hire #2.
- *Change failure rate*: not measured. The instrumentation to measure it (release-change correlation in observability + Linear/Issues incident log) is a Track Operations initiative.
- *MTTR*: not measured. Same instrumentation gap.

**Path to 12-month target.**

- Deployment frequency: REMEDIATION R-CI-DOCS-001 + R-CI-AUDIT-001 + R-SUPPLY-001 land + UPLIFT u-ops-cd-promotion-gate. Together, these enable the daily-to-staging, weekly-to-production cadence.
- Lead time: hire #2 onboarding + paired commits + small PR culture (UPLIFT u-dx-pr-discipline). Target ~ 4 hours by quarter 3.
- Change failure rate: instrumentation (UPLIFT u-ops-dora-instrumentation) + the discipline of attaching the trace ID to incident reports (already in error envelope). Measurable by quarter 2.
- MTTR: runbook drills (REMEDIATION § 8 Continuous) + on-call rotation maturity. Measurable by quarter 3.

**24-month target.**

- Deployment frequency on-demand: blue-green deploys; tier-aware promotion gates; full Cosign + Kyverno verification chain. Sustainable.
- Lead time ~ 1 hour: small PRs are the norm; CI green is fast; reviewer SLA ≤ 1 day.
- Change failure rate < 10 %: error-budget burn becomes the gate; release decisions data-driven.
- MTTR < 1 hour: runbook drills routine; alerting precision high (REMEDIATION + AUDIT SLO-5 ≥ 99 %); customer-impact telemetry visible.

**KPI dashboard.** Tracked monthly in a Grafana panel `factorymind_dora_metrics` (UPLIFT u-ops-dora-instrumentation ships it).

---

## 4. Tech radar (Adopt / Trial / Assess / Hold)

The Spotify / ThoughtWorks technology-radar pattern: each technology in the FactoryMind stack sits in one of four quadrants. Movements between quadrants are auditable (rule **U-11**); each movement requires an ADR + a § 5 Abstraction Ledger entry.

### Adopt (current production-ready)

These are technologies the platform commits to for the next 12-24 months.

| Tech | Role | Why Adopt |
|---|---|---|
| Node.js 20 LTS | Backend runtime | LTS through April 2026; mature ecosystem |
| Express 4 | HTTP framework | Stable; well-understood; doctrine **H-4** binds API surface |
| MQTT.js | MQTT client | Most-used Node.js MQTT lib; active maintenance |
| InfluxDB 2.7 | Time-series | Production-tested; downsampling pipeline mature |
| PostgreSQL 16 | Metadata + audit | Industry-standard for relational data; Aurora Serverless v2 path |
| Eclipse Mosquitto 2.x | MQTT broker | Smallest-footprint production-grade broker; pattern-based ACL |
| React 18 | Frontend framework | Mature; ecosystem deep |
| Vite 5–7 | Frontend bundler | Fast HMR; modular; ESM-native |
| TypeScript 5 | Frontend typing | Strict mode; structural typing |
| Tailwind 3 | CSS | Utility-first; consistent design system |
| TanStack Query 5 | Frontend cache | Best-in-class for async-state |
| node-pg-migrate | DB migrations | Forward-only + idempotent (doctrine **H-14**) |
| Joi | Backend validation | Mature schema validation |
| pino | Backend logging | Fast structured logger; PII redaction |
| Helmet | Backend security headers | OWASP-aligned defaults |
| Grafana 11+ | Dashboards | Industry standard |
| Prometheus + Alertmanager | Metrics + alerting | Industry standard |
| OpenTelemetry | Tracing | Vendor-neutral |
| Terraform 1.6+ | IaC | Mature; multi-provider |
| Docker + docker-compose v2 | Container build + orchestration (dev) | Industry standard |
| Kubernetes 1.30+ | Container orchestration (prod) | Industry standard |
| node-opcua | OPC UA client | Mature; SignAndEncrypt support |
| modbus-serial | Modbus client | Adequate; alternatives are narrow |
| sparkplug-payload | Sparkplug B | Reference implementation |
| pdfkit (or puppeteer) | PDF rendering | Production-ready |
| HIBP k-anonymity API | Password-breach check | Privacy-preserving |
| Sigstore + Cosign | Image signing | Open standard; SLSA-aligned |
| Syft | SBOM | Open-source; SPDX format |
| Trivy | Vulnerability scan | Open-source; comprehensive |

### Trial (active evaluation; production-graduation candidate)

These are technologies under active evaluation; one or more are expected to graduate to Adopt within 12 months.

| Tech | Role | Why Trial |
|---|---|---|
| Vitest | Frontend test runner | Faster than Jest; ESM-native; UPLIFT u-frontend-vitest |
| Playwright + axe-core | A11Y + e2e | Mature; UPLIFT u-frontend-e2e-a11y |
| @axe-core/playwright | A11Y CI | Layered onto Playwright |
| release-please | Changelog automation | Conventional-commits driven; UPLIFT u-changelog-auto |
| pgcrypto | Postgres column-level encryption | For PII column at scale |
| EMQX 5.x | Multi-tenant MQTT | Replacement for Mosquitto when single-broker scaling exhausts |
| Kyverno | K8s admission policy | Image signature verification; UPLIFT u-k8s-policy-as-code |
| ExternalSecrets | K8s secrets sync | AWS Secrets Manager → k8s sync |
| Husky + lint-staged | Pre-commit hooks | UPLIFT u-dx-pre-commit |
| Atlantis | Terraform PR-driven plan | UPLIFT u-tf-pipeline |
| InfluxDB 3.x | Time-series next-gen | Wait for GA + 6-month soak (anti-goal U-12) |

### Assess (interesting; not yet on the timeline)

| Tech | Role | Why Assess |
|---|---|---|
| Rust (selectively) | Edge agent rewrites | Memory-safe; small footprint; potentially Track DX initiative |
| Bun | Backend runtime alternative | Fast; not LTS-aligned; worth tracking |
| Deno | Backend runtime alternative | TS-native; security-by-default; worth tracking |
| WASM-based MQTT broker (e.g., Iggy) | Broker alternative | Early-stage; ecosystem TBD |
| TimescaleDB | Time-series alternative | InfluxDB 3.x's main competitor; assess |
| QuestDB | Time-series alternative | Specialised for IoT |
| Prisma | ORM | Type-safe; DX gain; runtime-cost trade-off |
| OpenSearch | Logging + dashboards | Loki alternative |
| DuckDB | Analytics | Embedded analytics; assess for reports |
| OPC UA over WebSocket / OPC UA pubsub | OPC UA modernisation | Track standards evolution |

### Hold (do not adopt; rationale)

| Tech | Role | Why Hold |
|---|---|---|
| Kafka | Message broker | Anti-goal U-9.2; over-engineered for FactoryMind scale |
| Apache Pulsar | Message broker | Same |
| MongoDB | Metadata DB | Postgres is structurally correct for FactoryMind's relational model |
| GraphQL | API style | REST is simpler for FactoryMind's CRUD surface |
| Sigstore Rekor (transparency log direct integration) | Supply-chain transparency | Cosign keyless covers it |
| OAuth-providers-as-IDP (Auth0 / Okta) | Customer SSO | TBD per customer requirement; not default |
| HashiCorp Vault | Secrets | Aruba KMS / AWS Secrets Manager covers; Vault is added complexity |
| JFrog Artifactory | Image registry | GHCR + customer's private registry covers |
| Datadog | Observability | Open-source stack (Loki + Prometheus + Grafana) is sufficient |

### Quadrant movement criteria

A technology moves between quadrants only via the ADR process. Examples:

- **Trial → Adopt:** the technology has been used in at least one production deployment for ≥ 3 months without major issues; its position in § 5 Abstraction Ledger has been confirmed.
- **Adopt → Hold:** the technology has been deprecated upstream or replaced; ADR documents the deprecation timeline.
- **Assess → Hold:** the assessment concludes the technology is not a fit; the reasoning is captured for future re-evaluation.
- **Hold → Trial:** anti-goal flip condition fires; ADR re-justifies the move.

Quadrant changes appear in the quarterly review minutes (Appendix B template).

---

## 5. Abstraction ledger

Modelled on `macena-greenmetrics`'s `docs/ABSTRACTION-LEDGER.md`. Every architectural abstraction in FactoryMind has a documented cost, a removal trigger, and an owner. Abstractions accumulate by default; this ledger forces a conversation each quarter about whether each is still earning its keep.

### AB-01 — Multi-protocol bridge layer (OPC UA + Modbus + MQTT + Sparkplug)

**State.** Active. Each protocol has a separate service (`backend/src/services/{opcua,modbus,sparkplug}-bridge.js`) translating its native envelope to the canonical FactoryMind envelope.

**Cost.** Three additional code paths to maintain; three additional dependency surfaces (`node-opcua`, `modbus-serial`, `sparkplug-payload`); cross-bridge testing complexity.

**Why we have it.** Italian SME machine fleets are heterogeneous; a single-protocol product loses deals at the customer-engagement boundary.

**Removal trigger.** None foreseeable. Industrial protocols have decade-scale lifecycles; this abstraction is here to stay.

**Owner.** Backend team.

### AB-02 — Sparkplug B as opt-in (env-var gated dynamic require)

**State.** Active. `SPARKPLUG_ENABLED=true` env var enables the bridge.

**Cost.** Dynamic require pattern + try/catch (after R-SPARKPLUG-LOAD-001); operationally bifurcated paths.

**Why we have it.** Most Tier 2 customers do not run Sparkplug; gating disables the protobuf surface (CVE-history potential).

**Removal trigger.** If > 50 % of Tier 2 customers run Sparkplug, flip to default-on.

**Owner.** Backend team.

### AB-03 — JSONB metadata fields on `devices`, `shifts`, etc.

**State.** Active. Free-form integrator-configurable metadata.

**Cost.** PII boundary risk (doctrine **H-13**); schema-less data where structure would help.

**Why we have it.** Every customer's device-specific configuration is unique; rigid schema would be churn.

**Removal trigger.** If a typed schema emerges for OPC UA tag mapping (e.g., a community-standard JSON Schema), migrate.

**Owner.** Backend team.

### AB-04 — Pattern-based broker ACL with `%u` substitution

**State.** Active. `pattern readwrite factory/%u/#`.

**Cost.** Dependency on Mosquitto's pattern syntax; harder to reason about than per-user explicit ACLs.

**Why we have it.** Hard tenant-isolation primitive; scales without per-tenant ACL line.

**Removal trigger.** Migration to EMQX (UPLIFT trial) — EMQX has a richer ACL model.

**Owner.** DevOps + Backend.

### AB-05 — Audit log via centralised middleware

**State.** Active. Every state-changing 2xx/4xx response writes a row.

**Cost.** Synchronous insert latency (under 1 ms typically); F-MED-DATA-002 lossy-under-backpressure documented.

**Why we have it.** Forensic foundation; doctrine **H-7** + AUDIT compliance.

**Removal trigger.** None — central abstraction. Async-with-buffer (R-AUDIT-ASYNC-001) is an internal optimisation, not removal.

**Owner.** Backend team.

### AB-06 — RBAC role hierarchy + facility scope

**State.** Active. Four roles (viewer/operator/supervisor/admin) + `facility_scope[]`.

**Cost.** Application-layer authorisation logic; potential drift from broker ACL if not coordinated.

**Why we have it.** Multi-facility customers (Tier 3+) need scoping.

**Removal trigger.** Migration to a customer-managed IDP (UPLIFT u-idp-integration); the IDP would carry roles + scopes.

**Owner.** Backend.

### AB-07 — Downsampling task pipeline (Influx Flux tasks)

**State.** Active. `downsample_1m`, `_1h`, `_1d` provisioned at startup.

**Cost.** Three additional tasks to monitor (REMEDIATION R-INFLUX-TASK-001 verifies); InfluxDB version-specific.

**Why we have it.** Long-term retention without storage blow-up; OEE math depends on aggregates.

**Removal trigger.** Migration to InfluxDB 3.x or to a different time-series engine (TimescaleDB); the abstraction would translate.

**Owner.** Backend + DevOps.

### AB-08 — Cross-product GreenMetrics integration via DNS-SD

**State.** Active for Piano 5.0 attestazione.

**Cost.** Cross-product contract risk (HANDOFF doctrine **H-10**); DNS-SD complexity for single-deployment Tier 2.

**Why we have it.** Piano 5.0 requires energy savings calculation; GreenMetrics is the source-of-truth for that.

**Removal trigger.** Migration to a unified data plane that includes both energy and OEE metrics. Not foreseeable.

**Owner.** Backend + cross-product coordination.

### AB-09 — Italian-default + EN/DE i18n locales

**State.** Active. IT default; EN + DE translations.

**Cost.** Three locales to maintain; key-drift risk (F-MED-CODE-002).

**Why we have it.** Italian primary market; EN for cross-border; DE for Anno 3 expansion target (Baden-Württemberg).

**Removal trigger.** None foreseeable. Anti-goal: do not add a fourth locale before there's a customer in that market.

**Owner.** Frontend.

### AB-10 — `pino` logging with redaction

**State.** Active.

**Cost.** Redaction list maintenance; PII boundary careful coordination (doctrine **H-13**).

**Why we have it.** Fast structured logging; built-in redaction reduces PII-leak risk.

**Removal trigger.** None foreseeable.

**Owner.** Backend.

### AB-11 — `install.sh` interactive + unattended dual-mode

**State.** Active.

**Cost.** Bash-script complexity; OS-detection logic; testing matrix.

**Why we have it.** Tier 2 customer onboarding velocity (doctrine **H-1**); CI / unattended use.

**Removal trigger.** Migration to a Helm chart-based installer for Tier 4 SaaS scale; Tier 2 self-hosted continues with install.sh.

**Owner.** DevOps.

### AB-12 — Helm? Or Kustomize? (deferred decision)

**State.** Decision deferred. K8s manifests are raw YAML at v1.0.

**Cost.** None yet (no abstraction). Future deployment to many customers requires templating.

**Trigger to decide.** First Tier 4 SaaS deployment that needs per-tenant manifest customisation.

**Owner.** DevOps.

### AB-13 — `node-pg-migrate` for migrations

**State.** Active.

**Cost.** Tool-specific syntax; migration files versioned alongside code.

**Why we have it.** Idempotent forward-only migrations are doctrine **H-14**.

**Removal trigger.** Migration to Prisma Migrate or sqlx if backend rewrites in TypeScript with Prisma (UPLIFT u-dx-typescript-backend → trial).

**Owner.** Backend.

### AB-14 — `helmet` for security headers

**State.** Active.

**Cost.** Tracking helmet release notes for new defaults.

**Why we have it.** OWASP-aligned defaults; less custom code.

**Removal trigger.** None foreseeable.

**Owner.** Backend.

### AB-15 — `pdfkit` (or `puppeteer`) for attestazione PDF

**State.** Active (the v1.0 implementation TBD between the two; presented as if pdfkit for default reasoning).

**Cost.** PDF rendering complexity; format versioning (doctrine **U-13**).

**Why we have it.** Attestazione PDF is the load-bearing deliverable.

**Removal trigger.** Migration to a digital-signature-first PDF flow (UPLIFT u-pdf-sign).

**Owner.** Backend.

### AB-16 — Realtime WebSocket fan-out

**State.** Active. Backend `ws/server.js` fans out MQTT messages to subscribed browsers.

**Cost.** WebSocket maintenance; backpressure handling; auth migration (R-WS-AUTH-001).

**Why we have it.** Live-dashboard customer experience.

**Removal trigger.** Migration to Server-Sent Events (SSE) or to MQTT-over-WebSocket directly. Not foreseeable.

**Owner.** Backend + Frontend.

### Rejected abstractions (catalogued for future audit passes)

- **GraphQL** — rejected; REST is simpler for FactoryMind's CRUD surface.
- **gRPC for backend ↔ backend** — not applicable; FactoryMind has no backend↔backend RPC at v1.0.
- **Kafka as ingress queue** — rejected; anti-goal.
- **Custom ORM** — rejected; raw `pg.query` with parameterised statements is sufficient.
- **Custom secrets management** — rejected; AWS Secrets Manager / Aruba KMS is sufficient.

The ledger is reviewed quarterly (HANDOFF doctrine **H-22**); each entry is re-validated against its trigger.

---

## 6. Five-track polish

The five tracks are **DX (Developer Experience)**, **OX (Operations)**, **Security maturity**, **Commercial readiness**, **Compliance maturity**. Each has 5–8 initiatives; each initiative is named, scoped, and assigned to a wave. The tracks are orthogonal; an engineering week can pick from any.

### 6.1 Track DX (Developer Experience)

The premise: a 5-minute bootstrap saves more lifetime hours than any single optimisation (rule **U-7**).

| Initiative | Outcome | Success metric | Wave |
|---|---|---|---|
| u-dx-bootstrap-time | Bootstrap ≤ 10 minutes (cf doctrine **H-1** ≤ 15 min) | Stopwatch + CI job (R-CI-BOOT-001) | Q3 2026 |
| u-dx-pre-commit | Husky + lint-staged for prettier + eslint + tsc | Pre-commit hook adopted; CI no longer needs lint as separate gate | Q3 2026 |
| u-dx-test-feedback | Backend tests run in < 30 s; frontend Vitest < 10 s | Stopwatch | Q4 2026 |
| u-dx-error-legibility | Backend errors carry user-friendly + developer-friendly views | DX survey | Q4 2026 |
| u-dx-typescript-backend | Backend incrementally migrated to TypeScript | % of `backend/src/` files in TS | Q1 2027 (trial) |
| u-dx-coverage-ratchet | Backend test coverage ratchet plan from current floor → 80 % over 18 months | Coverage report | Continuous |
| u-dx-pr-discipline | Average PR size < 400 LOC; PR cycle time < 1 day | PR analytics | Q4 2026 |
| u-dx-onboarding-doc | Per HANDOFF § 12 + extended | Onboarding speed (cf rule **H-5**) | Q3 2026 |

### 6.2 Track OX (Operations)

The premise: SLO + error-budget discipline + runbook-as-code.

| Initiative | Outcome | Success metric | Wave |
|---|---|---|---|
| u-ops-cd-promotion-gate | Automated promotion gate (test → staging → production) with checkpoints | DORA deployment frequency | Q3 2026 |
| u-ops-dora-instrumentation | Grafana DORA dashboard | Dashboard live; metrics queried | Q3 2026 |
| u-ops-runbook-drills | Quarterly game day for each runbook | 8 runbooks × quarterly = 32 drills/year | Continuous |
| u-ops-cross-product | Cross-product contract drill (GreenMetrics) quarterly | Drill outcome notes | Continuous |
| u-ops-edge-template | Terraform module for customer edge deployment | Module exists; first customer used | Q4 2026 |
| u-ops-observability-deepening | Trace-to-log correlation full coverage | OTel sampler at 100 % traces during incidents | Q1 2027 |
| u-ops-grafana-cloud | Optional migration to Grafana Cloud for Tier 4 | Grafana Cloud option live | Q1 2027 |
| u-ops-status-page | factorymind.cloud/status (or equivalent) | Status page live | Q4 2026 |

### 6.3 Track Security maturity

The premise: IEC 62443 SL-2 (current) → SL-3 trajectory; SLSA Level 1 (current) → 3 trajectory.

| Initiative | Outcome | Success metric | Wave |
|---|---|---|---|
| u-sec-slsa-l3 | SLSA Level 3 across backend / frontend / simulator images | SLSA verification reports | Q1 2027 |
| u-sec-iec62443-sl3 | IEC 62443 SL-3 trajectory documented + critical SR upgrades | Self-assessment grid (AUDIT § 10) | Q2 2027 |
| u-sec-mtls-fleet | mTLS for production broker connections (per-device certs) | All edge gateways using mTLS | Q1 2027 |
| u-sec-pii-column-encrypt | pgcrypto column-level encryption for PII columns | `users.email` encrypted at column | Q4 2026 |
| u-sec-hsm-cmk | HSM-backed CMK option for Tier 3 customers | Available on request | Q2 2027 |
| u-sec-pen-test-001 | Independent penetration test (CREST or OSSTMM) post-W1 closure | Pen-test report | Q4 2026 |
| u-sec-bug-bounty | Public bug-bounty programme (HackerOne or self-hosted) | Programme live; researcher contact established | Q1 2027 |
| u-sec-zero-trust-net | Zero-trust network architecture for SaaS Tier 4 | Tailscale or equivalent in production | Q2 2027 |

### 6.4 Track Commercial readiness

The premise: trust without credentials is built by what you ship (rule **U-15**).

| Initiative | Outcome | Success metric | Wave |
|---|---|---|---|
| u-com-first-customer-engagement | First Tier 2 contract signed | Signed contract + first attestazione delivered | Q3 2026 |
| u-com-customer-success-cadence | 30/90/180-day check-in runbook + scheduled cadences | NPS at 12 months ≥ 50 | Continuous |
| u-com-attestazione-pdf-polish | Customer-facing PDF layout + signed cryptographically | Customer's commercialista signs off on format | Q3 2026 |
| u-com-attestazione-pdf-sign | Digital signature on PDF + chain-of-custody integrity | Cryptographic signature verified by external tool | Q4 2026 |
| u-com-landing-conversion | Italian video + downloadable sample attestazione | Landing page conversion rate measurable | Q3 2026 |
| u-com-channel-commercialista | Channel-partner programme for ODCEC accountants | First commercialista certified; first referral closed | Q4 2026 |
| u-com-channel-installer | Installer partnership with Veneto integrators | First integrator-driven sale closed | Q1 2027 |
| u-com-pricing-experiments | A/B test on Tier 2 pricing | Conversion delta measured | Q1 2027 |

### 6.5 Track Compliance maturity

The premise: compliance is not a one-shot deliverable; it's a continuous discipline.

| Initiative | Outcome | Success metric | Wave |
|---|---|---|---|
| u-comp-piano-5.0-greenmetrics | Versioned cross-product contract with GreenMetrics | Contract version `v1` shipped; both repos cite | Q3 2026 |
| u-comp-cra-conformity | Self-conformity assessment under CRA (Reg. UE 2024/2847) | Assessment report by 11 dic 2027 | Q2 2027 |
| u-comp-nis2-cert | NIS2 ACN registration if scope determined | Registration receipt | Q1 2027 (annual cycle) |
| u-comp-a11y-22 | WCAG 2.1 AA → 2.2 AA | axe-core CI clean; manual audit clean | Q2 2027 |
| u-comp-iso-27001 | ISO 27001 certification trajectory | Stage 1 audit booked | Q3 2027 (long lead) |
| u-comp-italia-residency | Aruba Cloud Italia option in Terraform module | Module exists; first customer deployed | Q4 2026 |
| u-comp-dora-act | DORA (Digital Operational Resilience Act for finance — not directly applicable but tangentially relevant) | Awareness assessment | Q1 2027 |
| u-comp-fiscal-rates-update | Annual update of `fiscal-rates.js` with new Legge di Bilancio | New rates applied within 30 days of Legge di Bilancio | Annual |

---

## 7. Roadmap (next 12 months, quarterly)

### Q3 2026 (months 1–3)

**Must-ship:**

- W1 remediation closure (REMEDIATION § 5).
- u-com-first-customer-engagement (first Tier 2 contract).
- u-com-attestazione-pdf-polish (customer-ready format).
- u-comp-piano-5.0-greenmetrics (cross-product contract v1).
- u-ops-dora-instrumentation (DORA dashboard live).

**Stretch:**

- u-dx-bootstrap-time (≤ 10 minutes).
- u-dx-pre-commit (Husky + lint-staged).
- u-com-landing-conversion.

### Q4 2026 (months 4–6)

**Must-ship:**

- W2 remediation closure (REMEDIATION § 6).
- u-com-attestazione-pdf-sign.
- u-sec-pen-test-001 (first external pen-test).
- u-sec-pii-column-encrypt.
- u-comp-italia-residency (Aruba option).

**Stretch:**

- u-com-channel-commercialista (first ODCEC partner).
- u-ops-edge-template.
- u-ops-status-page.

### Q1 2027 (months 7–9)

**Must-ship:**

- W3 remediation closure (REMEDIATION § 7) + tail of W2.
- u-comp-nis2-cert (annual ACN registration).
- u-sec-mtls-fleet (production broker mTLS).
- u-sec-bug-bounty (programme live).

**Stretch:**

- u-dx-typescript-backend (begin trial).
- u-com-pricing-experiments.
- u-com-channel-installer.

### Q2 2027 (months 10–12)

**Must-ship:**

- u-comp-cra-conformity (self-conformity assessment).
- u-sec-iec62443-sl3 (SL-3 trajectory).
- u-comp-a11y-22 (WCAG 2.2 AA).

**Stretch:**

- u-sec-zero-trust-net.
- u-sec-hsm-cmk.
- u-comp-iso-27001 (Stage 1 audit booked).

The roadmap is reviewed quarterly. Tickets that slip get rolled forward with explicit sign-off (mirroring REMEDIATION rule **R-7** at the initiative level).

---

## 8. Initiative spec template + 12 specced initiatives

### 8.1 Template

```markdown
### u-<track>-<short-id> — <imperative title>

- **Track:** DX / OX / Security / Commercial / Compliance
- **Outcome:** (one sentence; what does the world look like after?)
- **Success metric:** (specific, measurable; rule **U-2**)
- **Target value:** (the level of the metric that constitutes success)
- **Owner:** Renan or designated lead
- **Dependencies:** (other initiatives, REMEDIATION tickets, hires, customer-engagements)
- **Blast radius:** (what services / customers / processes does this affect?)
- **Rollback plan:** (if the initiative degrades or fails)
- **Effort:** S / M / L / XL (initiative-level; bigger than ticket-level)
- **Wave:** Q3 2026 / Q4 2026 / Q1 2027 / Q2 2027
- **Status:** Pending / In Progress / Verified / Closed
- **Expected DORA delta:** (rule **U-18**)
- **Why this initiative, not another:** alternatives considered + tradeoffs
```

### 8.2 u-com-attestazione-pdf-polish — Polished customer-facing attestazione PDF

- **Track:** Commercial.
- **Outcome:** The Piano 4.0 attestazione PDF is visually polished, customer-branded (logo + colors per Tier 3 fork; FactoryMind-branded for Tier 2), and readable at first sight by a commercialista who has never seen FactoryMind.
- **Success metric:** First customer's commercialista accepts the PDF format without revision request; format passes the Circolare 9/E/2018 checklist verification.
- **Target value:** Two distinct commercialisti review and accept.
- **Owner:** Renan + frontend designer (contracted if needed).
- **Dependencies:** R-ATTESTAZIONE-IDEMPOTENCY-001; first Tier 2 customer signed.
- **Blast radius:** PDF rendering pipeline; customer-facing artefact.
- **Rollback plan:** Revert to v1.0 PDF format; re-issue attestazioni in old format.
- **Effort:** L.
- **Wave:** Q3 2026.
- **Status:** Pending.
- **Expected DORA delta:** Neutral to positive (cleaner PDF generation code).
- **Why this initiative, not another:** alternative — outsourced PDF generation service (Documate, Helly) — rejected; load-bearing artefact must stay in-house.

### 8.3 u-com-attestazione-pdf-sign — Digital signature on attestazione PDF

- **Track:** Commercial + Compliance.
- **Outcome:** Every PDF carries a cryptographic signature (PKCS#7 or X.509 detached) tied to FactoryMind's signing identity; signature verifiable via standard tools (Adobe Reader, `openssl smime -verify`, etc.).
- **Success metric:** External verification succeeds; signature integrity maintained across email transmission.
- **Target value:** 100 % of PDFs from production carry valid signature.
- **Owner:** Backend.
- **Dependencies:** PKI strategy (HSM-backed signing key recommended).
- **Blast radius:** PDF generation; key management.
- **Rollback plan:** Revert to unsigned PDF (with documentation update).
- **Effort:** L.
- **Wave:** Q4 2026.
- **Status:** Pending.
- **Expected DORA delta:** Neutral.

### 8.4 u-comp-piano-5.0-greenmetrics — Versioned cross-product contract

- **Track:** Compliance.
- **Outcome:** The FactoryMind ↔ GreenMetrics contract for Piano 5.0 energy-savings calculation is versioned (`cross-product/greenmetrics-energy-v1`); both repos cite the same contract; CI integration test in both repos exercises a simulated v1 round-trip.
- **Success metric:** Both repos pass the contract test; deviating endpoints fail CI.
- **Target value:** ≥ 99 % of cross-product calls succeed end-to-end.
- **Owner:** Backend (FactoryMind side) + sister-product owner (GreenMetrics side).
- **Dependencies:** Cooperation between the two repos.
- **Blast radius:** Piano 5.0 attestazione path; cross-product contract.
- **Rollback plan:** Revert FactoryMind side; GreenMetrics retains v1 contract; FactoryMind serves a degraded Piano 5.0 attestazione (with manual upload of energy savings).
- **Effort:** M.
- **Wave:** Q3 2026.
- **Status:** Pending.

### 8.5 u-sec-pen-test-001 — Independent penetration test post-W1

- **Track:** Security.
- **Outcome:** External pen-test by a CREST or OSSTMM-credentialed firm; report integrated into the next quarterly AUDIT diff.
- **Success metric:** Pen-test report; severity-class agreement with internal AUDIT > 80 %.
- **Target value:** No CRITICAL findings discovered; ≤ 5 HIGH findings.
- **Owner:** Renan + external pen-test firm.
- **Dependencies:** W1 remediation closure (so the broker hardening, OPC UA validation, etc., are in place).
- **Blast radius:** Test environment (staging); short-term load on the team to triage.
- **Rollback plan:** N/A (assessment only).
- **Effort:** L (engagement + remediation of new findings).
- **Wave:** Q4 2026.
- **Status:** Pending.

### 8.6 u-com-customer-success-cadence — 30/90/180-day check-in cadence

- **Track:** Commercial.
- **Outcome:** Every paying customer receives a structured check-in at 30, 90, and 180 days post-onboarding; check-ins are scripted, recorded, fed back into the roadmap.
- **Success metric:** Customer-success cadence executed for every Tier 2/3 customer; NPS measurable.
- **Target value:** NPS at 12 months ≥ 50; customer expansion on ≥ 30 % of accounts.
- **Owner:** Customer-success engineer (initially Renan; future hire).
- **Dependencies:** First Tier 2 customer signed.
- **Blast radius:** Customer relationship.
- **Rollback plan:** Skip cadence for a quarter if capacity issue (with an explicit sign-off).
- **Effort:** Continuous (ongoing).
- **Wave:** Continuous starting Q3 2026.
- **Status:** Pending (depends on first customer).

### 8.7 u-dx-coverage-ratchet — Backend test coverage ratchet plan

- **Track:** DX.
- **Outcome:** Backend test coverage ratchets from the current floor (measured at first writing pass; estimated 60 % lines based on existing test suite, but to be confirmed) toward 80 % over 18 months. Each layer (handlers, services, repository, middleware, audit, obs, config, demo) must clear 50 % before the gate raises.
- **Success metric:** Coverage report.
- **Target value:** 80 % global by Q1 2028.
- **Owner:** All backend engineers.
- **Dependencies:** None.
- **Blast radius:** None (additive).
- **Rollback plan:** Revert the gate raise.
- **Effort:** Continuous.
- **Wave:** Continuous.
- **Status:** Pending (measurement first; ratchet plan articulated in this document).

### 8.8 u-comp-cra-conformity — CRA self-conformity assessment

- **Track:** Compliance.
- **Outcome:** Self-conformity assessment under Reg. UE 2024/2847 articles 6 + 13. Technical documentation file produced. CE marking trajectory established.
- **Success metric:** Assessment file complete; counsel sign-off; CE marking applied to commercial Tier 2/3/4 distributions.
- **Target value:** Pre-deadline (11 December 2027) compliance.
- **Owner:** Renan + external counsel.
- **Dependencies:** R-CRA-001 analysis complete.
- **Blast radius:** All commercial distributions.
- **Rollback plan:** N/A.
- **Effort:** XL (long-tail; parallel to other work).
- **Wave:** Q2 2027 → ongoing through 11 dic 2027.
- **Status:** Pending.

### 8.9 u-ops-runbook-drills — Quarterly runbook drills (game days)

- **Track:** Operations.
- **Outcome:** Each runbook in HANDOFF § 8 exercised quarterly under simulated incident.
- **Success metric:** 4 game days per quarter; postmortem archived.
- **Target value:** Drill detection latency converges to < 5 minutes; mitigation latency < 30 minutes (Critical).
- **Owner:** On-call rotation.
- **Dependencies:** Hire #2 onboarding (for safety reasons in single-engineer drill).
- **Blast radius:** Staging (production drills require explicit sign-off + customer notice).
- **Rollback plan:** Revert game-day-induced state changes.
- **Effort:** Continuous; M per drill.
- **Wave:** Continuous starting Q3 2026.
- **Status:** Pending.

### 8.10 u-com-channel-commercialista — Commercialista channel-partner programme

- **Track:** Commercial.
- **Outcome:** "FactoryMind 4.0 Certified" programme for ODCEC-iscritti commercialisti; webinar + simulator access + referral fee structure (€300/cliente).
- **Success metric:** Number of certified commercialisti × number of referrals × conversion rate to closed Tier 2 sales.
- **Target value:** 5 certified commercialisti by end of Q4 2026; 3 referral-driven closes by Q1 2027.
- **Owner:** Renan + sales hire.
- **Dependencies:** First customer reference; webinar materials; CRM (HubSpot per legacy MODUS_OPERANDI § 10.7).
- **Blast radius:** Sales pipeline.
- **Rollback plan:** Discontinue programme; existing commercialisti retain their certification status.
- **Effort:** L.
- **Wave:** Q4 2026.
- **Status:** Pending.

### 8.11 u-sec-mtls-fleet — mTLS for production broker connections

- **Track:** Security.
- **Outcome:** Each customer's edge gateway uses a per-device X.509 certificate to authenticate to the broker; certificate provisioning automated via Just-in-Time Provisioning (JITP).
- **Success metric:** All production broker connections use mTLS; password-based auth deprecated for new deployments.
- **Target value:** 100 % of new Tier 2/3 deployments on mTLS; existing on password-auth migrate within 90 days.
- **Owner:** DevOps + Backend.
- **Dependencies:** R-MQTT-TLS-001 closed; broker CA infrastructure provisioned.
- **Blast radius:** All broker connections.
- **Rollback plan:** Fall back to password auth; revoke compromised certs; reissue.
- **Effort:** XL.
- **Wave:** Q1 2027.
- **Status:** Pending.

### 8.12 u-sec-bug-bounty — Public bug-bounty programme

- **Track:** Security.
- **Outcome:** Public bug-bounty programme (HackerOne or self-hosted) accepting reports + paying rewards for vulnerabilities.
- **Success metric:** Programme live; researcher reports flowing.
- **Target value:** ≥ 5 reports per year; severity distribution reasonable (mostly L/M, occasionally H).
- **Owner:** Renan + security-incident response team.
- **Dependencies:** CVD policy live (R-CVD-POLICY-DOC-001); R-SUPPLY-001 W1+W2 closed.
- **Blast radius:** Security workflow; potential incident handling load.
- **Rollback plan:** Suspend programme.
- **Effort:** L (programme launch + ongoing triage).
- **Wave:** Q1 2027.
- **Status:** Pending.

### 8.13 u-comp-italia-residency — Aruba Cloud Italia Terraform module

- **Track:** Compliance.
- **Outcome:** Terraform module for Aruba Cloud (Arezzo or Bergamo) deployment; alternative to AWS eu-south-1; satisfies hardline data-residency-Italy requirements.
- **Success metric:** Module exists; first customer deployment uses it.
- **Target value:** First customer deployed by Q1 2027.
- **Owner:** DevOps.
- **Dependencies:** Aruba Cloud account + DPA signed with Aruba.
- **Blast radius:** Cloud-deployment alternative path.
- **Rollback plan:** Customer falls back to AWS eu-south-1.
- **Effort:** XL.
- **Wave:** Q4 2026.
- **Status:** Pending.

---

## 9. Anti-goals (what FactoryMind will not do in the next 12 months)

Each anti-goal carries a **flip condition** — a measurable trigger that, if it fires, reopens the decision.

### Anti-goal U-9.1 — Do not migrate to InfluxDB 3.x.

**Why.** Pre-GA + insufficient soak elsewhere. The 1-h InfluxDB tasks pipeline is load-bearing.

**Flip condition.** GA + 6 months of soak with at least 2 cited production references with > 1 year of operation.

### Anti-goal U-9.2 — Do not adopt Apache Kafka.

**Why.** Over-engineered for FactoryMind scale. Mosquitto + EMQX cover the realistic commercial space.

**Flip condition.** Sustained > 1 million msg/s — not yet a realistic prospect for any FactoryMind customer.

### Anti-goal U-9.3 — Do not fork FactoryMind for the restaurant / hospitality sector.

**Why.** `moneyplan.txt:94-107` — Piano 4.0/5.0 is the load-bearing commercial value; restaurants cannot claim it.

**Flip condition.** None foreseeable. The "same skeleton, different product" path (HACCP + energy-per-service) is a separate product, not a fork.

### Anti-goal U-9.4 — Do not hire a sales head before €30k MRR.

**Why.** Premature sales-team scale-up is a startup failure mode. Founder sales until the first 10–15 customers prove the motion.

**Flip condition.** €30k MRR sustained for 3 months.

### Anti-goal U-9.5 — Do not ship a fourth UI locale.

**Why.** Italian + English + German cover the realistic three-year geography. A fourth locale costs maintenance for no near-term ROI.

**Flip condition.** Tier 4 SaaS customer in a non-IT/EN/DE market signs a contract committing > €20k/y.

### Anti-goal U-9.6 — Do not offer a free Community-Plus tier between T1 and T2.

**Why.** "Paid = respected" (`moneyplan.txt:143`). Tiered freemium dilutes the commercial signal.

**Flip condition.** Strategic decision by board (none currently).

### Anti-goal U-9.7 — Do not adopt a custom protocol for FactoryMind ↔ edge.

**Why.** Open standards (MQTT, OPC UA, Modbus) are the moat, not a custom proprietary protocol.

**Flip condition.** None foreseeable.

### Anti-goal U-9.8 — Do not ship a mobile-native app (iOS / Android).

**Why.** Web responsive is sufficient for shop-floor use; native app is a maintenance burden.

**Flip condition.** Customer feedback at 12 months indicates strong demand from > 50 % of operators.

### Anti-goal U-9.9 — Do not implement remote command-write capability by default.

**Why.** Doctrine **H-12**: ceremony, not interlock. Command-write is a Tier 3 feature with explicit ADR.

**Flip condition.** Tier 3 contract with documented requirement.

### Anti-goal U-9.10 — Do not add automated decisions on natural persons (GDPR Art. 22).

**Why.** Compliance + ethical posture. Predictive maintenance suggests; humans decide.

**Flip condition.** None.

---

## 10. KPIs of governance

Tracked monthly at the founder review (and at the board-meeting cadence post-seed funding).

### Engineering KPIs

- DORA Four Keys (cf § 3): deployment frequency, lead time for changes, change failure rate, MTTR.
- Test coverage (backend + frontend).
- Open Critical / High AUDIT findings count.
- Number of accepted residuals (delta vs prior month).
- Quarterly drill cadence (4 game days × 4 quarters = 16/year target).

### Business KPIs (from MODUS_OPERANDI § 11.4 legacy)

- **MRR** (Monthly Recurring Revenue) and decomposition into New / Expansion / Contraction / Churn.
- **ARR** (Annual Run Rate).
- **NDR** (Net Dollar Retention) — target ≥ 105 %.
- **Gross Retention** — target ≥ 93 %.
- **CAC Payback** — target ≤ 12 months.
- **LTV/CAC** — target ≥ 5×.
- **Magic Number** — target ≥ 0.8.
- **Rule of 40** (growth % + margin EBITDA %) — target ≥ 40 % by month 36.
- **Burn Multiple** — target ≤ 1.5×.

### Customer KPIs

- NPS at 12 months ≥ 50.
- Customer-success cadence completion rate ≥ 95 % (every customer's 30/90/180 done within window).
- Number of attestazioni delivered (cumulative).
- Number of attestazioni accepted by Agenzia delle Entrate (audit-pass rate ≥ 95 %).

### Compliance KPIs

- Last AUDIT pass date (≤ 95 days ago).
- Last CVE register sweep date (≤ 95 days ago).
- ACN registration current (annual cycle).
- DPA signed with all sub-processors.
- Number of outstanding `[DA_COMPILARE]` placeholders in legal templates (target: zero).

The KPI dashboard is a Grafana panel `factorymind_kpi_dashboard` (UPLIFT u-kpi-dashboard ships it; Q4 2026).

---

## 11. Five-year horizon (light touch)

Forecasts at five-year resolution are speculative; this section captures intent rather than commitment. The plan is reviewed annually and the horizon shifts.

By 2031:

- **Customer base.** 200–400 active Tier 2/3 customers in Veneto + Lombardia + Emilia + parts of Piemonte. 5–15 Tier 4 SaaS customers (multi-facility manufacturers). Possibly first cross-border deployment (Baden-Württemberg DACH).
- **Codebase.** Backend partially migrated to TypeScript. InfluxDB 3.x adopted post-anti-goal flip. EMQX as the multi-tenant broker. Kyverno + Cosign + SBOM full pipeline. Aruba Cloud Italia + AWS eu-south-1 + AWS eu-central-1 as live regions.
- **Compliance.** CRA conformity (since 11 dic 2027). NIS2 compliant. WCAG 2.2 AA. ISO 27001 certified. Possibly TISAX (automotive supply chain) if Tier 3 customers in automotive demand.
- **Cross-product.** Macena constellation integrated: GreenMetrics (energy), LogiTrack (logistics), TraceVino (wineries), AgriVigna (vineyards), TeamFlow (HR), FatturaFlow (e-invoicing), CyberGuard (security). Each integration versioned; cross-product contract drills routine.
- **Team.** 12–18 engineers + 4–6 commercial + 2–3 customer-success. Bus factor ≥ 3 on every load-bearing module.
- **Doctrine.** This four-document system retained, refreshed quarterly. ADR directory grew to 50–100 ADRs. Quarterly review minutes archive of 16+ entries.

The five-year horizon assumes no exit event in the 5-year window; an acquisition by TeamSystem / Zucchetti / Siemens / PTC would alter the trajectory. The MODUS_OPERANDI § 17 (legacy) catalogues the exit-path scenarios.

The bigger uncertainty: regulatory landscape. CRA, NIS2, EU AI Act, and any successor directives could compress the compliance work or expand it. The plan adapts via the anti-goals + flip-conditions discipline.

---

## Appendix A — Tool / library upgrade paths

| Tech | Current | Next | Trigger |
|---|---|---|---|
| Node.js 20 LTS | 20.x | 22 LTS (April 2027 maintenance) | LTS lifecycle; Q1 2027 migration |
| Express 4.x | 4.x | 5.0 GA | After 5.0 GA + 6 months stable |
| React 18 | 18.x | 19 (when GA) | When ecosystem catches up |
| TypeScript 5 | 5.x | 6 (when releases) | Quarterly review |
| Vite 7 | 7.x | latest | Quarterly review |
| InfluxDB 2.7 | 2.7.x | 3.x | Anti-goal U-9.1 flip |
| PostgreSQL 16 | 16 | 17 | After 17 stable + AWS Aurora support |
| Mosquitto 2.x | 2.0.x | EMQX 5.x | At Tier 4 SaaS multi-tenant scale |
| Helmet | 7.x | 8.x | Quarterly review |
| Joi | 17.x | latest | Quarterly review |
| TanStack Query 5 | 5.x | 6 | When ecosystem catches up |
| Tailwind 3 | 3.x | 4 | When stable + design-system migration |

---

## Appendix B — Quarterly review template

```
Quarterly Review — <YYYY-Q>
Reviewers: Renan + <peer>
Date: <YYYY-MM-DD>

1. DORA Four Keys vs target
   - Deployment frequency: __________ (target: __________)
   - Lead time: __________
   - Change failure rate: __________
   - MTTR: __________

2. Tech radar movements (this quarter)
   - Adopt → ___: <reason>
   - Trial → Adopt: <reason>
   - Hold → Trial: <reason>
   - New Assess: <reason>

3. Abstraction Ledger updates
   - New entry: <reason>
   - Removed entry: <trigger fired>
   - Modified entry: <reason>

4. Anti-goal review (any flip conditions fired?)
   - U-9.1 (InfluxDB 3.x): <status>
   - U-9.2 (Kafka): <status>
   - ...

5. Initiative status
   - Closed this quarter: <list>
   - In progress: <list>
   - Pending (next quarter): <list>
   - Slipped: <list with rationale>

6. KPI dashboard snapshot
   - Engineering KPIs: <values>
   - Business KPIs: <values>
   - Customer KPIs: <values>
   - Compliance KPIs: <values>

7. Open audit + remediation items
   - AUDIT findings opened this quarter: <count>
   - REMEDIATION tickets closed: <count>
   - Drift report: <list of W1/W2/W3 tickets that slipped>

8. Top 3 risks for next quarter
   1. ____________________________________________
   2. ____________________________________________
   3. ____________________________________________

9. Next-quarter Must-ship + Stretch
   <list>

Sign-off:
- Renan: ______________________
- Peer: ______________________
```

---

## Appendix C — Customer-success runbook (30 / 90 / 180-day cadence)

### 30-day check-in

**Window:** day 27–34 post-go-live.

**Format:** 30-minute call (phone or video) with the customer's responsabile produzione (or operatore di riferimento).

**Script:**

1. **Did you measure OEE this month?** If yes — what was it? (Customer is invited to share the dashboard screen if they want.) If no — diagnose: was the gateway connected, were the alerts configured, was the operator informed?
2. **Did you set up at least two alarm rules?** If yes — did any of them fire? Were the firings true positives? If no — review the alarm-rule UI together; configure two on the spot.
3. **Did you download a shift report?** If yes — was it useful? If no — show the workflow.
4. **Has anything been confusing?** Open question; capture verbatim.
5. **Anything you'd like FactoryMind to add?** Open question; capture verbatim.

**Output:** Notes archived in customer file. New tickets if any (REMEDIATION if a bug; UPLIFT if a feature; HANDOFF update if a documentation gap).

### 90-day check-in

**Window:** day 85–95 post-go-live.

**Format:** 45-minute call with the responsabile produzione + the responsabile tecnico (often the same person at small SMEs).

**Script:**

1. **Three-month OEE trend.** Show the customer the 3-month rolling OEE chart; compare to industry benchmark (SEMI E10 world-class 85 %).
2. **Top 5 downtime causes.** Pareto chart shared; discuss whether the ranking has changed; identify candidate process improvements.
3. **Roadmap update.** Share what shipped in the past 90 days; what's coming next 90 days; what FactoryMind plans for the next year.
4. **Expansion conversation.** Are there machines / lines not yet covered? What would it take to add them?
5. **Reference + testimonial ask.** If satisfied, request a written 1–2-sentence testimonial + permission to host site visits.

**Output:** Customer-success notes; expansion lead in CRM; testimonial collected if available.

### 180-day check-in (Quarterly Business Review — QBR)

**Window:** day 175–195 post-go-live.

**Format:** 2-hour in-person visit (preferred) or 90-minute video call.

**Attendees:** Customer's responsabile produzione + direttore generale + commercialista (optional). FactoryMind side: Renan + customer-success + automation engineer if applicable.

**Agenda:**

1. **OEE 6-month trend with peer benchmark** (anonymised aggregate across the FactoryMind base).
2. **Cumulative downtime savings** (estimated cost saved vs baseline).
3. **Piano 4.0 attestazione status** (was the credito d'imposta successfully claimed? Any audit issues?).
4. **Piano 5.0 readiness** (is the customer interested in the energy-savings module via GreenMetrics?).
5. **Roadmap.**
6. **Expansion proposal** (more machines / additional facilities / ERP integration / Tier upgrade).
7. **Renewal.** Annual contract anniversary discussion; pricing review if applicable.

**Output:** QBR minutes; renewal commitment; expansion proposal sent within 5 working days post-meeting.

---

## Appendix D — Initiative tracking ledger (initial entries)

| Initiative ID | Name | Track | Wave | Status |
|---|---|---|---|---|
| u-com-first-customer | First Tier 2 contract signed | Commercial | Q3 2026 | Pending |
| u-com-attestazione-pdf-polish | Polished PDF | Commercial | Q3 2026 | Pending |
| u-comp-piano-5.0-greenmetrics | Cross-product contract | Compliance | Q3 2026 | Pending |
| u-ops-dora-instrumentation | DORA dashboard | Operations | Q3 2026 | Pending |
| u-com-attestazione-pdf-sign | Signed PDF | Commercial | Q4 2026 | Pending |
| u-sec-pen-test-001 | External pen-test | Security | Q4 2026 | Pending |
| u-comp-italia-residency | Aruba Cloud module | Compliance | Q4 2026 | Pending |
| u-comp-nis2-cert | ACN registration | Compliance | Q1 2027 | Pending |
| u-sec-mtls-fleet | mTLS edge | Security | Q1 2027 | Pending |
| u-sec-bug-bounty | Bug bounty live | Security | Q1 2027 | Pending |
| u-comp-cra-conformity | CRA assessment | Compliance | Q2 2027 | Pending |
| u-comp-a11y-22 | WCAG 2.2 AA | Compliance | Q2 2027 | Pending |
| u-dx-coverage-ratchet | Coverage ratchet | DX | Continuous | Pending |
| u-ops-runbook-drills | Game days | Operations | Continuous | Pending |
| u-com-customer-success-cadence | 30/90/180 cadence | Commercial | Continuous | Pending |

(More entries as initiatives are added per quarterly review.)

---

## Appendix E — Track-deep-dive narratives

The five tracks of § 6 carry summary tables. This appendix expands each track with the operational nuance that the table cannot carry — where the work touches culture, hiring, customer relationships, regulatory cycles.

### E.1 Track DX — narrative

The thesis: the developer experience for a senior engineer joining FactoryMind in 2027 should be measurably better than the experience of a senior engineer joining in 2026. "Better" means: shorter feedback loops (test → green ≤ 30 s), clearer error legibility (pino-formatted with trace correlation; ErrorBoundary respects production posture), less friction in the inner-loop (HMR for frontend < 1 s; backend nodemon < 2 s), more confidence in the safety net (coverage ≥ 70 % with the path to 80 % visible).

Concretely, Track DX initiatives:

- **u-dx-bootstrap-time** is the most-visible single thing a new hire notices. The CI job that times bootstrap (R-CI-BOOT-001) gates regressions; the doctrine **H-1** 15-minute floor is the public commitment. Reaching 10 minutes means: docker-compose pull caching, parallel build steps, smaller base images (the alpine choice helps), `npm ci --frozen-lockfile` instead of `npm install`.
- **u-dx-pre-commit** with Husky + lint-staged eliminates the "CI failed on my prettier" embarrassment. The trade-off: a slow pre-commit hook is its own friction; the rule is "pre-commit ≤ 5 s; CI ≤ 5 minutes". Lint-staged runs only on changed files.
- **u-dx-test-feedback** asks: when an engineer changes a single test, how long to see green? Backend Jest: < 30 s achievable with `--watch` + selective tests. Frontend Vitest (UPLIFT trial): native ESM = faster startup; expect < 10 s.
- **u-dx-error-legibility** asks: when production logs an error, can the on-call engineer triage it in < 60 s? The path: structured logs (pino) + trace ID correlation + Loki + Grafana dashboard. The 60 s metric requires not just the tooling but the discipline of attaching trace IDs to incident reports.
- **u-dx-typescript-backend** is a Trial. The benefit is type safety on the backend; the cost is migration effort (~ 6 months for a single-engineer project, less for paired engineers). The decision to commit to it is at Q1 2027 quarterly review.
- **u-dx-coverage-ratchet** is **continuous**. The ratchet pattern: measure current floor; raise the gate by 5 % every 3 months on the layer with highest test debt; eventually all layers clear 70 %; finally the global gate moves from `||true` (current) to `exit-code: 1` (post-ratchet). LogiTrack TECHNICAL-DEBT.md item 14 is the canonical model.
- **u-dx-pr-discipline** is cultural. Average PR size < 400 LOC requires the team to internalise rule **U-4** (focused commits) + rule **U-5** (preparatory refactor before feature). Cycle time < 1 day requires the verifier to set aside time daily; this is realistic at single-engineer + hire-#2 scale; at 6+ engineers, dedicated reviewer rotation.
- **u-dx-onboarding-doc** extends HANDOFF § 12. The 1-week onboarding goal is binding; the failure mode (an engineer who can't ship a non-trivial commit by week 1's end) triggers an onboarding-doc revision.

The DX track is **never done**. New tooling, new languages, new frameworks emerge; the track absorbs them via the Tech Radar quadrant movements.

### E.2 Track OX — narrative

The thesis: operational maturity is the difference between a stack that works and a stack that recovers. The DORA Four Keys give the measurement; the runbook drills give the muscle memory; the cross-product drills give the early warning.

Concretely:

- **u-ops-cd-promotion-gate** is the most engineering-heavy initiative. Target: a commit on `main` automatically deploys to staging; staging passes smoke for 30 minutes; passes a manual approval (Renan or designated approver); deploys to production via blue-green; verifies; rollbacks on health-check failure. The doctrine **H-12** ceremony (12 checkpoints) is preserved as the manual-approval step's checklist.
- **u-ops-dora-instrumentation** is the foundation. Without DORA telemetry, every claim about "we're getting better" is anecdotal.
- **u-ops-runbook-drills** is **continuous**. Each quarter, one runbook is exercised; the rotation cycles through all 8 runbooks every 2 years. The drill produces: a measured detection-latency, a measured mitigation-latency, a postmortem (HANDOFF § 8.PM template), and a runbook update (preserving the lessons).
- **u-ops-cross-product** is the GreenMetrics integration validation drill. Quarterly, a malformed GreenMetrics response is injected (test fixture); the FactoryMind Piano 5.0 attestazione path is exercised; failure is graceful (no partial PDF; clear user-facing error). Doctrine **H-10** dependence on cross-product correctness motivates this discipline.
- **u-ops-edge-template** is a customer-deployment artefact. A Terraform module that, given a customer's facility ID + an SSH-accessible mini-PC, provisions the edge gateway with: hardened OS baseline, `factorymind` user, FactoryMind container, OPC UA TrustList, Mosquitto bridge config, daily backup cron. Customer's responsabile IT runs `terraform apply` and the gateway is ready.
- **u-ops-observability-deepening** raises the OTel sampling to 100 % during incidents (sampler decision based on tail-based sampling: drop normal traces, keep error/long traces). Trade-off: storage cost; mitigation: short retention on the high-sample lane.
- **u-ops-grafana-cloud** is optional for Tier 4 SaaS where the operational overhead of self-hosting Grafana exceeds the value.
- **u-ops-status-page** is customer-facing transparency. factorymind.cloud/status (or equivalent) shows current SLO burn, recent incidents, planned maintenance. Standard pattern; complements the customer-notice template (REMEDIATION § 10).

### E.3 Track Security maturity — narrative

The thesis: IEC 62443 SL-2 is the v1.0 floor; SL-3 is the trajectory. SLSA Level 1 is implicit; Level 3 is the trajectory. Pen-tests, bug bounty, SBOM, image signing — all stack to make supply-chain compromise the hardest path.

Concretely:

- **u-sec-slsa-l3** requires: SBOM at build (Syft); image signed (Cosign keyless via OIDC); attestation of build provenance; Kyverno verification at admission. The pieces land via REMEDIATION R-SUPPLY-001 + R-K8S-KYVERNO-001; UPLIFT consolidates them into the SLSA L3 claim with an explicit attestation report.
- **u-sec-iec62443-sl3** trajectory: identify the SR (System Requirement) lines where SL-2 → SL-3 requires upgrades. Likely candidates: SR 1.2 (software process authentication — service accounts), SR 3.4 (information integrity — HMAC on OPC UA commands), SR 5.1 (network segmentation — finer NetworkPolicy beyond R-K8S-NETPOL-001). Quarterly progress.
- **u-sec-mtls-fleet** is the production broker hardening completion. Per-device X.509 certs replace per-service passwords. Just-in-Time Provisioning (JITP) automates the cert lifecycle: a new edge gateway requests a cert from FactoryMind's CA; CA issues; gateway connects. Cert rotation: annual (rule **H-21**).
- **u-sec-pii-column-encrypt** uses pgcrypto on `users.email` and `users.full_name`. KMS-managed key. Customer-data search-by-email becomes slower (hash-equality only); for FactoryMind-internal email-based queries, a deterministic encryption mode allows exact match.
- **u-sec-hsm-cmk** for Tier 3 customers who require it. HSM-backed customer-managed key for KMS; keys never leave the HSM; signing operations gated by HSM. Cost: significant; available on request only.
- **u-sec-pen-test-001** is the first independent pen-test post-W1. CREST-credentialed firm preferred; expected outcome: 10–20 findings, mostly Medium/Low; severity-class agreement with internal AUDIT > 80 %; any new Critical findings trigger emergency W0 ticketing.
- **u-sec-bug-bounty** is the public-disclosure programme. Reward structure: €100 (Low) → €500 (Medium) → €2 000 (High) → €5 000 (Critical), within budget constraints. HackerOne / Bugcrowd / self-hosted (with Sigstore-style transparency log) are options.
- **u-sec-zero-trust-net** for Tier 4 SaaS. Tailscale (or equivalent) replaces public-internet ingress with mesh network; users access dashboards only from authenticated devices. Out-of-band; dependence on customer adoption.

### E.4 Track Commercial — narrative

The thesis: commercial readiness is engineering work, not marketing (rule **U-15**). The five trust-moves of `moneyplan.txt` are the operational backbone.

Concretely:

- **u-com-first-customer-engagement** is the singular Q3 2026 priority. First Tier 2 contract signed + first attestazione delivered. The first customer is the founder's discount + testimonial customer (`moneyplan.txt:139-141`); subsequent customers pay full Tier 2 rates.
- **u-com-customer-success-cadence** runs continuously from the first customer onwards. Appendix C is the operational runbook.
- **u-com-attestazione-pdf-polish** + **u-com-attestazione-pdf-sign** together produce the customer-facing artefact that is the load-bearing differentiator. A polished, signed PDF that the commercialista can paste into the perizia tecnica — that is the wedge.
- **u-com-landing-conversion** improves factorymind.it's conversion path. A 3-minute Italian video (founder demonstrating live OEE on a real machine; downloadable sample attestazione PDF; clear CTA "richiedi una demo gratuita"). `moneyplan.txt:153-156`: "the highest-converting asset you can make".
- **u-com-channel-commercialista** activates the Tier C unlock. Webinar + simulator access + referral fee. ODCEC chapters of Verona, Vicenza, Padova, Treviso are the target. Expected: 5 certified commercialisti by end-Q4 2026 → 3 referral-driven closes.
- **u-com-channel-installer** activates the system-integrator partnership channel. Imeco (Vicenza), Automation Italia (Bologna), Sirio (Verona), Automatecno (Lombardia orientale) are catalogued in MODUS_OPERANDI § 10.4 (legacy). Each partner receives commission pass-through on first-year contracts.
- **u-com-pricing-experiments** A/B tests Tier 2 pricing structure (one-time setup vs subscription) across new prospects.

### E.5 Track Compliance — narrative

The thesis: compliance is a continuous discipline; CRA, NIS2, Piano 5.0 evolve.

Concretely:

- **u-comp-piano-5.0-greenmetrics** is the cross-product contract. Versioned, both sides cite, integration-tested.
- **u-comp-cra-conformity** is the long-tail trajectory. 11 December 2027 is the deadline; 11 September 2026 is the vulnerability-handling sub-deadline. The work: technical documentation file (Annex VII); risk assessment (Article 13); conformity assessment under Module A (self-assessment for default class) or Module B (notified body for important Class I/II); CE marking. Counsel-heavy.
- **u-comp-nis2-cert** depends on R-NIS2-SCOPE-001's outcome. If FactoryMind is in scope, ACN registration window 1 January – 28 February annually.
- **u-comp-a11y-22** extends the WCAG 2.1 AA baseline to 2.2 AA. The new criteria in 2.2 (focus appearance, dragging movements, target size, redundant entry, accessible authentication, etc.) inform the frontend remediation tickets.
- **u-comp-iso-27001** is the long-tail formal certification. Stage 1 (gap analysis) + Stage 2 (audit) + ongoing surveillance audits. Expected timeline: 18 months to first full cert. Cost: €15-25 k/year + auditor time.
- **u-comp-italia-residency** ships the Aruba Cloud Italia Terraform module.
- **u-comp-fiscal-rates-update** is the annual ritual: update `backend/src/config/fiscal-rates.js` with new percentages from the latest Legge di Bilancio.

---

## Appendix F — Detailed initiative specs (continued)

(Beyond § 8.2–8.13, additional initiatives specced for the writing phase. Not all 30+ initiatives in § 6 carry the full spec — the rest are tracked in § 6 tables and elaborated when picked.)

### u-com-first-customer-engagement — First Tier 2 contract signed

- **Track:** Commercial.
- **Outcome:** A Veneto-SME Tier S customer signs a Tier 2 contract; first deployment ceremony executes; first attestazione PDF delivered + accepted by the customer's commercialista.
- **Success metric:** Signed contract; deployment-log runbook initialled at all 12 checkpoints; commercialista's email confirming attestazione acceptance.
- **Target value:** Achieved by end of Q3 2026 (subject to sales pipeline reality).
- **Owner:** Renan (founder + sales).
- **Dependencies:** All W1 REMEDIATION tickets closed; R-DPA-FILL-001 closed; R-LEGAL-DATES-001 closed.
- **Blast radius:** First customer relationship; future-customer reference signal.
- **Rollback plan:** Customer-side: standard contract termination. FactoryMind-side: lessons captured in postmortem; no other customer affected.
- **Effort:** XL (sales + delivery + support cycle).
- **Wave:** Q3 2026.
- **Status:** Pending.
- **Expected DORA delta:** Neutral (no engineering shift).
- **Why this initiative, not another:** alternative — wait for "perfect" platform — rejected; first customer's pain is what reveals the v1.x roadmap. Half-price + testimonial deal protects FactoryMind's pricing dignity (`moneyplan.txt:139-145`).

### u-ops-dora-instrumentation — DORA Four Keys dashboard

- **Track:** Operations.
- **Outcome:** Grafana dashboard `factorymind_dora_metrics` displays deployment frequency, lead time, change failure rate, MTTR — all measured from instrumentation in CI + incident-tracking + git history.
- **Success metric:** Dashboard live; weekly snapshot in monthly review.
- **Target value:** Tracked monthly; deltas visible.
- **Owner:** DevOps.
- **Dependencies:** `release-please` for changelog automation (R-CHANGELOG-AUTO-001); incident-tracking system (initially: GitHub Issues; future: Linear or similar).
- **Blast radius:** Observability stack; one new Grafana panel.
- **Rollback plan:** Remove the panel.
- **Effort:** M.
- **Wave:** Q3 2026.
- **Status:** Pending.

### u-dx-bootstrap-time — Bootstrap ≤ 10 minutes

- **Track:** DX.
- **Outcome:** A clean Ubuntu 24.04 LTS or macOS 14+ box with Docker pre-installed reaches a working FactoryMind dashboard within **10 minutes** (the doctrine **H-1** floor is 15 min; this initiative pushes to 10).
- **Success metric:** R-CI-BOOT-001 CI job (which times the bootstrap) consistently reports ≤ 10 minutes over 10 consecutive runs.
- **Target value:** Median 10 min; P95 12 min.
- **Owner:** DevOps.
- **Dependencies:** R-CI-BOOT-001 closed.
- **Blast radius:** install.sh and docker-compose.yml; docs that reference timing.
- **Rollback plan:** Revert to previous behaviour; the 15-min floor still binds via R-CI-BOOT-001.
- **Effort:** M (mostly Docker layer caching + smaller base image investigation).
- **Wave:** Q3 2026.
- **Status:** Pending.

### u-dx-pre-commit — Husky + lint-staged

- **Track:** DX.
- **Outcome:** Every commit runs prettier + ESLint + tsc on changed files; commits with violations are blocked.
- **Success metric:** Pre-commit hook adopted; CI lint failures decrease.
- **Target value:** ≥ 95 % of commits pass pre-commit on first attempt.
- **Owner:** DevOps.
- **Dependencies:** None.
- **Blast radius:** Local git workflow.
- **Rollback plan:** Remove `package.json` `prepare` script and Husky setup.
- **Effort:** S.
- **Wave:** Q3 2026.
- **Status:** Pending.

### u-com-customer-success-cadence — 30/90/180-day check-ins

- **Track:** Commercial.
- **Outcome:** Every paying customer gets the cadence per Appendix C.
- **Success metric:** % of customers with all three check-ins completed within window.
- **Target value:** ≥ 95 % within first year of customer.
- **Owner:** Customer-success engineer (initially Renan).
- **Dependencies:** First customer.
- **Blast radius:** Customer relationships.
- **Rollback plan:** Skip a quarter with explicit sign-off.
- **Effort:** Continuous; M per check-in (call + notes + follow-up).
- **Wave:** Continuous from Q3 2026.
- **Status:** Pending.

### u-comp-fiscal-rates-update — Annual fiscal-rates update

- **Track:** Compliance.
- **Outcome:** `backend/src/config/fiscal-rates.js` updated with latest percentages within 30 days of the Legge di Bilancio publication.
- **Success metric:** Customer attestazioni reflect current rates.
- **Target value:** 30-day SLA met for each annual update.
- **Owner:** Renan.
- **Dependencies:** Legge di Bilancio publication (typically late December / early January).
- **Blast radius:** Attestazione output.
- **Rollback plan:** Roll back to previous rates if the new rates are revised by an errata corrige.
- **Effort:** S annual.
- **Wave:** Annual (Continuous track).
- **Status:** Pending.

### u-comp-italia-residency — Aruba Cloud Italia Terraform module

- **Track:** Compliance.
- **Outcome:** Terraform module `terraform/modules/aruba-cloud-italia/` provides an Italian-data-residency alternative to AWS eu-south-1.
- **Success metric:** Module exists; first customer deployment uses it.
- **Target value:** First customer by Q1 2027.
- **Owner:** DevOps.
- **Dependencies:** Aruba Cloud account + DPA signed with Aruba.
- **Blast radius:** Deployment alternative.
- **Rollback plan:** Customer falls back to AWS.
- **Effort:** XL.
- **Wave:** Q4 2026.
- **Status:** Pending.

### u-sec-iec62443-sl3 — IEC 62443 SL-3 trajectory

- **Track:** Security.
- **Outcome:** Self-assessment grid in [`AUDIT.md`](AUDIT.md) § 10 shows SL-3 across all FRs.
- **Success metric:** Self-assessment grid update.
- **Target value:** SL-3 by Q2 2027.
- **Owner:** Renan.
- **Dependencies:** Track Security initiatives (mTLS, HMAC, finer NetworkPolicy).
- **Blast radius:** Multiple — touches every component.
- **Rollback plan:** Revert individual control upgrades.
- **Effort:** XL (multi-quarter).
- **Wave:** Q1 2027 → Q2 2027.
- **Status:** Pending.

### u-com-channel-installer — Installer partnership programme

- **Track:** Commercial.
- **Outcome:** First system-integrator partnership signed (Imeco / Automation Italia / Sirio / Automatecno per MODUS_OPERANDI § 10.4 candidates).
- **Success metric:** Signed partner agreement; first integrator-driven close.
- **Target value:** ≥ 2 partners + ≥ 1 close by Q1 2027.
- **Owner:** Renan + sales.
- **Dependencies:** First customer reference.
- **Blast radius:** Sales pipeline.
- **Rollback plan:** Discontinue programme.
- **Effort:** L.
- **Wave:** Q1 2027.
- **Status:** Pending.

### u-com-pricing-experiments — Tier 2 pricing A/B test

- **Track:** Commercial.
- **Outcome:** Pricing experiments (e.g., €2 500 setup + €1 200/year vs €0 setup + €2 500/year) validated against conversion data.
- **Success metric:** Conversion delta; LTV/CAC delta.
- **Target value:** Statistical significance over ≥ 30 prospects.
- **Owner:** Renan + sales.
- **Dependencies:** Sufficient prospect pipeline.
- **Effort:** Continuous.
- **Wave:** Q1 2027.
- **Status:** Pending.

### u-comp-iso-27001 — ISO 27001 certification trajectory

- **Track:** Compliance.
- **Outcome:** ISO 27001:2022 certification trajectory: Stage 1 (gap analysis) → Stage 2 (full audit) → ongoing surveillance.
- **Success metric:** Certificate of Conformity issued.
- **Target value:** Stage 1 by Q3 2027; full certification by Q1 2028.
- **Owner:** Renan + ISO 27001 consultant + auditor.
- **Dependencies:** Mature security posture (post-W1+W2 closure); SoA (Statement of Applicability) prepared.
- **Blast radius:** Compliance posture.
- **Rollback plan:** Pause certification process; resume later.
- **Effort:** XL (18-month timeline).
- **Wave:** Q3 2027.
- **Status:** Pending.

---

## Appendix G — Quarterly review worked example

A worked example of a future quarterly review, demonstrating how the discipline operates in practice.

```
Quarterly Review — 2026-Q4
Reviewers: Renan + <hire #2>
Date: 2027-01-06 (first Tuesday after Q4 2026 close)

1. DORA Four Keys vs target

   Deployment frequency: 2 / week to staging; 1 / 2-week to prod (target was: daily to staging, weekly to prod)
     Status: behind target on staging; on-track on prod.
     Action: u-ops-cd-promotion-gate land in Q1 2027.

   Lead time for changes: 6 hours median (target was: 4 hours)
     Status: close to target.
     Action: u-dx-pr-discipline ratchet PRs to < 300 LOC.

   Change failure rate: 12 % (target was: < 15 %)
     Status: on-track.
     Action: continue observability deepening.

   MTTR: 6 hours (target was: < 4 hours)
     Status: behind target.
     Action: more runbook drills; speedier alert acknowledgement.

2. Tech radar movements (this quarter)

   Trial → Adopt: Vitest (frontend test runner); Playwright + axe-core (a11y CI).
   New Trial: pgcrypto (column-level encryption candidate).
   New Hold: Datadog (decision: Loki + Grafana + Prometheus is sufficient at our scale).

3. Abstraction Ledger updates

   Modified AB-07 (Downsampling pipeline): added monitoring for task creation success
     post-R-INFLUX-TASK-001 closure.
   New AB-17: Vitest as test runner — cost: parallel maintenance with backend Jest;
     trigger: backend Vitest migration if the team wants unified tooling.

4. Anti-goal review

   U-9.1 (InfluxDB 3.x): no flip — still pre-GA.
   U-9.2 (Kafka): no flip — sustained throughput nowhere near 1 Mmsg/s.
   U-9.3 (don't fork for restaurants): no flip.
   U-9.4 (no sales head before €30k MRR): close — currently €4k MRR; still anti.
   U-9.5–U-9.10: no flip.

5. Initiative status

   Closed this quarter:
     - u-com-first-customer-engagement (first Tier 2 customer signed Oct 2026)
     - u-com-attestazione-pdf-polish (PDF polish accepted by first commercialista)
     - u-comp-piano-5.0-greenmetrics (contract v1 shipped both sides)
     - u-ops-dora-instrumentation (dashboard live)

   In progress:
     - u-com-attestazione-pdf-sign (cryptographic signature; expected Q1 2027)
     - u-sec-pen-test-001 (engagement booked for early Q1 2027)
     - u-comp-italia-residency (module 70 % complete)

   Pending (next quarter):
     - u-sec-mtls-fleet
     - u-sec-bug-bounty
     - u-comp-nis2-cert (annual ACN registration window)

   Slipped:
     - u-com-channel-commercialista (originally Q4 2026 → moved to Q1 2027)
       Rationale: first customer engagement absorbed all sales bandwidth.
       Sign-off: Renan, 2027-01-06.

6. KPI dashboard snapshot

   Engineering:
     - DORA: see § 1 above.
     - Test coverage backend: 67 % (up from 60 % at v1.0).
     - Open Critical / High AUDIT findings: 4 (down from 17 at v1.0).
     - Accepted residuals: 4 (unchanged).
     - Drill cadence: 4 game days completed Q4 (target: 4); 100 %.

   Business:
     - MRR: €4 200 (1 Tier 2 customer @ €2 500/y subscription = €208/mo;
                    + €1 500 setup amortised over 12 = €125/mo;
                    + early-access pilot fees +€3 800 = total ~ €4.2k/mo)
     - ARR: €50k.
     - NDR: not measurable (only 1 customer).
     - Gross retention: 100 % (none lost).
     - CAC payback: ~ 3 months (low because founder sales).
     - LTV/CAC: TBD.
     - Magic number: TBD.
     - Rule of 40: TBD.
     - Burn multiple: 1.2× (within target).

   Customer:
     - NPS: 9 (single customer; n=1).
     - Customer-success cadence completion: 100 % (30-day done; 90-day in progress).
     - Attestazioni delivered: 5 (one customer, 5 machines).
     - Attestazioni accepted by AdE: pending (first credit claim filing in Q1 2027).

   Compliance:
     - Last AUDIT pass: 2026-11-02 (62 days ago; under 95-day floor).
     - Last CVE register sweep: 2026-11-02; no CRITICAL / HIGH advisories.
     - ACN registration: pending (Q1 2027 window).
     - DPA signed: yes (1 customer).
     - Outstanding [DA_COMPILARE] in legal: 0.

7. Open audit + remediation items

   AUDIT findings opened this quarter: 3 (all from external pen-test prep).
   REMEDIATION tickets closed: 14.
   Drift report:
     - W1 closed in 35 days (5-day overrun).
     - W2 80 % closed; 20 % rolled to W3 with sign-off.

8. Top 3 risks for next quarter

   1. First credit claim filing (Tier 2 customer) — risk if AdE rejects;
      mitigation: pen-test, attestazione PDF format finalised, commercialista coached.
   2. Hire #3 starts Q1 2027 — onboarding overhead absorbs verifier capacity.
   3. NIS2 ACN registration window 1 gen – 28 feb — counsel availability is the gate.

9. Next-quarter Must-ship + Stretch

   Must-ship Q1 2027:
     - u-com-attestazione-pdf-sign
     - u-sec-pen-test-001 (execution + remediation of new findings)
     - u-comp-nis2-cert (if scope determined)
     - u-sec-mtls-fleet (rollout to first customer)

   Stretch:
     - u-sec-bug-bounty
     - u-com-channel-commercialista
     - u-com-pricing-experiments

Sign-off:
- Renan: ____________________
- Hire #2: __________________
```

This is a future-state worked example; the actual 2027-Q4 review will look different in detail. The structure is the constant.

---

## Appendix H — Customer-success cadence — extended scripts

(Extending Appendix C with bilingual scripts and conversation-flow guidance.)

### H.1 30-day check-in — bilingual script

**(IT)** "Buongiorno `<Nome>`. Sono `<Customer-Success Engineer>` di FactoryMind. La chiamo per il check-in di 30 giorni — è un momento standard del nostro accompagnamento."

**(EN)** "Good morning `<Name>`. I'm `<Customer-Success Engineer>` from FactoryMind. I'm calling for the 30-day check-in — it's a standard part of how we accompany you."

Then proceed with the questions in Appendix C. Note-taking is in English (for internal consistency); customer-shared summary is in Italian.

### H.2 90-day check-in — agenda template

```
90-Day Customer Check-in
Customer: <Name>
Facility: <Facility ID>
Date: <YYYY-MM-DD>
Attendees: <list>

1. (5 min) Greeting + recap of 30-day notes.

2. (10 min) Review of OEE 3-month trend.
   - Show the dashboard.
   - Compare to the SEMI E10 world-class benchmark (85 %).
   - Identify the trend (improving / flat / declining).

3. (15 min) Top 5 downtime causes (Pareto).
   - Which causes are repeating?
   - Which are operational vs. equipment?
   - Are any caused by FactoryMind itself (false alerts)?

4. (5 min) Roadmap recap.
   - What FactoryMind shipped in the past 90 days that's relevant.
   - What's coming in next 90 days.

5. (5 min) Expansion conversation.
   - Are there machines / lines uncovered?
   - Multi-facility?
   - Tier upgrade?

6. (5 min) Reference + testimonial.
   - Asks for a written 1-2 sentence quotation.
   - Permission to host a future site visit.

Total: 45 minutes.
```

### H.3 180-day Quarterly Business Review — bilingual format

The QBR is the most-formal cadence touchpoint. For Italian customers, Italian-spoken; presentation slides bilingual (Italian heading, English numbers/labels). For Tier 3 enterprise customers, fully Italian.

The QBR's commercial output is the renewal commitment + expansion proposal. The expansion proposal is sent within 5 working days post-meeting; the customer's commitment to renew is captured in the QBR minutes and confirmed in writing within 30 days.

---

## Appendix I — Five-year horizon expanded narrative

(Light-touch by design; cf rule **U-2** "don't gold-plate" applied to long-horizon planning.)

By 2031 (Year 5):

**Customer base.** Reaching 200 active customers requires sustained 4-customer-per-month acquisition for ≥ 50 months. The cadence is achievable based on `moneyplan.txt:200-203` 6-month forecast, but only with the channel-partner programme working (commercialisti + integrators; not the founder solo). The first-year is single-digit customers; second-year 30–50; third-year 80–120; fourth-year 150–200.

**Codebase trajectory.** The two strategic decisions:

- **TypeScript backend migration**: the maintenance-cost ROI passes the threshold around year 3 (when the backend has 4–5 maintainers). Pre-condition: at least 2 senior engineers comfortable with TS.
- **InfluxDB 3.x adoption**: the InfluxDB 2.x → 3.x migration is the largest single architecture-impact decision. The anti-goal U-9.1 (don't migrate before GA + 6 months elsewhere) is the gate; flip likely Year 2 or 3.
- **EMQX adoption for multi-tenant SaaS**: the Mosquitto → EMQX migration is the second-largest. Trigger: Tier 4 SaaS scale beyond 1k connected machines / 200 tenants.

**Compliance trajectory.** CRA conformity (2027), NIS2 maintained, ISO 27001 certified (Year 3), WCAG 2.2 AA reached, possibly TISAX (automotive). Compliance becomes a revenue-protection mechanism: customers in regulated sectors require certified suppliers.

**Cross-product trajectory.** The Macena constellation matures: GreenMetrics (energy) deeply integrated; LogiTrack (logistics) integrated for FactoryMind customers shipping on Quadrante Europa; SmartERP (multi-tenant ERP) optional plug-in; TraceVino (wineries) co-sold for Veneto winery customers. Each integration versioned; cross-product contract drills routine.

**Team.** Bus factor ≥ 3 on every load-bearing module; clear succession path on every key role; ESOP allocations vested; founder no longer sole-source-of-truth.

**Doctrine.** This four-document system retained but revised at v3.0 or v4.0; ADR archive has 50–100 entries; Abstraction Ledger has been pruned (some entries removed via trigger); accepted residuals reviewed and many resolved or formally accepted.

**Exit options (per MODUS_OPERANDI § 17 legacy).** TeamSystem, Zucchetti, Siemens, PTC, possibly a private-equity rollup. Multiple of 5–8× ARR (sector benchmark for high-growth Italian B2B SaaS) on €5–15 M ARR by Year 5 = €25–120 M valuation range. Exit not the primary driver; building product-market fit is.

The five-year horizon adapts annually. The five-year horizon is not a commitment.

---

## Appendix J — KPI dashboard queries

Concrete Grafana / Prometheus / Postgres queries that drive the KPI dashboard. For the writing phase + the engineer who eventually implements u-ops-dora-instrumentation + u-kpi-dashboard.

### J.1 Deployment frequency (DORA Key 1)

**Source:** GitHub Actions deployment events to production environment.

**Query (PromQL — assuming a `factorymind_deployments_total{environment="production"}` counter exposed by a CI exporter):**

```
sum(increase(factorymind_deployments_total{environment="production"}[7d]))
```

**Visualisation:** Time-series; weekly-rolling sum.

### J.2 Lead time for changes (DORA Key 2)

**Source:** GitHub commits + GitHub deployment events.

**Computation:** For each deployment, compute `deployment_time - earliest_commit_time_in_release`. Aggregate median + P95.

**Implementation:** Custom exporter `factorymind_lead_time_seconds` per deployment.

```promql
histogram_quantile(0.5, sum by (le) (rate(factorymind_lead_time_seconds_bucket[30d])))
```

### J.3 Change failure rate (DORA Key 3)

**Source:** Deployment events × incident-ticket correlations.

**Computation:** `(count of deployments that triggered an incident within 24 hours) / (total count of deployments)`.

**Implementation:** Manual tagging of incidents with the responsible deployment SHA; query counts the tagged subset.

### J.4 MTTR (DORA Key 4)

**Source:** Incident tickets (GitHub Issues / Linear).

**Computation:** `mean(incident.resolved_at - incident.created_at)` over a rolling window.

**Visualisation:** Time-series; 30-day rolling mean.

### J.5 MRR + ARR

**Source:** Customer-subscription database (TBD; initially HubSpot per legacy MODUS_OPERANDI).

**Computation:** `sum(monthly_subscription_amount) for active customers`.

**Visualisation:** Stacked area chart with new / expansion / contraction / churn breakdown.

### J.6 Net Dollar Retention (NDR)

**Source:** Subscription database; comparing a cohort's MRR at month N vs month 0.

**Formula:** `NDR = (MRR_now - churned + expansion - contraction) / MRR_baseline`.

**Target:** ≥ 105 %.

### J.7 Test coverage

**Source:** `coverage/coverage-summary.json` from Jest + Vitest.

**Implementation:** CI uploads the JSON as artifact; a small Node script aggregates and exposes as Prometheus metric.

### J.8 Open Critical / High AUDIT findings

**Source:** Manual count via `grep -c "F-CRIT-\|F-HIGH-" docs/AUDIT.md` minus closures cross-referenced from REMEDIATION.

**Implementation:** Quarterly hand-update; eventually a script that walks the markdown.

### J.9 Outstanding `[DA_COMPILARE]` placeholders

**Source:** `grep -r '\[DA_COMPILARE\]' legal/`

**Target:** zero.

### J.10 Last AUDIT pass date

**Source:** Front matter of `docs/AUDIT.md` `Data dell'audit` field.

**Target:** ≤ 95 days old (CI fail threshold).

The dashboard panels for these are part of UPLIFT u-kpi-dashboard.

---

## Appendix K — Technology choices considered and rejected

The Tech Radar in § 4 catalogues current placement. This appendix is the more interesting list: technologies that were *seriously considered* and *deliberately rejected*, with reasoning preserved for future re-evaluation.

### K.1 Apache Kafka as ingress queue

**Considered for:** Replacing MQTT broker as the high-volume telemetry sink.

**Rejected because:** MQTT is the industrial-domain native protocol. Kafka requires either dual-protocol bridge (cost) or forcing customers to publish Kafka (impossible — most PLCs speak MQTT or OPC UA, not Kafka).

**Re-evaluation trigger:** Tier 4 SaaS at multi-tenant million-msg-per-second scale where MQTT broker's durability story breaks down.

### K.2 Apache Pulsar as broker

**Considered for:** Multi-tenant broker with native isolation.

**Rejected because:** Operational complexity. EMQX is a more pragmatic next-step from Mosquitto.

### K.3 GraphQL for backend API

**Considered for:** Frontend ↔ backend boundary.

**Rejected because:** REST is structurally adequate for FactoryMind's CRUD surface; doctrine **H-4** binds. GraphQL adds N+1 query risk + over-fetching guards complexity. The real benefit of GraphQL (combinatorial query flexibility) doesn't apply here.

### K.4 MongoDB as metadata DB

**Considered for:** Document-flexible alternative to Postgres.

**Rejected because:** FactoryMind's metadata is fundamentally relational (`facility → line → device → shift`). Postgres' relational integrity + JSONB mixin gives the best of both worlds.

### K.5 Datadog for observability

**Considered for:** SaaS observability replacing the open-source stack.

**Rejected because:** Cost; lock-in. Loki + Prometheus + Grafana + OpenTelemetry covers FactoryMind's needs at a fraction of the price.

### K.6 HashiCorp Vault for secrets management

**Considered for:** Application-side secrets retrieval.

**Rejected because:** AWS Secrets Manager + Aruba KMS already cover the threat model. Vault adds operational complexity (cluster, seal/unseal) without proportional benefit at FactoryMind's scale. Re-evaluate at Tier 4 SaaS multi-tenant scale where per-tenant secret isolation justifies it.

### K.7 Custom ORM (TypeORM, Sequelize)

**Considered for:** Backend data access.

**Rejected because:** Raw `pg.query()` with parameterised statements is sufficient; ORMs add a layer of complexity (object lifecycle, lazy loading, etc.) that FactoryMind's read-heavy + write-mostly-via-MQTT pattern doesn't benefit from.

### K.8 Auth0 / Okta as identity provider

**Considered for:** SSO + customer-managed identities.

**Rejected (for default deployment) because:** Tier 2 customers are SMEs without IDP infrastructure. The local-identity-only auth model is appropriate. UPLIFT u-idp-integration provides an opt-in IDP shim for Tier 4 SaaS customers who require it.

### K.9 Mobile-native apps (React Native / Flutter)

**Considered for:** Operator-facing dashboard on mobile.

**Rejected because:** Web responsive serves shop-floor screens (typically wall-mounted tablets); native app is a maintenance burden. Anti-goal U-9.8.

### K.10 Server-side rendering (Next.js / Remix) for the dashboard

**Considered for:** Faster first-paint + SEO.

**Rejected because:** The dashboard is authenticated (post-R-FRONTEND-AUTH-001); SSR's SEO benefit is moot. First-paint is acceptable with Vite + code-splitting. The marketing site is a separate static `landing-page/`.

### K.11 Distroless base images

**Considered for:** Backend Dockerfile (replacing alpine).

**Trial-considered:** distroless has security benefits (no shell; no package manager). Alpine has ergonomic benefits (tini, ca-certificates, debug capability). For Tier 4 SaaS images, distroless is the eventual target (UPLIFT u-frontend-distroless covers a similar move for nginx-distroless).

The list is reviewed annually. Some rejections may flip if scale or customer requirements change.

---

## Appendix L — Macena constellation integration roadmap

Beyond the GreenMetrics integration (already operational at v1.0), the broader Macena product constellation has integration potential. This appendix sketches the landscape; concrete initiatives ship via § 6 and § 7.

### L.1 GreenMetrics — Piano 5.0 energy savings

**Integration shape.** DNS-SD discovery + HTTP REST. FactoryMind queries GreenMetrics for `baseline` and `monitored` energy consumption per facility; computes percentage savings against thresholds; renders Piano 5.0 PDF.

**Status.** Operational at v1.0. Versioned via `cross-product/greenmetrics-energy-v1` (UPLIFT u-comp-piano-5.0-greenmetrics).

**Evolution:** v2 contract may add per-machine energy attribution; v3 may add PDF cross-signing (FactoryMind + GreenMetrics on the same attestazione).

### L.2 LogiTrack — RENTRI (waste tracking)

**Integration shape (TBD).** Customers in metalworking generate scrap that must be tracked under D.Lgs. 152/2006 + RENTRI registration (Albo Gestori Ambientali Categoria 4). LogiTrack handles RENTRI submission. Integration: FactoryMind publishes `factory/<facility>/<line>/<machine>/scrap` events when a `reject` counter increments materially; LogiTrack consumes for the FIR (Formulario di Identificazione del Rifiuto).

**Status.** Roadmap; not v1.0.

### L.3 SmartERP — production orders + multi-tenant ERP

**Integration shape (TBD).** Customers using SmartERP (Tier 3 customers with > 50 employees) get a bidirectional sync: SmartERP publishes production orders → FactoryMind consumes; FactoryMind publishes OEE summaries → SmartERP consumes for capacity planning.

**Status.** Roadmap; not v1.0.

### L.4 TraceVino + AgriVigna — Veneto winery bundle

**Integration shape (TBD).** Customers operating wineries (DOC/DOCG Veronesi) bundle FactoryMind (bottling line OEE) + TraceVino (HACCP + SIAN) + AgriVigna (vineyard precision viticulture). The integration is commercial (bundled pricing) more than technical at v1.0; future technical integration possible.

**Status.** Commercial bundle; technical roadmap.

### L.5 FatturaFlow — Italian e-invoicing

**Integration shape (TBD).** Customer subscribes to FactoryMind Tier 2; FatturaFlow generates the FatturaPA xml + SDI submission for the subscription invoice. Customer-side integration: customer's commercialista receives the FatturaPA in their accounting tool.

**Status.** Internal use (FactoryMind's own invoicing) at first; customer-facing integration if FatturaFlow becomes commercially distributed.

### L.6 CyberGuard — defensive cybersecurity

**Integration shape (TBD).** CyberGuard provides defensive cybersecurity + Italian regulatory compliance posture for industrial customers. FactoryMind co-deployed with CyberGuard at the customer's edge gateway provides layered defence (network monitoring, IDS/IPS, anomaly detection on top of FactoryMind's audit log).

**Status.** Co-deployment at customer level; not technically integrated.

### L.7 TeamFlow — HR & payroll

**Integration shape (TBD).** TeamFlow handles CCNL contracts, INPS / UNIEMENS / F24, payroll. Operator IDs from TeamFlow could (with explicit consent + GDPR Art. 22 compliance) link to FactoryMind shift assignments. Highly sensitive; only deployed if customer explicitly requests + signs DPIA addendum.

**Status.** Roadmap; sensitive.

### L.8 Cross-product KPIs

When two or more sister products are co-deployed at the same customer, the KPI dashboard cross-correlates: e.g., a customer's OEE drop correlated with an energy-consumption increase (FactoryMind + GreenMetrics) suggests a worn-bearing machine drawing more current. UPLIFT u-cross-product-kpi-dashboard ships this cross-correlation panel for joint customers.

The integration roadmap is reviewed quarterly; new integrations land via dedicated UPLIFT initiatives.

---

## Appendix M — Polish-not-firefighting examples (the discipline in practice)

Concrete illustrations of the polish-vs-firefighting distinction.

### M.1 Frontend rounded-corners change

A Frontend engineer notices that AlertFeed.tsx uses `rounded-md` while MachineStatus.tsx uses `rounded-lg`; the inconsistency is mild but visible.

- **Polish path:** open a PR with the consistent radius across all components; verify visual regression tests pass; merge as a Track DX or Track Commercial polish (depending on which framing fits).
- **Firefighting path:** ignore until a customer complains; respond reactively when noticed.

The polish path is preferred — and is exactly the kind of work the 15 % technical-debt budget covers.

### M.2 Backend service-name standardisation

The backend has services named in mixed case: `mqtt-handler.js`, `influx-writer.js`, `oee-calculator.js`. The convention is consistent (kebab-case files; PascalCase classes within); but if the team decides PascalCase files are clearer, the rename is polish.

- **Polish path:** open an ADR proposing the rename; capture the decision (or rejection) in `docs/adr/`. If accepted, do the rename in a single PR; verify imports updated; merge.
- **Firefighting path:** mix conventions accidentally; let drift accumulate.

### M.3 Customer-facing language consistency

The Italian word for "downtime" varies in the codebase: `fermo macchina` in some places, `fermo` in others, `tempo di fermo` elsewhere. None is wrong; consistency is a customer-facing polish.

- **Polish path:** glossary in HANDOFF § 11 declares the canonical term; codebase grep + replace; verify all customer-facing strings consistent.
- **Firefighting path:** revisit when a customer mentions it.

### M.4 Test fixture cleanup

Test fixtures use mixed Italian and English (`facility = "test"` in some, `facility = "mozzecane"` in others). Consistency improves test legibility.

- **Polish path:** standardise on a single fixture pattern (`facility = "test-facility"` for unit tests; `facility = "mozzecane"` for integration tests that exercise Italian-context).
- **Firefighting path:** continue ad-hoc.

### M.5 Documentation tone consistency

Different sections of HANDOFF (or this document) drift between formal and conversational tone. The polish: a quarterly read-through that smooths the tone (rule **U-17**).

These examples are individually small; collectively they are the difference between a kit-grade product and a polished one. Track DX absorbs the work.

---

## Appendix N — Polishing in the customer engagement context

The customer engagement creates a special category of polish: things that are polished *because the customer notices them*. This appendix catalogues those.

### N.1 First impressions

The first time a customer's responsabile produzione opens the dashboard, the first 60 seconds matter. Polish targets:

- **Dashboard load time** ≤ 2 s on a stock corporate browser.
- **First chart render** ≤ 1 s after data lands.
- **Italian text quality** zero typos or English-leaks.
- **Color choices** legible on a 14-inch laptop in a sunlit shop-floor office.
- **Iconography** intuitive (running = green play; idle = yellow pause; down = red stop).

### N.2 First attestazione PDF

The PDF the commercialista receives:

- **Italian formal register** (no English fragments).
- **Citation completeness** every Circolare cited fully.
- **Visual layout** matches a perizia tecnica's expectations (not a marketing brochure).
- **Footer with disclaimer** (doctrine **H-16** non-substitution).
- **Cryptographic signature** (post u-com-attestazione-pdf-sign) — visible "signed by" mark.

### N.3 First customer support interaction

The customer asks a question; the response should be:

- **Bilingual capable** Italian default; English on request.
- **Within SLA** (4 hours for Tier Standard per `legal/CONTRATTO-SAAS-B2B.md` art. 5; 1 hour for Enterprise).
- **Empathetic** (the customer's responsabile IT is often stressed; tone matters).
- **Resolution-oriented** (if a bug, a ticket; if a misunderstanding, a clarification + an HANDOFF section pointer).

### N.4 First quarterly review with customer

The 90-day check-in's success determines the renewal arc. Polish targets:

- **Data preparation** before the call (their OEE, their downtimes, their alarms).
- **Insight delivery** ("here are 3 things the data shows you didn't know").
- **Roadmap honesty** (what's coming, what's not, what's anti-goal).
- **Expansion proposal** (priced, scoped, time-boxed).

The customer-engagement polish is the highest-leverage polish; bad customer experience invalidates years of engineering work in 30 minutes.

---

## Appendix O — Audit trail of this document

- **First commit:** 2026-05-07. Pinned commit `d4c5107`.
- **Reviewers (v1.0):** Renan; peer reviewer pending.
- **Next quarterly review:** 2026-08-01.
- **Sign-off:** _________________________ (Renan, date). _________________________ (peer, date).

---

## Appendix P — Cross-track dependency graph

The five tracks are orthogonal in concept but interact in practice. Many initiatives in one track depend on completion of an initiative in another. This appendix maps the critical dependencies.

### P.1 DX → OX dependencies

- **u-dx-pre-commit** must land before the small-PR culture (u-dx-pr-discipline) can be enforced — pre-commit checks remove the noisy CI failures that obscure the per-commit signal.
- **u-dx-coverage-ratchet** depends on **u-dx-bootstrap-time** — fast bootstrap enables more confident `npm test` runs, which feed coverage progress.
- **u-ops-dora-instrumentation** depends on **u-dx-pre-commit + u-dx-pr-discipline** — without small focused commits, lead-time measurement is noisy.

### P.2 OX → Security dependencies

- **u-sec-pen-test-001** depends on **u-ops-cd-promotion-gate + u-ops-runbook-drills** — pen-test against an unstable promotion path produces findings that conflate "unstable" with "vulnerable".
- **u-sec-mtls-fleet** depends on **u-ops-edge-template** — fleet-wide mTLS rollout requires the edge template to be stable.

### P.3 Security → Compliance dependencies

- **u-comp-cra-conformity** depends on **u-sec-slsa-l3** — CRA's "secure default config" requirement (Annex I) is materially supported by SLSA L3 attestations.
- **u-comp-iso-27001** depends on **u-sec-pen-test-001 + u-sec-bug-bounty** — ISO 27001 requires evidence of vulnerability management; pen-test + bug bounty constitute evidence.

### P.4 Compliance → Commercial dependencies

- **u-com-first-customer-engagement** depends on **u-comp-piano-5.0-greenmetrics** — Tier S customers want Piano 5.0 capable; the cross-product contract is the gate.
- **u-com-channel-commercialista** depends on **u-com-attestazione-pdf-sign** — a signed PDF is what the commercialista will ask for as proof.

### P.5 Commercial → DX dependencies

- **u-com-customer-success-cadence** drives **u-dx-error-legibility** — customer-reported issues whose root cause is hard-to-diagnose error messages directly motivate the DX investment.

### P.6 Security → DX dependencies

- **u-sec-pen-test-001** drives **u-dx-error-legibility** — pen-test findings often surface error-message leaks; fixing them is DX work.
- **u-sec-mtls-fleet** drives **u-dx-onboarding-doc** — mTLS introduces complexity that new engineers must understand.

### P.7 Compliance → Operations dependencies

- **u-comp-cra-conformity** drives **u-ops-runbook-drills** — CRA requires demonstrated incident-response capability; runbook drills are the demonstration.
- **u-comp-italia-residency** drives **u-ops-edge-template** — Italian-resident deployments use the same edge template.

### P.8 Visualisation

The full dependency graph (~ 30 nodes, ~ 50 edges) is captured in `docs/uplift-deps.dot` (graphviz) — UPLIFT u-dep-graph-doc ships this artefact. Quarterly review walks the graph to identify newly-blocked initiatives.

---

## Appendix Q — Polishing the polishing process

A meta-discipline: this Uplift Plan is itself a candidate for polish each quarter. The quarterly review (Appendix B) reads the document end-to-end and may produce updates. Common polish-the-plan moves:

### Q.1 Initiative split

An initiative that turned out to be larger than estimated is split into two or three. The original ID retains the broader scope marker; sub-initiatives carry numerical suffixes (e.g., u-sec-mtls-fleet-001 vs u-sec-mtls-fleet-002).

### Q.2 Initiative merge

Two initiatives whose work materially overlaps may be merged. The merged initiative carries the smaller-effort ID (less rework on the doc).

### Q.3 Track redefinition

If a track accumulates too many initiatives (> 12), it may split (e.g., Track Security might split into "Track Security Posture" + "Track Supply Chain"). If a track empties (< 3 initiatives), it may merge with a neighbouring track.

### Q.4 Anti-goal flip

When a flip condition fires (rare but happens), the anti-goal moves to the active backlog as a new initiative; the anti-goal entry in § 9 is annotated with the flip date + rationale.

### Q.5 Doctrine update

A new pattern observed in practice may justify a new doctrine rule (e.g., U-21, U-22). New rules require: (a) at least one quarter of evidence that the rule would have helped; (b) ADR; (c) sign-off at quarterly review. New rules are appended; existing rules are not renumbered.

### Q.6 Tech radar quadrant move

A technology in Trial may graduate to Adopt; a technology in Adopt may move to Hold (deprecation). Each move is an ADR + Abstraction Ledger entry. § 4 is updated.

### Q.7 KPI target update

DORA targets, business-KPI targets, customer-KPI targets are revised against reality. A target consistently met for 3 quarters is tightened; a target consistently missed is reviewed (was the target wrong, or is the work blocked?).

### Q.8 Five-year horizon revision

The five-year horizon shifts annually; the v2.0 plan (one year hence) projects to 2032 instead of 2031. The horizon is informational, not contractual.

The polishing-the-plan discipline ensures the plan stays useful over 5+ years; without it, the plan ossifies and becomes ignored.

---

## Appendix R — Reading the four-document set as a whole

Every quarter, the reader of this document is encouraged to read it together with HANDOFF, AUDIT, REMEDIATION. The four documents form a system; reading one in isolation misses dependencies and misses systemic drift.

A suggested 1-day reading schedule for the quarterly review:

- **9:00–11:00.** HANDOFF end-to-end. Calibrate against the current state of the system.
- **11:00–13:00.** AUDIT end-to-end. Note any findings that have changed status; check the CVE register's "last reviewed" date.
- **14:00–16:00.** REMEDIATION end-to-end. Walk the sign-off ledger; note drift.
- **16:00–17:30.** UPLIFT end-to-end. Walk the initiative ledger; review anti-goals; assess KPI dashboard.
- **17:30–18:00.** Synthesis and sign-off. Output the quarterly review minutes.

This is HANDOFF doctrine **H-22** in execution. The 8 hours is a real cost; the alternative (drift) is a larger cost.

---

## Appendix S — Anti-pattern catalogue (failure modes to avoid)

The following patterns are observed failure modes in software projects of FactoryMind's scale. They are catalogued here so engineers and reviewers can name them when seen.

### S.1 The "we'll polish it later" pattern

Symptom: an initiative ships with known rough edges, with the comment "we'll polish it later". Six months later, the rough edges are still there. Cure: rule **U-2** (don't gold-plate; but if a polish is genuinely needed for "good enough", do it now).

### S.2 The "perfect is the enemy of good" pattern (inverted)

Symptom: a polish initiative expands indefinitely, never reaching "good enough" because every iteration discovers new improvements. Cure: rule **U-20** (recognising "good enough" is a skill); set a hard target value before starting.

### S.3 The "let's adopt this shiny new thing" pattern

Symptom: a new framework / library / tool is adopted because it's trending, without an Abstraction Ledger entry justifying the cost. Cure: rule **U-11** (auditable tech radar movements); rule **U-16** (no new abstraction without removal trigger).

### S.4 The "let's not adopt this because we're cautious" pattern (inverted)

Symptom: useful new patterns rejected reflexively. Cure: the Tech Radar's Trial quadrant exists for this. A trial is a low-cost experiment.

### S.5 The "scope creep via customer requests" pattern

Symptom: every customer asks for one thing; the team accumulates 100 things; nothing is done. Cure: rule **U-19** (customer feedback shapes roadmap, but not unilaterally); anti-goals to prevent fork-on-feature-request.

### S.6 The "the postmortem is unblameworthy AND uninstructive" pattern

Symptom: postmortems describe what happened in carefully neutral language; no learning emerges. Cure: blameless ≠ insight-less. The postmortem must produce concrete actions tied to REMEDIATION tickets (rule **R-12**).

### S.7 The "scope discipline is the founder's burden" pattern

Symptom: every scope decision goes through the founder; founder becomes bottleneck. Cure: doctrine + anti-goals + Abstraction Ledger together encode the scope discipline so it's not personal — anyone can apply it.

### S.8 The "customer success is sales' problem" pattern

Symptom: customer-success cadence (Appendix C) skipped; expansion-driven growth (NDR ≥ 105 %) doesn't happen. Cure: explicit Track Commercial ownership; rule **U-9** (cadence is product, not afterthought).

### S.9 The "compliance is finished" pattern

Symptom: a one-time audit closes; team relaxes; six months later, drift makes the audit invalid. Cure: compliance maturity as a continuous track (Track Compliance); quarterly compliance review.

### S.10 The "we have too many tools" pattern

Symptom: 5+ different observability tools; engineers don't know which to use. Cure: Tech Radar Hold + Abstraction Ledger removal triggers; consolidation initiatives.

The catalogue is reviewed annually; new patterns are added when observed.

---

## Appendix T — Glossary of uplift terms

(Beyond HANDOFF § 11 + REMEDIATION Appendix H.)

- **DORA Four Keys.** Forsgren / Humble / Kim's metrics: deployment frequency, lead time for changes, change failure rate, MTTR. dora.dev.
- **Tech Radar.** ThoughtWorks / Spotify pattern: catalog technologies in Adopt / Trial / Assess / Hold quadrants.
- **Abstraction Ledger.** GreenMetrics-style discipline: every architectural abstraction is a cost-centre; carries a removal trigger.
- **Track.** A thematic grouping of uplift initiatives (DX / OX / Security / Commercial / Compliance).
- **Initiative.** A unit of uplift work, larger than a remediation ticket; carries outcome + success metric + target value.
- **Anti-goal.** A deliberate "we will not do this" decision, with a flip condition.
- **Flip condition.** A measurable trigger that, if it fires, reopens an anti-goal decision.
- **DORA delta.** The expected change in DORA Four Keys after an initiative ships; rule **U-18** requires it positive or zero.
- **Quarterly review.** HANDOFF doctrine **H-22** ritual; reads all four documents end-to-end.
- **Cross-track dependency.** An initiative in one track that depends on completion of an initiative in another.
- **NDR.** Net Dollar Retention; sum of (MRR_now - churn + expansion - contraction) / MRR_baseline; target ≥ 105 %.
- **Magic Number.** SaaS metric: (Net New ARR) / (Sales + Marketing spend); ≥ 0.8 = healthy growth efficiency.
- **Rule of 40.** SaaS metric: growth-rate-% + EBITDA-margin-%; ≥ 40 = healthy mature SaaS.
- **Burn Multiple.** Net Burn / Net New ARR; ≤ 1.5× = healthy efficient growth.
- **Bus factor.** Number of people whose departure would block a load-bearing module (target ≥ 2 per HANDOFF doctrine **H-5**).
- **Polish-not-firefighting.** The discipline of working on improvement (uplift) rather than reactive bug-fixing (remediation).
- **CRA / NIS2 / Stanca / Piano 4.0 / Piano 5.0.** Italian + EU regulatory frameworks driving compliance work; cross-referenced in HANDOFF Appendix A.

---

## Appendix U — Relationship to the broader Macena product portfolio

FactoryMind is one of nine projects in the Macena product constellation. The portfolio strategy informs the Uplift Plan in several ways.

### U.1 Cross-product polish efficiency

A polish initiative that benefits multiple Macena products amortises its cost. Examples:

- **Cosign + SBOM + SLSA pipeline** — the same supply-chain hardening pattern applies to GreenMetrics, LogiTrack, SmartERP, etc. FactoryMind's u-sec-slsa-l3 is the first instance; subsequent products inherit the pattern with minor adaptation.
- **NIS2 / CRA scope analysis** — the legal analysis (counsel-driven) maps similarly across products. The cost is amortised by sharing the legal review.
- **Italian regulatory tracking** — the discipline of monitoring Legge di Bilancio + Circolari MIMIT applies to all Italian-SME-focused products. A shared "regulatory radar" (UPLIFT u-cross-product-regulatory-radar candidate) catalogues this for all products.

### U.2 Cross-product DX

The development environment (Docker, Node.js, Postgres, Mosquitto, etc.) is similar across the constellation. A DX improvement in FactoryMind (e.g., faster bootstrap) tends to translate to other products. The shared `LICENSE`, `.editorconfig`, `.prettierrc` patterns reflect this.

### U.3 Cross-product talent

The hiring pool for FactoryMind (Italian senior engineers comfortable with Node.js + IIoT + Italian regulatory context) overlaps with the pools for the other products. A team member hired to FactoryMind may rotate to GreenMetrics for a quarter; cross-pollination is intentional.

### U.4 Cross-product anti-goals

Some anti-goals apply across products: the "no fork for restaurants" anti-goal (U-9.3) parallels similar discipline in GreenMetrics ("no fork for office-buildings energy"); LogiTrack has its own version. The discipline is portfolio-wide.

### U.5 Cross-product roadmap coordination

The Macena portfolio's roadmap is coordinated quarterly: which product gets the most engineering attention given customer demand and market timing. A FactoryMind quarter heavy on Tier 4 SaaS infrastructure might pause GreenMetrics feature work; subsequent quarters rebalance.

The portfolio coordination is captured in the founder-level review (separate from the per-product quarterly reviews). The portfolio review is not part of this document; it lives in `moneyplan.txt` + private founder notes.

---

## Appendix V — Risks specific to the Uplift discipline

Polishing has its own failure modes. Catalogued for awareness.

### V.1 Polish addiction

Symptom: the team spends > 50 % of capacity on polish, neglecting feature work and remediation. Customer outcomes don't improve; engineer satisfaction does.

Cure: REMEDIATION § F.1 time-allocation (40-40-15-5) is the discipline; UPLIFT cannot consume more than its 40 %.

### V.2 Polish without measurement

Symptom: an initiative ships, the engineer says "it's better now", but no metric was defined.

Cure: rule **U-2** strict enforcement at planning meeting; `success_metric:` line is mandatory.

### V.3 Track collision

Symptom: two tracks compete for the same engineer's time on the same week; both stall.

Cure: cross-track dependency graph (Appendix P); sprint planning chooses one track-headline initiative per sprint.

### V.4 Roadmap fragmentation

Symptom: the roadmap (§ 7) becomes a list of 50 initiatives, each barely advanced, none shipped.

Cure: the Must-ship / Stretch distinction; rule **U-2** + **U-3**; quarterly review aggressively trims.

### V.5 Anti-goal erosion

Symptom: an anti-goal slowly erodes via "small exception" precedents; eventually the anti-goal is forgotten.

Cure: quarterly review reads § 9 explicitly; flip events are documented; small exceptions require written justification.

### V.6 Quarterly review skipping

Symptom: the quarterly review is busy / disrupted / forgotten; drift accumulates over multiple quarters.

Cure: the review is calendared 12 months in advance; missing it is a P0 documentation defect (HANDOFF doctrine **H-22**).

### V.7 KPI distortion

Symptom: a KPI is gamed (e.g., deployment frequency is high but with broken deployments) without the team noticing.

Cure: cross-KPI sanity checks (deployment frequency × change failure rate; if both rise, something is off); quarterly review surfaces.

### V.8 Customer-feedback bias

Symptom: the loudest customer drives the roadmap; quieter customers' needs ignored.

Cure: rule **U-19**; customer-success cadence aggregates signals from all customers; anti-goal U-9.3 (don't fork) prevents single-customer-driven divergence.

### V.9 Engineer burnout

Symptom: engineers work weekends to meet polish deadlines; quality drops; turnover rises.

Cure: rule **R-7** (wave drift with sign-off); honest capacity assessment at sprint planning; remediation/feature/polish balance protected.

### V.10 Polish that introduces complexity

Symptom: a polish initiative adds an abstraction (e.g., introduces a state-management library) that future engineers struggle with.

Cure: Abstraction Ledger discipline (§ 5); ADR for any new abstraction; rule **U-16**.

The risks are reviewed annually; new risks are added when observed.

---

## Appendix W — Investor / due-diligence-friendly summary

(For the moment when an investor asks "what's your engineering plan?")

FactoryMind operates a four-document discipline: HANDOFF (operations + doctrine), AUDIT (independent technical assessment), REMEDIATION (time-boxed fix plan), UPLIFT (this document — polishing + roadmap). The four are reviewed quarterly together (HANDOFF doctrine **H-22**); drift between them is a P0 documentation defect.

**Engineering health metrics (DORA Four Keys at v1.0 baseline):** measurable from Q3 2026. v1.0 is single-engineer pre-customer; meaningful comparison post hire #2 + first customer.

**Engineering capacity allocation:** 40 % remediation + 40 % feature + 15 % technical-debt + 5 % on-call (REMEDIATION § F.1). Critical incidents reset; the discipline is sustainable.

**Roadmap visibility (next 12 months):** § 7 of this document. Must-ship Q3 2026: first Tier 2 customer + DORA dashboard + cross-product GreenMetrics contract. Must-ship Q4 2026: external pen-test + signed PDF + Aruba Italia option. Must-ship Q1 2027: NIS2 cert + mTLS fleet + bug bounty. Must-ship Q2 2027: CRA conformity + SL-3 trajectory + WCAG 2.2.

**Anti-goals:** § 9. The discipline of saying no protects the roadmap.

**KPI dashboard:** § 10. Engineering, Business, Customer, Compliance — cross-KPI checks prevent single-metric gaming.

**Risk catalogue:** Appendix V. The plan acknowledges its own failure modes.

**Five-year horizon:** § 11. 200–400 customers, ISO 27001 certified, possibly cross-border (DACH). Exit-path scenarios catalogued in MODUS_OPERANDI § 17 (legacy).

The Uplift Plan v1.0 baseline is the founder-self-authored, peer-reviewed-pending state. The investor due-diligence reads this document together with the others; the four together demonstrate engineering discipline beyond what a typical seed-stage startup carries.

---

## Appendix X — How to revise this document

The plan is **versioned and signed**. Revisions follow a formal process.

**Quarterly revisions** (default; HANDOFF doctrine **H-22**):

- Update Status fields in initiative ledgers.
- Add new initiatives discovered.
- Move initiatives between waves with sign-off.
- Update Tech Radar quadrants with ADR pointers.
- Update Abstraction Ledger entries.
- Re-evaluate anti-goal flip conditions.
- Update KPI dashboard snapshots.
- Append to Appendix C diff (this document doesn't have one, but future versions will).
- Update sign-off line.

**Major revisions (v2.0, v3.0)**:

- Annual; aligned with the broader product strategy refresh.
- Restructure tracks if needed.
- Refresh the five-year horizon.
- Refresh the doctrine list (rule changes via ADR).

**Minor revisions (v1.x)**:

- As needed within the year.
- Bug fixes, clarifications, citation refreshes.

The git history is the canonical record. Each version-tag commit is signed (rule **R-12** by extension).

---

## Appendix Y — Companion-document inheritance

This document inherits from + references the other three:

- **From HANDOFF**: doctrine cross-references (rules **H-1** through **H-22**), the file:line anchor index (HANDOFF Appendix B), the decree map (HANDOFF Appendix A), the runbook materialisation (HANDOFF § 8).
- **From AUDIT**: findings as the input to remediation; the strengths-not-to-regress list (AUDIT § 11); the compliance scorecards (AUDIT § 10); the CVE register (AUDIT § 9).
- **From REMEDIATION**: tickets that must close before certain Uplift initiatives can land; the wave model + RACI; the sign-off ledger structure.

The four-document inheritance is a graph, not a tree. UPLIFT inherits from the others; the others reference UPLIFT for forward-looking context. Quarterly review reads them in dependency order: HANDOFF → AUDIT → REMEDIATION → UPLIFT.

---

## Appendix Z — Sample initiative life-cycle log

A concrete trace of how an initiative moves through its life. Demonstrates the discipline in practice.

**Initiative:** u-com-attestazione-pdf-polish

**Phase 1 — Pending (Q2 2026 quarterly review)**

- Reviewer notices that the attestazione PDF format is functional but visually unrefined.
- Initiative added to UPLIFT § 6 Track Commercial.
- Effort estimated L; wave Q3 2026.

**Phase 2 — In Progress (Q3 2026 sprint planning, Day 1)**

- Sprint planning meeting selects this initiative as the Q3 2026 commercial-track headline.
- Owner: Renan + freelance designer.
- Dependencies: R-ATTESTAZIONE-IDEMPOTENCY-001 closed; first Tier 2 customer signed (gates the customer-feedback path).
- Spec written per § 8 template.

**Phase 3 — Implementation (Days 1–14)**

- Designer produces three layout concepts.
- Renan picks one based on commercialista feedback.
- Implementation in `backend/src/services/piano4-attestazione.js`; PDF rendering via pdfkit (or puppeteer migration if chosen).
- Regression test: existing PDF generation tests assert no breakage.
- New test: visual regression test (image comparison) against the chosen layout.

**Phase 4 — Verification (Days 14–18)**

- First customer's commercialista reviews the new format.
- Acceptance: written email confirming format is sufficient for Circolare 9/E/2018 attestation.
- Sign-off: Renan + commercialista.

**Phase 5 — Verified (Day 18)**

- Status updated.
- Initiative archived in § 8 spec ledger; success metric met.

**Phase 6 — Quarterly review (Q3 2026 close, Day 90)**

- Closure noted in quarterly review minutes.
- Any follow-on work (e.g., u-com-attestazione-pdf-sign as a separate initiative) is scheduled for Q4 2026.

**Phase 7 — Long-term observation (continuous)**

- Subsequent customers' commercialisti also accept the format → success.
- Customer's auditor (Agenzia delle Entrate) accepts the format → load-bearing validation.
- One year later (Q3 2027 quarterly review), the v1 format is still serving; no rework needed.

This life-cycle is a model. Every initiative carries roughly the same shape; some are shorter (S-effort initiatives compress phases), some longer (XL initiatives stretch over multiple quarters).

---

## Appendix AA — Final notes

This document closes the four-document set at v1.0 baseline. Together with HANDOFF, AUDIT, REMEDIATION, it forms the canonical artefact governing FactoryMind's engineering, operations, security, compliance, and commercial trajectories for the next 12 months and the broader 5-year horizon.

The four documents supersede the legacy `docs/` content. The legacy files (`docs/legacy/`) are preserved for diff and historical reference; deletion is a user decision after sign-off.

The plan's success metric is **coherence over time**: that the four documents continue to make sense together, that drift is caught at quarterly review, that customer engagements move forward without surprise, that engineering work shipped reflects the plan's intent. Coherence is harder than ambition; ambition is cheap. Coherence is the disciplined work.

The plan's signing line is provisional at v1.0 baseline. The peer-reviewer signature is pending until hire #2's onboarding closes; the gap is documented (rule **R-14**) and known. The plan stands; the gap stays explicit until closed.

---

## Appendix AB — Cross-doc citations summary

For convenience, the cross-document citations made in this UPLIFT plan, indexed for navigation.

**To HANDOFF.md:**

- Doctrine **H-1** (15-min bootstrap): § 6.1 (u-dx-bootstrap-time), Appendix E.1.
- Doctrine **H-3** (Italian for legal, English for engineering): § 0 conventions.
- Doctrine **H-5** (bus factor ≥ 2): § 11 (5-year horizon).
- Doctrine **H-10** (cross-product documented before code): rule **U-10**, Appendix L.
- Doctrine **H-11** (OSS vs SaaS surfaces): § 6.5 Track Compliance.
- Doctrine **H-13** (telemetry vs PII): § 5 AB-03 (JSONB metadata).
- Doctrine **H-14** (forward-only migrations): Appendix K (rejected ORMs).
- Doctrine **H-16** (perizia tecnica is customer's perito): § 6.4 Track Commercial (PDF).
- Doctrine **H-17** (5-day postmortem SLA): rule **U-9** + Appendix S.
- Doctrine **H-22** (quarterly review): rule **U-17**, Appendix B, Appendix R.
- § 4 (Code map): Tech Radar mapped onto current modules.
- § 8 (SRE runbooks): Track OX game-day initiatives.
- § 11 (Glossary): expanded in Appendix T here.

**To AUDIT.md:**

- § 11 (Strengths): rule **R-15** + § 5 Abstraction Ledger preservations.
- § 12 (Accepted residuals): rule **U-3** anti-goal alignment.
- § 9 (CVE register): § 6.3 Track Security continuous tickets.
- § 10 (Compliance scorecards): § 6.5 Track Compliance progress measurement.
- Doctrine **A-12** (CVE quarterly): § 8 Continuous track.

**To REMEDIATION.md:**

- W1/W2/W3 closures as preconditions for many UPLIFT initiatives.
- Rule **R-7** (wave drift): rule **U-3** + **U-7** (track coordination).
- Rule **R-15** (do-no-harm): rule **U-1** (guard test).
- Appendix F (integration with feature work): § 6 track-allocation.

The cross-doc graph is dense; the plan rewards reading the four documents in sequence.

---

## Conclusions

The Uplift Plan describes the trajectory from "good" to "regulator-grade and customer-flagship" for FactoryMind. The five tracks (DX, Operations, Security, Commercial, Compliance) provide orthogonal handles; the doctrine of 20 numbered rules ensures each polish initiative is measurable, justified, and reversible. The DORA Four Keys, Spotify Tech Radar, and GreenMetrics-style Abstraction Ledger together provide a multi-framework view of engineering health that resists the failure modes of single-framework planning.

The plan's most important content is **the anti-goals**. The list of things FactoryMind explicitly will not do is the visible discipline that prevents scope-fragmentation; quarterly review of flip-conditions ensures the discipline tracks reality. The next-most-important content is **the customer-success cadence in Appendix C** — operationalised customer trust, scheduled rather than ad-hoc.

The 12-month roadmap (§ 7) is concrete; the 24-month outlook (§ 3) is intentional; the 5-year horizon (§ 11) is intent rather than commitment. The plan is reviewed quarterly per HANDOFF doctrine **H-22**; each quarter's diff is preserved in the git history.

The Uplift Plan ships at v1.0 baseline alongside HANDOFF, AUDIT, REMEDIATION. Together they form the canonical four-document set governing FactoryMind. They supersede the legacy `docs/` content (moved to `docs/legacy/` per Phase F of the publication).

The Plan is not the work; the work is the work. The Plan's role is to keep the work coherent across quarters, sprints, and customer engagements. Coherence is the metric.

---

**Made in Mozzecane (VR) — Veneto, Italy.**

(End of UPLIFT Plan v1.0; cross-referenced with HANDOFF, AUDIT, REMEDIATION; reviewed quarterly per doctrine.)

---

## Appendix AC — Closing observation on the four-document discipline

A final observation, to make the v1.0 baseline whole.

The four documents (HANDOFF, AUDIT, REMEDIATION, UPLIFT) constitute a system of governance for the FactoryMind project. The system is unusual in scale for a pre-first-customer commercial software project: 80 000+ words across four documents at v1.0 baseline, written by a solo founder, intended to be readable by a senior engineer joining cold.

The system's bet is that **discipline scales** — that the marginal cost of writing the four documents at v1.0 is repaid many times over as the team grows, customers onboard, regulatory deadlines arrive, and engineering decisions accumulate. The contrary bet (write nothing; ship fast; figure it out later) is the more common Italian-SME-software bet; FactoryMind makes the opposite bet because Piano 4.0/5.0 attestazione integrity is regulator-graded and post-hoc reconstruction is harder than upfront discipline.

The four-document system is a wager on coherence. The next year is the wager's first test.

The fifth-year retrospective, the quarterly review minutes archive, the postmortem aggregation, the AUDIT diff history — these are the artefacts that will eventually validate (or invalidate) the wager. At v1.0 baseline, the artefacts don't yet exist; they accumulate one quarter at a time.

If the wager pays off, the system is the foundation on which the company is built. If it doesn't, the system is replaced or rebuilt in a v2.0 that learns from v1.0's failure modes. Either way, the writing was the work; the writing is what changes the project's trajectory.

The four documents conclude here, at v1.0 baseline, on 2026-05-07, in Mozzecane (VR), Veneto, Italy. The next phase of work is execution.

---

**End of the four-document set v1.0.**

(Word counts at publication: HANDOFF ~22.1k; AUDIT ~20.2k; REMEDIATION ~20.0k; UPLIFT ~20.0k; total ~82.3k. All four exceed the 20 000-word floor by design; further compression is anti-uplift, further padding is gold-plating. The set is calibrated.)

This UPLIFT plan is the youngest of the four; the discipline observed in the writing of the other three informs every section here. Initiatives ship; tracks evolve; anti-goals adjust; KPIs sharpen. The four-document system is reviewed every quarter for the next year, then the v2.0 set is published one year hence with diffs preserved in git history.

The plan is meant to be read. The plan is meant to be acted on. The plan is meant to be revised when reality contradicts it. The plan is, finally, the codified honest answer to "what is FactoryMind going to be in twelve months, and how will we get there with discipline rather than luck?" — and the answer is here, in 80 000 words, signed and dated, ready for the next quarterly review to revise.

That is the work of v1.0.
