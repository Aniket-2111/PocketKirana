# PocketKirana — Backup & Disaster Recovery Architecture

---

## 1. Backup Strategy & Automation

### Daily Local & Encrypted Backup:
* **Script:** `scripts/backup_database.js`
* **Output Path:** `backups/db_backup_YYYY-MM-DD_HHmmss.json` (or `.sql`)
* **Tables Captured:** All 38 relational tables, complete product variants, FEFO batch allocations, orders, and ledger events.

### Recommended Offsite Cloud Storage Strategy:
```text
PostgreSQL 16 (Local DB)
         │
         ▼ (Automated 02:00 AM Cron)
scripts/backup_database.js
         │
         ▼
Local Compressed Snapshot (backups/)
         │
         ▼ (GCS / AWS S3 CLI Sync)
gsutil cp backups/*.json gs://pocketkirana-db-backups/
         │
         ▼
30-Day Retention & Object Versioning Lifecycle
```

---

## 2. Disaster Recovery & Restoration Verification

### Restore Verification Script:
```bash
node scripts/test_backup_restore.js
```

### Manual Database Recovery Procedure:
1. **Provision Fresh Database:** `CREATE DATABASE pocketkirana_db;`
2. **Initialize Schema DDL:** `node scripts/init_client_postgres_tables.js`
3. **Restore Data Snapshot:** Import JSON snapshot from `backups/` archive.
4. **Run Health Diagnostic:** `node scripts/test_client_postgres.js`
5. **Verify Table Integrity:** `node scripts/audit_postgres_schema.js`
