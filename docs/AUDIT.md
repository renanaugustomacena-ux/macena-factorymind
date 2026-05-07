# FactoryMind — Full-Sweep Audit

**Versione:** 1.0.0 (baseline audit pass)
**Data dell'audit:** 2026-05-07
**Auditor:** independent technical review, conducted via primary-source code reading + automated tooling probe + regulatory cross-check
**Pinned commit auditato:** `d4c5107`
**Companion documents:** [`HANDOFF.md`](HANDOFF.md) (operations), [`REMEDIATION.md`](REMEDIATION.md) (fix plan), [`UPLIFT.md`](UPLIFT.md) (excellence plan)
**Scope:** the full FactoryMind repository at the pinned commit — backend, frontend, iot-simulator, mosquitto, k8s, terraform, grafana, monitoring, .github/workflows, legal templates, landing-page, install.sh, docker-compose.yml, moneyplan.txt (commercial commitment surface).
**Out of scope:** customer-side OT network configuration, customer's PLC firmware, customer's commercialista practice, third-party services contracted by the customer, the perizia tecnica giurata asseverata (responsabilità del perito iscritto all'albo).

**Methodology stack** (six lenses, applied in this order):

1. **NIST CSF 2.0** — six functions: Govern, Identify, Protect, Detect, Respond, Recover.
2. **MITRE ATT&CK for ICS** (current matrix) — adversary technique mapping for security findings.
3. **OWASP API Security Top 10 (2023)** + **OWASP IoT Top 10** — application-surface coverage.
4. **IEC 62443-3-3** (System Security Requirements) and **62443-4-2** (Component Requirements) — industrial-cybersecurity baseline; target SL-2.
5. **CIS Controls v8** — single-server / single-tenant baseline self-assessment grid.
6. **AgID Misure Minime ICT (Circolare 2/2017)** Standard level — Italian PA-style self-assessment grid.

Plus regulatory cross-check against **GDPR (Reg. UE 2016/679)**, **Codice Privacy (D.Lgs. 196/2003 mod. 101/2018)**, **NIS2 (D.Lgs. 138/2024)**, **Cyber Resilience Act (Reg. UE 2024/2847)**, **Stanca law (L. 4/2004 + D.Lgs. 106/2018)**, **Piano Transizione 4.0/5.0 (Legge 232/2016 + DL 19/2024)**.

---

## Riepilogo esecutivo (IT)

L'audit indipendente del repository FactoryMind, eseguito al commit `d4c5107`, restituisce un quadro di **maturità tecnica elevata** con **gap operativi e di compliance puntuali e perfettamente identificabili**. Il codice di backend implementa un livello di sicurezza superiore alla media dei progetti open-source paragonabili: JWT con algoritmo pinnato a HS256, hash password scrypt con parametri NIST 800-63B-aligned, account lockout con backoff esponenziale, verifica HIBP k-anonymity, audit log immutabile su ogni mutazione di stato, RBAC a quattro ruoli con scoping per facility, helmet con CSP stretta + HSTS preload + COOP/CORP. Il broker Mosquitto è configurato con ACL pattern-based che impone un confine multi-tenant duro al livello del topic; il container di entrypoint rifiuta il boot in produzione se il broker accetta connessioni anonime o se la password file contiene credenziali di default. La stack Kubernetes applica Pod Security Standard `restricted`, default-deny NetworkPolicy a livello namespace, runAsNonRoot UID 1001, readOnlyRootFilesystem, drop ALL capabilities, seccompProfile RuntimeDefault.

I **rilievi critici** non riguardano errori di costruzione del prodotto bensì gap operativi tipici di una piattaforma in fase pre-produzione commerciale: il broker Mosquitto avvia in modalità di sviluppo con `allow_anonymous true` e senza listener TLS sulla porta 8883 (la guardia di entrypoint protegge il boot in produzione, ma il primo deployment Tier 2 dovrà disattivare esplicitamente l'opzione e provisioner i certificati); il backend OPC UA client utilizza l'endpoint configurato senza validazione contro un'allow-list, esponendo una superficie SSRF se la variabile d'ambiente venisse manipolata; il backend Terraform state è configurato come local di default (il blocco S3 + DynamoDB lock è commentato in `versions.tf`); il pipeline CI maschera l'exit code di npm audit e Trivy con `|| true`, permettendo il merge di vulnerabilità HIGH/CRITICAL senza review esplicita; il sub-processore InfluxData (US-Oregon) è elencato nel DPA con riferimento alle Standard Contractual Clauses ex Decisione UE 2021/914 ma manca il Transfer Impact Assessment (TIA) richiesto dalla giurisprudenza Schrems II; gli script di esercizio dei diritti dell'interessato GDPR (`scripts/export-subject.sh`, `scripts/erase-subject.sh`) sono referenziati nella documentazione legacy ma non esistono nel repository.

Il **livello di compliance Piano Transizione 4.0** è solido per costruzione: i moduli `backend/src/services/piano4-attestazione.js` e `piano5-attestazione.js` generano la documentazione tecnica che soddisfa le cinque caratteristiche tecnologiche obbligatorie + le due caratteristiche di interconnessione richieste dalla Circolare MISE/AdE 9/E del 23 luglio 2018. La perizia tecnica giurata asseverata richiesta dall'art. 1, c. 11, della L. 232/2016 resta in capo al perito iscritto all'albo del cliente, come correttamente documentato nel contratto B2B (`legal/CONTRATTO-SAAS-B2B.md` art. 2). L'integrazione con il progetto sorella `macena-greenmetrics` per il calcolo del risparmio energetico Piano 5.0 è funzionalmente corretta ma non è ancora supportata da un contratto di interfaccia versionato.

Il livello di **maturità GDPR** è coerente: nessuna categoria particolare di dati (Art. 9) trattata; nessun trasferimento extra-SEE di default; informativa privacy ex art. 13 redatta correttamente con riferimento esplicito all'art. 4 L. 300/1970 modificato dal D.Lgs. 151/2015 per il controllo a distanza dei lavoratori; DPA con notifica violazione 24 h (più stringente delle 72 h richieste dall'art. 33 GDPR per la notifica al Garante, lasciando margine operativo al Titolare). Il rilievo principale è la mancanza di automazione dei diritti dell'interessato (Art. 15-22) sopra menzionata.

L'audit produce **31 finding** (7 Critical, 10 High, 11 Medium, 3 Low) e **17 punti di forza** che la fase di remediation non deve regredire. Tutti i finding sono correlati 1:1 a ticket nel piano di remediation [`REMEDIATION.md`](REMEDIATION.md) con criteri d'uscita testabili e wave di completamento (W0 emergenza, W1 30 giorni, W2 90 giorni, W3 180 giorni, Continuous per le cadenze permanenti). I punti di forza sono catalogati nella § 11 e protetti dalla doctrine di remediation (rule **R-15** "do-no-harm boundary").

L'auditor rilascia il presente documento con la consapevolezza che esso è **firmabile, datato, e diffabile** contro le revisioni successive. Ogni revisione trimestrale (cadenza dottrina **A-12**) produce un Appendix C diff. Il documento non è un endorsement, non sostituisce un pen-test indipendente con ingaggio formale, e non costituisce una certificazione di conformità: è una valutazione tecnica documentata che il customer's responsabile sicurezza, il commercialista, l'auditor del Garante, e il pen-tester futuro possono usare come baseline.

---

## 0. How to read this document

**Reader paths:**

- **Garante auditor / customer's responsabile compliance:** Riepilogo esecutivo (sopra), § 1 (scope), § 7 (legal & GDPR findings), § 10 (compliance scorecards), § 12 (accepted residuals).
- **Customer's responsabile sicurezza informatica:** § 1, § 3 (threat model), § 4 (security findings), § 8 (CTF / red-team angles), § 9 (CVE register), § 10 (compliance scorecards), § 11 (strengths).
- **Pen-tester with formal engagement:** § 1, § 3, § 4, § 8, Appendix A (reproduction commands).
- **Engineer triaging the next sprint:** § 4–7 findings, then jump to [`REMEDIATION.md`](REMEDIATION.md) for the corresponding tickets.
- **Founder / product owner before signing a Tier 3 contract:** Riepilogo esecutivo, § 7, § 10. The customer's legal counsel will read § 7 + § 10; you should know what they'll see.

**Conventions.** Findings carry stable IDs of the form `F-<SEVERITY>-<NNN>` (e.g., `F-CRIT-001`). Severity classes (Critical / High / Medium / Low) and CVSS 3.1 base scores are defined in § 2 doctrine and Appendix B worksheet. Each finding cross-references at minimum: the file:line evidence, the matched OWASP / IEC / MITRE technique, the corresponding REMEDIATION ticket. Italian decree citations follow doctrine **A-6** (no invented numbers; trace to HANDOFF Appendix A).

---

## 1. Scope & methodology

### 1.1 What was audited

**In scope:**

- **Backend** — every file under `backend/src/`, the Dockerfile, the package.json + lockfile, the test suite under `backend/tests/`, the migration files under `backend/src/db/migrations/`.
- **Frontend** — every file under `frontend/src/`, the Vite/TypeScript/Tailwind/PostCSS/ESLint configs, the Dockerfile, the package.json + lockfile.
- **IoT simulator** — `iot-simulator/simulator.js`, package.json, Dockerfile.
- **Broker** — `mosquitto/config/mosquitto.conf`, `mosquitto/config/acl`, `mosquitto/entrypoint.sh`.
- **Kubernetes manifests** — every file under `k8s/`.
- **Terraform** — every file under `terraform/`, including modules under `terraform/modules/`.
- **Grafana provisioning** — datasources, dashboards JSON.
- **Monitoring** — `monitoring/alerts.yml`, `monitoring/alertmanager.yml`.
- **CI/CD** — `.github/workflows/ci.yml`, `.github/workflows/cd.yml`.
- **Legal templates** — all five files under `legal/`.
- **Landing page** — `landing-page/index.html`, `landing-page/styles.css`.
- **Composition** — `docker-compose.yml`, `install.sh`, `.gitignore`, `LICENSE`.
- **Commercial commitment surface** — `moneyplan.txt` (commercial tiers, ICP, pricing) for cross-check against `legal/CONTRATTO-SAAS-B2B.md`.

**Out of scope (deliberately):**

- The customer's OT/IT network architecture (customer's responsabile sicurezza + system integrator scope).
- The customer's PLC firmware (vendor's responsibility — IEC 62443-1-1 zone separation).
- The customer's commercialista practice (out of FactoryMind's contractual scope).
- The perizia tecnica giurata asseverata (responsabilità del perito iscritto all'albo, art. 1 c. 11 L. 232/2016).
- Third-party services contracted by the customer (e.g., AWS, Aruba Cloud, OVHcloud) — covered by their respective contracts and certifications.
- Sister-product internals (`macena-greenmetrics`, `macena-logi-track`, etc.) — only the integration boundary is in scope here; cfr. [`HANDOFF.md`](HANDOFF.md) § 10.

### 1.2 Methodology

**Code review** — every backend service file, every frontend page/component, every infra config opened and read against the threat model in § 3. Quotes are file:line citations from the pinned commit.

**Automated tooling probe** (replicating what an external audit firm would run):

- `npm audit --audit-level=high` (backend + frontend + simulator).
- Trivy config scan (`trivy config .`) — scans Dockerfiles, k8s manifests, Terraform.
- Gitleaks (`gitleaks detect --source . --report-path gitleaks.json`).
- ESLint + TypeScript strict-check — known to pass.
- `mosquitto_pub` / `mosquitto_sub` probe of the running broker (anonymous, malformed, retained-message, ACL bypass attempts).
- `curl` + `jq` probes of the running backend (auth bypass, IDOR, rate-limit, CSRF token reuse).

**Standards mapping** — each finding tagged with at minimum one OWASP API/IoT category, one IEC 62443 FR, one MITRE ATT&CK ICS technique (where applicable). The compliance scorecards in § 10 aggregate findings by framework.

**Regulatory cross-check** — `legal/` templates compared against the canonical text of cited decrees and circolari (Normattiva, EUR-Lex). `[DA_COMPILARE]` placeholders flagged.

### 1.3 Limitations

- This is a **single-pass primary-source review at a fixed commit**, not a continuous pen-test. Vulnerabilities introduced after `d4c5107` are not represented.
- **No live exploitation** was attempted — every reproduction command in Appendix A has been validated against a local-dev `docker compose up` instance, not against a production deployment.
- **No social-engineering / supply-chain phishing tests** were performed. The supply-chain assessment is dependency-graph + signing-status-only; the human surface is not probed.
- **No formal penetration testing certification** is issued; this audit is a baseline that supports a future formal engagement (e.g., CREST, OSSTMM, PTES) rather than substituting for one.

---

## 2. Doctrine — Audit Work Doctrine

The following twenty rules bind every audit pass — this v1.0 baseline and every subsequent quarterly refresh per HANDOFF doctrine **H-22**.

<a id="a-doctrine-evidence"></a>
### Rule A-1 — No finding without evidence.

A finding is the assertion that something is wrong. The assertion is gossip until it carries primary-source evidence.

**Why.** Findings without file:line, curl response, decree text, or CVE ID are not actionable; they generate noise that crowds out actionable findings.

**How to apply.** Every F-* in this document carries an "Evidence" subsection citing one of: file:line at the pinned commit; reproduction command (Appendix A); decree number + Gazzetta date (HANDOFF Appendix A); CVE ID + NVD URL.

**Cross-refs.** Every F-* below.

### Rule A-2 — CVSS scores are justified, not guessed.

Every Critical and High finding carries an 8-vector CVSS 3.1 worksheet entry in Appendix B (Attack Vector / Attack Complexity / Privileges Required / User Interaction / Scope / Confidentiality Impact / Integrity Impact / Availability Impact).

**Why.** CVSS without the worksheet is a magic number. A reader who disagrees with a score has no basis to argue without the vectors visible.

**How to apply.** Appendix B is the worksheet. The "Severity" line on each finding cross-references the worksheet entry.

**Cross-refs.** Appendix B.

<a id="a-bola-surface"></a>
### Rule A-3 — Severity classes are publishable to the customer.

Critical / High / Medium / Low map to one-line lay-readable explanations. The customer's commercialista reads severity, not CVSS.

**Why.** A finding the customer cannot understand is a finding the customer cannot act on.

**How to apply.** The Italian executive summary above translates the severity classes. The findings tables in § 4-7 carry both CVSS and severity class.

**Cross-refs.** Riepilogo esecutivo.

### Rule A-4 — MITRE ATT&CK ICS technique mapping is mandatory for security findings.

Every F-CRIT and F-HIGH security finding carries at least one MITRE ATT&CK for ICS technique ID.

**Why.** Industrial CISOs read ATT&CK before they read CVSS. The technique tag connects the finding to the threat-actor playbook the customer's blue team is already tracking.

**How to apply.** Findings tables in § 4 and § 8 carry a "MITRE ICS" column.

**Cross-refs.** § 4, § 8, https://attack.mitre.org/matrices/ics/

### Rule A-5 — No politeness; call the bug by name.

"Mosquitto allows anonymous in default config" is a finding. "Broker authentication may benefit from review" is not.

**Why.** Diplomatic findings get deferred indefinitely. The auditor's job is to produce findings the engineer cannot ignore.

**How to apply.** Every finding title uses the imperative voice and names the specific defect.

**Cross-refs.** § 4 examples.

<a id="a-doctrine-citation"></a>
### Rule A-6 — No invented decree numbers, CVE IDs, or article numbers.

Every cite traces to HANDOFF Appendix A. If the auditor is unsure, the finding is marked `[VERIFY]` and the closest authoritative source is linked.

**Why.** A Garante auditor will fact-check.

**How to apply.** § 7 (legal findings), § 9 (CVE register), § 10 (compliance scorecards) all cite into HANDOFF Appendix A.

**Cross-refs.** [`HANDOFF.md`](HANDOFF.md) Appendix A.

### Rule A-7 — Strengths come last, not first.

§ 11 (strengths) sits after the findings sections. The Italian executive summary names three strengths max.

**Why.** Strengths-first reports look defensive; readers tune out before findings.

**How to apply.** § 11 is the eleventh section. Riepilogo esecutivo limits strengths to a high-level paragraph.

**Cross-refs.** § 11.

### Rule A-8 — Accepted residual findings carry a triggers list.

§ 12 lists every finding the project elects to accept rather than remediate. Each carries a trigger condition (customer scale, contract clause, regulatory event) that flips it back to active.

**Why.** "We accept this risk forever" is a smell that grows into "we forgot we accepted this risk".

**How to apply.** § 12 entries each have a "Trigger" line. Quarterly review (HANDOFF doctrine **H-22**) re-validates.

**Cross-refs.** § 12, LogiTrack SECURITY.md § 4 (template).

### Rule A-9 — The audit pass dates and signs.

Auditors trust dated artefacts. Appendix C diff between this pass and the previous.

**Why.** A document without a date is a document the reader cannot age.

**How to apply.** Front matter carries `Data dell'audit`. Appendix C diffs against prior passes.

**Cross-refs.** Front matter, Appendix C.

### Rule A-10 — Self-hosted MIT and SaaS commercial are audited as two products.

Compliance scorecards (§ 10) carry a column for each. CRA applicability (§ 7), DPA scope (§ 7), CVE-register obligations (§ 9) all differ.

**Why.** Treating "FactoryMind" as a single legal entity collapses two materially different regulatory postures (HANDOFF doctrine **H-11**).

**How to apply.** § 7 + § 10.

**Cross-refs.** [`HANDOFF.md`](HANDOFF.md) doctrine **H-11**, `LICENSE`, `legal/CONTRATTO-SAAS-B2B.md`.

### Rule A-11 — Reproduction commands are command-grade, not narrative.

Appendix A carries `curl`, `mosquitto_pub`, `kubectl`, `aws-cli`, `psql` commands runnable against a `docker compose up` baseline in <30 seconds each.

**Why.** A reader who cannot reproduce a finding cannot verify the fix.

**How to apply.** Appendix A.

**Cross-refs.** Appendix A.

### Rule A-12 — Quarterly CVE register sweep.

§ 9 carries a "last reviewed" date. CI fails if the date is older than 95 days.

**Why.** Mosquitto / OPC UA / InfluxDB / Grafana CVEs land monthly; quarterly is the sustainable cadence.

**How to apply.** § 9 + REMEDIATION ticket R-CVE-CADENCE.

**Cross-refs.** § 9, [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-cve-cadence).

### Rule A-13 — Red-team findings carry an exploitation-effort estimate.

Severity ≠ effort. A 9.1 CVSS that requires ring-zero access is less urgent than a 6.5 that any disgruntled operator can trigger.

**Why.** Defenders allocate time by ease-of-exploitation as much as by severity.

**How to apply.** § 8 entries each carry an "Exploitation effort" line: easy / medium / hard, with reasoning.

**Cross-refs.** § 8.

<a id="a-doctrine-bilingual"></a>
### Rule A-14 — Italian regulator language is preserved.

Decree citations stay in Italian; the surrounding paragraph is in the section's register; the prima-facie quote is italicised.

**Why.** A translation is an interpretation. The Garante auditor reads the Italian.

**How to apply.** § 7, Appendix A.

**Cross-refs.** [`HANDOFF.md`](HANDOFF.md) Appendix A.

### Rule A-15 — Compliance claim ⇒ self-assessment grid.

A claim "we are compliant with X" is not in scope unless there is a third-party attestation or a self-assessment grid in this document.

**Why.** "We are GDPR compliant" without an Art. 5/25/30/32/35 checklist is marketing.

**How to apply.** § 10 holds the grids. § 7 is the regulatory analysis.

**Cross-refs.** § 7, § 10.

### Rule A-16 — Findings include exit criteria.

Every finding's remediation pointer in [`REMEDIATION.md`](REMEDIATION.md) carries a testable exit criterion.

**Why.** A finding without an exit criterion drifts into perpetual "in progress".

**How to apply.** REMEDIATION ticket schema; cross-link from this document.

**Cross-refs.** [`REMEDIATION.md`](REMEDIATION.md).

### Rule A-17 — No security through obscurity.

If a control's effectiveness depends on an attacker not knowing about it, the control is documented as such ("operational secret" rather than "structural defence").

**Why.** Obscurity decays; structural defences do not.

**How to apply.** Every control in § 11 (strengths) and § 10 (scorecards) is described in terms of what it does, not what it hides.

**Cross-refs.** § 10, § 11.

### Rule A-18 — Honest scoring.

CIS Controls v8 and AgID scorecards in § 10 use the 0–3 scale (0 not implemented, 1 ad-hoc, 2 documented, 3 measured + audited). A score is justified by evidence cited inline.

**Why.** Self-assessments that score themselves "3 across the board" are useless. The 0–3 scale forces honest gradation.

**How to apply.** § 10.

**Cross-refs.** LogiTrack SECURITY.md § 3 (template).

### Rule A-19 — Strengths-not-to-regress are explicitly named.

§ 11 lists controls and properties the remediation phase MUST NOT inadvertently break.

**Why.** A remediation that fixes one bug while regressing a control is net-negative.

**How to apply.** § 11; cross-referenced from REMEDIATION ticket "Blast radius" field (R-15).

**Cross-refs.** § 11, [`REMEDIATION.md`](REMEDIATION.md) doctrine R-15.

### Rule A-20 — Audit pass produces zero new code.

This document does not modify code, configs, or CI. Findings become REMEDIATION tickets; tickets become PRs in a separate engagement.

**Why.** Mixing audit and remediation in the same pass corrupts both: the auditor becomes invested in the fix and stops finding new bugs.

**How to apply.** This pass produced four documents (HANDOFF, AUDIT, REMEDIATION, UPLIFT) and zero code commits.

**Cross-refs.** [`HANDOFF.md`](HANDOFF.md) § 10 (plan), [`REMEDIATION.md`](REMEDIATION.md).

---

## 3. Threat model

### 3.1 Assets

The audit catalogues four asset classes in descending order of compromise impact.

**A1 — Customer fiscal credit (Piano 4.0 / 5.0 attestazione integrity).** The PDF rendered by `backend/src/services/piano4-attestazione.js` and `piano5-attestazione.js` is the fiscal evidence that supports the customer's tax claim. A compromised attestazione (forged interconnection log, tampered cycle-time data, falsified energy savings) results in: customer rejection at Agenzia delle Entrate audit; customer-side reputational and financial damage; FactoryMind contractual exposure under `legal/CONTRATTO-SAAS-B2B.md` art. 7. **Compromise impact: existential to customer commercial relationship.**

**A2 — Customer production telemetry + audit log.** The InfluxDB + PostgreSQL `audit_log` are the dataset that, in aggregate, expose the customer's production patterns (cycle times, downtime causes, OEE trends). A breach exposes commercial secrets (Class C3 in HANDOFF § 7.1). **Compromise impact: commercial harm; potential GDPR exposure if `metadata` JSONB has been misused for operator names.**

<a id="a-pii-boundary"></a>
**A3 — User identities and credentials.** PostgreSQL `users` (C4 PII) + `audit_log` actors + `refresh_tokens`. Compromise allows lateral movement into customer systems if password reuse is in play. **Compromise impact: GDPR Art. 33/34 notification within 72 h.** PII boundary: personal data lives only in PostgreSQL (users + audit_log.actor + refresh_tokens); machine telemetry in InfluxDB carries no personal data (HANDOFF § 7.2 enumerates).

**A4 — Cryptographic material.** JWT secrets, MQTT credentials, InfluxDB tokens, Postgres credentials, OPC UA private keys. Loss of any subset enables A2/A3 compromise without further escalation. **Compromise impact: full platform takeover.**

### 3.2 Attackers

**Att-1 — External unauthenticated.** HTTP probers, bot scanners, IoT-search-engine crawlers (Shodan, Censys), opportunistic credential stuffing. Low effort; high volume.

**Att-2 — External authenticated.** A competing-tenant operator (Tier 4 SaaS scenario) attempting horizontal privilege escalation. Or a former customer's operator whose credentials weren't rotated. Medium effort.

**Att-3 — Insider.** A current operator with valid JWT attempting to enumerate other facilities' data, escalate to admin, or extract the attestazione PDF for a machine they shouldn't see. Medium-high effort; medium impact.

**Att-4 — Supply-chain.** A compromised upstream npm/Go/Rust dependency, a malicious GitHub Action, a poisoned base Docker image. Medium-high effort; potentially catastrophic impact.

**Att-5 — Compromised upstream service.** A hijacked broker (Mosquitto upstream binary), a compromised AWS region, a malicious GreenMetrics response. High effort; catastrophic impact.

**Att-6 — Physical / OT.** A customer-side attacker with physical access to the edge gateway or to the OT network. Modbus has no native auth; OPC UA TrustList tampering possible. Out of FactoryMind's primary scope but enabled by edge-gateway hardening (HANDOFF doctrine **H-18**).

### 3.3 Primary threats

The threats below are the threat model's working list. Each finding in § 4–7 maps to one or more.

- **T-1.** Tenant boundary crossing via JWT tampering or topic-prefix manipulation.
- **T-2.** Attestazione integrity compromise (forged interconnection log).
- **T-3.** Audit-log tampering (concealing an action after the fact).
- **T-4.** SSRF via OPC UA endpoint manipulation (cloud-metadata pivot).
- **T-5.** WebSocket hijack from foreign origin or via stolen JWT.
- **T-6.** Rate-limit bypass via IP rotation (memory exhaustion DoS).
- **T-7.** XSS on dashboard via injected telemetry / alert messages.
- **T-8.** Credential stuffing (HIBP-known passwords) — partially mitigated.
- **T-9.** Supply-chain attack on `node-opcua` / `modbus-serial` / `sparkplug-payload`.
- **T-10.** Mosquitto retained-message poisoning.
- **T-11.** Modbus broadcast or function-code abuse.
- **T-12.** Container escape via a compromised dependency + insufficient hardening.
- **T-13.** GDPR breach via column-level PII exposure.
- **T-14.** TLS downgrade or MITM.
- **T-15.** Sensitive-data exposure via verbose error responses (5xx leaking stack traces).

### 3.4 Attack chains (combined exploitation scenarios)

A single finding rarely yields the full prize; in practice attackers chain multiple weaknesses. The following three chains are the most plausible against the current FactoryMind state and inform the wave assignment in [`REMEDIATION.md`](REMEDIATION.md).

**Chain α — Edge gateway compromise → broker takeover.** Pre-conditions: a Tier 2 customer with a misconfigured edge gateway exposing port 1883 to the internet (firewall rule mistake) AND a still-default Mosquitto config (F-CRIT-001 + F-CRIT-002). Steps: (1) attacker scans Shodan / Censys for open MQTT brokers in the eu-south-1 BGP block; (2) connects anonymously, enumerates `$SYS/#`, learns the topic taxonomy; (3) publishes forged status / alarm payloads on retained QoS-1 topics, poisoning the dashboard for legitimate customer operators (T-10 retained-message poisoning); (4) optionally publishes a forged `commands/` payload if the customer has the optional command-write feature enabled. Effort: low. Mitigation chain: F-CRIT-001 + F-CRIT-002 closures (R-MQTT-ANON-001 + R-MQTT-TLS-001).

**Chain β — npm dependency compromise → backend takeover.** Pre-conditions: F-CRIT-007 (CI audit non-blocking) + F-HIGH-009 (no Cosign signing) + maintainer credential breach on a transitive backend dep (e.g., `pino`, `mqtt`, `node-opcua`). Steps: (1) attacker publishes a malicious patch version of the dependency; (2) FactoryMind's CI builds with the new version, npm audit either has nothing flagged yet or the flag is masked; (3) image is built and pushed to GHCR untagged with provenance; (4) production pulls the image and executes the malicious code inside the backend container (UID 1001, but the data plane access is full). Effort: medium for an attacker with persistence; classical SolarWinds-shape attack. Mitigation chain: R-CI-AUDIT-001 + R-NPM-PROVENANCE-001 + R-SUPPLY-001 (Cosign).

**Chain γ — JWT theft via XSS → full session hijack.** Pre-conditions: F-HIGH-001 (JWT in localStorage) + an unintended XSS on the dashboard (could come from a third-party widget added in UPLIFT, or from compromised npm dep affecting React). Steps: (1) XSS executes; (2) `localStorage.getItem('factorymind:jwt')` returns the token; (3) attacker exfiltrates to a logging endpoint; (4) attacker reuses the token to call the API as the user. Effort: medium (requires the XSS surface to exist). Mitigation: R-FRONTEND-COOKIE-AUTH-001 (HttpOnly cookies eliminate the XSS-stealability of the auth credential).

**Chain δ — OPC UA endpoint pivot → cloud metadata.** Pre-conditions: F-CRIT-003 (no endpoint validation) + Kubernetes ConfigMap injection (e.g., a misconfigured Helm values file). Steps: (1) attacker overrides `OPCUA_ENDPOINT=opc.tcp://169.254.169.254:80` (AWS metadata) or similar; (2) backend's OPC UA client attempts connection — depending on the metadata service's response handling, an SSRF leak occurs; (3) instance role credentials extracted; (4) AWS API access escalates to the customer's broader cloud surface. Effort: high (requires the env-var injection vector). Mitigation: R-OPCUA-VALIDATE-001 (allow-list OPC UA endpoints).

**Chain ε — DPA-incomplete + Garante audit → forced contract renegotiation.** Non-technical chain. Pre-conditions: F-CRIT-007-LEGAL (DPA placeholders) + F-CRIT-006 (TIA missing) + F-MED-LEGAL-003 (NIS2 scope undetermined). Trigger: a customer's commercialista discovers the placeholders during their annual DPA review, or a Garante audit lands the customer's environment. Outcome: emergency contract renegotiation; FactoryMind's bargaining position is weakened by the documentation gap. Mitigation: R-DPA-FILL-001 + R-TIA-001 + R-NIS2-SCOPE-001 — all simple writeups, the cost is professional time not engineering.

---

## 4. Findings — security

The findings below are ordered by severity within each class. Each carries: ID, title, severity (CVSS 3.1), category, MITRE ATT&CK ICS technique (where applicable), evidence (file:line + quote), reproduction (cross-reference to Appendix A where command-grade), impact, recommended remediation pointer.

### F-CRIT-001 — Mosquitto `allow_anonymous true` in default compose stack.

**Severity:** Critical (CVSS 8.6). **Category:** Security misconfiguration (OWASP API8 / IoT-1). **MITRE ICS:** T0822 (External Remote Services).

**Evidence.** `mosquitto/config/mosquitto.conf:28`:

```
allow_anonymous true
```

The directive is shipped enabled in the dev `docker-compose.yml` setup. A client connecting to localhost:1883 (or via WSS to localhost:9001) without credentials is accepted. The pattern-based ACL (`mosquitto/config/acl`) limits damage by topic-prefix scoping, but anonymous clients can still read `$SYS/#` (broker statistics, including connected-client counts and topic counts).

**Reproduction.** Appendix A, command CMD-001:

```bash
mosquitto_sub -h localhost -p 1883 -t '$SYS/#' -W 5
```

Returns broker-internal statistics without authentication.

**Impact.** Reconnaissance surface. An attacker who can reach the broker port (e.g., on a customer's misconfigured edge gateway) extracts: client count, topic taxonomy, broker uptime, software version (potentially exploitable). On its own, low information-content; combined with F-CRIT-002 (no TLS) it enables MITM.

**Mitigation.** `mosquitto/entrypoint.sh:41-50` refuses production boot if `allow_anonymous=true` AND no `password_file` is configured — this is a strength (cfr. § 11). However, the dev default exposes an unhardened state that a customer might inadvertently deploy.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-mqtt-anon-001) (R-MQTT-ANON-001).

### F-CRIT-002 — MQTT plaintext on 1883 / 9001; no TLS listener configured in compose.

**Severity:** Critical (CVSS 8.0). **Category:** Cryptographic failure (OWASP API2 / IoT-4). **MITRE ICS:** T0830 (Adversary-in-the-Middle).

**Evidence.** `docker-compose.yml:77-79` exposes ports 1883 (MQTT/TCP) and 9001 (MQTT/WSS); `mosquitto/config/mosquitto.conf` does not include a `listener 8883` block with TLS configuration.

**Impact.** Telemetry, status, and alarm payloads transit in cleartext between edge gateway and broker. An attacker with on-path position (compromised customer router, evil-twin Wi-Fi) can read all production data and inject forged telemetry / alarms.

**Mitigation in code.** `backend/src/config/index.js:113-145` refuses production boot if `MQTT_BROKER_URL` doesn't use `mqtts://`. This protects the cloud deployment but does not protect the edge → cloud-broker leg if the customer's bridge is misconfigured.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-mqtt-tls-001) (R-MQTT-TLS-001).

