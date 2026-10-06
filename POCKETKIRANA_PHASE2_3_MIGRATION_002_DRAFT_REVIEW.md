# POCKETKIRANA — PHASE 2.3 MIGRATION 002 DRAFT REVIEW

**Date:** 2026-10-02  
**Role:** Senior PostgreSQL Migration Engineer & Production Database Security Reviewer  
**Status:** DRAFT ONLY — NOT EXECUTED  
**Target Migration:** `scripts/migrations/002_add_phase2_store_operational_settings.js`  
**Target Database:** `pocketkirana_db` on `192.168.0.105:5433` (PostgreSQL 18.6)  

---

# 1. Draft Summary

Migration 002 has been drafted strictly in accordance with the Phase 2 approved business rules and the Phase 2.1 & 2.2 database architecture decisions.

The migration establishes:
* Store-specific straight-line service radius constrained strictly to `(3.00, 4.00, 5.00)`.
* Flexible range-based delivery fee pricing via a `delivery_fee_tiers JSONB` column.
* Store-specific free delivery management via `free_delivery_enabled BOOLEAN` and a non-negative threshold check constraint.
* Minimum order value in-place retirement (setting default and existing rows to `0.00`).
* Formal deprecation metadata comments on legacy road-distance columns.
* Read optimization index on `orders(store_id)`.
* Multi-store admin assignment structure via `admin_store_assignments` table.

**CRITICAL SAFETY NOTE:** This migration has **NOT been executed**. It is presented in source form for manual inspection and approval.

---

# 2. Migration File Path

The drafted migration file is located at:
```text
scripts/migrations/002_add_phase2_store_operational_settings.js
```

---

# 3. Exact Changes Included

| Change | Included? | Reason |
| :--- | :---: | :--- |
| **`free_delivery_enabled`** | **YES** | Adds `BOOLEAN NOT NULL DEFAULT true` to `stores` for independent promotional control per darkstore. |
| **`delivery_fee_tiers`** | **YES** | Adds `JSONB NOT NULL DEFAULT '[]'::jsonb` to `stores` for range-based delivery pricing. |
| **`check_store_delivery_radius`** | **YES** | Adds `CHECK (delivery_radius_km IN (3.00, 4.00, 5.00))` constraint to enforce canonical straight-line geofences. |
| **`check_store_free_delivery_threshold`** | **YES** | Adds `CHECK (free_delivery_threshold >= 0.00)` constraint to prevent negative threshold anomalies. |
| **`minimum_order_value retirement`** | **YES** | Sets default to `0.00` and executes `UPDATE stores SET minimum_order_value = 0.00` in-place, eliminating order-size barriers without breaking column schema. |
| **Road Cutoffs Deprecation Comments** | **YES** | Attaches SQL `COMMENT ON COLUMN` to `max_road_distance_km` and `road_distance_multiplier` formally marking them deprecated. |
| **`idx_orders_store_id`** | **YES** | Creates btree index on `orders(store_id)` to optimize store-filtered queries and order administration. |
| **`admin_store_assignments` table** | **YES** | Creates child table with foreign keys to `admin_users(id)` and `stores(id)` with `UNIQUE(admin_user_id, store_id)` for scoped admin access. |
| **`orders.store_id` Foreign Key** | ❌ **NO** | **EXCLUDED BY DESIGN.** 19 historical orders have NULL `store_id` and 9 have legacy `'store-001'`. Adding an FK in Migration 002 would cause immediate failure. |

---

# 4. Business Values NOT Chosen

To preserve complete business neutrality and prevent unauthorized pricing injection:
1. **NO Final Delivery-Fee Tiers Seeded:** The migration defaults `delivery_fee_tiers` strictly to an empty JSONB array (`'[]'::jsonb`).
2. **NO Illustrative Pricing Inserted:** The previous example amounts (`₹35`, `₹25`, `₹15`) have **NOT** been inserted into the database.
3. **NO Promotion of Flat ₹29:** The existing Phase 1B provisional fee (`₹29`) has **NOT** been codified as an authoritative new business rule.
4. **Temporary Fallback Documentation:** If the backend reads an empty tier array (`[]`), application logic will fallback to the existing `stores.delivery_fee` (provisional ₹29) until the project owner configures the authoritative tiers via the Admin Panel.

---

# 5. Data Preservation Review

The migration draft guarantees complete preservation of all existing production/staging records:
* **Stores Preserved:** Preflight and post-migration assertions verify that both `store_primary` and `store_central_001` remain present and active (store count remains exactly 2).
* **Coordinates Untouched:** Latitude (`19.02245360`) and longitude (`73.32100180`) remain completely unmodified.
* **Orders Untouched:** All 53 existing orders in `orders` remain completely untouched. No historical order is updated, deleted, or backfilled during this migration.
* **Inventory Untouched:** All warehouse balances (49 rows) and batches (68 rows) remain completely untouched.

---

# 6. Foreign Key Safety

```text
orders.store_id FK = NOT INCLUDED
```

### Forensic Technical Reason:
Current order data contains:
* **19 orders** with `store_id IS NULL`
* **9 orders** with `store_id = 'store-001'` (which matches store code `STORE-001`, but does NOT match primary key `store_primary`)
* **25 orders** with `store_id = 'store_central_001'`

If `ALTER TABLE orders ADD CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES stores(id)` were included in Migration 002, PostgreSQL would execute referential validation against all 53 existing rows. Because `'store-001'` does not exist in `stores.id`, **the transaction would immediately abort with a foreign key violation error**.

Excluding the foreign key while adding the performance index `idx_orders_store_id` ensures full read performance without data migration risk.

