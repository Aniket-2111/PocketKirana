# PocketKirana — Phase 2.5B-1 Host Backup Verification Report

**Audit Phase:** Phase 2.5B-1 — Host-Level Pre-Migration Database Backup  
**Roles:** Senior PostgreSQL Production Backup Engineer, Database Security Engineer, Production Migration Safety Engineer  
**Report Date:** 2026-10-02  
**Target Host/Port:** `192.168.0.105:5433`  
**Target Database:** `pocketkirana_db`  
**Administrative Role:** `postgres`  

---

## 1. Executive Summary

This report documents the verification pass for Phase 2.5B-1 (Host-Level Pre-Migration Database Backup). 

In accordance with strict production safety rules, the execution environment was verified before attempting any backup operations. The verification revealed that:
1. This local machine (IP `192.168.0.100`) is a developer workstation, **not the PostgreSQL host**. Local connection on `127.0.0.1:5433` fails (`TcpTestSucceeded: False`). The PostgreSQL database instance is located on remote host `192.168.0.105:5433`.
2. PostgreSQL client utilities (`pg_dump` and `pg_restore`) are not installed on this local workstation.
3. Therefore, the backup cannot be generated from this machine and must be executed directly on the host machine `192.168.0.105`.

All database baselines, migration objects, and migration file checksums remain 100% verified and untouched.

```text
==================================================
BACKUP NOT VERIFIED — NOT READY FOR PHASE 2.6
==================================================
Blockers:
1. Workstation is not the PostgreSQL host (127.0.0.1:5433 closed; DB is at 192.168.0.105:5433).
2. BACKUP NOT CREATED — REQUIRED POSTGRESQL TOOLS UNAVAILABLE (pg_dump / pg_restore absent).
3. Pre-migration backup file D:\pocketkirana\backups\pocketkirana_pre_migration_002_20261002.dump does not exist.
```

---

## 2. PostgreSQL Host Verification (Step 1)

* **Current Machine IP:** `192.168.0.100` (Wi-Fi Interface)
* **Local Loopback Test (`127.0.0.1:5433`):**
  * `Test-NetConnection -ComputerName 127.0.0.1 -Port 5433`
  * **Result:** `TcpTestSucceeded: False` (Connection Refused / Closed)
* **Remote Host Test (`192.168.0.105:5433`):**
  * `Test-NetConnection -ComputerName 192.168.0.105 -Port 5433`
  * **Result:** `TcpTestSucceeded: True` (Open & Reachable)
* **Host Verification Finding:**
  This workstation is **NOT** the PostgreSQL host. The PostgreSQL server instance runs on `192.168.0.105:5433`.

---

## 3. Database Identity

* **Database Name:** `pocketkirana_db` (Verified via PostgreSQL query `SELECT current_database()`)
* **Administrative User:** `postgres` (Verified via `pg_roles`: `rolsuper=true`, `rolcanlogin=true`)
* **Runtime Application User:** `pk_app_user` (Verified: restricted DML only, non-superuser)
* **PostgreSQL Engine Version:** `PostgreSQL 18.6 on x86_64-windows, compiled by msvc-19.44.35228, 64-bit`

---

## 4. pg_dump / pg_restore Versions (Step 2)

* **Command Executed:** `pg_dump --version; pg_restore --version`
* **Result:**
  * `pg_dump`: The term 'pg_dump' is not recognized as the name of a cmdlet, function, script file, or operable program.
  * `pg_restore`: The term 'pg_restore' is not recognized as the name of a cmdlet, function, script file, or operable program.
* **Mandated Safety Finding:**
  > **BACKUP NOT CREATED — REQUIRED POSTGRESQL TOOLS UNAVAILABLE**

---

## 5. Backup File Path (Steps 3 & 4)

