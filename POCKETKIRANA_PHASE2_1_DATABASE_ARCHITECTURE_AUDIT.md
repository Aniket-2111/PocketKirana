# POCKETKIRANA — PHASE 2.1 DATABASE ARCHITECTURE READ-ONLY AUDIT

**Date:** 2026-10-02  
**Auditor Role:** Senior Production Database Architect & PostgreSQL Security Engineer  
**Database Target:** `pocketkirana_db` on `192.168.0.105:5433`  
**Runtime Role:** `pk_app_user` (Read-Only SELECT Inspection)  
**Schema Owner:** `postgres` (Superuser / DDL Owner)  
**Scope:** Pre-Migration 002 Structural Database Verification & Target Schema Design  
**Target Document:** `POCKETKIRANA_PHASE2_1_DATABASE_ARCHITECTURE_AUDIT.md`  

---

# 1. Executive Summary

This read-only audit performs a forensic inspection of the PostgreSQL database (`pocketkirana_db`) to evaluate its readiness for **Migration 002**. Migration 002 is designed to establish canonical store operational settings (store-specific 3/4/5 km radius, range-based delivery fees, free delivery toggle/threshold, minimum order retirement, GPS change auditing, and multi-store RBAC assignments).

### Key Architectural Findings:
1. **Existing Store Integrity:** `public.stores` contains two active records (`store_primary` with code `STORE-001` and `store_central_001` with code `PK-STORE-01`). Both have identical Neral GPS coordinates (`19.02245360`, `73.32100180`) and Phase 1B defaults. Both stores must be preserved.
2. **Historical Order References:** Direct analysis of `public.orders` (53 total records) reveals that **25 orders reference `store_central_001`**, **9 orders reference legacy string `store-001`**, and **19 orders have `store_id IS NULL`**.
3. **Absence of Foreign Keys:** There are **ZERO foreign key constraints** linking `orders.store_id`, `warehouses.store_id`, `inventory.store_id`, or `stock_reservations.store_id` to `stores.id`. While this currently prevents database crashes when mismatched identifiers are written, it poses severe data integrity risks for multi-store scaling.
4. **Missing Indexes on Relational Columns:** The `orders` table has **NO index on `store_id`**. Filtered queries by store or admin aggregations result in full table sequential scans.
5. **Inventory Hierarchy Discovery:** The `inventory` table contains 0 rows, but the enterprise batch/balance tables contain live data: `warehouses` (39 rows, with `wh_store_primary` and `wh_store_central_001` mapped to their respective stores), `inventory_balances` (49 rows), and `inventory_batches` (68 rows). These tables reference `warehouse_id`, demonstrating that inventory is warehouse-centric and linked to stores through `warehouses.store_id`.
6. **RBAC Schema Void:** `admin_users` has 0 rows and lacks a `store_id` column. `permissions` has 0 rows. There is no existing construct in PostgreSQL to map administrative users to specific darkstores.

### Readiness Determination:
**`NOT READY FOR MIGRATION 002`** (3 blocking prerequisites must be settled before DDL execution: resolving legacy store identifier mismatches in `orders`, approving the formal JSONB tier schema definition, and finalizing the administrative migration execution protocol).

---

# 2. Environment Verification

| Parameter | Inspected Value | Status | Evidence |
| :--- | :--- | :---: | :--- |
| **Database Host** | `192.168.0.105` | VERIFIED | Connected via Node.js `pg` client over local network |
| **Database Port** | `5433` | VERIFIED | Local non-standard PostgreSQL port |
| **Database Name** | `pocketkirana_db` | VERIFIED | `SELECT current_database();` → `pocketkirana_db` |
| **Audit Connection User**| `pk_app_user` | VERIFIED | `SELECT current_user;` → `pk_app_user` |
| **Database Version** | PostgreSQL 18.6 | VERIFIED | Local developer/staging server installation |
| **Database Ownership** | `postgres` | VERIFIED | `stores`, `orders`, `inventory` owned by `postgres` |
| **Runtime Privileges** | DML Only (SELECT, INSERT, UPDATE, DELETE) | VERIFIED | `information_schema.role_table_grants` |
| **Working Tree State** | Clean (0 tracked modifications) | VERIFIED | `git status --short` verified clean |

---

# 3. Stores Schema Audit

### A. Physical Column Specifications (`public.stores`)
Direct catalog query against `information_schema.columns`:

