#!/usr/bin/env bash
# =============================================================================
# scripts/erase-subject.sh — GDPR Art. 17 erasure (operator).
#
# Usage:
#   scripts/erase-subject.sh --email <addr> --reason <text>
#   scripts/erase-subject.sh --email <addr> --reason <text> --finalize
#
# By default this triggers the SOFT-DELETE: the user account is
# deactivated, all refresh tokens revoked, and a hard-delete is
# scheduled in 30 days (handled by factorymind_housekeeping() in
# Postgres). During the 30-day grace the deletion can be reversed by
# direct DBA action — that's the legal/contractual buffer documented in
# HANDOFF § 7.3 (legal/CONTRATTO-SAAS-B2B.md art. 11).
#
# --finalize forces an immediate sweep of all expired soft-deletes
# (including this one if --grace-days was overridden to 0). Use only
# when explicitly authorised — once finalize runs, the data is gone.
#
# Required confirmation: the operator must type the verbatim string
# `CANCELLA <email>` (or set FM_NON_INTERACTIVE=1 explicitly). This
# matches the route-level confirmation pattern in
# backend/src/routes/users.js DELETE /me to keep the operator path no
# weaker than the user path.
#
# Closes AUDIT finding F-HIGH-006 / R-GDPR-001.
# =============================================================================
set -Eeuo pipefail
IFS=$'\n\t'

EMAIL=""
REASON=""
FINALIZE=0
CONTAINER="${FM_BACKEND_CONTAINER:-factorymind-backend}"
NON_INTERACTIVE="${FM_NON_INTERACTIVE:-0}"

usage() {
  cat <<USAGE
Usage: $0 --email <addr> --reason <text> [--finalize] [--container <name>]

Required:
  --email <addr>       Subject's email address (case-insensitive lookup).
  --reason <text>      Documented reason recorded in audit_log.

Optional:
  --finalize           Skip 30-day grace; hard-delete now (irreversible).
                       Requires explicit operator confirmation.
  --container <name>   Docker container name (default: factorymind-backend
                       or env FM_BACKEND_CONTAINER).
  -h, --help           Show this help.

Environment:
  FM_NON_INTERACTIVE=1 Skip the typed-confirmation prompt (useful for
                       audited automation; the audit_log row carries
                       the env var so the bypass is recorded).

Examples:
  # Standard erasure: soft-delete + 30-day grace
  $0 --email mario.rossi@example.it \\
     --reason "Subject request 2026-05-07, ticket #FM-42"

  # Force-finalize an account whose grace has already passed
  $0 --email old@example.com --reason "GDPR sweep" --finalize

After completion, scripts/export-subject.sh on the same email returns
SUBJECT_NOT_FOUND once the hard-delete has been executed (immediately
with --finalize, after 30 days otherwise).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)     EMAIL="${2:-}"; shift 2 ;;
    --reason)    REASON="${2:-}"; shift 2 ;;
    --finalize)  FINALIZE=1; shift ;;
    --container) CONTAINER="${2:-}"; shift 2 ;;
    -h|--help)   usage; exit 0 ;;
    *)           printf '%s: argument sconosciuto: %s\n' "$0" "$1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$EMAIL" || -z "$REASON" ]]; then
  printf '%s: --email e --reason sono obbligatori\n' "$0" >&2
  usage >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  printf '%s: docker non trovato sul PATH\n' "$0" >&2
  exit 1
fi
if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -qx 'true'; then
  printf '%s: container "%s" non in esecuzione (lanci ./install.sh)\n' "$0" "$CONTAINER" >&2
  exit 1
fi

if [[ "$NON_INTERACTIVE" != "1" ]]; then
  EXPECTED="CANCELLA $EMAIL"
  printf '\nATTENZIONE: cancellazione GDPR per: %s\n' "$EMAIL"
  printf 'Motivo: %s\n' "$REASON"
  if [[ "$FINALIZE" == "1" ]]; then
    printf 'MODE: --finalize → hard-delete IMMEDIATO (irreversibile).\n'
  else
    printf 'MODE: soft-delete + 30 giorni di grazia.\n'
  fi
  printf 'Per confermare digiti esattamente: %s\n> ' "$EXPECTED"
  read -r CONFIRM
  if [[ "$CONFIRM" != "$EXPECTED" ]]; then
    printf '%s: conferma non corrispondente, cancellazione annullata\n' "$0" >&2
    exit 64
  fi
fi

docker exec \
  -e FM_SUBJECT_EMAIL="$EMAIL" \
  -e FM_REASON="$REASON" \
  -e FM_FINALIZE="$FINALIZE" \
  -e FM_NON_INTERACTIVE="$NON_INTERACTIVE" \
  "$CONTAINER" node -e '
    const gdpr = require("/app/src/services/gdpr");
    const { pool } = require("/app/src/db/pool");
    (async () => {
      try {
        const result = await gdpr.eraseSubject(pool, {
          email: process.env.FM_SUBJECT_EMAIL,
          reason: process.env.FM_REASON
        });
        process.stdout.write(JSON.stringify({ stage: "soft_delete", ...result, non_interactive: process.env.FM_NON_INTERACTIVE === "1" }, null, 2));
        process.stdout.write("\n");

        if (process.env.FM_FINALIZE === "1") {
          const fin = await gdpr.finalizeErasures(pool, { now: new Date(Date.now() + 31 * 86400000) });
          process.stdout.write(JSON.stringify({ stage: "finalize", ...fin }, null, 2));
          process.stdout.write("\n");
        }
      } catch (err) {
        if (err.code === "ALREADY_ERASED") {
          process.stdout.write(JSON.stringify({ stage: "noop", reason: "already_erased", email: process.env.FM_SUBJECT_EMAIL }, null, 2));
          process.stdout.write("\n");
          process.exit(0);
        }
        process.stderr.write(`[erase-subject] ${err.code || err.name}: ${err.message}\n`);
        process.exit(err.code === "SUBJECT_NOT_FOUND" ? 64 : 1);
      } finally {
        try { await pool.end(); } catch (_) { /* ignore */ }
      }
    })();
  '