* **Directory:** `D:\pocketkirana\backups\` (Verified exists)
* **Target File Path:** `D:\pocketkirana\backups\pocketkirana_pre_migration_002_20261002.dump`
* **Existing File Presence:** `NO` (File does not exist; no collision)

---

## 6. Backup File Size

* **Size:** `0 bytes` (File not created)

---

## 7. Backup Timestamp

* **Timestamp:** `N/A`

---

## 8. SHA-256 Checksum

* **SHA-256:** `N/A`

---

## 9. pg_restore --list Result (Step 7)

* **Command:** `pg_restore --list "D:\pocketkirana\backups\pocketkirana_pre_migration_002_20261002.dump"`
* **Archive Recognized:** `NO` (File absent)
* **Status:** `NOT RUN`

---

## 10. Database Baseline Verification (Step 8)

Live read-only verification executed against `pocketkirana_db` on `192.168.0.105:5433`:

* **`stores` count:** `2`
  * `store_central_001`: Active, Latitude `19.02245360`, Longitude `73.32100180`, Radius `3.00 km`, Min Order `199.00`, Fee `29.00`, Threshold `499.00`
  * `store_primary`: Active, Latitude `19.02245360`, Longitude `73.32100180`, Radius `3.00 km`, Min Order `199.00`, Fee `29.00`, Threshold `499.00`
* **`orders` count:** `53`
  * `store_central_001`: 25 orders
  * `store-001` (legacy string): 9 orders
  * `store_id IS NULL`: 19 orders
* **`inventory_balances` count:** `49`
* **`inventory_batches` count:** `68`
* **`warehouses` count:** `39`
* **`stock_reservations` count:** `0`
* **`admin_users` count:** `0`

---

## 11. Migration 002 Object Precheck (Step 8)

Read-only inspection confirmed all Phase 2 objects remain completely absent:

* `stores.free_delivery_enabled`: ❌ ABSENT
* `stores.delivery_fee_tiers`: ❌ ABSENT
* `check_store_delivery_radius`: ❌ ABSENT
* `check_store_free_delivery_threshold`: ❌ ABSENT
* `idx_orders_store_id`: ❌ ABSENT
* `admin_store_assignments`: ❌ ABSENT

---

## 12. Migration 002 File SHA-256 (Step 9)

* **File Path:** `scripts/migrations/002_add_phase2_store_operational_settings.js`
* **Expected Hash:** `b115480d0bef3c6c56793ca17ee403eb7cfa43960c28addb462595c0e33c6adf`
* **Calculated Hash:** `b115480d0bef3c6c56793ca17ee403eb7cfa43960c28addb462595c0e33c6adf`
* **Verification Status:** **EXACT MATCH (INTEGRITY PASS)**

---

## 13. Git State (Step 10)

* **Current Branch:** `fix/page-readiness-production`
* **HEAD Commit:** `63dba53 feat: enforce canonical server-side serviceability`
* **Modified Tracked Files:** `0` (Clean tracked working tree)
* **Staged Files:** `0`
* **Untracked Documentation / Script Files:** All preserved.

---

## 14. Credential Safety

* **Password Logging / Exposure:** `NONE` (Zero passwords, tokens, full connection strings, or secrets were printed, logged, or saved to `.env.local`).
* **Role Safety:** `pk_app_user` was never used for administrative tasks.

---

## 15. Database Modification Attestation

* **Database Modified:** **NO**
* **Schema Modified:** **NO**
* **Application Data Modified:** **NO**
* **Application Code Modified:** **NO**
* **Git Modified:** **NO**
* **Migration 002 Executed:** **NO**

---

## 16. Final Gate

==================================================  
### BACKUP NOT VERIFIED — NOT READY FOR PHASE 2.6  
==================================================

### Immediate Action Required to Proceed:
On the actual PostgreSQL host machine (`192.168.0.105`), open a command terminal and execute:

```bash
pg_dump -h 127.0.0.1 -p 5433 -U postgres -Fc pocketkirana_db -f pocketkirana_pre_migration_002_20261002.dump
```

Then place `pocketkirana_pre_migration_002_20261002.dump` into:
`D:\pocketkirana\backups\`
