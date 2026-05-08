# Postmortems

Per-incident postmortem records for FactoryMind. Doctrine **H-17** requires a blameless postmortem for every P1 / P2 incident, filed within 5 business days of resolution.

## Layout

```
docs/postmortems/
  README.md             # this file
  _template.md          # the doctrine-compliant template (R-RUNBOOK-PM-001)
  <YYYY-MM-DD>-<incident-tag>.md   # one file per incident
```

## Filing a postmortem

```bash
cp docs/postmortems/_template.md \
   docs/postmortems/$(date -u +%Y-%m-%d)-<incident-tag>.md
$EDITOR docs/postmortems/<that-file>
```

Fill every section. Action items must each link to a [`REMEDIATION.md`](../REMEDIATION.md) ticket — that's the doctrinal backstop that converts incident lessons into engineering work.

## Doctrine constraints

- **H-17** (blameless): the timeline names events and decisions, NOT individuals as causes. "The deploy at 14:32 introduced a config drift" is correct framing; "X deployed config drift at 14:32" is not.
- **R-14** (review by non-implementer): the postmortem is reviewed by an engineer who was NOT on-call for the incident — the sign-off line at the end of the template enforces this with two named slots.
- **A-12** (cadence review): postmortems are reviewed quarterly as a class to identify recurring failure modes — the recurring-modes summary lands in [`AUDIT.md`](../AUDIT.md) § 9 each quarter.

## Severity → response

| Severity | Customer impact | Postmortem required? | SLA |
|---|---|---|---|
| P1 | Service down or data loss | Yes (blameless, full template) | Within 5 business days |
| P2 | Degraded but recoverable | Yes (full template) | Within 10 business days |
| P3 | Customer-visible bug, no service impact | Optional (use judgement; required if recurring) | — |

The severity classification matches HANDOFF § 8.1 SLI / SLO definitions; cross-references with the contractual SLA in `legal/CONTRATTO-SAAS-B2B.md` art. 6 determine the customer-facing notification deadline.
