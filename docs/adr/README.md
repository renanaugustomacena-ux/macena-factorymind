# Architecture Decision Records

This directory holds FactoryMind's Architecture Decision Records (ADRs)
following the [Michael Nygard format](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md)
adapted for the four-document doctrine set (HANDOFF / AUDIT / REMEDIATION
/ UPLIFT). Open `template.md` for the canonical shape.

## Rules

1. **One decision per ADR.** Bundling N decisions into one ADR loses
   discoverability — the next reader who wants to know "why is JWT
   signed with HS256?" cannot find it inside an ADR titled "Auth + RBAC
   + audit log". Split before you write.
2. **Numbering is monotonic and immutable.** ADR-0042 stays ADR-0042
   even if it's superseded; the superseding ADR carries
   `Supersedes: ADR-0042` and ADR-0042's status flips to
   `Superseded by: ADR-XXXX`.
3. **Status is one of:** `Proposed`, `Accepted`, `Deprecated`, `Superseded
   by ADR-NNNN`. No others. `Rejected` ADRs are deleted, not retained —
   this is a record of decisions taken, not of every alternative considered.
4. **Sign-off is multi-role.** Engineering, commercial, legal. The
   Engineering signature alone is not enough for ADRs that touch the
   commercial tier model (HANDOFF § 1.5) or the legal templates
   (`legal/`). Without all required signatures the ADR remains
   `Proposed` — operational changes carrying its mandate require their
   own narrower ADR for the engineering-only portion.
5. **An ADR's existence does not retroactively bless violation.** If
   the codebase already does X and an ADR prohibits X, the ADR opens a
   ticket to remove X (or supersedes itself with a new ADR explaining
   the exception). Doctrine drift documented as ADR is no better than
   undocumented drift.

## Index

| ID | Title | Status | Date |
|---|---|---|---|
| [ADR-0001](0001-four-document-doctrine-set.md) | Four-document doctrine set replaces the legacy seven-doc layout | Accepted | 2026-05-07 |
