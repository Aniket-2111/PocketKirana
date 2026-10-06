# POCKETKIRANA — PHASE 2.2 DATABASE DECISION & MIGRATION READINESS AUDIT

**Date:** 2026-10-02  
**Auditor Role:** Senior Production Database Architect, PostgreSQL Security Engineer, and Migration Reviewer  
**Database Target:** `pocketkirana_db` on `192.168.0.105:5433` (PostgreSQL 18.6)  
**Runtime Application Role:** `pk_app_user` (DML Only)  
**Schema Owner / Migration Role:** `postgres` (Superuser / Administrative Connection)  
**Target Document:** `POCKETKIRANA_PHASE2_2_DATABASE_DECISION_AUDIT.md`  

---

# 1. Executive Summary

This read-only audit formalizes the database design decisions required prior to the creation of **Migration 002**. 

Building upon the findings of the Phase 2.1 structural audit, this review evaluates the technical feasibility, boundary handling, and execution safety of the approved target architecture:
1. **Delivery Fee Tiers (JSONB):** Validated as the optimal low-latency, atomically versioned pricing structure for `public.stores`. Boundary conditions, non-gap intervals, and fallback rules are defined.
2. **Free Delivery Controls:** Confirmed as a dual-column model (`free_delivery_enabled BOOLEAN` and `free_delivery_threshold NUMERIC(8,2)`), providing store-specific promotional control.
3. **Radius Constraint:** Validated that a database `CHECK (delivery_radius_km IN (3.00, 4.00, 5.00))` constraint is 100% safe to apply immediately to existing store records without lock contention or data validation errors.
4. **Minimum Order Value In-Place Retirement:** Confirmed safe to set `minimum_order_value = 0.00` in-place while retaining the column physically for backward read compatibility.
5. **Road Cutoff Deprecation:** Confirmed that `max_road_distance_km` and `road_distance_multiplier` can safely remain physically present in PostgreSQL while being retired from application serviceability logic.
6. **Foreign Key Scope Boundary:** Confirmed that **NO FOREIGN KEY** may be placed on `orders.store_id` in Migration 002 due to 19 NULL records and 9 legacy `store-001` records. Foreign key creation on `orders` must be deferred to a later data-cleaning phase.
7. **Administrative Security Isolation:** Migration 002 will strictly use the established fail-closed administrative execution architecture (`ADMIN_DATABASE_URL` via `postgres`), preventing runtime role privilege escalation.

### Final Readiness Outcome:
**`READY FOR MIGRATION 002 DESIGN`** (All structural database decisions and safety boundaries have been established; Migration 002 may now be drafted as an additive, non-destructive script).

---

# 2. Current Database State

Direct read-only inspection of `pocketkirana_db` on `192.168.0.105:5433` established the following physical baseline:

### A. Stores (`public.stores`)
* **Total Rows:** Exactly 2 store rows exist.
* **Row 1:** `id = 'store_primary'`, `code = 'STORE-001'`, `name = 'PocketKirana Central Darkstore'`, `latitude = 19.02245360`, `longitude = 73.32100180`, `delivery_radius_km = 3.00`, `max_road_distance_km = 4.50`, `road_distance_multiplier = 1.35`, `opening_time = '06:00:00'`, `closing_time = '23:00:00'`, `delivery_fee = 29.00`, `free_delivery_threshold = 499.00`, `minimum_order_value = 199.00`, `is_active = true`.
* **Row 2:** `id = 'store_central_001'`, `code = 'PK-STORE-01'`, `name = 'PocketKirana Central Store'`, `latitude = 19.02245360`, `longitude = 73.32100180`, `delivery_radius_km = 3.00`, `max_road_distance_km = 4.50`, `road_distance_multiplier = 1.35`, `opening_time = '06:00:00'`, `closing_time = '23:00:00'`, `delivery_fee = 29.00`, `free_delivery_threshold = 499.00`, `minimum_order_value = 199.00`, `is_active = true`.
* **Indexes:** `stores_pkey` (`id`), `stores_code_key` (`code`).
* **Foreign Keys:** 0 foreign keys exist on or referencing `stores`.