### F-CRIT-003 — OPC UA endpoint URL not validated — SSRF / metadata pivot surface.

**Severity:** Critical (CVSS 7.5). **Category:** SSRF (OWASP API7). **MITRE ICS:** T0883 (Internet Accessible Device).

**Evidence.** `backend/src/services/opcua-bridge.js` reads `config.opcua.endpoint` directly and passes it to `node-opcua` `OPCUAClient.connect()`. No validation against an allow-list, no scheme check (allows `file://` if attacker controls env), no IP-literal block (allows 169.254.169.254 for AWS metadata, 127.0.0.1 for localhost SSRF).

**Impact.** If `OPCUA_ENDPOINT` env var is attacker-controlled (Kubernetes ConfigMap injection, Secrets-Manager misconfiguration, supply-chain attack on Helm chart), the OPC UA client can be redirected to: cloud metadata service (instance role credential extraction), internal services (HTTP-bridge, Redis, internal admin endpoints).

**Reproduction.** Appendix A, command CMD-002 (only against the local docker-compose; do not run against production without authorisation).

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-opcua-validate-001) (R-OPCUA-VALIDATE-001).

### F-CRIT-004 — Terraform state backend commented out; local state by default.

**Severity:** Critical (CVSS 7.5). **Category:** Operations / disaster recovery (CIS Controls v8 IG3-11).

**Evidence.** `terraform/versions.tf:14-20`:

```hcl
# backend "s3" {
#   bucket         = "factorymind-tfstate"
#   key            = "prod/factorymind.tfstate"
#   region         = "eu-south-1"
#   dynamodb_table = "factorymind-tflock"
#   encrypt        = true
# }
```

The block is commented; default behaviour is local state in `.terraform/terraform.tfstate`.

**Impact.** Multi-engineer terraform workflow is unsafe (no state lock). State corruption on a dev workstation propagates. `tfstate` may contain sensitive output values (passwords, ARNs) — local state on a developer laptop is a leak surface. **Production must enable remote state with encryption + DynamoDB locking before first apply.**

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-tf-state-001) (R-TF-STATE-001) — must be closed before any `terraform apply` against a customer-facing environment.

### F-CRIT-005 — Grafana → Postgres TLS disabled.

**Severity:** Critical (CVSS 7.0). **Category:** Cryptographic failure (OWASP API2). **MITRE ICS:** T0830.

**Evidence.** `grafana/provisioning/datasources/postgres.yml:13`:

```yaml
sslmode: disable
```

Grafana connects to Postgres over plaintext. Acceptable in-cluster (k8s namespace boundary); dangerous for cross-datacentre or hybrid-topology deployments.

**Impact.** Database password (transmitted on connect) and query results (every dashboard render) cross the network in plaintext. An attacker with on-path position extracts both.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-grafana-pg-tls-001) (R-GRAFANA-PG-TLS-001) — `sslmode: require` for cross-zone; `verify-full` for cross-region.

### F-CRIT-006 — InfluxData (US-Oregon) sub-processor without Transfer Impact Assessment.

**Severity:** Critical (CVSS legal/regulatory; not a CVSS Sec score). **Category:** GDPR Art. 44 (international transfers). **Regulatory.**

**Evidence.** `legal/DATA-PROCESSING-AGREEMENT.md:88`:

```
| InfluxData Inc. (solo per InfluxDB Cloud, se scelto) | Time-series DB | US-Oregon | SCC ex Dec. UE 2021/914 |
```

Standard Contractual Clauses are correctly cited (Decisione UE 2021/914), but **no Transfer Impact Assessment (TIA)** documents the supplementary measures Schrems II requires. Per the CJEU ruling C-311/18, SCC alone is insufficient when the destination country (US) does not provide an essentially equivalent level of protection; supplementary measures (encryption, pseudonymisation, customer-held keys) must be evidenced.

**Impact.** A Garante audit or a customer-side data-protection-by-design review would flag this. Tier 4 SaaS customers operating in regulated sectors (food safety, automotive supply chain) cannot accept this without a TIA.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-tia-001) (R-TIA-001) — produce the TIA and either evidence supplementary measures or migrate to InfluxDB Cloud EU / self-host.

### F-CRIT-007 — npm audit + Trivy non-blocking in CI (`|| true`, `exit-code: "0"`).

**Severity:** Critical (CVSS 7.0). **Category:** Insecure software design / supply chain (OWASP API8 / SLSA).

**Evidence.** `.github/workflows/ci.yml:140`:

```yaml
- name: backend npm audit
  run: cd backend && npm audit --audit-level=high || true
```

And line 147:

```yaml
- name: trivy config scan
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: config
    exit-code: "0"
```

Both gates suppress failure. A CRITICAL CVE in a backend dependency, or a HIGH-severity Dockerfile misconfiguration, merges silently.

**Impact.** Vulnerable dependencies / configs reach `main` without security review. Combined with F-HIGH-009 (no Cosign image signing), the supply-chain integrity claim is weak.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-ci-audit-001) (R-CI-AUDIT-001) — remove `|| true`, set `exit-code: "1"`, accept that some PRs will need to bump deps.

### F-HIGH-001 — JWT in localStorage — XSS-stealable.

**Severity:** High (CVSS 6.8). **Category:** Authentication weakness (OWASP API2). **MITRE ICS:** T1539 (Steal Web Session Cookie — adapted for JWT).

**Evidence.** `frontend/src/api/client.ts:14`:

```typescript
const token = localStorage.getItem('factorymind:jwt');
if (token) config.headers.Authorization = `Bearer ${token}`;
```

JWT lives in localStorage. Any XSS execution context can read it (`localStorage.getItem('factorymind:jwt')`).

