# ADR-NNNN — short-imperative-title

**Status:** {{ Proposed | Accepted | Deprecated | Superseded by ADR-NNNN }}
**Date:** YYYY-MM-DD
**Author:** Renan Augusto Macena <re@factorymind.it>
**Owners:** {{ engineering / commercial / legal }}
**Supersedes:** {{ ADR-NNNN | none }}
**Superseded by:** {{ ADR-NNNN | none }}

## Context

What is the problem being decided? What constraints, deadlines, or
external pressures apply? Cite primary sources (regulatory text, customer
contract clauses, audit findings) by exact reference: art. number,
GHSA / CVE / KEV identifier, ticket ID. No prose stand-ins for citations.

## Decision

State the decision in one paragraph, present tense, indicative mood:
"FactoryMind adopts X." Followed by enough technical specification that
an engineer reading the ADR a year from now can re-implement the decision
without consulting the original author.

## Alternatives considered

For each:

- **Alternative N — short label.** What the alternative was, why it was
  considered, why it was rejected. Two sentences minimum; rejection
  reason cannot be "we don't like it" — must cite a measurable defect
  (cost, latency, blast radius, regulatory exposure).

## Consequences

- **Positive.** Specific outcomes the team will see (DORA-Four-Keys
  movement, SLO posture change, risk closure, customer-facing capability).
- **Negative.** Specific costs the team accepts (build-time hit, on-call
  burden, opex line-item).
- **Reversibility.** How hard is it to undo? Cite the rollback path,
  whether it requires customer notice (R-4 / R-6), whether documented
  data migration is needed.

## Implementation pointers

- File paths affected: `path/to/file.ext` (one bullet per file).
- Tickets that this ADR closes or opens: `R-XXX-NNN` (REMEDIATION) or
  `u-track-id` (UPLIFT).
- Tests that must exist (test-first per R-1) before merge:
  `path/to/test.test.js`.

## Cross-references

- Doctrine rules touched: `H-NN`, `R-NN`, `A-NN`, `U-NN`, `T-NN`.
- Related ADRs: `ADR-NNNN` (predecessor), `ADR-NNNN` (sibling).
- Companion document sections: HANDOFF § N.N, AUDIT § N.N, REMEDIATION § N.N, UPLIFT § N.N.

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Engineering owner | | | |
| Commercial owner (if applicable) | | | |
| Legal owner (if applicable) | | | |
