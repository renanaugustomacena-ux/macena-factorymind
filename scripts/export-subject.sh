#!/usr/bin/env bash
# =============================================================================
# scripts/export-subject.sh — GDPR Art. 15 + 20 portability dump (operator).
#
# Usage:
#   scripts/export-subject.sh --email <subject-email>
#   scripts/export-subject.sh --email <subject-email> --output dump.json
#
# When the subject is reachable through the dashboard, prefer the
# self-service endpoint GET /api/users/me/export — this script is the
# operator-driven fallback for: (a) Garante-mandated requests via legal
# counsel, (b) deceased users (heirs requesting), (c) users whose
# password is unrecoverable, (d) compromised accounts under
# incident-response erasure plus pre-erasure portability dump.
#
# The dump is the same shape produced by /api/users/me/export — see
# backend/src/services/gdpr.js exportSubject() for the canonical schema.
#
# The script invokes the running `factorymind-backend` container; the
# stack must be up (i.e., install.sh has been run). For an offline DB
# dump (e.g., during a recovery scenario where the API is down), see
# the manual procedure in HANDOFF § 7.3.
#
# Closes AUDIT finding F-HIGH-006 / R-GDPR-001.
# =============================================================================
set -Eeuo pipefail
IFS=$'\n\t'

EMAIL=""
OUTPUT=""
CONTAINER="${FM_BACKEND_CONTAINER:-factorymind-backend}"

usage() {
  cat <<USAGE
Usage: $0 --email <subject-email> [--output <file>] [--container <name>]

Required:
  --email <addr>       Subject's email address (case-insensitive lookup).

Optional:
  --output <file>      Write JSON dump to file (default: stdout).
  --container <name>   Docker container name (default: factorymind-backend
                       or env FM_BACKEND_CONTAINER).
  -h, --help           Show this help.

Examples:
  # Print to stdout
  $0 --email mario.rossi@example.it

  # Save with timestamp
  $0 --email mario.rossi@example.it \\
     --output "exports/\$(date +%Y%m%dT%H%M%S)_mario.json"

The output is a UTF-8 JSON document conforming to
backend/src/services/gdpr.js exportSubject() schema (export_format_version: 1.0).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)     EMAIL="${2:-}"; shift 2 ;;
    --output)    OUTPUT="${2:-}"; shift 2 ;;
    --container) CONTAINER="${2:-}"; shift 2 ;;
    -h|--help)   usage; exit 0 ;;
    *)           printf '%s: argument sconosciuto: %s\n' "$0" "$1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$EMAIL" ]]; then
  printf '%s: --email è obbligatorio\n' "$0" >&2
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

# The Node script reads the email from FM_SUBJECT_EMAIL inside the container,
# requires the gdpr service module, and prints the JSON to stdout. Errors are
# raised with non-zero exit so this script's set -e propagates them.
DUMP_JSON="$(
  docker exec -e FM_SUBJECT_EMAIL="$EMAIL" "$CONTAINER" node -e '
    const gdpr = require("/app/src/services/gdpr");
    const { pool } = require("/app/src/db/pool");
    (async () => {
      try {
        const out = await gdpr.exportSubject(pool, { email: process.env.FM_SUBJECT_EMAIL });
        process.stdout.write(JSON.stringify(out, null, 2));
        process.stdout.write("\n");
      } catch (err) {
        process.stderr.write(`[export-subject] ${err.code || err.name}: ${err.message}\n`);
        process.exit(err.code === "SUBJECT_NOT_FOUND" ? 64 : 1);
      } finally {
        try { await pool.end(); } catch (_) { /* ignore */ }
      }
    })();
  '
)" || exit $?

if [[ -n "$OUTPUT" ]]; then
  mkdir -p "$(dirname -- "$OUTPUT")"
  printf '%s\n' "$DUMP_JSON" > "$OUTPUT"
  chmod 600 "$OUTPUT"
  printf '[OK] export salvato in %s (modo 600)\n' "$OUTPUT" >&2
else
  printf '%s\n' "$DUMP_JSON"
fi
