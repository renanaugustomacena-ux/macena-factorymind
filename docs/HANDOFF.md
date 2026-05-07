# FactoryMind — Software Handoff & Operations Manual

**Versione:** 1.0.0 (baseline)
**Data di pubblicazione:** 2026-05-07
**Owner editoriale:** Renan Augusto Macena (Mozzecane, VR)
**Owner tecnico:** Lead engineer FactoryMind (assigned at hire)
**Owner commerciale:** founder / CEO
**Pinned commit:** `d4c5107` (initial commit — FactoryMind Industrial IoT/OEE platform)
**Supersedes:** `docs/legacy/MODUS_OPERANDI.md` (parts I, II, IV — technical and operational sections), `docs/legacy/ARCHITECTURE.md`, `docs/legacy/API.md` (prose companion of `docs/openapi.yaml`), `docs/legacy/SLO.md`, `docs/legacy/DATA_GOVERNANCE.md`, `docs/legacy/A11Y.md`, parts of `docs/legacy/ITALIAN-COMPLIANCE.md`. Commercial sections of MODUS_OPERANDI live in `UPLIFT.md` (Track Commercial / Roadmap) and in the unversioned `moneyplan.txt` at repository root.
**Companion documents:** [`AUDIT.md`](AUDIT.md), [`REMEDIATION.md`](REMEDIATION.md), [`UPLIFT.md`](UPLIFT.md). Machine-readable API spec: [`openapi.yaml`](openapi.yaml).
**Sign-off line:** _________________________ (date) _________________________ (signature)

**Revision triggers (this document is rebuilt or amended when):**

1. A new Legge di Bilancio modifies Piano Transizione 4.0 / 5.0 thresholds, percentage bands, or eligibility characteristics.
2. Any nuova Circolare MIMIT, MASE, or Agenzia delle Entrate alters the technical requirements of the Piano 4.0 / 5.0 attestazione.
3. The European Cyber Resilience Act (Reg. UE 2024/2847) crosses one of its applicability dates: 11 settembre 2026 (vulnerability handling reporting), 11 dicembre 2027 (full applicability).
4. The Italian transposition of NIS2 (D.Lgs. 4 settembre 2024, n. 138, GU 230 del 1 ottobre 2024) extends scope to FactoryMind-deployed environments.
5. A Critical or High finding in `AUDIT.md` requires a new operational procedure or invalidates a documented one.
6. A core dependency (Mosquitto, InfluxDB, PostgreSQL, Node.js, Express, React, Vite, Grafana) crosses a major version where breaking changes touch the FactoryMind contract.
7. The cross-product integration map (§ 10) gains or loses a sister project (`macena-greenmetrics`, `macena-logi-track`, `macena-smart-erp`, `macena-tracevino`, `macena-agrivigna`, `macena-fatturaflow`, `macena-cyberguard`, `macena-teamflow`).
8. A reproducible cold-reader handoff exercise (§ 12) takes more than five working days to complete — symptom of doctrine drift.

---

## Riepilogo esecutivo (IT)

FactoryMind è una piattaforma di Industrial IoT progettata per le piccole e medie imprese manifatturiere del Veneto, con baricentro nel distretto di Mozzecane (VR). Il prodotto trasforma macchine utensili, linee di assemblaggio e impianti di processo in fonti dati interconnesse, integra il calcolo dell'OEE (Availability × Performance × Quality) secondo SEMI E10 / VDI 2884 / ISO 22400-2, e genera l'attestazione tecnica documentale richiesta per l'accesso ai crediti d'imposta Piano Transizione 4.0 (Legge 11 dicembre 2016, n. 232, comma 9-13, e successive modifiche) e Piano Transizione 5.0 (Decreto-Legge 2 marzo 2024, n. 19, conv. Legge 29 aprile 2024, n. 56, attuato dal Decreto interministeriale MIMIT-MASE 24 luglio 2024).

Il presente documento è il **manuale di subentro** completo: legge tecnico, ingegnere senior, responsabile sicurezza informatica, commercialista incaricato di verificare la documentazione di interconnessione, auditor del Garante per la Protezione dei Dati Personali. Il lettore freddo che parte da zero deve essere in grado, entro **una settimana lavorativa**, di assumere la responsabilità operativa della piattaforma: avvio della stack su una macchina pulita, primo turno di on-call, primo intervento sul codice, prima dimostrazione presso un cliente. Se questa proprietà non è verificata in un esercizio di subentro reale, il documento è da considerarsi in deriva e va riscritto.

Lo stack tecnologico è deliberatamente basato su componenti open source maturi: broker MQTT Eclipse Mosquitto 2.x, time-series InfluxDB 2.7, metadati PostgreSQL 16, backend Node.js 20 LTS con Express 4 + MQTT.js + Pino, frontend React 18 + Vite + TypeScript 5 + Tailwind 3, dashboard Grafana provisionate, infrastruttura Terraform (con region di default `eu-south-1` Milano per la residenza dei dati italiana), Kubernetes con Pod Security Standard `restricted` e default-deny NetworkPolicy. Il simulatore IoT in `iot-simulator/` consente la dimostrazione del prodotto senza alcun macchinario fisico — strumento essenziale per il primo contatto commerciale.

Il valore portante non è il middleware: è la **catena di fiducia** fra il singolo dato di telemetria a 1 Hz registrato da una macchina di Mozzecane, la sua durabilità in InfluxDB, l'audit log immutabile in PostgreSQL, il PDF di attestazione firmabile destinato al perito iscritto all'albo che dovrà giurarla per il commercialista del cliente. Ogni decisione architetturale documentata in queste pagine si misura contro la tenuta di quella catena.

Il foro competente è Verona, la legge applicabile è italiana, le clausole vessatorie sono state specificamente sottoscrivibili ex artt. 1341 e 1342 c.c. per i contratti commerciali (cfr. `legal/CONTRATTO-SAAS-B2B.md` art. 13). Il limite di responsabilità del fornitore è ex art. 1229 c.c.; non si applica ai casi di dolo o colpa grave.

---

## 0. Come leggere questo documento (How to read this document)

Il documento è denso (circa 22 000 parole) per scelta deliberata: un handoff incompleto è peggio di nessun handoff. Ma non si legge linearmente. **Segui il percorso che corrisponde al tuo ruolo.**

**Percorso A — Lettore freddo (nuovo ingegnere senior, zero contesto FactoryMind).** Leggi nell'ordine: § 1 (mission), § 0 (questa sezione, di nuovo, ora che sai dove stai), § 2 (doctrine — devi accettare le regole prima di toccare il codice), § 3 (architecture), § 5 (lifecycle — fa il tuo primo `docker compose up`), § 4 (code map — apri il backend, leggi i file citati, abbina alla pagina), § 8 (SRE — il tuo primo turno di on-call comincia leggendo qui), § 6 (API — capisci le superfici esposte), § 7 (data governance), § 9 (compliance), § 10 (cross-product), § 12 (bus factor). Tempo previsto: 2–3 giornate di lettura attiva + 2 giornate di esercizio pratico = una settimana lavorativa.

