# Transfer Impact Assessment — InfluxData Inc.

**Versione:** 0.9 (DRAFT — pending counsel sign-off)
**Data:** 2026-05-07
**Pinned commit:** TBD (after counsel review)
**Owner editoriale:** Renan Augusto Macena (FactoryMind)
**Owner legale:** _________________________ (avvocato qualificato — TBD)
**Sub-processore oggetto:** InfluxData Inc., 799 SE Oak St., Portland, Oregon 97214, USA
**Servizio:** InfluxDB Cloud Serverless (Tier 4 SaaS multi-tenant — opzionale per cliente)
**Region scelta:** AWS `eu-west-1` (Irlanda) come default; `eu-central-1` (Francoforte) per clienti che richiedono residenza dati DACH
**Strumenti di trasferimento:** Standard Contractual Clauses (SCC) ex Decisione di esecuzione (UE) 2021/914 della Commissione del 4 giugno 2021 — Modulo Two (controller-to-processor)
**Riferimento giurisprudenziale:** CGUE C-311/18 ("Schrems II"), sentenza del 16 luglio 2020
**Riferimento normativo:** Reg. UE 2016/679 (GDPR) artt. 44–49; EDPB Recommendations 01/2020 on supplementary measures (versione finale 18 giugno 2021)
**Companion documents:** [`DATA-PROCESSING-AGREEMENT.md`](DATA-PROCESSING-AGREEMENT.md), [`HANDOFF.md`](../docs/HANDOFF.md) § 7, [`AUDIT.md`](../docs/AUDIT.md) § 7 (legale & GDPR)
**Sign-off line:** _________________________ (data) _________________________ (firma avvocato)

---

## 0. Executive summary (IT)

Il presente documento è il Transfer Impact Assessment (TIA) richiesto dalla giurisprudenza Schrems II e dalle EDPB Recommendations 01/2020 per i trasferimenti di dati personali verso InfluxData Inc., sub-processore di FactoryMind con sede operativa negli Stati Uniti (Oregon) e infrastruttura cloud in regione UE (AWS Irlanda / Francoforte). Il documento valuta se le SCC ex Decisione UE 2021/914 sono di per sé sufficienti a garantire un livello di protezione "essenzialmente equivalente" a quello UE, e — concludendo che non lo sono nel caso specifico — descrive le **misure supplementari** (tecniche, organizzative, contrattuali) che FactoryMind adotta per portare il trasferimento sotto la soglia di rischio accettabile.

La conclusione operativa è triplice:

1. **InfluxDB Cloud è un'opzione, non un default.** Il deployment Tier 1–3 (Community / Standard / Enterprise) usa InfluxDB self-hosted nel data-center del cliente o in regione UE controllata da FactoryMind (`eu-south-1` Milano default Terraform). InfluxData Inc. interviene solo per i clienti Tier 4 SaaS che esplicitamente scelgono InfluxDB Cloud.
2. **Quando InfluxDB Cloud è scelto, la regione è UE-soltanto** (`eu-west-1` Irlanda o `eu-central-1` Francoforte). Le sub-aziende statunitensi del fornitore non vedono i dati a riposo per architettura del prodotto.
3. **I dati personali trasferiti sono minimizzati** a livello applicativo: la telemetria di macchina (1 Hz × decine/centinaia di macchine) NON è dato personale GDPR (cfr. § 3.2). I soli dati personali presenti in InfluxDB sono identificatori operatore quando la macchina ha login per turno — questi sono pseudonimizzati a livello applicativo prima dell'ingest (cfr. § 5.2).

Senza un avvocato che sottoscriva, questo documento è una bozza tecnica. La versione 1.0 esce dopo la revisione del consulente legale incaricato e dopo la firma su `Sign-off line`. **Fino ad allora InfluxDB Cloud resta esplicitamente disabilitato per ogni nuovo cliente Tier 4.**

---

## 1. Scope and methodology (EN)

### 1.1 What this TIA covers

This TIA covers the transfer of personal data from FactoryMind data controllers (Veneto manufacturing SMEs and EU customers) to InfluxData Inc., a US-incorporated data processor, when those controllers elect to store time-series telemetry in InfluxDB Cloud Serverless rather than self-host InfluxDB OSS.

