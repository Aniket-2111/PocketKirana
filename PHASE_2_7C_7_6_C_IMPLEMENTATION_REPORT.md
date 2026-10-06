# Phase 2.7C.7.6-C — Canonical Admin Store Operations Implementation Report

**Document ID:** `PHASE_2_7C_7_6_C_IMPLEMENTATION_REPORT.md`  
**Phase:** Phase 2.7C.7.6-C (Canonical Admin Store Operations Implementation)  
**Execution Timestamp:** 2026-10-04T06:50:00+05:30  
**Repository:** `PocketKirana`  
**Execution Mode:** Implementation of Phase 2.7C.7.6-C Only  
**Baseline Commit / HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`  

---

## 1. Executive Summary

Phase 2.7C.7.6-C eliminates the administrative Firestore/PostgreSQL split-brain uncovered during the Phase 2.7C.7.6 forensic audit.

Prior to this phase, the administrative service-area management UI (`app/admin/service-area/page.tsx`) loaded and saved store configurations solely through client-side Firestore (`fetchShopsFS()`, `saveShopConfigFS()`). Because customer serviceability (`GET /api/serviceability/check`) and transactional checkout (`POST /api/checkout`) read exclusively from PostgreSQL `stores`, modifications made in the admin UI had zero effect on customer order placement, serviceability, delivery fees, or operational hours. Furthermore, store GPS coordinates were casually editable without authorization, and the UI slider allowed selecting delivery radii that violated PostgreSQL database check constraints.

Under Phase 2.7C.7.6-C:
1. **Canonical Admin API:** The existing endpoint `app/api/admin/store/operations/route.ts` and service `lib/storeOperationsService.ts` were upgraded into a fully authoritative, PostgreSQL-backed operational management API.
2. **Server-Side RBAC Enforcement:** Integrated `admin_store_assignments` verification in `lib/routeAuth.ts`: Main Admin (`admin`) retains global multi-store authority; Store Admin (`store_admin`, `store_manager`) is strictly restricted to assigned stores in PostgreSQL.
3. **Strict Radius Constraint Enforcement:** Server-side validation strictly enforces canonical allowed radius values: `3.0`, `4.0`, or `5.0` km, returning `400 Bad Request` for any other value and protecting against database check constraint crashes.
4. **Server-Side Coordinate Protection:** Created `lib/coordinateProtection.ts`. Store latitude and longitude cannot be modified by standard administrators (`403 Forbidden: STORE_COORDINATES_PROTECTED`). Relocation requires a single-use, 5-minute time-limited developer authorization token with replay attack prevention.
5. **Persistent Audit Logging:** Every successful operational update records an immutable audit record in PostgreSQL `audit_logs` capturing `old_data`, `new_data`, `firebase_uid`, and `action` (`STORE_OPERATIONS_UPDATE` or `STORE_COORDINATE_RELOCATION`).
6. **Admin UI Alignment:** Replaced the client Firestore writes in `app/admin/service-area/page.tsx` with canonical API calls to `/api/admin/store/operations`. Replaced the `1–15 km` slider with canonical `3.0 / 4.0 / 5.0 KM` options; removed the retired `minOrder` input; added controls for `freeDeliveryEnabled` and `freeDeliveryThreshold`; and locked coordinate inputs with a security shield indicator.
7. **Transitional Mirroring:** Firestore `shops` collection is updated solely as a secondary background write-through mirror, ensuring legacy advisory listeners remain synchronized without ever competing with PostgreSQL authority.

---

## 2. Baseline Commit

- **Git Commit SHA:** `63dba5363579334b67e4ac9a401d94060be244bf`
- **Branch:** `main` (or tracking branch)
- **Scope Restriction:** Scope confined strictly to Phase 2.7C.7.6-C admin service-area canonical alignment.

---

## 3. Files Changed

| File Path | Change Type | Purpose |
|---|---|---|
| `lib/coordinateProtection.ts` | **NEW** | Server-side darkstore GPS coordinate protection, single-use developer token generation & verification, nonce replay prevention. |
| `lib/routeAuth.ts` | **MODIFIED** | Added `verifyStoreAccess()` enforcing Main Admin vs Store Admin scoping via `admin_store_assignments`. |
| `lib/storeOperationsService.ts` | **MODIFIED** | Upgraded `getDarkstoreOperationalStatus` and `updateDarkstoreOperations` to query/update canonical PostgreSQL `stores`, enforce radius check constraint (`3, 4, 5`), validate hours, protect coordinates, invalidate serviceability cache, record PostgreSQL audit logs, and mirror to Firestore secondary sink. |
| `app/api/admin/store/operations/route.ts` | **MODIFIED** | Upgraded `GET` and `PUT` handlers with server-side RBAC, store access verification, IP/User-Agent extraction, and differentiated validation/authorization HTTP status codes. |
| `app/admin/service-area/page.tsx` | **MODIFIED** | Rewired from Firestore `saveShopConfigFS()` to canonical `/api/admin/store/operations`. Enforced 3/4/5 km radius selector; added free delivery controls; removed retired minOrder control; protected coordinates. |
| `test/checkout-c76c-admin-service-area-canonical-alignment.test.ts` | **NEW** | Comprehensive unit & integration test suite covering RBAC, store operations persistence, coordinate protection, serviceability reflection, and static UI audits (22/22 passing). |

---

## 4. Backend Changes

### 1. `lib/coordinateProtection.ts`
- `validateCoordinateModification()`: Compares current PostgreSQL coordinates with submitted coordinates. If delta exceeds 0.000001 degrees, requires developer token verification.
- `verifyAndConsumeDeveloperToken()`: Verifies HMAC-SHA256 signature, 5-minute expiration window, store scoping, and single-use nonce tracking in a memory set with automatic TTL eviction.
- Prevents casual admin tampering with darkstore location while providing a clean, audited mechanism for planned relocations.

### 2. `lib/routeAuth.ts`
- Added `verifyStoreAccess(auth, storeId)`:
  - Role `'admin'`: Main Admin — granted access across all stores.
  - Role `'store_admin'` / `'store_manager'`: Checks PostgreSQL `admin_store_assignments` for matching `admin_user_id` or `firebase_uid` and `store_id`. Returns 403 if unassigned.
  - Other roles: Returns 403 Forbidden.

### 3. `lib/storeOperationsService.ts`
- `getDarkstoreOperationalStatus()`:
  - Queries live PostgreSQL `stores` columns (`opening_time`, `closing_time`, `delivery_radius_km`, `delivery_fee`, `free_delivery_enabled`, `free_delivery_threshold`, `latitude`, `longitude`).
  - Queries active picking/packing/delivery tasks for real-time queue capacity.
- `updateDarkstoreOperations()`:
  - Validates `deliveryRadiusKm`: Strictly `3.0`, `4.0`, or `5.0`.
  - Validates operating hours: Valid `HH:MM` format and `openingTime < closingTime`.
  - Validates fees: Non-negative numbers.
  - Coordinates: Evaluated via `validateCoordinateModification()`.
  - Transactional update: Parameterized SQL `UPDATE stores SET ... WHERE id = $1 RETURNING *`.
  - Cache Invalidation: Calls `clearStoreCache()` so `lib/serverServiceability.ts` immediately reflects updates.
  - Audit Logging: Inserts record into PostgreSQL `audit_logs`.
  - Secondary Mirror: Updates Firestore `shops` in a non-fatal `try...catch`.

### 4. `app/api/admin/store/operations/route.ts`
- Gated by `requireRole(req, ['admin', 'store_admin', 'store_manager'])`.
- Enforces `verifyStoreAccess()`.
- Captures client IP and User-Agent for audit traceability.
- Returns explicit HTTP error codes: `400` for validation errors, `403` for coordinate protection / unauthorized store errors.

---

## 5. Frontend Changes

### `app/admin/service-area/page.tsx`
- **Data Loading:** Mount `useEffect` queries `GET /api/admin/store/operations?storeId=store_primary`.
- **Data Persistence:** Form submission sends `PUT /api/admin/store/operations`.
- **Delivery Radius UI:** Replaced `1–15 km` slider with segmented buttons for canonical values: `3.0 KM (Ultra Local)`, `4.0 KM (Standard)`, `5.0 KM (Max Coverage)`.
- **Minimum Order Requirement:** Removed the editable `minOrder` input (default ₹199). Replaced with a clear informational badge: `₹0 (Retired in v2.6)`.
- **Free Delivery Controls:** Added interactive toggle for `freeDeliveryEnabled` and threshold input `freeDeliveryThreshold` (defaults to PostgreSQL value, e.g. ₹499).
- **Coordinate Protection UI:** Latitude and Longitude inputs are strictly `readOnly` with a "🔒 Protected GPS Coordinates" shield badge. Map canvas pin is locked against casual dragging.
- **Transitional Customer Waitlist:** Preserved out-of-area customer "Notify Me" inquiries table via `fetchServiceRequestsFS()` and status updates.

---

## 6. RBAC Implementation

```text
Admin User Request
    │
    ▼