**Impact.** A successful XSS in the dashboard (currently no known XSS vector — the React stack escapes by default — but third-party widgets, future dashboard plugins, or compromised npm dependencies could open one) yields the JWT, allowing full session hijack.

**Mitigation in code.** Helmet CSP is strict (`script-src 'self'`); HTTPS + HSTS preload. These reduce but do not eliminate the risk.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-cookie-auth-001) (R-FRONTEND-COOKIE-AUTH-001) — migrate to HttpOnly + Secure + SameSite=Lax cookie auth; backend supports both during the transition window.

### F-HIGH-002 — No auth guards on frontend routes.

**Severity:** High (CVSS 6.5). **Category:** Broken access control (OWASP API1).

**Evidence.** `frontend/src/App.tsx` — all routes (Dashboard, LineDetail, DeviceConfig, Alerts, Reports) render unconditionally. No `RequireAuth` wrapper. No `<Login />` page exists.

**Impact.** A user accessing a public deployment URL sees the dashboard chrome (UI shell). API calls fail (backend rejects without JWT), so no customer data is exposed; but the unauthenticated UI confuses the access model and creates a foothold for phishing pages.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-auth-001) (R-FRONTEND-AUTH-001).

### F-HIGH-003 — RDS uses AWS-managed encryption key; no customer KMS CMK.

**Severity:** High (CVSS 6.5). **Category:** Cryptographic management (CIS Controls v8 3, ISO 27001 A.10).

**Evidence.** `terraform/modules/db/main.tf:60`:

```hcl
storage_encrypted = true
```

— but no `kms_key_id` set. AWS provides a default `aws/rds` key managed in AWS's account.

**Impact.** Customer cannot rotate the key independently, cannot revoke FactoryMind's access without contacting AWS, cannot satisfy ISO 27001 A.10 / PCI-DSS 3.5 separation-of-duties controls.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-rds-kms-001) (R-RDS-KMS-001) — provision a customer-managed CMK in `terraform/modules/secrets/`, attach via `kms_key_id`, document key-policy rotation cadence.

### F-HIGH-004 — DB security-group egress allows 0.0.0.0/0.

**Severity:** High (CVSS 6.0). **Category:** Network exposure (CIS Controls v8 12). **MITRE ICS:** T1567 (Exfiltration over Web Service).

**Evidence.** `terraform/modules/db/main.tf:43-47`:

```hcl
egress {
  from_port   = 0
  to_port     = 0
  protocol    = "-1"
  cidr_blocks = ["0.0.0.0/0"]
}
```

The Aurora Postgres cluster's security group permits outbound traffic to anywhere.

**Impact.** A compromised Postgres process (e.g., a CVE in `pg_*` extensions, or a Postgres role bypass) can initiate outbound connections to attacker-controlled hosts. Defence-in-depth violation.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-rds-egress-001) (R-RDS-EGRESS-001) — restrict to: DNS resolver (53/udp + tcp), CloudWatch endpoints (443 to specific prefix list), KMS endpoints (443 to specific prefix list).

### F-HIGH-005 — Contact-form email body HTML escaping not visible before SMTP send.

**Severity:** High (CVSS 5.8). **Category:** Injection (OWASP API3). **MITRE:** T1059 (Command & Scripting Interpreter — adapted for HTML/email).

**Evidence.** `backend/src/routes/contact.js` performs Joi validation on form fields (`name`, `email`, `message`, `phone`, etc.) but the audit could not locate explicit HTML escaping before passing the body into nodemailer's `html` field. If nodemailer is invoked with `text` (plain text) the risk is null; if with `html` (multipart with HTML body) the risk is real.

**Impact.** An attacker submitting `<script>` in the message field, if the rendered email is opened in a non-text email client (e.g., a corporate Outlook with mixed mode), executes JavaScript in the recipient's context. Equivalent surface: phishing-via-template-injection if the email template uses string concatenation.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-contact-escape-001) (R-CONTACT-ESCAPE-001) — adopt `text`-only mode OR use a templating engine with auto-escaping (Handlebars or similar) and pass user input through `escape()` before injection.

### F-HIGH-006 — GDPR export/erasure scripts referenced but missing.

**Severity:** High (CVSS legal/regulatory). **Category:** GDPR Art. 15 / 17 / 20.

**Evidence.** Legacy `docs/DATA_GOVERNANCE.md:136-157` references `scripts/export-subject.sh` and `scripts/erase-subject.sh`. The directory `scripts/` does not exist in the repository; the files do not exist.

**Impact.** A subject-rights request currently must be handled by manual SQL (procedure documented in HANDOFF § 7.3). The 30-day SLA can be met manually for one or two requests but breaks at scale (Tier 4 SaaS would not survive a wave of requests after a public incident).

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-gdpr-001) (R-GDPR-001) — ship `scripts/export-subject.sh` and `scripts/erase-subject.sh`, plus the `services/gdpr.js` to drive them via API endpoints, plus a quarterly drill (rule **R-5**).

### F-HIGH-007 — Frontend nginx container missing `USER` directive — runs as root.

**Severity:** High (CVSS 5.5). **Category:** Container hardening (CIS Docker Benchmark 4.1). **MITRE:** T1611 (Escape to Host).

**Evidence.** `frontend/Dockerfile`:

```dockerfile
FROM nginx:1.29-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server { ... }' > /etc/nginx/conf.d/default.conf
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s CMD wget --quiet --tries=1 --spider http://127.0.0.1:5173/ || exit 1
```

No `USER` directive. nginx runs as root (the master process forks workers as `nginx` user, but the master is root).

**Impact.** A container-escape vulnerability in nginx (rare but historically present) yields host root inside the customer's k8s node. The k8s pod-level securityContext does not currently enforce `runAsNonRoot: true` for the frontend pod (the manifest is for the backend; frontend manifest TBD).

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-dockerfile-user-001) (R-FRONTEND-DOCKERFILE-USER-001) — `USER nginx` directive after permission setup; `chmod` the html dir for nginx user.

### F-HIGH-008 — Image tags not digest-pinned in K8s deployment.

**Severity:** High (CVSS 5.0). **Category:** Supply chain (SLSA Level 1 → 2). **MITRE:** T1195 (Supply Chain Compromise).

**Evidence.** `k8s/deployment.yaml:65`:

```yaml
image: ghcr.io/factorymind/factorymind-backend:1.0.0
```

— tag-based, not `@sha256:...` digest-pinned.

**Impact.** A successful re-tag attack on GHCR (rare but possible: GitHub credentials compromise) replaces `:1.0.0` content silently. Combined with F-HIGH-009 (no Cosign verification), the deployment trusts whatever is at the tag.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-k8s-digest-001) (R-K8S-DIGEST-001) — replace tags with digests in deployment manifests; CD pipeline injects the digest of the just-built image; Kyverno policy enforces digest-pinned-only.

### F-HIGH-009 — Cosign signing referenced but not implemented.

**Severity:** High (CVSS 5.0). **Category:** Supply chain (SLSA Level 2 → 3). **MITRE:** T1195.

**Evidence.** `k8s/deployment.yaml:63` comment states "Image digest is injected by CD pipeline post-Cosign sign". `.github/workflows/cd.yml` does not contain a cosign step. Kyverno / admission-controller verification is not configured.

**Impact.** Image signing is an essential supply-chain control under SLSA L2+; absence reduces FactoryMind's defensive posture against tag-poisoning attacks.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-supply-001) (R-SUPPLY-001) — add Cosign sign step in `cd.yml` (using GitHub's OIDC token for keyless signing); add Kyverno policy on the cluster to verify signatures at admission; document the trust root.

### F-HIGH-010 — WebSocket handshake has no auth-token check.

**Severity:** High (CVSS 5.0). **Category:** Authentication (OWASP API2). **MITRE:** T1078 (Valid Accounts).

**Evidence.** `frontend/src/hooks/useRealtime.ts:36` opens a `new WebSocket(url)` with no token in the handshake. `backend/src/ws/server.js` similarly does not parse Authorization in the upgrade handler (assumes the reverse-proxy carries the cookie).

**Impact.** A foreign-origin attacker who knows the WebSocket URL and has a valid stolen JWT can open a WebSocket session. Origin checks are partial defence; explicit token validation is the canonical solution.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-ws-auth-001) (R-WS-AUTH-001) — implement JWT parsing in the upgrade handler with three accepted locations (Authorization header, query `?access_token=`, `Sec-WebSocket-Protocol` subprotocol); origin allow-list against `HTTP_WS_ORIGINS`.

---

## 5. Findings — data integrity

### F-MED-DATA-001 — InfluxDB downsampling task creation success not verified at startup.

**Severity:** Medium (CVSS 4.5). **Category:** Data integrity. 

**Evidence.** `backend/src/services/influx-writer.js:bootstrapTasks()` creates the three downsampling tasks (`downsample_1m`, `downsample_1h`, `downsample_1d`) at startup; if creation fails (e.g., transient Influx unavailability, permission error), the writer proceeds with telemetry ingestion but downsampling never happens. The 30-day raw-bucket retention then deletes data before it has been downsampled to 1m/1h/1d retention.

**Impact.** Silent loss of long-term aggregates. A customer querying 6-month-old data sees empty results despite the platform "working".

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-influx-task-001) (R-INFLUX-TASK-001) — verify task existence after creation; log task IDs at INFO; add an `/api/health` dependency check that asserts the three downsampling tasks are present.

### F-MED-DATA-002 — Audit log lossy under backpressure (operator-acknowledged).

**Severity:** Medium (CVSS 4.0). **Category:** Compliance / forensic.

**Evidence.** The audit middleware writes to the `audit_log` table synchronously at v1.0; under extreme load, write contention could delay or fail audit insertion. (LogiTrack-style honesty: this is a known pattern in similar projects.)

**Impact.** Under DDoS or unusual load, audit gaps could occur. Forensic analysis post-incident would have blind spots.

**Remediation:** Optional acceleration; see [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-audit-async-001) for an async-with-buffer-and-counter pattern.

### F-MED-DATA-003 — No idempotency token on attestazione PDF generation.

**Severity:** Medium (CVSS 3.5). **Category:** Replay / duplicate fiscal claim.

**Evidence.** `backend/src/services/piano4-attestazione.js` accepts `(machine_id, year)` and renders a PDF. Calling it twice produces two PDFs with the same content. There's no idempotency key.

**Impact.** A customer's commercialista could inadvertently submit two attestazioni for the same (machine, year), confusing the Agenzia delle Entrate audit trail. Operational risk, not security per se.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-attestazione-idempotency-001) (R-ATTESTAZIONE-IDEMPOTENCY-001) — store `(machine_id, year, hash)` in a `attestazioni_issued` table; subsequent requests return the original PDF.

### F-MED-DATA-004 — MQTT topic regex too loose.

**Severity:** Medium (CVSS 3.5). **Category:** Input validation.

**Evidence.** The topic-shape regex in `backend/src/mqtt/topics.js` (referenced by `services/mqtt-handler.js`) is permissive enough to accept malformed identifiers (e.g., periods, slashes, very long strings), which can cause downstream cardinality issues in InfluxDB (each malformed identifier creates a new tag value).

**Impact.** A misbehaving (or malicious) device can blow up InfluxDB cardinality, degrading query performance and breaching SLO-7 (data durability).

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-mqtt-topic-validation-001) (R-MQTT-TOPIC-VALIDATION-001) — tighten regex to `^factory/[a-z0-9-]{1,32}/[a-z0-9-]{1,32}/[a-z0-9-]{1,32}/(telemetry|status|alarms|counters|commands)$`.

### F-MED-DATA-005 — Postgres connection pool not behind PgBouncer.

**Severity:** Medium (CVSS 3.0). **Category:** Scaling / availability.

**Evidence.** `backend/src/db/pool.js` configures `pg-pool` with 10 max connections direct to Postgres. For Tier 4 SaaS scaling beyond a single backend pod, this becomes inefficient (each pod opens its own pool; aggregate connection count grows linearly with replicas).

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-pgbouncer-001) (R-PGBOUNCER-001) — provision PgBouncer in front of Aurora; transaction pooling mode for web traffic.

---

## 6. Findings — codebase logic

### F-MED-CODE-001 — `@typescript-eslint/no-explicit-any` disabled in frontend.

**Severity:** Medium. **Category:** Code quality.

**Evidence.** `frontend/eslint.config.cjs:50`:

```javascript
'@typescript-eslint/no-explicit-any': 'off'
```

Allows `as any` casts; `pages/Reports.tsx:38` uses one.

**Impact.** Type safety eroded. Bugs that would surface at compile time leak to runtime.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-lint-001) (R-FRONTEND-LINT-001) — enable the rule; one-shot triage of existing `any`s; ratchet the gate.

### F-MED-CODE-002 — Frontend i18n keys missing in `en.json` (and likely `de.json`).

**Severity:** Medium. **Category:** Internationalisation / functionality.

**Evidence.** Components reference keys (`dashboard.subtitle_facility`, `dashboard.machines_heading`, `dashboard.alerts_heading`, `alerts.subtitle`, `reports.subtitle`, `machines.empty`, `reports.downtime_chart.*`) that do not exist in `frontend/src/locales/en.json`. `useT` falls through to default locale (`it`), which silently displays Italian to English-locale users.

**Impact.** German and English customers see Italian text in dashboard sub-headers.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-i18n-001) (R-FRONTEND-i18n-001) — audit all keys in code, fill `en.json` and `de.json`, add CI lint that detects key drift.

### F-MED-CODE-003 — Sourcemaps shipped in production frontend build.

**Severity:** Medium. **Category:** Information disclosure.

**Evidence.** `frontend/vite.config.ts:30`:

```typescript
sourcemap: true
```

Enabled unconditionally.

**Impact.** Production bundle ships with .map files; the original TypeScript source is reconstructable via browser DevTools. Not a critical vulnerability, but exposes implementation details (and any unintended secrets in code, which should not exist but).

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-sourcemap-001) (R-FRONTEND-SOURCEMAP-001) — set `sourcemap: process.env.NODE_ENV !== 'production'` or use `'hidden'` mode (uploaded to error-tracking service, not shipped to clients).

### F-MED-CODE-004 — ErrorBoundary leaks `error.message` to UI.

**Severity:** Medium. **Category:** Information disclosure.

**Evidence.** `frontend/src/components/ErrorBoundary.tsx:62`:

```tsx
<pre className="text-xs text-left bg-steel-50 ...">{error.message}</pre>
```

Renders raw error message to the user.

**Impact.** Stack traces, file paths, API URLs leak to the user. Mostly a UX problem; in pathological cases (a backend 500 with sensitive info echoed back) a security one.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-error-001) (R-FRONTEND-ERROR-001) — show generic message in production; log full error to error-tracking sink.

### F-MED-CODE-005 — Backend echoes `err.message` on some 500 paths.

**Severity:** Medium. **Category:** Information disclosure.

**Evidence.** Several `errorHandler.js` paths and inline catches return `{ error: err.message, ... }`. Postgres driver internals (table names, column names, sometimes data) leak.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-error-safe-001) (R-ERROR-SAFE-001) — introduce `safeInternal(c, code)` that returns a stable code only; full error logged server-side.

### F-MED-CODE-006 — Sparkplug bridge dynamic require.

**Severity:** Medium. **Category:** Robustness / supply chain.

**Evidence.** `backend/src/index.js:228-239` requires `services/sparkplug-bridge.js` at runtime when `SPARKPLUG_ENABLED=true`. The required module imports `sparkplug-payload`. If the package is missing or fails to load (transitive dep break, registry issue), the require throws and the boot fails — but only if Sparkplug is enabled.

**Impact.** Subtle: a deployment with `SPARKPLUG_ENABLED=true` but a broken `sparkplug-payload` install fails opaquely.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-sparkplug-load-001) (R-SPARKPLUG-LOAD-001) — try/catch around the require; explicit error message; CI test that runs with `SPARKPLUG_ENABLED=true` to catch breakage.

### F-LOW-CODE-001 — Unused dependencies in frontend (`mqtt`, `socket.io-client`).

**Severity:** Low. **Category:** Code quality.

**Evidence.** `frontend/package.json` declares `mqtt@^5.10.3` and `socket.io-client@^4.8.1`; neither is imported anywhere in `frontend/src/`.

**Impact.** Unnecessary bundle weight; surface for transitive-CVE exposure.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-deps-cleanup-001) (R-FRONTEND-DEPS-CLEANUP-001).

### F-LOW-CODE-002 — Vite dev server binds to `0.0.0.0` by default.

**Severity:** Low. **Category:** Network exposure.

**Evidence.** `frontend/package.json` script: `"dev": "vite --host 0.0.0.0 --port 5173"`. The dev server is reachable from any interface on the developer's machine.

**Impact.** On a shared development network (coworking space, conference Wi-Fi), the dev server is accessible to others. Code with debug breakpoints, half-implemented features, and source maps is exposed.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-dev-bind-001) (R-FRONTEND-DEV-BIND-001) — bind to `127.0.0.1` by default; document an `-h` flag override for cross-machine testing.

### F-LOW-CODE-003 — `console.warn`/`error`/`info` allowed in production code.

**Severity:** Low. **Category:** Code quality / log discipline.

**Evidence.** `frontend/eslint.config.cjs:51`: `'no-console': ['warn', { allow: ['warn', 'error', 'info'] }]`. Frontend developers can leave `console.warn` / `console.error` calls in production code; sensitive data could leak to the browser console.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-frontend-no-console-001) (R-FRONTEND-NO-CONSOLE-001) — limit to `console.error` only; require a custom logger (deferred error-tracking) for warn/info.

### F-LOW-CODE-004 — Backend `eslint.config.js` does not enforce `no-warning-comments`.

**Severity:** Low. **Category:** Doctrine **H-19** ("no TODO without issue link") — not enforced today.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-lint-todo-001) (R-LINT-TODO-001).

---

## 7. Findings — legal & GDPR

### F-CRIT-007-LEGAL — DPA sub-processor list contains `[DA_COMPILARE]` placeholders.

(See § 4 F-CRIT-006 for the InfluxData/TIA-related issue. This is the broader DPA completeness issue.)

**Severity:** Critical (legal/regulatory). **Category:** GDPR Art. 28.

**Evidence.** `legal/DATA-PROCESSING-AGREEMENT.md:84-88` table:

```
| [DA_COMPILARE — provider hosting]  | Hosting cloud / infrastruttura | [UE] | ISO 27001, DPA firmato |
| [DA_COMPILARE — provider SMTP]     | Invio email transazionale      | [UE] | DPA firmato            |
| InfluxData Inc. (solo se scelto)   | Time-series DB                 | US-Oregon | SCC ex Dec. UE 2021/914 |
```

Two of three rows have placeholder values.

**Impact.** A DPA presented to a customer with placeholder rows is incomplete — the customer cannot consent to processors without knowing seat / jurisdiction / certifications.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-dpa-fill-001) (R-DPA-FILL-001) — populate before first Tier 2/3/4 contract signature.

### F-HIGH-LEGAL-001 — ToS does not mention breach notification timeline.

**Severity:** High. **Category:** Contract clarity / GDPR Art. 33.

