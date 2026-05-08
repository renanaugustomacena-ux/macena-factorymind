# Runbooks

Operational runbook templates and instances for FactoryMind production cutovers, incidents, and recurring drills.

## Layout

```
docs/runbooks/
  README.md                          # this file
  deployment-log-template.md         # H-12 ceremony: 12-checkpoint cutover log (R-RUNBOOK-DEPLOY-001)
```

The other runbooks (alert response, postmortem template, DR failover, OTel sampling configuration) live INLINE inside [`HANDOFF.md`](../HANDOFF.md) § 8 — that is intentional, not pending migration. Doctrine **H-9** treats the four-document set as the canonical operations surface; per-incident artifacts (filled-in deployment logs, postmortems, customer audits) live in this directory + sibling directories (`../postmortems/`, `../customer-audits/`) once instantiated.

## Deployment-log

`deployment-log-template.md` is the H-12 ceremony artefact. Copy at cutover time:

```bash
cp docs/runbooks/deployment-log-template.md \
   docs/deployment-logs/$(date -u +%Y-%m-%d)-<customer-slug>.md
```

Then walk the 12 checkpoints in order. Each checkpoint MUST be initialled by the named witness with a UTC timestamp before the next can start. The customer's `responsabile IT` signs the acceptance form at the end — without that signature the cutover is not complete.

The 12 checkpoints summarized:

1. Secrets in vault (not `.env`)
2. DB migration applied + verified
3. Broker TLS verified (production CA, not install.sh dev CA)
4. MQTT credentials provisioned
5. ACL file deployed
6. Influx bucket + 3 downsampling tasks present
7. First machine telemetry visible in Grafana within 5 min
8. First attestazione PDF rendered (the load-bearing deliverable per H-16)
9. Audit log writing verified
10. Backup job runs
11. Restore drill runs (also seeds R-DR-DRILL-001 first drill)
12. Customer responsabile IT signs acceptance form

See `deployment-log-template.md` for full procedure detail per checkpoint.

## Where the other runbooks live

| Topic | Location |
|---|---|
| Alert response (8 rules) | [`HANDOFF.md`](../HANDOFF.md) §§ 8.3–8.10 |
| DR failover (eu-south-1 → eu-central-1) | [`HANDOFF.md`](../HANDOFF.md) § 8.11 |
| OTel sampling per tier | [`HANDOFF.md`](../HANDOFF.md) § 8.12 |
| Postmortem template (operational copy) | [`../postmortems/_template.md`](../postmortems/_template.md) |
| Customer audit response template | [`../customer-audits/_template.md`](../customer-audits/_template.md) |

The doctrine **H-22** quarterly review covers all of the above.