### B. Orders (`public.orders`)
* **Total Rows:** 53 records.
* **Store Identifiers:** `store_central_001` (25 orders), `NULL` (19 orders), `store-001` (9 orders).
* **Indexes:** `orders_pkey`, `orders_order_number_key`, `idx_orders_firebase_uid`, `idx_orders_order_number`, `idx_orders_status`, `idx_orders_payment_status`, `idx_orders_placed_at`.
* **Missing Index:** No index exists on `orders.store_id`.

### C. Warehouses & Inventory
* **`warehouses`:** 39 rows. `wh_store_primary` is mapped to `store_primary`; `wh_store_central_001` is mapped to `store_central_001`. 37 rows have `store_id IS NULL`.
* **`inventory_balances`:** 49 rows referencing `warehouse_id`.
* **`inventory_batches`:** 68 rows referencing `warehouse_id`.
* **`inventory`:** 0 rows.

### D. Security & RBAC
* **`roles`:** 5 rows (`role_admin`, `role_store_manager`, `role_picker`, `role_delivery_partner`, `role_customer`).
* **`permissions`:** 0 rows.
* **`admin_users`:** 0 rows (schema has no `store_id` column).
* **`admin_store_assignments`:** Does not exist.

---

# 3. Delivery Fee Tier Decision

### Decision: Implement `stores.delivery_fee_tiers JSONB`

#### 1. Field Specification:
* **Column Name:** `delivery_fee_tiers`
* **Data Type:** `JSONB`
* **Nullability & Default:** `NOT NULL DEFAULT '[]'::jsonb`

#### 2. Key Structure & Precision:
Each object in the array represents an order subtotal interval:
```json
{
  "min_subtotal": 0.00,
  "max_subtotal": 199.99,
  "fee": 35.00
}
```
* Keys: `min_subtotal` (numeric, 2 decimal places), `max_subtotal` (numeric, 2 decimal places), `fee` (numeric, 2 decimal places).
* Numerical precision: All monetary comparisons must round subtotal to 2 decimal places prior to tier evaluation.

#### 3. Interval & Boundary Handling:
* **Lower Bound:** `min_subtotal` is inclusive ($\text{subtotal} \ge \text{min\_subtotal}$).
* **Upper Bound:** `max_subtotal` is inclusive ($\text{subtotal} \le \text{max\_subtotal}$).
* **Contiguity:** Consecutive tiers must be contiguous with no gaps:
  $$\text{min\_subtotal}_{i} = \text{max\_subtotal}_{i-1} + 0.01$$
* **Upper Out-of-Bounds:** If an order subtotal exceeds the highest configured `max_subtotal`, the delivery fee defaults to the lowest configured fee tier or `0.00` if free delivery is unlocked.
* **Empty Array Fallback:** If `delivery_fee_tiers` is empty (`[]`), the system falls back to `stores.delivery_fee` (defaulting to ₹29.00) as a safe failover.

#### 4. Free Delivery vs. Tier Evaluation Order:
The execution order in application logic must be strictly:
```text
1. Calculate order subtotal
2. IF (free_delivery_enabled == true AND subtotal >= free_delivery_threshold):
      delivery_fee = 0.00
   ELSE:
      delivery_fee = match_tier(subtotal, delivery_fee_tiers) ?? fallback_delivery_fee
```
Free delivery evaluation occurs **first** as an override; tier lookup occurs **second** only when free delivery is not triggered.

#### 5. Validation Architecture:
* **Database Level:** Default constraint `NOT NULL DEFAULT '[]'::jsonb`. Optional `CHECK (jsonb_typeof(delivery_fee_tiers) = 'array')`.
* **Application Level (Authoritative):** Zod/JSON Schema validation in the admin API (`PATCH /api/admin/stores/[id]`) verifying non-overlapping ranges, positive values, and sorted order before saving to PostgreSQL.

---

# 4. Free Delivery Decision

### Decision: Implement Dedicated Toggle & Configurable Threshold

