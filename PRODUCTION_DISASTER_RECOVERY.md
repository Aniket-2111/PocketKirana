# POCKETKIRANA — PRODUCTION BACKUP & DISASTER RECOVERY (DR) PLAN

**RPO (Recovery Point Objective):** $< 15$ minutes  
**RTO (Recovery Time Objective):** $< 60$ minutes  
**Core Resilience Tenet:** Complete failure or destruction of the Oracle VPS compute node must **never** cause permanent data loss or irrecoverable downtime.  

---

## 1. Multi-Layered Backup Strategy

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Disaster Recovery Sources                       │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 1. Application    │ 2. PostgreSQL     │ 3. Media & Assets              │
│    Codebase       │    Business Data  │                                │
│                   │                   │                                │
│ GitHub Repository │ Daily Logical     │ Cloudflare R2                  │
│ (Aniket-2111/     │ pg_dump + WAL     │ Object Storage                 │
│ PocketKirana)     │ Continuous Stream │ (pocketkirana-catalog-images)  │
└─────────┬─────────┴─────────┬─────────┴───────────────┬────────────────┘
          │                   │                         │
          ▼                   ▼                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Offsite Cloud Vault (External Object Storage)              │
│  - Encrypted Backups (GPG / AES-256)                                   │
│  - Independent Cloud Region / Cloud Provider                           │
│  - 30-Day Rolling Retention Window                                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Automated PostgreSQL Backup Procedures

### A. Daily Automated Logical Backup (`pg_dump`)
Scheduled daily at `02:00 IST` via cron on the Oracle VPS:

```bash
#!/bin/bash
# /home/pocketkirana/scripts/backup_postgres.sh
set -eo pipefail

BACKUP_DIR="/home/pocketkirana/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="pocketkirana_db_${DATE}.sql.gz"
TARGET="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

# Execute compressed custom-format pg_dump using pk_migrator (has full schema read rights)
PGPASSWORD="${DB_MIGRATOR_PASSWORD}" pg_dump \
  -h 127.0.0.1 \
  -U pk_migrator \
  -d pocketkirana_db \
  -F c \
  -b \
  -v \
  -f "${TARGET}"

# Encrypt backup with OpenSSL or GPG
openssl enc -aes-256-cbc -salt -in "${TARGET}" -out "${TARGET}.enc" -pass file:/home/pocketkirana/.backup_secret
rm -f "${TARGET}"

# Sync to offsite Cloud Storage (OCI Object Storage / S3 / R2 backup bucket)
# rclone copy "${TARGET}.enc" remote:pocketkirana-db-backups/daily/

# Retain 7 days locally
find "${BACKUP_DIR}" -name "*.enc" -mtime +7 -delete

echo "[Backup Success] ${FILENAME}.enc created and synced."
```

---

## 3. Database Restore & Verification Runbook

### Step 1: Prepare Clean Target Database
```bash
sudo -u postgres psql -c "DROP DATABASE IF EXISTS pocketkirana_db_restore_test;"
sudo -u postgres psql -c "CREATE DATABASE pocketkirana_db_restore_test OWNER pk_migrator;"
```

### Step 2: Decrypt Backup Artifact
```bash
openssl enc -d -aes-256-cbc -in pocketkirana_db_20260927_020000.sql.gz.enc \
  -out restored_dump.sql.gz -pass file:/home/pocketkirana/.backup_secret
```

### Step 3: Execute Restore via `pg_restore`
```bash
pg_restore -h 127.0.0.1 -U pk_migrator -d pocketkirana_db_restore_test -v restored_dump.sql.gz
```

### Step 4: Verify Schema & Record Integrity
```bash
psql -h 127.0.0.1 -U pk_app_user -d pocketkirana_db_restore_test -c "
  SELECT 
    (SELECT COUNT(*) FROM products) as products_count,
    (SELECT COUNT(*) FROM orders) as orders_count,
    (SELECT COUNT(*) FROM users) as users_count;
"
```

---

## 4. Full VPS Rebuild & Total Loss Recovery Scenario

If the primary Oracle VPS instance is destroyed, follow this recovery order:

1. **Spin up a new Ubuntu 24.04 LTS instance** in Oracle Cloud Infrastructure (or any cloud VPS provider).
2. **Apply OS & Security Hardening:**
   - Follow [`ORACLE_VPS_PRODUCTION_SETUP.md`](file:///d:/pocketkirana/ORACLE_VPS_PRODUCTION_SETUP.md).
   - Install Node.js 20 LTS, PM2, PostgreSQL 16, and UFW.
3. **Restore PostgreSQL Database:**
   - Download the latest encrypted backup `.enc` from offsite cloud vault.
   - Decrypt and restore via `pg_restore` into new PostgreSQL database.
4. **Clone Codebase:**
   - Clone `git clone https://github.com/Aniket-2111/PocketKirana.git`.
   - Run `npm ci && npm run build`.
5. **Restore Production Secrets:**
   - Populate `/home/pocketkirana/app/.env.production` from secure password manager vault.
6. **Start Application & Outbox Worker:**
   - `pm2 start ecosystem.config.js --env production && pm2 save`.
7. **Reconnect Cloudflare Tunnel:**
   - Reinstall `cloudflared` and configure `/etc/cloudflared/config.yml`.
   - Start `cloudflared` systemd service.
   - Tunnel reconnects automatically to Cloudflare edge—**zero DNS changes needed!**
8. **Run Verification Probe:**
   - Verify `curl https://api.pocketkirana.com/api/health?deep=true`.
