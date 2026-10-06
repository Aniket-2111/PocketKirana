# PocketKirana — Phase 2.7C.1 Implementation Report

**Document Title:** Canonical Server Serviceability Implementation Report  
**Phase:** Phase 2.7C.1 — Canonical Server Serviceability Implementation  
**Execution Timestamp:** 2026-10-02T16:37:30+05:30  
**Repository Branch:** `fix/page-readiness-production`  
**Base Commit:** `63dba53`  
**Execution Environment:** Node.js v20.19.0 / Next.js 15.5.23 / PostgreSQL 15.14 (`pocketkirana_db` on `192.168.0.105:5433`)  

---

## A. Execution Status

* **Implementation Started:** YES (2026-10-02T16:29:08+05:30)
* **Implementation Completed:** YES (2026-10-02T16:37:30+05:30)
* **Files Changed:**
  - `lib/serverServiceability.ts`
  - `test/server-serviceability.test.ts`
* **Database Changed:** **NO** (0 DDL/DML executed; schema and data 100% untouched)
* **Migration Executed:** **NO** (Migration 002 remains completed; Migration 003 NOT created or executed)
* **Git Commit:** **NO** (Working tree changes staged/unstaged; no commits created)
* **Deployment:** **NO** (Zero remote deployments triggered)

---

## B. Exact File Changes

Strictly confined to the two approved files within the Phase 2.7C.1 mandate:

### 1. `lib/serverServiceability.ts`
* **Interfaces & Types:**
  - Added interface `DeliveryFeeTier` (`minSubtotal: number`, `maxSubtotal: number | null`, `fee: number`).
  - Updated interface `StoreOperationalSettings`:
    - Added `freeDeliveryEnabled: boolean`
    - Added `freeDeliveryThreshold: number`
    - Added `deliveryFeeTiers: DeliveryFeeTier[]`
    - Preserved deprecated optional fields (`minimumOrderValue?: number`, `maxRoadDistanceKm?: number`, `roadDistanceMultiplier?: number`) to guarantee non-breaking compatibility with external type consumers.
  - Updated type `ServiceabilityErrorCode`:
    - Standard codes: `'INVALID_COORDINATES'`, `'STORE_NOT_FOUND'`, `'STORE_OFFLINE'`, `'STORE_CLOSED'`, `'OUT_OF_SERVICE_AREA'`, `'SERVICEABILITY_ERROR'`.
    - Deprecated tags added to `'MINIMUM_ORDER_VALUE_NOT_MET'` and `'ROAD_LIMIT_EXCEEDED'` to maintain exhaustive check compatibility while guaranteeing the evaluator never returns them.
* **Authoritative Delivery Fee Resolver (`resolveDeliveryFee`):**
  - Evaluates store-specific free delivery gate first (`store.freeDeliveryEnabled && cleanSubtotal >= store.freeDeliveryThreshold` $\to$ ₹0).
  - Evaluates configured `deliveryFeeTiers` when populated, safely handling unbounded upper ranges (`maxSubtotal: null`).
  - Safely falls back to store's configured `delivery_fee` column when tiers array is empty (`[]`) or unmatched.
  - Enforces 2-decimal currency precision: `Math.max(0, Math.round(value * 100) / 100)` (no integer truncation).
* **Store Configuration Loader (`getStoreOperationalSettings`):**
  - Updated PostgreSQL `SELECT` query to retrieve canonical columns: `id`, `name`, `code`, `latitude`, `longitude`, `is_active`, `delivery_radius_km`, `opening_time`, `closing_time`, `delivery_fee`, `free_delivery_enabled`, `free_delivery_threshold`, `delivery_fee_tiers`, `minimum_order_value`.
  - Safely parses JSONB `delivery_fee_tiers` (defaults to `[]`).
  - Sets `minimumOrderValue: 0` (retired).
  - Preserves 2-decimal precision on `deliveryFee` and `freeDeliveryThreshold`.
