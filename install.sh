#!/usr/bin/env bash
# =============================================================================
# FactoryMind — installer non-tecnico per PMI italiane.
#
# Porta online l'intero stack (Postgres + InfluxDB + Mosquitto + backend +
# frontend + Grafana + simulatore) in circa 10 minuti su una macchina pulita
# Linux o macOS. Richiede Docker (viene installato se mancante su Linux).
#
# Uso:
#     bash install.sh               # interattivo
#     FM_UNATTENDED=1 bash install.sh   # modalità automazione (preset via env)
#
# L'installer è idempotente: può essere rilanciato senza perdere dati.
# =============================================================================
set -Eeuo pipefail
IFS=$'\n\t'

# ---------------------------------------------------------------------------
# Colori leggibili + fallback sicuro se stdout non è TTY.
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
  C_GREEN=$'\033[0;32m'
  C_YELLOW=$'\033[0;33m'
  C_RED=$'\033[0;31m'
  C_CYAN=$'\033[0;36m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RESET=$'\033[0m'
else
  C_GREEN='' C_YELLOW='' C_RED='' C_CYAN='' C_BOLD='' C_DIM='' C_RESET=''
fi

log()  { printf '%s%s%s\n' "${C_CYAN}${C_BOLD}" "[factorymind] " "${C_RESET}${1-}"; }
ok()   { printf '%s%s%s\n' "${C_GREEN}${C_BOLD}" "[OK] "            "${C_RESET}${1-}"; }
warn() { printf '%s%s%s\n' "${C_YELLOW}${C_BOLD}" "[ATTENZIONE] "   "${C_RESET}${1-}" >&2; }
die()  { printf '%s%s%s\n' "${C_RED}${C_BOLD}"    "[ERRORE] "        "${C_RESET}${1-}" >&2; exit 1; }
trap 'die "Installazione interrotta alla riga $LINENO. Controlli l'\''output sopra."' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log "FactoryMind — installer guidato"
log "Cartella di installazione: $SCRIPT_DIR"

# ---------------------------------------------------------------------------
# 1. Detect OS — rifiutiamo Windows senza WSL2.
# ---------------------------------------------------------------------------
OS_RAW="$(uname -s)"
case "$OS_RAW" in
  Linux)   OS="linux" ;;
  Darwin)  OS="macos" ;;
  MINGW*|MSYS*|CYGWIN*)
    die "Sistema Windows rilevato. L'installer supporta Linux e macOS. Su Windows installi WSL2 (istruzioni: https://learn.microsoft.com/it-it/windows/wsl/install) ed esegua questo script all'interno di una distro Linux."
    ;;
  *) die "Sistema operativo non supportato: $OS_RAW" ;;
esac
ok "Sistema operativo rilevato: $OS"

# ---------------------------------------------------------------------------
# 2. Dipendenze minime: Docker + Docker Compose plugin + openssl + curl.
# ---------------------------------------------------------------------------
need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Comando richiesto non trovato: $1"
}

for cmd in uname awk sed grep tr cut; do need_cmd "$cmd"; done

if ! command -v docker >/dev/null 2>&1; then
  warn "Docker non è installato."
  if [[ "$OS" == "linux" ]]; then
    read -r -p "Installare Docker ora via script ufficiale (richiede sudo)? [s/N] " REPLY
    if [[ "$REPLY" =~ ^[sS] ]]; then
      log "Installo Docker (get.docker.com)..."
      if ! curl -fsSL https://get.docker.com -o /tmp/get-docker.sh; then
        die "Download installer Docker fallito."
      fi
      sudo sh /tmp/get-docker.sh
      sudo usermod -aG docker "$USER" || true
      warn "Per usare docker senza sudo deve fare logout/login oppure eseguire: newgrp docker"
    else
      die "Docker è necessario. Installi manualmente da https://docs.docker.com/engine/install/ e rilanci."
    fi
  else
    die "Docker Desktop è necessario. Installi da https://docs.docker.com/desktop/install/mac-install/ e rilanci."
  fi
fi

if ! docker compose version >/dev/null 2>&1; then
  die "Docker Compose v2 non disponibile. Aggiorni Docker (deve includere il plugin 'compose')."
fi

for cmd in openssl curl; do need_cmd "$cmd"; done
ok "Docker, Docker Compose, openssl, curl: tutti presenti."