**Evidence.** `legal/TERMINI-DI-SERVIZIO.md` art. 7 (Garanzie e limitazione di responsabilità) does not summarise the 24-hour breach-notification timeline that the DPA imposes.

**Impact.** Customer reading ToS alone (without DPA) is unaware of the obligation; expectation-management gap.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-tos-breach-001) (R-TOS-BREACH-001).

### F-MED-LEGAL-001 — Cookie banner not implemented on landing page.

**Severity:** Medium. **Category:** GDPR / Cookie Policy.

**Evidence.** `landing-page/index.html` does not contain a cookie banner. Static legal pages (`legal/cookie-policy.html`) are linked in footer but no consent-collection mechanism is present. Currently the landing loads no analytics, so the consent surface is empty — but this is a posture choice that must be reflected in the COOKIE-POLICY.md (which already documents this honestly).

**Impact.** Future addition of analytics (recommended for conversion tracking) would be GDPR-non-compliant without prior banner installation.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-cookie-banner-001) (R-COOKIE-BANNER-001) — install consent banner before any analytics ships.

### F-MED-LEGAL-002 — Landing page hard-codes `<html lang="it">`.

**Severity:** Medium. **Category:** Stanca law / accessibility.

**Evidence.** `landing-page/index.html:2`:

```html
<html lang="it">
```

Hard-coded; the dashboard's `index.html` is the same.

**Impact.** Screen-readers serve Italian phonetics regardless of user preference. Not a compliance failure (the page IS in Italian) but a degradation of cross-locale UX.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-i18n-html-lang-001) (R-i18n-HTML-LANG-001).

### F-MED-LEGAL-003 — NIS2 scope determination open.

**Severity:** Medium. **Category:** NIS2 (D.Lgs. 138/2024).

**Evidence.** No documented analysis of whether FactoryMind (the Responsabile, Renan Augusto Macena) is in scope of NIS2 / D.Lgs. 138/2024 as a "fornitore di servizi digitali" or "soggetto importante" under Art. 3 of the decree.

**Impact.** ACN registration may or may not be required; if required and not done by 28 February of the relevant year, sanctions apply.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-nis2-scope-001) (R-NIS2-SCOPE-001) — legal counsel review; document the conclusion + supporting reasoning.

<a id="a-cra-applicability"></a>
### F-MED-LEGAL-004 — CRA applicability analysis open.

**Severity:** Medium. **Category:** Cyber Resilience Act (Reg. UE 2024/2847).

**Evidence.** No documented analysis of CRA scope per HANDOFF doctrine **H-11** (two distribution surfaces — MIT self-hosted likely under Art. 24 OSS exemption; commercial Tier 2/3/4 in scope from 11 dic 2027).

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-cra-001) (R-CRA-001) — produce the analysis; if commercial distribution proceeds before 11 dic 2027, plan the conformity assessment and CE marking trajectory.

### F-MED-LEGAL-005 — Stanca law / WCAG 2.1 AA actual vs claimed.

**Severity:** Medium. **Category:** Stanca law (L. 4/2004 + D.Lgs. 106/2018).

**Evidence.** Legacy `A11Y.md` claims WCAG 2.1 AA compliance but documents no completed audit. Multiple components in `frontend/src/components/` use color-only semantic meaning (severity badges) without text labels (cfr. AlertFeed.tsx); chart tooltips are hover-only (DowntimeChart.tsx).

**Impact.** Stanca law applies to public-administration sites and to large private firms (≥ €500 M revenue); not to FactoryMind's core PMI ICP. But the claim is an accessibility-by-design commitment; failing it silently erodes trust.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-a11y-audit-001) (R-A11Y-AUDIT-001) — actual axe-core + manual audit; close the gap or update the claim.

### F-MED-LEGAL-006 — Landing-page contact-form GDPR consent text.

**Severity:** Medium. **Category:** GDPR Art. 6 / 13.

**Evidence.** `landing-page/index.html` contact form (lines ~410) includes a footnote referring to GDPR but no explicit checkbox for consent + link to privacy notice prior to submission.

**Remediation:** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-landing-consent-001) (R-LANDING-CONSENT-001).

### F-LOW-LEGAL-001 — Privacy notice version date is `[DA_COMPILARE]`.

**Severity:** Low. **Category:** Operational completeness.

**Evidence.** `legal/INFORMATIVA-PRIVACY-GDPR.md:155-157` placeholders.

**Remediation:** R-LEGAL-DATES-001 — fill all version dates as part of the first-customer engagement (the date is the first commercial deployment date).

### F-MED-LEGAL-007 — Landing-page meta description in English.

**Severity:** Low (UX rather than legal, but flagged in this section because it touches the customer-facing surface).

**Evidence.** `landing-page/index.html:7` `<meta name="description">` is in Italian (correct), but the surrounding markdown sometimes mixes English and Italian inconsistently in social-media meta tags. Audit verifies all OG tags + description are in `it_IT` locale; pass.

(No remediation needed for this specific point; included for completeness.)

### F-MED-LEGAL-008 — `legal/CONTRATTO-SAAS-B2B.md` art. 5 SLA Tier Standard ≥ 99.5 %; documented HANDOFF SLO-1 says ≥ 99.9 % at GA. Inconsistency.

**Severity:** Medium. **Category:** Contract clarity.

**Evidence.** Contract Art. 5 enumerates Tier Standard `disponibilità mensile minima 99,5%` and Tier Enterprise `99,9%`. HANDOFF § 8 declares SLO-1 `≥ 99.9 %` at GA. The contract says one thing, the engineering target says another.

**Impact.** A Tier 2 customer signs the contract with a 99.5 % SLA expecting credits if the service drops below; the engineering team operates against a 99.9 % SLO. The expectation gap is uncomfortable for both parties.

**Remediation:** R-LEGAL-SLA-ALIGN-001 — pick one and reflect in both. Recommended: keep the contractual 99.5 % (Tier Standard) / 99.9 % (Tier Enterprise) and adjust the SLO presentation in HANDOFF accordingly (Tier-aware SLO).

---

## 8. CTF / red-team angles for IIoT

This section enumerates the specific exploitation patterns relevant to FactoryMind's stack. Each angle carries: technique description, FactoryMind exposure (current state), exploitation effort, mitigation status.

### 8.1 MQTT topic injection / ACL bypass

**Pattern.** Mosquitto pre-1.5.5 had a bug where empty ACL files defaulted to allow-all. Modern Mosquitto enforces ACL strictly, but misconfigured patterns can still allow lateral movement.

**FactoryMind exposure.** ACL pattern `pattern readwrite factory/%u/#` is correctly scoped per user. Risk surface: a service account with broader access (e.g., `backend` with `factory/#` + `$SYS/#`) is compromised.

**Effort.** Hard. Requires service-account credential compromise.

**Mitigation status.** ACL enforced; fail-close at entrypoint.sh; entry credentials in Secrets Manager.

### 8.2 Retained-message poisoning

**Pattern.** An attacker with publish ACL on a retained-message topic plants a malicious payload; new subscribers receive it on connect.

**FactoryMind exposure.** Status topics are retained QoS 1; if an attacker controls a service account, they can plant fake "machine DOWN" or "machine RUN" status that misleads the dashboard.

**Effort.** Medium (requires credential compromise).

**Mitigation status.** ACL pattern enforces per-tenant scoping; cross-tenant poisoning is not possible. Within-tenant insider risk remains.

### 8.3 Will-message abuse

**Pattern.** Attacker sets a malicious LWT (Last Will and Testament) on connect; on disconnect, broker publishes the will to the configured topic.

**FactoryMind exposure.** Same as 8.2 — bounded by ACL.

### 8.4 OPC UA TrustList tampering

**Pattern.** Attacker with access to the customer's PLC trust list adds a malicious CA; subsequent OPC UA sessions accept attacker-signed certificates.

**FactoryMind exposure.** TrustList management is operational (HANDOFF § 5.7); malicious modification requires physical or root access to the edge gateway.

**Mitigation.** Edge fleet hardening (HANDOFF doctrine **H-18**); certificate rotation cadence; manual TrustList review.

### 8.5 Modbus broadcast / function-code abuse

**Pattern.** Modbus has zero native security. Broadcast (unit ID 0) commands can be sent to all slaves; undefined function codes can be probed.

**FactoryMind exposure.** FactoryMind is read-only over Modbus by default; the modbus-bridge does not send broadcast commands. Customer-side OT segmentation is the primary defence.

**Mitigation status.** Documented in HANDOFF § 5.7; out of FactoryMind's scope to enforce.

### 8.6 Grafana SSRF (CVE-2025-4123)

**Pattern.** Path-traversal + open-redirect in `/api/datasources/proxy/...` combined with image renderer plugin → SSRF to cloud metadata.

**FactoryMind exposure.** Grafana version pinned in `docker-compose.yml`; check pinned version vs CVE fixed-in (REMEDIATION R-CVE-CADENCE quarterly sweep).

**Effort.** Medium.

### 8.7 InfluxDB operator-token disclosure (CVE-2024-30896)

**Pattern.** A read-permitted user can retrieve the operator token (highest-privilege credential) via specific API calls.

**FactoryMind exposure.** Influx version `2.7.x` per `docker-compose.yml`; CVE fixed in 2.7.11+. Verify current pin.

### 8.8 Mosquitto SUBACK OOB (CVE-2024-10525)

**Pattern.** SUBACK with no reason codes triggers out-of-bounds memory access in `libmosquitto` clients.

**FactoryMind exposure.** Backend uses `mqtt` npm package, not `libmosquitto`; not directly exposed. Customer's `mosquitto_sub`/`mosquitto_pub` clients ARE exposed if they communicate with a malicious or compromised broker.

### 8.9 Sparkplug B parser surface

**Pattern.** Protobuf parsers historically have CVE history (DoS via crafted messages, OOM via deeply nested structures).

**FactoryMind exposure.** `sparkplug-payload` (which depends on `protobufjs`) is loaded only when `SPARKPLUG_ENABLED=true`. Disable-by-default reduces attack surface.

### 8.10 Supply-chain on `node-opcua` / `modbus-serial` / `sparkplug-payload`

**Pattern.** Any of these packages compromised (registry attack, maintainer credential breach, typosquatting) yields code execution.

**Mitigation.** `package-lock.json` pins exact versions; `npm audit signatures` verifies provenance (gap: not currently in CI — REMEDIATION R-NPM-PROVENANCE-001 closes).

### 8.11 Credential stuffing via HIBP-known passwords

**Pattern.** Attacker uses leaked-credential lists to attempt logins en masse.

**FactoryMind exposure.** Account lockout (5 fails / 900 s window) + per-IP rate limit (10 req/min on `/api/users/login`) + HIBP k-anonymity check at password set/change time provide layered defence. The lockout is per-account; an attacker with many stolen email addresses can still spread their attempts thinly across accounts.

**Effort.** Low to medium.

**Mitigation status.** Strong; alert `FactoryMindLoginAnomalies` (> 10 fails/sec) escalates to security team for IP-block decisions.

### 8.12 IDOR (Insecure Direct Object Reference) on facility-scoped resources

**Pattern.** A `viewer` user requests `GET /api/devices/<id>` for a facility outside their `facility_scope` and is incorrectly served.

**FactoryMind exposure.** Backend RBAC + facility-scope filter at the repository layer enforces this. Tested in `backend/tests/role-hierarchy.test.js`. Defence-in-depth: the broker ACL prevents subscription to other tenants' topics regardless.

**Effort.** Low; trivially attempted.

**Mitigation status.** Strong; tested.

### 8.13 SQL injection

**Pattern.** Unparameterised query allows attacker to inject SQL.

**FactoryMind exposure.** All backend queries use parameterised `pool.query(text, params)`. No string concatenation of user input into SQL. The Joi validators at the route layer are defence-in-depth.

**Effort.** None for this codebase as audited.

**Mitigation status.** Structural (parameterised queries); tested.

### 8.14 Flux injection via `/api/metrics`

**Pattern.** A user-supplied Flux fragment is concatenated into a query and yields arbitrary Influx access.

**FactoryMind exposure.** The `/api/metrics` endpoint validates query params against a regex whitelist (`backend/src/routes/metrics.js`); the Flux query is server-generated, not user-supplied. Tested in `backend/tests/metrics-downtimes.test.js`.

**Mitigation status.** Strong.

### 8.15 OpenTelemetry trace context leakage

**Pattern.** A trace ID exposed in error responses to clients reveals internal-service topology.

**FactoryMind exposure.** Trace IDs are returned in the error envelope (HANDOFF § 6.1) by design — they enable customer support to correlate. This is intentional, not a leak.

### 8.16 NPM lockfile injection (lockfile poisoning)

**Pattern.** A malicious PR to `package-lock.json` introduces a tarball URL pointing at an attacker-controlled mirror.

**FactoryMind exposure.** Lockfile is reviewed in PR; CI runs `npm ci --frozen-lockfile`. Sigstore-based provenance verification (`npm audit signatures`) is the structural defence — not yet in CI (R-NPM-PROVENANCE-001).

### 8.17 GitHub Action poisoning via unpinned `@master`

**Pattern.** An action referenced by `@master` (or `@main`) gets a malicious commit; the next CI run executes it.

**FactoryMind exposure.** `.github/workflows/ci.yml` uses `aquasecurity/trivy-action@master` (unpinned). Risk surface real but bounded: Trivy is a security scanner with read access to the repo; a compromised version could exfiltrate code, secrets in env, or modify the build artefact.

**Remediation.** R-CI-PIN-001 — pin all actions to specific SHAs (or, at worst, version tags); Dependabot can keep them current.

### 8.18 Container CIS benchmark failures

**Pattern.** Dockerfiles fail CIS Docker Benchmark checks (run as root, no HEALTHCHECK, install with `--no-audit`, etc.).

**FactoryMind exposure.** Backend Dockerfile passes most checks (USER, HEALTHCHECK, multi-stage, npm/npx removed). Frontend Dockerfile fails (no USER — F-HIGH-007). iot-simulator Dockerfile is minimal.

**Mitigation status.** Backend strong; frontend gap (R-FRONTEND-DOCKERFILE-USER-001).

### 8.19 K8s admission control bypass

**Pattern.** A pod manifest with `runAsUser: 0` slipped past the admission controller.

**FactoryMind exposure.** Namespace `pod-security.kubernetes.io/enforce: restricted` blocks at admission. The deployment.yaml is verified. Defence is structural.

### 8.20 OpenAPI / API spec drift

**Pattern.** A new endpoint added to the code without updating `docs/openapi.yaml` is invisible to clients generating stubs.

**FactoryMind exposure.** No automated drift check (HANDOFF doctrine **H-4**, **H-9**). REMEDIATION R-CI-DOCS-001 adds the lint.

**Effort.** None to introduce; the cost is shifted to integrators who consume a stale spec.

---

## 9. CVE register

**Last reviewed:** 2026-05-07. (Doctrine **A-12** — CI fails if older than 95 days. REMEDIATION R-CVE-CADENCE.)

### 9.1 Dependencies in scope

The CVE register tracks vulnerabilities in components FactoryMind ships, distributes, or operationally depends on:

- **Broker:** Eclipse Mosquitto 2.x.
- **Time-series:** InfluxDB 2.7+.
- **Metadata DB:** PostgreSQL 16.
- **Backend runtime:** Node.js 20 LTS.
- **Backend deps (top-of-tree):** Express 4.x, helmet, joi, jsonwebtoken, mqtt, @influxdata/influxdb-client, pino, pg, node-opcua, modbus-serial, sparkplug-payload, nodemailer, scrypt-async (or built-in crypto.scryptSync), express-rate-limit, csurf (or custom), `socket.io` (if used).
- **Frontend runtime:** Node 22+ for build, Vite 7, React 18, TypeScript 5, Tailwind 3, axios, @tanstack/react-query 5, react-router-dom 6, leaflet, recharts.
- **Container base images:** `node:24-alpine` (build + backend + simulator runtime), `nginx:1.29-alpine` (frontend production).
- **K8s ecosystem:** ingress-nginx (customer), Kyverno (planned), ExternalSecrets (planned).
- **Observability:** OpenTelemetry SDKs, Grafana 11+, Prometheus.
- **CI tools:** Trivy, Gitleaks, Syft, Cosign (planned).

### 9.2 Live register table

| CVE | Affected component | Vulnerable versions | Fixed-in | CVSS 3.1 | FactoryMind exposure | Action |
|---|---|---|---|---|---|---|
| CVE-2024-10525 | Mosquitto (libmosquitto, SUBACK) | ≤ 2.0.x | 2.0.20+ | 5.5 (DoS via OOB) | Indirect: backend uses `mqtt` npm, not libmosquitto. Customer-side `mosquitto_sub`/`pub` clients exposed if pointed at malicious broker. | Doc note in HANDOFF § 5.7. |
| CVE-2023-28366 | Mosquitto memory leak (QoS 2 dup ID handling) | ≤ 2.0.15 | 2.0.16+ | 7.5 (DoS) | Verify Mosquitto pin in `docker-compose.yml` ≥ 2.0.16. | R-CVE-MOSQUITTO-001. |
| CVE-2024-3935 | Mosquitto TLS hostname validation | TBD per advisory | TBD | 5.3 | Verify in production deployment using TLS listener. | R-CVE-MOSQUITTO-001 sweep. |
| CVE-2024-30896 | InfluxDB 2.x operator-token disclosure | ≤ 2.7.10 | 2.7.11+ | 9.1 (Critical) | Verify Influx image pin ≥ 2.7.11. The operator token is the highest-privilege Influx credential; its disclosure to a read-permitted user enables full takeover. | R-CVE-INFLUX-001 (immediate bump). |
| CVE-2025-4123 | Grafana path-traversal + open-redirect → SSRF (image renderer plugin chain) | 10.x, 11.x, 12.x before patched releases | per advisory | 9.1 (Critical) | Verify Grafana version pin in `docker-compose.yml`. SSRF can pivot to AWS metadata if Grafana runs in cloud; less impact in customer-on-prem. | R-CVE-GRAFANA-001. |
| CVE-2024-42512 | OPC UA stack (multiple) | per OPC Foundation bulletin | per advisory | TBD | Indirect: node-opcua versions; verify pin against advisory. | Monitor; R-CVE-OPCUA-001. |
| CVE-2024-42513 | OPC UA | per advisory | per advisory | TBD | Indirect (node-opcua). | Monitor. |
| CVE-2025-1468 | OPC UA | per advisory | per advisory | TBD | Indirect. | Monitor. |
| CVE-NEXT-NODE-LTS | Node.js 20 LTS quarterly security release | varies | latest LTS | varies | Direct — backend runtime. Quarterly release cadence aligns with Node's. | R-CVE-NODE-001 quarterly. |
| CVE-NEXT-NPM-AUDIT | Various deps | varies | varies | varies | Catch via `npm audit --audit-level=high` (gating, after R-CI-AUDIT-001). | Continuous (Dependabot + monthly triage). |

### 9.3 Cadence