**Percorso B — Lettore di ritorno (sai già cos'è FactoryMind, hai bisogno di un riferimento).** Salta a § 4 (code map) o a § 8 (runbooks) o a Appendix A (decree map) per il dato puntuale. La doctrine in § 2 è la stessa di sempre — non rileggerla a meno che non sia stato pubblicato un major.

**Percorso C — On-call appena sveglio alle 3:47 di mattina.** Vai direttamente a § 8 (SRE), trova il nome dell'allarme che ha squillato (es. `FactoryMindMQTTDisconnected`), apri il runbook corrispondente. Diagnosi → mitigazione → escalation → postmortem template. Il resto del documento esiste per supportare quel runbook; in emergenza non leggere altro.

**Percorso D — Auditor del Garante / responsabile compliance del cliente / commercialista incaricato.** Leggi: Riepilogo esecutivo (sopra), § 1 (mission), § 7 (data governance & GDPR), § 9 (compliance baseline — Piano 4.0/5.0, IEC 62443 SL-2, NIS2, CRA, Stanca/WCAG), Appendix A (decree map). Il documento gemello [`AUDIT.md`](AUDIT.md) contiene l'audit indipendente con findings dettagliati e il loro mapping su NIST CSF 2.0, MITRE ATT&CK for ICS, OWASP API Top 10 2023, IEC 62443-3-3 SL-2, CIS Controls v8, AgID Misure Minime ICT (Standard).

**Percorso E — Investitore / partner di canale / commercialista che valuta una partnership.** Leggi solo: Riepilogo esecutivo, § 1 (mission), § 9 (compliance baseline), poi vai a [`UPLIFT.md`](UPLIFT.md) Track Commercial e a `moneyplan.txt`. La parte tecnica di questo documento ti serve solo se devi due-diligence l'eseguibilità del piano commerciale.

**Percorso F — Red-teamer / pen-tester con ingaggio formale.** Leggi: § 3 (architecture, perché devi conoscere le superfici), § 4 (code map, perché devi sapere dove guardare), § 6 (API, ogni endpoint enumerato), § 8 (alert rules, perché vuoi sapere cosa farà rumore), poi salta a [`AUDIT.md`](AUDIT.md) § 8 (CTF / red-team angles).

**Convenzioni redazionali.** Le sezioni etichettate **(IT)** sono in italiano per scelta — destinatari italiani primari (clienti, commercialisti, auditor del Garante). Le sezioni etichettate **(EN)** sono in inglese — destinatari ingegneristici, citazioni RFC/IETF, convenzioni internazionali. Le citazioni in linea fra parentesi quadre `[label](FILE.md#anchor)` risolvono ad ancore stabili negli altri tre documenti. Il riferimento `backend/src/config/index.js:113-145` è un puntatore file:line al commit `d4c5107`. Le citazioni di legge sono complete: numero del decreto + data della Gazzetta Ufficiale + (dove applicabile) URL Normattiva o EUR-Lex (Appendix A).

---

## 1. Mission & business context (EN, with IT for customer-facing claims)

### 1.1 What FactoryMind is, in one sentence

> *"FactoryMind turns any CNC, moulder, packaging line, or oven into a machine that qualifies its owner for the Piano Transizione 4.0 / 5.0 tax credit, and produces the live OEE dashboard + the attestazione PDF that the accountant needs to actually claim the money."*
> — `moneyplan.txt`, repository root, lines 9–12

The plumbing — Mosquitto MQTT, InfluxDB 2.x, PostgreSQL 16, Express 4 on Node.js 20, React 18 + Vite, Grafana, OpenTelemetry, Terraform, k8s — is excellent and fully audited. It is not the load-bearing value. The load-bearing value is the **Piano 4.0 / 5.0 attestazione PDF** plus the **OEE math** under SEMI E10 / VDI 2884 / ISO 22400-2, delivered to a Veneto manufacturing SME via an installer who shows up on a Tuesday morning and has a working dashboard by Friday.

### 1.2 The geography (IT)

Il prodotto è progettato per il distretto manifatturiero veneto: la cintura industriale che si estende da Mozzecane (VR) verso Villafranca di Verona, Valeggio sul Mincio, Povegliano Veronese e si appoggia ai poli logistici del Quadrante Europa. La densità di PMI manifatturiere familiari nell'intorno di un'ora di strada da Mozzecane è il vantaggio competitivo più difendibile del progetto: nessun competitor enterprise globale (Siemens MindSphere, PTC ThingWorx, GE Predix, AVEVA PI System, Rockwell FactoryTalk) considera commercialmente sostenibile servire un cliente da 25 macchine a 280 km di distanza dalla propria sede. Il fornitore locale che parla italiano, conosce il commercialista di famiglia e installa il sistema entro tre settimane vince per costruzione.

I distretti coperti sono:

- **Mozzecane / Villafranca / Valeggio cluster** — circa 80 stabilimenti di lavorazioni meccaniche, plastiche, componentistica. ICP "S" (priorità massima). Aziende che hanno acquistato macchinari nel triennio 2022–2024 con il vecchio iperammortamento o con il Piano 4.0 e che faticano a documentare l'interconnessione richiesta dalla Circolare MISE/AdE 9/E del 23 luglio 2018.
- **Distretto del Mobile di Verona** — circa 9 000 imprese attive secondo i dati Unioncamere Veneto 2024, di cui circa il 12 % ha almeno una macchina interconnessa nell'ultimo triennio.
- **Distretto Metalmeccanico Verona-Mantovano** — circa 12 000 imprese; tasso di adozione 4.0 leggermente superiore (~ 16 %) per la pressione del supply-chain automotive.
- **Quadrante Europa logistica** — meno PMI manifatturiere ma forte presenza di centri di lavorazione "service" (taglio, piegatura, trattamenti).
- **Mantova industriale** — Castiglione delle Stiviere, Suzzara, Viadana. Settori food-processing, tessile, lavorazioni metalliche.
- **Estensione Anno 2** — Treviso, Rovigo, Venezia, Brescia, Bergamo, Modena, Reggio Emilia.

L'espansione geografica è un'iniziativa di [`UPLIFT.md`](UPLIFT.md) Track Commercial, non di questo documento. Qui ci limitiamo a registrare che ogni decisione tecnica (residenza dati, lingua dell'interfaccia, formato PDF dell'attestazione, foro competente del contratto) è funzione di questa geografia.

### 1.3 The two problems FactoryMind solves (EN)

**Problem 1 — regulatory / financial: Piano Transizione 4.0 / 5.0 tax credit.** A Veneto SME buys a machine for €120 000. If that machine is correctly interconnected and integrated into the IT system per the three "caratteristiche tecnologiche obbligatorie" of the Circolare MISE/AdE 9/E del 23 luglio 2018, the firm claims:

- **Piano 4.0 base:** 20 % credit on investments up to €2.5 M → €24 000 back on a single €120 000 machine.
- **Piano 5.0 with measured energy reduction ≥ 3 % (process) or ≥ 5 % (whole site):** stratified credit bands of 35 % / 40 % / 45 % on investments up to €2.5 M → up to €54 000 back on the same €120 000 machine.

Without FactoryMind, many SMEs either don't claim the credit (lack of documented interconnection) or claim it and get rejected at audit (no telematic data trail to demonstrate the three caratteristiche). FactoryMind is, materially, **a cheque the customer would otherwise throw away**. The PDF attestazione (`backend/src/services/piano4-attestazione.js`, `piano5-attestazione.js`) is the deliverable that closes that loop — it is technical input to the **perizia tecnica giurata asseverata** that the customer's perito iscritto all'albo will sign and submit to the Agenzia delle Entrate. The perizia is and remains the perito's responsibility (cfr. `legal/CONTRATTO-SAAS-B2B.md` art. 2; doctrine rule **H-16**); the attestazione PDF is the rigorous evidence packet that makes the perito's job procedurally trivial.

**Problem 2 — operational: OEE.** Once the telemetry flows, customers discover their "90 %-utilised" machines run at 62 % OEE in reality. The reaction sequence — disbelief → anger → optimisation → 10–15 % capacity recovery without capital expenditure — is the repeat-sale lever. The Piano 4.0 attestazione gets the customer in the door; the OEE story keeps them.

These are sold separately and priced separately. Cfr. `moneyplan.txt` Tier 2 (Standard) commercial structure.

### 1.4 The Ideal Customer Profile (ICP)

Scored by closability, not size — recapitulated from `moneyplan.txt` lines 59–90:

| Tier | Profile | Why they close fast |
|---|---|---|
| **S** | 15–60 employee manufacturer in Mozzecane/Villafranca/Valeggio with active Piano 4.0 claim window and a machine bought in the last 18 months | Concrete €20–50 k of fiscal credit at stake per machine; commercialista aware of the Circolari; family decision-making concentrated |
| **A** | Family-owned CNC / injection / metalwork shop in the Mantovano industrial belt | Low digital competition; high cash cycle; trust-based purchase pattern |
| **A** | Veronese winery with bottling + labelling line (Valpolicella, Custoza, Bardolino DOC/DOCG) | Pairs naturally with `macena-tracevino` (HACCP + SIAN) and `macena-agrivigna` (precision viticulture) — three-product bundle |
| **B** | Food processor / packaging SME | Piano 5.0 energy-savings angle pairs with `macena-greenmetrics` (energy management) |
| **C** | Commercialista / studio di consulenza aziendale (Verona, Vicenza, Padova, Treviso ODCEC) | **Channel partner**, not customer. One trusted accountant brings 5–15 pre-qualified leads per year. Tier C is the unlock |

The sales motion that produces revenue inside the first 12 months centres on Tier S and Tier C; Tier A and B come second-year. Cfr. [`UPLIFT.md`](UPLIFT.md) Track Commercial for the customer-success cadence (30 / 90 / 180-day check-ins) that turns a Tier-S installation into a Tier-A-via-referral pipeline.

### 1.5 The commercial tier model (commitments this document must respect)

Recapitulated from `moneyplan.txt` lines 109–135. **The new four-document set must remain consistent with this structure**; if the tiers change, doctrine rule **H-9** (documentation is code) requires this section to update before code.

| Tier | Name | Pricing | Hosting | Customisation level | Licence shape |
|---|---|---|---|---|---|
| 1 | Community | €0 | Self-hosted by user | None — vanilla repo | MIT (file `LICENSE`) |
| 2 | Standard | €2.5–5 k setup + €1.2–3 k / year | Customer hardware or small VPS | Machine/line mapping + 1 attestazione/year + minor customisations | Limited non-exclusive licence to use |
| 3 | Enterprise / "Bollato" | €10–25 k one-time + annual | Customer infrastructure or dedicated VPS | Custom branding, custom PDF layouts, ERP integration, dedicated SLA | "Licenza d'uso non esclusiva + prestazione personalizzata" — base codebase property of fornitore; customer gets customisations + perpetual licence |
| 4 | Cloud (SaaS) | €150–400 / machine / month | Fornitore-managed (eu-south-1 Milano default) | None — multi-tenant SaaS | Subscription per `legal/TERMINI-DI-SERVIZIO.md` |

**Critical contractual invariants** that this handoff must protect:

- **Tier 3 base codebase remains fornitore property** — every Enterprise fork is a *delta* on top of the base; the customer owns their delta and has a perpetual licence to use it, but cannot extract the base.
- **No free customers** (`moneyplan.txt:143–144`). Even aggressive discounts retain a symbolic minimum charge (€500). "Paid = respected."
- **First customer is at half price on the record + signed testimonial + permission to host site visits.** This is the bootstrap protocol; do not deviate without a recorded reason.
- **Foro competente: Verona** (`legal/CONTRATTO-SAAS-B2B.md` art. 12, `legal/TERMINI-DI-SERVIZIO.md` art. 11).
- **Licenza applicabile: italiana**.

### 1.6 What FactoryMind is *not* (anti-claims this document must enforce)

These are the boundaries. Doctrine rule **H-3** ("Italian for legal, English for engineering") mirrors them at the writing level; here we make them explicit at the product level:

- **FactoryMind is not a MES.** It does not schedule orders, does not allocate operators to lines, does not consume raw materials inventory. Customers wanting MES functionality run FactoryMind alongside `macena-smart-erp` (multi-tenant ERP for Italian PMI manifatturiere) or alongside an existing TeamSystem / Zucchetti / SAP DM stack.
- **FactoryMind is not a SCADA.** It does not control machines. It observes. The architecture (§ 3.1) is a monitoring overlay, never an interlock. Doctrine rule **H-12** ("First production deployment is a ceremony, not a script") embeds this — a deployment cutover does not stop a customer's production line because FactoryMind has no production-stopping authority.
- **FactoryMind is not a product for the hospitality / restaurant sector.** `moneyplan.txt:94–107` is explicit: the Piano 4.0/5.0 attestazione is the load-bearing commercial proposition; restaurants cannot claim it. The same stack repurposed for HACCP temperature compliance + energy-per-service + POS-integrated covers-vs-food-cost is a *different product on the same skeleton* (working name: not in this constellation yet) and is not in scope here.
- **FactoryMind does not generate the perizia tecnica giurata asseverata.** The PDF attestazione is technical evidence; the perito iscritto all'albo signs the perizia (cfr. art. 1, comma 11, Legge 11 dicembre 2016, n. 232 e s.m.i.).
- **FactoryMind does not perform automated decisions with legal effect on workers** (GDPR Art. 22). The predictive-maintenance module (`backend/src/services/predictive-maintenance.js`) produces *recommendations*; the decision to stop a machine, schedule a maintenance, or reassign a shift is always made by the responsible person.
- **FactoryMind does not transfer personal data outside the EEA by default.** All processing occurs in the tenant-configured region (default `eu-south-1` Milano). If a tenant pins backups to an off-region bucket, that cross-border is documented in the tenant's DPA annex (cfr. `legal/DATA-PROCESSING-AGREEMENT.md` § 8).

### 1.7 The commercial maturity arc (where FactoryMind is on 2026-05-07)

To set realistic expectations for the cold reader: at the time of this document's publication, FactoryMind is **post-pilot, pre-first-commercial-Tier-2**. The codebase is mature (production-ready stack, comprehensive auth, audit log, RBAC, helmet, CSP, rate-limit, tested in CI). The legal templates exist (`legal/`) but carry `[DA_COMPILARE]` placeholders that the first customer engagement will fill. The landing page (`landing-page/index.html`) is functional Italian content but lacks a cookie banner and analytics gating. The CD pipeline (`.github/workflows/cd.yml`) has placeholder deploy steps that will be implemented during the first paying engagement.

This document presents the system as it is, not as it will be. Anything that is "target state" rather than "current state" is labelled in bold (cfr. doctrine rule **M-5**). Specifically (as of v1.0.1, 2026-05-07 — the post-W1-sweep update):

- The 8 runbooks in § 8 *exist in this document*, not in `docs/runbooks/` (the directory is empty in the current commit). § 8 IS the runbook directory; if you prefer separate files, [`REMEDIATION.md`](REMEDIATION.md) ticket R-RUNBOOK-SPLIT-001 covers the migration. **Update 2026-05-07:** `monitoring/alerts.yml` `runbook_url` annotations now point at `<HANDOFF_URL>#h-runbook-<lowercased-alertname>` anchors materialised in § 8.3-8.10 (R-RUNBOOK-001 closed).
- The GDPR export and erasure scripts (`scripts/export-subject.sh`, `scripts/erase-subject.sh`) are referenced in the legacy `DATA_GOVERNANCE.md`. **Update 2026-05-07:** R-GDPR-001 closed — both scripts now exist alongside `backend/src/services/gdpr.js`; the route handlers `/api/users/me/export` and `DELETE /api/users/me` share the same service module so operator and self-service paths converge on one implementation. § 7.3 procedure remains as the offline-DB fallback.
- The Cosign image-signing pipeline was cited in `k8s/deployment.yaml:63` comment but was not implemented in `cd.yml`. **Update 2026-05-07:** R-SUPPLY-001 (W1 portion) closed — `cd.yml` installs `sigstore/cosign-installer@v3` and signs every image keyless-OIDC against Sigstore Rekor; build-push emits `provenance: true` + `sbom: true`; `R-K8S-DIGEST-001` closed (digest substitution before kubectl apply). Kyverno admission verification (R-K8S-KYVERNO-001) remains W2.
- The Terraform remote-state backend was commented out in `terraform/versions.tf:14–20`. **Update 2026-05-07:** R-TF-STATE-001 (Code complete) — backend block uncommented, `terraform/bootstrap-state.sh` ships the once-per-account hardening (versioning + KMS + public-access-block + TLS-only policy + cross-account-deny + lifecycle; DDB SSE + PITR + deletion-protection). The actual `terraform init -migrate-state` against the customer AWS account is the operator's gate.

**v1.0.1 W1 sweep — 2026-05-07.** The following W1 tickets closed in a single multi-cluster sweep:

- F-CRIT-001 (R-MQTT-ANON-001): Mosquitto auth required; install.sh provisions passwd via Node PBKDF2-SHA512.
- F-CRIT-002 (R-MQTT-TLS-001): broker TLS listener on 8883 with install.sh-generated dev CA (production swap-point named).
- F-CRIT-003 (R-OPCUA-VALIDATE-001): OPC UA endpoint allow-list validator; metadata-service IP literals + RFC1918 IP-literals + cloud-metadata hostnames blocked.
- F-CRIT-004 (R-TF-STATE-001): Terraform remote state code complete, awaits `terraform apply`.
- F-CRIT-005 (R-GRAFANA-PG-TLS-001): Postgres `ssl=on` with dev CA + Grafana `sslmode: require`; live verified via `pg_stat_ssl`.
- F-CRIT-006 (R-TIA-001): Schrems II Transfer Impact Assessment v0.9 drafted at `legal/TIA-INFLUXDATA.md`, awaits counsel sign-off.
- F-CRIT-007 (R-CI-AUDIT-001): npm audit + Trivy unmasked; live verified RC=1 on lodash@4.17.10 fixture.
- F-HIGH-001/002/010 (R-FRONTEND-COOKIE-AUTH-001 + R-FRONTEND-AUTH-001 + R-WS-AUTH-001): dual-mode backend (Bearer OR HttpOnly cookie); CSRF double-submit; frontend Login + RequireAuth; WebSocket handshake JWT validation.
- F-HIGH-003/004 (R-RDS-KMS-001 + R-RDS-EGRESS-001): customer-managed KMS CMK + scoped DB SG egress (Code complete; awaits AWS apply).
- F-HIGH-005 (R-CONTACT-ESCAPE-001): regression-lock on text-only sendMail.
- F-HIGH-006 (R-GDPR-001): GDPR scripts + service.
- F-HIGH-007 (R-FRONTEND-DOCKERFILE-USER-001): nginx non-root.
- F-HIGH-008 (R-K8S-DIGEST-001): digest pinning in CD.
- F-HIGH-009 (R-SUPPLY-001 W1 portion): Cosign keyless OIDC.
- F-MED-005 (R-CONFIG-MQTT-001): MQTT_PASSWORD prod-guard.
- Plus: R-ADR-001 (`docs/adr/` directory + ADR-0001), R-CI-DOCS-001 (CI docs lint workflow), R-RUNBOOK-001 (alert annotations).

Honest gaps decay; vanity claims do not (doctrine rule **M-2**, [`AUDIT.md`](AUDIT.md) doctrine **A-1**). This handoff names every gap.

---

## 2. Doctrine — Handoff Work Doctrine

The following twenty-two rules are **non-negotiable** for everyone who maintains, operates, or hands off the FactoryMind platform. Each rule has the four-part shape: imperative title, body, **Why** (the failure mode the rule defends against), **How to apply** (where in code or workflow), and **Cross-refs** (related rules, sections, ADRs, tests, sister-document anchors).

A rule may be challenged. A rule may not be silently ignored. To remove or rewrite a rule, file an ADR under `docs/adr/` (the directory does not yet exist; creating it is [`REMEDIATION.md`](REMEDIATION.md) ticket R-ADR-001) with rationale, impact analysis, and approval signatures. Until the ADR is merged, the existing rule binds.

The number of rules is twenty-two. This is intentional. Fewer than ~ 18 produces a doctrine that ignores edge cases; more than ~ 25 produces a doctrine no one reads.

### Rule H-1 — Clean-machine bootstrap ≤ 15 minutes.

A stock Ubuntu 24.04 LTS or macOS 14+ box with Docker installed must reach a working FactoryMind dashboard (the Italian-language React UI loaded at `http://localhost:5173/`, the OEE gauge displaying live data from the simulator, the alert feed responsive) **within fifteen minutes** of `./install.sh` invocation in unattended mode (`FM_UNATTENDED=1`).

**Why.** A handoff is real only if a new operator can run the system on their first day without escalating to the prior owner. Long-tail bootstrap procedures hide drift between documentation and reality; the moment install.sh stops being a 15-minute path, the document this handoff replaces (legacy MODUS_OPERANDI § 5.8) drifts silently and onboarding becomes oral tradition.

**How to apply.** Every PR that touches `install.sh`, `docker-compose.yml`, `.env.example`, or any service `Dockerfile` is gated by a CI job — currently to be implemented as [`REMEDIATION.md`](REMEDIATION.md) ticket R-CI-BOOT-001 — that boots the stack from a clean Ubuntu 24.04 container and asserts the readiness probe at `/api/ready` returns HTTP 200 within 15 minutes. The job hard-fails at 20 minutes (5-minute buffer for CI variance). The job runs on every PR; failure blocks merge.

**Cross-refs.** Doctrine **H-9** (documentation is code), § 5.1 (operational lifecycle — bootstrap), [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-ci-boot-001), [`UPLIFT.md`](UPLIFT.md) Track DX initiative U-DX-002.

### Rule H-2 — Production refuses to boot with weak secrets.

The backend MUST validate, at startup, that all secrets satisfy production-grade criteria, and MUST exit with non-zero status code if any criterion fails. Specifically: `JWT_SECRET` and `JWT_REFRESH_SECRET` are not placeholders (`change_me`, `dev`, `please-generate-…`) and are at least 32 characters; `MQTT_BROKER_URL` uses `mqtts://` (TLS) when `NODE_ENV=production`; `INFLUX_TOKEN` is at least 32 characters; `CORS_ALLOWED_ORIGINS` does not contain `*` or `localhost` in production; `FM_REQUIRE_CUSTOM_ADMIN=true` is set so the seed admin cannot persist past first login.

**Why.** The single most-cited root cause of breaches in OWASP API Top 10 (2023) is "Security Misconfiguration" (API8). FactoryMind addresses this not by hoping operators choose strong secrets but by making *weak secrets a fatal boot error*. This shifts the failure from a runtime breach to a deploy-time complaint that a senior engineer fixes in under 30 minutes.

**How to apply.** `backend/src/config/index.js` lines 113–145 are the canonical guardrails — they implement Joi schema validation followed by an explicit "production guard" pass that raises if any criterion fails. Every new prod-only invariant added in the future MUST land here, with a corresponding unit test in `backend/tests/config-prod-guardrails.test.js` (already present) that asserts the failed-boot path. The guard rule "MQTT_PASSWORD must be non-empty in production" is currently missing (cfr. [`AUDIT.md`](AUDIT.md) finding F-MED-005); [`REMEDIATION.md`](REMEDIATION.md) ticket R-CONFIG-MQTT-001 adds it.

**Cross-refs.** [`AUDIT.md`](AUDIT.md#a-strength-config-guardrail), § 5.3 (deploy walkthrough), Sigstore / 12-factor-app principle III.

### Rule H-3 — Italian for legal, English for engineering.

Sections, comments, error messages, log strings, and inline citations switch register by surface, never within a paragraph. Legal, regulatory, commercial-customer-facing, and Garante-auditor-facing material is written in **Italian**. Engineering, SRE, RFC-citing, code-review, on-call, and security-finding material is written in **English**. Quotations across the boundary are kept verbatim and italicised; the surrounding paragraph stays in its register.

**Why.** Bilingual confusion in legal documents is a known Garante-audit red flag (the auditor cannot determine which version is authoritative when both are equally plausible). Bilingual confusion in engineering docs slows on-call (a half-translated runbook adds cognitive load when the responder is at minimum cognitive capacity). The fix is not "translate everything": it is "declare the register and stay in it".

**How to apply.** This document follows the rule by labelling sections **(IT)** or **(EN)** in the heading. The `Riepilogo esecutivo` is IT; § 1.2 (geography) is IT because it speaks to a customer-facing reality; § 1.3 (the two problems) is EN because it speaks to an engineering-audience analysis; § 2 (this section) is EN because doctrine is engineering. Customer-facing PDFs (attestazione Piano 4.0/5.0) are IT-only. Backend log strings are EN. Frontend i18n strings exist in three locales (IT default, EN, DE) — the Italian is the source-of-truth for customer-visible strings; EN/DE follow.

**Cross-refs.** [`AUDIT.md`](AUDIT.md#a-doctrine-bilingual), § 11 (glossary — bilingual), `frontend/src/locales/`.

### Rule H-4 — Every endpoint is enumerated with RBAC tag.

Every HTTP route exposed by the backend MUST appear in three coordinated places: (1) the prose API reference at § 6 of this document; (2) the machine-readable spec at `docs/openapi.yaml`; (3) the implementing route file under `backend/src/routes/`. A drift between any two is a P0 documentation defect. Every route MUST also carry an explicit RBAC tag (which roles can call it: `viewer` / `operator` / `supervisor` / `admin` / `public`).

**Why.** Hidden endpoints become BOLA gaps (OWASP API1: Broken Object Level Authorization). The "developer added an `/api/internal/...` endpoint for one quick thing and forgot to remove it" pattern is the most-exploited surface in commercial pentests of Express-based stacks. Enumeration is the only defence; obscurity is none.

**How to apply.** A CI documentation-lint job (to be implemented in [`REMEDIATION.md`](REMEDIATION.md) ticket R-CI-DOCS-001) parses the route surface from `backend/src/routes/*.js`, the OpenAPI surface from `docs/openapi.yaml`, and the prose surface from § 6 of this document, and fails the build on any drift. RBAC tags are validated against the role hierarchy in `backend/src/middleware/auth.js` lines 55–72.

**Cross-refs.** [`AUDIT.md`](AUDIT.md#a-bola-surface), § 6 (API), `docs/openapi.yaml`, `backend/src/middleware/auth.js:55-72`, OWASP API Top 10 2023 API1.

### Rule H-5 — Bus factor ≥ 2 on every load-bearing module.

No production-critical module of FactoryMind has fewer than two competent maintainers. "Competent" means: capable of debugging a production incident in that module without escalating to the original author. "Production-critical" means: any code path traversed during the OEE compute, the MQTT ingestion, the Influx write, the alert evaluation, the audit log write, the JWT auth flow, the attestazione PDF generation, or the OPC UA / Modbus / Sparkplug bridges.

**Why.** Inherited from MODUS_OPERANDI § 13.3. Single-knower modules become exit-blocking dependencies. A founder who is the only knower of `services/oee-calculator.js` cannot take a holiday; a Tier 3 contract cannot ship. The bus factor is also a precondition for the seed-funding term-sheet typical key-man-insurance clause.

**How to apply.** § 4 (code map) lists at least two named owners per module. If you, the cold reader, are now a single owner of a module, you have **30 days** from the commit that promotes you to a "named owner" line in this document to (a) onboard a second engineer to the module via paired commits and (b) update § 4 with the second name. This rule is enforced by quarterly review (cfr. doctrine **H-22**); the review checks every § 4 owner line for ≥ 2 names and live (last-commit-in-module within 90 days).

**Cross-refs.** § 4, § 12 (bus factor & onboarding checklist), MODUS_OPERANDI § 13.3 (legacy), [`UPLIFT.md`](UPLIFT.md) Track DX U-DX-knowledge-graph.

### Rule H-6 — A failed alert without a runbook is a P0 documentation defect.

Every alert rule in `monitoring/alerts.yml` MUST carry an `annotations.runbook_url` pointing into § 8 of this document, formatted as `<HANDOFF_URL>#h-runbook-<alertname>`. The format `<alertname>` is lowercase, hyphen-separated, exactly matching the rule's `alert:` field. CI MUST fail the build if any alert lacks the annotation or if the annotation points to a non-existent anchor.

**Why.** Legacy `SLO.md` § 6 referenced runbooks under `docs/runbooks/` that never existed. An on-call responder paged at 3:47 AM whose paging notification cites `runbook_url: docs/runbooks/factorymind-mqtt-disconnected.md` and the file 404s is in a worse position than one with no runbook URL at all (false confidence wastes time). This rule eliminates the gap by making the absence of a runbook a build failure, not a footnote.

**How to apply.** § 8 of this document materialises eight runbooks corresponding to the eight alerts currently in `monitoring/alerts.yml` (`FactoryMindAPIDown`, `FactoryMindHighErrorRate`, `FactoryMindLatencyBurn`, `FactoryMindMQTTDisconnected`, `FactoryMindInfluxWriteFailures`, `FactoryMindHeapPressure`, `FactoryMindReadinessFlap`, `FactoryMindLoginAnomalies`). Adding a new alert requires adding a new runbook in the same PR. The CI lint that validates this is part of [`REMEDIATION.md`](REMEDIATION.md) R-CI-DOCS-001.

**Cross-refs.** § 8, [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-runbook-001), `monitoring/alerts.yml`, Google SRE Workbook ("Implementing SLOs" + "Error budget policy").

### Rule H-7 — Decree citations carry decree number + Gazzetta date.

A bare "GDPR" cite is useless to a Garante auditor; "Reg. UE 2016/679 (Reg. UE relativo alla protezione delle persone fisiche con riguardo al trattamento dei dati personali), art. 32, par. 1, lett. b" is decisive. Every Italian decree, EU regulation, MIMIT/AdE circolare, IEC/ISO standard, RFC, or CVE referenced anywhere in the four-document set MUST appear in HANDOFF Appendix A (Decree & standard map) with the canonical citation and an authoritative URL (Normattiva for Italian decrees, EUR-Lex for EU regulations, official body URL for standards, NVD for CVEs).

**Why.** A reader (auditor, customer, partner, future engineer) who fact-checks one citation and finds it to be loose loses trust in the document as a whole. The cost of being precise is low; the cost of being loose is catastrophic.

**How to apply.** Appendix A is the single source of truth for citations. In-line references resolve there. A documentation-lint job (R-CI-DOCS-001) validates every "art. N L. M/Y" / "D.Lgs. N/Y" / "Reg. UE N/Y" / "DM ... del DD/MM/YYYY" / "Circolare ... del DD/MM/YYYY" / "ISO N:Y" / "IEC N-N" / "RFC N" / "CVE-Y-N" appearing in any of the four documents traces back to an entry in Appendix A.

**Cross-refs.** Appendix A, [`AUDIT.md`](AUDIT.md#a-doctrine-citation), legal/* templates (which already comply for Italian decrees).

### Rule H-8 — Every operational claim is linked to one trace, one log query, or one runbook.

Whenever this handoff (or any of its sister documents) states "the system does X under condition Y", the statement MUST be accompanied by one of: (a) the OpenTelemetry trace name (e.g., `factorymind.mqtt.handle_message`), (b) the Pino/Loki log filter that surfaces the event (e.g., `level=info AND service=factorymind-backend AND component=mqtt-handler`), (c) the Grafana dashboard URL or panel ID, (d) the runbook anchor in § 8.

**Why.** Documents that drift from production reality mislead on-call. A handoff that says "the alert engine evaluates rules every 5 seconds" without a way for the reader to *verify* this claim becomes oral tradition the moment the implementation changes. The rule eliminates oral tradition.

**How to apply.** § 4 (code map), § 8 (SRE), § 9 (compliance baseline) consistently attach pointers. A reader with access to the production OpenTelemetry collector / Grafana / Loki should be able to spot-check any claim within 60 seconds.

**Cross-refs.** [`AUDIT.md`](AUDIT.md#a-doctrine-evidence), § 4, § 8, OpenTelemetry semantic conventions for messaging spans.

### Rule H-9 — Documentation is code; CI enforces it.

The four documents (this one, AUDIT, REMEDIATION, UPLIFT) are first-class build artefacts. They live under version control alongside the code, they are reviewed in PRs, they are linted in CI, they ship in releases. A code change that breaks the documentation contract (e.g., adds a route without updating the prose API reference; removes a service without updating § 4 code map; renames an alert without updating the runbook anchor) is a build failure, not a follow-up task.

**Why.** Legacy MODUS_OPERANDI § 5.8 already declared documentation-as-code, but in practice CI checks have not been wired. This rule closes the gap by making CI the enforcement mechanism. "I'll update the docs in a follow-up PR" is the death of every documentation system.

**How to apply.** GitHub Actions job `docs-lint` (to be added under [`REMEDIATION.md`](REMEDIATION.md) ticket R-CI-DOCS-001) runs: `markdownlint`, link-check (every `[label](FILE.md#anchor)` resolves), anchor-resolution lint (every cross-doc anchor exists), code-fence language-tag check (every fence has a language; language is one of the FactoryMind-relevant set: `js`, `ts`, `json`, `yaml`, `bash`, `sh`, `sql`, `text`, `flux`, `dockerfile`, `nginx`), citation lint (every decree / RFC / ISO / CVE traces to Appendix A), word-count floor (each of the four documents ≥ 20 000 words). Builds fail on any of the above.

**Cross-refs.** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-ci-docs-001), [`AUDIT.md`](AUDIT.md) doctrine **A-6**, MODUS_OPERANDI § 5.8 (legacy).

### Rule H-10 — Cross-product integration is documented before code.

FactoryMind exists in a constellation of sister projects: `macena-greenmetrics` (Piano 5.0 energy savings; integration via DNS-SD on `_greenmetrics._tcp.local` + HTTP on `/api/v1/energy/{baseline,monitored}`), `macena-smart-erp`, `macena-logi-track`, `macena-tracevino`, `macena-agrivigna`, `macena-fatturaflow`, `macena-cyberguard`, `macena-teamflow`. Any code that touches a sister-project HTTP boundary, MQTT topic boundary, or DNS-SD discovery name MUST be preceded by a documentation update in § 10 of this handoff and (where the sister project has a corresponding handoff) in the sister's equivalent.

**Why.** The Piano 5.0 attestazione (`backend/src/services/piano5-attestazione.js`) computes the customer's energy savings by querying GreenMetrics. If GreenMetrics changes its `/api/v1/energy/baseline` contract silently — adds a required header, changes the JSON shape, renames a field — FactoryMind silently produces wrong energy savings, the customer claims a wrong percentage, the perizia is incorrect, and the customer's commercialista submits an incorrect Modulo Piano 5.0 to the GSE. The fault propagates into a fiscal claim. Cross-product integrations are the single highest-leverage failure surface in a multi-product founder portfolio.

**How to apply.** § 10 (cross-product integration map) lists every contract boundary by name, version, and stable URL/topic. Before touching a sister-project boundary, both repos cite the same contract version. After the change ships, both handoffs are updated in their next minor revision. The contract version goes into git tags on both sides (e.g., `cross-product/greenmetrics-energy-v1` on FactoryMind side; matching tag on GreenMetrics side).

**Cross-refs.** § 10, `backend/src/services/piano5-attestazione.js`, [`UPLIFT.md`](UPLIFT.md) Track Operations U-OPS-cross-product.

### Rule H-11 — Open-source distribution and SaaS distribution are separate licensing surfaces.

The repository is licensed MIT (`LICENSE` file at root). The Tier 2 / 3 / 4 commercial distributions (cfr. § 1.5) are licensed under separate commercial agreements (`legal/CONTRATTO-SAAS-B2B.md` for Tier 2/3, `legal/TERMINI-DI-SERVIZIO.md` for Tier 4 SaaS). The two licensing surfaces have different obligations under the EU Cyber Resilience Act (Reg. UE 2024/2847): the MIT-distributed self-hosted version is a candidate for the Open Source Software Stewardship exemption (Art. 24); the commercial Tier 2/3/4 are "products with digital elements" placed on the EU market and therefore in full CRA scope from 11 December 2027 (with vulnerability handling reporting from 11 September 2026).

**Why.** Treating "FactoryMind" as a single legal entity in the documentation collapses two materially different regulatory postures. A customer's legal counsel will ask, "Is this product CE-marked under the CRA?", and the answer differs depending on which distribution they are receiving. Honest documentation makes the distinction; misleading documentation triggers contract renegotiation late in a sales cycle.

**How to apply.** § 9 (compliance baseline) declares both surfaces with their current and future regulatory status. `legal/CONTRATTO-SAAS-B2B.md` art. 6 echoes the distinction (the SaaS subscription does not confer rights on the MIT codebase; the MIT codebase does not confer rights on the SaaS service). The eventual CRA self-conformity assessment (REMEDIATION R-CRA-001) treats them as separate products.

**Cross-refs.** § 9.4, [`AUDIT.md`](AUDIT.md#a-cra-applicability), `legal/CONTRATTO-SAAS-B2B.md` art. 6, Reg. UE 2024/2847 art. 24 (OSS exemption), `LICENSE` file at repo root.

### Rule H-12 — First production deployment is a ceremony, not a script.

`install.sh` works in unattended mode for *demos* and *test environments*. The first production cutover at a paying customer is a witnessed ceremony with twelve numbered checkpoints (cfr. § 5.5). Each checkpoint is initialled in the deployment-log runbook and sequencing cannot proceed past an un-initialled checkpoint. Checkpoints include: secrets in AWS Secrets Manager / Aruba Vault (not in `.env`); database migration applied successfully and verified via `psql` row count; broker TLS certificate verified via `openssl s_client`; MQTT credentials provisioned per `mosquitto_passwd`; ACL file deployed; Influx bucket + retention policy + downsampling task all present; first machine telemetry observed in Grafana within 5 minutes of bridge connect; first attestazione PDF rendered for the customer's first machine (sanity check on the load-bearing deliverable); audit log writing verified by inserting a test action and `SELECT`ing it back; backup job runs successfully; restore drill runs successfully on a copy; customer's responsabile IT signs the acceptance form.

**Why.** install.sh is excellent for the bootstrap path that doctrine **H-1** protects. But a production cutover at a paying customer carries different risks: real money in tax credits, real GDPR exposure, real liability under `legal/CONTRATTO-SAAS-B2B.md` art. 7. A scripted unattended path collapses these into one go/no-go that, if it fails, fails silently. Twelve witnessed checkpoints turn the cutover into a series of small go/no-go's, each cheap to roll back.

**How to apply.** § 5.5 (production deployment ceremony) lists the twelve checkpoints in order. The deployment-log runbook is `docs/legacy/deployment-log-template.md` (renamed in [`REMEDIATION.md`](REMEDIATION.md) R-RUNBOOK-DEPLOY-001). For Tier 4 SaaS deployments where customers are onboarded continuously, an automated promotion-gate (UPLIFT U-OPS-CD-Promotion-Gate) replaces the manual ceremony with a CI-enforced equivalent.

**Cross-refs.** § 5.5, [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-runbook-deploy-001), [`UPLIFT.md`](UPLIFT.md) U-OPS-CD-Promotion-Gate.

### Rule H-13 — Telemetry is non-personal data; operator IDs are personal data; never confuse them.

GDPR Art. 4(1) defines personal data as any information relating to an identified or identifiable natural person. FactoryMind's telemetry (metric values, status changes, alarm codes, counters) is **non-personal industrial data** by design: tags are facility / line / machine / metric / unit, fields are floats and integers. There is no `operator_id`, `worker_name`, or `shift_assignment` in the InfluxDB schema. Operator identities exist only in Postgres `users` and `audit_log` tables, which are personal data.

**Why.** Confusing the two surfaces in the documentation creates two opposite failures: (a) over-applying GDPR Art. 32 controls to industrial telemetry creates operational friction without legal benefit; (b) under-applying them to operator identities creates real Garante exposure. The boundary must be unambiguous and enforced.

**How to apply.** § 7.2 (PII inventory) lists every PII field by table and column. Integrators are instructed (via `legal/INFORMATIVA-PRIVACY-GDPR.md` and via the on-boarding documentation) NOT to put operator names, badge numbers, or shift identifiers in the JSONB free-form fields (`devices.metadata`, `shifts.metadata`). A periodic CI scan (REMEDIATION R-PII-SCAN-001) greps for suspicious patterns (Italian-name common substrings, EU phone-number patterns) at integrator-config-load time and alerts.

**Cross-refs.** § 7.2, [`AUDIT.md`](AUDIT.md#a-pii-boundary), `legal/INFORMATIVA-PRIVACY-GDPR.md` § 2, GDPR Art. 4(1) (Reg. UE 2016/679).

### Rule H-14 — Migrations are forward-only and idempotent.

PostgreSQL migrations under `backend/src/db/migrations/` use `node-pg-migrate` and follow the rule: every migration applied to a fresh database produces the same schema as applying it to a partially-migrated database; no migration contains `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE`. Backfills (data-only changes that re-shape existing rows) are NOT migrations; they are separate scripts under `scripts/backfill/<YYYY-MM-DD>-<description>.sh` that run opt-in, manually invoked, with explicit acceptance criteria.

**Why.** `node-pg-migrate` already enforces forward-only by default; this rule canonicalises the convention. Idempotent + forward-only is the migration-discipline pattern that lets a Tier 2 customer self-host on their own hardware and upgrade through the version history without ever needing the founder to debug their database. It is also the pattern that lets the `pg_dump` backup at v1.0.0 restore correctly into a v1.5.0 instance — every migration between v1.0 and v1.5 applies cleanly.

**How to apply.** `backend/src/db/migrations/` contains seven migrations (001_initial → 007_attestazioni_pdf_blob) at commit `d4c5107`, all of which use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, and similar idempotent forms. New migrations follow the same shape. A pre-merge CI check (REMEDIATION R-MIGR-LINT-001) greps `^DROP\b|^TRUNCATE\b` in `backend/src/db/migrations/*.sql` and fails on any match.

**Cross-refs.** `backend/src/db/migrations/`, § 5.6 (migration walkthrough), [`AUDIT.md`](AUDIT.md#a-strength-migrations).

### Rule H-15 — OEE math is canonical; changes touch documentation in the same commit.

The OEE formulas implemented in `backend/src/services/oee-calculator.js` are the canonical FactoryMind interpretation of SEMI E10 (Specification for Definition and Measurement of Equipment Reliability, Availability, and Maintainability) and ISO 22400-2 (Manufacturing Operations Management — Key Performance Indicators). The formulas are documented in § 3.6 of this handoff. Any code change to `oee-calculator.js` that alters the mathematical contract MUST update § 3.6 in the same commit. Any conceptual change to the contract (e.g., switching from rolling-window to shift-bounded, changing the micro-stoppage threshold, redefining first-pass-yield) MUST first land an ADR.

**Why.** Wrong OEE math is a customer-trust failure. A customer's responsabile di produzione who relies on FactoryMind's Performance KPI to make capex decisions about a new lathe is making a real business decision; if the formula silently changes the customer experiences an unexplained shift that erodes trust faster than any outage. The Performance ≤ 1.0 clamp (the explicit choice to display "100 %" rather than "104 %" when counter-overflow occurs, even though the counter overflow is itself a data-quality signal) is *the example* of an operational decision that must be visible.

**How to apply.** § 3.6 lists every formula with its derivation; the source-of-truth is the code, and the documentation refreshes per commit. The ADR process for conceptual changes is housed in `docs/adr/` (REMEDIATION R-ADR-001 creates the directory).

**Cross-refs.** § 3.6, `backend/src/services/oee-calculator.js`, MODUS_OPERANDI § 4.9 (legacy), SEMI E10, ISO 22400-2.

### Rule H-16 — The "perizia tecnica giurata asseverata" stays the customer's perito's responsibility.

FactoryMind generates the **attestazione PDF** that documents, for a given machine, the satisfaction of the five "caratteristiche tecnologiche obbligatorie" of the Circolare MISE/AdE 9/E del 23 luglio 2018 plus the two "caratteristiche di interconnessione" required by the same. This is technical evidence. It is **not** the perizia tecnica giurata asseverata required by art. 1, comma 11, della Legge 11 dicembre 2016, n. 232 e successive modifiche per investimenti superiori a € 300 000. The perizia is signed and sworn by a perito iscritto all'Albo degli Ingegneri o degli Periti Industriali; the perito assumes legal responsibility for its accuracy. FactoryMind does not assume that responsibility, never has, and shall not.

**Why.** Conflating the two creates a contractual exposure FactoryMind cannot insure. `legal/CONTRATTO-SAAS-B2B.md` art. 7 is explicit: "L'attestazione Piano 4.0/5.0 emessa dal Fornitore è documento tecnico basato sui dati raccolti. La responsabilità fiscale verso l'Agenzia delle Entrate resta in capo al Cliente; il suo commercialista è tenuto a verificare la completezza della documentazione prima di inoltrare richieste di credito." This rule mirrors that contractual position in every customer-facing communication.

**How to apply.** § 9.1 (Piano 4.0/5.0 attestazione lifecycle) prints this distinction in bold. § 1.3 (mission) reaffirms. The PDF rendered by `backend/src/services/piano4-attestazione.js` carries a footer line in Italian: "Documento tecnico — non sostituisce la perizia tecnica giurata asseverata ex art. 1, c. 11, L. 232/2016."

**Cross-refs.** § 9.1, `backend/src/services/piano4-attestazione.js`, `legal/CONTRATTO-SAAS-B2B.md` art. 7, art. 1, c. 11, L. 11 dicembre 2016, n. 232.

### Rule H-17 — Postmortems are written within five working days, blameless, and use the canonical template.

Every Severity-1 (P1) and Severity-2 (P2) incident produces a written postmortem within five working days of incident closure. Postmortems are blameless: they describe what happened, what we learned, and what we will change; they do not name individuals as causes. Postmortems use the canonical template at § 8.PM of this document (an `docs/runbooks/postmortem-template.md` file is created in REMEDIATION R-RUNBOOK-PM-001 if a separate file is preferred).

**Why.** Inherited from MODUS_OPERANDI § 12.3. Blameless postmortems accelerate organisational learning by removing the personal fear that suppresses honesty. Five working days is a forcing function: if a postmortem isn't written by Friday of the week after an incident, the details rot in memory and the learning is lost.

**How to apply.** The on-call lead enforces the SLA. The postmortem is reviewed in the next weekly engineering sync and archived in `docs/postmortems/<YYYY-MM-DD>-<incident-tag>.md`. Quarterly review aggregates trends (cfr. doctrine **H-22** + UPLIFT u-pm-trends-quarterly).

**Cross-refs.** § 8.PM, [`UPLIFT.md`](UPLIFT.md) Track Operations u-pm-trends-quarterly, MODUS_OPERANDI § 12.3 (legacy).

### Rule H-18 — Edge fleet posture matches cloud posture.

For Tier 2 and Tier 3 deployments where the customer runs FactoryMind on their own edge gateway hardware (typically a fanless industrial mini-PC in the OT armadio), the edge gateway hardening MUST match the cloud-deployment hardening: non-root user (UID 1001 or equivalent), seccomp profile RuntimeDefault, read-only root filesystem where the platform supports it, drop-all capabilities, default-deny firewall with explicit egress allow-list to the broker (TCP 8883 only), automatic security updates, signed Docker images (after Cosign pipeline ships — REMEDIATION R-SUPPLY-001).

**Why.** A weak edge gateway compromises the entire OT segmentation effort. A customer who buys Piano 4.0 attestazione from FactoryMind and runs the edge gateway on a Raspberry Pi without firmware updates is one CVE away from their factory's OT network being on the open internet. The edge is a security surface, not an IoT detail.

**How to apply.** § 5.7 (edge fleet hardening) lists the controls and the reference deployment template (`terraform/modules/edge/` does not yet exist; UPLIFT U-OPS-edge-template ships it). Until the template ships, edge deployments use the documented manual checklist.

**Cross-refs.** § 5.7, [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-supply-001), [`UPLIFT.md`](UPLIFT.md) Track Operations U-OPS-edge-template, IEC 62443-4-2.

### Rule H-19 — No "TODO" or "FIXME" without an issue link.

Comments of the form `// TODO`, `// FIXME`, `// XXX`, `// HACK` left in production code without an accompanying issue-tracker link (`// TODO(R-MQTT-002): tighten ACL after Tier 2 customer one ships`) are rejected at code review and at CI lint. The issue tracker is GitHub Issues (https://github.com/renanaugustomacena-ux/macena-factorymind/issues) for the open-source repo and the internal tracker (TBD) for commercial Tier 3 forks.

**Why.** Orphan TODOs become technical-debt fog. A commit that adds `// TODO: this is wrong` without a tracking link is a confession with no remediation; the fog accumulates until even the original author cannot remember what was wrong.

**How to apply.** Backend ESLint config (`backend/eslint.config.js`) gains a rule `no-warning-comments` with `--max-warnings 0` after a one-shot triage pass that opens issues for every existing TODO/FIXME (REMEDIATION R-LINT-TODO-001). The frontend ESLint config gains the equivalent.

**Cross-refs.** [`REMEDIATION.md`](REMEDIATION.md#r-ticket-r-lint-todo-001), `backend/eslint.config.js`, `frontend/eslint.config.cjs`.

### Rule H-20 — Honest gaps decay; vanity claims do not.

A handoff that lies about the system's state cannot be repaired; the lie compounds until the document is unusable. A handoff that names every gap (with stable IDs and severity) can be ratcheted: each gap becomes a remediation ticket, each ticket has an exit criterion, each closure is a measurable improvement. Vanity claims (an outage runbook listed as "production-tested" when it has been written but never executed; a security control listed as "implemented" when it has been designed but the PR has not merged; a compliance certification listed as "in progress" when no one has actually started) are particularly toxic because they survive in git history forever.

**Why.** This is the single most-violated rule in commercial-software documentation. The cost of overclaiming is invisible until a customer audit, a Garante inquiry, or a pen-test exposes the gap; at that point the cost is reputational, not technical. Naming the gap up-front pre-empts that cost.

**How to apply.** Every gap in this document is labelled as such (cfr. § 1.7 "where FactoryMind is on 2026-05-07"). Every gap has a stable ID in [`REMEDIATION.md`](REMEDIATION.md). Every gap has an exit criterion. The closure of each gap is a measurable event (a CI job goes green, a control passes a probe, an external auditor signs an attestation). The list of gaps is reviewed quarterly (doctrine **H-22**) and gaps that age past 180 days without remediation are escalated as P0 documentation defects.

**Cross-refs.** [`REMEDIATION.md`](REMEDIATION.md), [`AUDIT.md`](AUDIT.md) doctrine **A-1**, § 1.7.

### Rule H-21 — Configuration changes go through code review; secret rotations do not.

A change to `backend/src/config/index.js` (a new env var validation, a new production guardrail) follows the standard code-review path: PR, two reviewers if security-relevant, regression test. A *secret rotation* (replacing an actual JWT secret, MQTT password, Influx token, Postgres password) does NOT go through code review — secrets are not in the repository (`.gitignore` excludes `.env`, `*.pem`, `*.key`, `*.crt`); rotations are operational events documented in the deployment-log runbook and reviewed in the on-call handover.

**Why.** Confusing the two surfaces creates a security failure: secret rotation through PR exposes the secret in the GitHub event stream. Distinguishing the two surfaces makes both fast and secure.

**How to apply.** § 5.4 (secret rotation) lists the operational procedure. Secrets live in AWS Secrets Manager (`terraform/modules/secrets/`) for cloud deployments and in `/etc/factorymind/secrets.env` (mode 0600, owned by user `factorymind`) for self-hosted Tier 2 deployments. Rotations follow the documented cadence (quarterly for routine, immediately on any suspected compromise) and the on-call lead initials the runbook entry.

**Cross-refs.** § 5.4, `terraform/modules/secrets/`, `legal/DATA-PROCESSING-AGREEMENT.md` § 14 (allegato tecnico — misure di sicurezza).

### Rule H-22 — The four documents are reviewed quarterly, end-to-end, by Renan plus a designated peer.

Every quarter (calendar Q1 / Q2 / Q3 / Q4, on the first Tuesday of the month following quarter-end), Renan and a designated peer (initially the second engineer hired; over time the senior engineer with the longest tenure) read all four documents (HANDOFF, AUDIT, REMEDIATION, UPLIFT) end-to-end, in a single sitting if possible (estimated 4–6 hours), checking for: drift between documentation and code state, dangling cross-references, expired CVE-register entries (last sweep > 95 days old), wave-completion drift in REMEDIATION, anti-goal flips in UPLIFT, regulatory citations updated for any new Legge di Bilancio / Circolare MIMIT / EU regulation, ADR file presence under `docs/adr/` for every "decision" referenced in the documents.

**Why.** Drift between the four documents is the failure mode that ends the discipline. A quarterly cadence is the longest interval at which the documents can drift without becoming dangerous; a monthly cadence is the shortest interval at which the cost is sustainable. Two readers (not one) catches the failures the original author has gone blind to.

**How to apply.** The review is calendared 12 months in advance. Findings produce REMEDIATION tickets within 5 working days; doctrine modifications produce ADRs. The review minutes are archived under `docs/reviews/<YYYY-Q>.md` (the directory does not yet exist; UPLIFT u-quarterly-archive ships it).

**Cross-refs.** [`UPLIFT.md`](UPLIFT.md) u-quarterly-archive, [`REMEDIATION.md`](REMEDIATION.md) § 8 Continuous, [`AUDIT.md`](AUDIT.md) doctrine **A-12** (CVE register sweep).

---

## 3. Architecture

### 3.1 Tier diagram (Purdue-aligned)

FactoryMind is a five-tier cooperative system. The tiering aligns with the Purdue Enterprise Reference Architecture / IEC 62443 Reference Architecture so an industrial customer's responsabile sicurezza informatica recognises the boundaries on first contact.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TIER 1 — FIELD / SHOP FLOOR                        │
│   PLC · CNC · Robot · VFD · Energy meter · PV inverter · Sensori vari       │
│   Protocols: OPC UA (IEC 62541) · Modbus RTU/TCP (IEC 61158-3/4-5)          │
│              · MQTT 5.0 (OASIS 2019) · Sparkplug B · Ethernet/IP            │
│   Security level target: IEC 62443 SL-1 (vendor responsibility)             │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ TLS 1.3 + X.509 (mTLS where feasible)
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                        TIER 2 — EDGE GATEWAY                                │
│   Mosquitto bridge (store-and-forward, 90 s buffer) · OPC UA client         │
│   (node-opcua, SignAndEncrypt + Basic256Sha256) · Modbus poller             │
│   (modbus-serial) · Sparkplug bridge (sparkplug-payload, optional)          │
│   Hardware: fanless industrial mini-PC (8 GB RAM, 256 GB SSD industrial)    │
│   OS: Ubuntu Server 24.04 LTS · Docker Engine                               │
│   Security level target: IEC 62443 SL-2 (FactoryMind responsibility)        │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ MQTT/TLS 8883 (TCP)  ·  MQTT/WSS 9001
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                        TIER 3 — MESSAGE BROKER                              │
│   Eclipse Mosquitto 2.x (single-tenant) OR EMQX 5.x cluster (multi-tenant)  │
│   ACL: pattern-based per facility_id (mosquitto/config/acl)                 │
│   Listeners: 1883 plain (dev only) · 8883 TLS (prod) · 9001 WSS (browsers)  │
│   Persistence: enabled · Retention: alarms QoS 1, 24 h max                  │
└─────┬───────────────────────────────────────────────────┬───────────────────┘
      │ subscribe factory/#                              │ optional bridge → cloud
┌─────▼────────────────────┐                         ┌───▼─────────────────────┐
│   FactoryMind Backend    │                         │  Grafana Alertmanager   │
│   (Node 20 LTS · Express)│                         │  (optional)             │
│   - MQTT handler         │                         └─────────────────────────┘
│   - InfluxDB writer      │
│   - Alert engine         │
│   - OEE engine           │
│   - JWT/RBAC/audit       │
│   - Attestazione PDF gen │
│   - WebSocket fan-out    │
└───┬───────────────┬──────┘
    │               │
┌───▼─────────┐ ┌──▼────────┐
│ InfluxDB 2.7│ │PostgreSQL │
│ time-series │ │ 16 meta   │
│ buckets:    │ │ + RBAC    │
│ telemetry,  │ │ + audit   │
│ status,     │ │ + alerts  │
│ alarms,     │ │           │
│ counters    │ │           │
└──────┬──────┘ └───────────┘
       │
┌──────▼─────────────────────┐
│ Grafana 11+ (provisioned)  │
│ + React 18 dashboard       │
│ + landing-page (static IT) │
└────────────────────────────┘
                          │
                          │ TLS 1.3 (HSTS preload, COOP/CORP, CSP strict)
                          │
┌─────────────────────────▼─────────────────────────────────────────────────┐
│                     TIER 5 — INTERNET / CUSTOMER USER                     │
│   Browser (FactoryMind dashboard) · Grafana · Mobile (responsive UI)      │
│   Customer's commercialista / responsabile produzione / operatore         │
│   Security level: TLS 1.3 + HSTS 1 y preload + Permissions-Policy locked  │
└───────────────────────────────────────────────────────────────────────────┘
```

The five tiers correspond to five responsibility surfaces. The customer's machine vendor owns Tier 1 firmware (FactoryMind only consumes its OPC UA / Modbus / MQTT outputs). FactoryMind owns Tier 2 (edge gateway, the node-opcua / modbus-serial / sparkplug bridges) and Tier 3 (broker). FactoryMind owns Tier 4 (the cloud backend, InfluxDB, PostgreSQL, Grafana, React UI). The customer owns Tier 5 (browsers, network at the user end).

Doctrine **H-3** (Italian for legal, English for engineering) and **H-13** (telemetry vs PII) draw their domain boundaries on this diagram: telemetry crosses tiers 1→2→3→4, never personal; user authentication crosses tiers 5→4, always personal; Piano 4.0 attestazione crosses tier 4 → external (commercialista's email) once per machine per fiscal year, and the recipient is bound by the DPA at that boundary.

### 3.2 Data model — PostgreSQL (metadata, RBAC, audit)

The relational schema handles configuration, RBAC, and audit. Telemetry never touches PostgreSQL; PII never touches InfluxDB. The boundary is enforced by application convention plus by `backend/src/db/migrations/001_initial.sql` schema definitions.

| Table | Purpose | Key fields | PII? | Retention |
|---|---|---|---|---|
| `facilities` | Stabilimento (plant). Natural-key `facility_id` ≤ 64 chars. | `facility_id` UNIQUE, `name`, `address`, `city`, `province`, `country`, `timezone`, `metadata` JSONB | No (industrial identifier) | Indefinite while active |
| `lines` | Linea di produzione. Many-to-one with `facilities`. | `(facility_id, line_id)` UNIQUE, `name`, `target_oee` numeric | No | Indefinite |
| `devices` | Macchina / PLC / sensore. Many-to-one with `lines`. | `(facility_id, line_id, machine_id)` UNIQUE; `protocol` CHECK in {`mqtt`, `opcua`, `modbus_tcp`, `modbus_rtu`, `sparkplug`}; `ideal_cycle_time_sec`, `opcua_tags` JSONB, `modbus_map` JSONB | No (industrial — but free-form `metadata` JSONB MUST NOT contain operator names — cfr. doctrine **H-13**) | Indefinite |
| `shifts` | Turni pianificati. Per-line. | `start_at`, `end_at`, `planned_breaks_sec`, `metadata` JSONB | Possibly via free-form `metadata` (avoid) | 7 years (Codice Civile art. 2220) |
| `downtimes` | Fermo macchina classificato. | `start_at`, `end_at`, `reason_code`, `classification` ∈ {`planned`, `unplanned`, NULL} | No | 7 years |
| `alert_rules` | Regole di allarme. JSONB expression today (threshold), composable in roadmap. | `expression` JSONB: `{ kind, operator, threshold, hysteresis, debounce_sec }`; `severity`, `enabled` | No | Indefinite |
| `alerts` | Allarmi materializzati. State machine open → acknowledged → resolved. | `rule_id` FK to `alert_rules` ON DELETE CASCADE; `severity`, `status`, `escalated_at`, `acknowledged_by`, `acknowledged_at`, `resolved_at` | Acknowledger / resolver are personal (`acknowledged_by` references `users.id`) | 24 months active + 5 y archived |
| `users` | Identità locali + RBAC. | `email` UNIQUE, `full_name`, `role` CHECK in {`admin`, `supervisor`, `operator`, `viewer`}, `facility_scope` TEXT[], `password_salt`, `password_hash` (scrypt N=16384), `active` | **Yes** (C4 PII) | Account lifetime + 24 months |
| `audit_log` | Append-only audit trail of state-changing actions. | `actor_user_id`, `actor_email`, `action`, `resource_type`, `resource_id`, `ip_address` INET, `payload` JSONB, `created_at`. Indexed on `(actor_user_id, created_at DESC)` and `(action, created_at DESC)`. | **Yes** (C4 PII) | 13 months by default (Provv. Garante 27/11/2008 sysadmin minimum); customer opt-in 7 years for fiscal trace |
| `refresh_tokens` | Refresh token rotation. | `user_id` FK, `token_hash` (SHA-256 of opaque token; raw token never persisted), `expires_at`, `issued_at`, `ip_address`, `user_agent` | Indirect PII (IP + user agent) | Token lifetime + 24 h |

The schema lives in `backend/src/db/migrations/001_initial.sql` through `007_attestazioni_pdf_blob.sql`. Migration discipline (forward-only, idempotent) is doctrine **H-14**. The migrations use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE … ADD COLUMN IF NOT EXISTS` exclusively — `DROP` and `TRUNCATE` are forbidden in migration files (CI lint, REMEDIATION R-MIGR-LINT-001).

Foreign-key cascades:

- `alerts.rule_id` → `alert_rules.id` ON DELETE CASCADE — disabling a rule that has open alerts removes the alerts in the same transaction; the audit log captures the disable event.
- `lines.facility_id` → `facilities.facility_id` — deleting a facility soft-cascades (children become orphans, never deleted, until manually purged via `scripts/purge-facility.sh`); see legacy `ARCHITECTURE.md` § 2 for the rationale.
- `devices.{facility_id, line_id}` → `lines.{facility_id, line_id}` — same soft-cascade.
- `audit_log.actor_user_id` → `users.id` ON DELETE SET NULL — a deleted user retains audit trace via SHA-256-tombstoned `actor_email`; the `actor_user_id` becomes NULL but the action log persists for legal-interest forensic value (legacy `DATA_GOVERNANCE.md` § 7 erasure procedure).

### 3.3 Data model — InfluxDB 2.7 (time-series)

The InfluxDB 2.7 organisation `factorymind` (configurable via `INFLUX_ORG`) holds one bucket per retention tier. The bucket `factory-telemetry` is the canonical raw bucket.

| Measurement | Fields | Tags | Retention | Source |
|---|---|---|---|---|
| `telemetry` | `value` (float), `quality` (int 0–100) | `facility`, `line`, `machine`, `metric`, `unit` | 30 days raw | MQTT topic `factory/<facility>/<line>/<machine>/telemetry` |
| `status` | `reason_code` (string) | `facility`, `line`, `machine`, `state` ∈ {RUN, IDLE, DOWN, UNKNOWN} | 30 days raw | MQTT topic `factory/<facility>/<line>/<machine>/status` |
| `alarm` | `message` (string) | `facility`, `line`, `machine`, `code`, `severity` | 30 days raw | MQTT topic `factory/<facility>/<line>/<machine>/alarms` |
| `counters` | `good` (int), `reject` (int), `total` (int) | `facility`, `line`, `machine` | 30 days raw | MQTT topic `factory/<facility>/<line>/<machine>/counters` |
| `telemetry_1m` | aggregates of `telemetry` over 1-minute windows | same | 365 days | Flux task `downsample_1m` (provisioned at first start by `bootstrapTasks()` in `backend/src/services/influx-writer.js`) |
| `telemetry_1h` | aggregates over 1-hour windows | same | 1 095 days (3 years) | Flux task `downsample_1h` |
| `telemetry_1d` | aggregates over 1-day windows | same | indefinite (small) | Flux task `downsample_1d` |

Cardinality discipline (doctrine **H-13**'s industrial-data corollary): tags are bounded sets. `facility` ≤ 100 distinct values per tenant; `line` ≤ 50 per facility; `machine` ≤ 200 per line; `metric` ≤ 30 per machine; `unit` derived from metric (1:1). Total active series per tenant ≈ 10⁵ — InfluxDB 2.x handles 10⁶ comfortably on 16 vCPU / 64 GB RAM hardware.

**Foot-gun avoided.** Free-form identifiers (UUIDs, hashes, operator badge IDs) NEVER appear as tags. `quality` is a field, not a tag. `value` is a field, not a tag. The cardinality discipline is enforced at the application layer (`backend/src/services/mqtt-handler.js` validates topic structure against the regex `factory/[a-z0-9-]{1,32}/[a-z0-9-]{1,32}/[a-z0-9-]{1,32}/(telemetry|status|alarms|counters)$` — REMEDIATION R-MQTT-TOPIC-VALIDATION-001 tightens this).

### 3.4 Sequence diagrams — the four canonical paths

#### 3.4.1 MQTT ingestion → Influx write → alert evaluation → WS fan-out

```
Machine     Mosquitto     Backend            InfluxDB    PostgreSQL    Browser (WS)
   │            │             │                   │           │             │
   │──telemetry─►│             │                   │           │             │
   │            │──PUBLISH────►│                   │           │             │
   │            │             │── enqueue Point ──►│           │             │
   │            │             │ (batched 500 lines │           │             │
   │            │             │  flushed every 1 s)│           │             │
   │            │             │                   │           │             │
   │            │             │── eval alert rule │           │             │
   │            │             │   against value ──┼──────────►│             │
   │            │             │                   │           │ check       │
   │            │             │                   │           │ rule fires? │
   │            │             │                   │           │             │
   │            │             │   if breach:      │           │             │
   │            │             │   INSERT alert ───┼──────────►│             │
   │            │             │                   │           │             │
   │            │◄── PUBLISH alarm (qos=1) ───────│           │             │
   │            │                                 │           │             │
   │            │── WS fanout ────────────────────┼───────────┼────────────►│
   │            │                                 │           │             │
```

End-to-end latency target: median 250 ms (machine → Grafana panel update), P95 < 1 s, P99 < 2 s under SLO-4 (1-h rolling window, see § 8.1). The alert engine runs as a Node.js worker (`backend/src/services/alert-engine.js`), evaluating each incoming telemetry point against the active rules in O(rules × 1) — for typical Tier 2 deployments this is < 100 rules and < 0.5 ms per evaluation.

#### 3.4.2 OEE compute on customer dashboard load

```
Browser           Backend                PostgreSQL                InfluxDB
   │                 │                       │                         │
   │─GET /api/oee?facility=…&line=…&start=-8h&stop=now()────────────────►│
   │                 │                       │                         │
   │                 │── SELECT devices ────►│                         │
   │                 │   SELECT shifts ─────►│                         │
   │                 │   SELECT downtimes ──►│                         │
   │                 │◄────── rows ──────────│                         │
   │                 │                       │                         │
   │                 │── Flux query for counters (good, reject, total) ────►│
   │                 │   over the same window                              │
   │                 │◄──────── last(good,total) per machine ──────────────│
   │                 │                                                  │
   │                 │ computeOEE() per SEMI E10 / VDI 2884             │
   │                 │ (cfr. § 3.6 below)                               │
   │                 │                                                  │
   │◄── JSON OEEResult / OEELineRollup ──│                              │
```

The compute is read-only; the `/api/oee` endpoint is rate-limited at 60 req/min/IP at the global level. Heavy-window queries (24-h windows for Pareto) hit the L1 in-process cache → L2 Redis → L3 InfluxDB hierarchy described in legacy `MODUS_OPERANDI.md` § 6.6. The Redis layer is **not yet wired** in the open-source repo at commit `d4c5107`; UPLIFT u-perf-cache adds it for Tier 4 SaaS scale.

#### 3.4.3 OPC UA polling at the edge

```
node-opcua client (in backend/src/services/opcua-bridge.js)
    │
    │── createSession(securityPolicy=Basic256Sha256, securityMode=SignAndEncrypt) ──► PLC OPC UA server
    │◄─────────────────── session token + server certificate ────────────────────────┤
    │
    │── createSubscription(publishingInterval=1000ms, lifetimeCount=300, ...) ──────►│
    │◄────────────────────── subscriptionId ─────────────────────────────────────────┤
    │
    │── for each opcua_tag in devices.opcua_tags JSONB:                              │
    │   monitor(nodeId, samplingInterval=1000ms, queueSize=10) ──────────────────────►│
    │                                                                                 │
    │◄── DataChange notification (value + timestamp + quality) ───────────────────────┤
    │                                                                                 │
    │── translate to FactoryMind envelope                                             │
    │   { ts, metric: <opcua_tag.metric>, value, unit: <opcua_tag.unit>, quality } ──►│ MQTT publish
    │                                                            on topic factory/<facility>/<line>/<machine>/telemetry
```

Reconnect strategy: on session error, exponential backoff 1 s → 2 s → 4 s → 8 s → 16 s → 30 s, capped 30 s, retried up to 100 times before giving up and logging at ERROR level. Trust list management (the X.509 certificate exchange between FactoryMind client and the PLC's OPC UA server) is documented in § 5.7 (edge fleet hardening).

#### 3.4.4 Alert escalation cron

```
Every 5 minutes, the alert-engine worker:

  1. SELECT * FROM alerts
       WHERE status = 'open'
         AND (escalated_at IS NULL OR escalated_at < NOW() - INTERVAL '5 minutes')

  2. For each row, promote severity per the escalation ladder:
       warning → major → critical → critical (capped)

  3. UPDATE alerts SET severity = <new>, escalated_at = NOW()

  4. Re-publish the alarm event on MQTT topic
       factory/<facility>/<line>/<machine>/alarms with the new severity

  5. Re-send WebSocket fan-out envelope to all subscribed clients

  6. Optionally trigger SMTP / SMS / webhook (depending on tenant config)

  7. INSERT into audit_log: action='alert.escalated', resource_id=<alert.id>
```

The escalation cadence (5 minutes) is a tenant-tunable parameter (`ALERT_ESCALATION_INTERVAL_SEC`); 5 min is the default and applies to most Veneto-SME deployments. Customers with stricter response SLAs can tighten it via env var without code changes.

### 3.5 Failure modes & resilience matrix

The system must degrade gracefully under each of the failure conditions below. The behaviour is an explicit design choice; deviating from the documented behaviour is a regression.

| Failure condition | System behaviour | Why this choice | Detection |
|---|---|---|---|
| MQTT broker offline | Edge gateway buffers up to 90 s of telemetry in local Mosquitto store-and-forward. Backend MQTT.js client reconnects with exponential backoff 2 s → 60 s. | OT networks routinely lose internet for minutes; data loss > seconds is unacceptable. 90 s buffer covers typical SD-WAN failover. | `factorymind_mqtt_connected` metric; alert `FactoryMindMQTTDisconnected` after 1 min. |
| InfluxDB offline | Backend writer buffers up to 50 000 lines in-memory. Retries with backoff 1 s → 2 s → 4 s → 8 s. After buffer full, oldest lines drop with WARN log per dropped batch. | Trade memory pressure for data preservation; 50 k lines ≈ 50 s of telemetry at 1 kHz aggregate. | `factorymind_influx_buffer_size` gauge; alert `FactoryMindInfluxWriteFailures` if write-fail ratio > 0.1 % over 10 min. |
| PostgreSQL offline | Read-only paths degrade (returning stale 5xx with Retry-After). Write paths return 503. Alert engine pauses alert evaluation but continues telemetry ingestion (no alerts produced during outage; on PG recovery, no replay — this is a deliberate gap, REMEDIATION R-ALERT-REPLAY-001). | The platform is a monitoring overlay (doctrine **H-12** "ceremony, not interlock"); alert gaps during DB outages are acceptable. Telemetry preservation matters more. | Health endpoint `/api/health` returns dependencies.postgres.ok = false; alert `FactoryMindPostgresUnreachable` after 1 min. |
| Backend pod / process OOM | Pod restarts (k8s) or process restarts (systemd Tier 2). MQTT durable session (`clean=false`) recovers queued QoS-1 messages on reconnect. In-flight HTTP requests fail; client retries are the customer-visible behaviour. | Memory pressure is a routine event in Node.js apps with long-running connections; restart is the canonical recovery. Durable session = no message loss. | `factorymind_heap_used` / `factorymind_heap_limit` ratio; alert `FactoryMindHeapPressure` at 80 %. |
| OPC UA server restart | node-opcua client reconnects with exponential backoff 1 s → 30 s, max 100 retries. Session re-creates; subscriptions re-create; first datapoint after reconnect carries the OPC UA `quality` flag indicating the gap. | Industrial PLCs reboot for firmware updates; reconnection must be automatic and silent. | OPC UA session metric; warning logged at every retry but noisy WARN suppressed by exponential backoff. |
| Modbus slave unreachable | Read path increments per-device failure counter. Logs aggregated (one INFO log per 10 consecutive failures, with summary statistics) to avoid log spam. | Modbus is fragile by protocol design; transient failures are routine. Verbose logging would drown the journal. | `factorymind_modbus_failures_total{device}` counter. |
| Edge gateway hardware failure | Customer notified via the operational SLA channel (email or PEC for Italian B2B). Local data lost (no off-site backup at the edge in default Tier 2 deployment). Recovery: replace gateway, re-run installer, reseed device config from cloud. RPO 24 h (the daily Postgres dump from cloud ↔ edge sync). | Tier 2 customers run on commodity hardware; full HA at the edge is Tier 3 / 4 territory. Honest RPO disclosure. | Customer-side IT monitoring (out of FactoryMind scope). |
| Cloud region outage (eu-south-1 Milano) | Tier 4 SaaS only: failover to eu-central-1 Frankfurt with documented 4-hour RTO, 1-hour RPO. DR drill quarterly. Tier 2/3 deployments at customer's own region are out of scope. | EU data residency: failover stays within EEA. | CloudWatch / Aruba SLA monitoring; manual cutover procedure (DR runbook in REMEDIATION R-RUNBOOK-DR-001). |
| Sister-product GreenMetrics outage (during Piano 5.0 attestazione) | `backend/src/services/piano5-attestazione.js` returns 503 with explanatory message in IT and EN. The user can retry; manual fallback is to contact GreenMetrics support and re-attempt later. No partial PDF is produced. | Better to fail visibly than to ship a wrong attestazione PDF (cfr. doctrine **H-15** OEE math canonical: same principle applies to Piano 5.0 energy savings calculation). | HTTP probe on `_greenmetrics._tcp.local`; alert (TBD) when GreenMetrics has been unreachable > 5 min during business hours. |

### 3.6 OEE math (canonical)

The OEE formula implemented in `backend/src/services/oee-calculator.js` follows SEMI E10 (semi.org/en/products-services/standards) and ISO 22400-2 conventions.

**Definitions** (notation matches the code):

- `Planned Production Time` = shift duration (`shifts.end_at` − `shifts.start_at`) − `shifts.planned_breaks_sec`.
- `Operating Time` = `Planned Production Time` − Σ `downtimes.duration_sec` for downtimes intersecting the calculation window where `classification` ∈ {`unplanned`, NULL}.
- `Total Count` = sum of `counters.good + counters.reject` over the window.
- `Good Count` = sum of `counters.good` over the window.
- `Ideal Cycle Time` = `devices.ideal_cycle_time_sec` (per SEMI E79: empirical best-demonstrated sustainable performance, ideally P10 sustained ≥ 1 hour on the target product; **never** nameplate / vendor-specified — operator responsibility, set during onboarding).

**Formulas:**

```
Availability =  Operating Time / Planned Production Time

Performance  =  min(1.0, (Ideal Cycle Time × Total Count) / Operating Time)

Quality      =  Good Count / Total Count   (1.0 if Total Count = 0)

OEE          =  Availability × Performance × Quality
```

The `min(1.0, …)` clamp on Performance is deliberate: in pathological cases (counter overflow, sensor double-counting, ideal-cycle-time set too high after a process change) the raw computation can yield Performance > 1.0, which is mathematically valid but operationally confusing. The clamp displays a plausible Performance ≤ 1.0 and logs a WARN with a `data_quality.performance_clamp` event. The customer's data-quality report (delivered weekly to the customer-success manager — UPLIFT Track Commercial u-cs-data-quality-report) aggregates these events for review.

**Classification thresholds** (legacy `ITALIAN-COMPLIANCE.md` and SEMI E10 commentary):

| OEE range | Classification | Italian label (`backend/src/services/oee-calculator.js` constants) |
|---|---|---|
| ≥ 0.85 | World-class | "World-class" |
| 0.65 – 0.85 | Above average | "Sopra media" |
| 0.45 – 0.65 | Average / typical | "In media" |
| < 0.45 | Below target | "Sotto obiettivo" |

The 85 % world-class benchmark is the Nakajima TPM / SEMI E10 commentary canonical figure. It is **not** an SLO; it is an operational reference for benchmark conversations with customers' responsabili di produzione. UPLIFT u-oee-benchmark explores customer-segment-specific benchmarks (a discrete-machining shop's "world-class" differs from a continuous-process food line's).

**Data-quality safeguards.** The clamp above is one. Three more: (a) if `Operating Time = 0` (the entire window is downtime), Performance and Quality are reported as `NaN` not `0` to distinguish "no data" from "no production"; (b) the rolling-window vs shift-bounded choice is per-tenant (default: rolling 8-hour window matching typical Veneto-SME single-shift); (c) micro-stoppage threshold is 30 seconds — stoppages below 30 s roll into Performance loss, stoppages ≥ 30 s into Availability loss (this is the SEMI E10 convention; deviating from it requires an ADR).

### 3.7 Topic structure (MQTT)

The canonical MQTT topic structure is the contract between Tier 1 (machines), Tier 2 (edge gateway), Tier 3 (broker), and Tier 4 (backend ingestion). Doctrine **H-10** binds: changes to topic structure are documented before code, both repos cite the same contract version, and the migration is a tagged event.

```
factory/<facility_id>/<line_id>/<machine_id>/<kind>

where:
  <facility_id> ∈ [a-z0-9-]{1,32}    (e.g., "mozzecane", "mozzecane-2")
  <line_id>     ∈ [a-z0-9-]{1,32}    (e.g., "line-01")
  <machine_id>  ∈ [a-z0-9-]{1,32}    (e.g., "machine-01", "cnc-mazak-qt250")
  <kind>        ∈ {telemetry | status | alarms | counters | commands}
```

The five `<kind>` topics carry these payload shapes:

- **`telemetry`** — JSON array of `{ ts: ISO8601, metric: string, value: number, unit: string, quality: 0..100 }`. QoS 0. Not retained.
- **`status`** — JSON object `{ ts: ISO8601, state: "RUN" | "IDLE" | "DOWN" | "UNKNOWN", reason_code?: string }`. QoS 1. Retained.
- **`alarms`** — JSON object `{ ts: ISO8601, code: string, severity: "warning" | "major" | "critical", message: string }`. QoS 1. Not retained (alarms expire; the dashboard presents them based on the InfluxDB measurement, not the broker retain).
- **`counters`** — JSON object `{ ts: ISO8601, good: int, reject: int, total: int }`. QoS 1. Not retained.
- **`commands`** — JSON object whose shape is per-tenant configurable (typically `{ ts, command_type, parameters }`). QoS 1. Backend → machine direction. **Not used in standard FactoryMind operation** — the platform is observe-only by design (doctrine **H-12**); the topic is reserved for Tier 3 customers who have ordered the optional "remote part-program load" feature with an ADR.

Sparkplug B (when enabled) coexists with vanilla FactoryMind topics via the `spBv1.0/<group_id>/<message_type>/<edge_node_id>/<device_id>` namespace per the Sparkplug B specification; the Sparkplug bridge (`backend/src/services/sparkplug-bridge.js`) translates between Sparkplug envelopes and FactoryMind envelopes. Sparkplug B is **opt-in** via the `SPARKPLUG_ENABLED=true` env var; when disabled, the bridge module is not loaded and the protobuf parser surface (a known dependency hot spot) is not reachable.

### 3.8 Deployment topologies

Three deployment topologies are supported. Each carries a different security, latency, and operational-cost profile; the customer chooses based on their requirements.

**Topology A — Single-tenant on-premise (Tier 2 customer's own hardware).**

- All four backend tiers (broker, backend, Influx, Postgres, Grafana) run on a single industrial mini-PC in the customer's OT armadio.
- TLS terminates at nginx on the same box (or at the customer's existing reverse proxy).
- Backups: daily `pg_dump` + `influx backup` to a USB drive in the customer's office, weekly to off-site (customer's choice — Aruba Cloud, Microsoft OneDrive, Google Drive).
- Internet connectivity optional; FactoryMind dashboard works fully offline. The customer's commercialista accesses the system via VPN (or via PDF email if they prefer not to VPN).
- Recommended for: customers with strict OT/IT segmentation, no public internet in the production network, regulatory preference for on-premise data.

**Topology B — Hybrid (broker + edge gateway on-prem; Influx, Postgres, Grafana, backend in EU cloud).**

- Mosquitto broker + edge gateway (OPC UA / Modbus / Sparkplug bridges) at customer's premises.
- Bridge to a cloud broker (Mosquitto on Aruba Cloud Milano, EMQX Cloud, or AWS IoT Core in eu-south-1).
- Backend, Influx, Postgres, Grafana in EU cloud (Aruba Milano, OVHcloud Milano, AWS eu-south-1).
- TLS end-to-end (mTLS at the bridge boundary); customer's IT team gets dashboard access from anywhere via the public URL with HTTPS + HSTS preload.
- Recommended for: customers who want centralised analytics + multi-shift access without the operational burden of on-prem hosting.

**Topology C — Multi-tenant SaaS (Tier 4 FactoryMind Cloud).**

- EMQX cluster (3+ nodes) in eu-south-1.
- InfluxDB Cloud Dedicated in eu-central-1 OR self-managed InfluxDB OSS multi-bucket.
- Aurora PostgreSQL Serverless v2 with row-level security per tenant.
- Grafana Cloud or self-managed Grafana with org-per-tenant.
- Tenant isolation: ACL per `<tenant_id>` in MQTT topic prefix; per-tenant InfluxDB bucket; PG row-level security per `tenant_id` set as `SET LOCAL` at transaction start.
- Recommended for: small Tier-2 prospects who don't want to manage infrastructure, and as a stepping-stone before they upgrade to Topology A or B.

The default `terraform/` modules support Topology B/C (AWS eu-south-1). On-premise (Topology A) is the install.sh path. No Terraform module currently implements pure on-prem; this is consistent with the Veneto-SME bring-your-own-hardware reality.

---

## 4. Code map

This section is the *navigable index* of the codebase. It does not duplicate code; it points the cold reader at the file:line where decisions and behaviours live. Doctrine **H-5** binds: every module listed here has at least two named owners. At v1.0 baseline (commit `d4c5107`, Renan as solo maintainer), every line below names "Renan + TBD"; the second name is filled within 30 days of the second engineer's first commit (this is REMEDIATION R-OWNER-001).

### 4.1 Backend (`backend/`) — Express 4 + Node.js 20 LTS

The backend is the heart of FactoryMind. It owns: HTTP API, MQTT ingestion, InfluxDB writes, alert engine, OEE compute, JWT auth, RBAC, audit log, OPC UA / Modbus / Sparkplug bridges, attestazione PDF generation, WebSocket fan-out, OpenTelemetry instrumentation.

#### 4.1.1 Entry point and bootstrap (`backend/src/index.js`)

The single entry. `buildApp()` (line 59) constructs the Express middleware chain. `main()` (line 180) is the async bootstrap sequence. Important lines:

- `:59` — `buildApp()` instantiates Express, attaches middleware in order: pino-http (with W3C `traceparent` propagation at line 75), helmet (lines 83–102 — the canonical CSP / HSTS / frame-ancestors block), CORS (line 109, validating against `config.cors.allowedOrigins`), compression (line 113), `express.json({ limit: '1mb' })` (line 115), rate-limit (lines 123–134, 60 req/min/IP global), CSRF (line 138, scoped to `/api/*` and exempting Bearer-auth routes), then routes.
- `:180` — `main()` async bootstrap: validates config (will exit on weak-secrets per doctrine **H-2**), connects PostgreSQL pool, runs admin-bootstrap (line 189–191 fail-closed `process.exit(10)` if no admin in production), seed-admin detection (lines 194–202, `process.exit(11)` if seed-admin password hash present in production), Express HTTP listener on port 3002, attaches WebSocket (line 208), connects MQTT (line 214), bootstrap Influx tasks (lines 215–217, provisions Flux downsampling tasks at first start).
- `:228–239` — Sparkplug bridge **dynamically required** behind `process.env.SPARKPLUG_ENABLED === 'true'` (gates the protobufjs surface — see `services/sparkplug-bridge.js` below).
- `:242–281` — graceful shutdown handler with 15-second deadline. SIGINT and SIGTERM (`:272–273`) drain in order: HTTP server stops accepting connections, in-flight requests complete (with timeout), MQTT client cleanly disconnects, WebSocket closes, Influx writer flushes (`influx.flush()` at `:259`) then closes (`:260`), PostgreSQL pool drains.

The bootstrap order is intentional: configuration first (fail-fast on misconfig), database second (fail-fast on connection), HTTP listener third (be available for health probes), async subsystems last (MQTT can take seconds to connect; we want `/api/health` answering before MQTT lands).

**Test surface:** `backend/tests/health.test.js`, `backend/tests/admin-bootstrap.test.js`, `backend/tests/config-prod-guardrails.test.js`, `backend/tests/security.test.js`. Coverage target 70 % lines.

**Owners:** Renan + TBD (REMEDIATION R-OWNER-001).

#### 4.1.2 Config (`backend/src/config/index.js`)

Joi schema validation + production guardrails. The single entry point for all environment-driven configuration: PostgreSQL connection string, JWT secrets, MQTT broker URL + credentials, InfluxDB org/bucket/token, CORS origins, rate-limit windows, OpenTelemetry endpoint, OPC UA endpoint, Sparkplug enable flag.

- `:113–145` — production guardrails (the doctrine **H-2** anchor). Each `forbidden.push(...)` is a fail-closed condition: weak `JWT_SECRET`, non-TLS `MQTT_BROKER_URL`, localhost-or-wildcard CORS, undersized `INFLUX_TOKEN`. Currently missing: empty `MQTT_PASSWORD` check (REMEDIATION R-CONFIG-MQTT-001 adds it).
- `:isProduction` (helper exported from this module) — used throughout the codebase to gate dev-only behaviours. **Important corollary** (cfr. `middleware/auth.js:28-30`): if `config.isProduction` evaluates to `false` due to a missing `NODE_ENV`, the dev-mode auth bypass kicks in. Production deployment ceremony (§ 5.5 checkpoint #2) verifies `NODE_ENV=production` is exported before the systemd unit / k8s pod starts.

**Test surface:** `backend/tests/config-prod-guardrails.test.js`. Asserts every prod-only invariant fail-boots correctly.

#### 4.1.3 Middleware (`backend/src/middleware/`)

Each middleware is a single-responsibility module. The order in which they're applied (constructed in `index.js:buildApp()`) matters; reordering without thinking is a regression vector.

- `auth.js` — JWT validation. Algorithm pinned to **HS256** at `:21`; `alg: none` and HS-RS confusion attacks rejected. Typ-claim validation at `:40-42` distinguishes access tokens from refresh tokens (a refresh token presented on a protected endpoint returns 401, not 403, by design — protocol confusion). Dev-mode bypass at `:28-30` populates `req.user` as `{ role: 'admin' }` when no Bearer header is present and `config.isProduction === false`. Role hierarchy at `:55-72`: `viewer (0) < operator (1) < supervisor (2) < admin (3)`. `requireRole(minRole)` factory function used by routes to gate endpoints by role.
- `csrf.js` — Double-submit token pattern. Cookie-set on first request; subsequent state-changing requests must echo the cookie value in `X-CSRF-Token` header. Bearer-authenticated routes are exempted (rationale: the SPA uses Authorization header, not cookies; CSRF surface is zero on Bearer-auth routes — same logic as LogiTrack, cfr. legal/CONTRATTO-SAAS-B2B.md art. 8 customer obligations).
- `lockout.js` — Account-level lockout after 5 consecutive failed logins, 900 s window, exponential backoff. Records to `lockout` table. Returns `Retry-After` header on 429.
- `passwordPolicy.js` — Minimum 12 chars, max 128, deny-list (common passwords + "factorymind" variants), HIBP k-anonymity range query (only the first 5 chars of the SHA-1 hash sent over the network — k-anonymity preserves password privacy).
- `audit.js` — Records every state-changing 2xx/4xx response to `audit_log`. Reads sampled at 10 % in production (`AUDIT_READ_SAMPLE_RATE` env var). Skipped on 5xx (errors go through error logs, not audit trail — this is a deliberate choice, mirrored from LogiTrack SECURITY.md § 2.7).
- `errorHandler.js` — Centralised error response. 4xx errors return the user-facing message; 5xx errors return a generic message and log the full error server-side. **Gap**: a few 5xx paths echo `err.message` to the client (cfr. AUDIT F-MED-006); REMEDIATION R-ERROR-SAFE-001 introduces a `safeInternal(c, code)` helper.
- `validation.js` — Joi schema runner. Every route imports its schema and applies `validateBody(schema)` or `validateQuery(schema)` before the handler.
- `rateLimit.js` — `express-rate-limit` configuration. Global 60 req/min/IP. Per-route overrides: `/api/users/login` 10 req/min, `/api/users/me/gdpr-export` 10 req/h, `/api/users/me` (DELETE) 10 req/h, `/api/contact` 5 req/h.

**Test surface:** `backend/tests/security.test.js` covers helmet, CORS, CSRF; `backend/tests/csrf-bootstrap.test.js`; `backend/tests/contact-form.test.js`. JWT pinning + lockout covered in integration.

#### 4.1.4 Routes (`backend/src/routes/`)

Each route module is a thin Express router that imports its Joi schema, applies validation + RBAC, and delegates to a service in `backend/src/services/`. Routes do not contain business logic.

| Route | RBAC | Joi schema | Service | Notes |
|---|---|---|---|---|
| `users.js` (`POST /api/users/login`) | public | login schema | `services/auth.js` | Returns JWT + refresh token. Lockout-gated. |
| `users.js` (`POST /api/users`) | admin | create-user schema | inline | scrypt password hash. |
| `users.js` (`GET /api/users/me/gdpr-export`) | self | none | `services/gdpr.js` | Rate-limited 10 req/h. **Service does not yet exist** (cfr. AUDIT F-HIGH-006); REMEDIATION R-GDPR-001 ships it. |
| `users.js` (`DELETE /api/users/me`) | self | password-confirm schema | `services/gdpr.js` | Requires password reconfirmation. Soft-delete + 7-day audit quiescence + tombstone (cfr. § 7.3). |
| `facilities.js` (`*`) | supervisor (R/W) / viewer (R) | per-route | inline | CRUD over `facilities` table. |
| `lines.js` (`*`) | supervisor / viewer | per-route | inline | CRUD over `lines`. |
| `devices.js` (`*`) | supervisor / viewer | per-route | inline | CRUD over `devices`. Includes `opcua_tags` and `modbus_map` JSONB editing. |
| `metrics.js` (`GET /api/metrics`) | viewer | query-validation schema with regex whitelist | `services/influx-query.js` | **Flux query is server-generated** from validated query params; the user does NOT submit Flux. The whitelist regex is the defence against Flux injection. |
| `oee.js` (`GET /api/oee`) | viewer | query schema | `services/oee-calculator.js` | Returns `OEEResult` (single machine) or `OEELineRollup` (line / facility aggregate). |
| `alerts.js` (`*`) | various | per-route | `services/alert-engine.js` | List, acknowledge, resolve. |
| `attestazione.js` (`POST /api/attestazione`) | supervisor | machine-id + year schema | `services/piano4-attestazione.js` (or `piano5-attestazione.js`) | Renders Piano 4.0 or Piano 5.0 PDF. |
| `contact.js` (`POST /api/contact`) | public | contact schema | inline (nodemailer) | Rate-limited 5 req/h. **Gap**: HTML escaping of email body (cfr. AUDIT F-HIGH-005); REMEDIATION R-CONTACT-ESCAPE-001. |
| `health.js` (`GET /api/health`, `GET /api/ready`) | public | none | `services/health.js` | Liveness + readiness for k8s probes. |
| `prometheus-metrics.js` (`GET /metrics`) | public (network-restricted) | none | inline | Prometheus exposition format. **Unauthenticated by design** — must be network-restricted in production (k8s NetworkPolicy allows only Prometheus pod). |

**Doctrine **H-4** binds:** every route is enumerated here, in `docs/openapi.yaml`, and in `backend/src/routes/`. CI lint (REMEDIATION R-CI-DOCS-001) catches drift.

#### 4.1.5 Services (`backend/src/services/`)

This is where business logic lives. Each service is a single responsibility.

- `mqtt-handler.js` — MQTT client lifecycle (connect, subscribe `factory/#`, dispatch by topic kind). Reconnect strategy: 2 s base, exponential backoff to 60 s. Keep-alive 30 s. Bound the topic regex per § 3.7 (REMEDIATION R-MQTT-TOPIC-VALIDATION-001 tightens current loose match).
- `influx-writer.js` — InfluxDB write API + downsampling task provisioning. Batched writes (500 lines, 1 s flush, 50 k buffer, 3 retries). `bootstrapTasks()` provisions Flux tasks at startup. **Gap**: task-creation success not verified (cfr. AUDIT F-MED-INFLUX-TASK-VERIFY); REMEDIATION R-INFLUX-TASK-001.
- `alert-engine.js` — Rule evaluation per incoming telemetry point. Escalation cron at 5-minute interval (§ 3.4.4). Rules currently support threshold expressions only (`{ kind: 'threshold', operator, threshold, hysteresis, debounce_sec }`); composable rules (AND/OR/NOT) are roadmap (legacy MODUS_OPERANDI § 5.3).
- `admin-bootstrap.js` — Idempotent admin-user provisioning at startup. Reads `FM_ADMIN_EMAIL` and `FM_ADMIN_PASSWORD_HASH` from env; creates the user if absent; refuses to start if the hash matches the seed default in production.
- `opcua-bridge.js` — OPC UA client (node-opcua). Subscribe to PLC nodes per `devices.opcua_tags` JSONB. Publish translated MQTT messages. **Gap**: endpoint URL not validated (cfr. AUDIT F-CRIT-003 SSRF surface); REMEDIATION R-OPCUA-VALIDATE-001.
- `modbus-bridge.js` — Modbus TCP/RTU client (modbus-serial). Polling per `devices.modbus_map` JSONB. Per-device failure counter to suppress log spam.
- `sparkplug-bridge.js` — Sparkplug B bridge (sparkplug-payload). **Loaded only if `SPARKPLUG_ENABLED=true`** (gates the protobufjs CVE surface). Translates Sparkplug envelopes ↔ FactoryMind envelopes.
- `piano4-attestazione.js` — Piano Transizione 4.0 attestazione PDF generator. Inputs: `machine_id`, fiscal year. Outputs: PDF file with the five caratteristiche tecnologiche obbligatorie + the two caratteristiche di interconnessione + sample telemetry log + cross-references to Circolare MISE/AdE 9/E del 23 luglio 2018. Uses pdfkit or puppeteer (TBD per ADR; current implementation TBD).
- `piano5-attestazione.js` — Piano Transizione 5.0 attestazione. Discovers GreenMetrics via DNS-SD on `_greenmetrics._tcp.local`. Queries `/api/v1/energy/baseline` (12-month pre-intervention consumption) and `/api/v1/energy/monitored` (post-intervention). Computes percentage savings. Validates against thresholds (≥ 3 % process / ≥ 5 % site per DM 24 luglio 2024). Renders PDF with the appropriate credit band.
- `predictive-maintenance.js` — Indicators-only (RMS vibration, bearing temperature, cycle drift). Publishes `severity: warning` alarms when indicators exceed thresholds. **Does not** make automated decisions (doctrine **H-13** corollary; GDPR Art. 22 compliance). Roadmap: ML model (gradient-boosted tree on 90-day windows) for Phase 4 (legacy MODUS_OPERANDI § 5.4); not in commit `d4c5107`.
- `housekeeping.js` — Periodic maintenance: stale-token reaper, expired-alert cleanup, audit-log partitioning (when partitioning is enabled — `pg_partman` is roadmap, REMEDIATION R-PG-PARTITION-001).
- `gdpr.js` — **TARGET STATE.** GDPR subject-rights service: export (Art. 15, 20), erasure (Art. 17 + tombstone), restriction (Art. 18). REMEDIATION R-GDPR-001 ships this. At v1.0 baseline, the manual procedure documented in § 7.3 is the substitute.

#### 4.1.6 Database (`backend/src/db/`)

- `pool.js` — PostgreSQL connection pool (`pg-pool`). 10 max connections, 30 s idle timeout, 10 s connection timeout. Exported as `pool`; queries via `pool.query(text, params)` (parameterised; no string concatenation, ever).
- `migrations/` — `node-pg-migrate` migration files. Seven migrations at v1.0 (`001_initial.sql` → `007_attestazioni_pdf_blob.sql`). Idempotent (cfr. doctrine **H-14**). Migration runner: `npm run migrate` (calls `node-pg-migrate up`).

#### 4.1.7 Models (`backend/src/models/index.js`)

- Constants for the RBAC role hierarchy (mirrored in `middleware/auth.js`).
- Type definitions / JSDoc annotations for the canonical types: `User`, `Facility`, `Line`, `Device`, `Alert`, `OEEResult`, `OEELineRollup`, `TelemetryEnvelope`. **Note**: TypeScript would make this stronger; backend is JS at v1.0; UPLIFT u-dx-typescript-backend explores migration.

#### 4.1.8 Utils (`backend/src/utils/logger.js`)

Pino logger configured with redaction list: `password`, `secret`, `token`, `salt`, `jwtSecret`. W3C `traceparent` header parsed and logged for trace-to-log correlation. Output format JSON in production, pretty-printed in dev.

#### 4.1.9 MQTT topic helpers (`backend/src/mqtt/topics.js`)

Topic shape constants and validation regex. The single source of truth for the topic structure documented in § 3.7. Imported by `mqtt-handler.js`, `iot-simulator/simulator.js` (cross-package — note this is a code-smell that REMEDIATION R-MQTT-SHARED-PKG-001 cleans up by extracting to a shared package), and tests.

#### 4.1.10 WebSocket server (`backend/src/ws/server.js`)

WebSocket fan-out for real-time telemetry to subscribed clients. Subscriptions sent as JSON `{ type: 'subscribe', topics: [...] }` after upgrade. Heartbeat ping every 20 s; clients that don't pong within one interval are terminated.

**Gap (cfr. AUDIT F-HIGH-010)**: WebSocket handshake does not verify the JWT. The current default reverse-proxy / ingress configuration carries the cookie / Authorization header through, but the WebSocket handler itself does not parse it. REMEDIATION R-WS-AUTH-001 implements explicit JWT parsing in the upgrade handler with three accepted locations: Authorization header, query parameter `?access_token=`, `Sec-WebSocket-Protocol` subprotocol (LogiTrack pattern).

#### 4.1.11 Tests (`backend/tests/`)

13 test files at v1.0:

| Test file | Subject |
|---|---|
| `health.test.js` | `/api/health` and `/api/ready` envelope shape |
| `security.test.js` | helmet, CORS, CSRF basics |
| `admin-bootstrap.test.js` | seed-admin fail-boot |
| `config-prod-guardrails.test.js` | prod-only invariants |
| `csrf-bootstrap.test.js` | CSRF token issuance |
| `contact-form.test.js` | contact-form validation, rate-limit |
| `oee.test.js` | OEE math (Availability × Performance × Quality + clamp) |
| `alert-engine.test.js` | Threshold evaluation |
| `attestazione-route.test.js` | Piano 4.0 endpoint |
| `attestazione-pdf.test.js` | PDF rendering smoke |
| `metrics-downtimes.test.js` | Downtimes Pareto query, Flux injection block |
| `housekeeping.test.js` | Token reaper, alert cleanup |
| `piano4-attestazione.test.js` | Piano 4.0 service |
| `prometheus-metrics.test.js` | `/metrics` exposition |
| `role-hierarchy.test.js` | RBAC `requireRole` |
| `user-deletion-reauth.test.js` | DELETE /api/users/me with password confirmation |

**Coverage gap to declare honestly** (LogiTrack discipline, doctrine **H-20**): the 70 % line coverage policy target is not measured in CI at v1.0. `coverage` artifact is uploaded but no threshold check fails the build. UPLIFT u-dx-coverage-ratchet ratchets the gate up over time.

### 4.2 Frontend (`frontend/`) — React 18 + Vite + TypeScript 5

The frontend is a single-page application with three roles: configuration UI for admins/supervisors, operator dashboard for production-floor workers, reporting view for shift supervisors. Italian is the default locale; English and German are present in `frontend/src/locales/`.

#### 4.2.1 Entry and routing

- `index.html` — single static HTML, `<html lang="it">` (hard-coded; AUDIT F-MED-i18n-html flags this for dynamic update).
- `src/main.tsx` — React 18 root mount with `StrictMode`.
- `src/App.tsx` — `BrowserRouter`, `QueryClient` (TanStack Query 5 with `retry: 1`, `refetchOnWindowFocus: false`), navigation bar in Italian, route definitions. Each page is wrapped in `ErrorBoundary`.

**Gap (cfr. AUDIT F-HIGH-002)**: no auth guards on any route. Dashboard / LineDetail / DeviceConfig / Alerts / Reports are all rendered regardless of authentication state. REMEDIATION R-FRONTEND-AUTH-001 implements `RequireAuth` wrapping the protected routes plus a `<Login />` page.

#### 4.2.2 API client (`src/api/client.ts`)

- axios instance with `baseURL` from `VITE_API_BASE_URL` env (default `/api`).
- Request interceptor injects `Authorization: Bearer <token>` reading from `localStorage.getItem('factorymind:jwt')` (line 14).
- Response interceptor on 401: clears localStorage; **does not** redirect (gap — REMEDIATION R-FRONTEND-AUTH-001 fixes both).
- Method bundles: `auth`, `health`, `facilities`, `lines`, `devices`, `metrics`, `oee`, `alerts`, `attestazione`, `contact`.

**Major gap (cfr. AUDIT F-HIGH-001)**: JWT in localStorage is XSS-stealable. The migration target is HttpOnly cookies (with the corresponding backend change to set the cookie on login). REMEDIATION R-FRONTEND-COOKIE-AUTH-001 covers the migration.

#### 4.2.3 Real-time (`src/hooks/useRealtime.ts`)

WebSocket subscription hook. Defaults to `ws://` (insecure) — `VITE_WS_URL` should override to `wss://` in production (REMEDIATION R-WS-WSS-001). No auth token in handshake; topic subscription sent as plaintext. Linear backoff 1 s → 10 s on disconnect.

#### 4.2.4 Pages (`src/pages/`)

- `Dashboard.tsx` — OEE gauge, machine status grid, alert feed, real-time stream indicator. Hard-codes `VITE_DEFAULT_FACILITY` env var.
- `LineDetail.tsx` — Per-line OEE breakdown by machine. URL params not validated (low risk since the backend re-validates, but principle of defence-in-depth — REMEDIATION R-FRONTEND-PARAM-VALIDATE-001).
- `DeviceConfig.tsx` — Read-only device list. Italian-only labels (REMEDIATION R-FRONTEND-i18n-001 covers).
- `Alerts.tsx` — List, acknowledge, resolve. 10 s refetch interval (aggressive; could be 30 s).
- `Reports.tsx` — Shift report + Pareto chart for past 24 h.

#### 4.2.5 Components (`src/components/`)

- `OEEGauge.tsx` — SVG circular gauge. Classification text hard-coded Italian (`World-class`, `Sopra media`, `In media`, `Sotto obiettivo`). `aria-label` carries the percentage.
- `AlertFeed.tsx` — Alert list with severity badges. Hard-coded Italian labels.
- `MachineStatus.tsx` — Machine state card. Color + text severity.
- `DowntimeChart.tsx` — Recharts BarChart for Pareto. Hard-coded Italian title.
- `ShiftReport.tsx` — Shift summary with `<dl>` semantics.
- `MQTTConnectionIndicator.tsx` — WebSocket connection status indicator.
- `ProductionLine.tsx` — Production line summary card.
- `ErrorBoundary.tsx` — Class component error boundary. **Gap (cfr. AUDIT F-MED-ERROR-LEAK)**: renders raw `error.message` in `<pre>` — leaks stack traces. REMEDIATION R-FRONTEND-ERROR-001.

#### 4.2.6 i18n (`src/locales/`, `src/i18n/useT.ts`)

Three locales: Italian (default), English, German. `useT()` hook with `{{var}}` interpolation. **Major gap (cfr. AUDIT F-MED-008)**: many keys referenced in components are missing from `en.json` (and probably `de.json`). REMEDIATION R-FRONTEND-i18n-001 audits all keys and fills the gaps.

#### 4.2.7 Build (`vite.config.ts`, `tsconfig.json`, `tailwind.config.js`)

- Vite proxies `/api/` and `/ws` to the backend container.
- `sourcemap: true` in production build (cfr. AUDIT F-MED-002 — leaks source). REMEDIATION R-FRONTEND-SOURCEMAP-001 disables it for prod.
- `tsconfig.json` strict mode enabled.
- `eslint.config.cjs` disables `@typescript-eslint/no-explicit-any` (cfr. AUDIT F-MED-ANY); REMEDIATION R-FRONTEND-LINT-001 enables it after a one-shot triage.

#### 4.2.8 Dockerfile (frontend)

Multi-stage: builder (`node:24-alpine`) → production (`nginx:1.29-alpine` serving the static dist). **Gap (cfr. AUDIT F-HIGH-007)**: no `USER` directive in the production stage — runs as root. REMEDIATION R-FRONTEND-DOCKERFILE-USER-001 adds `USER www-data`.

### 4.3 IoT Simulator (`iot-simulator/simulator.js`)

A single-file Node.js CLI. Publishes realistic telemetry on the canonical topic structure (§ 3.7). Configuration via `config.sample.json` or env vars (`MQTT_BROKER_URL`, `FACILITY_ID`, `LINE_COUNT`, `MACHINES_PER_LINE`, `SAMPLING_RATE_HZ`).

State machine per machine: `RUN → IDLE` (probability 0.2 per step) → `DOWN` (probability 0.01 per step). DOWN duration random 20–80 seconds. Telemetry: spindle speed (rpm), spindle temp (°C), feed rate (mm/min), power (kW), vibration (mm/s). Gaussian random walk + mean reversion + occasional 4–7σ anomaly kicks (for alert testing).

QoS: telemetry QoS 0, status QoS 1 + retain, alarms QoS 1 (no retain), counters QoS 1.

Critical for the commercial demo: customers and commercialisti see the dashboard come alive within minutes of `docker compose up` — this is the wedge that opens conversations. The simulator is part of the customer-acquisition story, not just a developer convenience. UPLIFT u-commercial-demo-polish refines its realism.

### 4.4 Mosquitto config (`mosquitto/`)

- `config/mosquitto.conf` — Listener configs (1883 plain on `0.0.0.0`, 9001 WSS on `0.0.0.0`). `allow_anonymous true` for dev (cfr. AUDIT F-CRIT-001; production override via `entrypoint.sh`). Persistence enabled with 2-h client expiration. Bridge config commented for cloud federation (Topology B).
- `config/acl` — Pattern-based per-tenant ACL: `pattern readwrite factory/%u/#` (the strong tenant-isolation primitive). Service accounts `backend` (full `factory/#` + `$SYS/#`), `simulator` (full `factory/#`), `grafana` (read-only `factory/#`). Explicit `topic deny factory/#` after readwrite to prevent privilege escalation.
- `entrypoint.sh` — Lines 28–37 fail-close if passwd file contains default credentials; lines 41–50 refuse production boot if `allow_anonymous=true` is detected and `password_file` is unconfigured. The hardening primitive that makes `allow_anonymous true` in dev safe.

### 4.5 Kubernetes (`k8s/`)

- `namespace.yaml` — Pod Security Standard `restricted` enforce/audit/warn; default-deny NetworkPolicy (`podSelector: {}`, `policyTypes: [Ingress, Egress]`).
- `deployment.yaml` — 2 replicas; runAsUser 1001; readOnlyRootFilesystem; drop ALL caps; seccompProfile RuntimeDefault; three-tier probes (liveness `/api/health`, readiness `/api/ready`, startup `/api/health`); resources `requests: cpu 100m mem 256Mi` / `limits: cpu 1000m mem 768Mi`; `automountServiceAccountToken: false`. **Gap (cfr. AUDIT F-HIGH-008)**: image is `:1.0.0` not digest-pinned.
- `service.yaml`, `ingress.yaml`, `configmap.yaml`, `secret.yaml` (template + commented ExternalSecret pattern), `pdb.yaml` (`minAvailable: 1`), `hpa.yaml` (2–10 replicas, CPU 70 %, mem 75 %).

### 4.6 Terraform (`terraform/`)

Modules: `vpc`, `db`, `secrets`, `k8s`, `storage`, `observability`, `cdn_waf`. Default region `eu-south-1` Milano (Italian data residency). **Gap (cfr. AUDIT F-CRIT-004)**: state backend block in `versions.tf` is commented out. REMEDIATION R-TF-STATE-001 uncommments and configures S3 + DynamoDB lock before any production apply.

### 4.7 Grafana provisioning (`grafana/provisioning/`)

Datasources: InfluxDB (token-auth) and PostgreSQL (`sslmode: disable` — acceptable in-cluster, REMEDIATION R-GRAFANA-PG-TLS-001 hardens for non-cluster). Dashboards: provisioned JSON for "Factory Overview", OEE, alerts, errors, infrastructure.

### 4.8 Monitoring (`monitoring/`)

- `alerts.yml` — 6 rule groups (availability, errors, latency, resources, dependencies, security) with SLO references and runbook URLs.
- `alertmanager.yml` — severity-routed (critical → pager, warning → ticket); inhibit rules suppress warnings on the same service when a critical fires.

### 4.9 CI/CD (`.github/workflows/`)

- `ci.yml` — lint, test, build, security (npm audit, Trivy, Gitleaks). **Gap (cfr. AUDIT F-CRIT-007)**: npm audit and Trivy are non-blocking (`|| true`, `exit-code: "0"`). REMEDIATION R-CI-AUDIT-001.
- `cd.yml` — Build-push to GHCR, SBOM via Syft, deploy-staging + deploy-production are placeholder echos. **Gap (cfr. AUDIT F-HIGH-009)**: Cosign signing referenced in deployment YAML comment but not implemented. REMEDIATION R-SUPPLY-001.

### 4.10 Legal templates (`legal/`)

Five Italian-language templates: `TERMINI-DI-SERVIZIO.md`, `CONTRATTO-SAAS-B2B.md`, `DATA-PROCESSING-AGREEMENT.md`, `INFORMATIVA-PRIVACY-GDPR.md`, `COOKIE-POLICY.md`. All carry `[DA_COMPILARE]` placeholders for first-customer adoption. § 9.4 (compliance baseline — legal posture) summarises gaps; AUDIT § 7 documents the full legal review.

### 4.11 Landing page (`landing-page/`)

Single static HTML in Italian + CSS. No analytics, no cookie banner (cfr. AUDIT F-MED-COOKIE-BANNER); legal pages linked via `legal/*.html` (rendered manually from the markdown templates — REMEDIATION R-LANDING-LEGAL-001 automates).

### 4.12 Docs (`docs/`)

- `HANDOFF.md` (this document) — software handoff & operations manual.
- `AUDIT.md` — full-sweep audit.
- `REMEDIATION.md` — remediation plan.
- `UPLIFT.md` — polishing & excellence plan.
- `openapi.yaml` — machine-readable API spec (companion to § 6 of this document).
- `legacy/` — superseded docs preserved for diff (Phase F of the documentation overhaul moves them here).

---

## 5. Operational lifecycle

### 5.1 Clean-machine bootstrap (15-minute path — doctrine **H-1**)

A new engineer starting on FactoryMind for the first time should reach a working dashboard inside 15 minutes. The path:

1. Install Docker (Ubuntu 24.04 LTS or macOS 14+; Docker Desktop or Engine). Time budget: 5 min if Docker is not yet installed; 0 min if already installed.
2. Clone the repository: `git clone https://github.com/renanaugustomacena-ux/macena-factorymind.git` (or via SSH for committers). 30 seconds.
3. Run `./install.sh` (interactive) or `FM_UNATTENDED=1 ./install.sh` (CI / unattended). This script: detects OS, verifies prerequisites, prompts for facility ID + admin email + admin password (interactive only) or reads `.env` (unattended), generates 32-char random `JWT_SECRET` + `JWT_REFRESH_SECRET` + `INFLUX_TOKEN` if not present, writes `.env` with secure 0600 permissions, then runs `docker compose up --build -d` and waits for health checks. Time budget: 8 min (depending on docker pull bandwidth).
4. The script opens the browser to http://localhost:5173/ on completion (using `xdg-open` on Linux, `open` on macOS). The dashboard loads, the Italian-language UI is visible, the OEE gauge populates within 60 seconds (the simulator publishes its first telemetry batch immediately, the alert engine evaluates the first batch, the OEE compute runs).

**Verification checks** the script runs before declaring success:

- `curl -fsS http://localhost:3002/api/health | jq .status` returns `"ok"`.
- `curl -fsS http://localhost:3002/api/ready | jq .status` returns `"ready"`.
- `curl -fsS http://localhost:3000/api/health` (Grafana) returns `200`.
- `mosquitto_sub -h localhost -t 'factory/#' -W 5` (5-second window) receives at least one message.

**On failure**: the script prints the failing check, dumps `docker compose logs` for the failing service, and exits non-zero. The cold reader has primary-source evidence to debug.

### 5.2 Daily-driver development workflow

For an engineer working on FactoryMind day-to-day:

- **Backend**: `cd backend && npm install && npm run dev` — starts Express with `nodemon`. Auto-reloads on file change.
- **Frontend**: `cd frontend && npm install && npm run dev` — starts Vite dev server on port 5173 with HMR.
- **Simulator**: `cd iot-simulator && npm install && npm start` — connects to the broker, publishes immediately.
- **Tests**: `cd backend && npm test` (Jest); `cd frontend && npm run typecheck && npm run lint` (no test runner yet — REMEDIATION R-FRONTEND-VITEST-001 adds Vitest).

Hot-reload is fast (< 2 s on M1 / Ryzen 7); the test feedback loop is 10–15 s for the backend test suite.

### 5.3 Production deployment (cloud — Topology B/C)

**Pre-flight checklist** (must be completed before cutover):

1. Terraform state backend configured (S3 + DynamoDB lock) — REMEDIATION R-TF-STATE-001 must be closed.
2. KMS Customer-Managed Key for RDS encryption — REMEDIATION R-RDS-KMS-001.
3. Secrets in AWS Secrets Manager (not in `.env`).
4. Docker images signed with Cosign — REMEDIATION R-SUPPLY-001 must be closed.
5. K8s NetworkPolicy beyond default-deny: explicit allows for backend↔postgres, backend↔influx, ingress→backend, prometheus→backend metrics — REMEDIATION R-K8S-NETPOL-001.
6. RDS egress security-group restricted to DNS + CloudWatch — REMEDIATION R-RDS-EGRESS-001.
7. CloudFront ACM certificate for the customer-facing domain (replaces default cert) — REMEDIATION R-CDN-CERT-001.

**Deployment ceremony (12 checkpoints — doctrine **H-12**):**

| # | Checkpoint | Verifier | Pass criterion |
|---|---|---|---|
| 1 | Secrets in Secrets Manager | DevOps | `aws secretsmanager get-secret-value --secret-id factorymind/prod` returns full JSON |
| 2 | `NODE_ENV=production` exported | DevOps | k8s deployment env shows `NODE_ENV=production` |
| 3 | DB migration applied | DBA | `psql -c "\\d users"` shows v1.0 schema; row counts match expectation |
| 4 | Broker TLS verified | DevOps | `openssl s_client -connect broker.factorymind.cloud:8883 < /dev/null` returns valid certificate chain |
| 5 | MQTT credentials provisioned | DevOps | `mosquitto_pub -h broker -p 8883 -u backend -P <secret> -t test/connectivity -m hello` succeeds |
| 6 | ACL deployed | DevOps | `mosquitto_sub -u other_user -t factory/#` returns "Access denied" |
| 7 | Influx bucket + retention + tasks | DevOps | `influx bucket list` shows `factory-telemetry` + 30-day retention; `influx task list` shows `downsample_1m`, `downsample_1h`, `downsample_1d` |
| 8 | First machine telemetry observed | DevOps + customer's responsabile produzione | Grafana "Factory Overview" panel shows live data within 5 min of bridge connect |
| 9 | First attestazione PDF rendered | DevOps + customer's commercialista | `POST /api/attestazione` for the first machine returns a valid PDF; commercialista confirms it satisfies the Circolare 9/E/2018 form |
| 10 | Audit log writing verified | DevOps | Insert a test action, `SELECT` it back from `audit_log`. Confirm `actor_email`, `ip_address`, `action`, `payload` populated |
| 11 | Backup job runs | DevOps | `kubectl get cronjob backup-postgres` shows last run successful; backup uploaded to S3 |
| 12 | Restore drill runs | DevOps | Quarterly: restore the latest backup into a staging cluster; query OEE on a known machine; verify result matches production |

Sign-off: each checkpoint initialled by the verifier in the deployment-log runbook (`docs/postmortems/deploys/<YYYY-MM-DD>-<customer-tag>.md`). Cutover does not proceed past an un-initialled checkpoint.

### 5.4 Secret rotation (doctrine **H-21**)

Routine cadence: quarterly. Triggers for immediate rotation: suspected compromise, employee departure with secrets access, security audit finding requiring rotation.

**JWT secret rotation**:

1. Generate new secret: `openssl rand -base64 48`.
2. Update Secrets Manager: `aws secretsmanager update-secret --secret-id factorymind/prod --secret-string '{"JWT_SECRET":"<new>",...}'`.
3. Restart backend pods: `kubectl rollout restart deployment factorymind-backend`.
4. **Existing access tokens become invalid immediately**; refresh tokens hash-stored in DB are unaffected (they're not signed with `JWT_SECRET`).
5. Customer impact: users see a 401 within ≤ 15 min of rotation (next API call after cached access token expires); they re-login. Communicate proactively via in-app banner.

**MQTT password rotation**:

1. Generate new password.
2. Update `mosquitto_passwd -b passwd backend <new-password>`.
3. Reload broker: `mosquitto_passwd -U` (or restart container).
4. Update Secrets Manager + restart backend pods.
5. Edge gateways automatically reconnect with the new credentials (they read from their local Secrets Manager mirror or env file).

**Influx token rotation**:

1. Create new token in Influx with same permissions: `influx auth create --user factorymind-backend --read-bucket factory-telemetry --write-bucket factory-telemetry`.
2. Update Secrets Manager.
3. Restart backend pods.
4. Revoke old token: `influx auth revoke <old-id>`.

All rotations recorded in the deployment-log runbook with date, performer, reason.

### 5.5 Production deployment ceremony — see § 5.3 above (the 12-checkpoint table).

### 5.6 Migration walkthrough

Forward-only migrations under `backend/src/db/migrations/`. To apply:

```bash
cd backend
npm run migrate    # applies all pending migrations
npm run migrate down 1    # rolls back the last migration (if needed)
```

The migration runner is `node-pg-migrate`. Each migration file is named `NNN_description.sql` where NNN is a zero-padded integer. The runner tracks applied migrations in the `pgmigrations` table (auto-created on first run).

**Doctrine **H-14** binds**: no DROP, no TRUNCATE in migrations. Backfills are separate scripts under `scripts/backfill/<YYYY-MM-DD>-<description>.sh`.

**For a Tier 2 self-hosted customer upgrading from v1.0 to v1.5**: the install.sh upgrade path runs `npm run migrate` automatically; the customer experiences this as a 30-second downtime window during a scheduled maintenance.

### 5.7 Edge fleet hardening (doctrine **H-18**)

Tier 2 customer's mini-PC running FactoryMind in their OT armadio:

- **OS**: Ubuntu Server 24.04 LTS, automatic security updates enabled (`unattended-upgrades` with reboot at 04:00 local time).
- **User**: dedicated `factorymind` user, no sudo, owns `/opt/factorymind/`, mode 0750.
- **Firewall**: `ufw` default-deny incoming, default-allow outgoing-restricted-to-broker. Allow rules: SSH from customer's admin VLAN only; outgoing TCP 8883 to the broker FQDN.
- **Docker**: latest stable, official APT repo, daily-pulled with `unattended-upgrades`.
- **OPC UA TrustList**: per the OPC UA Security guideline, the customer's PLC certificate is added to FactoryMind's trust list during onboarding (Settimana 1 sopralluogo); FactoryMind's client certificate is added to the PLC's trust list. Mutual trust list is the precondition for SignAndEncrypt.
- **Backups**: daily 02:30 local time `pg_dump | gzip > /backup/postgres-$(date +%Y%m%d).sql.gz` retention 30 days; weekly off-site rsync (customer-configured).

### 5.8 Rollback

If a deployment breaks in production:

1. **Backend rollback** (k8s): `kubectl rollout undo deployment factorymind-backend` — reverts to the previous ReplicaSet image. Time: < 1 min.
2. **DB rollback**: forward-only migrations make this hard; the safe path is to apply a *forward* fix-migration that reverts the schema change. NEVER manually edit `pgmigrations` to "undo" a migration — leaves the system in an inconsistent state. If a migration corrupts data, restore from PITR snapshot (Aurora has 5-minute granularity; the data loss window is bounded).
3. **Broker config rollback**: the previous `mosquitto.conf` is preserved at `/etc/mosquitto/mosquitto.conf.bak.<timestamp>` by the deploy script. `mv` and reload.

Postmortem within 5 working days (doctrine **H-17**).

---

## 6. API reference (prose companion to `docs/openapi.yaml`)

The machine-readable canonical spec is `docs/openapi.yaml`. This section is the human-readable companion. Doctrine **H-4** binds: every route appears in three places (here, openapi.yaml, code) and CI lints drift.

### 6.1 Common conventions

**Base URL**: `https://<host>/api` (production) or `http://localhost:3002/api` (development).

**Authentication**: Bearer JWT, obtained from `POST /api/users/login`. Algorithm pinned to HS256. Access token TTL 15 min; refresh token TTL 12 h absolute + 15 min sliding. Refresh via `POST /api/users/token/refresh`.

**Error envelope** (every 4xx and 5xx response):

```json
{
  "error": "human-readable message in the user's locale",
  "code": "stable_error_code",
  "status": 400,
  "path": "/api/devices",
  "timestamp": "2026-05-07T14:23:11.123Z",
  "trace_id": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
}
```

The `trace_id` is the W3C `traceparent` header value; reporting an issue with the trace_id allows correlation to the backend's OpenTelemetry trace.

**Rate limits**:

- Global `/api/*`: 60 req/min/IP.
- `POST /api/users/login`: 10 req/min/IP (defence-in-depth alongside lockout).
- `GET /api/users/me/gdpr-export`, `DELETE /api/users/me`: 10 req/h/user (GDPR-specific).
- `POST /api/contact`: 5 req/h/IP.

429 responses carry `Retry-After` header in seconds.

**Pagination**: `?limit=50&offset=0` style for v1.0. Keyset pagination is roadmap (UPLIFT u-api-keyset).

### 6.2 Authentication

| Endpoint | Method | Body / Query | RBAC | Response |
|---|---|---|---|---|
| `/api/users/login` | POST | `{email, password}` | public (lockout-gated) | `{token, refresh_token, user: {id, email, role, facility_scope[]}}` |
| `/api/users/token/refresh` | POST | `{refresh_token}` | public (token-gated) | `{token, refresh_token}` (rotates refresh) |
| `/api/users/me` | GET | — | self | decoded JWT claims |
| `/api/users/me` | DELETE | `{password}` | self (password-confirm) | 204 — soft-delete + 7-day audit quiescence + tombstone |
| `/api/users/me/gdpr-export` | GET | — | self | JSON dump of user's data (Art. 15 + 20) |
| `/api/users/me/password` | PUT | `{old_password, new_password}` | self | 204 |

### 6.3 Users (admin)

| Endpoint | Method | RBAC | Notes |
|---|---|---|---|
| `/api/users` | GET | admin | list users |
| `/api/users` | POST | admin | create user; password validated against policy + HIBP |
| `/api/users/:id` | GET | admin or self | |
| `/api/users/:id` | PUT | admin or self | |
| `/api/users/:id` | DELETE | admin (not self — use DELETE /me) | hard-delete |

### 6.4 Facilities, Lines, Devices

CRUD endpoints. Body schemas in `openapi.yaml`. Mutating routes are gated `requireRole('supervisor')`; read routes `requireRole('viewer')`.

### 6.5 Metrics, OEE, Alerts

Cfr. § 3.4.1 / 3.4.2 sequence diagrams. The metrics endpoint never executes user-supplied Flux — query is server-generated from validated parameters. The OEE endpoint computes per the formulas in § 3.6.

### 6.6 Attestazione

| Endpoint | Method | Body | RBAC | Response |
|---|---|---|---|---|
| `/api/attestazione` | POST | `{machine_id, year, plan: 'piano4'\|'piano5'}` | supervisor | PDF (Content-Type `application/pdf`) |
| `/api/attestazione/preview` | POST | same | supervisor | JSON preview of the rendered fields without binary |

The PDF rendering is a synchronous operation; expected latency 3–8 seconds for Piano 4.0, 8–15 seconds for Piano 5.0 (extra GreenMetrics round-trips). For Piano 5.0, 503 with explanatory message if GreenMetrics is unreachable (cfr. § 3.5 failure modes).

### 6.7 Contact form

`POST /api/contact` — public, rate-limited 5 req/h/IP, Joi-validated, honeypot field on the frontend. Triggers SMTP send to the configured contact address. **Gap (cfr. AUDIT F-HIGH-005)**: HTML escaping of email body to be implemented (REMEDIATION R-CONTACT-ESCAPE-001).

### 6.8 Health / Metrics

| Endpoint | Method | RBAC | Response |
|---|---|---|---|
| `/api/health` | GET | public | dependencies status + uptime |
| `/api/ready` | GET | public | readiness for k8s probe |
| `/metrics` | GET | public (network-restricted) | Prometheus exposition |
| `/api/docs` | GET | public | OpenAPI spec rendered (Swagger UI) |

### 6.9 WebSocket `/ws`

After upgrade, send `{type: "subscribe", topics: [...]}` to subscribe to MQTT topics. Server fans-out frames `{type: "mqtt", topic, parsed: {facility, line, machine, kind}, payload, ts}`. Heartbeat: 20 s ping; clients that don't pong terminated.

**Gap (cfr. AUDIT F-HIGH-010)**: handshake JWT validation TBD. REMEDIATION R-WS-AUTH-001.

---

## 7. Data governance & GDPR

### 7.1 Classification matrix (recap from legacy `DATA_GOVERNANCE.md`)

| Class | Description | Examples | GDPR category |
|---|---|---|---|
| C1 | Public | Landing page, OpenAPI spec, MIT-licensed source | n/a |
| C2 | Internal operational | Machine telemetry, status, alarms | Non-personal industrial data |
| C3 | Tenant confidential | Recipe, part program, schedule | Commercial secret |
| C4 | Personal (PII) | User accounts, audit log actors | Art. 4(1) personal data |
| C5 | Credentials / secrets | JWT secret, DB password, Influx token | Protected per Art. 32 |

### 7.2 PII inventory (the Art. 30 register, technical view)

PostgreSQL tables that hold C4 PII:

- `users.email`, `users.full_name` — identifiers, contractually-necessary.
- `users.password_salt`, `users.password_hash` — credentials (C5 — never returned by any API).
- `audit_log.actor_email`, `audit_log.ip_address` — actor identification, security-investigation legitimate interest.
- `refresh_tokens.user_id`, `refresh_tokens.ip_address`, `refresh_tokens.user_agent` — session tracking.

InfluxDB measurements: **none** are C4. Tags are industrial identifiers (facility, line, machine); fields are floats and integers. Doctrine **H-13** binds.

Mosquitto: payloads are ephemeral. Retained messages are alarms with QoS 1, max 24-hour broker-side retention.

### 7.3 Subject rights (Art. 15–22)

Request channel: `privacy@<tenant-domain>`. Response SLA: 30 days.

| Right | Article | Implementation today (v1.0) | Target (post-REMEDIATION R-GDPR-001) |
|---|---|---|---|
| Access | 15 | Manual: operator runs `psql` queries to extract user rows + audit history | `GET /api/users/me/gdpr-export` returns JSON dump |
| Rectification | 16 | `PUT /api/users/:id` (admin or self) | same |
| Erasure | 17 | Manual procedure (below) | `DELETE /api/users/me` triggers automated procedure |
| Portability | 20 | Same as Access (JSON / CSV) | same |
| Restriction | 18 | `UPDATE users SET active=false` | API-exposed |
| Objection | 21 | Free-form ticket → DPO | same |
| Automated decisions | 22 | N/A — FactoryMind makes no automated decisions on natural persons | unchanged |

**Manual erasure procedure (Art. 17 + tombstone)** — currently used at v1.0:

```sh
# 1. Verify the subject and capture their user_id for later steps:
psql -c "SELECT id, email, active, created_at FROM users WHERE email = '<subject>'"

# 2. Soft-delete (active=false): no new tokens issued, the user cannot log in:
psql -c "UPDATE users SET active=false, updated_at=NOW() WHERE email = '<subject>'"

# 3. Wait 7 days (audit quiescence): allows ongoing investigations to capture any
#    last-minute audit trail before the email is tombstoned.

# 4. Hard-delete the user row + tombstone the audit_log:
psql -c "DELETE FROM users WHERE email = '<subject>'"
psql -c "UPDATE audit_log
         SET actor_email = 'erased:' || encode(digest(actor_email, 'sha256'), 'hex')
         WHERE actor_email = '<subject>'"

# 5. Revoke any outstanding refresh tokens:
psql -c "DELETE FROM refresh_tokens WHERE user_id = '<id-from-step-1>'"

# 6. Log the erasure in the audit_log (the operator is now the actor):
psql -c "INSERT INTO audit_log (actor_email, action, resource_type, resource_id, payload)
         VALUES ('<operator>@<tenant>', 'gdpr.erasure', 'user', '<id>',
                 jsonb_build_object('subject_email_sha256',
                                    encode(digest('<subject>', 'sha256'), 'hex')))"
```

The 7-day quiescence is a deliberate balance between Art. 17 promptness and Art. 32 (security of processing — investigations sometimes need a few extra days). The quiescence is documented in `legal/INFORMATIVA-PRIVACY-GDPR.md` § 7 (the "30-day grace period" wording referenced there is the customer-facing label; technically 7 days is the pure-quiescence + 23 days of operational-margin).

### 7.4 Retention schedule

| Store | Dataset | Retention | Mechanism |
|---|---|---|---|
| Influx | telemetry (raw 1 s) | 30 days | Bucket retention policy |
| Influx | telemetry_1m | 365 days | Bucket retention |
| Influx | telemetry_1h | 1 095 days (3 y) | Bucket retention |
| Influx | telemetry_1d | indefinite (small) | Manual prune on request |
| PG | facilities, lines, devices | indefinite while active | Soft-delete |
| PG | shifts, downtimes | 7 years | Cron archival to S3 after 24 m, delete after 7 y (Codice Civile art. 2220) |
| PG | users | account lifetime + 24 m | Erasure procedure above |
| PG | audit_log | 13 m default; 7 y opt-in (fiscal trace) | Monthly partitions, drop old partitions (`pg_partman` — UPLIFT) |
| PG | refresh_tokens | token lifetime + 24 h | Cron reaper |
| Backups (S3) | Postgres dumps | 30 days | Lifecycle policy on bucket |
| Backups (S3) | Influx snapshots | 30 days | Lifecycle policy on bucket |
| Audit-log archives (S3 Glacier) | 7-year fiscal | 7 y, then deleted | Customer-opt-in |

The 13-month audit-log retention is the default per Provv. Garante 27 novembre 2008 sysadmin minimum (12 months); the +1 month is operational margin. Customers opting into 7-year retention (typical for those with strict tracciabilità requirements) sign an addendum to the DPA.

### 7.5 Encryption posture

| Layer | Mechanism | Status (v1.0) |
|---|---|---|
| In-transit (public) | TLS 1.3 via ingress (k8s) or CloudFront | Enforced via HSTS 1 y preload |
| In-transit (MQTT) | TLS 1.2+ on port 8883 in production | Production entrypoint refuses anonymous + plaintext |
| At-rest — PG | Disk-level KMS encryption (AWS RDS) | Enabled (AWS-managed key); customer-managed CMK is REMEDIATION R-RDS-KMS-001 |
| At-rest — Influx | Disk-level encryption (managed service) or filesystem-level LUKS | Default |
| At-rest — backups | S3 SSE-KMS | Default |
| Field-level — passwords | scrypt (16-byte salt, N=16384) | Production |
| Field-level — refresh tokens | SHA-256 of opaque token; raw never persisted | Production |
| Column-level — users.email | None at v1.0 | Optional via pgcrypto (UPLIFT u-pii-column-encrypt) |

### 7.6 Breach notification (Art. 33 / 34)

DPA § 7 (`legal/DATA-PROCESSING-AGREEMENT.md`) requires the Responsabile (Renan) to notify the Titolare (Customer) within **24 hours** of becoming aware of a breach (tighter than GDPR's 72 h to Garante; gives the Titolare investigative margin).

Notification content (per Art. 33 par. 3):

1. Nature of the breach.
2. Categories and approximate count of data subjects affected.
3. Categories and approximate count of records affected.
4. Contact point (DPO or other).
5. Probable consequences.
6. Measures taken or proposed to address and mitigate.

If the breach is likely to result in a high risk to data subjects, the Titolare communicates to data subjects without undue delay (Art. 34).

The breach-response runbook (REMEDIATION R-RUNBOOK-BREACH-001 ships separately) details: alert detection (typically `FactoryMindLoginAnomalies` + `FactoryMindHighErrorRate`), containment (credential rotation via `terraform apply -target module.secrets...`), assessment (DPO convenes within 24 h), notification (Garante within 72 h if threshold met).

---

## 8. SRE — SLOs, runbooks, on-call

### 8.1 SLI / SLO recap

(Detailed from legacy `SLO.md`.)

| # | SLI | SLO target (GA v1.0) | Window |
|---|---|---|---|
| SLO-1 | HTTP availability | ≥ 99.9 % | 30-day rolling |
| SLO-2 | HTTP latency P95 | < 200 ms | 7-day rolling |
| SLO-3 | HTTP latency P99 | < 500 ms | 7-day rolling |
| SLO-4 | MQTT end-to-end latency P95 | < 1 s | 1-h rolling |
| SLO-5 | Alert correctness (precision) | ≥ 99 % | 24-h rolling |
| SLO-6 | WebSocket freshness | < 2 s staleness | 5-min rolling |
| SLO-7 | Data durability | ≥ 99.99 % | 30-day rolling |
| SLO-8 | RTO | ≤ 1 h | per incident |
| SLO-9 | RPO | ≤ 5 min | per incident |

Error-budget policy: Green (< 25 % spent) → ship freely; Yellow (25–75 %) → require post-deploy smoke + canary on hot paths; Red (75–100 %) → freeze features; Blown (> 100 %) → executive review. Tracked via Prometheus recording rule on the Errors dashboard.

### 8.2 Alert → runbook map

| Alert | Severity | Route | Runbook anchor |
|---|---|---|---|
| `FactoryMindAPIDown` | critical | pager | § 8.3 |
| `FactoryMindHighErrorRate` | critical | pager | § 8.4 |
| `FactoryMindLatencyBurn` | warning | pager | § 8.5 |
| `FactoryMindMQTTDisconnected` | critical | pager | § 8.6 |
| `FactoryMindInfluxWriteFailures` | warning | pager | § 8.7 |
| `FactoryMindHeapPressure` | warning | ticket | § 8.8 |
| `FactoryMindReadinessFlap` | warning | ticket | § 8.9 |
| `FactoryMindLoginAnomalies` | warning | ticket | § 8.10 |

Each runbook below follows the canonical structure: **Symptom → Diagnosis → Mitigation → Escalation → Postmortem template**.

<a id="h-runbook-factorymindapidown"></a>

### 8.3 Runbook — `FactoryMindAPIDown`

**Symptom.** `up{job="factorymind-backend"} == 0` for 2 minutes. The backend's `/metrics` endpoint is unreachable from Prometheus. Pages on-call.

**Diagnosis.**

1. `kubectl get pods -n factorymind` — are the pods running?
2. If running: `kubectl logs -n factorymind deploy/factorymind-backend --tail=200` — last log lines, look for crash patterns.
3. If pods are crash-looping: check `kubectl describe pod` for the failure reason (OOM? config error? image pull?).
4. If pods look healthy but `/metrics` is unreachable: check ingress / service routing.

**Mitigation.**

- OOM: `kubectl rollout restart deployment factorymind-backend`; if recurring, increase `limits.memory` (HPA + ticket for diagnosis).
- Config error: revert the last config-related deploy; verify with the deployment-log runbook.
- Image pull error: check GHCR connectivity; check image tag exists; check imagePullSecrets if using private registry.
- Network: check ingress controller, service IP, NetworkPolicy.

**Escalation.** If unresolved within 30 min of paging: escalate to Renan (founder/CTO). If customer-impacting (Tier 4 SaaS) and unresolved at 60 min: customer notice via the SLA channel.

**Postmortem.** Within 5 working days. Template at § 8.PM.

<a id="h-runbook-factorymindhigherrorrate"></a>

### 8.4 Runbook — `FactoryMindHighErrorRate`

**Symptom.** 5xx rate > 1 % over 10 minutes. SLO-1 budget burning.

**Diagnosis.**

1. Grafana "Errors" dashboard → which routes are returning 5xx?
2. Pino logs filtered by `level=error AND service=factorymind-backend`.
3. Recent deploy correlation: any deploy in the last 30 min?
4. Dependency check: PG / Influx / MQTT — are they healthy? `/api/health` envelope.

**Mitigation.**

- Recent-deploy regression: `kubectl rollout undo deployment factorymind-backend`. Verify error rate drops within 5 min.
- DB issue: check Aurora dashboard; failover if primary instance is degraded.
- Influx issue: check Influx server load; influx writer buffer should absorb transients.

**Escalation.** Same as 8.3.

**Postmortem.** Required if budget burn > 5 %.

<a id="h-runbook-factorymindlatencyburn"></a>

### 8.5 Runbook — `FactoryMindLatencyBurn`

**Symptom.** P95 latency > 500 ms over 15 minutes. SLO-2 budget burning.

**Diagnosis.**

1. Grafana "API performance" dashboard → which routes?
2. PG slow-query log (`auto_explain` enabled).
3. Influx query duration (Grafana panel `factorymind_influx_query_duration_seconds`).
4. Heap pressure correlation (Node.js GC pauses).

**Mitigation.**

- Slow PG query: add index, or rewrite query; emergency `EXPLAIN ANALYZE` and apply hint.
- Influx slow: cardinality issue (REMEDIATION R-INFLUX-CARDINALITY-AUDIT-001 covers continuous monitoring).
- Heap GC: scale horizontally (HPA), or restart pods.

**Escalation.** Ticket; pager only if SLO budget Red.

<a id="h-runbook-factorymindmqttdisconnected"></a>

### 8.6 Runbook — `FactoryMindMQTTDisconnected`

**Symptom.** Backend `factorymind_mqtt_connected == 0` for 1 minute. Pages immediately because telemetry ingestion is paused.

**Diagnosis.**

1. Broker reachability: `mosquitto_sub -h <broker> -p 8883 -u <user> -P <pass> -t '$SYS/#' -W 5` — does the broker answer?
2. Backend logs: `level=warn AND component=mqtt-handler` — last connect attempt, last error.
3. Edge gateways: are they buffering (90-s store-and-forward)? Local Mosquitto status on each.
4. Network: any firewall change? DNS resolution OK?

**Mitigation.**

- Broker down: `kubectl rollout restart statefulset mosquitto` (or restart container at the customer). Backend reconnects automatically with exponential backoff.
- Auth failure (e.g., after credential rotation that the backend hasn't picked up): restart backend pods so they read updated Secrets Manager.
- Network: coordinate with customer's IT.

**Escalation.** If telemetry remains paused > 10 min: customer notice. Edge buffer covers ≈ 90 s; beyond that data loss is likely (telemetry is QoS 0, alarms are QoS 1 — the latter recover, the former are gone).

<a id="h-runbook-factorymindinfluxwritefailures"></a>

### 8.7 Runbook — `FactoryMindInfluxWriteFailures`

**Symptom.** Write-failure ratio > 0.1 % over 10 minutes. SLO-7 budget burning.

**Diagnosis.**

1. Influx server health.
2. Buffer status: `factorymind_influx_buffer_size` — is the buffer full?
3. Cardinality: `influx query 'cardinality(...)'` — has cardinality grown unexpectedly?

**Mitigation.**

- Influx server: check disk, restart if needed.
- Cardinality blow-up: identify the misbehaving topic (typically a misconfigured device dumping high-entropy tag values); pause its ingestion via ACL.

<a id="h-runbook-factorymindheappressure"></a>

### 8.8 Runbook — `FactoryMindHeapPressure`

**Symptom.** Heap usage > 80 % of `--max-old-space-size` for 10 min.

**Diagnosis.** Node.js heap profile via `--inspect` + Chrome DevTools snapshot. Look for retained closures (typical: pino transport queue, MQTT subscription leak, undisposed PG connections).

**Mitigation.** Pod restart relieves. Persistent root cause requires code fix.

<a id="h-runbook-factorymindreadinessflap"></a>

### 8.9 Runbook — `FactoryMindReadinessFlap`

**Symptom.** `/api/ready` flaps between 200 and 5xx > 6 times in 15 min.

**Diagnosis.** A dependency is intermittently failing. Check `/api/health` envelope continuously to identify which dependency.

**Mitigation.** Address the flapping dependency; readiness-probe timeout tuning if appropriate.

<a id="h-runbook-factorymindloginanomalies"></a>

### 8.10 Runbook — `FactoryMindLoginAnomalies`

**Symptom.** > 10 failed logins per second.

**Diagnosis.** Lockout table: which accounts? Source IPs? Single-source (credential stuffing) or distributed (brute force)?

**Mitigation.** If single-source: WAF block the IP. If distributed: temporarily increase lockout threshold + monitor; consider customer notice (could be a coordinated attack).

This is a security event: file a security incident even if fully mitigated, for trend analysis.

### 8.11 Runbook — Disaster Recovery (region failover)

**Closes** R-RUNBOOK-DR-001 (REMEDIATION § 6); pairs with R-DR-DRILL-001 (quarterly drill cadence in § 8 of REMEDIATION).

**Scope.** Loss of the primary AWS region (eu-south-1, Milan) due to extended outage, regional control-plane failure, or accidental destructive change. Failover target is eu-central-1 (Frankfurt) — the second region in the same EU data-residency boundary that the GDPR / NIS2 commitment depends on.

**Pre-conditions.** Before this runbook can execute end-to-end:

- RDS Aurora cross-region read-replica in eu-central-1 (`terraform/modules/db/rds.tf`; the secondary cluster's `source_region` is the primary).
- InfluxDB Cloud sub-region replication enabled (vendor feature; verified in TIA — `legal/TIA-INFLUXDATA.md` § 3.2).
- Latest object backup of `s3://factorymind-state-prod` replicated to eu-central-1 via cross-region replication rule (Terraform `aws_s3_bucket_replication_configuration`).
- Route 53 hosted zone with health-checked failover record for `api.factorymind.it` pointing at the regional ALB.
- Operator has `AdministratorAccess` on the AWS account and `roles/dba` on RDS.
- `kubectl` context for the `factorymind-failover` cluster in eu-central-1 (provisioned via Terraform `eks-failover` workspace).

If any pre-condition is missing this runbook is **not executable** — fix the gap before the next drill rather than during a real incident.

**Decision tree (5 minutes max).**

1. **Is the primary cluster reachable at all?** `kubectl get nodes` against the eu-south-1 context. If it returns nodes (even if they are NotReady) the issue is likely intra-cluster, not regional — engage the appropriate § 8.3-8.10 runbook instead.
2. **Is the AWS regional control plane reporting issues?** Check `https://health.aws.amazon.com/health/status` for eu-south-1. If the region itself is degraded, the failover decision is forced.
3. **Is the data-loss window acceptable?** Aurora replication lag is typically < 5 s; in catastrophic primary failure the replica may be up to 60 s behind. Document the observed lag at the moment of failover (`SELECT * FROM aurora_global_db_status();` on the replica, or CloudWatch metric `AuroraGlobalDBReplicationLag`). Customer Success communicates the data-loss window to affected customers in the breach-notice template (§ 7).

**Failover procedure.**

1. **Promote the Aurora replica.**

   ```bash
   aws rds failover-global-cluster \
     --global-cluster-identifier factorymind-prod-global \
     --target-db-cluster-identifier arn:aws:rds:eu-central-1:<account>:cluster:factorymind-prod-eu-central-1 \
     --region eu-central-1
   ```

   The promotion is asynchronous; expect 1-3 minutes for the cluster to accept writes. Monitor with:

   ```bash
   aws rds describe-global-clusters \
     --global-cluster-identifier factorymind-prod-global \
     --query 'GlobalClusters[0].GlobalClusterMembers[*].{Cluster:DBClusterArn,IsWriter:IsWriter}'
   ```

2. **Switch InfluxDB Cloud writes to the eu-central-1 endpoint.**

   The failover endpoint is in the runtime config under `INFLUX_URL_FAILOVER`. Apply via Helm value override:

   ```bash
   helm upgrade factorymind-backend ./charts/factorymind-backend \
     --namespace factorymind \
     --kube-context factorymind-failover \
     --set env.INFLUX_URL=$INFLUX_URL_FAILOVER \
     --set env.INFLUX_TOKEN=$INFLUX_TOKEN_FAILOVER \
     --reuse-values
   ```

3. **Update the Route 53 failover record.**

   The `api.factorymind.it` record is configured with health-checked failover; in the normal case it flips automatically when the primary ALB health-check fails for ≥ 3 consecutive samples (90 s window). Manual cutover, if needed:

   ```bash
   aws route53 change-resource-record-sets \
     --hosted-zone-id <ZONE_ID> \
     --change-batch file://dr/route53-failover-cutover.json
   ```

   The change-batch JSON is checked in at `infrastructure/dr/route53-failover-cutover.json` (target state — file currently exists as a template; populate with real ARNs during the first drill).

4. **Restore from backup if the replica diverged.**

   If `aurora_global_db_status()` shows replication broken for > 60 s prior to incident, the replica may have lost late writes. Restore from PITR snapshot:

   ```bash
   aws rds restore-db-cluster-to-point-in-time \
     --source-db-cluster-identifier factorymind-prod-eu-south-1 \
     --db-cluster-identifier factorymind-prod-eu-central-1-restored \
     --restore-to-time <ISO-8601> \
     --use-latest-restorable-time \
     --region eu-central-1
   ```

   For InfluxDB Cloud, contact InfluxData support via the dedicated breach line (number in `legal/TIA-INFLUXDATA.md` § 5.4) — the cross-region replica is async and may be up to 1 hour behind in worst case; a coordinated restore from their side may be required.

**Verification checklist.**

- [ ] `https://api.factorymind.it/api/health` returns 200 with all `dependencies.{postgres,influxdb,influxdb_tasks,mosquitto}.ok = true` (R-INFLUX-TASK-001 closure).
- [ ] `https://api.factorymind.it/api/ready` returns 200 (all dependencies primed at least once).
- [ ] `SELECT count(*) FROM attestazioni WHERE emessa_il > NOW() - INTERVAL '24 hours'` matches the pre-failover count within the documented data-loss window (Aurora replication lag).
- [ ] Synthetic OEE for the canonical test fixture machine matches pre-failover value within 0.1 % (R-DR-DRILL-001 exit criterion).
- [ ] `cosign verify --certificate-identity-regexp '.*github.com/factorymind.*' --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' ghcr.io/factorymind/factorymind-backend@sha256:<digest>` succeeds against the digest deployed in eu-central-1 (image-signing chain integrity).
- [ ] Active customer logins continue to work (cookie session domain matches `factorymind.it`, not region-specific subdomain).
- [ ] Grafana dashboards re-pair against the failover Influx endpoint (one click in the data-source settings if not pre-provisioned).
- [ ] Customer Success has sent the GDPR Art. 33 / NIS2 § 7 incident notice if the data-loss window exceeds the contractual SLA (see § 7).

**Rollback (if failover proves unnecessary).**

If the primary region recovers and the failover was precautionary, the rollback path is the inverse of the failover but requires:

- Quiescing writes on the eu-central-1 cluster (read-only mode).
- Replicating any new rows back to eu-south-1 via `pg_dump` + `pg_restore` of the affected tables.
- Flipping Route 53 back to primary.
- A second incident notice to customers if data was written during the failover that needs to migrate back.

This is materially harder than the failover itself; the default disposition is to **stay in the failover region** until the next planned maintenance window allows a coordinated migration back. Doctrine: failover is a one-way door under load; the rollback decision should be deliberate, not reflexive.

**Doctrine references.** R-7 (wave drift sign-off — a DR event triggers a post-incident wave assessment), H-22 (quarterly review — DR runbook freshness), A-12 (doctrine review cadence applies to this runbook).

### 8.12 Observability — OTel sampling per tier

**Closes** R-OTEL-SAMPLING-DOC-001 (REMEDIATION § 7).

The backend exports OpenTelemetry traces via `OTEL_EXPORTER_OTLP_ENDPOINT` (set in compose / k8s configmap). Trace volume scales linearly with request volume; without sampling, Tier 4 SaaS deployments exceed the budget of any reasonable OTel collector well before they exceed FactoryMind's own ingestion budget.

The recommended `OTEL_TRACES_SAMPLER_ARG` per deployment tier:

| Tier | Customer profile | Estimated req/s | Recommended sampler arg | Effective trace rate |
|---|---|---|---|---|
| 1 | Self-hosted, single facility | < 50 | `1.0` (sample all) | 100 % |
| 2 | Single-tenant SaaS, ≤ 200 machines | 50 – 500 | `0.5` | 50 % |
| 3 | Single-tenant SaaS, ≤ 1000 machines | 500 – 2 000 | `0.2` | 20 % |
| 4 | Multi-tenant SaaS, > 1 000 machines | > 2 000 | `0.05` | 5 % |

The sampler is `parentbased_traceidratio` (Vite + backend share the same trace ID once frontend OTel ships); the ratio applies only when no parent context is present. Error-class spans are always sampled (head-based sampling decision is overridden by `RecordException`).

To override the default for an incident or capacity test:

```bash
# In compose
OTEL_TRACES_SAMPLER_ARG=1.0 docker compose up factorymind-backend
```

```yaml
# In k8s/configmap.yaml (live edit + rolling restart)
data:
  OTEL_TRACES_SAMPLER_ARG: "1.0"
```

The configmap value is consumed by `backend/src/otel.js` (initialised before any other module to ensure auto-instrumentation hooks attach correctly).

**Doctrine reference.** A-12 (cadence review): the per-tier table is reviewed quarterly when actual req/s histograms diverge from the estimates above.

### 8.PM — Postmortem template

```markdown
# Postmortem — <incident-tag> (<YYYY-MM-DD>)

## Severity & duration
- Severity: P1 / P2 / P3
- Detection: <when>
- Mitigation: <when>
- Resolution: <when>
- Total customer impact: <minutes>

## Customer impact
<one paragraph on what customers experienced>

## Timeline (UTC)
- <HH:MM> — <event>
- ...

## Root cause
<one paragraph; blameless; no individuals named as causes>

## What went well
<bullet list>

## What went poorly
<bullet list>

## Action items
- [ ] <action> — owner — by <date> — REMEDIATION ticket R-XXX
- ...

## Lessons learned
<one paragraph>

---

Sign-off: <author> — <date>
Reviewed by: <reviewer> — <date>
```

---

## 9. Compliance baseline

### 9.1 Piano Transizione 4.0 / 5.0 — the load-bearing claim

(Distilled from legacy `ITALIAN-COMPLIANCE.md`. Doctrine **H-16** binds: the perizia tecnica giurata asseverata stays with the customer's perito; FactoryMind ships the technical attestazione that supports the perizia.)

**Piano 4.0** — Legge 11 dicembre 2016, n. 232, comma 9-13, e successive modifiche; Circolare AdE 4/E del 30 marzo 2017; Circolare MISE/AdE 9/E del 23 luglio 2018. The five obligatory caratteristiche tecnologiche + two of three caratteristiche di interconnessione are documented machine-by-machine in the attestazione PDF generated by `backend/src/services/piano4-attestazione.js`.

**Piano 5.0** — DL 19/2024 conv. L. 56/2024; DM interministeriale MIMIT-MASE 24 luglio 2024; Circolare MIMIT 16 agosto 2024. The energy-savings calculation (≥ 3 % process / ≥ 5 % site) requires GreenMetrics integration (cfr. § 10).

### 9.2 GDPR + Italian Codice Privacy

Cfr. § 7. Key articles: Art. 5 (data minimisation), Art. 25 (privacy by design), Art. 30 (RoPA), Art. 32 (security), Art. 33 (breach notification 72 h), Art. 35 (DPIA — required for IoT deployments where worker monitoring is in scope). Italian: D.Lgs. 196/2003 amended by D.Lgs. 101/2018 (Codice Privacy). Workers' remote control: art. 4 L. 300/1970 modificato dal D.Lgs. 151/2015 — collective agreement with RSA/RSU OR ITL authorisation required.

### 9.3 IEC 62443 SL-2 self-assessment (engineering view)

Detailed scorecard in [`AUDIT.md`](AUDIT.md) § 10. Summary at this level:

| FR | Foundational Requirement | Current SL | Notes |
|---|---|---|---|
| FR1 | Identification & Authentication Control | 2 | JWT HS256 pinned, scrypt, lockout, HIBP, account-level lockout |
| FR2 | Use Control | 2 | RBAC 4 roles + facility scope; ACL pattern-based at broker |
| FR3 | System Integrity | 1.5 | Audit log + checksum on attestazioni; HMAC on OPC UA commands roadmap |
| FR4 | Data Confidentiality | 2 | TLS 1.3 in-transit; KMS at-rest |
| FR5 | Restricted Data Flow | 1.5 | NetworkPolicy default-deny; fine-grained allows TBD (REMEDIATION R-K8S-NETPOL-001) |
| FR6 | Timely Response to Events | 2 | Alertmanager + runbooks (this document § 8); on-call SLA |
| FR7 | Resource Availability | 2 | Health/ready probes; backups; PDB; HPA |

### 9.4 NIS2 (Italian transposition D.Lgs. 138/2024)

D.Lgs. 4 settembre 2024, n. 138 (GU 230 del 1 ottobre 2024) transposes Direttiva UE 2022/2555. Manufacturing SMEs may fall in scope ("medie imprese" per ISTAT). FactoryMind itself, as software supplier, is not a covered entity at v1.0 deployment scale; if Tier 4 SaaS reaches material scale, scope determination is required (REMEDIATION R-NIS2-SCOPE-001, with legal counsel).

ACN registration window: annually 1 gennaio – 28 febbraio. Incident reporting: 24 h early warning, 72 h notification, 1 month report.

### 9.5 Cyber Resilience Act (Reg. UE 2024/2847)

Effective 10 December 2024. Full applicability 11 December 2027. Vulnerability handling reporting from 11 September 2026.

**Two surfaces** (doctrine **H-11**):

- **Self-hosted MIT distribution** — likely covered by Art. 24 (OSS Stewardship exemption). Verify with counsel.
- **Commercial Tier 2/3/4** — "products with digital elements" placed on EU market. Full CRA applicability from Dec 2027. Self-conformity assessment for default class (REMEDIATION R-CRA-001).

### 9.6 Stanca law (WCAG 2.1 AA, target 2.2 AA)

Legge 4/2004 + D.Lgs. 106/2018 ("Stanca law"). FactoryMind WCAG 2.1 AA at v1.0 (legacy `A11Y.md` documents the testing protocol). 2.2 AA is UPLIFT u-a11y-22.

---

## 10. Cross-product integration map

FactoryMind integrates with sister projects in the Macena product constellation. Doctrine **H-10** binds: changes to integration boundaries are documented before code.

| Sister | Relationship | Boundary | Contract version |
|---|---|---|---|
| `macena-greenmetrics` | Piano 5.0 energy savings | DNS-SD `_greenmetrics._tcp.local` + HTTP `/api/v1/energy/{baseline,monitored}` | `cross-product/greenmetrics-energy-v1` |
| `macena-smart-erp` | ERP integration (Tier 3 customers) | REST API: production orders → FactoryMind, OEE summaries → SmartERP | `cross-product/smarterp-mes-v1` (TBD) |
| `macena-logi-track` | Logistics + RENTRI rifiuti | Topic share: `factory/.../shipped` events → LogiTrack ingest | `cross-product/logitrack-shipped-v1` (TBD) |
| `macena-tracevino` | Wineries (Tier A ICP) | Independent stack; bundled commercial proposition; no live integration | n/a |
| `macena-agrivigna` | Vineyards (Tier A) | Independent stack; bundled proposition | n/a |
| `macena-fatturaflow` | E-invoicing | FactoryMind invoice events → FatturaFlow → SDI | `cross-product/fatturaflow-invoice-v1` (TBD) |
| `macena-cyberguard` | Defensive cybersecurity | Monitoring co-located in customer infra | n/a |
| `macena-teamflow` | HR (CCNL, INPS, F24) | Operator identity sync (with consent) | TBD |

The GreenMetrics integration is the only live integration at v1.0; it is the most documented and the most tested. The others are roadmap.

---

## 11. Glossary (IT + EN)

- **OEE** — *Overall Equipment Effectiveness*. Availability × Performance × Quality. SEMI E10 / VDI 2884 / ISO 22400-2.
- **Availability** — *Disponibilità*. Operating Time / Planned Production Time.
- **Performance** — *Prestazione*. (Ideal Cycle Time × Total Count) / Operating Time, clamped ≤ 1.0.
- **Quality** — *Qualità*. Good Count / Total Count.
- **Ideal Cycle Time** — *Tempo di ciclo ideale*. Empirical best-demonstrated sustainable cycle time, P10 sustained ≥ 1 hour. Never nameplate.
- **Cycle Time** — *Tempo di ciclo*. Time per produced unit.
- **Sparkplug B** — Eclipse standard MQTT payload format with semantic birth/death messages.
- **OPC UA** — *Open Platform Communications — Unified Architecture*. IEC 62541. Industrial messaging standard.
- **Modbus** — *Modicon Communication Bus*. IEC 61158-3/4-5. Legacy industrial protocol.
- **Piano 4.0** — *Piano Nazionale Transizione 4.0*. Italian fiscal-credit programme for digitally-interconnected industrial investments.
- **Piano 5.0** — *Piano Nazionale Transizione 5.0*. DL 19/2024. Adds energy-savings credits.
- **Caratteristiche tecnologiche** — Technical characteristics required by Circolare 9/E/2018 for Piano 4.0 eligibility.
- **Perizia tecnica giurata asseverata** — Sworn technical expert certification by a perito iscritto all'albo.
- **Commercialista** — Italian chartered accountant; channel partner role per `moneyplan.txt` Tier C.
- **PMI** — *Piccola e Media Impresa*. Italian SME (≤ 250 employees).
- **Garante** — *Garante per la Protezione dei Dati Personali*. Italian Data Protection Authority.
- **DPO** — Data Protection Officer.
- **DPA** — Data Processing Agreement (Art. 28 GDPR contract).
- **RoPA** — Records of Processing Activities (Art. 30 GDPR).
- **DPIA** — Data Protection Impact Assessment (Art. 35 GDPR).
- **Schrems II** — Court of Justice of the EU ruling C-311/18 affecting extra-EU data transfers.
- **NIS2** — Direttiva UE 2022/2555. Network and Information Security Directive 2.
- **CRA** — Cyber Resilience Act (Reg. UE 2024/2847).
- **AgID** — Agenzia per l'Italia Digitale. Italian digital agency.
- **ACN** — Agenzia per la Cybersicurezza Nazionale. Italian national cybersecurity agency.
- **MIMIT** — Ministero delle Imprese e del Made in Italy.
- **MASE** — Ministero dell'Ambiente e della Sicurezza Energetica.
- **GSE** — Gestore dei Servizi Energetici. Italian energy services manager.
- **Foro di Verona** — Verona court (exclusive jurisdiction per `legal/CONTRATTO-SAAS-B2B.md` art. 12).
- **SDI** — *Sistema di Interscambio*. Italian e-invoicing exchange platform.
- **FatturaPA** — Italian electronic invoice format.

---

## 12. Bus factor & onboarding checklist

### 12.1 Bus factor map (v1.0 baseline)

At v1.0, Renan is the sole maintainer. Doctrine **H-5** requires bus factor ≥ 2 within 30 days of the second engineer's first commit.

### 12.2 Onboarding checklist for the first new engineer

**Week 1 (reading + bootstrap):**

- [ ] Read `HANDOFF.md` § 0–4 (cold-reader path).
- [ ] Run `./install.sh` on a clean Ubuntu / macOS box. Reach the dashboard.
- [ ] Read `AUDIT.md` § 4 (security findings) — understand the open risks.
- [ ] Pair-debug an alert with on-call shadowing.
- [ ] First non-trivial commit: pick a Low-severity REMEDIATION ticket and ship it.

**Week 2 (deeper dive):**

- [ ] Read `HANDOFF.md` § 5–9.
- [ ] Read `REMEDIATION.md` end-to-end. Pick a Medium ticket; pair with Renan on it.
- [ ] Read `legal/` end-to-end (in Italian — bilingual reading is part of the role).
- [ ] First customer-facing piece: shadow a customer support call.

**End of Week 2 sign-off:**

- The engineer can answer: where is the OEE math? what does install.sh do in unattended mode? what is the broker hardening posture in production? what is the GDPR breach-notification path?
- If yes — pass; the engineer is added as a second owner to ≥ 3 modules in § 4.
- If not — extend to Week 3 with focused study; revisit sign-off.

---

## Appendix A — Decree & standard map

Single source of truth for all citations. Every cross-document reference resolves here.

### A.1 Italian decrees and circulars

- **Legge 11 dicembre 2016, n. 232** — "Bilancio di previsione dello Stato per l'anno finanziario 2017". Istituzione iperammortamento. https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2016-12-11;232
- **Circolare AdE 4/E del 30 marzo 2017** — Chiarimenti applicativi iperammortamento.
- **Circolare MISE/AdE 9/E del 23 luglio 2018** — Chiarimenti definitivi 5+2 caratteristiche tecnologiche.
- **DL 2 marzo 2024, n. 19** conv. **L. 29 aprile 2024, n. 56** — Piano Transizione 5.0.
- **DM interministeriale MIMIT-MASE 24 luglio 2024** — Modalità operative Piano 5.0.
- **Circolare MIMIT 16 agosto 2024** — Chiarimenti calcolo risparmio energetico Piano 5.0.
- **D.Lgs. 30 giugno 2003, n. 196** modificato dal **D.Lgs. 10 agosto 2018, n. 101** — Codice Privacy. https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2003-06-30;196
- **D.Lgs. 4 settembre 2024, n. 138** — Recepimento Direttiva UE 2022/2555 (NIS2). GU 230 del 1 ottobre 2024.
- **L. 20 maggio 1970, n. 300** ("Statuto dei lavoratori"), art. 4, modificato dal **D.Lgs. 14 settembre 2015, n. 151** — Controllo a distanza dei lavoratori.
- **Provv. Garante Privacy 27 novembre 2008** — Misure e accorgimenti agli amministratori di sistema.
- **Provv. Garante Privacy 1 marzo 2007** — Linee guida trattamento dati personali dei lavoratori.
- **Provv. Garante Privacy 10 giugno 2021** — Linee guida cookie.
- **D.Lgs. 7 marzo 2005, n. 82** ("CAD" — Codice dell'Amministrazione Digitale), per riferimenti accessibilità.
- **L. 9 gennaio 2004, n. 4** ("Stanca law") + **D.Lgs. 10 agosto 2018, n. 106** — Accessibilità WCAG.
- **D.Lgs. 9 aprile 2008, n. 81** — Testo Unico Sicurezza sul Lavoro.
- **D.Lgs. 152/2006** — Testo Unico Ambientale (parte IV — gestione rifiuti, RENTRI, FIR; rilevante per integrazione cross-product `macena-logi-track` con il modulo scrap del MES). https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2006-04-03;152
- **DPR 29 settembre 1973, n. 600** — Accertamento fiscale.
- **D.Lgs. 5 agosto 2015, n. 127** — FatturaPA + SDI.
- **D.Lgs. 9 ottobre 2002, n. 231** — Interessi di mora.
- **D.Lgs. 4 marzo 2010, n. 28** — Mediazione.
- **D.Lgs. 9 aprile 2003, n. 70** — Commercio elettronico.
- **L. 22 aprile 1941, n. 633** — Diritto d'autore (art. 64-quater decompilazione software).
- **Codice Civile** — art. 1229 (limite responsabilità), 1337-1338 (responsabilità precontrattuale), 1341-1342 (clausole vessatorie), 1455 (importanza inadempimento), 2220 (conservazione 10 anni scritture).
- **Codice Penale** — art. 615-ter (accesso abusivo), 635-bis (danneggiamento), 640-ter (frode informatica).

### A.2 EU regulations

- **Reg. UE 2016/679** (GDPR). https://eur-lex.europa.eu/eli/reg/2016/679/oj
- **Direttiva UE 2002/58/CE** (ePrivacy). https://eur-lex.europa.eu/eli/dir/2002/58/oj
- **Direttiva UE 2022/2555** (NIS2). https://eur-lex.europa.eu/eli/dir/2022/2555/oj
- **Reg. UE 2024/2847** (Cyber Resilience Act). https://eur-lex.europa.eu/eli/reg/2024/2847/oj
- **Direttiva UE 2016/2102** (web accessibility, transposed by D.Lgs. 106/2018).
- **Decisione UE 2021/914** (Standard Contractual Clauses for international transfers).

### A.3 ISO / IEC standards

- **ISO 22400-1:2014** + **ISO 22400-2:2014** — KPIs for Manufacturing Operations Management. https://www.iso.org/standard/54497.html
- **ISO 9001:2015** — Quality management systems. **ISO 14001:2015** — Environmental management. **ISO 50001:2018** — Energy management. **ISO 27001** — Information security management.
- **IEC 62443 series** — Industrial cybersecurity. https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards
- **IEC 62541 series** — OPC UA. Especially Parts 3, 4, 5, 6, 7, 8.
- **IEC 61158-3/4-5** — Modbus.
- **SEMI E10** — Equipment Reliability, Availability, Maintainability. **SEMI E79** — OEE methodology. https://www.semi.org/en/products-services/standards/step/equipment-performance-metrics
- **VDI 2884** — Purchase, operation and maintenance of production equipment using LCC.

### A.4 OWASP / NIST / MITRE

- **OWASP API Security Top 10 (2023)**. https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- **OWASP IoT Top 10**. https://owasp.org/www-project-internet-of-things/
- **OWASP Cheat Sheets**. https://cheatsheetseries.owasp.org/
- **NIST CSF 2.0**. https://www.nist.gov/cyberframework
- **NIST SP 800-82 Rev. 3** — Guide to Operational Technology (OT) Security. https://csrc.nist.gov/pubs/sp/800/82/r3/final
- **NIST SP 800-115** — Technical Guide to Information Security Testing and Assessment.
- **MITRE ATT&CK for ICS**. https://attack.mitre.org/matrices/ics/

### A.5 CVEs (live register — cfr. AUDIT § 9)

- **CVE-2024-10525** — Mosquitto SUBACK out-of-bounds. https://github.com/advisories/GHSA-cm54-mprw-5279
- **CVE-2023-28366** — Mosquitto memory leak.
- **CVE-2024-3935** — Mosquitto TLS hostname validation gap (referenced AUDIT § 9 CVE register; verify in production deployment using TLS listener). https://nvd.nist.gov/vuln/detail/CVE-2024-3935
- **CVE-2024-30896** — InfluxDB operator-token disclosure (CVSS 9.1, fixed 2.7.11+). https://www.wiz.io/vulnerability-database/cve/cve-2024-30896
- **CVE-2025-4123** — Grafana path-traversal → SSRF.
- **CVE-2024-42512 / CVE-2024-42513 / CVE-2025-1468** — OPC UA stack vulnerabilities. https://files.opcfoundation.org/SecurityBulletins/

### A.6 Engineering doctrine sources

- **Diátaxis**. https://diataxis.fr/
- **Twelve-Factor App**. https://12factor.net/
- **Boy Scout Rule**. https://deviq.com/principles/boy-scout-rule/
- **Hyrum's Law**. https://www.hyrumslaw.com/
- **Postel's Law**. https://en.wikipedia.org/wiki/Robustness_principle
- **Preparatory Refactoring (Beck via Fowler)**. https://martinfowler.com/articles/preparatory-refactoring-example.html
- **Google SRE Workbook**. https://sre.google/workbook/
- **DORA**. https://dora.dev/
- **CIS Controls v8**. https://www.cisecurity.org/controls/v8
- **CIS PostgreSQL Benchmark**. https://www.cisecurity.org/benchmark/postgresql
- **AgID Misure Minime ICT (Circolare 2/2017)**. https://www.agid.gov.it/it/sicurezza/misure-minime-sicurezza-ict
- **SLSA**. https://slsa.dev/
- **WCAG 2.2**. https://www.w3.org/TR/WCAG22/

### A.7 Italian regulatory primary sources

- **Normattiva** (Italian decree texts). https://www.normattiva.it/
- **EUR-Lex** (EU regulations). https://eur-lex.europa.eu/
- **Garante Privacy**. https://www.garanteprivacy.it/
- **ACN** (cybersecurity). https://www.acn.gov.it/
- **GSE** (energy / Piano 5.0). https://www.gse.it/
- **Italia Domani** (Piano 4.0/5.0 PNRR). https://www.italiadomani.gov.it/

---

## Appendix B — File:line anchor index (for cross-doc citation)

Stable file:line pointers used by [`AUDIT.md`](AUDIT.md), [`REMEDIATION.md`](REMEDIATION.md), and [`UPLIFT.md`](UPLIFT.md).

- `backend/src/index.js:59` — `buildApp()` middleware chain
- `backend/src/index.js:83-102` — helmet + CSP block
- `backend/src/index.js:180` — `main()` async bootstrap
- `backend/src/index.js:189-191` — admin-bootstrap fail-closed
- `backend/src/index.js:228-239` — Sparkplug bridge dynamic require
- `backend/src/index.js:242-281` — graceful shutdown
- `backend/src/config/index.js:113-145` — production guardrails
- `backend/src/middleware/auth.js:21` — JWT HS256 pinned
- `backend/src/middleware/auth.js:28-30` — dev-mode bypass
- `backend/src/middleware/auth.js:55-72` — RBAC role hierarchy
- `backend/src/services/oee-calculator.js` — OEE math (entire file canonical)
- `backend/src/services/influx-writer.js` — Influx batched writes + bootstrapTasks
- `backend/src/services/opcua-bridge.js` — OPC UA client (SSRF gap)
- `backend/src/services/piano4-attestazione.js`, `piano5-attestazione.js` — attestazione PDF
- `backend/src/db/migrations/001_initial.sql` … `007_attestazioni_pdf_blob.sql` — schema
- `frontend/src/api/client.ts:14` — JWT in localStorage (gap)
- `frontend/src/App.tsx` — no auth guards (gap)
- `frontend/src/hooks/useRealtime.ts:17` — default ws:// (gap)
- `mosquitto/config/mosquitto.conf:28` — `allow_anonymous true` (dev default; entrypoint guard prevents prod boot)
- `mosquitto/config/acl` — pattern-based tenant ACL
- `mosquitto/entrypoint.sh:28-37, 41-50` — fail-close on default credentials and anonymous-in-prod
- `k8s/namespace.yaml` — PSS restricted + default-deny NetworkPolicy
- `k8s/deployment.yaml:44-91` — pod + container securityContext
- `terraform/versions.tf:14-20` — state backend (commented; gap)
- `terraform/modules/db/main.tf:43-47` — RDS egress 0.0.0.0/0 (gap)
- `grafana/provisioning/datasources/postgres.yml:13` — sslmode disable (gap)
- `.github/workflows/ci.yml:140, 147` — npm audit / Trivy non-blocking (gap)

---

## Appendix C — Change log

- **v1.0.0 — 2026-05-07** — baseline. Supersedes legacy `MODUS_OPERANDI.md` (technical sections), `ARCHITECTURE.md`, `API.md`, `SLO.md`, `DATA_GOVERNANCE.md`, `A11Y.md`, parts of `ITALIAN-COMPLIANCE.md`. Authored as part of the four-document set (HANDOFF, AUDIT, REMEDIATION, UPLIFT). Pinned commit `d4c5107`. Doctrine: 22 numbered rules. Word count ≥ 20 000.

---

**Made in Mozzecane (VR) — Veneto, Italy.**