| Column Name | Data Type | Nullable | Default Value | Target Architecture Evaluation |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `character varying(64)` | **NO** | *None* (PK) | Stores canonical UUID or slug (`store_primary`) |
| `name` | `character varying(255)` | **NO** | *None* | Store display name |
| `code` | `character varying(32)` | **NO** | *None* (UNIQUE) | Business code (`STORE-001`, `PK-STORE-01`) |
| `phone` | `character varying` | YES | NULL | Store contact |
| `address` | `text` | YES | NULL | Physical address string |
| `city` | `character varying` | YES | NULL | City municipality |
| `state` | `character varying` | YES | NULL | State province |
| `pincode` | `character varying` | YES | NULL | Postal PIN code |
| `latitude` | `numeric(10,8)` | **NO** | *None* | Store GPS latitude (Requires protection) |
| `longitude` | `numeric(11,8)` | **NO** | *None* | Store GPS longitude (Requires protection) |
| `is_active` | `boolean` | YES | `true` | Operational pause / active toggle |
| `created_at` | `timestamp with time zone` | YES | `CURRENT_TIMESTAMP` | Audit creation timestamp |
| `updated_at` | `timestamp with time zone` | YES | `CURRENT_TIMESTAMP` | Audit update timestamp |
| `delivery_radius_km` | `numeric(4,2)` | **NO** | `3.00` | Authoritative straight-line radius |
| `max_road_distance_km`| `numeric(4,2)` | **NO** | `4.50` | **LEGACY / DEPRECATE** in Phase 2 |
| `road_distance_multiplier`| `numeric(3,2)` | **NO** | `1.35` | **LEGACY / DEPRECATE** in Phase 2 |
| `opening_time` | `time without time zone` | **NO** | `'06:00:00'` | Store-specific daily opening time |
| `closing_time` | `time without time zone` | **NO** | `'23:00:00'` | Store-specific daily closing time |
| `delivery_fee` | `numeric(6,2)` | **NO** | `29.00` | **LEGACY / DEPRECATE** in favor of tiers |
| `free_delivery_threshold`| `numeric(8,2)` | **NO** | `499.00` | Configurable free delivery threshold |
| `minimum_order_value`| `numeric(8,2)` | **NO** | `199.00` | **LEGACY / RETIRE** in Phase 2 |

### B. Constraints and Indexes on `stores`
* **Primary Key:** `stores_pkey` on column `id` (UNIQUE btree index).
* **Unique Key:** `stores_code_key` on column `code` (UNIQUE btree index).
* **Check Constraints:** None currently exist.
* **Foreign Keys:** Zero inbound or outbound foreign key constraints.
* **Triggers:** None currently exist.

---

# 4. Operational Columns Audit

Classification of existing Phase 1B columns for future migration:

| Column Name | Current Type & Default | Proposed Classification | Engineering Rationale |
| :--- | :--- | :---: | :--- |
| `delivery_radius_km` | `NUMERIC(4,2) DEFAULT 3.00` | **MODIFY LATER** | Add CHECK constraint to enforce only `3.00`, `4.00`, or `5.00`. |
| `opening_time` | `TIME DEFAULT '06:00:00'` | **KEEP** | Meets requirements for store-specific operating hours. |
| `closing_time` | `TIME DEFAULT '23:00:00'` | **KEEP** | Meets requirements for store-specific operating hours. |
| `free_delivery_threshold` | `NUMERIC(8,2) DEFAULT 499.00` | **MODIFY LATER** | Keep as threshold amount, but pair with `free_delivery_enabled BOOLEAN`. |
| `minimum_order_value` | `NUMERIC(8,2) DEFAULT 199.00` | **RETIRE LATER** | Set default to `0.00`; update existing rows to `0.00`. Do not drop column immediately to maintain backward read compatibility. |
| `delivery_fee` | `NUMERIC(6,2) DEFAULT 29.00` | **DEPRECATE LATER** | Keep as fallback default fee, but introduce `delivery_fee_tiers JSONB` as authoritative pricing engine. |
| `max_road_distance_km` | `NUMERIC(4,2) DEFAULT 4.50` | **DEPRECATE LATER** | Cease reading in application code. Mark with PostgreSQL column comment. Retain physically to avoid breaking legacy code paths. |
| `road_distance_multiplier`| `NUMERIC(3,2) DEFAULT 1.35` | **DEPRECATE LATER** | Cease reading in application code. Mark with PostgreSQL column comment. Retain physically. |