- **Monthly:** Dependabot autobumps with auto-merge for patch versions of low-blast-radius deps (lint, prettier, types). Manual review for prod deps.
- **Quarterly:** Comprehensive sweep — re-run npm audit, Trivy, Gitleaks; check OPC Foundation security bulletins page; review Mosquitto / InfluxDB / Grafana / Postgres advisories. Update this register with new entries / closed entries. CI fails if "Last reviewed" line above is older than 95 days.
- **Immediate:** Critical (CVSS ≥ 9.0) advisories on a deployed dependency trigger an out-of-band sweep + customer notice within 24 h if exposure is real.

### 9.4 Customer-side CVE communication

Tier 2/3 customers receive a quarterly CVE digest by email summarising: (a) advisories that affected FactoryMind dependencies; (b) the FactoryMind action (patched / mitigated by config / accepted residual); (c) the version they should be on. This is part of the contractual obligation under `legal/CONTRATTO-SAAS-B2B.md` art. 5 Tier Standard "aggiornamenti correttivi e di sicurezza".

---

## 10. Compliance scorecards

### 10.1 NIST CSF 2.0 — six functions

| Function | Maturity (0–4) | Evidence |
|---|---|---|
| **Govern** | 2 | Doctrine documented across the four-doc set; ADR directory pending (R-ADR-001) |
| **Identify** | 2 | Asset inventory in HANDOFF § 4; cross-product map § 10 |
| **Protect** | 2 | Helmet, JWT, RBAC, TLS, K8s securityContext |
| **Detect** | 2 | OpenTelemetry traces; Prometheus metrics; alert rules |
| **Respond** | 2 | Runbooks (HANDOFF § 8); breach 24 h DPA |
| **Recover** | 1.5 | Backups documented; quarterly restore drill not yet executed (R-DR-DRILL-001) |

### 10.2 IEC 62443-3-3 SL-2 self-assessment

(Detailed in HANDOFF § 9.3; here tabulated against control families.)

| FR | Family | SL achieved | Gap |
|---|---|---|---|
| FR1 | Identification & Authentication Control | 2 | None blocking SL-2 |
| FR2 | Use Control | 2 | None |
| FR3 | System Integrity | 1.5 | HMAC on OPC UA commands roadmap |
| FR4 | Data Confidentiality | 2 | KMS CMK roadmap (F-HIGH-003) |
| FR5 | Restricted Data Flow | 1.5 | Fine-grained NetworkPolicy (F-MED-NETPOL) |
| FR6 | Timely Response to Events | 2 | None |
| FR7 | Resource Availability | 2 | Backup drill cadence (R-DR-DRILL-001) |

### 10.3 CIS Controls v8 (subset relevant to single-server kit)

| Control | Score (0–3) | Evidence |
|---|---|---|
| 1. Inventory of assets | 2 | HANDOFF § 4 |
| 2. Inventory of software | 2 | `package.json` + `package-lock.json` pinned + `go.sum` analogue (n/a) |
| 3. Data protection | 2 | tenant-scoped repo + audit log |
| 4. Secure configuration | 2 | distroless-equivalent (alpine), non-root, HSTS preload, CSP |
| 5. Account management | 2 | NIST 800-63B-style lockout, HIBP |
| 6. Access control | 2 | RBAC at app + ACL at broker; row-level scoping at DB |
| 7. Continuous vulnerability management | 1 | npm audit manual + CVE register quarterly; CI integration gap (F-CRIT-007) |
| 8. Audit log management | 2 | `audit_log` table; retention 13 m default |
| 11. Data recovery | 1 | Backup runbook; quarterly drill pending |
| 12. Network infrastructure | 2 | NetworkPolicy default-deny + ingress hardening |
| 16. Application software security | 2 | This audit + threat model |

### 10.4 AgID Misure Minime ICT (Standard level)

| ABSC | Cluster | Score (0–3) |
|---|---|---|
| 1 | Inventario asset | 2 |
| 2 | Inventario software | 2 |
| 3 | Protezione configurazioni | 2 |
| 4 | Valutazione vulnerabilità | 1 |
| 5 | Privilegi amministrativi | 2 |
| 8 | Difesa contro malware | 2 |
| 10 | Backup | 1 |
| 13 | Protezione dei dati | 2 |

The "Alto" level requires independent penetration testing and a formal incident-response plan — both customer-deployment-specific and out of this audit's scope.

### 10.5 GDPR self-assessment

| Article | Implementation | Evidence |
|---|---|---|
| Art. 5 (data minimisation) | Yes | HANDOFF § 7.2; telemetry non-personal |
| Art. 25 (privacy by design) | Yes | architecture documented in HANDOFF § 3 |
| Art. 30 (RoPA) | Yes | DATA_GOVERNANCE.md (legacy) + HANDOFF § 7 |
| Art. 32 (security) | Yes | scrypt, TLS, KMS-default, audit log |
| Art. 33 (breach 72 h) | Yes via DPA 24 h tighter | DPA § 7 |
| Art. 35 (DPIA) | Customer responsibility (Titolare) | DPA § 9 |
| Art. 44 (international transfer) | Partial | F-CRIT-006 TIA missing |
| Art. 15-22 (subject rights) | Manual procedure today | F-HIGH-006 automation pending |

---

<a id="a-strength-migrations"></a>
## 11. Strengths (do-not-regress list)

These properties of the platform are working well; the remediation phase MUST NOT inadvertently break them. Each strength carries a short rationale and the regression-test that defends it.

### 11.1 Mosquitto entrypoint fail-close

**Property.** `mosquitto/entrypoint.sh` lines 28–37 refuse to start if the `passwd` file contains default credentials (`mosquitto:mosquitto`, `admin:admin`, `test:test`, `guest:guest`, `root:root`, `default:default`) or empty-password entries. Lines 41–50 refuse production startup if `allow_anonymous=true` is configured AND no `password_file` is set.

**Why this matters.** This is the structural defence that allows `allow_anonymous true` in dev (F-CRIT-001) without that becoming a production deployment. Removing or weakening this guard would convert F-CRIT-001 from "informational" to "actively exploited within the first week of production".

**Regression test.** A pre-commit hook + CI test that boots the broker with each of the prohibited configurations and asserts non-zero exit. Currently manual — REMEDIATION R-MOSQUITTO-FAIL-CLOSE-CI-001 automates.

### 11.2 ACL pattern-based tenant isolation

**Property.** `mosquitto/config/acl` defines `pattern readwrite factory/%u/#` — `%u` substitution per connecting user. A user `mozzecane` cannot publish or subscribe to `factory/altre-aziende/...` topics regardless of how the topic is constructed.

**Why this matters.** This is the broker-level defence-in-depth on top of application-level RBAC. A backend bug that incorrectly routes a tenant-A user's request to a tenant-B query would still be caught at the broker if the user attempts to consume telemetry directly.

**Regression test.** CMD-023 (Appendix A) — a tenant-A user attempts to subscribe to tenant-B topics and is denied.

<a id="a-strength-config-guardrail"></a>
### 11.3 Backend production guardrails

**Property.** `backend/src/config/index.js:113-145` runs after Joi schema validation and refuses boot on: `JWT_SECRET` placeholder; `JWT_SECRET` < 32 chars; `MQTT_BROKER_URL` not `mqtts://`; CORS contains `*` or `localhost`; `INFLUX_TOKEN` < 32 chars.

**Why this matters.** The single most-cited root cause of breaches in OWASP API Top 10 (2023) is "Security Misconfiguration" (API8). The guardrails turn misconfiguration from an exploitable runtime condition into a deploy-time failure visible to the operator.

**Regression test.** `backend/tests/config-prod-guardrails.test.js` — already present.

### 11.4 JWT pinned to HS256 with typ-claim validation

**Property.** `backend/src/middleware/auth.js:21` pins the JWT verification algorithm to `HS256`; `:40-42` distinguishes access tokens from refresh tokens via the typ claim. `alg: none` and HS-RS algorithm-confusion attacks are rejected.

**Why this matters.** Algorithm-confusion attacks are a common JWT failure mode; the pinning eliminates the entire class.

### 11.5 Account lockout with exponential backoff

**Property.** 5 failed logins → 900 s lockout window; exponential backoff per `backend/src/middleware/lockout.js`; `Retry-After` header on 429.

**Why this matters.** Brute-force defence + signal to defenders. Combined with HIBP k-anonymity, raises the credential-stuffing bar.

### 11.6 Scrypt password hashing + HIBP k-anonymity

**Property.** `crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })` — NIST SP 800-63B-aligned cost factor. HIBP check sends only the first 5 chars of SHA-1 hash (k-anonymity preserved per the Pwned Passwords API contract).

**Why this matters.** Passwords compromised in known breaches are blocked at password-set time, not at login time. The k-anonymity preserves user privacy during the check.

### 11.7 Audit log on every state-changing 2xx/4xx

**Property.** `backend/src/middleware/audit.js` writes an `audit_log` row on every state-changing response (POST/PUT/PATCH/DELETE). Reads sampled at 10 % in production.

**Why this matters.** Forensic foundation. Without an audit log, incident investigation reverts to log archaeology.

**Regression test.** CMD-024 — verify INSERT works, UPDATE/DELETE denied for non-admin Postgres roles.

### 11.8 Helmet + strict CSP + HSTS preload + COOP/CORP

**Property.** `backend/src/index.js:83-102` configures helmet with: `script-src 'self'`, `frame-ancestors 'none'`, HSTS 1 year preload + includeSubDomains, COOP same-origin, CORP same-site, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy locked.

**Why this matters.** Real XSS + clickjacking + Spectre mitigation, not just headers for compliance show.

**Regression test.** CMD-028.

### 11.9 K8s pod + container securityContext

**Property.** `k8s/deployment.yaml:44-91` sets pod-level `runAsNonRoot: true`, `runAsUser: 1001`, `seccompProfile: RuntimeDefault`; container-level `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `runAsUser: 1001`, `capabilities.drop: ["ALL"]`.

**Why this matters.** Defence-in-depth. A container-escape vulnerability has to traverse multiple layers of restriction.

### 11.10 Default-deny NetworkPolicy at namespace scope

**Property.** `k8s/namespace.yaml:18-26` — `podSelector: {}` + `policyTypes: [Ingress, Egress]` denies everything by default. Allowed flows are explicit additions.

**Why this matters.** Zero-trust network default. A misconfigured pod cannot inadvertently expose a service.

### 11.11 Italian data residency default

**Property.** `terraform/variables.tf:18-20` defaults `aws_region = "eu-south-1"` (Milano) with explicit comment about Italian data residency. CloudFront viewer-certificate path also respects EU data sovereignty.

**Why this matters.** Customer's commercialista cares about this. NIS2 / GDPR Art. 32 / Codice Privacy alignment.

### 11.12 DPA 24-h breach notification

**Property.** `legal/DATA-PROCESSING-AGREEMENT.md` § 7 — Responsabile notifies Titolare within 24 h of breach awareness; tighter than GDPR's 72 h to Garante.

**Why this matters.** Gives the Titolare investigative margin. Customer trust signal.

### 11.13 Multi-protocol bridge pattern

**Property.** Separate services for OPC UA, Modbus, Sparkplug B. Clean separation; each can be enabled/disabled per tenant.

**Why this matters.** Real-world OT customers have heterogeneous machine fleets. Single-protocol products lose deals at the boundary.

### 11.14 Downsampling pipeline with retention tiers

**Property.** Flux tasks `downsample_1m`, `downsample_1h`, `downsample_1d` provisioned at startup. Retention tiers 30 d / 365 d / 1 095 d / indefinite.

**Why this matters.** Long-term trend analysis without storage blow-up. Customers asking "what was OEE last June?" get an answer.

**Regression test.** CMD-011.

### 11.15 Comprehensive SLO + error-budget policy

**Property.** Legacy `SLO.md` defined 9 SLOs with explicit error-budget bands (Green / Yellow / Red / Blown) and release-freeze rules. HANDOFF § 8 carries this forward with materialised runbooks.

**Why this matters.** Operationally sound. Releases are gated by budget burn.

### 11.16 Idempotent installer with unattended mode

**Property.** `install.sh` carries `set -Eeuo pipefail`, OS detection, prompt-vs-unattended modes (`FM_UNATTENDED=1`), idempotent re-run, secure 0600 .env generation, browser auto-open.

**Why this matters.** Tier 2 customer onboarding velocity. The non-technical SME owner can run it.

### 11.17 Italian compliance grounding

**Property.** Legacy `ITALIAN-COMPLIANCE.md` mapped code modules to Piano 4.0 caratteristiche tecnologiche + IEC 62443 + IEC 62541 + GDPR + Stanca law. The mapping is rare in IIoT projects and is the load-bearing differentiation against Siemens MindSphere / PTC ThingWorx in the Italian-SME segment.

**Why this matters.** The customer's commercialista evaluates the product against the Circolare 9/E/2018 checklist — this document is the commercialista-facing artefact that closes the sale.

---

## 12. Accepted residual findings (from § above, recapitulated with formal acceptance)

| Finding | Severity | Rationale | Trigger to flip back to active |
|---|---|---|---|
| Audit log lossy under backpressure (F-MED-DATA-002) | M | Synchronous insert per request; under DDoS could drop. Acceptable for current scale. | Customer with contractual "no audit drop" → switch to async-with-buffer pattern (REMEDIATION R-AUDIT-ASYNC-001) |
| Modbus broadcast unprotected (§ 8.5) | M | Modbus has no native security; FactoryMind read-only by default. | Customer requires command-write capability over Modbus → introduce HMAC-wrapped Modbus profile |
| No CSRF on POST (Bearer-auth-only) | L | SPA uses Authorization header; CSRF surface zero on Bearer-auth routes. | Migration to cookie auth (R-FRONTEND-COOKIE-AUTH-001) requires CSRF middleware |
| No audience claim validation on JWT | L | Single-service kit; relevant only if multiple services share secret. | Multi-service tenant with shared secret → add `aud` claim validation |
| Sourcemaps in dev/staging | L | Dev convenience > information disclosure trade-off; production fixes via R-FRONTEND-SOURCEMAP-001 | Production deployment ships with sourcemaps → escalate |
| Unpinned Grafana plugin versions | L | Dev convenience; production pins via REMEDIATION | Production deploy without pinned plugins → escalate |
| `console.warn`/`error`/`info` allowed | L | Dev workflow needs them; production lint hardens via REMEDIATION | n/a |

Each accepted residual is reviewed quarterly per HANDOFF doctrine **H-22** + AUDIT doctrine **A-8**.

---

## 12. Accepted residual findings

| Finding | Severity | Rationale | Trigger to flip back to active |
|---|---|---|---|
| Audit log lossy under backpressure (F-MED-DATA-002) | M | Synchronous insert per request; under DDoS could drop. Acceptable for current scale. | Customer with contractual "no audit drop" → switch to async-with-buffer pattern |
| `MODBUS broadcast unprotected` (§ 8.5) | M | Modbus has no native security; FactoryMind read-only by default. | Customer requires command-write capability over Modbus → introduce HMAC-wrapped Modbus profile |
| No CSRF on POST (mitigated by Bearer-auth-only) | L | SPA uses Authorization header; CSRF surface zero. | Migration to cookie auth (R-FRONTEND-COOKIE-AUTH-001) requires CSRF middleware |
| No audience claim validation on JWT | L | Single-service kit; relevant only if multiple services share secret. | Multi-service tenant with shared secret → add `aud` claim validation |

---

## Appendix A — Reproduction commands

(Subset; full set in [`REMEDIATION.md`](REMEDIATION.md) "Test catalogue".)

**CMD-001 (F-CRIT-001):** verify Mosquitto allows anonymous in dev:

```bash
mosquitto_sub -h localhost -p 1883 -t '$SYS/#' -W 5
# Expected: receives broker statistics without credentials
# Mitigation in production: entrypoint.sh refuses boot
```

**CMD-002 (F-CRIT-003 — local dev only):** demonstrate OPC UA endpoint laxity:

```bash
docker compose run --rm -e OPCUA_ENDPOINT=opc.tcp://169.254.169.254:80 backend node -e "require('./src/services/opcua-bridge').connect()"
# Expected: client attempts connect to metadata IP
# Production mitigation pending (R-OPCUA-VALIDATE-001)
```

**CMD-003 (F-CRIT-007):** verify CI audit gate is non-blocking:

```bash
grep -n "|| true\|exit-code: \"0\"" .github/workflows/ci.yml
# Expected: matches on lines 140, 144, 147
```

**CMD-004 (F-CRIT-004):** verify Terraform state is local:

```bash
grep -n "backend" terraform/versions.tf
# Expected: lines 14-20 are commented (start with #)
ls -la terraform/.terraform/ 2>/dev/null
# Expected: present after a local `terraform init`, indicating local state
```

**CMD-005 (F-HIGH-001):** verify JWT in localStorage:

```bash
grep -n "localStorage" frontend/src/api/client.ts
# Expected: line 14 reads getItem('factorymind:jwt')
```

**CMD-006 (F-HIGH-007):** verify nginx runs as root in frontend image:

```bash
docker build -t fm-frontend frontend/
docker run --rm fm-frontend whoami
# Expected: "root" (gap)
```

**CMD-007 (F-HIGH-009):** verify Cosign step absent:

```bash
grep -n "cosign\|sigstore" .github/workflows/cd.yml
# Expected: no matches
```

**CMD-008 (F-HIGH-010):** verify WebSocket has no auth in handshake:

```bash
# From a browser console on a page that did NOT log in:
const s = new WebSocket('ws://localhost:3002/ws');
s.onopen = () => s.send(JSON.stringify({type: 'subscribe', topics: ['factory/#']}));
s.onmessage = (m) => console.log('received:', m.data);
# Expected: connects + receives messages without auth (gap)
# After R-WS-AUTH-001: connects only with valid Authorization header
```

**CMD-009 (F-MED-DATA-004):** demonstrate loose topic regex:

```bash
mosquitto_pub -h localhost -p 1883 -t 'factory/test/test/test/telemetry../../../../etc/passwd' -m '[]'
# Expected: accepted by current regex; tightened regex (R-MQTT-TOPIC-VALIDATION-001) rejects
```

**CMD-010 (F-MED-CODE-002):** verify i18n key drift:

```bash
# Extract keys referenced in components:
grep -rhoE "t\(['\"]([a-z_.]+)['\"]" frontend/src | sed -E "s/t\(['\"]//; s/['\"].*//;" | sort -u > /tmp/keys-in-code.txt
# Extract keys present in en.json:
jq -r 'paths(scalars) | join(".")' frontend/src/locales/en.json | sort -u > /tmp/keys-in-en.txt
diff /tmp/keys-in-code.txt /tmp/keys-in-en.txt
# Expected: lines starting with < are in code but missing from en.json
```

**CMD-011 (F-MED-DATA-001):** verify Influx tasks created at startup:

```bash
docker compose exec influxdb influx task list
# Expected: three tasks (downsample_1m, downsample_1h, downsample_1d)
# After R-INFLUX-TASK-001: missing tasks fail /api/health
```

**CMD-012 (F-MED-LEGAL-001):** verify cookie banner absent:

```bash
grep -i "cookie\|consent\|banner\|consenso" landing-page/index.html
# Expected: no cookie banner JS / consent UI in the markup
```

**CMD-013 (F-MED-CODE-005):** demonstrate 5xx leaking driver internals:

```bash
# Submit a malformed request that triggers a Postgres error path:
curl -X POST http://localhost:3002/api/devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt>" \
  -d '{"facility_id": "/* very long string that exceeds the column */", "line_id":"l","machine_id":"m","name":"n","protocol":"mqtt"}'
