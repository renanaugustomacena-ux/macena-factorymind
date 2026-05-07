<!--
Customer audit response template (R-CUSTOMER-AUDIT-DIR-001 closure).

Customers (especially Tier 2/3/4 commercial deployments) periodically run a
security questionnaire against the FactoryMind stack — typically based on
CAIQ Lite, ENISA SaaS questionnaire, or a custom procurement checklist. This
template gives a consistent shape for our written response so future audits
can be answered by reference (not by re-deriving every claim).

Process per audit:
  1. Copy this file to `docs/customer-audits/<YYYY-MM-DD>-<customer-slug>.md`.
  2. Strip this comment block.
  3. Fill the metadata block + table.
  4. Cross-link relevant evidence: HANDOFF § sections, REMEDIATION ticket
     IDs, AUDIT findings, legal/* templates.
  5. Have the response reviewed by counsel before sending to the customer
     (any time GDPR / NIS2 / CRA scope is touched).
  6. Commit (the doc is part of the four-document set's evidence trail).
-->

# Customer audit — `<Customer name>` — `<YYYY-MM-DD>`

## Metadata

- **Customer:** `<Ragione sociale + sede>`
- **Procurement contact:** `<name + email>`
- **Audit framework:** `<CAIQ Lite | ENISA SaaS | custom>`
- **Tier:** `<1 / 2 / 3 / 4>` (per HANDOFF § 1)
- **Submitted by FactoryMind:** `<author>` `<date>`
- **Counsel review:** `<reviewer>` `<date>` (mandatory if GDPR / NIS2 / CRA touched)
- **Customer sign-off:** `<reviewer>` `<date>`

## Scope

`<one paragraph: what the audit covers — full stack vs only backend, single facility vs multi-tenant, production data vs synthetic, etc>`

## Response matrix

The numbering matches the customer's questionnaire. Each row's "Evidence" column links to canonical sources in this repo (HANDOFF / AUDIT / REMEDIATION / legal/) so the customer can self-verify.

| Q# | Question (verbatim) | Status | Evidence |
|---|---|---|---|
| 1.1 | `<verbatim question>` | `<Yes / No / Partial / Compensating>` | `<HANDOFF § X.Y; REMEDIATION ticket R-...; legal/...>` |
| 1.2 | … | … | … |

(Add rows as needed; preserve customer's numbering.)

## Compensating controls (if any "No" or "Partial" above)

For each "No" or "Partial" row, document the compensating control:

- `<Q#>`: `<short description of how the residual risk is bounded>`. Tracking ticket: `<R-... in REMEDIATION>` if work is queued.

## Out-of-scope

- `<List items the customer asked about that fall outside FactoryMind's contractual surface — e.g., the customer's own AD/SSO, the customer's network perimeter, the perizia tecnica giurata which by H-16 stays with the customer's perito>`.

## Open follow-ups

- [ ] `<action>` — owner — by `<date>` — REMEDIATION ticket `<R-...>`

## Sign-off

- FactoryMind: `<author>` `<date>`
- Counsel: `<reviewer>` `<date>`
- Customer: `<reviewer>` `<date>`

---

**Doctrine references.** A-12 (cadence review applies to renewing audit responses each year), H-16 (perizia stays with customer's perito), H-22 (quarterly review of the audit folder for stale rows).