The transfer mechanism in scope is Standard Contractual Clauses (SCC) Module Two of Decision (EU) 2021/914, as concluded between the FactoryMind data controller (or processor on the controller's behalf) and InfluxData Inc.

The analysis follows the six-step EDPB Recommendations 01/2020 methodology:

1. Know your transfers (§ 3).
2. Identify the transfer tool relied on (§ 4).
3. Assess if the transfer tool is effective in light of the destination country's law (§ 5).
4. Adopt supplementary measures where necessary (§ 6).
5. Take procedural steps if a supplementary measure is contractual (§ 7).
6. Re-evaluate at appropriate intervals (§ 8).

### 1.2 What this TIA does NOT cover

- Transfers to other US-based sub-processors (none currently — see § 3.4).
- Transfers under derogations of GDPR Art. 49 (none currently).
- Transfers within the EEA (no TIA required).
- Transfers between FactoryMind branches (FactoryMind is a single Italian legal entity; no intra-group transfers).

Each future addition to the sub-processor list (cfr. `DATA-PROCESSING-AGREEMENT.md` § 5) requires a TIA of comparable depth.

---

## 2. Doctrine — Transfer Assessment Doctrine (EN)

Twelve rules that govern how FactoryMind authors, signs, and revises TIAs.

### Rule T-1 — A TIA is per-sub-processor and per-jurisdiction.

Bundling multiple sub-processors into a single TIA hides asymmetric risk. Each US sub-processor gets a separate TIA, even if commercially trivial.

**Why.** US disclosure regimes (FISA 702, EO 12333, CLOUD Act) apply differently depending on whether the sub-processor is a "provider of electronic communication service" (ECS), a "remote computing service" (RCS), or neither. InfluxData Inc. as a database-as-a-service operator is an RCS under 18 U.S.C. § 2711(2), which differs materially from a CDN provider. Conflating these losses analytical resolution.

**How to apply.** This file is `TIA-INFLUXDATA.md`. The next US sub-processor (e.g., a SMTP provider US-based) gets its own `TIA-<NAME>.md`.

### Rule T-2 — The default for transfers is "do not transfer".

A transfer requiring a TIA is opt-in, not opt-out. The Tier 4 SaaS contract carries an explicit consent step ("la informiamo che i Suoi dati saranno trattati in sub-trattamento da InfluxData Inc.") that the customer must positively check. Pre-checked boxes are forbidden (Reg. UE 2016/679 considerando 32).

**Why.** A customer who later complains that "we did not realise our data left the EU" is, structurally, telling the truth if the consent was implicit.

### Rule T-3 — Pseudonymise before exit.

Personal data leaving the EEA must be pseudonymised at the application layer such that the controller's data-mapping table (the only thing that ties pseudonyms back to natural persons) never leaves the EEA.

**Why.** Schrems II's "essentially equivalent" standard cannot be met for cleartext personal data transferred to a jurisdiction with bulk-surveillance authorities; pseudonymisation reduces the data set crossing the border to one that, alone, cannot identify the subject.

**How to apply.** Cfr. § 5.2 (technical supplementary measures) — operator login → SHA-256(operator_id, tenant_salt) before MQTT publish.

### Rule T-4 — Encryption at rest with customer-held keys when the regulator stance is hostile.

For Tier 4 SaaS in InfluxDB Cloud, FactoryMind enables InfluxData's customer-managed key (CMK) encryption-at-rest option (where available — currently in beta on Cloud Serverless). The customer's KMS key in `eu-south-1` Milano holds the wrapping key; InfluxData cannot decrypt without a real-time call back to the EU KMS, which sits behind FactoryMind's cloud-IAM perimeter.

**Why.** The Section 702 / EO 12333 disclosure regime applies to the data in the form the US processor can decrypt. If the encryption key never leaves the EEA, the disclosed material is ciphertext; for cryptographically strong encryption, this is functionally equivalent to no disclosure.

**How to apply.** Cfr. § 5.3.

### Rule T-5 — Cite real cases, not folklore.

Statements like "the FBI has issued NSLs against US tech companies" without docket numbers, government transparency reports, or court rulings are not supplementary measures — they are speculation. A TIA is built on cited primary sources; this document carries footnoted references to FISA Court orders (in the form they are publicly available), DOJ transparency reports, and Schrems II directly.

**Why.** A regulator reading the TIA at audit will reject conclusions derived from informal sources. Primary citations are the durable evidence.

### Rule T-6 — The TIA expires.

Each TIA carries a `valid_through` date (§ 9). After that date, the TIA must be re-evaluated even if no facts have apparently changed. The default re-evaluation cadence is 12 months, accelerated to 6 months when:

- The destination country issues new legislation affecting government access to data.
- The CJEU rules on a new transfer-mechanism case.
- The sub-processor is acquired, restructured, or moves jurisdiction.
- A new EDPB recommendation supersedes 01/2020.

**How to apply.** Cfr. § 9. The valid_through date is `2027-05-07` for v1.0 (after counsel sign-off lands).

### Rule T-7 — A TIA is signed by a qualified lawyer.

Engineering can draft the technical and organisational supplementary measures, but the legal-landscape assessment (§ 5.1) and the conclusion that "supplementary measures are sufficient" (§ 6.5) requires a qualified Italian or EU lawyer (avvocato iscritto all'albo). This document carries the engineering draft; the lawyer's signature on `Sign-off line` is the trigger that flips it to v1.0.

**Why.** A TIA without a lawyer's sign-off is a unilateral controller statement. The Garante or the CJEU will treat it as such on review.

### Rule T-8 — Transparent to the data subject.

The TIA's existence and conclusion are mentioned in the customer-facing privacy notice (`legal/INFORMATIVA-PRIVACY-GDPR.md` § 6 — sub-processors and international transfers). The data subject who asks for the TIA receives a redacted version (commercial terms with InfluxData removed) within 30 days.

**Why.** GDPR Art. 13(1)(f) + Art. 14(1)(f): the controller informs the subject of "the fact that the controller intends to transfer personal data to a third country … and the existence or absence of an adequacy decision … or, in the case of transfers referred to in Article 46 or 47, or the second subparagraph of Article 49(1), reference to the appropriate or suitable safeguards and the means by which to obtain a copy of them or where they have been made available."

### Rule T-9 — Document the residual risk.

No supplementary measure makes risk zero. The TIA names what remains (§ 7) — typically the catastrophic-disclosure tail where a US authority compels InfluxData to disclose key-management metadata or surveil access patterns rather than data. The customer accepts this residual via their signed DPA addendum.

### Rule T-10 — Drill the disclosure-request response.

Should InfluxData receive a US government access request, the contractual provisions in the SCC + DPA require notification (where legally permissible). FactoryMind keeps an internal runbook for handling that notification (HANDOFF § 8.x — TBD as `H-runbook-foreign-disclosure-request`). Once a year, FactoryMind drills the runbook with a tabletop exercise (REMEDIATION continuous § 8 — R-DRILL-DISCLOSURE-001 to be filed).

### Rule T-11 — Migration plan documented.

Should this TIA conclude that supplementary measures are insufficient (§ 6.5), or should the residual risk become unacceptable mid-cycle, the migration path back to a fully-EU-sovereign InfluxDB stack is documented in advance (§ 8.3). The Tier 4 contract carries a 90-day migration window during which FactoryMind reverts to InfluxDB OSS in `eu-south-1` Milano without service interruption.

### Rule T-12 — Counsel and engineering disagree, counsel wins.

Where the legal assessment in § 5.1 conflicts with what an engineer "thinks should be fine", the legal assessment binds. An engineer who believes the lawyer is mistaken files a written rebuttal that the next lawyer review evaluates; meanwhile, the legal conclusion is operative.

**Why.** Legal risk is the asymmetric one: engineering downside is bounded (a failed deploy); legal downside (a Garante fine of up to 4% global turnover, or a customer winning a damage claim under Art. 82) can sink the company. The asymmetry compels deference.

---

## 3. Transfer description (EN)

### 3.1 Categories of personal data transferred

The InfluxDB Cloud bucket holds the following data categories. Items marked **(P)** are personal data under GDPR; items marked **(NP)** are not personal data per recital 26 in conjunction with the [Breyer](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62014CJ0582) reasoning.

| Category | Example | Personal data? | Mitigation in transfer |
|---|---|---|---|
| Machine telemetry (raw counters, currents, temperatures, vibrations, alarms) | `factory.mozzecane.line-01.cnc-A.spindle_amps = 12.4 @ 2026-05-07T08:31:14Z` | (NP) | None required |
| OEE aggregates per shift / line / machine | `oee.line-01 = 0.62, A=0.91, P=0.78, Q=0.87` | (NP) | None required |
| Operator login (when machine has shift login) | `operator_id = mario.rossi.42` | (P) | Pseudonymised at ingest — see § 5.2 |
| Maintenance event annotations | `maintenance.cnc-A by mario.rossi: belt replaced` | (P, contextual) | Only the pseudonym crosses; the free-text body is sanitised at ingest if it contains names |
| Customer infrastructure metadata (facility name, address) | `facility = "Acme SRL, Via Roma 12"` | Possibly (P) for sole proprietorships | Stored only in PostgreSQL (which is self-hosted in EU); never pushed to InfluxDB |

The dominant data class is non-personal machine telemetry. Personal data is residual, pseudonymised, and minimised.

### 3.2 Categories of data subjects

When personal data is transferred (rare, per § 3.1), the categories are:

- **Manufacturing operators / shop-floor workers** (workers in the data controller's factory). GDPR Art. 4(1) data subject; protected additionally by Italian Statuto dei Lavoratori (L. 300/1970) Art. 4 in the post-Jobs Act (D.Lgs. 151/2015) reading.
- **Maintenance technicians** (employees of the data controller or third-party contractors).

No data subjects in the InfluxDB transfer are children, vulnerable persons, or persons under criminal investigation. No special categories of data (Art. 9) — health, biometric, etc. — are transferred.

### 3.3 Purpose and legal basis

**Purpose.** Time-series storage of operational data for OEE computation, alerting, and Piano Transizione 4.0 / 5.0 attestation.

**Legal basis (Art. 6).** Performance of contract (Art. 6(1)(b)) for the controller's contractual relationship with the operator (employment contract); legitimate interest (Art. 6(1)(f)) for the controller's interest in operational efficiency, balanced against the worker's data-protection interest under the Italian Garante's worker-monitoring guidance (Provvedimento 17 luglio 2024, n. 419).

For maintenance-technician personal data, the controller-processor flow is similar; FactoryMind acts as processor for the controller's purposes.

### 3.4 Sub-processors involved in the transfer

InfluxData Inc. is the only US-based sub-processor in the InfluxDB Cloud transfer chain. InfluxData itself uses AWS as infrastructure provider; AWS in `eu-west-1` (Ireland) and `eu-central-1` (Frankfurt) holds the data at rest. AWS's role is documented in Amazon Web Services EMEA SARL's GDPR DPA (the EMEA-incorporated AWS subsidiary that contracts with EU customers); AWS is not the contracting sub-processor in the FactoryMind chain — InfluxData is.

### 3.5 Data location at rest

| Layer | Location | Operator |
|---|---|---|
| InfluxDB bucket storage | AWS `eu-west-1` (Ireland) or `eu-central-1` (Frankfurt) | InfluxData Inc. (control plane) + AWS EMEA SARL (infrastructure) |
| InfluxData control plane | US (Portland, Oregon HQ) | InfluxData Inc. |
| InfluxData support engineers | Global rotation, including US | InfluxData Inc. |
| Application logs (data-plane events) | US-Oregon (consolidated) | InfluxData Inc. |

The control-plane location (US) is the source of the Schrems II concern: even though data at rest is in the EU, control-plane operations (replication, shard migration, on-call diagnostic access) cross the Atlantic.

---

## 4. Transfer tool (EN)

The contracting parties are:

- **Data exporter:** the FactoryMind controller-or-processor (depending on the customer relationship: a Tier 4 SaaS customer is the controller and FactoryMind is the processor; FactoryMind sub-processes to InfluxData Inc.).
- **Data importer:** InfluxData Inc., 799 SE Oak St., Portland, Oregon 97214, USA.

The transfer tool is **Standard Contractual Clauses Module Two** (controller-to-processor) of Commission Implementing Decision (EU) 2021/914 of 4 June 2021. The SCC are signed bilaterally between FactoryMind and InfluxData Inc. as Annex of the InfluxData Cloud DPA. The SCC signature date and counterparty references are recorded in `legal/DATA-PROCESSING-AGREEMENT.md` § 5; this TIA is a separate companion document that the SCC explicitly references at Clause 14(b).

InfluxData Inc. has not been subject to a Commission adequacy decision under Art. 45. The EU-US Data Privacy Framework (Adequacy Decision (EU) 2023/1795 of 10 July 2023) provides an alternative transfer tool **only when the importer is self-certified under the framework** and the transfer is to a self-certified entity. As of 2026-05-07, InfluxData Inc. is — TBD: counsel to verify InfluxData's DPF self-certification status by checking [https://www.dataprivacyframework.gov/list](https://www.dataprivacyframework.gov/list) at the date of TIA finalisation. **If InfluxData is DPF-self-certified, the transfer tool primarily relied on becomes the adequacy decision; the SCC remain as a fallback.** This finding, when confirmed, materially changes the analysis in §§ 5–6: the supplementary-measures requirement attenuates because the Commission has formally found the DPF mechanism adequate.

The default analysis below assumes the worst case (SCC alone, no DPF coverage). When counsel confirms DPF status, the document is amended.

---

## 5. Effectiveness assessment (EN)

### 5.1 Destination country legal landscape

Under Schrems II, the assessor must consider whether US law, "in particular concerning access by public authorities to such data", provides a level of protection essentially equivalent to that guaranteed by EU law.

The CJEU's specific concerns in C-311/18 were:

- **Section 702 of FISA** (50 U.S.C. § 1881a) — bulk surveillance of non-US persons abroad, with no EU-citizen-actionable redress.
- **Executive Order 12333** — broader signals-intelligence authority outside FISA.
- **Lack of judicial oversight** of bulk programmes from the EU citizen's perspective.

Subsequent developments materially relevant to this TIA:

- **Executive Order 14086** (October 7, 2022) — created the Data Protection Review Court (DPRC), a redress mechanism for EU subjects, and introduced "necessary and proportionate" requirements for signals-intelligence collection.
- **Adequacy Decision (EU) 2023/1795** — the Commission, on the basis of EO 14086, issued a new adequacy decision for the EU-US Data Privacy Framework on 10 July 2023.
- **Pending challenge** (T-553/23, *La Quadrature du Net*) — the DPF adequacy decision is under challenge before the General Court. As of TIA draft date, no judgment.
- **Italian implementation context** — the Garante's "Schrems II checklist" (Provvedimento 12 maggio 2022) and the Italian transposition of NIS2 (D.Lgs. 4 settembre 2024, n. 138) do not change the SCC analysis but affect notification obligations on incident.

**Counsel review needed (§ 7) on:**

- DPF self-certification status of InfluxData Inc. (above).
- Pendency of T-553/23 and its impact on the validity of relying on the DPF if applicable.
- Garante guidance updates between the present TIA date and the v1.0 sign-off date.

### 5.2 Technical supplementary measures (engineering draft)

The following measures are implemented at the application layer by FactoryMind:

1. **Operator-ID pseudonymisation at ingest.** When MQTT telemetry contains an `operator_id`, the backend (`backend/src/services/mqtt-handler.js`) replaces it with `SHA-256(operator_id || tenant_salt)` before InfluxDB write. The mapping table (operator_id → user record) lives in PostgreSQL self-hosted in `eu-south-1` Milano; it does not transit InfluxDB. Re-identification of an operator from the InfluxDB record alone requires possession of the tenant salt + the mapping table, both of which are EEA-only.
2. **Free-text scrubbing.** Maintenance event annotations are passed through a server-side regex sanitiser that removes `[\p{L}]+\.[\p{L}]+` tokens (likely first-name.last-name), `\d{11}` (likely codice fiscale), and email patterns. The sanitiser fails closed: an unparseable string is replaced with `[REDACTED]`.
3. **No customer-PII in tag values.** InfluxDB tag values are part of the index and are queryable wildcard-wise. Personal data is forbidden from tag values by `backend/src/mqtt/topics.js` schema. Personal data, when present, is in field values and additionally pseudonymised per (1).
4. **TLS 1.3 in transit.** Connections from FactoryMind backend to InfluxDB Cloud use TLS 1.3 with cipher-suite restrictions matching IEC 62443-3-3 SR 4.1 SL-2.
5. **Customer-managed keys at rest** — when the customer Tier 4 contract enables it. The key resides in the customer's AWS KMS in `eu-south-1`; InfluxData unwraps per-write/per-read with a KMS call, which fails the disclosure scenario where the US authority compels InfluxData but lacks key access.

### 5.3 Organisational supplementary measures

- **InfluxData support escalation policy** — FactoryMind contracts with InfluxData under a support tier that allows the EU customer to require all support engineer access to be conducted by EEA-resident InfluxData personnel. (Counsel to verify this is contractually expressible in InfluxData's standard SLA and to record the addendum reference here.)
- **Annual sub-processor audit** — FactoryMind reviews InfluxData's published transparency report and SOC 2 Type II under InfluxData's compliance package. The audit is filed in `legal/audits/` (directory to be created when first audit completes; tracked in REMEDIATION continuous § 8 as R-AUDIT-INFLUXDATA-ANNUAL).
- **Disclosure-request runbook** — see Rule T-10.

### 5.4 Contractual supplementary measures

The InfluxData Cloud DPA (referenced in `DATA-PROCESSING-AGREEMENT.md`) carries the following clauses verified during this TIA:

- **Notification of access requests** — "InfluxData will notify the customer of any legally binding request for disclosure of personal data made by a public authority, unless prohibited by law." (Cfr. SCC Clause 15.)
- **Best-effort challenge of overbroad requests** — "InfluxData will challenge any request that is, in InfluxData's reasonable opinion, overbroad or non-compliant with applicable law."
- **Annual certification of compliance** — "InfluxData will provide annual certification of compliance with the Module Two SCC."

These clauses parallel the SCC clauses but bind InfluxData additionally as a matter of contract (not just SCC default).

### 5.5 Conclusion of effectiveness assessment

The technical pseudonymisation and customer-managed-key encryption (§§ 5.2-5.3) materially reduce the personal data transferred to a form that, alone, cannot identify a natural person. Under the EDPB's 2021 supplementary-measures recommendations, **encryption with EU-held keys is identified as Use Case 1 (with EU-side key custody) and is considered an effective measure** for transfers to processors who do not need to access cleartext.

The organisational and contractual measures (§§ 5.3-5.4) handle the residual risk that an authority-compelled InfluxData attempts diagnostic access patterns or metadata disclosure. The notification obligation lets FactoryMind react.

**Engineering's view, pending counsel: with the supplementary measures in place, the transfer reaches an "essentially equivalent" level of protection.**

---

## 6. Adoption of supplementary measures (EN)

### 6.1 What is adopted today (v0.9 draft)

- All items in §§ 5.2 (technical) and 5.4 (contractual) — these are already part of the FactoryMind backend architecture and the InfluxData Cloud DPA respectively.

### 6.2 What is conditional on counsel sign-off (v1.0 trigger)

- § 5.3 organisational measures — the support-tier addendum requires a contractual amendment that counsel reviews.
- This TIA's `valid_through` (§ 9) and the migration plan (§ 8.3).

### 6.3 What is not adopted (rejected alternatives)

- **Full self-hosting of InfluxDB in `eu-south-1` Milano with no Cloud option** — rejected because a non-trivial fraction of Tier 4 prospects request the managed-cloud experience and the engineering cost of building a fully-managed alternative is currently prohibitive. The fallback (§ 8.3) preserves the option.
- **Anonymisation rather than pseudonymisation at ingest** — rejected because operational use cases (per-operator OEE, per-shift maintenance attribution) require the inverse mapping. Anonymisation (mathematically irreversible) breaks those.
- **Reliance on the DPF adequacy without supplementary measures** — rejected because the pending challenge T-553/23 introduces an invalidation risk; supplementary measures act as belt-and-braces.

---

## 7. Procedural steps — counsel sign-off requirements (EN)

Before this TIA flips from v0.9 (draft) to v1.0 (operative), counsel must:

1. Confirm InfluxData Inc.'s DPF self-certification status as of the sign-off date (§ 4 trailing paragraph).
2. Review § 5.1 legal-landscape assessment for accuracy and currency.
3. Review § 5.4 contractual-measures statements against the actual InfluxData Cloud DPA in force (counsel may have a more recent version than the engineering draft).
4. Sign the `Sign-off line` at the head of this document.
5. Optionally amend any section; engineering re-confirms technical sections are still accurate.

The TIA, when v1.0, is filed in `legal/` and referenced from `DATA-PROCESSING-AGREEMENT.md` § 5 and `INFORMATIVA-PRIVACY-GDPR.md` § 6.

---

## 8. Re-evaluation cadence and migration plan (EN)

### 8.1 Re-evaluation triggers

Any of:

- Calendar trigger: 12 months from `valid_through` (default: re-evaluate by 2027-05-07 if v1.0 is signed today).
- New CJEU ruling on transfers (e.g., Schrems III, T-553/23 outcome).
- US legislation affecting access to data (FISA reauthorisation, new EO).
- InfluxData Inc. acquisition, restructuring, or change of control.
- New Garante guidance or EDPB recommendation supersession.
- Material change to the FactoryMind sub-processor list.
- A documented incident (subprocessor breach, US disclosure request received).

### 8.2 Re-evaluation scope

A re-evaluation produces a new version of this file. The previous version is preserved (git history); the new version supersedes. The customer-facing privacy notice is updated to reference the new version's date.

### 8.3 Migration plan if supplementary measures become insufficient

If a re-evaluation concludes that the residual risk is no longer acceptable, FactoryMind triggers the 90-day Tier 4 migration:

1. **Day 0 (decision)** — the engineering team builds the migration runbook by adapting `H-runbook-influxdb-migration` (HANDOFF § 8 — TBD as a new runbook).
2. **Days 1–30** — affected customers receive notice (template in REMEDIATION § 10) explaining the migration timeline and confirming continuity of service.
3. **Days 31–60** — InfluxDB OSS deployed in customer-elected EU region (`eu-south-1` Milano default); historical data exported from InfluxDB Cloud and re-imported.
4. **Days 61–90** — dual-write phase, then InfluxDB Cloud bucket retired and contract terminated.
5. **Day 90** — confirmation to the customer and Garante (if filings were required).

The migration cost is borne by FactoryMind for re-evaluations triggered by external events (CJEU, EDPB, US legislation); the customer indemnifies for migrations triggered by their internal compliance posture (e.g., a sectoral regulator requiring full EU sovereignty).

---

## 9. Validity period (EN)

| Field | Value |
|---|---|
| Drafted | 2026-05-07 |
| Counsel signed | TBD |
| `valid_through` (default 12 months from sign-off) | TBD |
| Next mandatory review | TBD |

---

## 10. Sign-off ledger

| Version | Date | Engineering author | Counsel | Notes |
|---|---|---|---|---|
| 0.9 | 2026-05-07 | Renan Augusto Macena | _________________________ | DRAFT — all technical and organisational measures committed to architecture; pending counsel review of legal-landscape sections (§§ 5.1, 5.4) and DPF status verification (§ 4). |
| 1.0 | TBD | TBD | TBD | TBD |

---

## Appendix A — References

**Primary regulatory sources:**

- Regulation (EU) 2016/679 (GDPR), arts. 44–49.
- Commission Implementing Decision (EU) 2021/914 of 4 June 2021 (Standard Contractual Clauses).
- Adequacy Decision (EU) 2023/1795 of 10 July 2023 (EU-US Data Privacy Framework).
- Court of Justice of the European Union, Case C-311/18 (*Data Protection Commissioner v. Facebook Ireland and Schrems*), Judgment of 16 July 2020 ("Schrems II").
- EDPB Recommendations 01/2020 on measures that supplement transfer tools to ensure compliance with the EU level of protection of personal data, version 2.0, adopted on 18 June 2021.
- Executive Order 14086 (October 7, 2022) on Enhancing Safeguards for United States Signals Intelligence Activities.

**Italian regulatory context:**

- Garante per la Protezione dei Dati Personali, Provvedimento 12 maggio 2022 (Schrems II checklist).
- Garante, Provvedimento 17 luglio 2024, n. 419 (worker-monitoring under updated Statuto Lavoratori art. 4).
- D.Lgs. 4 settembre 2024, n. 138 (NIS2 Italian transposition).
- Statuto dei Lavoratori (L. 20 maggio 1970, n. 300), art. 4 as amended by D.Lgs. 14 settembre 2015, n. 151.

**FactoryMind internal:**

- [`legal/DATA-PROCESSING-AGREEMENT.md`](DATA-PROCESSING-AGREEMENT.md) — sub-processor list and DPA.
- [`legal/INFORMATIVA-PRIVACY-GDPR.md`](INFORMATIVA-PRIVACY-GDPR.md) — customer-facing privacy notice referencing this TIA.
- [`docs/HANDOFF.md`](../docs/HANDOFF.md) § 7 — data-governance and architectural pseudonymisation pipeline.
- [`docs/AUDIT.md`](../docs/AUDIT.md) F-CRIT-006 — the audit finding closed by this TIA.
- [`docs/REMEDIATION.md`](../docs/REMEDIATION.md) R-TIA-001 — the remediation ticket tracking sign-off.

---

**Made in Mozzecane (VR) — Veneto, Italy.**