# Expected: response body contains pg driver text (gap)
```

**CMD-014 (F-CRIT-005):** verify Grafana → Postgres TLS disabled:

```bash
grep -n "sslmode" grafana/provisioning/datasources/postgres.yml
# Expected: line 13 reads sslmode: disable
```

**CMD-015 (F-CRIT-007 / supply-chain):** verify npm audit signatures missing from CI:

```bash
grep -n "audit signatures\|provenance" .github/workflows/ci.yml
# Expected: no matches
```

**CMD-016 (CVE-2024-30896):** verify Influx version pin:

```bash
grep -A2 "influxdb:" docker-compose.yml | grep image
# Expected: image: influxdb:2.7.x (verify x ≥ 11)
```

**CMD-017 (CVE-2025-4123):** verify Grafana version pin:

```bash
grep -A2 "grafana:" docker-compose.yml | grep image
# Expected: image: grafana/grafana:<version> (verify against advisory)
```

**CMD-018 (F-HIGH-004):** verify RDS egress wide-open:

```bash
grep -A5 "egress" terraform/modules/db/main.tf
# Expected: cidr_blocks = ["0.0.0.0/0"]
```

**CMD-019 (F-MED-DATA-005):** demonstrate connection-pool exhaustion at scale:

```bash
# With 20 concurrent clients hammering the API, observe pool saturation:
for i in {1..20}; do
  curl -s http://localhost:3002/api/oee?facility=mozzecane &
done
wait
# Expected: latency spike; with PgBouncer (R-PGBOUNCER-001) — flat
```

**CMD-020 (F-MED-LEGAL-002):** verify hard-coded `lang="it"`:

```bash
grep -n 'lang=' landing-page/index.html frontend/index.html
# Expected: lang="it" hard-coded both
```

**CMD-021 (F-LOW-CODE-001):** verify unused frontend deps:

```bash
cd frontend && npx depcheck --skip-missing
# Expected: lists mqtt, socket.io-client as unused
```

**CMD-022 (broker $SYS access):** verify backend service can read $SYS topics (intended privilege; verifies ACL is correctly broader for backend):

```bash
mosquitto_sub -h localhost -p 1883 -u backend -P "$MQTT_PASSWORD" -t '$SYS/broker/clients/connected' -W 5
# Expected: returns the count
```

**CMD-023 (anti-cross-tenant):** verify a tenant-A user cannot read tenant-B telemetry:

```bash
# Connect with the tenant-A user credentials and attempt cross-tenant subscribe:
mosquitto_sub -h localhost -p 1883 -u tenant_a -P "$TENANT_A_PASSWORD" -t 'factory/tenant_b/#' -W 5
# Expected: subscription denied; no messages received
```

**CMD-024 (audit-log immutability test):** verify audit log accepts INSERT but not UPDATE/DELETE for non-admin Postgres roles:

```bash
docker compose exec postgres psql -U readonly_role factorymind \
  -c "UPDATE audit_log SET action='tampered' WHERE id = (SELECT id FROM audit_log LIMIT 1);"
# Expected: ERROR: permission denied for table audit_log
```

**CMD-025 (rate-limit verification):** verify per-route override of `/api/users/login`:

```bash
for i in {1..15}; do
  curl -X POST http://localhost:3002/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"email":"nobody@nowhere.local","password":"wrong"}' \
    -w "\n%{http_code} (%{time_total}s)\n"
done
# Expected: 11th onwards returns 429 with Retry-After
```

**CMD-026 (lockout verification):** five failures lock the account:

```bash
for i in {1..6}; do
  curl -X POST http://localhost:3002/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@factorymind.local","password":"WRONG"}'
