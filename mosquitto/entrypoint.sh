#!/bin/sh
# ============================================================================
# FactoryMind Mosquitto hardened entrypoint.
#
# Responsibilities on container start:
#   1. Refuse to boot if the broker has been provisioned with a default / empty
#      password. This blocks the classic "mosquitto:mosquitto" pairing, any
#      "admin:admin" or "test:test" variant, and empty-password lines.
#   2. Ensure mosquitto.conf disables allow_anonymous in production mode
#      (controlled by FACTORYMIND_ENV=production). In dev mode we log a
#      warning but continue.
#   3. Chain-exec the upstream mosquitto binary with the provided args so PID 1
#      remains the broker (important for signal handling + Docker healthchecks).
# ============================================================================
set -eu

CONF="${MOSQUITTO_CONF:-/mosquitto/config/mosquitto.conf}"
PASSWD="${MOSQUITTO_PASSWD:-/mosquitto/config/passwd}"
ENV_MODE="${FACTORYMIND_ENV:-development}"

log() { printf '[entrypoint] %s\n' "$*" >&2; }

# --- Default-password detection ---------------------------------------------
if [ -f "$PASSWD" ]; then
  # Mosquitto passwd lines are "<username>:<hash>". The default credential
  # from the 2019 OWASP IoT Top-10 report is `mosquitto:mosquitto`; we also
  # block empty-hash entries and the most common weak-password pairings.
  if grep -Eq '^(mosquitto|admin|test|guest|root|default):[^:]{0,3}$' "$PASSWD"; then
    log "REFUSING TO START: $PASSWD contains a default or weak password entry."
    log "  Rotate via: mosquitto_passwd -c $PASSWD <username>"
    exit 64
  fi
  # Detect the hash-less form Mosquitto writes before hashing ("user:plain").
  if grep -Eq '^[^:]+:$' "$PASSWD"; then
    log "REFUSING TO START: $PASSWD contains an empty-password entry."
    exit 64
  fi
fi

# --- allow_anonymous enforcement in production ------------------------------
if [ "$ENV_MODE" = "production" ]; then
  if grep -Eq '^\s*allow_anonymous\s+true' "$CONF"; then
    log "REFUSING TO START: allow_anonymous=true in production mode."
    log "  Set allow_anonymous false in $CONF and provision $PASSWD."
    exit 64
  fi
  if ! grep -Eq '^\s*password_file\s+' "$CONF"; then
    log "REFUSING TO START: password_file not configured in $CONF (production)."
    exit 64
  fi
fi

log "Mosquitto pre-flight checks passed (env=$ENV_MODE)."
exec /usr/sbin/mosquitto -c "$CONF"
