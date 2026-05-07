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
# Formato `<salt_hex>:<hash_hex>` (vs. `scrypt$<salt_b64>$<hash_b64>`):
# entrambi sono accettati da backend/src/services/admin-bootstrap.js, ma
# il formato hex non contiene `$`, evitando che docker-compose lo
# interpreti come riferimento a variabile in fase di parsing del .env
# (es. `scrypt$AbC...` veniva risolto come variabile $AbC inesistente).
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
    process.stdout.write(salt.toString("hex") + ":" + key.toString("hex"));
  ' "$FM_ADMIN_PASSWORD"
)" || die "Calcolo hash password fallito."
ok "Hash password admin generato (scrypt N=16384 r=8 p=1 keylen=64, hex)."

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
# Generiamo l'hash PBKDF2-SHA512 in Node (formato Mosquitto v2 `$7$...`)
# invece di invocare mosquitto_passwd via docker run, perché:
#   1. Niente dipendenza da `mosquitto-clients` sull'host.
#   2. Niente problema di UID: il file viene scritto direttamente
#      dall'utente che esegue install.sh; il broker (utente `mosquitto`
#      dentro il container) lo legge perché 644.
#   3. Hash ricevibili e verificati 1:1 da Mosquitto (PBKDF2-SHA512,
#      1000 iter, 64-byte salt, 64-byte derived key — formato $7$).
# I client MQTT (backend, simulatore) leggono la stessa password
# da MQTT_USERNAME=backend / MQTT_PASSWORD nel .env.
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# 5b. Genera la PKI di sviluppo (R-MQTT-TLS-001 + R-GRAFANA-PG-TLS-001).
#
# Una sola CA privata firma due certificati di servizio:
#   - mosquitto-server.crt  (CN=factorymind-mosquitto, SAN per i nomi
#                            che il backend e il simulatore usano in
#                            docker-compose + 'localhost' per il test
#                            esterno con `openssl s_client`).
#   - postgres-server.crt   (CN=factorymind-postgres).
#
# La CA non è una vera CA: è autofirmata, valida 825 giorni, è il
# trust-anchor del solo deployment dev. PRODUZIONE: sostituire i tre
# file in mosquitto/certs/ + postgres/certs/ con cert firmati da una CA
# riconosciuta (Let's Encrypt via cert-manager su k8s, o cert dei vostri
# fornitori). Il path di sostituzione è documentato in HANDOFF § 5.
# ---------------------------------------------------------------------------
log "Genero PKI dev (CA + cert mosquitto + cert postgres)..."
CERT_DIR_MOSQ="$SCRIPT_DIR/mosquitto/certs"
CERT_DIR_PG="$SCRIPT_DIR/postgres/certs"
mkdir -p "$CERT_DIR_MOSQ" "$CERT_DIR_PG"