# ---------------------------------------------------------------------------
# 3. Prompt interattivi (saltati se FM_UNATTENDED=1).
# ---------------------------------------------------------------------------
prompt() {
  local var="$1" default="$2" question="$3"
  local existing="${!var-}"
  if [[ -n "${existing:-}" ]]; then
    log "$var preso da variabile ambiente."
    return 0
  fi
  if [[ "${FM_UNATTENDED:-0}" == "1" ]]; then
    printf -v "$var" '%s' "$default"
    return 0
  fi
  local input
  read -r -p "$question [$default]: " input
  printf -v "$var" '%s' "${input:-$default}"
}

prompt_secret() {
  local var="$1" question="$2" min_len="${3:-12}"
  if [[ -n "${!var-}" ]]; then
    log "$var preso da variabile ambiente."
    return 0
  fi
  if [[ "${FM_UNATTENDED:-0}" == "1" ]]; then
    local generated
    generated="$(openssl rand -base64 18 | tr -d '=+/' | cut -c1-20)"
    printf -v "$var" '%s' "$generated"
    warn "Password $var generata automaticamente (modalità non presidiata): ${!var}"
    return 0
  fi
  while true; do
    local a b
    read -r -s -p "$question: " a; echo
    read -r -s -p "Conferma: " b; echo
    if [[ "$a" != "$b" ]]; then warn "Le due password non coincidono. Riprovi."; continue; fi
    if [[ ${#a} -lt $min_len ]]; then warn "La password deve avere almeno $min_len caratteri."; continue; fi
    printf -v "$var" '%s' "$a"
    break
  done
}

log "Ora le farò alcune domande per configurare l'installazione."
log "Tutti i valori hanno un default ragionevole (tra parentesi quadre): prema Invio per accettarlo."
echo

prompt FM_FACILITY_ID "mozzecane" "Identificativo breve dello stabilimento (solo lettere/numeri/trattini)"
if ! [[ "$FM_FACILITY_ID" =~ ^[a-z0-9-]{2,40}$ ]]; then
  die "Identificativo non valido: usi solo minuscole, cifre o trattini (2-40 caratteri)."
fi
prompt FM_FACILITY_NAME "Stabilimento di Mozzecane"      "Nome esteso della fabbrica"
prompt FM_LINES         "2"                               "Numero linee produttive"
prompt FM_MACHINES_PER_LINE "4"                           "Numero macchine per linea"
prompt FM_ADMIN_EMAIL   "admin@$(echo "$FM_FACILITY_ID" | tr -d -c '[:alnum:]').factorymind.local" \
                        "Email amministratore della dashboard"
prompt_secret FM_ADMIN_PASSWORD "Password admin (minimo 12 caratteri, due prompt)"
prompt FM_SMTP_URL      ""                                "SMTP URL (opzionale, formato smtps://user:pass@host:port — Invio per saltare)"
prompt FM_PUBLIC_BASE_URL "http://localhost" "URL pubblico della dashboard (se in LAN, es. http://192.168.1.50)"

echo
log "Riepilogo configurazione:"
printf '  Stabilimento: %s (%s)\n' "$FM_FACILITY_NAME" "$FM_FACILITY_ID"
printf '  Linee: %s   Macchine/linea: %s\n' "$FM_LINES" "$FM_MACHINES_PER_LINE"
printf '  Email admin: %s\n' "$FM_ADMIN_EMAIL"
printf '  URL pubblico: %s\n' "$FM_PUBLIC_BASE_URL"
if [[ "${FM_UNATTENDED:-0}" != "1" ]]; then
  read -r -p "Confermi e procedo? [S/n] " REPLY
  [[ "${REPLY,,}" =~ ^(s|sì|si|y|yes|)$ ]] || die "Installazione annullata dall'utente."
fi

# ---------------------------------------------------------------------------
# 4. Genera segreti robusti.
# ---------------------------------------------------------------------------
rand_hex() { openssl rand -hex "$1"; }
rand_b64() { openssl rand -base64 "$1" | tr -d '=+/' | cut -c1-"$2"; }

JWT_SECRET="$(rand_hex 32)"
INFLUX_TOKEN="$(rand_hex 32)"
POSTGRES_PASSWORD="$(rand_b64 24 24)"
INFLUX_ADMIN_PASSWORD="$(rand_b64 24 20)"
MQTT_PASSWORD="$(rand_b64 24 20)"
GRAFANA_ADMIN_PASSWORD="$(rand_b64 24 20)"

# Hash scrypt della password admin (salt random).
# Formato: scrypt$<salt_base64>$<hash_base64>.
# Verrà letto da backend/services/admin-bootstrap.js al prossimo boot e
# usato per upsert di un admin reale con queste credenziali, disattivando
# contemporaneamente il seed demo con password fissa di default.
log "Calcolo hash scrypt della password admin..."
ADMIN_PASSWORD_HASH="$(
  node -e '
    const crypto = require("crypto");
    const pwd = process.argv[1];
    if (!pwd || pwd.length < 12) {
      process.stderr.write("password troppo corta per hash robusto\n");
      process.exit(1);
    }
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(pwd, salt, 64, { N: 16384, r: 8, p: 1 });
    process.stdout.write("scrypt$" + salt.toString("base64") + "$" + key.toString("base64"));
  ' "$FM_ADMIN_PASSWORD"
)" || die "Calcolo hash password fallito."
ok "Hash password admin generato (scrypt N=16384 r=8 p=1 keylen=64)."

# ---------------------------------------------------------------------------
# 5. Scrivi .env (backup se già esiste).
# ---------------------------------------------------------------------------
if [[ -f .env ]]; then
  BACKUP=".env.backup.$(date +%Y%m%dT%H%M%S)"
  cp .env "$BACKUP"
  warn ".env esistente copiato in $BACKUP"
fi

[[ -f .env.example ]] || die ".env.example non trovato, repository incompleto."

umask 077
sed_replace() {
  # sed portatile tra GNU e BSD (macOS)
  local key="$1" val="$2"
  # Escape per sed: & \ / + newline
  val="${val//\\/\\\\}"; val="${val//\//\\/}"; val="${val//&/\\&}"
  if [[ "$OS" == "macos" ]]; then
    sed -i '' -E "s/^${key}=.*/${key}=${val}/" .env
  else
    sed -i -E "s/^${key}=.*/${key}=${val}/" .env
  fi
}

cp .env.example .env
sed_replace JWT_SECRET                     "$JWT_SECRET"
sed_replace INFLUX_TOKEN                   "$INFLUX_TOKEN"
sed_replace DOCKER_INFLUXDB_INIT_ADMIN_TOKEN "$INFLUX_TOKEN"
sed_replace POSTGRES_PASSWORD              "$POSTGRES_PASSWORD"
sed_replace DATABASE_URL \
  "postgresql://factorymind:${POSTGRES_PASSWORD}@factorymind-postgres:5432/factorymind"
sed_replace DOCKER_INFLUXDB_INIT_PASSWORD  "$INFLUX_ADMIN_PASSWORD"
sed_replace MQTT_PASSWORD                  "$MQTT_PASSWORD"
sed_replace GRAFANA_ADMIN_PASSWORD         "$GRAFANA_ADMIN_PASSWORD"
sed_replace SIM_FACILITY                   "$FM_FACILITY_ID"
sed_replace SIM_LINES                      "$FM_LINES"
sed_replace SIM_MACHINES_PER_LINE          "$FM_MACHINES_PER_LINE"
sed_replace VITE_DEFAULT_FACILITY          "$FM_FACILITY_ID"
if [[ -n "$FM_SMTP_URL" ]]; then
  sed_replace SMTP_URL "$FM_SMTP_URL"
fi

# Variabili non presenti nel template: le appendiamo (idempotente).
append_if_missing() {
  local key="$1" val="$2"
  if ! grep -q "^${key}=" .env; then
    printf '%s=%s\n' "$key" "$val" >> .env
  fi
}
append_if_missing FM_FACILITY_NAME       "$FM_FACILITY_NAME"
append_if_missing FM_ADMIN_EMAIL         "$FM_ADMIN_EMAIL"
append_if_missing FM_ADMIN_PASSWORD_HASH "$ADMIN_PASSWORD_HASH"
append_if_missing FM_PUBLIC_BASE_URL     "$FM_PUBLIC_BASE_URL"

chmod 600 .env
ok "File .env scritto con permessi 600 (solo l'utente corrente lo legge)."

# ---------------------------------------------------------------------------
# 6. Provisiona il password file Mosquitto (R-MQTT-ANON-001 / F-CRIT-001).
#
# allow_anonymous=false in mosquitto.conf richiede /mosquitto/config/passwd.
# Lo generiamo via container effimero usando mosquitto_passwd dell'immagine
# ufficiale, evitando di richiedere il pacchetto mosquitto-clients sull'host.
# La rigenerazione avviene a ogni install.sh — coerente con la rigenerazione
# di .env. I client MQTT (backend, simulatore) leggono la stessa password
# da MQTT_USERNAME=backend / MQTT_PASSWORD nel .env.
# ---------------------------------------------------------------------------
log "Provisiono Mosquitto password file..."
MQTT_USERNAME="${MQTT_USERNAME:-backend}"
sed_replace MQTT_USERNAME "$MQTT_USERNAME"
PASSWD_PATH="$SCRIPT_DIR/mosquitto/config/passwd"
rm -f "$PASSWD_PATH"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$SCRIPT_DIR/mosquitto/config:/conf" \
  -e MQTT_USERNAME="$MQTT_USERNAME" \
  -e MQTT_PASSWORD="$MQTT_PASSWORD" \
  eclipse-mosquitto:2 \
  sh -c 'mosquitto_passwd -b -c /conf/passwd "$MQTT_USERNAME" "$MQTT_PASSWORD"' \
  || die "Generazione mosquitto/config/passwd fallita."
chmod 640 "$PASSWD_PATH" 2>/dev/null || true
ok "Password file Mosquitto generato (utente=$MQTT_USERNAME)."

# ---------------------------------------------------------------------------
# 7. Avvia lo stack.
# ---------------------------------------------------------------------------
log "Costruzione immagini e avvio container (può richiedere 5-8 minuti la prima volta)..."
docker compose up -d --build

# ---------------------------------------------------------------------------
# 8. Attesa health del backend.
# ---------------------------------------------------------------------------
log "Attendo che il backend diventi sano (timeout 180s)..."
HEALTH_URL="http://localhost:3002/api/health"
for i in $(seq 1 60); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    STATUS="$(curl -fsS "$HEALTH_URL" | awk -F'"' '/"status"/{print $4; exit}')"
    if [[ "$STATUS" == "ok" ]]; then
      ok "Backend sano (status=ok) dopo $((i*3)) secondi."
      break
    fi
  fi
  sleep 3
  if [[ $i -eq 60 ]]; then
    warn "Backend non ha raggiunto 'ok' entro 180s. Controlli i log con:"
    warn "    docker compose logs -f factorymind-backend"
    break
  fi
done

# ---------------------------------------------------------------------------
# 9. Riepilogo finale.
# ---------------------------------------------------------------------------
cat <<EOF

${C_GREEN}${C_BOLD}========================================================================${C_RESET}
${C_GREEN}${C_BOLD}  Installazione completata${C_RESET}
${C_GREEN}${C_BOLD}========================================================================${C_RESET}

  Dashboard operatori   : ${FM_PUBLIC_BASE_URL}:5173
  API backend (health)  : ${FM_PUBLIC_BASE_URL}:3002/api/health
  Grafana (monitoring)  : ${FM_PUBLIC_BASE_URL}:3000

  Credenziali Grafana
    utente   : admin
    password : ${GRAFANA_ADMIN_PASSWORD}

  Credenziali admin dashboard
    email    : ${FM_ADMIN_EMAIL}
    password : (quella che ha inserito)

${C_YELLOW}${C_BOLD}Prossimi passi:${C_RESET}
  1. Apra la dashboard dall'indirizzo sopra e faccia login.
  2. Per spegnere temporaneamente: ${C_DIM}docker compose stop${C_RESET}
  3. Per ripartire:                 ${C_DIM}docker compose start${C_RESET}
  4. Per aggiornare il software:    ${C_DIM}git pull && docker compose up -d --build${C_RESET}
  5. Per vedere i log in tempo reale: ${C_DIM}docker compose logs -f${C_RESET}

Il file ${C_BOLD}.env${C_RESET} contiene tutti i segreti generati. Lo conservi al sicuro
(copia cifrata su chiavetta USB o password manager aziendale).

EOF
