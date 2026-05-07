# ADR-0001 — Four-document doctrine set replaces the legacy seven-doc layout

**Status:** Accepted
**Date:** 2026-05-07
**Author:** Renan Augusto Macena <re@factorymind.it>
**Owners:** engineering + commercial
**Supersedes:** none (the legacy layout had no ADR)
**Superseded by:** none

## Context

Before 2026-05-07 the FactoryMind documentation lived in seven mostly-flat
Markdown files under `docs/`: `MODUS_OPERANDI.md`, `ARCHITECTURE.md`,
`API.md`, `DATA_GOVERNANCE.md`, `A11Y.md`, `ITALIAN-COMPLIANCE.md`, `SLO.md`.
Three problems became chronic:

1. **Conflated registers.** Legal-binding text (DPA references, GDPR Art.
   citations, foro-competente clauses) coexisted with engineering text
   (RFC citations, runbook diagnostics, code-map pointers) inside the same
   paragraphs. Garante audits flag this — the auditor cannot determine
   which version is authoritative.
2. **No hard-deadline mechanism.** The legacy docs catalogued problems but
   didn't bind them to a wave with a closure date. Tickets accumulated;
   the platform was never "done with W1" because there was no W1.
3. **No polish-vs-firefighting separation.** Quarterly planning conflated
   remediation (closing audit findings) with uplift (lifting the platform
   from "good" to "regulator-grade"). Polish projects always lost capacity
   to remediation, then both stalled.

Concretely — the audit at commit `d4c5107` catalogued 31 findings (7
Critical, 10 High, 11 Medium, 3 Low) without an exit-criteria or deadline
discipline; the operational lifecycle (`MODUS_OPERANDI § 5`) drifted from
the actual install.sh; the API prose surface (`API.md`) and the OpenAPI
spec drifted from the route files.

## Decision

FactoryMind adopts a **four-document canonical set** at `docs/`, with the
seven legacy files moved to `docs/legacy/`:

- **HANDOFF.md** — what *is*. The system in operation; 22 doctrine rules
  H-1..H-22; architecture; code map; operational lifecycle; API prose
  reference; data governance; SRE runbooks (materialised inline in § 8);
  compliance baseline; cross-product integration map; bus-factor onboarding.
- **AUDIT.md** — what is *broken*. 31 findings under NIST CSF 2.0 + MITRE
  ATT&CK ICS + OWASP API/IoT + IEC 62443-3-3 + CIS Controls v8 + AgID
  Misure Minime; doctrine A-1..A-20; CVSS-justified severities; file:line
  evidence; reproduction commands.
- **REMEDIATION.md** — how broken gets *fixed*. 60+ tickets in waves
  W0/W1/W2/W3 + Continuous; doctrine R-1..R-18; per-ticket exit criteria,
  regression test path, rollback plan, blast radius, RACI, comms plan.
- **UPLIFT.md** — how fixed gets *better*. DORA Four Keys baseline +
  targets; Spotify Tech Radar; Abstraction Ledger; five-track polish
  (DX/OX/Security/Commercial/Compliance); 30+ initiatives; 10 explicit
  anti-goals with flip conditions; five-year horizon; customer-success
  cadence.

Plus the machine-readable `openapi.yaml` (canonical API contract; HANDOFF
§ 6 is the prose companion).

Each document targets ~20 000 words by intention — denser than the
legacy seven combined, because the conflation was costing more space than
the depth.

## Alternatives considered

- **Alternative 1 — keep the seven legacy files but harden them.**
  Rejected because the conflated-register problem is structural: hardening
  a single file does not separate the IT-legal voice from the EN-engineer
  voice. The audit/remediation/uplift discipline would still need to live
  somewhere new.
- **Alternative 2 — three documents (HANDOFF + AUDIT + UPLIFT, with
  remediation rolled into AUDIT or HANDOFF).** Rejected because remediation
  has different cadence (wave-based, hard deadlines) and KPIs
  (tickets-closed-via-doctrine) than either audit (catalogue) or uplift
  (initiative-based, measurable outcomes). Two of those three KPIs end up
  invisible if you bundle three disciplines into one document.
- **Alternative 3 — auto-generated docs from code annotations.** Rejected
  for the load-bearing parts (legal, compliance, doctrine). Auto-gen
  works for API reference (where the OpenAPI spec already does it) but
  cannot capture the *why* — and the *why* is what makes a Garante audit
  defensible.

## Consequences

- **Positive.**
  - Bilingual register discipline (HANDOFF doctrine **H-3**) — IT for
    customer-/Garante-facing; EN for engineering — makes both audiences
    read first-class material.
  - Wave model + per-ticket exit criteria (REMEDIATION doctrine **R-1**,
    **R-7**) makes "is W1 done?" a binary question. As of 2026-05-07
    the W1 deadline (2026-06-06) is concrete; ticket drift is visible.
  - The polish-vs-firefighting split (UPLIFT § 1) lets sprint planning
    allocate against measurable initiatives without remediation cannibalising
    feature work.
- **Negative.**
  - ~80 000 words of canonical text to maintain. HANDOFF doctrine **H-22**
    quarterly review is the cost. The cold-reader handoff exercise
    (§ 12) is the reality check.
  - Cross-document anchors (`[label](FILE.md#anchor)`) require a CI lint
    (R-CI-DOCS-001) to avoid silent rot.
- **Reversibility.** Hard. The four-document set is not just text — it
  carries doctrine rules that bind code review (R-1 test-first), CI
  (R-CI-AUDIT-001 unmasked gates), and operational rituals (H-22 quarterly
  review). Reverting would lose the doctrine, not just the prose. A
  hypothetical superseding ADR would have to specify what replaces each
  doctrine surface.

## Implementation pointers

- New files: `docs/HANDOFF.md`, `docs/AUDIT.md`, `docs/REMEDIATION.md`,
  `docs/UPLIFT.md`, `docs/legacy/README.md` (supersession matrix).
- Moved files: `docs/A11Y.md` → `docs/legacy/A11Y.md` (and six siblings).
- Modified: `README.md` Quick Start + Documentation section.
- Tickets opened: R-ADR-001 (this ADR's existence-condition);
  R-CI-DOCS-001 (CI lint enforcing cross-doc anchors); R-RUNBOOK-001
  (alerts.yml `runbook_url` annotations point at HANDOFF anchors).

## Cross-references

- Doctrine rules: H-3 (bilingual register), H-9 (documentation is code),
  H-22 (quarterly review), R-1 (regression test before fix), A-1 (no
  finding without evidence), U-3 (anti-goals are first-class).
- Related ADRs: none yet (this is ADR-0001).
- Companion document sections: HANDOFF § 0 (how to read), § 12 (cold-reader
  exercise); AUDIT § 0; REMEDIATION § 0; UPLIFT § 1.

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Engineering owner | Renan Augusto Macena | 2026-05-07 | _________________________ |
| Commercial owner | Renan Augusto Macena | 2026-05-07 | _________________________ |
| Legal owner | _________________________ | _________________________ | _________________________ |
