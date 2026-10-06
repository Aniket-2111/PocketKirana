# Phase 2.8.1 — Database State Discrepancy Verification Forensic Report

**Document ID:** `PHASE_2_8_1_DATABASE_STATE_DISCREPANCY_VERIFICATION.md`  
**Execution Timestamp:** 2026-10-04T07:22:00+05:30  
**Phase:** Phase 2.8.1 (Discrepancy Verification)  
**Repository:** `PocketKirana`  
**Execution Mode:** STRICT READ-ONLY FORENSIC AUDIT (Zero code changes, zero database mutations, zero migrations, zero deployments, zero commits)  

---

## 1. Executive Summary & Final Verdict

```text
================================================================================
FINAL VERDICT:
🟡 AUDIT EVIDENCE MISMATCH
================================================================================
The live PostgreSQL canonical database (`pocketkirana_db` on `192.168.0.105:5433`)
is 100% UNCHANGED and MATCHES the Phase 2.7C approved baseline:
  - delivery_radius_km     = 3.00 km (enforced by CHECK constraint [3.0, 4.0, 5.0])
  - minimum_order_value    = ₹0 (retired in v2.6)
  - delivery_fee           = ₹29
  - free_delivery_threshold= ₹499
  - free_delivery_enabled  = true

Phase 2.8's report contained an AUDIT EVIDENCE MISMATCH in sections 5 and 17,
where synthetic/placeholder values (`15.00 km`, `min_order_amount = ₹100`, 
`base_delivery_fee = ₹25`) were erroneously recorded.
Zero database state drift occurred. The database has not been mutated since 
2026-10-02T04:45:10.321Z.
================================================================================
```

---

## 2. Database Connection Identity

The active connection configuration was verified by direct query without exposing passwords or credentials:

| Property | Live Connection Value | Verification Source |
|---|---|---|
| **Server Host** | `192.168.0.105` | `SELECT inet_server_addr()` |
| **Server Port** | `5433` | `SELECT inet_server_port()` |
| **Database Name** | `pocketkirana_db` | `SELECT current_database()` |
| **Current User** | `pk_app_user` | `SELECT current_user` |
| **Session User** | `pk_app_user` | `SELECT session_user` |
| **Current Schema** | `public` | `SELECT current_schema` |
| **PostgreSQL Engine** | `PostgreSQL 18.6 on x86_64-windows, compiled by msvc-19.44.35228, 64-bit` | `SELECT version()` |

**Confirmation:** The audit connected directly to the canonical host `192.168.0.105:5433 / pocketkirana_db` as runtime application role `pk_app_user`. No alternate database was used.

---

## 3. Exact Stores Query (Canonical Live State)

Query executed:
```sql
SELECT 
  id, code, name, is_active, latitude, longitude,
  delivery_radius_km, minimum_order_value, delivery_fee,
  free_delivery_enabled, free_delivery_threshold, delivery_fee_tiers,
  opening_time, closing_time, created_at, updated_at
FROM stores
ORDER BY id;
```

### Exact Live Records:

#### Record 1:
* **id:** `store_central_001`
* **code (store_code):** `PK-STORE-01`
* **name:** `PocketKirana Central Store`
* **is_active:** `true`
* **latitude:** `19.02245360`
* **longitude:** `73.32100180`
* **delivery_radius_km:** `3.00`
* **minimum_order_value:** `0`
* **delivery_fee:** `29`
* **free_delivery_enabled:** `true`
* **free_delivery_threshold:** `499`
* **delivery_fee_tiers:** `[]` (empty JSON array)
* **opening_time:** `06:00`
* **closing_time:** `23:00`
* **created_at:** `2026-08-29T16:27:21.453Z`
* **updated_at:** `2026-10-02T04:45:10.321Z`

#### Record 2:
* **id:** `store_primary`
* **code (store_code):** `STORE-001`
* **name:** `PocketKirana Central Darkstore`
* **is_active:** `true`
* **latitude:** `19.02245360`
* **longitude:** `73.32100180`
* **delivery_radius_km:** `3.00`
* **minimum_order_value:** `0`
* **delivery_fee:** `29`
* **free_delivery_enabled:** `true`
* **free_delivery_threshold:** `499`
* **delivery_fee_tiers:** `[]` (empty JSON array)
* **opening_time:** `06:00`
* **closing_time:** `23:00`
* **created_at:** `2026-08-29T15:47:21.972Z`
* **updated_at:** `2026-10-02T04:45:10.321Z`

---

## 4. Column Names & Schema Verification

Inspection of `information_schema.columns` for table `stores`:

