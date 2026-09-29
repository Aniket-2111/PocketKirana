# PocketKirana — Production Operations & Deployment Runbook

## 1. Environment Variables & Secret Architecture

### Protected VPS Secret Storage (Never in Git)
Production secrets must **never** be committed to GitHub or stored in repo `.env.production` files. On the production VPS host:
1. Secrets are stored at `/etc/pocketkirana/pocketkirana.env`.
2. Strict Unix file permissions are enforced:
   ```bash
   sudo mkdir -p /etc/pocketkirana
   sudo chown -R pocketkirana:pocketkirana /etc/pocketkirana
   sudo chmod 600 /etc/pocketkirana/pocketkirana.env
   ```
3. Injected into the Next.js process via PM2 or systemd:
   ```ini
   # /etc/systemd/system/pocketkirana.service
   [Service]
   EnvironmentFile=/etc/pocketkirana/pocketkirana.env
   ExecStart=/usr/bin/npm start
   ```
4. **Mandatory Credential Rotation**: Every credential, database password, or API key that has ever appeared in any git commit history must be revoked and rotated prior to pointing live customer traffic to the production cluster.

### Mandatory Production Secrets:
```bash
# Application & Environment
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://pocketkirana.in
NEXT_PUBLIC_API_URL=https://pocketkirana.in/api
NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED=true

# Authoritative PostgreSQL Database
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=pocketkirana
POSTGRES_USER=pocketkirana_app
POSTGRES_PASSWORD=<SECURE_STRONG_DB_PASSWORD>
POSTGRES_SSL=false # Set to true if remote RDS/Cloud SQL

# Firebase Admin SDK (Server-Side Token Verification & FCM)
FIREBASE_PROJECT_ID=pocketkirana-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-prod@pocketkirana-prod.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Public Config (Client Web/APK)
NEXT_PUBLIC_FIREBASE_API_KEY=<PROD_API_KEY>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pocketkirana-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pocketkirana-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=pocketkirana-prod.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<PROD_SENDER_ID>
NEXT_PUBLIC_FIREBASE_APP_ID=<PROD_APP_ID>

# PhonePe Payment Gateway (Real Gateway Credentials)
PHONEPE_MERCHANT_ID=M22...
PHONEPE_SALT_KEY=<SECURE_PROD_SALT_KEY>
PHONEPE_SALT_INDEX=1
PHONEPE_BASE_URL=https://api.phonepe.com/apis/hermes
PHONEPE_SIMULATION_MODE=false

# Cloudflare R2 Object Storage
R2_ACCOUNT_ID=<CLOUDFLARE_ACCOUNT_ID>
R2_ACCESS_KEY_ID=<CLOUDFLARE_ACCESS_KEY>
R2_SECRET_ACCESS_KEY=<CLOUDFLARE_SECRET_KEY>
R2_BUCKET_NAME=pocketkirana-media
R2_PUBLIC_DOMAIN=https://media.pocketkirana.in
```

---

## 2. Database Migration & Backup Procedures

1. **Verify Connectivity**:
   ```bash
   node -e "const { getPostgresPool } = require('./lib/postgres'); getPostgresPool().query('SELECT NOW()').then(r => console.log('Connected:', r.rows[0])).catch(console.error);"
   ```
2. **Execute Database Migration**:
   ```bash
   node scripts/init_client_postgres_tables.js
   ```
3. **Verify Sequence and Tables**:
   ```bash
   psql -U pocketkirana_app -d pocketkirana -c "\d invoice_records"
   psql -U pocketkirana_app -d pocketkirana -c "\d outbox_events"
   psql -U pocketkirana_app -d pocketkirana -c "SELECT nextval('pk_order_seq');"
   ```
4. **Automated Nightly Backup & Tested Restore**:
   ```bash
   # Daily Backup cron job (02:00 UTC)
   pg_dump -U pocketkirana_app -Fc pocketkirana > /var/backups/pocketkirana/db_$(date +%Y%m%d_%H%M%S).dump
   # Restore validation test (staging DB verification):
   pg_restore -U pocketkirana_app -d pocketkirana_restore_test /var/backups/pocketkirana/db_latest.dump
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
# Readiness check:
curl -i https://pocketkirana.in/api/health/ready
```

---

## 4. Formal Production Release Gate Progression

Software unit tests (607/607 passing) verify application logic correctness, but do **not** constitute proof of production infrastructure readiness. Production traffic must clear all six sequential gates:

```text
┌─────────────────────────────────┐
│ Gate 1: Code & Architecture     │ ──► [PASSED: 607/607 tests, 0 TS errors, 135 build pages]
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Gate 2: Staging Infrastructure  │ ──► [VPS provisioned, PG migration run, secret injected]
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Gate 3: Payment Sandbox (UAT)   │ ──► [PhonePe end-to-end sandbox webhook & 5-field check]
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Gate 4: Physical Device Testing │ ──► [Real Android APK: FCM push, OTP delivery, barcode scan]
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Gate 5: Backup & Disaster Test  │ ──► [pg_dump restore validation, outbox worker restart test]
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ Gate 6: Production Cutover      │ ──► [Live traffic opened behind Cloudflare TLS]
└─────────────────────────────────┘
```

---

## 5. Emergency Procedures & Rollback

### Stalled Outbox Events
If notifications or events are delayed:
```sql
SELECT status, count(*), min(created_at) FROM outbox_events GROUP BY status;
-- Release expired leases:
UPDATE outbox_events SET status = 'pending', lease_token = NULL WHERE status = 'processing' AND lease_expires_at < NOW();
```

### Rollback Process
1. Stop running service: `pm2 stop pocketkirana`
2. Checkout previous stable release: `git checkout <STABLE_RELEASE_TAG>`
3. Build and restart: `npm run build && pm2 start pocketkirana`
