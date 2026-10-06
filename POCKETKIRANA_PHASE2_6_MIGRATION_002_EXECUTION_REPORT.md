# PocketKirana — Phase 2.6 Migration 002 Execution Report

**Phase:** Phase 2.6 — Controlled Production Database Migration Execution  
**Migration Target:** `scripts/migrations/002_add_phase2_store_operational_settings.js`  
**Execution Roles:** Senior PostgreSQL Production Migration Engineer, Database Security Engineer  
**Database:** `pocketkirana_db` on `192.168.0.105:5433`  
**Administrative Role:** `postgres`  

---

## 1. Execution Timestamp

* **Pre-Execution Check Start:** `2026-10-02T10:18:09Z` (15:48:09 IST)
* **Transaction BEGIN:** `2026-10-02T10:18:10.309Z`
* **Transaction COMMIT:** `2026-10-02T10:18:11.459Z`
* **Execution Duration:** `1,150 ms` (~1.15 seconds)

---

## 2. Database Identity

* **Host:** `192.168.0.105`
* **Port:** `5433`
* **Database:** `pocketkirana_db`
* **Executed By Role:** `postgres` (Superuser administrative migration role)
* **Runtime Application Role:** `pk_app_user` (Preserved as DML-only runtime role)
* **PostgreSQL Engine Version:** `PostgreSQL 18.6 on x86_64-windows, compiled by msvc-19.44.35228, 64-bit`

---

## 3. Migration File SHA-256

* **Migration Script:** `scripts/migrations/002_add_phase2_store_operational_settings.js`
* **Pre-Execution Calculated SHA-256:** `b115480d0bef3c6c56793ca17ee403eb7cfa43960c28addb462595c0e33c6adf`
* **Approved SHA-256:** `b115480d0bef3c6c56793ca17ee403eb7cfa43960c28addb462595c0e33c6adf`
* **Integrity Status:** **EXACT MATCH (PASS)**

---

## 4. Backup SHA-256

* **Backup Archive Target:** `D:\pocketkirana\backups\pocketkirana_pre_migration_002_20261002.dump`
* **Archive Format:** PostgreSQL Custom Format (`-Fc`)
* **Verified Backup SHA-256:** `62273375CEABA277B2C97816542B74AC81D1D95D1681BCF9A35BBE2C5CB22A31`
* **Size:** `221,204 bytes`
* **TOC Entries:** `455`

---

## 5. Pre-Execution Baseline

Immediately prior to DDL execution, the baseline was confirmed:
* `stores`: **2** (`store_primary`, `store_central_001`)
* `orders`: **53** (25 for `store_central_001`, 9 for legacy `store-001`, 19 `NULL`)
* `warehouses`: **39**
* `inventory`: **0**
* `inventory_balances`: **49**
* `inventory_batches`: **68**
* `stock_reservations`: **0**
* `admin_users`: **0**
* Active blocking locks: **0**

---

## 6. Exact Migration Result

Migration 002 was executed using administrative credentials inside a single atomic ACID transaction.

```text
🚀 Running Migration 002: Add Phase 2 Store Operational Settings & RBAC...
Connected to PostgreSQL target database as postgres.
🔍 Executing Migration 002 Preflight Checks...
✅ Preflight checks passed successfully.
🔍 Executing Post-Migration Assertions...
✅ All post-migration assertions verified successfully.
✅ Migration 002 completed and committed successfully.
Exit Code: 0
```

---

## 7. Transaction / Rollback Result

* **Transaction Status:** **COMMITTED**
* **Rollback Invoked:** **NO**
* **Atomicity:** All schema alterations, constraint additions, index builds, in-place data updates, and table creations were executed within a single `BEGIN ... COMMIT` block.

---

## 8. Created Columns

Verified via `information_schema.columns` on table `stores`:

| Column Name | Data Type | Nullable | Default Value | Verification Result |
| :--- | :--- | :---: | :--- | :---: |
| `free_delivery_enabled` | `boolean` | `NO` | `true` | ✅ PRESENT |
| `delivery_fee_tiers` | `jsonb` | `NO` | `'[]'::jsonb` | ✅ PRESENT |

*Note: In accordance with approved business rules, `delivery_fee_tiers` defaults to empty array `[]` with zero unapproved illustrative pricing.*

---

## 9. Created Constraints

Verified via `pg_constraint` on table `stores`:

| Constraint Name | Type | Definition | Verification Result |
| :--- | :--- | :--- | :---: |
| `check_store_delivery_radius` | CHECK | `CHECK ((delivery_radius_km = ANY (ARRAY[3.00, 4.00, 5.00])))` | ✅ ACTIVE |
| `check_store_free_delivery_threshold` | CHECK | `CHECK (((free_delivery_threshold)::numeric >= 0.00))` | ✅ ACTIVE |

---

## 10. Created Indexes

Verified via `pg_indexes`:

| Table | Index Name | Definition | Verification Result |
| :--- | :--- | :--- | :---: |
| `orders` | `idx_orders_store_id` | `CREATE INDEX idx_orders_store_id ON public.orders USING btree (store_id)` | ✅ PRESENT |
| `admin_store_assignments` | `idx_admin_store_assignments_user` | `CREATE INDEX idx_admin_store_assignments_user ON public.admin_store_assignments USING btree (admin_user_id)` | ✅ PRESENT |
| `admin_store_assignments` | `idx_admin_store_assignments_store` | `CREATE INDEX idx_admin_store_assignments_store ON public.admin_store_assignments USING btree (store_id)` | ✅ PRESENT |

---

## 11. `admin_store_assignments` Result

Verified via `information_schema` and `pg_constraint`:

* **Table Existence:** `admin_store_assignments` exists in schema `public`.
* **Row Count:** Exactly `0` rows (clean table ready for administrative assignment APIs).
* **Primary Key:** `admin_store_assignments_pkey` on column `id`.
* **Unique Constraint:** `admin_store_assignments_admin_user_id_store_id_key` (`UNIQUE(admin_user_id, store_id)`).
* **Foreign Keys:**
  1. `admin_store_assignments_admin_user_id_fkey` -> `admin_users(id)` ON DELETE CASCADE.
  2. `admin_store_assignments_store_id_fkey` -> `stores(id)` ON DELETE CASCADE.
* **Component Indexes:** Both `idx_admin_store_assignments_user` and `idx_admin_store_assignments_store` are built and active.

---

## 12. Post-Migration Data Baseline

Live post-migration queries against `pocketkirana_db` confirmed zero data corruption or data loss:

* **`stores` count:** `2` (Unchanged)
* **`orders` count:** `53` (Unchanged)
* **`warehouses` count:** `39` (Unchanged)
* **`inventory` count:** `0` (Unchanged)
* **`inventory_balances` count:** `49` (Unchanged)
* **`inventory_batches` count:** `68` (Unchanged)
* **`stock_reservations` count:** `0` (Unchanged)
* **`admin_users` count:** `0` (Unchanged)
* **`admin_store_assignments` count:** `0` (Newly created)

---

## 13. Order Integrity Verification

* **Historical Orders Protected:** Exactly `53` orders preserved.
* **Store Distribution Unchanged:**
  * `store_central_001`: **25 orders**
  * `store-001` (legacy string): **9 orders**
  * `store_id IS NULL`: **19 orders**
* **Foreign Key Check on `orders.store_id`:**
  * Querying `information_schema.table_constraints` confirmed: **ZERO foreign keys exist on `orders.store_id`**.
  * Legacy orders remain completely safe from foreign key constraint violations.

---

## 14. Store Integrity Verification

Both operational stores were inspected post-migration:

### A. Store `store_central_001` (Code: `PK-STORE-01`)
* `is_active`: `true`
* Coordinates: Latitude `19.02245360`, Longitude `73.32100180` (Unchanged)
* `delivery_radius_km`: `3.00` (Satisfies CHECK constraint)
* `minimum_order_value`: `0` (In-place retired from 199.00 to 0.00; column default is now `0.00`)
* `delivery_fee`: `29.00` (Preserved as fallback)
* `free_delivery_threshold`: `499.00` (Preserved)
* `free_delivery_enabled`: `true` (New column applied)
* `delivery_fee_tiers`: `[]` (New column applied as empty JSON array)
* Deprecated columns: `max_road_distance_km` (4.5) and `road_distance_multiplier` (1.35) retained with deprecation comments.

### B. Store `store_primary` (Code: `STORE-001`)
* `is_active`: `true`
* Coordinates: Latitude `19.02245360`, Longitude `73.32100180` (Unchanged)
* `delivery_radius_km`: `3.00` (Satisfies CHECK constraint)
* `minimum_order_value`: `0` (In-place retired from 199.00 to 0.00; column default is now `0.00`)
* `delivery_fee`: `29.00` (Preserved as fallback)
* `free_delivery_threshold`: `499.00` (Preserved)
* `free_delivery_enabled`: `true` (New column applied)
* `delivery_fee_tiers`: `[]` (New column applied as empty JSON array)
* Deprecated columns: `max_road_distance_km` (4.5) and `road_distance_multiplier` (1.35) retained with deprecation comments.

---

## 15. Unexpected-Change Check

* **Unexpected Tables Created:** `0` (Only `admin_store_assignments` was created).
* **Unexpected Indexes Created:** `0` (No `idx_stores_is_active` or unapproved indexes created).
* **Unexpected Constraints Created:** `0` (Only the two approved CHECK constraints and `admin_store_assignments` constraints created).
* **Unrelated Data Changes:** `0` (Inventory, orders, warehouses, and user data remain identical to baseline).
* **Application Code Changes:** `0` (Zero application code modified).
* **Git Working Tree Changes:** `0` (Tracked working tree is 100% clean).

---

## 16. Final Status

==================================================  
### MIGRATION 002 EXECUTED SUCCESSFULLY  
==================================================

Migration 002 has committed cleanly to `pocketkirana_db`. All post-migration assertions, data integrity checks, order safety rules, and schema invariants have passed.

**Next Steps (Phase 2.7):** Application code alignment (checkout tax removal, serviceability straight-line radius enforcement, and admin store assignment APIs). Awaiting project owner authorization before proceeding.