| Evaluated Column | Exists in Database? | Data Type | Canonical / Deprecated | Role |
|---|:---:|---|---|---|
| `delivery_radius_km` | ✅ **YES** | `numeric` | **CANONICAL** | Authoritative delivery radius for customer checkout. |
| `delivery_fee` | ✅ **YES** | `integer` | **CANONICAL** | Authoritative default delivery fee when not waived. |
| `base_delivery_fee` | ❌ **NO** | — | — | **Non-existent column.** Erroneously referenced in Phase 2.8 text. |
| `free_delivery_threshold` | ✅ **YES** | `integer` | **CANONICAL** | Authoritative threshold for ₹0 delivery fee. |
| `free_delivery_enabled` | ✅ **YES** | `boolean` | **CANONICAL** | Authoritative toggle for free delivery eligibility. |
| `delivery_fee_tiers` | ✅ **YES** | `jsonb` | **CANONICAL** | Authoritative tiered fee structure. |
| `minimum_order_value` | ✅ **YES** | `integer` | **DEPRECATED / RETIRED** | Column preserved; value set to `0`. Minimum order check retired in v2.6. |
| `minimum_order_amount` | ❌ **NO** | — | — | **Non-existent column.** Erroneously referenced in Phase 2.8 text. |
| `max_road_distance_km` | ✅ **YES** | `numeric` | **DEPRECATED** | Preserved from early phase; ignored by canonical serviceability. |
| `road_distance_multiplier` | ✅ **YES** | `numeric` | **DEPRECATED** | Preserved from early phase; ignored by canonical serviceability. |

### PostgreSQL Table Constraints on `stores`:
```sql
-- 1. Delivery Radius Constraint:
CONSTRAINT check_store_delivery_radius 
  CHECK (delivery_radius_km = ANY (ARRAY[3.00, 4.00, 5.00]))

-- 2. Free Delivery Threshold Constraint:
CONSTRAINT check_store_free_delivery_threshold 
  CHECK ((free_delivery_threshold)::numeric >= 0.00)

-- 3. Primary Key & Code Uniqueness:
CONSTRAINT stores_pkey PRIMARY KEY (id)
CONSTRAINT stores_code_key UNIQUE (code)
```

> **Critical Forensic Proof:**  
> The CHECK constraint `check_store_delivery_radius` explicitly restricts `delivery_radius_km` to `3.00`, `4.00`, or `5.00`.  
> A value of `15.00 km` is **mathematically impossible** to insert or update into PostgreSQL without causing a fatal constraint violation error.

---

## 5. Application Authority Mapping

### A. `lib/serverServiceability.ts`:
1. **`getStoreOperationalSettings(storeId)`**:
   - Executes:
     ```sql
     SELECT 
       id, name, code, latitude, longitude, is_active,
       delivery_radius_km, opening_time, closing_time, delivery_fee,
       free_delivery_enabled, free_delivery_threshold, delivery_fee_tiers,
       minimum_order_value, max_road_distance_km, road_distance_multiplier
     FROM stores
     WHERE id = $1 OR UPPER(code) = UPPER($1)
     ```
   - Maps `delivery_radius_km` $\rightarrow$ `store.deliveryRadiusKm`.
   - Maps `delivery_fee` $\rightarrow$ `store.deliveryFee` (default fallback 29).
   - Maps `free_delivery_threshold` $\rightarrow$ `store.freeDeliveryThreshold` (default fallback 499).
   - Maps `free_delivery_enabled` $\rightarrow$ `store.freeDeliveryEnabled` (default fallback true).
2. **`evaluateServerServiceability()`**:
   - Evaluates straight-line Haversine distance between customer location and store coordinates.
   - Enforces `straightLineDistanceKm <= store.deliveryRadiusKm` (strictly reads `delivery_radius_km`).
3. **`resolveDeliveryFee(store, subtotal)`**:
   - First checks: `if (store.freeDeliveryEnabled && subtotal >= store.freeDeliveryThreshold) return 0;`
   - Next checks: `store.deliveryFeeTiers` (if populated).
   - Fallback: Returns `store.deliveryFee` (reads `delivery_fee` column directly).

### B. `lib/storeOperationsService.ts`:
1. **`getDarkstoreOperationalStatus(storeId)`**:
   - Queries `stores` for:
     `opening_time`, `closing_time`, `delivery_radius_km`, `delivery_fee`, `free_delivery_enabled`, `free_delivery_threshold`, `delivery_fee_tiers`.
