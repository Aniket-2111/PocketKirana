# PocketKirana — Production Operations & Deployment Runbook

## 1. Environment Variables & Secret Architecture

### Protected VPS Secret Storage (Never in Git)
Production secrets must **never** be committed to GitHub or stored in repo `.env.production` files. On the Hostinger VPS:
1. Create a dedicated unprivileged system user for the application:
   ```bash
   sudo useradd --system --create-home --shell /usr/sbin/nologin pocketkirana
   ```
2. Store secrets at `/etc/pocketkirana/pocketkirana.env` owned by `root:pocketkirana`:
   ```bash
   sudo mkdir -p /etc/pocketkirana
   sudo chown root:pocketkirana /etc/pocketkirana
   sudo chmod 750 /etc/pocketkirana

   # Create environment file (as root or via secure template)
   sudo touch /etc/pocketkirana/pocketkirana.env
   sudo chown root:pocketkirana /etc/pocketkirana/pocketkirana.env
   sudo chmod 640 /etc/pocketkirana/pocketkirana.env
   ```
3. **Environment Loading Policy**:
   - **Never** use `export $(grep -v '^#' ... | xargs)` (this breaks on multi-line private keys and leaks secrets into shell history).
   - Let systemd or PM2 load the environment file directly:
     ```ini
     # /etc/systemd/system/pocketkirana.service
     [Service]
     User=pocketkirana
     Group=pocketkirana
     EnvironmentFile=/etc/pocketkirana/pocketkirana.env
     ExecStart=/usr/bin/npm start
     ```
   - For manual CLI scripts (e.g. migrations), use:
     ```bash
     set -a
     source /etc/pocketkirana/pocketkirana.env
     set +a
     ```
4. **Environment Isolation (Staging vs. Production)**:
   - **Staging**: Uses `pocketkirana-staging` (Firebase), `pocketkirana-staging` (R2), and PhonePe UAT sandbox (`PHONEPE_BASE_URL=https://api-preprod.phonepe.com/apis/pg-sandbox`). Never use production Firebase or live merchant credentials in staging.
   - **Production**: Uses `pocketkirana-prod` (Firebase), `pocketkirana-media` (R2), and PhonePe Production hermes gateway (`PHONEPE_BASE_URL=https://api.phonepe.com/apis/hermes`).
5. **Mandatory Credential Rotation**: Any credential, database password, or API key that has ever appeared in any commit history must be revoked and rotated prior to pointing live customer traffic to the server.

---

## 2. Idempotent PostgreSQL Provisioning & Schema Verification

### Idempotent Database & Dual-User Role Creation:
```bash
# Check if database exists before creating
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='pocketkirana_db'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE pocketkirana_db;"

# Provision Dual-User Security Model (pk_app_user + pk_migrator)
# Using the parameterized provisioning script (passwords supplied securely):
PK_APP_USER_PASSWORD="<STRONG_APP_PASSWORD>" \
PK_MIGRATOR_PASSWORD="<STRONG_MIGRATOR_PASSWORD>" \
node scripts/provision_db_users.js
```

### Migration Execution:
```bash
# Run schema migration (using npm run migrate or directly)
npm run migrate
# or: node scripts/init_client_postgres_tables.js
```

### Exhaustive Schema & Sequence Verification:
Verify that the database truly reflects the authoritative architecture:
```bash
sudo -u postgres psql -d pocketkirana <<EOF
SELECT current_database();

-- Verify core tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Verify critical business tables
\d orders
\d payments
\d payment_transactions
\d inventory_batches
\d stock_reservations
\d picker_tasks
\d delivery_assignments
\d invoice_records
\d outbox_events

-- Verify sequences
\ds invoice_number_seq
\ds pk_order_seq
EOF
```

---

## 3. Production Health Probes & Dependency Classification

The `/api/health/ready` probe classifies dependencies into **Critical** vs **Degraded**:

- **Critical Dependencies** (Failure returns **HTTP 503 `not_ready`**):
  - `PostgreSQL`: Authoritative database offline → Blocks checkout, orders, stock, payments.
  - `Firebase Auth`: Token authentication unavailable → Blocks customer & partner auth.
- **Non-Critical / Secondary Dependencies** (Failure returns **HTTP 200 `degraded`**):
  - `Cloudflare R2`: Image media storage degraded → Browsing and checkout continue with cached/fallback assets.
  - `PhonePe Simulation / Warning`: Gateway warning logged, customer redirected or shown retry.
  - `Outbox Backlog`: Delayed asynchronous notification queue; core transactions remain consistent.

```bash
# Liveness check:
curl -i http://localhost:3000/api/health
# Expected: HTTP 200 OK

# Readiness check:
curl -i http://localhost:3000/api/health/ready
# Expected: HTTP 200 OK (status: "ready" or "degraded")
```

---

## 4. The 19-Checkpoint Staging Verification Checklist

Execute these sequentially against the deployed staging instance before declaring Gate 2 passed:

| # | Checkpoint | Verification Procedure | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| **1** | **PostgreSQL Installation & Schema** | `sudo -u postgres psql -d pocketkirana -c "\d invoice_records; \ds invoice_number_seq;"` | `invoice_records` exists with `ON DELETE RESTRICT`; `invoice_number_seq` and `pk_order_seq` sequences exist. |
| **2** | **Secret Isolation** | `sudo ls -ld /etc/pocketkirana && sudo ls -l /etc/pocketkirana/pocketkirana.env` | Directory is `750 root:pocketkirana`; file is `640 root:pocketkirana`; zero secrets in git. |
| **3** | **Node.js & PM2 Setup** | `node -v && pm2 -v` | Node 22.x LTS active; PM2 running. |
| **4** | **Application Startup** | `pm2 status pocketkirana-web` | Process state is `online` with 0 unexpected restarts. |
| **5** | **Outbox Worker Startup** | `pm2 logs pocketkirana-outbox-worker --lines 20` | Banner displayed; `Worker ID`, `Poll Interval (2000ms)`, lease engine active. |
| **6** | **Liveness Probe** | `curl -i http://localhost:3000/api/health` | Returns **HTTP 200 OK** with `{ "status": "ok" }`. |
| **7** | **Readiness Probe** | `curl -i http://localhost:3000/api/health/ready` | Returns **HTTP 200 OK** (`ready` or `degraded`). PostgreSQL and Firebase report `ok`. |
| **8** | **Firebase Auth Isolation** | Log in with mobile OTP on customer APK/web. | Staging Firebase project verified; user row mirrored in PostgreSQL; production DB untouched. |
| **9** | **Catalog Read** | Browse categories and product detail pages. | Authoritative pricing loads; inventory batch counts display accurately. |
| **10** | **Checkout & FEFO Reservation** | Add items and initiate order placement. | PostgreSQL row lock `FOR UPDATE` reserves FEFO batch stock synchronously; status becomes `PLACED`. |
| **11** | **PhonePe UAT Sandbox** | Complete test payment on PhonePe sandbox gateway. | Webhook verifies 5-field invariant tuple; order transitions to `CONFIRMED`; outbox queues `payment.confirmed`. |
| **12** | **Picker Workflow** | Picker claims task on store tablet interface. | Picker task transitions `PENDING → ASSIGNED → IN_PROGRESS → PACKED → READY_FOR_PICKUP`; synchronized with order. |
| **13** | **Delivery Workflow** | Delivery partner accepts dispatch request. | 60s acceptance timer works; Pickup OTP verified at store; Delivery OTP verified at customer doorstep. |
| **14** | **FCM Physical Devices** | Inspect real Android notification tray. | Push notifications received with unique `notification_id`; duplicate messages dropped by client SQLite DB. |
| **15** | **Backup & Tested Restore** | `sudo -u postgres createdb pocketkirana_test && sudo -u postgres pg_dump -Fc -d pocketkirana -f /tmp/backup.dump && sudo -u postgres pg_restore --exit-on-error -d pocketkirana_test /tmp/backup.dump && sudo -u postgres dropdb pocketkirana_test` | Dump restores cleanly without error; test DB dropped afterwards. |
| **16** | **Worker Crash & Lease Recovery** | `pm2 stop pocketkirana-outbox-worker && sleep 40 && pm2 start pocketkirana-outbox-worker && pm2 logs pocketkirana-outbox-worker --lines 50` | Leases expire after 30s; restarted worker reclaims expired leases and completes processing. |
| **17** | **VPS Reboot Recovery** | `sudo reboot`, then after reconnecting: `pm2 status && curl -i http://localhost:3000/api/health/ready` | Both PM2 services resurrect automatically (`online`); PostgreSQL starts; readiness returns 200. |
| **18** | **PostgreSQL Connection Failure** | `sudo systemctl stop postgresql && curl -i http://localhost:3000/api/health/ready` (expect 503), then `sudo systemctl start postgresql && curl -i http://localhost:3000/api/health/ready` (expect 200) | Validates fail-closed architecture when database is unreachable, and recovery upon restore. |
| **19** | **Staging DNS & Smoke Test** | Point `staging.pocketkirana.in` to VPS via Cloudflare TLS; execute complete smoke order. | SSL terminates cleanly; zero certificate warnings; end-to-end order completes. |

---

## 5. Formal Production Release Gate Progression

```text
┌──────────────────────────────────────┐
│ Gate 1: Code & Architecture Gate     │ ──► [PASSED: 607/607 tests, 0 TS errors, 135 build pages]
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Gate 2: Staging Infrastructure Gate  │ ──► [19 Checkpoints on Hostinger VPS: staging.pocketkirana.in]
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Gate 3: Payment Sandbox (UAT) Gate   │ ──► [PhonePe end-to-end sandbox webhook & 5-field invariant validation]
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Gate 4: Physical Device Gate         │ ──► [Real Android APKs: FCM push, OTP delivery, barcode scanning]
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Gate 5: Backup & Disaster Gate       │ ──► [pg_dump restore validation, outbox worker restart test]
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Gate 6: Production Cutover Gate      │ ──► [Live traffic opened behind Cloudflare TLS: pocketkirana.in]
└──────────────────────────────────────┘
```

---

## 6. Emergency Procedures & Rollback

### Stalled Outbox Events
If notifications or events are delayed:
```sql
SELECT status, count(*), min(created_at) FROM outbox_events GROUP BY status;
-- Release expired leases:
UPDATE outbox_events SET status = 'pending', lease_token = NULL WHERE status = 'processing' AND lease_expires_at < NOW();
```

### Rollback Process
1. Stop running service: `pm2 stop pocketkirana-web`
2. Checkout previous stable release: `git checkout <STABLE_RELEASE_TAG>`
3. Build and restart: `npm run build && pm2 start ecosystem.config.js --env production`