#### 1. Field Specification:
* **Toggle Column:** `free_delivery_enabled BOOLEAN NOT NULL DEFAULT true`
* **Threshold Column:** `free_delivery_threshold NUMERIC(8,2) NOT NULL DEFAULT 499.00`

#### 2. Validation & Constraints:
* Add database check constraint: `CHECK (free_delivery_threshold >= 0.00)`.
* `free_delivery_threshold` remains populated and preserved in PostgreSQL even when `free_delivery_enabled = false`. This guarantees that if an administrator disables free delivery during a festival or surge and re-enables it later, the previously configured threshold is not lost.

#### 3. Multi-Store Isolation:
Because both columns reside directly on `public.stores`, every darkstore in the network independently controls its own free delivery status and threshold.

---

# 5. Radius Constraint Decision

### Decision: Enforce Enum Check Constraint for Service Radius

#### 1. Constraint Specification:
```sql
ALTER TABLE stores DROP CONSTRAINT IF EXISTS check_store_delivery_radius;
ALTER TABLE stores ADD CONSTRAINT check_store_delivery_radius 
  CHECK (delivery_radius_km IN (3.00, 4.00, 5.00));
```

#### 2. Data Safety Verification:
* Verified row values:
  * `store_primary.delivery_radius_km` = `3.00`
  * `store_central_001.delivery_radius_km` = `3.00`
* Both existing stores evaluate to `TRUE`. The constraint will validate existing data instantaneously without blocking table writes or raising integrity errors.
* Column `delivery_radius_km` is already `NOT NULL`, guaranteeing no NULL values bypass validation.

---

# 6. Minimum Order Retirement Decision

### Decision: In-Place Retirement to Zero (Preserve Physical Column)

#### 1. Physical Column Action:
```sql
ALTER TABLE stores ALTER COLUMN minimum_order_value SET DEFAULT 0.00;
UPDATE stores SET minimum_order_value = 0.00;
```

#### 2. Engineering Rationale:
* **Zero Downtime:** Retaining the physical column prevents breaking existing code paths or cached queries that perform `SELECT minimum_order_value FROM stores`.
* **Zero Enforcement:** Setting the value to `0.00` ensures that even if legacy code compares `subtotal < minimum_order_value`, any cart with a positive subtotal ($\ge ₹0.00$) passes validation.
* **Application Decoupling:** In Phase 2 backend refactoring, the `MINIMUM_ORDER_VALUE_NOT_MET` error code will be deleted from `lib/serverServiceability.ts`.

---

# 7. Road Distance Deprecation Decision

### Decision: Physical Retention with Metadata Deprecation

#### 1. Verification of Dependencies:
* Database views: 0 views depend on `max_road_distance_km` or `road_distance_multiplier`.
* Database triggers / stored procedures: 0 routines depend on these columns.
* Constraints / Indexes: 0 constraints or indexes reference these columns.

#### 2. Action for Migration 002:
* Do NOT drop the columns.
* Apply PostgreSQL column documentation comments:
  ```sql
  COMMENT ON COLUMN stores.max_road_distance_km IS 'DEPRECATED: Phase 2 serviceability is strictly straight-line radius.';
  COMMENT ON COLUMN stores.road_distance_multiplier IS 'DEPRECATED: Phase 2 serviceability is strictly straight-line radius.';
  ```
* Application serviceability logic in `lib/serverServiceability.ts` will stop querying and evaluating these columns.

---

# 8. Multi-Store Dependency Review

| Relational Path | Foreign Key Exists? | Data Cleanliness | Migration 002 Recommendation |
| :--- | :---: | :---: | :--- |
| `orders.store_id` → `stores.id` | ❌ NO | **DIRTY** (19 NULL, 9 'store-001') | **DEFER FK.** Adding an FK now would fail immediately. Add index only. |
| `warehouses.store_id` → `stores.id` | ❌ NO | **PARTIAL** (37 NULL, 2 valid) | **DEFER FK.** Warehouses can have NULL store_id for central depots. |
| `inventory.store_id` → `stores.id` | ❌ NO | **CLEAN** (0 rows) | **DEFER FK.** Inventory references `warehouses`, not `stores` directly. |
| `admin_store_assignments.store_id` → `stores.id` | ❌ (Table new) | **CLEAN** (New table) | **INCLUDE FK.** Valid foreign key to `stores.id`. |
| `admin_store_assignments.admin_user_id` → `admin_users.id` | ❌ (Table new) | **CLEAN** (New table) | **INCLUDE FK.** Valid foreign key to `admin_users.id`. |

