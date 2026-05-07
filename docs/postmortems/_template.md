<!--
Postmortem template (R-RUNBOOK-PM-001 closure; doctrine H-17).

Mirror of the inline template at HANDOFF § 8.PM, extracted to a standalone
file so the on-call engineer can `cp _template.md <YYYY-MM-DD>-<incident
-tag>.md` without copying out of a markdown code-fence.

Process per incident:
  1. Copy this file to `docs/postmortems/<YYYY-MM-DD>-<incident-tag>.md`
     within 5 business days of resolution.
  2. Strip this comment block.
  3. Fill every section. "Blameless" is the H-17 doctrine: timeline names
     events and decisions, not individuals as causes.
  4. Action items must each link to a REMEDIATION ticket (R-...).
  5. Have a non-implementer review the postmortem (R-14 doctrine: review
     by non-implementer).
  6. Commit. The postmortem is part of the four-document set's evidence
     trail.
-->

# Postmortem — `<incident-tag>` (`<YYYY-MM-DD>`)

## Severity & duration

- Severity: `<P1 / P2 / P3>`
- Detection: `<when>`
- Mitigation: `<when>`
- Resolution: `<when>`
- Total customer impact: `<minutes>`

## Customer impact

`<one paragraph on what customers experienced — be concrete: which features were degraded, which customers (or all), did any data loss occur, did any contractual SLA fire>`

## Timeline (UTC)

- `<HH:MM>` — `<event>`
- `<HH:MM>` — `<event>`
- …

## Root cause

`<one paragraph; blameless; no individuals named as causes. Name the failure mode (e.g., "config drift between staging and prod", "cache invalidation race", "dependency upgrade introduced incompatible default") and the conditions that allowed it to reach prod>`

## What went well

- `<bullet>`
- `<bullet>`

## What went poorly

- `<bullet>`
- `<bullet>`

## Action items

- [ ] `<action>` — owner — by `<date>` — REMEDIATION ticket `<R-...>`
- [ ] …

## Lessons learned

`<one paragraph. What does this incident teach the team about FactoryMind's failure modes? What did the doctrine catch / fail to catch?>`

---

Sign-off: `<author>` — `<date>`
Reviewed by: `<reviewer (non-implementer per R-14)>` — `<date>`