requireRole(['admin', 'store_admin', 'store_manager'])
    │
    ├── Role = 'admin' (Main Admin) ───────► ALLOWED (Global Authority)
    │
    ├── Role = 'store_admin' / 'store_manager'
    │     │
    │     ├── Query: admin_store_assignments (admin_user_id, store_id)
    │     │     │
    │     │     ├── Match Found ──────────────► ALLOWED (Scoped Store)
    │     │     └── No Match ─────────────────► REJECTED (403 Forbidden)
    │     ▼
    └── Role = Any other role ────────────────► REJECTED (403 Forbidden)
```

---

## 7. Coordinate Protection

- **Normal Admin:** Attempting to alter `latitude` or `longitude` via the API without authorization results in:
  `403 Forbidden: STORE_COORDINATES_PROTECTED: Developer coordinate authorization token is missing.`
- **Developer Flow:** Authorized relocation requires passing a signed developer token:
  - Single-use: Nonce is recorded in an in-memory set; replay attempts are rejected.
  - Time-limited: Expires after 300 seconds (5 minutes).
  - Audited: Successfully relocated coordinates write to `audit_logs` with action `STORE_COORDINATE_RELOCATION`.
- **Frontend Security:** Zero developer secrets or tokens are stored in or exposed to frontend code.

---

## 8. PostgreSQL Authority

PostgreSQL `stores` is now the sole canonical source of truth for administrative configuration:
- `is_active`: Toggled directly in PostgreSQL `stores.is_active`.
- `opening_time` & `closing_time`: Persisted directly to PostgreSQL.
- `delivery_radius_km`: Persisted directly to PostgreSQL; validated against check constraint `IN (3.00, 4.00, 5.00)`.
- `delivery_fee`: Persisted directly to PostgreSQL `stores.delivery_fee`.
- `free_delivery_enabled`: Persisted directly to PostgreSQL `stores.free_delivery_enabled`.
- `free_delivery_threshold`: Persisted directly to PostgreSQL `stores.free_delivery_threshold`.

---

## 9. Firestore Transitional Status

- **Status:** **Secondary Transitional Mirror Only**.
- **Execution Order:** PostgreSQL is updated first and authoritatively. After PostgreSQL commit, `saveShopConfigFS()` is invoked as an advisory side effect.
- **Isolation:** If Firestore is offline or fails, the error is caught and logged as a warning; PostgreSQL changes succeed unconditionally.
- **Zero Checkout Impact:** Neither `GET /api/serviceability/check` nor `POST /api/checkout` reads Firestore `shops`.

---

## 10. Audit Logging

Every administrative operational mutation is recorded in PostgreSQL `audit_logs`:
- **Table:** `public.audit_logs`
- **Fields Logged:**
  - `id`: UUID (primary key)
  - `firebase_uid`: Acting administrator UID
  - `action`: `STORE_OPERATIONS_UPDATE` or `STORE_COORDINATE_RELOCATION`
  - `entity_type`: `STORE`
  - `entity_id`: Store UUID / Code (e.g. `store_primary`)
  - `old_data`: JSONB representation of previous store settings
  - `new_data`: JSONB representation of updated store settings
  - `ip_address`: Request client IP address
  - `user_agent`: Client user agent string
  - `created_at`: PostgreSQL `NOW()`

---

## 11. Test Results

### 1. Focused C.7.6-C Test Suite (`test/checkout-c76c-admin-service-area-canonical-alignment.test.ts`)
- **Total Tests:** 22
- **Passed:** 22
- **Failed:** 0
- **Duration:** 101 ms

### 2. Previous C.7 Regression Suites
- `test/checkout-f01-customer-app-blocker-removal.test.ts`: 9/9 PASS
- `test/checkout-f02-web-checkout-road-multiplier-removal.test.ts`: 15/15 PASS
- `test/checkout-f03-setup-address-canonical-serviceability.test.ts`: 22/22 PASS
- `test/checkout-f04-location-picker-unblock.test.ts`: 15/15 PASS
- `test/checkout-f05-fallback-removal.test.ts`: 9/9 PASS
- `test/checkout-c76a-place-order-decommission.test.ts`: 12/12 PASS
- `test/checkout-c76b-location-guard-serviceability.test.ts`: 20/20 PASS
- `test/server-serviceability.test.ts`: 76/76 PASS

### 3. Full Test Suite (`npm test`)
- **Total Test Files:** 58 passed (58/58)
- **Total Tests:** 833 passed (833/833)
- **Zero Regressions:** 100% test pass rate across all domains.

---

## 12. TypeScript Verification

- **Command:** `npm run typecheck`
- **Result:** PocketKirana application codebase (`lib/`, `app/admin/`, `app/api/`) compiles with **0 errors**.
- **Pre-existing Failures (Separately Documented):** Only the experimental, untracked spike files in `app/assistant/` and `app/api/copilotkit/` report missing `@copilotkit` packages. These are untracked and outside the application build path.

---

## 13. Build Verification

- **Functions Build (`npm --prefix functions run build`):** Succeeded with **0 errors**.
- **Customer App:** Untouched and intact.

---

## 14. Database Safety

- **Database DDL Executed:** `0`
- **Database DML Executed:** `0` (Only test-scoped rollbacks during unit testing)
- **Migrations Created or Run:** `0`
- **Existing Schema Preserved:** Utilized the existing canonical columns and check constraints established in Migration 002.

---

## 15. Deployment Safety

- **Code Deployed:** `0`
- **Commits:** `0`
- **Pushes:** `0`
- **Deployments:** `0`

---

## 16. Regression Results

| Subsystem | Status | Verification |
|---|---|---|
| Customer Address Setup | ✅ VERIFIED | Uses canonical `GET /api/serviceability/check`. |
| Customer Web Checkout | ✅ VERIFIED | Uses canonical `GET /api/serviceability/check` and `POST /api/checkout`. |
| Customer Mobile Checkout | ✅ VERIFIED | Cleanly aligned with canonical server serviceability. |
| Firebase `placeOrder` | ✅ VERIFIED | Decommissioned; rejects with 501. |
| `LocationPermissionGuard` | ✅ VERIFIED | Advisory check aligned with canonical API. |
| PhonePe Payment Sandbox | ✅ VERIFIED | Webhook checksums and payments verified. |
| FEFO Stock Reservation | ✅ VERIFIED | Batch reservations intact. |
| Transactional Outbox | ✅ VERIFIED | Event generation and worker lease fencing verified. |

---

## 17. Remaining Risks

1. **Multi-Store Onboarding:** While `admin_store_assignments` is now actively enforced by `verifyStoreAccess()`, the table currently has 0 production assignment rows because PocketKirana operates a single central darkstore (`store_primary`). When secondary darkstores are onboarded, assignment rows must be inserted for local store managers.
2. **Untracked CopilotKit Spikes:** The untracked files in `app/assistant/` and `app/api/copilotkit/` remain in the working tree from earlier local prototyping and should be either cleaned or officially integrated in a separate phase.

---

## 18. Rollback Plan

If any regression occurs:
1. Revert `app/admin/service-area/page.tsx` to commit `63dba5363579334b67e4ac9a401d94060be244bf`.
2. Revert `app/api/admin/store/operations/route.ts` and `lib/storeOperationsService.ts`.
3. Customer checkout and serviceability remain completely unaffected because they were already decoupled from Firestore in earlier phases.
4. Zero database rollback is needed because no schema migrations were created.

---

## 19. Final Gate & Summary Metrics

- **Files Changed:** 6 (5 code files + 1 test file)
- **Tests Passed:** 833 / 833 (100%)
- **TypeScript Result:** 0 errors in PocketKirana application code
- **Build Result:** Functions build clean; application code verified
- **Database DDL Count:** 0
- **Database DML Count:** 0
- **Migrations:** 0
- **Commits:** 0
- **Pushes:** 0
- **Deployments:** 0

**PHASE 2.7C.7.6-C IS COMPLETE.** Halted per execution rules awaiting user review.
