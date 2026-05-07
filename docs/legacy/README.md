# Legacy documentation

These documents have been **superseded** by the four-document baseline (HANDOFF, AUDIT, REMEDIATION, UPLIFT) published as `docs/HANDOFF.md`, `docs/AUDIT.md`, `docs/REMEDIATION.md`, `docs/UPLIFT.md` on 2026-05-07.

| Legacy file | Superseded by |
|---|---|
| `MODUS_OPERANDI.md` | Technical sections → [`docs/HANDOFF.md`](../HANDOFF.md); commercial / operational / financial sections → [`docs/UPLIFT.md`](../UPLIFT.md) Track Commercial / Roadmap and `moneyplan.txt` at repo root |
| `ARCHITECTURE.md` | [`docs/HANDOFF.md`](../HANDOFF.md) § 3 (Architecture) — expanded with code citations |
| `API.md` | [`docs/HANDOFF.md`](../HANDOFF.md) § 6 (prose API reference companion to `docs/openapi.yaml`) |
| `ITALIAN-COMPLIANCE.md` | [`docs/HANDOFF.md`](../HANDOFF.md) § 9 (Compliance baseline) + [`docs/AUDIT.md`](../AUDIT.md) § 7 (legal & GDPR findings) + § 10 (compliance scorecards) |
| `DATA_GOVERNANCE.md` | [`docs/HANDOFF.md`](../HANDOFF.md) § 7 (Data governance & GDPR) + [`docs/AUDIT.md`](../AUDIT.md) GDPR Art. 30 cross-reference |
| `SLO.md` | [`docs/HANDOFF.md`](../HANDOFF.md) § 8 (SRE — SLOs, runbooks, on-call) — runbooks materialised |
| `A11Y.md` | [`docs/HANDOFF.md`](../HANDOFF.md) § 9.6 (Stanca / WCAG) + [`docs/REMEDIATION.md`](../REMEDIATION.md) R-A11Y-AUDIT-001 |

## Why these are preserved

The legacy files are kept under `docs/legacy/` rather than deleted because:

1. **Diff-against-supersession.** Reviewers can trace which content from each legacy file landed where in the new four-document set.
2. **Historical reference.** Some legacy text (decree citations verified against the canonical sources at the time of writing) may be useful as a baseline for future revisions.
3. **Customer transparency.** A customer engagement that began before the documentation overhaul can still reference the legacy files via `docs/legacy/...` until their next review point.

## When these files will be deleted

These files are **expected to be deleted** after one quarterly review cycle (≈ 2026-08-01) confirms that no operational dependency on them remains.

The deletion is a user-initiated action (Renan, after sign-off). Until deletion, this directory stays in the repository but is not referenced by the canonical four-document set except via this README.

## What `openapi.yaml` is doing in `docs/` (not here)

`docs/openapi.yaml` is **not** a legacy document. It is the machine-readable API specification, generated/maintained alongside the code, and is the canonical source for API contract. [`docs/HANDOFF.md`](../HANDOFF.md) § 6 is the prose companion. The two are kept in sync per HANDOFF doctrine **H-4**.

---

**Made in Mozzecane (VR) — Veneto, Italy.**
