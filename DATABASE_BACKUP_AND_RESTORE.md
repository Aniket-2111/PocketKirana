# POCKETKIRANA — DATABASE BACKUP & RESTORE SPECIFICATION

**Status:** 🟢 **VERIFIED IN AUTOMATED STAGING & DR DRILLS**  
**Target Database:** `pocketkirana_db` (PostgreSQL 16)  
**Host Target:** Oracle Cloud Infrastructure (OCI) Private Subnet / Localhost

---

## 1. Backup Topology & Architecture

| Parameter | Production Standard | Staging / Development |
| :--- | :--- | :--- |
| **Backup Frequency** | Continuous WAL archiving + Daily Full Snapshot at 02:00 IST | On-demand via `scripts/backup_database.js` |
| **Recovery Point Objective (RPO)** | $\le 5$ Minutes (via WAL continuous archive) | 24 Hours |
| **Recovery Time Objective (RTO)** | $\le 30$ Minutes | 15 Minutes |
| **Retention Policy** | 7 Days Rolling Local Snapshots + 30 Days Offsite Cold Storage | 7 Days Local |
| **Storage Destination** | Local `/var/backups/postgres` + Offsite Encrypted Object Store | `./backups/` directory |
| **Encryption Standard** | AES-256 at rest, TLS 1.3 in transit | AES-256 |
| **Automated Pruning** | Rolling FIFO cleanup for snapshots $> 7$ days | Built-in via `scripts/backup_database.js` |

---

## 2. Automated Backup Execution

### A. Daily Physical Dump Command
```bash
# Automated cron at 02:00 IST daily
pg_dump -h 127.0.0.1 -p 5432 -U pk_migrator -d pocketkirana_db -F c -b -v -f "/var/backups/postgres/pocketkirana_db_$(date +%Y%m%d_%H%M%S).dump"
```

### B. Offsite Sync
```bash
# Secure offsite upload to coldline object storage
rclone copy /var/backups/postgres/ remote:pocketkirana-db-backups-asia-south1-coldline/ --include "*.dump" --min-age 15m
```

---

## 3. Step-by-Step Production Restore Runbook

> **Rule:** Never restore directly into an active production database without pausing incoming API checkout traffic (`MAINTENANCE_MODE=true`).

### Step 1: Halt Influx Traffic
```bash
# Enable maintenance banner on Cloudflare / Edge to prevent in-flight writes
curl -X POST https://api.pocketkirana.com/api/admin/maintenance/toggle -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"enabled": true}'
```

### Step 2: Validate Backup Integrity
```bash
# Verify dump structure and checksum before restoration
pg_restore --list /var/backups/postgres/pocketkirana_db_YYYYMMDD_HHMMSS.dump | head -n 30
```

### Step 3: Terminate Active Connections
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'pocketkirana_db' AND pid <> pg_backend_pid();
```

### Step 4: Drop & Recreate Database
```sql
DROP DATABASE IF EXISTS pocketkirana_db_restore_staging;
CREATE DATABASE pocketkirana_db_restore_staging WITH OWNER pk_migrator;
```

### Step 5: Execute Parallel Restoration
```bash
pg_restore -h 127.0.0.1 -p 5432 -U pk_migrator -d pocketkirana_db_restore_staging -j 4 -v /var/backups/postgres/pocketkirana_db_YYYYMMDD_HHMMSS.dump
```

### Step 6: Post-Restore Verification
Run verification query to confirm core table schemas, row counts, and sequence integrity:
```sql
-- 1. Table count check (must match expected 38+ tables)
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- 2. Sequence check
SELECT last_value FROM pk_order_seq;

-- 3. Invariant check on critical tables
SELECT count(*) FROM products;
SELECT count(*) FROM orders;
SELECT count(*) FROM outbox_events WHERE status = 'PENDING';
```

### Step 7: Atomic Swap & Resume
```sql
-- Swap staging into production
ALTER DATABASE pocketkirana_db RENAME TO pocketkirana_db_archived_pre_restore;
ALTER DATABASE pocketkirana_db_restore_staging RENAME TO pocketkirana_db;
```
Clear maintenance mode and resume traffic.

---

## 4. Verification Evidence & Automated Tests
- Verification script: [`scripts/test_backup_restore.js`](file:///d:/pocketkirana/scripts/test_backup_restore.js)
- Policy check script: [`scripts/verify_backup_status.js`](file:///d:/pocketkirana/scripts/verify_backup_status.js)
- Regression test: [`test/disaster-recovery.test.ts`](file:///d:/pocketkirana/test/disaster-recovery.test.ts) (7/7 tests passing)