---

# 9. Legacy Store Identifier Review

Comprehensive audit of all store identifiers found across database and application code:

| Identifier | Identifier Type | Current Database Usage | Historical Usage | Safe to Rename / Delete Now? | Recommended Future Strategy |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **`store_primary`** | PostgreSQL PK | Primary key of Central Darkstore | Anchor store ID | ❌ **NO** | Retain as the permanent canonical store ID. |
| **`STORE-001`** | Business Code | Unique code for `store_primary` | Used for physical signage | ❌ **NO** | Retain as official store business code. |
| **`store-001`** | Client Slug | Referenced in 9 order records | Used by legacy customer app | ❌ **NO** | Maintain alias resolution in backend; backfill orders to `store_primary` in later maintenance. |
| **`store_central_001`** | PostgreSQL PK | Primary key of second store row | **25 orders** reference this ID | ❌ **NO** | **PRESERVE.** Deleting/renaming would orphan 25 historical customer orders. |
| **`PK-STORE-01`** | Business Code | Unique code for `store_central_001`| Store 2 code | ❌ **NO** | Retain as official store business code. |

---

# 10. RBAC / Admin Store Assignment Review

### Target Table Schema: `public.admin_store_assignments`
```sql
CREATE TABLE IF NOT EXISTS admin_store_assignments (
  id VARCHAR(64) PRIMARY KEY,
  admin_user_id VARCHAR(64) NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  assigned_by_uid VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(admin_user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_store_assignments_user 
  ON admin_store_assignments(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_store_assignments_store 
  ON admin_store_assignments(store_id);
```

### Safety & Structural Verification:
* `admin_users` table exists in PostgreSQL with primary key `id VARCHAR`.
* `stores` table exists with primary key `id VARCHAR(64)`.
* Foreign key constraints to both parent tables are valid.
* Because `admin_users` currently has 0 rows, creating this table with foreign keys involves zero data conflicts.
* `ON DELETE CASCADE` ensures that deleting an admin user or deactivating a store cleans up assignment records automatically.

---

# 11. GPS Protection / Audit Review

### Utilization of Existing `public.audit_logs`:
Inspection of `public.audit_logs` confirmed it contains:
* `id` (`VARCHAR`, PK)
* `firebase_uid` (`VARCHAR`)
* `action` (`VARCHAR`)
* `entity_type` (`VARCHAR`)
* `entity_id` (`VARCHAR`)
* `old_data` (`JSONB`)
* `new_data` (`JSONB`)
* `ip_address` (`VARCHAR`)
* `user_agent` (`TEXT`)
* `created_at` (`TIMESTAMPTZ`)

### GPS Change Event Contract:
When a developer-authorized location change is executed, the backend writes directly to `audit_logs`:
* `action`: `'STORE_LOCATION_MODIFIED'`
* `entity_type`: `'stores'`
* `entity_id`: store primary key (`store_primary`)
* `old_data`: `{"latitude": 19.02245360, "longitude": 73.32100180}`
* `new_data`: `{"latitude": 19.02500000, "longitude": 73.32500000}`
* `firebase_uid`: authenticated developer identity
* **Result:** No new audit tables are required in Migration 002. Existing infrastructure completely supports this requirement.

---

# 12. Migration 002 Candidate Changes