* **Authoritative Evaluator (`evaluateServerServiceability`):**
  - Coordinate validation: validates finite, non-null, within $[-90, 90]$ latitude and $[-180, 180]$ longitude.
  - Store lookup: resolves via PostgreSQL; unknown stores fail closed with `STORE_NOT_FOUND`.
  - Active check: inactive stores fail closed with `STORE_OFFLINE`.
  - Operating hours: evaluated against store's PostgreSQL `opening_time` and `closing_time`; fails closed with `STORE_CLOSED`.
  - **DECOMMISSIONED:** Minimum order check removed (`subtotal < minOrder` is never rejected).
  - **DECOMMISSIONED:** Road distance multiplier (1.35×) and road cutoff checks removed.
  - **GEOGRAPHIC RULE:** Enforces pure Haversine straight-line distance ($\text{straightLineDistanceKm} \le \text{store.deliveryRadiusKm}$).
  - Exact boundary ($\text{distance} == \text{radius}$) is serviceable.
  - Invokes `resolveDeliveryFee` for authoritative fee resolution.

### 2. `test/server-serviceability.test.ts`
* Rebuilt test suite into 6 focused describe blocks covering 32 test cases:
  1. Authoritative Store Configuration & Store Resolution (7 tests)
  2. Coordinate Validation (4 tests)
  3. Geographic Serviceability Rule (Pure Haversine & Radius 3, 4, 5 km) (7 tests)
  4. Decommissioned Rules Verification (4 tests)
  5. Delivery Fee Resolver (`resolveDeliveryFee`) (8 tests)
  6. Checkout Route Serviceability Gate Integration (2 tests)

No additional files were modified.

---

## C. Business-Rule Verification

| Rule / Feature | Requirement | Status | Evidence / Verification |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Canonical Store** | Authoritative store configuration read from PostgreSQL `stores` | **PASS** | `getStoreOperationalSettings` queries `stores` matching `id = $1 OR UPPER(code) = UPPER($1)`. Verified in test. |
| **Haversine-Only** | Only geographic rule is Haversine straight-line distance | **PASS** | Distance computed via `calculateDistanceKm(store.lat, store.lon, lat, lng)` and evaluated against `deliveryRadiusKm`. |
| **Radius 3 / 4 / 5 km** | Validated across 3 km, 4 km, and 5 km radius configurations | **PASS** | Tested 2.9 km (pass) & 3.1 km (fail) for 3 km; 3.8 km (pass) & 4.2 km (fail) for 4 km; 4.8 km (pass) & 5.2 km (fail) for 5 km. |
| **Exact Boundary** | Exact boundary distance ($\text{distance} == \text{radius}$) is serviceable | **PASS** | Tested: 3.0 km exactly with 3 km radius (PASS), 4.0 km exactly with 4 km radius (PASS), 5.0 km exactly with 5 km radius (PASS). |
| **No Road Multiplier** | No 1.35× or road multiplier applied | **PASS** | Verified: 2.7 km straight-line passes even when $2.7 \times 1.35 = 3.64\text{ km}$ would exceed old 3.2 km road limits. |
| **No Road Cutoff** | No 4.5 km or 6.0 km road cutoff applied | **PASS** | Verified: 3.8 km address on 4 km store passes without triggering old 4.5 km cutoff. |
| **No Minimum Order** | Subtotal below previous minimum order value is not rejected | **PASS** | Tested subtotal ₹0 and ₹50 against store with old `minimum_order_value = 199.00` $\to$ serviceable = true. |
| **Store-Specific Hours** | Hours read dynamically from PostgreSQL `opening_time` and `closing_time` | **PASS** | Tested store hours 06:00–23:00 (14:00 passes) and 10:00–20:00 (03:00 fails closed with `STORE_CLOSED`). |
| **Active / Inactive Store** | Inactive store fails closed | **PASS** | Tested `is_active: false` $\to$ rejected with `STORE_OFFLINE`. |
| **Invalid Coordinates** | Missing, NaN, out-of-range, non-finite coordinates rejected | **PASS** | Tested `undefined`, `null`, `''`, `'not-a-number'`, `lat > 90`, `lat < -90`, `lng > 180`, `lng < -180`, `Infinity` $\to$ `INVALID_COORDINATES`. |
| **Store Alias Compatibility**| `store-001` explicitly resolves to `store_primary` | **PASS** | Evaluator queries `id = $1 OR UPPER(code) = UPPER($1)` resolving `store-001` $\to$ `store_primary`. |
| **Tiered Fee Resolver** | Tiered fee resolution evaluates store's `delivery_fee_tiers` | **PASS** | Tested populated tiers `[{0..199.99: 40}, {200..499.99: 20}]` $\to$ returns correct tier fee. |
| **Free Delivery Toggle** | `free_delivery_enabled` gate respected | **PASS** | Tested: when `free_delivery_enabled: false`, delivery fee applies even when subtotal exceeds threshold. |
| **Store-Specific Threshold**| Threshold read from store record (not global ₹499) | **PASS** | Tested custom threshold ₹300: ₹350 subtotal waives fee to ₹0; ₹250 subtotal charges fee. |
| **Empty-Tier Fallback** | Empty tiers safely fall back to store's `delivery_fee` column | **PASS** | Tested `delivery_fee_tiers: []` with store fee ₹35 $\to$ returns ₹35. |
| **2-Decimal Precision** | Monetary precision preserved to 2 decimal places | **PASS** | Tested tier fee `12.50` and store fee `15.75` $\to$ preserved without integer rounding. |
| **No Invented Tier Values** | No tier amounts seeded into database or hardcoded | **PASS** | Database remains `delivery_fee_tiers = '[]'::jsonb`. Resolver supports generic schema only. |