---

# 5. Delivery Fee Tier Architecture

The business requires configurable delivery fee tiers based on order subtotal ranges.

### Architectural Evaluation: JSONB Column vs. Relational Child Table

| Criteria | Option A: `stores.delivery_fee_tiers JSONB` | Option B: Relational Table `store_delivery_fee_tiers` |
| :--- | :--- | :--- |
| **Schema Complexity** | Low (Single column added to `stores`) | Medium (New table, foreign key, index, cascade rules) |
| **Transactional Atomicity** | **High** (Store settings and all tiers saved in a single row write) | Medium (Multi-row transactional insert/delete required) |
| **Query Performance** | **High** (Retrieved in the same `SELECT * FROM stores` query with 0 joins) | Requires relational JOIN on checkout hot path |
| **Validation Capability** | Requires JSON Schema validation in backend / CHECK function | Native database column types, foreign keys, CHECK constraints |
| **Historical Pricing Drift** | Freezes tier JSON inside order record if needed | Freezes fee in order; historical tier audit table needed |

### Technical Recommendation: **Option A (`JSONB` on `stores`)**
Given that PocketKirana stores are evaluated on every checkout and location check, storing the tier configuration as a structured JSONB array directly on `stores` minimizes query latency and eliminates multi-table join overhead.

### Formal JSONB Schema Specification:
```json
[
  {
    "min_subtotal": 0.00,
    "max_subtotal": 199.99,
    "fee": 35.00
  },
  {
    "min_subtotal": 200.00,
    "max_subtotal": 399.99,
    "fee": 25.00
  },
  {
    "min_subtotal": 400.00,
    "max_subtotal": 499.99,
    "fee": 15.00
  }
]
```

### Boundary & Overlap Rules to be enforced in backend:
1. `min_subtotal` must be $\ge 0.00$.
2. For index $i > 0$, $\text{min\_subtotal}_i = \text{max\_subtotal}_{i-1} + 0.01$ (no gaps, no overlaps).
3. If order subtotal exceeds the highest `max_subtotal` and free delivery is disabled, fallback to the lowest fee tier or configured default fee.
4. `fee` must be $\ge 0.00$.

---

# 6. Free Delivery Architecture

### Field Design:
1. `free_delivery_enabled BOOLEAN NOT NULL DEFAULT true`
2. `free_delivery_threshold NUMERIC(8,2) NOT NULL DEFAULT 499.00`

