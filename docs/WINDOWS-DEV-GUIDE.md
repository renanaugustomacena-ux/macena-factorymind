# FactoryMind — Windows development guide

**Versione:** 1.0 (post-v1.0.1 W1 sweep, 2026-05-07)
**Owner:** Renan Augusto Macena
**Audience:** lead engineer continuing development on Windows after the v1.0.1 multi-cluster W1 sweep landed on `main`.
**Companion documents:** [`HANDOFF.md`](HANDOFF.md), [`AUDIT.md`](AUDIT.md), [`REMEDIATION.md`](REMEDIATION.md), [`UPLIFT.md`](UPLIFT.md).

This document is the practical step-by-step from "Windows machine with nothing installed" to "all remaining W1 external blockers closed and the platform onboarding its first paying Tier 2 customer." It is intentionally chronological — each part presupposes the previous one.

---

## Part A — Set up the Windows development environment

### A.1 What you need

- Windows 10 (build 19044+) or Windows 11.
- Local admin rights (you'll install WSL2 + Docker Desktop).
- ≥ 16 GB RAM (8 GB minimum but tight); ≥ 50 GB free disk.
- A GitHub account with push access to `github.com/renanaugustomacena-ux/macena-factorymind`.

### A.2 Install WSL2 + Ubuntu

The `install.sh` at the repo root explicitly **rejects Windows without WSL2** (see line 56 of the script). Every command in this guide that targets the FactoryMind stack runs inside Ubuntu under WSL2, never in PowerShell directly.

Open PowerShell as Administrator and run:

```powershell
wsl --install -d Ubuntu-24.04
```

If WSL is already partially installed, `wsl --update` then `wsl --install -d Ubuntu-24.04`. Reboot when prompted. After reboot, Ubuntu launches automatically and asks you to create a UNIX user (use a short lowercase name; it's separate from your Windows user). Set a strong UNIX password.

Verify:

```powershell
wsl --status
wsl -l -v
```

You should see `Ubuntu-24.04` with `VERSION 2`. If you see `VERSION 1`, run `wsl --set-default-version 2` and re-import the distro.

### A.3 Install Docker Desktop with the WSL2 backend

Download Docker Desktop from `https://www.docker.com/products/docker-desktop/`. During install, leave **"Use the WSL 2 based engine"** checked. After install, open Docker Desktop → Settings → Resources → WSL Integration, and enable integration with `Ubuntu-24.04`. Apply & restart.

Verify from the Ubuntu shell:

```bash
docker version
docker compose version
docker run --rm hello-world
```

All three must succeed. If `docker` is "not found" inside Ubuntu, the WSL Integration toggle didn't take — re-toggle and restart Docker Desktop.

### A.4 Configure Git inside WSL2

```bash
sudo apt-get update
sudo apt-get install -y git curl openssl ca-certificates jq
git config --global user.name "Renan Augusto Macena"
git config --global user.email "renan@factorymind.it"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global core.autocrlf input    # Windows is the host but the working tree lives in WSL/ext4
```

Generate an SSH key for GitHub (one-shot per Windows host):

```bash
ssh-keygen -t ed25519 -C "renan@factorymind.it"      # accept defaults; use a passphrase
cat ~/.ssh/id_ed25519.pub
```

Copy the public key to GitHub → Settings → SSH and GPG keys → New SSH key. Title it `factorymind-windows-<your-machine>`. Confirm with:

```bash
ssh -T git@github.com
```

You should see "Hi renanaugustomacena-ux! You've successfully authenticated…".

### A.5 Install Node.js 20 LTS + nvm (matching the backend engines.node)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm alias default 20
node --version    # expect v20.x.x
npm --version     # expect 10.x.x or higher
```

The backend `package.json` declares `engines: { node: ">=20.0.0", npm: ">=10.0.0" }`. CI also uses Node 20.

### A.6 Install Terraform + AWS CLI + cosign (one time)

```bash
# Terraform 1.9.x (versions.tf required_version >= 1.6.0)
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt-get update
sudo apt-get install -y terraform

# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
sudo apt-get install -y unzip
unzip /tmp/awscliv2.zip -d /tmp
sudo /tmp/aws/install
aws --version    # expect aws-cli/2.x

# cosign (image signing)
COSIGN_VERSION=v2.4.1
curl -L -o /tmp/cosign "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64"
chmod +x /tmp/cosign
sudo mv /tmp/cosign /usr/local/bin/cosign
cosign version
```

### A.7 Pick a local code path

WSL2 ext4 filesystem is dramatically faster than `/mnt/c/...` (Windows host filesystem) for `npm install`, `docker build`, and git operations. **Always clone into the WSL home, never into `C:\`.**

```bash
mkdir -p ~/code
cd ~/code
```

### A.8 (Optional but recommended) VS Code with Remote-WSL

Install VS Code from `https://code.visualstudio.com/`. After install, open Ubuntu, go to your project directory, and run `code .`. The first time it bootstraps the VS Code Server inside WSL. Install these extensions inside the WSL profile (not the Windows profile):

- `ms-vscode-remote.remote-wsl`
- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `ms-azuretools.vscode-docker`
- `hashicorp.terraform`
- `bradlc.vscode-tailwindcss`

VS Code's terminal then opens directly inside WSL/Ubuntu — every command in this guide runs there.

---

## Part B — Clone and run FactoryMind locally

### B.1 Clone

```bash
cd ~/code
git clone git@github.com:renanaugustomacena-ux/macena-factorymind.git
cd macena-factorymind
git status         # should be clean on `main`
git log --oneline | head -25
```

The HEAD should be the post-W1-sweep commit. The bottom-most commit visible should be `d4c5107 feat: initial commit - FactoryMind Industrial IoT/OEE platform`.

### B.2 First boot via the canonical installer

The README's Quick Start points at `./install.sh` because the broker now requires authentication and the cert PKI must be generated before `docker compose up`. **Do not bypass it.**

Interactive (recommended for first-time setup — you set the admin email + password):

```bash
./install.sh
```

Answer the prompts. The defaults target the Mozzecane facility — accept them unless you're testing a different deployment shape. The admin password must be ≥ 12 characters.

Unattended (CI / smoke tests / quick re-runs — random admin password generated):

```bash
FM_UNATTENDED=1 ./install.sh
```

The installer:

1. Detects the OS (rejects Windows without WSL2 — won't apply since you're in Ubuntu).
2. Checks Docker + openssl + curl are present.
3. Generates strong random secrets (JWT, Influx token, Postgres password, MQTT password, Grafana admin password).
4. Generates the dev PKI: a one-shot ECDSA P-256 CA + leaf certs for mosquitto and postgres in `mosquitto/certs/` and `postgres/certs/` (gitignored, 825-day validity).
5. Provisions `mosquitto/config/passwd` via Node PBKDF2-SHA512 (Mosquitto v2 `$7$` format).
6. Writes `.env` (mode 600).
7. Runs `docker compose up -d --build`.
8. Polls the backend's `/api/health` until `status: "ok"` (180-second timeout).
9. Prints the URLs + admin credentials.

Expected timing on a 16 GB Windows laptop with a clean Docker Desktop: **~10–12 minutes** the first run (image pulls + builds), **~30 seconds** subsequent runs (cached). The doctrine H-1 ceiling is 15 minutes — file an issue if your run exceeds that.

### B.3 Verify the stack

```bash
docker ps --format '{{.Names}}\t{{.Status}}' | grep factorymind
```

You should see seven containers, all `Up` and (for those with healthchecks) `(healthy)`:

```
factorymind-frontend     Up X seconds (healthy)
factorymind-backend      Up X seconds (healthy)
factorymind-grafana      Up X seconds (healthy)
factorymind-simulator    Up X seconds
factorymind-mosquitto    Up X seconds (healthy)
factorymind-influxdb     Up X seconds (healthy)
factorymind-postgres     Up X seconds (healthy)
```

Open these in your Windows browser (Docker Desktop forwards WSL ports automatically):

- `http://localhost:5173` — the React dashboard. You'll be redirected to `/login` (Part D explains).
- `http://localhost:3002/api/health` — backend health JSON.
- `http://localhost:3000` — Grafana (login: `admin` / `<GRAFANA_ADMIN_PASSWORD>` from `.env`).
- `http://localhost:8086` — InfluxDB UI (login: `admin` / `<DOCKER_INFLUXDB_INIT_PASSWORD>` from `.env`).

Read the admin credentials from `.env`:

```bash
grep -E '^(FM_ADMIN_EMAIL|GRAFANA_ADMIN_PASSWORD|DOCKER_INFLUXDB_INIT_PASSWORD)=' .env
```

The dashboard admin password is what you typed during interactive install (or, in unattended mode, the random one printed at the end of `./install.sh`).

---

## Part C — Verify the v1.0.1 W1 sweep landed

These ten checks are the integration gates the W1 sweep was verified against. Re-run them on your Windows machine to confirm everything came up correctly. Each takes < 30 seconds.

```bash
# Save your shell some typing
ADMIN_EMAIL=$(grep ^FM_ADMIN_EMAIL= .env | cut -d= -f2)
MQTT_PWD=$(grep ^MQTT_PASSWORD= .env | cut -d= -f2)
PG_PWD=$(grep ^POSTGRES_PASSWORD= .env | cut -d= -f2)
GRAFANA_PWD=$(grep ^GRAFANA_ADMIN_PASSWORD= .env | cut -d= -f2)
```

### C.1 Mosquitto auth required (F-CRIT-001 / R-MQTT-ANON-001)

```bash
# Anonymous → Connection Refused
docker run --rm --network factorymind_factorymind-net eclipse-mosquitto:2 \
  mosquitto_sub -h factorymind-mosquitto -p 1883 -t '$SYS/#' -W 3 -C 1
# Expected: "Connection error: Connection Refused: not authorised"

# Authenticated → broker uptime
docker run --rm --network factorymind_factorymind-net -e P="$MQTT_PWD" eclipse-mosquitto:2 \
  sh -c 'mosquitto_sub -h factorymind-mosquitto -p 1883 -u backend -P "$P" -t "\$SYS/broker/uptime" -C 1 -W 3'
# Expected: "X seconds"
```

### C.2 Mosquitto TLS on 8883 (F-CRIT-002 / R-MQTT-TLS-001)

```bash
echo | openssl s_client -connect localhost:8883 -showcerts -servername factorymind-mosquitto 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
# Expected:
#   subject=… CN = factorymind-mosquitto
#   issuer=… CN = FactoryMind Dev Root CA
#   notBefore=…  notAfter=… (≈ 825 days from generation)
```

### C.3 Postgres TLS (F-CRIT-005 / R-GRAFANA-PG-TLS-001)

```bash
docker exec factorymind-postgres psql "host=factorymind-postgres dbname=factorymind user=factorymind password=$PG_PWD sslmode=require" \
  -c "SELECT pid, ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid();"
# Expected: ssl=t, version=TLSv1.3, cipher=TLS_AES_256_GCM_SHA384

curl -s -u "admin:$GRAFANA_PWD" http://localhost:3000/api/datasources/uid/fm-postgres/health
# Expected: {"message":"Database Connection OK","status":"OK"}
```

### C.4 Backend production guardrails (F-MED-005 / R-CONFIG-MQTT-001)

```bash
cd backend
npx jest tests/config-prod-guardrails.test.js --no-coverage
# Expected: 11 passed
cd ..
```

### C.5 OPC UA SSRF allow-list (F-CRIT-003 / R-OPCUA-VALIDATE-001)

```bash
docker exec factorymind-backend node -e '
  const { validateOpcuaEndpoint } = require("/app/src/services/opcua-endpoint-validator");
  const bad = validateOpcuaEndpoint("opc.tcp://169.254.169.254:4840/", { allowedHosts: ["plc01.factory.local"] });
  const ok  = validateOpcuaEndpoint("opc.tcp://plc01.factory.local:4840/", { allowedHosts: ["plc01.factory.local"] });
  console.log("metadata IP:", JSON.stringify(bad));
  console.log("legit host:", JSON.stringify(ok));
'
# Expected:
#   metadata IP: {"ok":false,"reason":"Host metadata-service vietato: 169.254.169.254"}
#   legit host: {"ok":true}
```

### C.6 Cookie auth + CSRF (F-HIGH-001 / R-FRONTEND-COOKIE-AUTH-001)

```bash
ADMIN_PWD="<the password you set during install>"   # OR generate via Part D.4 password reset
JAR=/tmp/fm-cookies.txt; rm -f $JAR

# 1. Login → two Set-Cookies
curl -s -c $JAR -X POST http://localhost:3002/api/users/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PWD\"}" | head -c 80; echo
grep factorymind $JAR

# 2. Cookie-only /me → 200
curl -s -b $JAR http://localhost:3002/api/users/me | head -c 200; echo

# 3. CSRF gate without X-CSRF-Token → 403
curl -s -o /dev/null -w 'logout no-csrf: %{http_code}\n' -b $JAR -X POST http://localhost:3002/api/users/logout

# 4. CSRF gate with matching token → 204
CSRF=$(awk '$6=="factorymind_csrf"{print $7}' $JAR)
curl -s -o /dev/null -w 'logout csrf-ok: %{http_code}\n' -b $JAR -H "X-CSRF-Token: $CSRF" -X POST http://localhost:3002/api/users/logout

# 5. CSRF gate with mismatch → 403
curl -s -o /dev/null -w 'logout csrf-bad: %{http_code}\n' -b $JAR -H 'X-CSRF-Token: bogus' -X POST http://localhost:3002/api/users/logout
```

### C.7 WS handshake auth (F-HIGH-010 / R-WS-AUTH-001)

```bash
cd backend
npx jest tests/ws-auth.test.js --no-coverage
# Expected: 7 passed
cd ..
```

### C.8 Frontend whoami non-root (F-HIGH-007)

```bash
docker exec factorymind-frontend whoami       # → nginx
curl -sI http://localhost:5173/ | head -2     # → HTTP/1.1 200 OK
```

### C.9 GDPR scripts (F-HIGH-006 / R-GDPR-001)

```bash
./scripts/export-subject.sh --email "$ADMIN_EMAIL" | head -10
# Expected: JSON dump with export_format_version "1.0"

./scripts/export-subject.sh --email "nope@nowhere.it"
# Expected: exit 64, "[export-subject] SUBJECT_NOT_FOUND"
```

### C.10 Docs lint + backend full test suite

```bash
node scripts/lint-docs.js
# Expected: "OK (anchors + decrees + word-count + freshness all pass)" with 4 allowlisted warnings.

cd backend && npx jest --no-coverage
# Expected: 175/175 across 25 suites.
cd ../frontend && npm run lint && npm run typecheck
# Expected: clean.
cd ..
```

If any gate fails, **stop here** and read the corresponding finding in `docs/AUDIT.md` plus the closure note in `docs/REMEDIATION.md`. Re-running `./install.sh` from a clean state (after `docker compose down -v && rm -rf .env mosquitto/config/passwd mosquitto/certs postgres/certs`) usually clears transient breakage.

---

## Part D — Day-to-day development workflow

### D.1 Start / stop / restart

```bash
docker compose stop          # pauses containers, preserves volumes
docker compose start         # resumes
docker compose down          # removes containers + network, keeps volumes
docker compose down -v       # removes volumes too — full reset

# Single service rebuild after a code change:
docker compose up -d --no-deps --build factorymind-backend
docker compose up -d --no-deps --build factorymind-frontend
```

### D.2 Watching logs

```bash
docker compose logs -f                     # all services
docker compose logs -f factorymind-backend # one service
docker compose logs -f --tail=100 factorymind-mosquitto factorymind-postgres
```

### D.3 Tests

```bash
# Backend unit tests
cd backend && npx jest --no-coverage

# Single test file
cd backend && npx jest tests/auth-cookie.test.js --no-coverage

# Coverage
cd backend && npm run test:cov

# Frontend lint + typecheck
cd frontend && npm run lint && npm run typecheck

# Frontend production build
cd frontend && npm run build

# Doc lint
node scripts/lint-docs.js
```

The doctrine **R-1** (REMEDIATION.md) requires every fix to ship with a regression test: one commit that *only adds the test* (red — fails before fix); the next commit ships the fix (green — passes after). PRs that skip this are rejected.

### D.4 Reset an admin password

The install.sh-generated admin hash is in `.env` as `FM_ADMIN_PASSWORD_HASH=<salt-hex>:<scrypt-hash-hex>`. To set a known password (e.g., for a smoke test):

```bash
NEW_PWD="ChangeMeAtFirstBoot01!"
NEW_SALT=$(openssl rand -hex 16)
NEW_HASH=$(node -e "console.log(require('crypto').scryptSync(process.argv[1], process.argv[2], 64).toString('hex'))" "$NEW_PWD" "$NEW_SALT")
docker exec factorymind-postgres psql -U factorymind -d factorymind \
  -c "UPDATE users SET password_salt='$NEW_SALT', password_hash='$NEW_HASH', active=TRUE WHERE email='$ADMIN_EMAIL';"
echo "Reset to: $NEW_PWD"
```

The legacy `scrypt$<salt_b64>$<hash_b64>` format produced by older install.sh runs is no longer used (it broke docker-compose env interpolation — see commit `73ec4f1`).

### D.5 Run a single GDPR drill

Per HANDOFF doctrine **H-22** the GDPR scripts are drilled quarterly. Manual:

```bash
# Create a synthetic test subject
docker exec factorymind-postgres psql -U factorymind -d factorymind -c "
INSERT INTO users (email, full_name, role, password_salt, password_hash, active)
VALUES ('drill-$(date +%Y%m%d)@factorymind.local', 'Drill Subject', 'viewer', 'aa', 'bb', TRUE)
ON CONFLICT (email) DO UPDATE SET active=TRUE, deletion_requested_at=NULL;"

# Export
./scripts/export-subject.sh --email "drill-$(date +%Y%m%d)@factorymind.local"

# Erase (soft-delete + 30-day grace)
FM_NON_INTERACTIVE=1 ./scripts/erase-subject.sh \
  --email "drill-$(date +%Y%m%d)@factorymind.local" \
  --reason "Quarterly drill $(date +%Y-%m-%d)"

# Verify the soft-delete landed
docker exec factorymind-postgres psql -U factorymind -d factorymind -c "
SELECT email, active, deletion_requested_at IS NOT NULL AS marked
FROM users WHERE email LIKE 'drill-%';"

# Cleanup
docker exec factorymind-postgres psql -U factorymind -d factorymind -c "
DELETE FROM users WHERE email LIKE 'drill-%';"
```

### D.6 Branching

For non-trivial work, branch off `main`:

```bash
git checkout -b R-XYZ-001-short-description
# … make changes, run tests, commit each fix as test-then-fix per R-1 …
git push -u origin R-XYZ-001-short-description
# Open a PR against main on github.com.
```

Tiny doc fixes can land directly on main. Anything that touches doctrine, schema, or auth flow needs a PR with at least one reviewer (per H-22 quarterly review the second-engineer hire becomes the default reviewer).

---

## Part E — Close the remaining external blockers

The v1.0.1 sweep flipped 17 tickets to `Verified` or `Code complete`. Five items remain externally blocked. They are listed here in the order you should attack them; each carries a definition-of-done that flips its REMEDIATION status to `Verified`.

### E.1 Provision the AWS Terraform state backend (closes F-CRIT-004)

**Precondition:** an AWS account in your control. If you don't have one, create one at `https://aws.amazon.com/`. Use a fresh email; enable MFA on the root account immediately; create an IAM user with `AdministratorAccess` for engineering use and stop using root.

```bash
# Configure the AWS CLI
aws configure
# AWS Access Key ID: <from IAM console, the engineering IAM user>
# AWS Secret Access Key: <…>
# Default region name: eu-south-1
# Default output format: json

aws sts get-caller-identity   # confirm you're authenticated as the right user

# One-shot bootstrap of the state bucket + lock table
cd terraform
AWS_REGION=eu-south-1 ./bootstrap-state.sh
# Idempotent — re-running just verifies hardening.

# Initialise Terraform with the remote backend
terraform init
# Type "yes" if it asks to migrate state (none yet).

# Validate
terraform validate

# First plan (do NOT apply yet — review carefully)
terraform plan -out=tfplan.bin
terraform show tfplan.bin | head -100
```

**Definition of done:** `terraform apply tfplan.bin` runs to completion in your account; flips F-CRIT-004 + F-HIGH-003 + F-HIGH-004 from `Code complete` to `Verified`. After apply, document the output (RDS endpoint, KMS key ARN) somewhere safe — they'll be referenced in the production `.env` once you deploy.

**Cost note:** Aurora Serverless v2 at `min_capacity = 0.5` runs ~€40/month idle; KMS CMK is ~€0.85/month + per-request fees. Set up an AWS Budgets alert at €100/month to catch surprises.

### E.2 Counsel sign-off on the TIA (closes F-CRIT-006)

`legal/TIA-INFLUXDATA.md` is at v0.9 (engineering draft). Before flipping it to v1.0:

1. **Engage a qualified Italian privacy lawyer** (avvocato iscritto all'albo). Mozzecane / Verona ODCEC contacts: ask the local ODCEC for a referral, or use one of the Italian privacy-law firms that work with PMI manifatturiere (e.g., Trifirò Partners, ICT Legal Consulting). Budget: ~€2-5k for the TIA review + DPA review bundle.
2. Provide counsel with: `legal/TIA-INFLUXDATA.md`, `legal/DATA-PROCESSING-AGREEMENT.md`, the InfluxData Cloud DPA you'll receive when you sign up for InfluxDB Cloud, evidence of the technical supplementary measures (the relevant code paths in `backend/src/services/`).
3. Counsel verifies §§ 5.1, 5.4, 7 of the TIA, confirms or amends the DPF self-certification status of InfluxData Inc., signs the head's `Sign-off line`.
4. Update the document head: `Versione: 1.0`, fill `valid_through` (12 months from sign-off), commit.

**Definition of done:** the signed PDF is filed alongside the Markdown source (`legal/TIA-INFLUXDATA-v1.0-signed.pdf`) and the REMEDIATION ticket R-TIA-001 is flipped to `Verified`.

**Until then:** `OPCUA_ENABLED=false` everywhere except the customer's on-prem InfluxDB OSS instance. Tier 4 SaaS (which involves InfluxDB Cloud) cannot be sold to a paying customer without the signed TIA.

### E.3 First CD run (closes F-HIGH-008 + F-HIGH-009 W1 portion)

The CD pipeline at `.github/workflows/cd.yml` is wired but has never run because there's no upstream commit on a tag. To trigger:

1. Confirm GitHub repo Settings → Secrets and variables → Actions has at minimum:
   - `GITHUB_TOKEN` (auto, no action needed).
   - **No** `COSIGN_PRIVATE_KEY` — the pipeline uses keyless OIDC, no static key.
2. Confirm Settings → Actions → General → Workflow permissions = **Read and write permissions** + **Allow GitHub Actions to create and approve pull requests**.
3. Cut a release tag from main:

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. Watch the run at `https://github.com/renanaugustomacena-ux/macena-factorymind/actions`. The `build-and-push` job:
   - Builds three images (backend, frontend, simulator) with provenance + SBOM attestations.
   - Installs cosign 2.4.1.
   - Runs `cosign sign --yes <image>@sha256:<digest>` against each.
   - Emits `artifacts/image-digests.env` for downstream deploys.
5. Verify the signatures from your laptop:

   ```bash
   IMG=ghcr.io/renanaugustomacena-ux/factorymind-backend:v1.0.1
   cosign verify "$IMG" \
     --certificate-identity-regexp "^https://github\.com/renanaugustomacena-ux/macena-factorymind/" \
     --certificate-oidc-issuer https://token.actions.githubusercontent.com
   ```

   Expected output: a JSON envelope with `optional.Bundle.Payload.body.x509certificate.subject` matching your repo path. If the verify fails, the keyless flow didn't attach the certificate identity correctly — check the workflow logs.

**Definition of done:** Cosign verify succeeds + the `image-digests.env` artifact is downloadable from the Actions run + the staging deploy job's `Render k8s manifests with image digests` step prints `image: ghcr.io/renanaugustomacena-ux/factorymind-backend@sha256:…` (no tag form). Flips R-K8S-DIGEST-001 + R-SUPPLY-001 (W1 portion) to `Verified`.

### E.4 Production cert-manager swap (flips F-CRIT-002 / F-CRIT-005 from `Verified (dev)` to `Verified`)

The dev CA in `mosquitto/certs/` and `postgres/certs/` is autofirmata and 825-day. **Production must use a real CA**, typically Let's Encrypt via `cert-manager` on Kubernetes.

This is a Kubernetes-deployment task (not a docker-compose task), and it's the trigger event that flips the deployment topology from "single host, docker-compose" to "k8s with HPA + ingress + cert-manager". The work belongs to the first paying customer engagement; doing it earlier is premature.

When the time comes:

1. Stand up a small k8s cluster (EKS / GKE / OVHcloud Managed Kubernetes / Aruba Kubernetes-as-a-service). Match the residency of the customer (Italian customers → eu-south-1 Milano on AWS, or Aruba/OVH Italian region).
2. `kubectl apply -f k8s/namespace.yaml` (already present).
3. Install cert-manager: `helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set installCRDs=true`.
4. Create a `ClusterIssuer` for Let's Encrypt prod + an `Issuer` for staging (rate limits — always test with staging first).
5. Add a `Certificate` resource for the Mosquitto broker hostname (e.g., `broker.factorymind.cloud`) and the Postgres hostname (in-cluster: usually not exposed externally; use `cert-manager` with a private CA or skip if the Aurora endpoint is the data source).
6. Update `mosquitto.conf` and Postgres `command:` to read from the cert-manager-managed Secret rather than the file-mount.
7. Run the C.2 + C.3 verification gates against the production endpoints.

**Definition of done:** `openssl s_client -connect broker.factorymind.cloud:8883` returns a chain rooted at Let's Encrypt R3/R4, valid for ~90 days, and `kubectl describe certificate` shows the `cert-manager` annotation. Flips F-CRIT-002 + F-CRIT-005 from `Verified (dev)` to plain `Verified`.

### E.5 W2 work — what to ship next

After the four blockers above close, the W2 backlog (deadline 2026-08-05) is:

- **R-K8S-KYVERNO-001** — install Kyverno on the k8s cluster, apply a `verifyImages` policy that requires every pod to use a Cosign-signed image with the FactoryMind repo identity. Without this, F-HIGH-009 is only half-closed.
- **R-FRONTEND-BEARER-RETIRE-001** — once one full release cycle of dual-mode auth has run without cookie-auth bug reports, retire the localStorage Bearer fallback in `frontend/src/api/client.ts`. Migration window: one release; communicate via the Tier 4 customer notice template (REMEDIATION § 10).
- **R-PGBOUNCER-001** — F-MED-DATA-005 (connection-pool sizing). Stand up PgBouncer in transaction-pooling mode in front of Aurora; the backend's `pg-pool` becomes a thin client.
- **R-K8S-NETPOL-001** — F-MED-001. Default-deny NetworkPolicy is shipped (HANDOFF § 11.10); add fine-grained allow rules per service. Builds on the AWS prefix-list scoping in modules/db egress.
- **R-MQTT-MTLS-001** — TLS-PSK is rejected; mTLS for edge gateways is the production identity model. Each customer machine gets its own X.509 cert via the AWS IoT Just-in-Time-Registration flow already provisioned in `terraform/main.tf`.
- **R-AUDIT-MED-IDS-001** — fix the four allowlisted anchor inconsistencies the docs lint warns about (`a-finding-f-med-005`, `a-finding-f-med-001`, `a-finding-f-xxx`, `r-ticket-r-tos-breach-001`). These are authoring shortcuts that were never realised as actual headings.

W2 + W3 + Continuous cadences are documented in `docs/REMEDIATION.md` § 1.3 / § 1.4 / § 1.5 / § 8.

---

## Part F — First paying customer onboarding

The platform is post-pilot, pre-first-paying-Tier-2 (HANDOFF § 1.7). The first commercial engagement is a ceremony, not a script. The full sequence:

### F.1 Pre-engagement (sales)

1. **ICP qualification.** From `moneyplan.txt` lines 59–90, the Tier-S target is a 15–60 employee manufacturer in Mozzecane / Villafranca / Valeggio with an active Piano 4.0 claim window and a machine bought in the last 18 months. The first customer should be Tier S; Tier A and B come second-year. Tier C (commercialista channel partner) is the unlock — one trusted accountant brings 5–15 pre-qualified leads per year.
2. **Site visit + gap demo.** Bring the simulator (`iot-simulator/`) on a laptop. Show the OEE dashboard + the Piano 4.0 attestazione PDF generated against the customer's own facility data (mock or live). Time-box to 60 minutes.
3. **Quote.** First customer is half-price on the record + signed testimonial + permission to host site visits (HANDOFF § 1.5 commercial tier model). For a Tier 2 Standard: setup €1.25–2.5k + €600–1.5k/year (half of the standard €2.5–5k / €1.2–3k/year).

### F.2 Contract signing

Templates at `legal/`:

- `CONTRATTO-SAAS-B2B.md` — the master contract for Tier 2 / Tier 3 customers. Foro competente Verona; legge italiana; clausole vessatorie ex artt. 1341–1342 c.c. specifically subscribed (art. 13).
- `TERMINI-DI-SERVIZIO.md` — Terms of Service (Tier 4 SaaS).
- `DATA-PROCESSING-AGREEMENT.md` — DPA per GDPR Art. 28; sub-processor list at § 5; reference the signed `legal/TIA-INFLUXDATA-v1.0-signed.pdf` (E.2 above) for InfluxData if the customer chose Tier 4 SaaS.
- `INFORMATIVA-PRIVACY-GDPR.md` — privacy notice for the customer's employees / shop-floor operators.
- `COOKIE-POLICY.md` — landing-page cookie policy.

The `[DA_COMPILARE]` placeholders get filled at signing. Counsel reviews the filled set before the customer signs.

### F.3 Installation

```bash
# At the customer site, on their hardware:
git clone https://github.com/renanaugustomacena-ux/macena-factorymind.git
cd macena-factorymind
./install.sh    # interactive — prompts for facility name, admin email, etc.
```

Post-install:

- The customer's network admin opens ports 5173 (dashboard), 3002 (API, behind reverse-proxy ideally), 1883 + 8883 (MQTT — only on the LAN segment carrying the PLCs), 9001 (WebSocket — same LAN scope as 5173).
- Configure each PLC to publish telemetry to `mqtts://<edge-gateway-IP>:8883` with the `backend` MQTT credentials (or, for high-security customers, mTLS via R-MQTT-MTLS-001 W2).
- Generate the first attestazione PDF: dashboard → device → "Genera attestazione Piano 4.0".
- Hand the PDF to the customer's commercialista; they hand it to the perito iscritto all'albo who jura the perizia (HANDOFF doctrine **H-16**).

### F.4 Customer-success cadence

UPLIFT.md Track Commercial defines the 30 / 90 / 180-day check-ins:

- **Day 30:** OEE-discovery call. Most customers see "90% utilised" machines running at 62% OEE in reality. Walk them through the disbelief → anger → optimisation arc.
- **Day 90:** quarterly review template (HANDOFF doctrine **H-22** mirror for the customer). Report incidents (none expected, but the runbook drills make sure on-call posture is real). Propose Piano 5.0 attestazione if they hit ≥ 3% (process) or ≥ 5% (whole site) energy reduction.
- **Day 180:** referral ask. The customer is the cheapest source of the next two customers — `moneyplan.txt:59-90` Tier C (commercialista) accounts for the multiplier.

---

## Part G — Operations / on-call

You are on-call. The single-engineer on-call posture is the reality until R-OWNER-001 (W2; depends on the second-engineer hire) lands.

### G.1 The 3:47 AM playbook (HANDOFF § 0 Percorso C)

When a page wakes you up:

1. The page carries the alert name (`FactoryMindAPIDown`, `FactoryMindMQTTDisconnected`, etc.) plus a `runbook_url` annotation pointing at the corresponding HANDOFF § 8.X anchor.
2. Open `https://github.com/renanaugustomacena-ux/macena-factorymind/blob/main/docs/HANDOFF.md#h-runbook-<lowercased-alertname>` (the URL is in the page body).
3. Follow the runbook: **Symptom → Diagnosis → Mitigation → Escalation → Postmortem template**.
4. If unresolved within 30 minutes of paging: escalate to … yourself for now (R-OWNER-001 again).
5. If customer-impacting (Tier 4 SaaS) and unresolved at 60 minutes: customer notice via the SLA channel using the templates at REMEDIATION § 10.
6. Within 5 working days of any pager event: postmortem using the template at HANDOFF § 8.PM. File in `docs/postmortems/` (directory to create on first use).

### G.2 Quarterly review (HANDOFF doctrine H-22)

Every quarter — first weekday of January, April, July, October:

1. Re-read every doctrine rule (H-1..H-22, A-1..A-20, R-1..R-18, U-1..U-20, T-1..T-12). Anything that's drifted gets an ADR proposing the change.
2. Run the cold-reader handoff exercise (HANDOFF § 12) against a fresh contributor. Time-box to 5 working days. If they can't reach "first turn of on-call" by day 5, the doctrine is in deriva — schedule the rewrite.
3. Run `node scripts/lint-docs.js` and ensure the freshness lint passes (AUDIT § 9 last-reviewed date ≤ 95 days). Update `**Data:**` in AUDIT and REMEDIATION heads.
4. Triage all `Pending`, `Code complete`, and `Drafted` REMEDIATION tickets. Rule R-7: silent wave drift is forbidden — every slip from W1 to W2 (or W2 to W3) requires a sign-off in REMEDIATION § 11.
5. Run the GDPR drill (D.5).
6. Run the disclosure-request runbook drill (TIA-INFLUXDATA Rule T-10) — tabletop the "InfluxData receives a US government access request" scenario.
7. Review accepted residual findings (REMEDIATION rule R-5): trigger conditions in AUDIT § 12 are re-evaluated; if a trigger fired, the residual flips to active and a ticket opens.

### G.3 Continuous cadences

- **Weekly:** Dependabot triage (REMEDIATION rule R-8). Patch versions of low-blast-radius deps auto-merge after CI passes; minors + majors hand-reviewed.
- **Monthly:** CVE register sweep (AUDIT doctrine **A-12**). Update HANDOFF Appendix A.5 with any new GHSA / CVE that touches a dependency.
- **Continuously:** secret rotation (HANDOFF § 5.4). JWT secrets, MQTT passwords, Influx tokens, Postgres password rotate annually or on suspected compromise.

---

## Part H — Quarterly review automation (suggested)

Given you're solo-on-call until R-OWNER-001, automate what you can:

1. **GitHub Action that fires the docs-lint freshness check weekly** so the AUDIT § 9 freshness violation surfaces as a PR comment 30 days before the 95-day cap.
2. **A scheduled `gh issue create` from a cron** that opens "Q1 2027 quarterly review checklist" on 2027-01-02 with the H.2 list as checkboxes.
3. **Renovate or Dependabot config** at `.github/dependabot.yml` (already present? check) tuned to the rules in REMEDIATION rule R-8.

These are nice-to-haves, not blockers. Ship them when you have a rainy-day afternoon.

---

## Part I — Commit + push to GitHub

You have local changes from the WSL session that produced this guide. Push them.

```bash
cd ~/code/macena-factorymind
git status                               # see what's changed
git log --oneline | head -25             # confirm v1.0.1 sweep is on HEAD
git fetch origin
git status                               # confirm `main` is up-to-date with origin or ahead by N commits

# If origin is ahead (someone else pushed): pull rebase first
git pull --rebase origin main

# Push
git push origin main
```

If push is rejected (`non-fast-forward`):

1. Stop. Don't `--force`.
2. `git pull --rebase origin main`. Resolve any conflicts.
3. Re-run the test suites (B + C above) so you confirm the rebased state still works.
4. `git push origin main`.

If you've also tagged for the first CD run (E.3):

```bash
git push origin v1.0.1
```

The push triggers `cd.yml`. Watch it at `https://github.com/renanaugustomacena-ux/macena-factorymind/actions/workflows/cd.yml`.

---

## Appendix — Windows-specific gotchas

- **CRLF line endings.** WSL2's ext4 filesystem doesn't have the Windows line-ending problem because all your work happens inside Ubuntu. But if you ever open a shell script via `/mnt/c/...` from WSL, line endings can flip; `git config --global core.autocrlf input` (set in A.4) protects the working tree.
- **Docker Desktop resource limits.** Default Docker Desktop on Windows allocates ~50% of RAM to the WSL VM. Open Docker Desktop → Settings → Resources → Advanced and confirm CPU ≥ 4, Memory ≥ 8 GB. The simulator + 6 services genuinely need it.
- **Port forwarding.** Docker Desktop forwards ports from the WSL VM to `localhost` on Windows automatically — no `wsl --proxy` dance needed. Browser access at `http://localhost:5173` Just Works.
- **File watchers.** If you run `npm run dev` for the frontend, Vite's HMR uses inotify watchers. WSL2 has a default inotify cap that hits frontend projects fast. Bump it:
  ```bash
  echo 'fs.inotify.max_user_watches=524288' | sudo tee /etc/sysctl.conf
  sudo sysctl -p
  ```
- **Antivirus interference.** Windows Defender / corporate AV scanning the Docker Desktop WSL VHDX file slows builds dramatically. Add `\\wsl$\Ubuntu-24.04\home\<your-user>\code` to the AV exclusion list (Settings → Update & Security → Windows Security → Virus & threat protection → Manage settings → Add or remove exclusions).
- **Time drift.** Docker Desktop on Windows has occasional clock-drift bugs that break TLS-cert-validity checks. If `openssl s_client` says "certificate not yet valid", check `date` inside the container — if it's wildly off, `wsl --shutdown` from PowerShell + restart Docker Desktop fixes it.
- **WSL2 backup.** Your work lives at `\\wsl$\Ubuntu-24.04\home\<user>\code\macena-factorymind`. The git remote is your backup; ensure you push frequently. Local Ubuntu can be re-installed in 10 minutes via `wsl --unregister Ubuntu-24.04 && wsl --install -d Ubuntu-24.04` if it ever corrupts.

---

**Made in Mozzecane (VR) — Veneto, Italy.**