---

## D. Tests

### 1. Focused Server Serviceability Test Suite
* **Command:** `npx vitest run test/server-serviceability.test.ts`
* **Result:** **32 passed (32 tests)**
* **Duration:** 4.17s

```text
✓ test/server-serviceability.test.ts (32 tests) 77ms
  ✓ 1. Authoritative Store Configuration & Store Resolution (7 tests)
  ✓ 2. Coordinate Validation (4 tests)
  ✓ 3. Geographic Serviceability Rule (Pure Haversine & Radius 3, 4, 5 km) (7 tests)
  ✓ 4. Decommissioned Rules Verification (4 tests)
  ✓ 5. Delivery Fee Resolver (resolveDeliveryFee) (8 tests)
  ✓ 6. Checkout Route Serviceability Gate Integration (2 tests)
```

### 2. Full Repository Test Suite (Regression Guard)
* **Command:** `npx vitest run`
* **Result:** **50 passed, 0 failed (665 passed tests)**
* **Duration:** 15.24s

### 3. TypeScript Typecheck
* **Command:** `npx tsc --noEmit`
* **Result:** **PASS (Exit code 0, 0 type errors)**

### 4. Next.js Production Build Verification
* **Command:** `npm run build`
* **Result:** **PASS (Exit code 0, all static and dynamic routes compiled)**

---

## E. Security

* [x] **Client cannot choose distance:** Distance is calculated strictly on the server via `calculateDistanceKm` using customer GPS coordinates and PostgreSQL store coordinates. Client-supplied distances are ignored.
* [x] **Client cannot override radius:** The radius boundary is loaded authoritatively from PostgreSQL `stores.delivery_radius_km` and enforced server-side.
* [x] **Client cannot override delivery fee:** Delivery fee is resolved authoritatively on the server via `resolveDeliveryFee` using PostgreSQL store operational settings and catalog-validated subtotal.
* [x] **Client cannot override free-delivery threshold:** Free delivery threshold is loaded directly from PostgreSQL `stores.free_delivery_threshold`.
* [x] **Client cannot override store coordinates:** Store latitude and longitude originate exclusively from the PostgreSQL `stores` table.
* [x] **Unknown store fails closed:** An invalid or unmapped store ID fails closed with `STORE_NOT_FOUND` without falling back to any default store.

---

## F. Safety Attestation

I attest that:
1. Implementation scope was strictly restricted to Phase 2.7C.1.
2. Only `lib/serverServiceability.ts` and `test/server-serviceability.test.ts` were modified.
3. No secondary APIs, admin APIs, frontend pages, customer-app pages, Cloud Functions, or payment subsystems were touched.
4. No database migrations were executed, no DDL/DML was run, and no schema or data was altered.
5. No Git commits, pushes, rebases, or branch changes were made.
6. Execution has stopped after completing Phase 2.7C.1 implementation, tests, and this report. Phase 2.7C.2 has NOT been started.