---

# 7. Security Review

### Role Privilege Architecture:
* **`pk_app_user` (Runtime Application Role):**
  * Granted strictly: DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
  * Has ZERO DDL privileges (`CREATE`, `ALTER`, `DROP`).
  * Migration runner includes an explicit pre-flight identity check:
    ```javascript
    if (current_user === 'pk_app_user' || session_user === 'pk_app_user') {
      throw new Error('Refusing schema migration with runtime role pk_app_user.');
    }
    ```
* **`postgres` (Administrative Migration Role):**
  * Superuser / table owner.
  * Connects via `ADMIN_DATABASE_URL` or `POSTGRES_ADMIN_USER` + `POSTGRES_ADMIN_PASSWORD`.
  * Preserves strict least-privilege separation.

---

# 8. Transaction Review

Migration 002 executes strictly inside an atomic ACID transaction:
```sql
BEGIN;
  -- DDL Schema Changes
  -- Constraints & Indexes
  -- Table Creation
  -- Verification Assertions
COMMIT;
```

* **Atomic Rollback:** If any statement fails (e.g., unexpected data type, disk error, or assertion failure), PostgreSQL executes an automatic `ROLLBACK`, leaving the database in its exact pre-migration state.
* **Metadata-Only Updates:** In PostgreSQL 11+, adding columns with defaults (`free_delivery_enabled BOOLEAN DEFAULT true` and `delivery_fee_tiers JSONB DEFAULT '[]'::jsonb`) performs an $O(1)$ catalog update with zero table rewrite and zero exclusive table locking.

---

# 9. Preflight Checks

The script executes 5 read-only safety checks prior to issuing `BEGIN`:
1. **Database Identity:** Asserts `current_database()` is `pocketkirana_db` or `pocketkirana`.
2. **Table Existence:** Asserts `stores`, `orders`, and `admin_users` exist in `public` schema.
3. **Store Count & Records:** Asserts store row count is exactly 2 and both `store_primary` and `store_central_001` exist.
4. **Radius Integrity:** Queries `stores` to verify all existing rows have radius in `(3.00, 4.00, 5.00)` before applying the CHECK constraint.
5. **Orders Integrity:** Asserts that existing order records are present and readable.

---

# 10. Post-Migration Verification

Before issuing `COMMIT`, the script executes 7 programmatic verification queries:
1. Verifies `free_delivery_enabled` and `delivery_fee_tiers` exist on `stores`.
2. Verifies constraints `check_store_delivery_radius` and `check_store_free_delivery_threshold` exist.
3. Verifies all store rows have `minimum_order_value = 0.00`.
4. Verifies index `idx_orders_store_id` exists in `pg_indexes`.
5. Verifies that **NO foreign key** was accidentally added to `orders.store_id`.
6. Verifies table `admin_store_assignments` exists with foreign keys to `admin_users` and `stores`.
7. Verifies store row count remains exactly 2.

---

# 11. Rollback Strategy

### Automatic Transaction Rollback:
If an error occurs at any point during execution, the runner catches the exception and executes:
```sql
ROLLBACK;
```
Because all DDL in Migration 002 is transactional, the database returns to its exact pre-migration state with zero residual artifacts.

### Manual Reversal Script (Technical Schema Rollback):
In the event that a committed Migration 002 must be reverted in staging, the technical rollback SQL reverses only the schema objects introduced by Migration 002:
```sql
BEGIN;
  DROP TABLE IF EXISTS admin_store_assignments;
  DROP INDEX IF EXISTS idx_orders_store_id;
  ALTER TABLE stores DROP CONSTRAINT IF EXISTS check_store_delivery_radius;
  ALTER TABLE stores DROP CONSTRAINT IF EXISTS check_store_free_delivery_threshold;
  ALTER TABLE stores DROP COLUMN IF EXISTS free_delivery_enabled;
  ALTER TABLE stores DROP COLUMN IF EXISTS delivery_fee_tiers;
COMMIT;
```

### Business-Rule Rollback Separation (Critical Policy):
* **Technical Rollback:** Safely removes the newly introduced columns, table, index, and check constraints as shown above.
* **Business-Rule Rollback:** The minimum-order value of ₹199 has been explicitly and permanently retired as a business rule ("No minimum-order requirement").
* **Prohibition of Silent Reversion:** Technical rollback does **NOT** execute `ALTER COLUMN minimum_order_value SET DEFAULT 199.00` or `UPDATE stores SET minimum_order_value = 199.00`. Restoring a minimum-order requirement or introducing a new threshold requires a **separate, explicitly authorized business decision and migration**, preventing accidental reintroduction of a retired business rule during technical recovery.

---

# 12. Files Changed

Strictly 2 files were created or modified during this task:
1. `scripts/migrations/002_add_phase2_store_operational_settings.js` (NEW migration draft script)
2. `POCKETKIRANA_PHASE2_3_MIGRATION_002_DRAFT_REVIEW.md` (NEW review artifact)

---

# 13. Execution Status

```text
Migration 002 CREATED: YES
Migration 002 EXECUTED: NO
Database modified: NO
Application code modified: NO
Deployment performed: NO
```

---

# 14. Final Gate

```text
================================================================================
MIGRATION 002 DRAFT STATUS:
READY FOR MANUAL MIGRATION 002 REVIEW
================================================================================
```

---

# FINAL STOP CONDITION REACHED

Migration 002 has been drafted and reviewed.  
The migration has **NOT been executed**.  
The database has **NOT been modified**.  
Awaiting your manual review and authorization before any migration execution step is initiated.