2. **`updateDarkstoreOperationalSettings(params)`**:
   - Strictly validates `deliveryRadiusKm`:
     ```ts
     if (![3, 3.0, 4, 4.0, 5, 5.0].includes(r)) {
       throw new Error(`Invalid delivery radius: ${params.deliveryRadiusKm} km. Allowed canonical values are 3.0, 4.0, or 5.0 km.`);
     }
     ```
   - Writes directly to columns: `delivery_radius_km`, `delivery_fee`, `free_delivery_threshold`, `free_delivery_enabled`, `delivery_fee_tiers`, `opening_time`, `closing_time`.
   - Does NOT reference or write to `minimum_order_amount` or `base_delivery_fee`.

---

## 6. Phase 2.7C vs. Phase 2.8 Comparison

| Parameter | Phase 2.7C Authority Scan | Phase 2.8 Master Audit | Actual Live PostgreSQL | Comparison Status |
|---|---|---|---|:---:|
| **Delivery Radius** | `3.00 km` | `15.00 km` | `3.00 km` | ❌ **Phase 2.8 Error** (Phase 2.7C Matches Live DB) |
| **Minimum Order** | `₹0 (Retired v2.6)` | `min_order_amount = ₹100` | `minimum_order_value = 0` | ❌ **Phase 2.8 Error** (Phase 2.7C Matches Live DB) |
| **Delivery Fee** | `₹29` | `base_delivery_fee = ₹25` | `delivery_fee = 29` | ❌ **Phase 2.8 Error** (Phase 2.7C Matches Live DB) |
| **Free Delivery Threshold** | `₹499` | `₹499` | `free_delivery_threshold = 499` | ✅ **Consistent** |
| **Free Delivery Enabled** | `true` | `true` | `free_delivery_enabled = true` | ✅ **Consistent** |
| **Opening / Closing Hours** | `06:00 - 23:00` | `07:00 - 23:00` | `06:00 - 23:00` | ❌ **Phase 2.8 Error** (Phase 2.7C Matches Live DB) |

---

## 7. Git & Migration Timeline

1. **Git Commit History:**
   - Base commit at start of Phase 2.7C: `63dba5363579334b67e4ac9a401d94060be244bf`
   - Current commit: `63dba5363579334b67e4ac9a401d94060be244bf`
   - **Zero commits** have been made since Phase 2.7C.
2. **Migrations Directory (`scripts/migrations/`):**
   - Migration 001: Initial schema.
   - Migration 002: `002_add_phase2_store_operational_settings.js` (executed on 2026-10-02).
   - **Zero migrations** have been created or executed after Phase 2.7C.
3. **Database Timestamps:**
   - Both rows in `stores` have `updated_at = '2026-10-02T04:45:10.321Z'`.
   - **Zero DDL or DML mutations** have touched `stores` since October 2, 2026.

---

## 8. Root Cause Analysis

### Why did Phase 2.8 report `15.00 km`, `min_order_amount = ₹100`, and `base_delivery_fee = ₹25`?

1. **Context Synthesis Error (Hallucination):**
   During the generation of `PHASE_2_8_PRODUCTION_READINESS_MASTER_AUDIT.md`, sections 5 ("Database Data-Integrity Audit") and 17 ("Admin Portal Audit") drafted narrative summary tables.
2. **Failure to Query Live DB for Store Section:**
   While the auditor queried `orders` (53 rows), `order_items` (0 orphaned), and `inventory` (49 balances, 68 batches), the auditor did not re-execute a `SELECT * FROM stores` command during that specific phase turn.
3. **Invention of Non-Existent Column Names:**
   The narrative inadvertently hallucinated standard generic names (`min_order_amount`, `base_delivery_fee`) and hypothetical business numbers (`15 km`, `₹100`, `₹25`), which:
   - Contradict the database's actual columns (`minimum_order_value`, `delivery_fee`).
   - Contradict the database's explicit CHECK constraint (`delivery_radius_km IN (3.00, 4.00, 5.00)`).
   - Contradict the previously verified Phase 2.7C baseline.

---

## 9. Final Decision & Status

* **Is the live database corrupted or modified?** ❌ **NO.**
* **Did database state drift occur?** ❌ **NO.**
* **Is the approved business baseline intact?** ✅ **YES.** The database strictly holds:
  - Radius: **3.00 km**
  - Minimum Order: **₹0**
  - Delivery Fee: **₹29**
  - Free Delivery Threshold: **₹499**
  - Free Delivery Enabled: **true**
  - Hours: **06:00 - 23:00**

**Final Verdict:** 🟡 **AUDIT EVIDENCE MISMATCH**  
The live database remains 100% consistent with the Phase 2.7C final authority scan. Phase 2.8's report contained an evidence drafting error.

---
**Verification Complete. Standing by for user review.**
