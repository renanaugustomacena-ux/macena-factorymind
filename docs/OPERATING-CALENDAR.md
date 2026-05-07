# FactoryMind — Operating Calendar

**Versione:** 1.0.0 (initial)
**Data di pubblicazione:** 2026-05-07
**Owner:** Renan Augusto Macena (founder + lead engineer)
**Companion documents:** [`HANDOFF.md`](HANDOFF.md) (operations), [`AUDIT.md`](AUDIT.md) (findings), [`REMEDIATION.md`](REMEDIATION.md) (waves + cadences), [`UPLIFT.md`](UPLIFT.md) (roadmap)

This is **not** a fifth canonical document. It is an aggregation view that consolidates the dated commitments scattered across the four-document set into a single tool that answers the question: *what must happen, by when, and who unblocks it*. The doctrine sits in the canonical four; this calendar links there rather than restating.

---

## 0. How to read this document

**Daily / weekly use:** § 5 ("This week — external W1 unblocks tracker") is the layer that decays fastest and matters most. Re-read it Monday and Friday.

**Monthly / quarterly use:** § 3 (continuous cadences) tells you what's about to be due. § 4 (W2/W3 horizon) tells you what's coming next.

**Compliance audit / customer engagement use:** § 1 (hard deadlines) + § 2 (regulatory drop-deads) are what a counsel or auditor will ask about.

---

## 1. Hard deadlines — wave SLAs

