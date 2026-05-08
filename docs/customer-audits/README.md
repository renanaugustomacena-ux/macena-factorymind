# Customer audits

Written responses to customer security questionnaires, archived per audit instance. The directory is the evidence trail referenced from procurement contacts back to the four-document set.

## Layout

```
docs/customer-audits/
  README.md             # this file
  _template.md          # canonical response shape (R-CUSTOMER-AUDIT-DIR-001)
  <YYYY-MM-DD>-<customer-slug>.md   # one file per audit instance
```

## Process per audit

```bash
cp docs/customer-audits/_template.md \
   docs/customer-audits/$(date -u +%Y-%m-%d)-<customer-slug>.md
$EDITOR docs/customer-audits/<that-file>
```

Fill the metadata block. Preserve the customer's question numbering verbatim in the response matrix. Each row's "Evidence" column links to canonical sources in this repo:

- [`../HANDOFF.md`](../HANDOFF.md) — operational architecture, doctrine, runbooks, compliance baseline
- [`../REMEDIATION.md`](../REMEDIATION.md) — open / closed remediation tickets
- [`../AUDIT.md`](../AUDIT.md) — full-sweep findings catalogue with file:line evidence
- `../../legal/` — contractual templates, privacy notices, DPA, TIA

Counsel review is mandatory before sending to the customer when GDPR / NIS2 / CRA scope is touched. The sign-off block at the end of `_template.md` enforces three signatures: FactoryMind author, counsel, customer.

## Common questionnaire frameworks

- **CAIQ Lite** (Cloud Security Alliance) — most common; ~40 questions
- **ENISA SaaS questionnaire** — EU-flavoured; preferred by larger Italian / EU customers
- **Custom procurement checklist** — Tier-3 / Tier-4 enterprise customers usually have their own; preserve their numbering

## Doctrine constraints

- **H-16** — the perizia tecnica giurata stays with the customer's perito. Every audit response with a Piano 4.0 / 5.0 question MUST surface this in the out-of-scope or compensating-controls section. Do NOT promise to deliver the perizia.
- **A-12** — annual cadence review. Audit responses older than 12 months are stale and must be re-validated against current state before re-sending.
- **H-22** — the audit folder is reviewed quarterly for stale rows.

## Reuse

Every audit response is also a regression test against the four-document set: if a question can't be answered with a canonical link, that's a doc-coverage gap worth filing as a [`REMEDIATION.md`](../REMEDIATION.md) ticket. The "Open follow-ups" section of `_template.md` is where those gaps surface.