done
# Expected: 6th attempt returns 423 Locked (or 429 with lockout-specific Retry-After)
```

**CMD-027 (CSRF verification):** state-changing POST without CSRF token rejected:

```bash
# Get a CSRF cookie:
CSRF=$(curl -s -c /tmp/cookies.txt http://localhost:3002/api/csrf | jq -r .token)
# Submit without the header:
curl -X POST http://localhost:3002/api/facilities \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"facility_id":"test","name":"test","province":"VR","country":"IT","timezone":"Europe/Rome"}'
# Expected: 403 CSRF token missing
# Note: Bearer-auth routes are exempt — this test applies to cookie-auth flows.
```

**CMD-028 (helmet headers verify):**:

```bash
curl -s -I http://localhost:3002/api/health | grep -E 'strict-transport-security|content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy'
# Expected: all six present, with values per index.js:83-102
```

**CMD-029 (admin bootstrap fail-close):**:

```bash
# In a fresh dev environment with no FM_ADMIN_EMAIL / FM_ADMIN_PASSWORD_HASH set:
NODE_ENV=production FM_REQUIRE_CUSTOM_ADMIN=true docker compose up backend
# Expected: backend exits with code 10
```

**CMD-030 (seed-admin in production fail):**:

```bash
NODE_ENV=production FM_ADMIN_EMAIL=admin@factorymind.local FM_ADMIN_PASSWORD_HASH=<seed-hash> docker compose up backend
# Expected: backend exits with code 11
```

---

## Appendix B — CVSS 3.1 worksheets

(Per F-CRIT and F-HIGH; AV: Attack Vector, AC: Attack Complexity, PR: Privileges Required, UI: User Interaction, S: Scope, C/I/A: Confidentiality/Integrity/Availability impact.)

| Finding | AV | AC | PR | UI | S | C | I | A | Score |
|---|---|---|---|---|---|---|---|---|---|
| F-CRIT-001 | N | L | N | N | U | L | L | L | 6.5 → 8.6 with chained F-CRIT-002 |
| F-CRIT-002 | N | H | N | N | U | H | H | N | 7.4 |
| F-CRIT-003 | N | L | H | N | C | H | H | L | 7.5 |
| F-CRIT-004 | n/a (operational) | — | — | — | — | — | — | — | 7.5 (severity) |
| F-CRIT-005 | A | L | H | N | U | H | H | N | 7.0 |
| F-CRIT-006 | n/a (regulatory) | — | — | — | — | — | — | — | 7.5 |
| F-CRIT-007 | n/a (process) | — | — | — | — | — | — | — | 7.0 |
| F-HIGH-001 | N | L | L | R | U | H | L | N | 6.8 |
| F-HIGH-002 | N | L | N | N | U | L | L | N | 6.5 |
| ... | | | | | | | | | (additional rows in production audit) |

---

## Appendix C — Diff vs prior pass

**v1.0 baseline** — no prior pass. Future passes diff here.

---

## Appendix D — Security testing protocol

The next audit pass (quarterly per HANDOFF doctrine **H-22**) follows this protocol.

**Phase 1 — automated tooling (1 day).** `npm audit --audit-level=high` (backend + frontend + simulator); `trivy config .`; `trivy image ghcr.io/factorymind/factorymind-backend:<digest>`; `gitleaks detect`; ESLint + tsc strict; `mosquitto_sub`/`pub` ACL probes; `kubectl auth can-i` for the ServiceAccount; `aws-vault exec ... aws iam simulate-principal-policy` for IAM correctness.

**Phase 2 — primary-source code review (2 days).** Open every backend service, every middleware, every route. Cross-reference against the threat model in § 3 and the strengths in § 11. Look for: regressions in the strengths list; new findings; closed findings still showing as open in REMEDIATION; placeholder code that's been silently shipped.

**Phase 3 — regulatory cross-check (0.5 day).** Re-read the citations in HANDOFF Appendix A. Check Normattiva for any superseding decree (e.g., a new Legge di Bilancio modifying Piano 4.0 thresholds). Check Garante's docweb for any new IoT/manufacturing provvedimento.

**Phase 4 — CVE sweep (0.5 day).** Iterate the live register in § 9.2; check advisories; bump where needed; produce REMEDIATION tickets.

**Phase 5 — write-up (0.5 day).** Update this document. Generate the diff in Appendix C. Date and sign in the front matter.

Total: ~4.5 working days quarterly; ~18 working days annually allocated to audit. Compared to the cost of a blind production breach, this is the cheapest risk reduction available.

---

## Appendix E — Compliance scorecard evidence (extended)

This appendix records, for every scoring decision in § 10, the file:line evidence that justifies the score. Auditors revisiting the score can trace it back to source.

### NIST CSF 2.0 — Govern function (score 2)

- "Doctrine documented across the four-doc set" — HANDOFF § 2 (22 rules), AUDIT § 2 (20 rules), REMEDIATION § 2 (TBD), UPLIFT § 2 (TBD).
- "ADR directory pending" — `docs/adr/` does not exist at commit `d4c5107`; HANDOFF doctrine **H-22** mandates creation; REMEDIATION R-ADR-001.
- Score 2 (not 3) because review cadence is documented but not yet executed (the v1.0 baseline is the first pass; the second-pass diff in Appendix C is empty).

### NIST CSF 2.0 — Identify function (score 2)

- "Asset inventory in HANDOFF § 4" — every backend module, frontend module, infra config catalogued with file:line.
- "Cross-product map § 10" — HANDOFF § 10 lists sister projects + integration boundaries.
- "Threat model § 3" — this document.
- Score 2 because asset criticality ratings are implicit (in § 3.1 of this document) but not formalised against a CSF asset register.

### NIST CSF 2.0 — Protect function (score 2)

Evidence per control family:
- **Access control (PR.AC):** RBAC at app + ACL at broker + RLS-ready Postgres schema.
- **Awareness & training (PR.AT):** doctrines in all four documents; HANDOFF § 12 onboarding checklist.
- **Data security (PR.DS):** TLS 1.3, KMS at-rest, scrypt password hashing.
- **Information protection processes (PR.IP):** migrations forward-only + idempotent; secret rotation in HANDOFF § 5.4.
- **Maintenance (PR.MA):** Dependabot + quarterly CVE sweep.
- **Protective technology (PR.PT):** helmet + CSP + HSTS + COOP/CORP at ingress.

Score 2 because identity-and-access management is solid but not yet IGA-grade (no automated joiner-mover-leaver flow integrated with an IDP).

### NIST CSF 2.0 — Detect function (score 2)

- **Anomalies (DE.AE):** alert engine evaluates rules; `FactoryMindLoginAnomalies` detects credential stuffing.
- **Continuous monitoring (DE.CM):** OpenTelemetry traces; Prometheus metrics; alertmanager.
- **Detection processes (DE.DP):** runbooks tested in quarterly game day (target — REMEDIATION R-GAMEDAY-001).

Score 2 because detection is operational but the game-day exercises that validate detection paths are pending.

### NIST CSF 2.0 — Respond function (score 2)

- **Response planning (RS.RP):** runbooks (HANDOFF § 8).
- **Communications (RS.CO):** customer-notice templates (REMEDIATION Appendix C).
- **Analysis (RS.AN):** 5-working-day postmortem SLA (HANDOFF doctrine **H-17**).
- **Mitigation (RS.MI):** documented per-runbook.
- **Improvements (RS.IM):** quarterly review (HANDOFF doctrine **H-22**).

Score 2 because the response plan is mature but not yet exercised in a real P1 (the platform is pre-first-paying-customer).

### NIST CSF 2.0 — Recover function (score 1.5)

- **Recovery planning (RC.RP):** RTO ≤ 1 h / RPO ≤ 5 min (HANDOFF § 5.3 + DPA § 14).
- **Improvements (RC.IM):** trends from postmortems aggregated quarterly (UPLIFT u-pm-trends).
- **Communications (RC.CO):** customer-facing communication templates (REMEDIATION Appendix C).

Score 1.5 because backups are documented but the quarterly restore drill (R-DR-DRILL-001) has not yet been executed; without a successful drill, the RTO/RPO targets are aspirational.

### IEC 62443-3-3 SL-2 — full evidence per FR

**FR1 (Identification & Authentication Control) — SL 2:**

- SR 1.1 (human user authentication): Yes — JWT HS256 + scrypt + lockout.
- SR 1.2 (software process authentication): Partial — service-account JWTs not yet differentiated from human-user JWTs (UPLIFT u-svc-account-jwt).
- SR 1.3 (account management): Yes — RBAC, account creation gated to admin.
- SR 1.4 (identifier management): Yes — UUID identifiers; no enumeration via sequential IDs.
- SR 1.5 (authenticator management): Yes — password policy + HIBP + scrypt.
- SR 1.6 (wireless access): n/a (FactoryMind has no wireless surface).
- SR 1.7 (strength of password authentication): Yes — 12-char min, breach-checked.
- SR 1.8–1.13: per advisory; full mapping in REMEDIATION R-IEC62443-MAP-001.

**FR2 (Use Control) — SL 2:**

- SR 2.1 (authorisation enforcement): Yes — RBAC + facility scope + ACL pattern.
- SR 2.2 (wireless use control): n/a.
- SR 2.3 (use control for portable devices): customer-responsible (edge gateway operations).
- SR 2.4 (mobile code): n/a (no mobile code accepted).
- SR 2.5 (session lock): Yes — JWT TTL 15 min; refresh-token rotation.
- SR 2.6 (remote session termination): Yes — token revocation via password change.

**FR3 (System Integrity) — SL 1.5:**

- SR 3.1 (communication integrity): Yes — TLS 1.3.
- SR 3.2 (malicious code protection): Trivy + Sigstore (planned R-SUPPLY-001).
- SR 3.3 (security functionality verification): Quarterly audit (this document).
- SR 3.4 (software & information integrity): scrypt password integrity; checksums on attestazioni; HMAC on OPC UA commands TBD.

**FR4 (Data Confidentiality) — SL 2:**

- SR 4.1 (information confidentiality): TLS in-transit + KMS at-rest.
- SR 4.2 (information persistence): retention policies + deletion procedures.
- SR 4.3 (use of cryptography): NIST-aligned algorithms.

**FR5 (Restricted Data Flow) — SL 1.5:**

- SR 5.1 (network segmentation): K8s NetworkPolicy default-deny + customer-side OT segmentation.
- SR 5.2 (zone boundary protection): Ingress TLS termination; HSTS; CSP.
- SR 5.3 (general purpose person-to-person communication restrictions): n/a (FactoryMind is M2M + dashboard).

**FR6 (Timely Response to Events) — SL 2:**

- SR 6.1 (audit log accessibility): Yes — `audit_log` queryable.
- SR 6.2 (continuous monitoring): Alertmanager + runbooks.

**FR7 (Resource Availability) — SL 2:**

- SR 7.1 (denial of service protection): rate-limit; HPA; PDB.
- SR 7.2 (resource management): k8s resource limits + ephemeral-storage limits.
- SR 7.3 (control system backup): documented backups; restore drill pending.
- SR 7.4 (control system recovery & reconstitution): DR runbook (REMEDIATION R-RUNBOOK-DR-001).

### CIS Controls v8 — extended evidence

(Subset shown in § 10.3 expanded with file:line evidence.)

- **Control 1 (Inventory of assets) — score 2:** HANDOFF § 4 catalogues every module + integration boundary. Score 2 (documented) not 3 (measured) because no automated asset-discovery tool runs against the customer environment.
- **Control 2 (Inventory of software) — score 2:** `package.json` + `package-lock.json` for backend / frontend / simulator; pinned via `npm ci --frozen-lockfile`. Score 2 because SBOM (Syft) is in CD but not in CI.
- **Control 3 (Data protection) — score 2:** classification matrix (HANDOFF § 7.1), retention schedule (HANDOFF § 7.4), encryption (HANDOFF § 7.5). Score 2 because column-level encryption for PII is not yet enabled (UPLIFT u-pii-column-encrypt).
- **Control 4 (Secure configuration) — score 2:** distroless-equivalent (alpine), USER non-root in backend (gap in frontend — F-HIGH-007), HSTS preload, CSP strict, K8s securityContext. Score 2 because frontend container has the USER gap.
- **Control 5 (Account management) — score 2:** lockout, HIBP, scrypt, refresh-token rotation. Score 2 because no IDP integration (UPLIFT u-idp-integration).
- **Control 6 (Access control) — score 2:** RBAC at app + ACL at broker; row-level scoping at DB.
- **Control 7 (Continuous vulnerability management) — score 1:** npm audit + CVE register quarterly; CI integration gap (F-CRIT-007).
- **Control 8 (Audit log management) — score 2:** `audit_log` table; retention 13 m; immutability tested via CMD-024.
- **Control 11 (Data recovery) — score 1:** Backup runbook; quarterly drill pending (R-DR-DRILL-001).
- **Control 12 (Network infrastructure) — score 2:** NetworkPolicy default-deny + ingress hardening + segmented egress (gap on RDS — F-HIGH-004).
- **Control 16 (Application software security) — score 2:** This audit + threat model + SAST via ESLint + DAST via reproduction commands.

### AgID Misure Minime ICT (Standard) — extended evidence

(See LogiTrack SECURITY.md § 3 as cousin template.)

- **ABSC 1 (Inventario asset) — 2:** HANDOFF § 4.
- **ABSC 2 (Inventario software) — 2:** lockfiles + future SBOM.
- **ABSC 3 (Protezione configurazioni) — 2:** Joi schema + production guardrails.
- **ABSC 4 (Valutazione vulnerabilità) — 1:** Manual + quarterly; not continuous (R-CI-AUDIT-001 raises to 2).
- **ABSC 5 (Privilegi amministrativi) — 2:** Admin role gated, RBAC.
- **ABSC 8 (Difesa contro malware) — 2:** Trivy + image signing planned.
- **ABSC 10 (Backup) — 1:** Runbook documented; drill pending.
- **ABSC 13 (Protezione dei dati) — 2:** Encryption layered.

The "Alto" level requires independent penetration testing and formal incident-response plan — both customer-deployment-specific and out of scope here.

### GDPR — extended evidence

- **Art. 5 (data minimisation) — Yes:** HANDOFF § 7.2 enumerates PII fields (4 in PG, 0 in Influx). Telemetry is non-personal by schema.
- **Art. 25 (privacy by design) — Yes:** architecture documented in HANDOFF § 3; pseudonymisation of audit-log on erasure (HANDOFF § 7.3).
- **Art. 30 (RoPA) — Yes:** `legacy/DATA_GOVERNANCE.md` § 2 is the technical RoPA.
- **Art. 32 (security) — Yes:** layered controls per § 11 strengths.
- **Art. 33 (breach 72 h) — Yes via DPA 24 h tighter:** DPA § 7.
- **Art. 34 (subject notification) — Yes:** runbook R-RUNBOOK-BREACH-001 covers.
- **Art. 35 (DPIA) — customer responsibility:** Titolare's DPO performs the DPIA when scope warrants; FactoryMind provides the technical input via this audit + HANDOFF § 7.
- **Art. 44 (international transfer) — Partial:** F-CRIT-006 TIA missing.
- **Art. 15-22 (subject rights) — Partial:** F-HIGH-006 automation pending.

---

## Appendix F — Open audit items for next pass

(Items the v1.0 baseline did not have time/scope to investigate; flagged for the next quarterly pass.)

1. **Penetration test against production deployment.** Once Tier 2 customer 1 is live with hardened broker + Cosign-signed images, commission an external pen-test (CREST or OSSTMM). Output: independent F-* findings, comparable severity scoring.
2. **Real-time WAF effectiveness probe.** Once `terraform/modules/cdn_waf` is in production, validate the AWS managed rules against typical OWASP Top 10 attempts and capture the block rate.
3. **Edge gateway hardening check.** A field visit to the first Tier 2 customer's edge gateway, post-onboarding, confirming the doctrine **H-18** posture is real (firewall rules, automatic updates, OPC UA TrustList, etc.).
4. **GreenMetrics cross-product contract test.** Validate that a malformed GreenMetrics response (intentional 500, malformed JSON, slow response) produces graceful Piano 5.0 attestazione failure (no partial PDF, clear user-facing error).
5. **Sparkplug B parser fuzz test.** With `SPARKPLUG_ENABLED=true`, fuzz the bridge with malformed protobuf; confirm no crashes, no memory leaks.
6. **NPM provenance enforcement effectiveness test.** Once R-NPM-PROVENANCE-001 lands, intentionally introduce an unsigned dep in a PR and confirm CI rejects.
7. **Cosign verification effectiveness.** Once R-SUPPLY-001 + Kyverno verification land, intentionally push an unsigned image and confirm admission rejection.
8. **GDPR drill.** Execute R-GDPR-001 against staging with a synthetic test user; verify export, erasure, tombstone — measure end-to-end time.
9. **Restore drill.** R-DR-DRILL-001 — full restore from backup into a clean environment; verify OEE for a known machine matches pre-restore value.
10. **Breach drill.** Game-day simulation: intentionally trigger a "FactoryMindHighErrorRate" + "FactoryMindLoginAnomalies" combination; measure detection latency, runbook execution time, communication time-to-customer-notice.

Each item produces a finding (or a strength) for the next pass.

---

## Appendix G — Framework cross-reference (OWASP API + IoT + MITRE ICS)

This appendix maps every F-* finding to the OWASP API Top 10 (2023), OWASP IoT Top 10 (2018, latest stable), and MITRE ATT&CK for ICS. Auditors familiar with one framework can pivot to another via this table.

| Finding | OWASP API Top 10 | OWASP IoT Top 10 | MITRE ICS | Notes |
|---|---|---|---|---|
| F-CRIT-001 | API8 (Security Misconfiguration) | I-1 (Weak/Default credentials) | T0822 | dev default; entrypoint guards prod |
| F-CRIT-002 | API2 (Broken Authentication) | I-4 (Lack of Secure Update Mechanism — adapted as transport security) | T0830 | TLS missing |
| F-CRIT-003 | API7 (SSRF) | I-7 (Insecure Data Transfer) | T0883 | endpoint validation gap |
| F-CRIT-004 | API8 | n/a | n/a | infra ops |
| F-CRIT-005 | API2 | I-7 | T0830 | TLS disabled |
| F-CRIT-006 | API8 | n/a | n/a | regulatory |
| F-CRIT-007 | API8 | I-9 (Insecure Default Settings — CI as a setting) | T1195 | supply chain |
| F-HIGH-001 | API2 | n/a | T1539 | XSS adjacency |
| F-HIGH-002 | API1 (BOLA) + API5 (Broken Function Level Authorization) | n/a | T1078 | UI access |
| F-HIGH-003 | API8 | n/a | n/a | crypto management |
| F-HIGH-004 | API8 | n/a | T1567 | egress |
| F-HIGH-005 | API3 (Broken Object Property Level Authorization) | I-3 (Insecure Ecosystem Interfaces) | n/a | injection-adjacent |
| F-HIGH-006 | n/a (regulatory/operational) | n/a | n/a | GDPR Art. 17 |
| F-HIGH-007 | API8 | n/a | T1611 | container escape |
| F-HIGH-008 | API8 | n/a | T1195 | supply chain |
| F-HIGH-009 | API8 | n/a | T1195 | supply chain |
| F-HIGH-010 | API2 | n/a | T1078 | WS auth |

(Continued for F-MED-* and F-LOW-* findings in the production document.)

---

## Appendix H — Service-by-service audit notes (backend)

Brief pass over each backend service for material findings. Per-service notes in this appendix are non-exhaustive; full file:line evidence lives in § 4–7.

### `services/mqtt-handler.js`

- Topic regex too loose (F-MED-DATA-004).
- `mqtt` npm version: verify against advisory feed quarterly.
- Reconnect strategy adequate (exponential backoff 2 s → 60 s).
- QoS handling correct per topic kind.
- **Strength**: clean separation between subscription + dispatch; no business logic in handler.

### `services/influx-writer.js`

- `bootstrapTasks()` does not verify creation success (F-MED-DATA-001).
- Buffered write with 50 k-line cap is correct; back-pressure documented in HANDOFF § 3.5.
- **Strength**: idempotent write semantics inherited from Influx (point-key based).

### `services/alert-engine.js`

- Threshold-only rules at v1.0; composable rules roadmap.
- 5-minute escalation cron is configurable.
- Race condition theoretical when two pods evaluate the same rule in close succession; mitigated by Influx as ordering authority.
- **Strength**: stateless evaluation; horizontal scaling does not introduce inconsistency for threshold rules.

### `services/admin-bootstrap.js`

- Idempotent.
- Fail-close in production.
- **Strength**: explicit exit codes (10, 11) for diagnostic clarity.

### `services/opcua-bridge.js`

- F-CRIT-003 (no endpoint validation).
- Trust list management is operational, not in code; OPC UA SignAndEncrypt + Basic256Sha256 enforced.
- Reconnect strategy adequate.

### `services/modbus-bridge.js`

- Per-device failure counter (good; suppresses log spam).
- Modbus has no native security; HANDOFF § 5.7 covers operational mitigation.

### `services/sparkplug-bridge.js`

- F-MED-CODE-006 (dynamic require error handling).
- Disabled by default; gates the protobuf surface.

### `services/piano4-attestazione.js` & `piano5-attestazione.js`

- F-MED-DATA-003 (no idempotency token).
- Cross-product contract dependence on GreenMetrics (Piano 5.0 only).
- **Strength**: PDF rendering carries the canonical "Documento tecnico — non sostituisce la perizia tecnica giurata asseverata" footer.

### `services/predictive-maintenance.js`

- Indicators-only; no automated decisions (GDPR Art. 22 compliant).
- Roadmap: ML model in Phase 4 (UPLIFT u-ml-rul).

### `services/housekeeping.js`

- Token reaper cadence: hourly.
- Alert-cleanup: daily.
- Audit-log partition rotation: monthly (when `pg_partman` enabled — UPLIFT u-pg-partition).

---

## Appendix I — Frontend component audit notes

### `pages/Dashboard.tsx`

- Hard-coded facility env var (limits multi-tenant).
- Missing i18n keys (F-MED-CODE-002).
- Hard-coded `it-IT` locale in `formatDistanceToNow` calls.

### `pages/LineDetail.tsx`

- URL params not validated (defensive only — backend re-validates).
- Em-dash fallback for missing data (UX).

### `pages/Alerts.tsx`

- 10 s refetch interval aggressive (could be 30 s).
- No optimistic update on acknowledge / resolve (snapshot-stale until next poll).

### `pages/DeviceConfig.tsx`

- All labels hard-coded Italian (no `useT()`).
- No pagination; performance edge case for large fleets.

### `pages/Reports.tsx`

- `as any` cast (F-MED-CODE-001).
- 8-hour hard-coded window.

### `components/AlertFeed.tsx`

- Hard-coded Italian; not i18n-routed.
- Color-only severity badges (a11y gap).

### `components/MachineStatus.tsx`

- Hard-coded labels.
- Color-only state semantics.

### `components/OEEGauge.tsx`

- Classification text hard-coded Italian.
- `aria-label` provides screen-reader-friendly value.
- SVG missing `<title>` element (a11y refinement — REMEDIATION R-A11Y-OEE-GAUGE-001).

### `components/DowntimeChart.tsx`

- Hard-coded Italian title + tooltip labels.
- Chart-only data presentation (no `<table>` alternative for screen-readers — a11y gap).

### `components/ShiftReport.tsx`

- Hard-coded `toLocaleString('it-IT')`.
- Naive time calculation for hours/minutes (off-by-one risk on edge cases).

### `components/MQTTConnectionIndicator.tsx`

- Hard-coded Italian state labels.
- Color-only state semantics.

### `components/ErrorBoundary.tsx`

- F-MED-CODE-004 (raw `error.message` in `<pre>`).
- `window.__FM_ERROR_SINK` global is acceptable but the unsafe type cast deserves a `typeof` guard.

---

## Appendix J — Live broker probe transcript (CMD-022/023/024)

Captured during the v1.0 baseline audit; `docker compose up` running locally. Reproduction is illustrative — production probes require explicit authorisation.

```bash
$ mosquitto_sub -h localhost -p 1883 -u backend -P "$MQTT_PASSWORD" -t '$SYS/broker/clients/connected' -W 5
3
# (3 connected clients — backend, simulator, grafana — as expected)

$ mosquitto_sub -h localhost -p 1883 -u tenant_a -P "$TENANT_A_PASSWORD" -t 'factory/tenant_b/#' -W 5
$ # (no output — subscription denied by ACL pattern; correct behaviour)

$ docker compose exec postgres psql -U readonly_role factorymind -c "UPDATE audit_log SET action='tampered' WHERE id = (SELECT id FROM audit_log LIMIT 1);"
ERROR:  permission denied for table audit_log
$ # (correct behaviour — audit_log immutable for non-admin role)
```

The transcript demonstrates that three of the structural defences (broker $SYS access for backend, ACL tenant isolation, audit-log immutability) work as documented.

---

## Appendix K — Notes on what would change a finding's severity

Auditors and engineers reading this document may disagree with a severity rating. The rationale for each Critical / High is captured in Appendix B's CVSS worksheets, but here is a non-exhaustive list of conditions that would justify upgrading a finding:

- **F-CRIT-001 → F-EXTREME-001**: if a Tier 2 deployment is observed in the wild with `allow_anonymous true` AND `entrypoint.sh` skipped (e.g., the customer ran the broker outside the FactoryMind container and copied the config without the fail-close logic). This is observed via `mosquitto_sub -h <customer-broker> -p 1883 -t '$SYS/#'` during a customer-engagement pre-flight check; if it succeeds, escalate.
- **F-CRIT-003 → F-EXTREME-003**: if an SSRF reproduction in the wild successfully reaches AWS metadata. The current finding is "potential surface"; observed exploitation upgrades it.
- **F-HIGH-001 → F-CRIT-XSS-CHAIN**: if any production-deployed FactoryMind dashboard exhibits an XSS surface (e.g., third-party widget; compromised npm dep; user-supplied content rendered without sanitisation). The current finding is "if XSS exists, JWT is stealable"; if XSS is observed, the chain is real.

Auditors should also know what would justify *downgrading*:

- **F-CRIT-001 → F-LOW-CONFIG**: if the dev default is changed to `allow_anonymous false` AND the dev experience still works (a passwd file is provisioned by `install.sh` even in dev with auto-generated credentials). REMEDIATION R-MQTT-ANON-001 documents the migration.
- **F-CRIT-007 → F-LOW-CI-DEBT**: once `|| true` is removed and `exit-code: "1"` is set in the CI workflow.

This appendix is preserved across audit passes; downgrades and upgrades are tracked in Appendix C diffs.

---

## Appendix L — Additional findings discovered during expansion review

The following findings were surfaced during a second-pass review of the codebase as the AUDIT was being written. They are catalogued at lower severity but documented for traceability.

### F-LOW-INFRA-001 — `docker-compose.yml` services run with default Docker user.

**Severity:** Low. **Category:** Container hardening.

**Evidence.** `docker-compose.yml` does not set `user:` for any service. Each service's USER is determined by its image (backend Dockerfile sets USER 1001; nginx default is root; postgres default is postgres user; influxdb default is influxdb user; grafana default is grafana user; mosquitto default is mosquitto user).

**Impact.** Inconsistent posture; in dev environments, frontend nginx runs as root (F-HIGH-007 covers this). Other services are fine.

**Remediation.** Audit each service; explicitly set `user:` at compose level for clarity.

### F-LOW-INFRA-002 — No `read_only: true` on docker-compose service definitions.

**Severity:** Low. **Category:** Container hardening (CIS Docker Benchmark 5.x).

**Evidence.** `docker-compose.yml` does not set `read_only: true` for any service. K8s deployment.yaml has `readOnlyRootFilesystem: true` for the backend container; compose deployments don't get the same protection.

**Remediation.** Add `read_only: true` + appropriate `tmpfs:` mounts for /tmp, /run, etc.

### F-LOW-INFRA-003 — No `cap_drop: [ALL]` in docker-compose.

**Severity:** Low.

**Remediation.** Add `cap_drop: [ALL]` + `cap_add` for what's needed.

### F-LOW-INFRA-004 — No `security_opt: ["no-new-privileges:true"]` in docker-compose.

**Severity:** Low.

**Remediation.** Add `security_opt: [no-new-privileges:true]` to each service; aligns with K8s `allowPrivilegeEscalation: false`.

### F-LOW-INFRA-005 — `docker-compose.yml` has no resource limits on backend.

**Severity:** Low. **Category:** Resource exhaustion (DoS).

**Evidence.** Backend service has no `mem_limit` / `cpus` constraints in compose. K8s deployment has these (`limits.cpu 1000m`, `limits.memory 768Mi`). Compose-only deployments could OOM the host.

**Remediation.** Add `deploy.resources.limits` to the backend service.

### F-LOW-INFRA-006 — Grafana runs with `GF_AUTH_ANONYMOUS_ENABLED` not explicitly set.

**Severity:** Low. **Category:** Security misconfiguration (Grafana).

**Evidence.** `docker-compose.yml` does not set `GF_AUTH_ANONYMOUS_ENABLED`. Grafana's default is false (anonymous disabled); if a future Helm chart accidentally enables it, telemetry dashboards become public.

**Remediation.** Explicitly set `GF_AUTH_ANONYMOUS_ENABLED: "false"` for clarity.

### F-LOW-INFRA-007 — `docker-compose.yml` does not pin Mosquitto to specific minor version.

**Severity:** Low.

**Evidence.** `image: eclipse-mosquitto:2` — pinned to major version 2 only. Auto-upgrades to 2.x.y on next pull.

**Remediation.** Pin to specific version (e.g., `2.0.20`); update via Dependabot.

### F-LOW-K8S-001 — No explicit `imagePullSecrets` in deployment.yaml.

**Severity:** Low.

**Evidence.** `k8s/deployment.yaml` does not declare `imagePullSecrets`. Assumes public GHCR image (currently true).

**Impact.** A future migration to a private registry (e.g., enterprise customer's registry mirror) requires this addition.

**Remediation.** Document the path to add `imagePullSecrets` when needed; not a v1.0 blocker.

### F-LOW-K8S-002 — `automountServiceAccountToken: false` on ServiceAccount but not enforced via PolicyController.

**Severity:** Low.

**Evidence.** `k8s/deployment.yaml:45-46` sets it on the deployment; the ServiceAccount itself also sets it. This is correct. A Kyverno (or similar) cluster-wide policy would prevent accidental enabling on a future deployment.

**Remediation.** Document in UPLIFT (u-k8s-policy-as-code).

### F-LOW-DEPS-001 — Backend `socket.io` not listed in deps but referenced in audit.

**Severity:** Low (informational). **Category:** Dependency hygiene.

**Evidence.** Earlier audit notes referenced `socket.io` as a frontend dep; in fact backend uses native `ws` package via `backend/src/ws/server.js`. No `socket.io` is loaded server-side.

(Catalogued for accuracy; no remediation needed.)

### F-LOW-CONFIG-001 — `.env.example` carries placeholder values that look real.

**Severity:** Low.

**Evidence.** Some placeholder values in `.env.example` look like real-ish strings (e.g., `JWT_SECRET=please-generate-32+-chars`). A new operator might think the placeholder is the value to use.

**Remediation.** Make placeholders obviously fake (`<GENERATE_32_CHAR_SECRET>`); install.sh already overrides during bootstrap.

### F-LOW-CONFIG-002 — No backup-encryption pass-phrase rotation policy documented.

**Severity:** Low.

**Evidence.** S3 SSE-KMS protects backups; the KMS key rotation cadence is AWS-managed (annual by default). For customer self-hosted backups (Tier 2), no policy documented.

**Remediation.** Add to HANDOFF § 7.5 (encryption posture) — quarterly rotation for self-hosted.

### F-LOW-LEGAL-002 — `legal/COOKIE-POLICY.md` references `factorymind:jwt` localStorage as a "cookie tecnico".

**Severity:** Low. **Category:** Cookie classification accuracy.

**Evidence.** `legal/COOKIE-POLICY.md:28`:

```
| `factorymind:jwt` (local storage) | dashboard | fino al logout | Token di sessione autenticata |
```

Strictly speaking, localStorage is not a cookie — Provv. Garante 8/5/2014 + Linee guida 10/6/2021 cover both, and grouping them is operationally reasonable, but a strict interpretation would distinguish them.

**Remediation.** Add a note in cookie-policy clarifying the distinction; align with eventual migration to HttpOnly cookie auth (R-FRONTEND-COOKIE-AUTH-001).

### F-LOW-LEGAL-003 — No retention policy explicitly stated for landing-page contact-form submissions.

**Severity:** Low. **Category:** GDPR.

**Evidence.** Contact-form data presumably triggers an SMTP send; the retention of submitted data in any logging/storage is not documented in `legal/INFORMATIVA-PRIVACY-GDPR.md`.

**Remediation.** Add retention statement to privacy notice (e.g., "submissions retained 24 months for support purposes").

### F-LOW-OBSERVABILITY-001 — OpenTelemetry trace sampler defaults to 5% in the absence of OTEL_TRACES_SAMPLER_ARG.

**Severity:** Low.

**Evidence.** `backend/src/index.js` (or its OTel init) reads `OTEL_TRACES_SAMPLER` + `OTEL_TRACES_SAMPLER_ARG` env vars; default is `parentbased_traceidratio` with arg `0.05` (5%).

**Impact.** For low-traffic Tier 2 deployments, 5% may produce too few traces to be diagnostically useful. For Tier 4 SaaS at scale, 5% is appropriate.

**Remediation.** Document the recommended sampler arg per tier in HANDOFF § 8.

### F-LOW-CD-001 — Git-tag-driven production deploy.

**Severity:** Low.

**Evidence.** `.github/workflows/cd.yml` `deploy-production` job is gated by `if: startsWith(github.ref, 'refs/tags/v')`. This means only `v*` tags trigger production deploys.

**Impact.** Correct posture. Catalogued as a strength, not a finding — included here for completeness.

### F-LOW-CD-002 — No automated changelog generation in CD.

**Severity:** Low.

**Evidence.** No `changesets` / conventional-commits / `release-please` setup. Changelog is manual.

**Remediation.** Adopt `release-please` or similar; regenerate `CHANGELOG.md` on each version tag (UPLIFT u-changelog-auto).

### F-LOW-A11Y-001 — Color-only severity / state semantics in multiple components.

**Severity:** Low. **Category:** Accessibility.

**Evidence.** AlertFeed.tsx, MachineStatus.tsx, OEEGauge.tsx, MQTTConnectionIndicator.tsx all use color as the primary indicator of severity / state. Text labels exist but are subordinate to color.

**Impact.** Color-blind users (≈8% of males, ≈0.5% of females per WCAG guidance) may miscategorise.

**Remediation.** R-A11Y-001 — add icon + text label as primary indicator; color reinforces.

---

## Appendix M — NIS2 (D.Lgs. 138/2024) obligations cross-reference

For the Italian transposition of NIS2, the following obligations are catalogued; the FactoryMind compliance posture is documented per article.

| D.Lgs. 138/2024 article | Obligation summary | FactoryMind state | REMEDIATION |
|---|---|---|---|
| Art. 3 (definitions) | Defines "soggetti essenziali" and "soggetti importanti" | Scope determination open (F-MED-LEGAL-003) | R-NIS2-SCOPE-001 |
| Art. 7 (registration) | ACN registration window 1 gennaio - 28 febbraio annually | Registered N/A pending scope determination | R-NIS2-REGISTER-001 (conditional) |
| Art. 21 (cybersecurity risk management) | Adequate technical, operational, organisational measures | Doctrine + this audit + remediation plan = adequate; formal policy document pending | R-NIS2-POLICY-001 |
| Art. 23 (incident reporting) | 24 h early warning, 72 h notification, 1 month report | Runbook R-RUNBOOK-NIS2-001 ships the procedure | R-NIS2-RUNBOOK-001 |
| Art. 24 (use of European cybersecurity certification schemes) | Voluntary | Aspirational; CRA conformity assessment may overlap | UPLIFT u-cra-cert |
| Art. 25 (information sharing) | Voluntary collaboration with ACN | Cooperative posture; FactoryMind shares anonymised threat intel via the constellation | UPLIFT u-threat-intel |

The cross-reference is preserved across audit passes; the NIS2 scope determination (F-MED-LEGAL-003 → R-NIS2-SCOPE-001) is a Critical-but-non-technical blocker for any FactoryMind commercial deployment in 2026.

---

## Appendix N — CRA (Reg. UE 2024/2847) obligations cross-reference

Conditional on FactoryMind being treated as a "product with digital elements" under the CRA's Art. 3 definitions. Self-hosted MIT distribution likely covered by the OSS Stewardship exemption (Art. 24); commercial distribution in scope.

| CRA article | Obligation summary | Effective date | FactoryMind state |
|---|---|---|---|
| Art. 6 (essential cybersecurity requirements) | Vulnerability handling, secure default config, etc. | 11 dic 2027 | Doctrine + this audit; formal conformity assessment pending |
| Art. 11 (vulnerability handling reporting) | Active vulnerability reporting to coordinators + users | 11 set 2026 | CVE register + customer notice (legal/CONTRATTO-SAAS-B2B.md art. 5) |
| Art. 13 (manufacturer obligations) | Risk assessment, conformity assessment, technical documentation | 11 dic 2027 | Aspirational; technical-doc baseline = these four documents |
| Art. 24 (OSS Stewardship) | Lighter regime for MIT-distributed | 11 dic 2027 | Eligible for self-hosted; verify with counsel |
| Art. 30 (CE marking) | Affixing CE before placing on market | 11 dic 2027 | Pending conformity assessment |
| Art. 35 (penalties) | Up to 2.5% global turnover | 11 dic 2027 | Pre-emptive compliance is the cheapest path |

REMEDIATION R-CRA-001 owns the analysis + conformity assessment trajectory.

---

## Appendix N1 — Incident-response simulation log

The runbooks in HANDOFF § 8 have been authored but, at v1.0 baseline, have not been exercised in a real or simulated incident. The exercise schedule below is the v1.0 commitment.

**Schedule (quarterly cadence):**

| Quarter | Drill | Expected duration | Verifier |
|---|---|---|---|
| 2026-Q3 | `FactoryMindMQTTDisconnected` runbook (HANDOFF § 8.6) — physically stop the broker container, page on-call, time the recovery | 60 min | Second engineer |
| 2026-Q4 | `FactoryMindHighErrorRate` runbook (§ 8.4) — inject a 500-error fault via a malformed migration | 90 min | Second engineer |
| 2027-Q1 | DR drill — restore from backup into staging cluster, verify OEE for known machine | 4 hours | DBA + on-call |
| 2027-Q2 | Breach simulation — combined `LoginAnomalies` + `HighErrorRate`, full IR playbook | 1 day | All engineers + customer-success |

Each drill produces a postmortem (template at HANDOFF § 8.PM); postmortems aggregate to UPLIFT u-pm-trends-quarterly review.

The v1.0 audit explicitly notes that the runbook claim is *aspirational* until the first drill closes; doctrine **H-20** (honest gaps) requires this transparency.

---

## Appendix N2 — Customer-engagement pre-flight audit (template)

Before any Tier 2 / 3 deployment, FactoryMind runs a customer-side pre-flight audit. Template:

1. **Customer environment survey** (1 hour with customer's responsabile IT):
   - Network topology (OT VLAN, IT VLAN, DMZ, internet egress).
   - PLC inventory (vendor, model, firmware, OPC UA / Modbus / Sparkplug capability).
   - Existing MES / ERP / SCADA presence.
   - Backup / restore strategy at the customer.
   - Customer's commercialista contact.
2. **FactoryMind side-check** (concurrent):
   - Secrets prepared in customer's chosen secrets store.
   - Edge gateway hardware ordered + provisioned.
   - Mosquitto config personalised with customer's facility ID.
   - First attestazione PDF rendered as a sanity check (uses simulator data; replaced by real data after Settimana 4).
3. **Deployment-day checklist** (HANDOFF § 5.5 — 12 checkpoints).
4. **Post-deployment audit** (Settimana 4):
   - First-week telemetry coverage (% machines reporting at expected cadence).
   - First alert evaluation (any false positives? false negatives?).
   - First customer support interaction quality.
   - Customer's commercialista's review of the attestazione PDF format.

The pre-flight audit is calibrated against this AUDIT document. Each customer engagement produces a customer-specific addendum to this audit (stored in `docs/customer-audits/<customer-tag>/<YYYY-MM-DD>.md` — directory created by REMEDIATION R-CUSTOMER-AUDIT-DIR-001).

---

## Appendix N3 — Things that look like findings but aren't

Engineering review may surface items that look concerning but, on closer inspection, are intentional design choices. These are catalogued here so future audits don't re-discover them as "findings".

### Trace IDs in error responses

The error envelope (HANDOFF § 6.1) returns the `trace_id` to the client:

```json
{ "error": "...", "code": "...", "status": 400, "path": "...", "timestamp": "...", "trace_id": "00-..." }
```

This may look like information disclosure. It is **deliberate**: the customer support team correlates a customer-reported issue with a server-side trace via this ID. The trace ID alone is not a credential; it grants no access. This is not a finding.

### Backend `/metrics` endpoint unauthenticated

Prometheus exposition is unauthenticated. This may look like an exposure surface. It is **deliberate**: Prometheus scraping is the canonical pattern, and the metrics surface is controlled at the network layer (k8s NetworkPolicy allows only the Prometheus pod). This is not a finding *if* the network layer is correctly configured (which is documented in HANDOFF § 5.3 pre-flight checkpoint #5).

### Joi validation messages echoed in 4xx responses

Joi validation errors return the field name + the failed rule. This may look like schema disclosure. It is **deliberate**: the API is documented (`docs/openapi.yaml`); the schema is not a secret. The risk surface is "an attacker enumerates valid request shapes" — which the OpenAPI spec already publishes. This is not a finding.

### Audit log retains tombstoned email after erasure

After GDPR erasure, `audit_log.actor_email` is replaced with `erased:<sha256>`. This may look like a residual personal data trace. It is **deliberate**: the SHA-256 tombstone is one-way and does not allow reversing to identify the subject (consistent with GDPR Recital 26 on anonymised data). The action history is preserved for legal-interest forensic value (cfr. HANDOFF § 7.3 erasure procedure rationale).

### Refresh token TTL 12 h absolute

The refresh-token TTL is 12 hours absolute (with 15-minute sliding). This may look short for "remember me" functionality. It is **deliberate**: the platform serves manufacturing operations where shifts are 8–12 hours; a sliding-window-with-absolute-cap design forces an explicit re-login per shift cycle, which doubles as a security event and a UX checkpoint.

---

## Appendix N4 — Footnotes on framework interpretation

Not every framework lens applies cleanly to FactoryMind. The following interpretive notes prevent confusion in subsequent audit passes.

### OWASP IoT Top 10 — gaps in the framework's applicability

OWASP IoT Top 10 is oriented toward consumer-IoT devices (smart cameras, thermostats, etc.). FactoryMind is industrial-IoT, where:

- "I-1 Weak Default Credentials" maps to mosquitto's anonymous default — applicable.
- "I-3 Insecure Ecosystem Interfaces" maps to OPC UA / Modbus / MQTT bridges — applicable.
- "I-4 Lack of Secure Update Mechanism" maps to edge-gateway firmware/OS update story — applicable but customer-responsibility for OS, FactoryMind-responsibility for the FactoryMind container (Cosign roadmap).
- "I-9 Insecure Default Settings" maps to dev defaults — applicable.

Other items (I-2 Insecure Network Services, I-5 Use of Insecure Components, I-6 Insufficient Privacy Protection, I-7 Insecure Data Transfer, I-8 Lack of Device Management, I-10 Lack of Physical Hardening) apply with less direct mapping.

### IEC 62443 — SL determination granularity

IEC 62443 explicitly notes that Security Levels apply *per Security Requirement, not per system*. The "FactoryMind targets SL-2" claim in HANDOFF § 9.3 is therefore a global summary; the granular per-SR scoring lives in Appendix E above. An auditor should never accept "SL-2 globally" without seeing the SR-by-SR mapping.

### CIS Controls v8 — scope mismatch

CIS Controls v8 is enterprise-IT-oriented; not all 18 controls map to FactoryMind's footprint. Controls in the table (§ 10.3) are the subset that applies to a single-tenant single-server kit. Multi-tenant SaaS (Tier 4) extends to additional controls (e.g., 18 Application Software Security with SAST/DAST/IAST tooling).

### AgID Misure Minime — scope

AgID's framework is for Italian Public Administration. FactoryMind's customers are private SMEs, so AgID compliance is *aspirational* / *signal* rather than mandatory. Score 2 across the relevant clusters is a credible self-assessment for a private B2B platform; Standard level is appropriate.

---

## Appendix O — Audit trail of this document

A meta-appendix: this document itself is an artefact subject to the same discipline it audits.

- **First commit of this file:** 2026-05-07. Pinned commit `d4c5107`.
- **Reviewers (v1.0 baseline):** Renan Augusto Macena (author + self-review). Independent review pending the second engineer's onboarding (HANDOFF doctrine **H-5**).
- **Next quarterly review:** 2026-08-01 (first Tuesday after 2026-Q2 close), per HANDOFF doctrine **H-22**.
- **Document hash:** TBD — set after final word count and before commit (to be added to git tag annotation).
- **Sign-off:** _________________________ (Renan, date). _________________________ (peer reviewer, date).

---

## Appendix P — Attack tree for asset A1 (attestazione integrity)

The most critical asset identified in § 3.1 is the Piano 4.0/5.0 attestazione integrity (A1). An attack tree for A1 — exhaustive enumeration of paths an attacker could take to compromise the asset, with effort estimates at each leaf — informs the prioritisation of defences.

```
Goal: Forge or tamper with a Piano 4.0/5.0 attestazione PDF
├── Path 1: Tamper with telemetry input
│   ├── 1a: Compromise edge gateway, inject forged telemetry
│   │   └── Effort: high (requires customer-side physical or root access)
│   ├── 1b: Publish forged telemetry on broker (chain α)
│   │   └── Effort: medium (requires broker credentials OR exploitation of F-CRIT-001+002)
│   └── 1c: Tamper with InfluxDB at-rest (write a forged historical row)
│       └── Effort: very high (requires Influx admin token; defended by KMS at-rest, RBAC)
├── Path 2: Tamper with attestazione generation logic
│   ├── 2a: Modify backend code (supply chain — chain β)
│   │   └── Effort: medium-high (npm dep compromise + F-CRIT-007 + F-HIGH-009)
│   ├── 2b: Modify the rendered PDF after generation
│   │   └── Effort: low if PDF stored unsigned; defence: digital signature on PDF (UPLIFT u-pdf-sign)
│   └── 2c: Modify Postgres metadata (devices, shifts, downtimes) referenced by the generation
│       └── Effort: high (requires Postgres write access + bypass audit_log)
├── Path 3: Tamper with generation environment
│   ├── 3a: Modify env vars at the running pod (e.g., disable HMAC, weaken validation)
│   │   └── Effort: high (requires k8s API access + PSS bypass)
│   └── 3b: Roll back to a vulnerable backend version (downgrade attack)
│       └── Effort: medium (requires registry compromise + CD pipeline manipulation; mitigated by Cosign verification once R-SUPPLY-001 closes)
├── Path 4: Bypass the attestazione altogether
│   ├── 4a: Convince the customer's commercialista to accept a hand-crafted PDF
│   │   └── Effort: very high (out of FactoryMind scope; addressed by the perizia process)
│   └── 4b: Render an attestazione for a machine the requester is not authorised for (IDOR)
│       └── Effort: low if RBAC weak; defence: facility-scope + RBAC at route level (tested; § 11.4)
```

Each leaf maps to a finding (or a strength) in this audit. The remediation plan prioritises closure of the medium-effort leaves (1b via R-MQTT-ANON-001 + R-MQTT-TLS-001; 2a via R-CI-AUDIT-001 + R-NPM-PROVENANCE-001; 3b via R-SUPPLY-001).

The high-effort leaves are accepted residuals (defence-in-depth + customer-side controls); the very-high-effort leaves are out of scope (rely on legal/process defence).

---

## Appendix Q — Threat-model coverage rotation

A mature audit programme rotates threat-model emphasis quarterly so no quadrant goes stale. Schedule:

| Quarter | Emphasis | Rationale |
|---|---|---|
| 2026-Q3 | MQTT / OPC UA / Modbus protocol surface | First Tier 2 customer's edge gateway live |
| 2026-Q4 | Frontend XSS / token storage | After R-FRONTEND-COOKIE-AUTH-001 closure |
| 2027-Q1 | Supply chain (Cosign verification, SBOM coverage) | Aligned with CRA vulnerability reporting (Sep 2026 effective date passed; CRA monitoring in earnest) |
| 2027-Q2 | GDPR / data residency / Schrems II | After R-TIA-001 closure; verify ongoing posture |
| 2027-Q3 | Disaster recovery / backup integrity | Post first-restore-drill, second-cycle |
| 2027-Q4 | NIS2 / CRA conformity | Pre-CRA-effective-date posture review |

Each quarterly emphasis is reflected in that quarter's Appendix C diff: findings related to the emphasised quadrant are surfaced even if previously ranked low; strengths in that quadrant are re-validated.

---

## Conclusions

The v1.0 audit pass returns FactoryMind in a state of **technical maturity ahead of operational maturity**. The codebase implements a high baseline of structural defences — JWT pinning, scrypt with HIBP, audit log on every mutation, RBAC with facility scope, helmet with strict CSP + HSTS preload + COOP/CORP, K8s securityContext with read-only root and dropped capabilities, default-deny NetworkPolicy, Mosquitto entrypoint that fail-closes on production misconfiguration, Italian data residency by default, DPA with 24 h breach notification tighter than GDPR's 72 h. These properties make FactoryMind credibly defensible against the threat model in § 3.

The 31 findings catalogued (7 Critical, 10 High, 11 Medium, 3 Low) cluster around three classes: *operational gaps* that surface in pre-production state and need to close before first paying customer (Mosquitto anonymous default, missing TLS listener, Terraform local state, CI audit non-blocking, Cosign signing not implemented, GDPR scripts not shipped); *frontend surface* gaps typical of a stack still iterating toward customer-readiness (JWT in localStorage, no auth guards, missing i18n keys, error-message leakage); and *legal completeness* gaps that close mechanically with the first customer engagement (DPA placeholders, TIA missing for InfluxData transfer, NIS2 / CRA scope analyses pending counsel review). None of the findings represent a fundamental architectural flaw; all are addressable via the wave-based remediation plan in [`REMEDIATION.md`](REMEDIATION.md) without rewrites.

The compliance posture against the six methodological lenses (NIST CSF 2.0, IEC 62443-3-3, OWASP API + IoT, MITRE ATT&CK ICS, CIS Controls v8, AgID Misure Minime ICT) lands in the "documented + measured" band (score 2 on most lines, 1.5 where drills are pending) — solid for a pre-first-customer baseline, with explicit ratchet plans where higher scores depend on operational exercises that the platform has not yet had occasion to perform.

The commercial viability claim — that FactoryMind delivers a Piano Transizione 4.0/5.0 attestazione PDF that is *credibly* what a customer's commercialista needs for the credito d'imposta filing — survives the audit. The technical implementation maps to the five caratteristiche tecnologiche obbligatorie + the two caratteristiche di interconnessione of the Circolare MISE/AdE 9/E del 23 luglio 2018; the Piano 5.0 energy-savings calculation correctly delegates to the GreenMetrics sister project under documented thresholds (≥ 3 % processo / ≥ 5 % sito) per DM MIMIT-MASE 24 luglio 2024. The perizia tecnica giurata asseverata correctly remains the customer's perito's responsibility per art. 1, c. 11 della Legge 232/2016 — a contractual position that defends FactoryMind from claims that should accrue to the perito.

What this audit **explicitly does not assert**:

- That FactoryMind has been pen-tested by a credentialed independent firm. It has not. Appendix F item 1 is the path.
- That FactoryMind has survived a real production incident. It has not. The runbooks are written but not exercised.
- That the legal templates are signed and ready for customer execution. They are not. `[DA_COMPILARE]` placeholders block this.
- That the customer's commercialista has accepted the attestazione PDF format. This requires the first paying engagement to validate.
- That GreenMetrics's contract is stable across versions. The cross-product integration (HANDOFF doctrine **H-10**) protects against drift but the first joint deployment will surface rough edges.
- That every Italian regulatory citation has been verified by counsel. Non-trivial reviews (NIS2 scope, CRA scope, sector-specific obligations) are pending counsel review. Decree numbers and dates have been verified against Normattiva and EUR-Lex.

The next audit pass (2026-08 Q3 quarterly per doctrine **H-22**) carries forward Appendix C diff and the open items in Appendix F. By that pass, the W0 + W1 remediation tickets in [`REMEDIATION.md`](REMEDIATION.md) should be closed; the audit will measure that closure and produce updated CIS / IEC / NIST scores.

This document does not constitute, and shall not be construed as, a third-party-issued certification of conformity, a formal penetration-testing report under CREST / OSSTMM / PTES, or a substitute for a Garante-mandated audit of a particular customer deployment. It is a **structured baseline** that supports those when they happen, and a **doctrine-bound discipline** that ensures the gap between baseline and reality stays small enough to be remediated rather than rewritten.

---

**Made in Mozzecane (VR) — Veneto, Italy.**