if [[ ! -f "$CERT_DIR_MOSQ/ca.crt" ]] || [[ ! -f "$CERT_DIR_MOSQ/server.crt" ]] || [[ ! -f "$CERT_DIR_PG/server.crt" ]]; then
  CA_KEY="$(mktemp)"; CA_CRT="$(mktemp)"; SRV_KEY="$(mktemp)"; SRV_CSR="$(mktemp)"; SRV_CRT="$(mktemp)"
  trap 'rm -f "$CA_KEY" "$CA_CRT" "$SRV_KEY" "$SRV_CSR" "$SRV_CRT"' EXIT

  # CA root (ECDSA P-256: piccola, supportata ovunque, 825 giorni).
  openssl ecparam -name prime256v1 -genkey -noout -out "$CA_KEY" 2>/dev/null
  openssl req -new -x509 -days 825 -key "$CA_KEY" -out "$CA_CRT" \
    -subj "/C=IT/ST=Veneto/L=Mozzecane/O=FactoryMind Dev CA/CN=FactoryMind Dev Root CA" \
    -addext "basicConstraints=critical,CA:true" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null

  # Helper: firma un cert server con SAN multipli.
  sign_server_cert() {
    local out_dir="$1" cn="$2" san="$3"
    openssl ecparam -name prime256v1 -genkey -noout -out "$SRV_KEY" 2>/dev/null
    openssl req -new -key "$SRV_KEY" -out "$SRV_CSR" \
      -subj "/C=IT/ST=Veneto/L=Mozzecane/O=FactoryMind Dev/CN=$cn" 2>/dev/null
    openssl x509 -req -in "$SRV_CSR" -CA "$CA_CRT" -CAkey "$CA_KEY" -CAcreateserial \
      -out "$SRV_CRT" -days 825 -sha256 \
      -extfile <(printf 'subjectAltName=%s\nextendedKeyUsage=serverAuth\nkeyUsage=critical,digitalSignature,keyEncipherment\n' "$san") \
      2>/dev/null
    cp "$CA_CRT"  "$out_dir/ca.crt"
    cp "$SRV_KEY" "$out_dir/server.key"
    cp "$SRV_CRT" "$out_dir/server.crt"
  }

  sign_server_cert "$CERT_DIR_MOSQ" \
    "factorymind-mosquitto" \
    "DNS:factorymind-mosquitto,DNS:localhost,IP:127.0.0.1"
  sign_server_cert "$CERT_DIR_PG" \
    "factorymind-postgres" \
    "DNS:factorymind-postgres,DNS:localhost,IP:127.0.0.1"

  # Permessi: i container Mosquitto (utente `mosquitto`) e Postgres
  # (utente `postgres`) leggono i file con UID diverso da quello host.
  # Per il dev (CA usa-e-getta) la chiave viene resa world-readable; il
  # wrapper docker-compose Postgres copia poi la chiave in un percorso
  # interno al container e la chmod 600 ad UID corretto, soddisfacendo
  # la verifica di Postgres a runtime. PRODUZIONE: la chiave non viene
  # mai world-readable — la sostituzione PKI documentata in HANDOFF § 5
  # adotta cert-manager o equivalente e la chiave resta in un volume
  # dedicato leggibile solo dal servizio.
  chmod 755 "$CERT_DIR_MOSQ" "$CERT_DIR_PG"
  chmod 644 "$CERT_DIR_MOSQ/server.key" "$CERT_DIR_PG/server.key" \
            "$CERT_DIR_MOSQ/server.crt" "$CERT_DIR_MOSQ/ca.crt" \
            "$CERT_DIR_PG/server.crt"  "$CERT_DIR_PG/ca.crt"

  trap - EXIT
  rm -f "$CA_KEY" "$CA_CRT" "$SRV_KEY" "$SRV_CSR" "$SRV_CRT"
  ok "PKI dev generata (CA + cert mosquitto + cert postgres, validità 825 giorni)."
else
  ok "PKI dev già presente — riuso (cancelli mosquitto/certs/ + postgres/certs/ per rigenerare)."
fi

log "Provisiono Mosquitto password file..."
MQTT_USERNAME="${MQTT_USERNAME:-backend}"
sed_replace MQTT_USERNAME "$MQTT_USERNAME"
PASSWD_PATH="$SCRIPT_DIR/mosquitto/config/passwd"
node -e '
  const crypto = require("crypto");
  const user = process.argv[1];
  const pwd = process.argv[2];
  if (!user || !pwd) {
    process.stderr.write("usage: node -e <script> <user> <password>\n");
    process.exit(1);
  }
  const salt = crypto.randomBytes(64);
  const hash = crypto.pbkdf2Sync(pwd, salt, 1000, 64, "sha512");
  process.stdout.write(`${user}:$7$1000$${salt.toString("base64")}$${hash.toString("base64")}\n`);
' "$MQTT_USERNAME" "$MQTT_PASSWORD" > "$PASSWD_PATH" \
  || die "Generazione mosquitto/config/passwd fallita."
chmod 644 "$PASSWD_PATH"
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