### Constraints & Invariants:
* `free_delivery_threshold` must have a CHECK constraint: `CHECK (free_delivery_threshold >= 0.00)`.
* `free_delivery_threshold` remains populated even when `free_delivery_enabled = false` (preserving the admin's configured threshold value for when the toggle is reactivated).
* Both fields are store-specific, enabling Store Admin or Main Admin to run free delivery promotions on Store A while charging normal fees on Store B.

---

# 7. Radius Constraint Review

### Target Business Rule:
Allowed values strictly: **3.0 km, 4.0 km, or 5.0 km**.

### Database Constraint Formulation:
```sql
ALTER TABLE stores ADD CONSTRAINT check_store_delivery_radius 
  CHECK (delivery_radius_km IN (3.00, 4.00, 5.00));
```

### Safety & Existing Row Verification:
* Current values in `pocketkirana_db`:
  * `store_primary.delivery_radius_km` = `3.00`
  * `store_central_001.delivery_radius_km` = `3.00`
* **Zero Failure Risk:** Both existing rows already satisfy `3.00 IN (3.00, 4.00, 5.00)`. The `ALTER TABLE ADD CONSTRAINT` command will validate existing rows and succeed instantly without locks or errors.
* `delivery_radius_km` is already defined as `NOT NULL`, preventing `NULL` radius values.

---

# 8. Minimum Order Retirement Review

### Current State:
* `stores.minimum_order_value` exists with default `199.00`.
* Both existing stores currently have `minimum_order_value = 199.00`.
* No other tables contain or depend on `minimum_order_value`.
* No database check constraints depend on this column.

### Retirement Strategy for Migration 002:
1. **Do NOT DROP the column immediately:** Dropping the column would break any legacy application query selecting `minimum_order_value` before the backend deployment completes.
2. **Execute In-Place Zeroing:**
   ```sql
   ALTER TABLE stores ALTER COLUMN minimum_order_value SET DEFAULT 0.00;
   UPDATE stores SET minimum_order_value = 0.00;
   ```
3. In `lib/serverServiceability.ts`, completely remove the evaluation block (`subtotal < store.minimumOrderValue`), allowing baskets of any positive value to pass.

---

# 9. Road Distance Deprecation Review

### Inspection of Database Objects:
* `max_road_distance_km` and `road_distance_multiplier` exist as physical columns on `stores`.
* **Database Views:** None (`information_schema.views` returned `[]`).
* **Triggers:** None (`information_schema.triggers` returned `[]`).
* **Stored Procedures / Functions:** None (`information_schema.routines` contains only standard PostgreSQL `uuid-ossp` functions).
* **Indexes / Constraints:** No indexes or constraints reference these two columns.

### Deprecation Strategy:
* Retain the columns physically in the table to prevent breaking existing `SELECT * FROM stores` queries.
* Add documentation comments:
  ```sql
  COMMENT ON COLUMN stores.max_road_distance_km IS 'DEPRECATED: Phase 2 serviceability is strictly straight-line radius.';
  COMMENT ON COLUMN stores.road_distance_multiplier IS 'DEPRECATED: Phase 2 serviceability is strictly straight-line radius.';
  ```

---

# 10. Multi-Store Dependency Map

Inspection across all tables in `pocketkirana_db` containing a `store_id` column:

| Table Name | Column | Data Type | Nullable? | Foreign Key? | Index on `store_id`? | Total Rows | Rows with `store_id` | NULL Count | Referenced Stores Found |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `orders` | `store_id` | `varchar` | YES | ❌ NO | ❌ NO | 53 | 34 | 19 | `store_central_001` (25), `store-001` (9) |
| `warehouses` | `store_id` | `varchar` | YES | ❌ NO | ✅ YES | 39 | 2 | 37 | `store_primary` (1), `store_central_001` (1) |
| `inventory` | `store_id` | `varchar` | YES | ❌ NO | ✅ YES | 0 | 0 | 0 | *None* (Table empty) |
| `carts` | `store_id` | `varchar` | YES | ❌ NO | ❌ NO | 0 | 0 | 0 | *None* (Table empty) |
| `inventory_transactions`| `store_id` | `varchar` | YES | ❌ NO | ❌ NO | 0 | 0 | 0 | *None* (Table empty) |
| `stock_reservations` | `store_id` | `varchar` | YES | ❌ NO | ❌ NO | 0 | 0 | 0 | *None* (Table empty) |

---

# 11. Existing Store Analysis

### A. Store Record: `store_primary`
* **ID:** `store_primary`
* **Code:** `STORE-001`
* **Name:** `PocketKirana Central Darkstore`
* **Coordinates:** `19.02245360`, `73.32100180`
* **Status:** `is_active = true`
* **Operational Settings:** Radius `3.00 km`, Hours `06:00:00 - 23:00:00`, Fee `29.00`, Free Threshold `499.00`, Min Order `199.00`.
* **Direct Database Dependents:**
  * Linked Warehouse: `wh_store_primary` (`WH_STORE-001`) in `warehouses`.
  * Orders explicitly carrying string `store_primary`: 0.
  * Resolved from legacy string `store-001` via code `STORE-001`: 9 orders.

### B. Store Record: `store_central_001`
* **ID:** `store_central_001`
* **Code:** `PK-STORE-01`
* **Name:** `PocketKirana Central Store`
* **Coordinates:** `19.02245360`, `73.32100180`
* **Status:** `is_active = true`
* **Operational Settings:** Radius `3.00 km`, Hours `06:00:00 - 23:00:00`, Fee `29.00`, Free Threshold `499.00`, Min Order `199.00`.
* **Direct Database Dependents:**
  * Linked Warehouse: `wh_store_central_001` (`WH_PK-STORE-01`) in `warehouses`.
  * Orders explicitly carrying `store_id = 'store_central_001'`: **25 orders**.
  * Linked Batches/Balances: 5 balances and 5 batches in `wh_central_001`.

### Multi-Store Coexistence Conclusion:
`store_primary` and `store_central_001` **CAN and MUST safely coexist**. `store_central_001` holds the vast majority of historical order references (25 of 34 identified orders). Deleting or disabling `store_central_001` would immediately break customer order history queries, invoice lookups, and warehouse reconciliation.

---

# 12. Store ID Compatibility

The repository and database currently contain four competing store identifier strings:

1. **`store_primary`:** The authoritative PostgreSQL Primary Key for the central darkstore.
2. **`STORE-001`:** The authoritative PostgreSQL business code for `store_primary`.
3. **`store-001`:** Legacy client-side slug passed by `customer-app`, cart store, and present in 9 historical order rows.
4. **`store_central_001`:** Historical store primary key with code `PK-STORE-01`, present in 25 order rows.

### Recommended Canonical Strategy:
* **Database Level:** The canonical foreign key target must strictly be `stores.id`.
* **Resolution Layer:** `lib/serverServiceability.ts` currently handles legacy mapping:
  ```sql
  WHERE id = $1 OR UPPER(code) = UPPER($1)
  ```
  This resolution must be maintained to seamlessly support incoming API requests passing `store-001`.
* **Order History Harmonization:** During a future controlled data maintenance pass (separate from DDL Migration 002), historical orders with `store-001` should be updated to `store_primary` to standardize foreign references.

---

# 13. RBAC Database Audit

### Catalog Inspection:
* **Roles Table (`public.roles`):**
  * `role_admin`: "Full system administrator"
  * `role_store_manager`: "Manages store catalog and inventory"
  * `role_picker`: "Picks and packs orders in the warehouse"
  * `role_delivery_partner`: "Delivers orders to customers"
  * `role_customer`: "End customer"
* **Permissions Table (`public.permissions`):** **EMPTY (0 rows)**.
* **Admin Users Table (`public.admin_users`):** **EMPTY (0 rows)**.
  * Schema: `id`, `firebase_uid`, `role_id`, `employee_code`, `is_active`, `created_at`, `updated_at`.
  * **Gap:** Does NOT support store scoping. There is no `store_id` or assignment relation.

### Multi-Store RBAC Capability Assessment:
The database currently **CANNOT** enforce store-level authorization boundaries. A user with `role_admin` or `role_store_manager` has unrestricted system-wide access because no relational link exists between admin identities and store IDs.

---

# 14. Admin Store Assignment Design

To support **Main Admin** (all stores) versus **Store Admin** (assigned store only), a new relational table is required in Migration 002:

```sql
CREATE TABLE IF NOT EXISTS admin_store_assignments (
  id VARCHAR(64) PRIMARY KEY,
  admin_user_id VARCHAR(64) NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  assigned_by_uid VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (admin_user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_store_assignments_admin 
  ON admin_store_assignments(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_store_assignments_store 
  ON admin_store_assignments(store_id);
```

### Authorization Logic:
* If user has `role_admin` and 0 store assignment rows → **Main Admin** (unrestricted access to all stores).
* If user has `role_store_manager` (or future `role_store_admin`) → **Store Admin** (access restricted strictly to `store_id` matching `admin_store_assignments`).

---

# 15. GPS Change Audit Design

Store latitude and longitude are permanent physical coordinates. Unauthorized modification distorts serviceability calculations.

### Existing Audit Infrastructure:
The database already contains a generic `public.audit_logs` table:
* Columns: `id`, `firebase_uid`, `action`, `entity_type`, `entity_id`, `old_data` (JSONB), `new_data` (JSONB), `ip_address`, `user_agent`, `created_at`.

### Recommendation for GPS Change Auditing:
Rather than creating an isolated new table, utilize `public.audit_logs` with a dedicated action type:
* `action`: `'STORE_LOCATION_MODIFIED'`
* `entity_type`: `'stores'`
* `entity_id`: `store.id`
* `old_data`: `{"latitude": 19.02245360, "longitude": 73.32100180}`
* `new_data`: `{"latitude": 19.02500000, "longitude": 73.32500000}`
* `firebase_uid`: Developer UID or authenticated service identity.

---

# 16. Store Deletion Dependency Audit

Future store deletion/deactivation must be protected by 4 verification gates. Database feasibility inspection:

| Safety Gate | Required Verification | Database Query Feasibility |
| :--- | :--- | :--- |
| **Gate 1: No Pending Orders** | Orders in non-terminal status (`PLACED`, `CONFIRMED`, `picking`, `ready_for_pickup`, `out_for_delivery`) must equal 0 | **100% Feasible:** `SELECT COUNT(*) FROM orders WHERE store_id = $1 AND order_status NOT IN ('delivered', 'cancelled')`. Currently, 16 active orders exist across stores. |
| **Gate 2: Inventory Audit Complete** | Physical stock audit logged within last 24h | **100% Feasible:** `inventory_audit_log` exists with timestamp and warehouse/variant links. |
| **Gate 3: No Unresolved Discrepancies** | No locked stock or reserved quantities > 0 | **100% Feasible:** Query `inventory_balances` for `reserved_qty > 0` or active rows in `stock_reservations`. |
| **Gate 4: No Blocking DB Dependencies** | No orphaned relations | **Feasible:** Must verify `warehouses.store_id`, `delivery_assignments`, and `orders`. |

**Conclusion:** The database schema possesses all necessary tables to enforce the 4 backend deletion checks.

---

# 17. Orders Audit

* **Total Orders in Database:** **53 records**.
* **Store ID Distribution:**
  * `store_central_001`: **25 orders** (47.2%)
  * `store-001` (legacy slug): **9 orders** (17.0%)
  * `NULL`: **19 orders** (35.8%)
* **Status Distribution:** `delivered` (33), `PLACED` (6), `placed` (3), `CONFIRMED` (3), `picking` (3), `ready_for_pickup` (1), `cancelled` (4).
* **Migration Risk Warning:** Because 19 orders have `store_id IS NULL` and 9 orders have `store_id = 'store-001'`, executing `ALTER TABLE orders ADD CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES stores(id)` in Migration 002 would **FAIL IMMEDIATELY**. Data backfill is mandatory before any foreign key is applied to `orders`.

---

# 18. Inventory Audit

* **`inventory` Table:** **0 rows**.
* **`warehouses` Table:** **39 rows**.
  * `wh_store_primary` explicitly maps to `store_primary`.
  * `wh_store_central_001` explicitly maps to `store_central_001`.
  * 37 test/temporary warehouses have `store_id IS NULL`.
* **`inventory_balances` Table:** **49 rows**.
* **`inventory_batches` Table:** **68 rows**.
* **Finding:** The physical inventory ledger is warehouse-driven (`variant_id`, `batch_id`, `warehouse_id`). The connection to a store is mediated through `warehouses.store_id`.

---

# 19. Product / Store Relationship Audit

* **`products` Table:** 24 columns, 0 store references.
* **`product_variants` Table:** 0 store references.
* **Finding:** Products are defined **globally** across the platform. Store localization occurs strictly at the inventory tier (`inventory_balances` at the warehouse linked to that store) and pricing tier (`stores.delivery_fee_tiers`).

---

# 20. Foreign Key Audit

### Current Reality: Complete Lack of Referential Constraints
Inspection of `information_schema.table_constraints` for `FOREIGN KEY`:
* There are **ZERO foreign keys** referencing `public.stores`.
* There are **ZERO foreign keys** on `orders.store_id`.
* There are **ZERO foreign keys** on `warehouses.store_id`.
* There are **ZERO foreign keys** on `inventory.store_id`.

### Recommendation for Migration 002:
* **DO NOT** attempt to add a foreign key from `orders.store_id` to `stores.id` during Migration 002. Mismatched strings (`store-001`) and NULL values will cause migration failure.
* Foreign keys can be introduced on new tables (`admin_store_assignments` referencing `stores(id)` and `admin_users(id)`).

---

# 21. Index Audit

| Table | Target Column | Index Status | Action for Migration 002 |
| :--- | :--- | :---: | :--- |
| `stores` | `id` | EXISTING (`stores_pkey`) | Retain |
| `stores` | `code` | EXISTING (`stores_code_key`) | Retain |
| `stores` | `is_active` | **MISSING** | **ADD:** `idx_stores_is_active` |
| `orders` | `store_id` | **MISSING** | **ADD:** `idx_orders_store_id` |
| `warehouses` | `store_id` | EXISTING (`idx_warehouses_store`) | Retain |
| `inventory` | `store_id` | EXISTING (`idx_inventory_store_variant`)| Retain |
| `admin_store_assignments` | `(admin_user_id, store_id)` | **NEW TABLE** | **ADD:** Unique index + component indexes |

---

# 22. Migration 002 Safety Assessment

### Can Migration 002 be safely executed without data loss?
**YES**, provided it follows an additive, non-destructive migration pattern:

1. Adding `free_delivery_enabled BOOLEAN DEFAULT true` is non-blocking (O(1) catalog update in PostgreSQL 11+).
2. Adding `delivery_fee_tiers JSONB DEFAULT '[]'::jsonb` is non-blocking.
3. Adding CHECK constraint `delivery_radius_km IN (3.00, 4.00, 5.00)` succeeds immediately because existing rows are `3.00`.
4. Updating `minimum_order_value` default to `0.00` and backfilling existing rows to `0.00` is instantaneous (2 rows).
5. Creating `admin_store_assignments` is a purely additive DDL operation.
6. Adding performance index `idx_orders_store_id` can be safely created.

---

# 23. Data Preservation Assessment

* **Stores:** Both `store_primary` and `store_central_001` remain untouched.
* **Orders:** All 53 order records and their financial columns (`total_amount`, `subtotal`, `delivery_fee`, `tax_amount`) remain 100% intact.
* **Inventory:** All 49 inventory balances and 68 inventory batches remain 100% intact.
* **Outbox & Payments:** `outbox_events` and PhonePe transaction states are completely unaffected.
* **Zero Destructive DDL:** No columns dropped, no tables truncated, no existing constraints removed.

---

# 24. Proposed Target Database Architecture

### A. Modified `public.stores` Definition:
```sql
-- DDL Blueprint for Migration 002 (To be executed as 'postgres' user)
ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS free_delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_fee_tiers JSONB NOT NULL DEFAULT '[
    {"min_subtotal": 0.00, "max_subtotal": 199.99, "fee": 35.00},
    {"min_subtotal": 200.00, "max_subtotal": 399.99, "fee": 25.00},
    {"min_subtotal": 400.00, "max_subtotal": 499.99, "fee": 15.00}
  ]'::jsonb;

-- Radius Constraint
ALTER TABLE stores DROP CONSTRAINT IF EXISTS check_store_delivery_radius;
ALTER TABLE stores ADD CONSTRAINT check_store_delivery_radius 
  CHECK (delivery_radius_km IN (3.00, 4.00, 5.00));

-- Minimum Order In-Place Retirement
ALTER TABLE stores ALTER COLUMN minimum_order_value SET DEFAULT 0.00;
UPDATE stores SET minimum_order_value = 0.00;

-- Operational Performance Indexes
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
```

### B. New `public.admin_store_assignments` Definition:
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

---

# 25. Migration 002 Prerequisites

Before Migration 002 can be generated and applied, the following 3 prerequisites must be explicitly satisfied:

1. **Prerequisite 1: Approval of Tier Structure JSON Schema:**
   The project owner must formally sign off on the JSONB field naming convention (`min_subtotal`, `max_subtotal`, `fee`) and confirm default tier values for initial seeding.
2. **Prerequisite 2: Administrative Role Verification:**
   Confirmation that Migration 002 will be executed exclusively via administrative migration credentials (`ADMIN_DATABASE_URL` with user `postgres`), strictly preserving `pk_app_user` as a DML-only runtime role.
3. **Prerequisite 3: Foreign Key Isolation Agreement:**
   Formal agreement that no hard foreign key will be placed on `orders.store_id` in Migration 002 due to the 19 NULL records and 9 legacy `store-001` records.

---

# 26. Final Readiness Decision

```text
================================================================================
FINAL DATABASE READINESS STATUS:
NOT READY FOR MIGRATION 002
================================================================================
```

### Blocking Issues (3):
1. **Schema Agreement on Delivery Fee Tiers JSONB:** Formal approval needed for the JSONB schema structure and default seeding values.
2. **Order Foreign Key Safety Boundary:** Must formally exclude foreign key creation on `orders.store_id` in Migration 002 to avoid migration failure from legacy `NULL` and `store-001` data.
3. **RBAC Prerequisites:** `admin_users` table is currently empty in PostgreSQL; migration script must ensure `admin_store_assignments` creation does not fail or break foreign key dependencies.

---

# CRITICAL STOP CONDITION REACHED

The Phase 2.1 Database Architecture Read-Only Audit is complete.  
No schema, data, or application code modifications have been made.  
Awaiting project owner authorization and sign-off on the 3 prerequisites before Migration 002 is drafted.