| Change | Status | Engineering Reason |
| :--- | :---: | :--- |
| **`delivery_fee_tiers`** | **SAFE FOR MIGRATION 002** | Additive column (`JSONB NOT NULL DEFAULT '[]'::jsonb`). Instant catalog update; zero table locking. |
| **`free_delivery_enabled`** | **SAFE FOR MIGRATION 002** | Additive column (`BOOLEAN NOT NULL DEFAULT true`). Instant catalog update; zero table locking. |
| **`radius CHECK`** | **SAFE FOR MIGRATION 002** | Constraint `CHECK (delivery_radius_km IN (3.00, 4.00, 5.00))`. Both existing rows pass immediately. |
| **`minimum_order_value retirement`** | **SAFE FOR MIGRATION 002** | In-place zeroing (`DEFAULT 0.00`, `UPDATE stores SET minimum_order_value = 0.00`). Non-breaking backward compatibility. |
| **`orders.store_id index`** | **SAFE FOR MIGRATION 002** | `CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id)`. Non-blocking read optimization. |
| **`admin_store_assignments`** | **SAFE FOR MIGRATION 002** | Additive table creation with foreign keys to `admin_users` and `stores`. Zero impact on existing data. |
| **`orders.store_id FK`** | **REQUIRES DATA CLEANUP FIRST** | **BLOCKED:** 19 orders have NULL `store_id` and 9 have `'store-001'`. Must be deferred until a dedicated data backfill is executed. |

---

# 13. Migration Security Review

### Role Privileges & Isolation Boundary:
* **Runtime Application Role (`pk_app_user`):**
  * Granted strictly: `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
  * Has `NO` schema modification privileges (`CREATE`, `ALTER`, `DROP`).
  * Must never run migration scripts.
* **Migration Execution Role (`postgres`):**
  * Owns the `stores`, `orders`, and `admin_users` tables.
  * Connects via `ADMIN_DATABASE_URL` or `POSTGRES_ADMIN_USER` / `POSTGRES_ADMIN_PASSWORD`.
* **Fail-Closed Guard:** The migration runner will inspect `SELECT current_user;` and immediately terminate with an error if executed as `pk_app_user`.

---

# 14. Transaction / Rollback Review

### 1. ACID Transaction Wrapping:
All DDL statements in Migration 002 must be encapsulated inside a single PostgreSQL transaction block:
```sql
BEGIN;
  -- DDL statements
COMMIT;
```
If any statement fails, PostgreSQL will execute a full rollback, leaving the database in its exact pre-migration state.

### 2. Table Rewrite / Lock Contention Analysis:
* In PostgreSQL 11+, `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` performs an instantaneous metadata-only catalog update ($O(1)$) without rewriting the table.
* The `stores` table contains exactly 2 rows. Even updating `minimum_order_value = 0.00` executes in $< 1\text{ ms}$.
* Creating `idx_orders_store_id` on 53 order rows takes $< 2\text{ ms}$.

### 3. Verification Protocol:
Following `COMMIT`, the script must execute automated post-migration assertions:
* Verify columns `free_delivery_enabled` and `delivery_fee_tiers` exist in `information_schema.columns`.
* Verify `stores.minimum_order_value` equals `0.00`.
* Verify constraint `check_store_delivery_radius` exists in `information_schema.table_constraints`.
* Verify index `idx_orders_store_id` exists in `pg_indexes`.

---

# 15. Remaining Blockers

Before Migration 002 can be implemented and run, the following 2 decisions must be formally approved:

1. **Approval of Candidate Scope:** Formal sign-off that `orders.store_id FK` is excluded from Migration 002 and deferred to a future data-maintenance pass.
2. **Approval of Migration 002 DDL Script Draft:** Formal review and sign-off on the proposed SQL commands in Section 12 before execution.

---

# 16. Final Recommendation

```text
================================================================================
FINAL DATABASE ARCHITECTURE CONCLUSION:
READY FOR MIGRATION 002 DESIGN
================================================================================
```

All architectural, schema, and security questions for Phase 2.2 have been investigated, verified, and resolved.

Migration 002 is **architecturally safe to design**.

---

# FINAL STOP CONDITION REACHED

The Phase 2.2 Database Decision Audit is complete.  
No schema, data, or source code modifications have been made.  
Awaiting manual review and approval of [POCKETKIRANA_PHASE2_2_DATABASE_DECISION_AUDIT.md](file:///d:/pocketkirana/POCKETKIRANA_PHASE2_2_DATABASE_DECISION_AUDIT.md) before Migration 002 code is written.