These are the dates the founder signed against in [`REMEDIATION.md`](REMEDIATION.md) at v1.0 publication. Source of truth: [REMEDIATION § 1 wave model](REMEDIATION.md#1-wave-model--cadence) + [Appendix C status board](REMEDIATION.md#appendix-c--status-board).

| Wave | Closure SLA | Days from 2026-05-07 | What it gates |
|---|---|---|---|
| **W0** Emergency | ≤ 7 days from ticket creation | — (no W0 tickets at v1.0) | Active production incident |
| **W1** Critical | **2026-06-06** | 30 | First paying Tier 2 / 3 / 4 customer engagement |
| **W2** High + heavy Medium | **2026-08-05** | 90 | Second customer + structural-debt closure |
| **W3** Medium + Low | **2026-11-03** | 180 | Long-tail compliance maturity |

Doctrine: drift requires sign-off (rule **R-7** in REMEDIATION § 2 + [§ 11 sign-off ledger](REMEDIATION.md#11-sign-off-ledger)). The wave is a calendar, not a target (rule **R-16**).

---

## 2. Regulatory drop-dead dates

These are the legal calendar dates that — if missed — convert from project deadline into regulatory exposure. None are negotiable; all are sourced from [`HANDOFF.md` Appendix A](HANDOFF.md) decree register.

| Date | What | Source | FactoryMind exposure |
|---|---|---|---|
| **2026-09-11** | CRA vulnerability handling reporting comes into force (Reg. UE 2024/2847) | HANDOFF doctrine **H-11** | Tier 2 / 3 / 4 commercial distributions are "products with digital elements" placed on EU market — vulnerability handling + 24h reporting required |
| **2027-12-11** | CRA full applicability | HANDOFF doctrine **H-11** | Conformity assessment + CE marking for the commercial product |
| **annual: 1 January – 28 February** | NIS2 entity registration with ACN (Agenzia per la Cybersicurezza Nazionale) if scope-included | REMEDIATION R-NIS2-SCOPE-001 (D.Lgs. 138/2024) | Pending counsel determination of scope inclusion |
| **annual** | Quarterly four-doc review (HANDOFF doctrine **H-22**) | HANDOFF § 2 + REMEDIATION § 8.9 | Internal compliance with own doctrine |
| **annual: end of fiscal year** | Italian fiscal closure | Out of scope for this document — **route to commercialista** | Commercialista handles |

The single hard regulatory calendar point inside this year's planning horizon is **2026-09-11 (CRA vulnerability handling)**. R-CRA-001 in W2 is the engineering-side preparation; counsel sign-off on conformity-assessment posture is the gate.

---

## 3. Continuous cadences

Source: [REMEDIATION § 8](REMEDIATION.md#8-continuous-cadences). Linked here for convenience; do not duplicate the procedural detail.

| Cadence | Frequency | First due (relative to 2026-05-07) | Owner |
|---|---|---|---|
| [CVE register sweep](REMEDIATION.md#81-cve-register-sweep--quarterly) | Quarterly (first Tue of month after quarter-end) | 2026-07-07 (Q3 quarter-end ≈ 2026-06-30) | DevOps |
| [Dependency triage](REMEDIATION.md#82-dependency-triage--monthly) | Monthly (first Tue) | 2026-06-02 | DevOps + Backend (paired) |
| [Runbook game day](REMEDIATION.md#83-runbook-game-day--quarterly) | Quarterly | 2026-08-05 (first quarterly cycle) | On-call + verifier |
| [Restore drill](REMEDIATION.md#84-restore-drill--quarterly) | Quarterly | 2026-08-05 | DBA / DevOps |
| [A11Y audit](REMEDIATION.md#85-a11y-audit--quarterly) | Quarterly | 2026-08-05 | Frontend |
| [Secret rotation](REMEDIATION.md#86-secret-rotation--quarterly) | Quarterly (or on suspected compromise) | 2026-08-05 | DevOps |
| [Customer-side CVE digest](REMEDIATION.md#87-customer-side-cve-digest--quarterly) | Quarterly | (after first paying customer onboards) | Customer-success |
| [Legal review](REMEDIATION.md#88-legal-review--semestral) | Semestral (or on regulatory change) | 2026-11-07 | Counsel |
| [Quarterly four-doc review](REMEDIATION.md#89-quarterly-four-doc-review--quarterly) | Quarterly per H-22 | 2026-08-05 | Renan + designated peer |
| [Accepted-residual review](REMEDIATION.md#810-accepted-residual-review--quarterly) | Quarterly per A-8 | 2026-08-05 | Renan |

**Stacking observation.** Six cadences land on **2026-08-05** because that's the first quarter-boundary after the v1.0 baseline + W2 SLA. Plan for a one-day batch ("Q3 quarterly day") rather than ten separate context-switches. Move the dates around within the quarter if needed — the doctrine specifies frequency, not the day.

---

## 4. W2 + W3 horizon (deferred to REMEDIATION + UPLIFT)

The W2 (22 tickets) and W3 (12 tickets) are enumerated in [REMEDIATION §§ 6–7](REMEDIATION.md#6-w2--90-day-tickets) with effort calibration in [Appendix D](REMEDIATION.md#appendix-d--effort-and-burn-down-forecast). The strategic / polish layer (DORA targets, tech radar, abstraction ledger) is in [UPLIFT.md](UPLIFT.md), with a quarterly roadmap in [§ 7](UPLIFT.md#7-roadmap-next-12-months-quarterly).

This calendar does **not** restate those — restating creates drift. Read REMEDIATION + UPLIFT directly when planning sprints.

What this calendar adds: the *aggregation view*. § 5 below is the operational layer that REMEDIATION + UPLIFT do not provide.

---

## 5. This week — external W1 unblocks tracker

**Window: 2026-05-07 → 2026-06-06 (W1 SLA closure).** Five external dependencies stand between v1.0.1 (today) and a fully-Verified W1 closure. Each is a single-actor unblock.

| Unblock | Action | Actor | Estimated lead time | Dependent tickets |
|---|---|---|---|---|
| **Counsel — TIA review** | Email counsel with `legal/TIA-INFLUXDATA.md` v0.9; ask for sign-off line + `valid_through` date population. Two technical paragraphs in §§ 5.1, 5.4 need legal verification (DPF self-certification status, Article 5(1)(f) post-EO 14086) | Renan → counsel | 2–4 weeks (counsel calendar) | R-TIA-001 (F-CRIT-006) |
| **Counsel — DPA fill** | Email same counsel with `legal/DATA-PROCESSING-AGREEMENT.md` placeholder list (cloud provider names, ISO 27001 evidence URLs, version dates). Counsel reviews + signs | Renan → counsel | 1–3 weeks (often paired with TIA) | R-DPA-FILL-001 (F-CRIT-007-LEGAL) |
| **AWS apply** | Open AWS account if not yet; run `terraform/bootstrap-state.sh` (creates state-bucket + DDB lock); `terraform init -migrate-state`; `terraform apply` for the `db` + `secrets` modules | Renan | 1–2 days from account-open to apply (one-time + ongoing iteration) | R-TF-STATE-001 (F-CRIT-004), R-RDS-KMS-001 (F-HIGH-003), R-RDS-EGRESS-001 (F-HIGH-004), R-CDN-CERT-001 (W3) |
| **First CD run** | Push a tag or merge to `main` triggers `cd.yml`. First run will exercise the digest-pin + Cosign signing paths added in v1.0.1 | Renan | Single CI run (~10 min once triggered) | R-K8S-DIGEST-001 (F-HIGH-008), R-SUPPLY-001 W1 portion (F-HIGH-009) |
| **Production CA / cert-manager** | Decide PKI provider (Let's Encrypt + cert-manager? customer-provided certs? Sectigo?); install cert-manager into k8s cluster (or arrange equivalent for on-prem topology); replace dev CA cert/key in mosquitto + postgres | Renan, post-AWS-apply | 1–3 days once decided | R-MQTT-TLS-001 (dev → full), R-GRAFANA-PG-TLS-001 (dev → full) |

**Slack budget.** 30 days from publication to W1 SLA = 21 working days (Italy bank holidays 2026-05-01 already past, 2026-06-02 Republic Day = 1 lost day). Counsel's two paths consume ~3 weeks if started week 1. AWS apply can land week 2 or 3. Production CA waits on AWS apply.

**Reading the gates.** § 11 sign-off ledger in REMEDIATION.md is the canonical place to record "Verified" once each unblock fires. Update the ledger; do not sneak status changes into per-ticket fields without a sign-off entry (rule **R-7**).

---

## 6. Pre-first-paying-customer commercial gates

These are independent of W1 engineering closure but parallel to it. They block the first commercial cession; they do not block the engineering posture.

| Gate | Where it's tracked | Status |
|---|---|---|
| Half-price + signed-testimonial agreement (first customer rule) | `moneyplan.txt` + UPLIFT § 6.4 (Track Commercial readiness) | Pending first prospect |
| Italian translation pass on all customer-facing text | UPLIFT § 6.4 + R-LANDING-LEGAL-001 (W3) | Spot-check prior to engagement |
| Cookie banner + GDPR contact-form consent | R-COOKIE-BANNER-001 + R-LANDING-CONSENT-001 (W2) | Engineering-doable now without external blocker |
| `<html lang>` dynamic | R-i18n-HTML-LANG-001 (W2) | Engineering-doable now |
| First-customer 30-day check-in script | UPLIFT Appendix H.1 (already drafted) | Reference, not blocker |

The W2 landing-page tickets in this table can ship without waiting on counsel or AWS — useful candidate batch when no external blocker is the lead-time bottleneck.

---

## 7. Update cadence for this calendar

This calendar is **revised at each quarterly four-doc review** (HANDOFF doctrine **H-22**, REMEDIATION § 8.9). It is not a canonical document, so it does not block the four-doc set's quarterly verification cycle, but it is read alongside.

Mid-quarter updates allowed when:

- A wave SLA is at risk (move tickets, log sign-off in REMEDIATION § 11).
- A regulatory drop-dead changes (e.g., ACN releases NIS2 implementation timelines; CRA delegated acts publish new dates).
- A new external dependency surfaces (e.g., a Tier-2 customer contract introduces a new audit cadence).

---

**Made in Mozzecane (VR) — Veneto, Italy.**
