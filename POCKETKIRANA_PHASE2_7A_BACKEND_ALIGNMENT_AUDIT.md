# PocketKirana — Phase 2.7A Backend Business-Rule Alignment Audit

**Phase:** Phase 2.7A — Read-Only Backend Business-Rule Alignment Audit  
**Auditor Roles:** Senior Production Backend Architect, PostgreSQL Application Architect, Security Engineer, Codebase Auditor  
**Date:** 2026-10-02  
**Target Environment:** `pocketkirana_db` on `192.168.0.105:5433`  
**Execution Mode:** 100% READ-ONLY (No Code, Schema, Database, or Git Modifications)

---

## 1. Executive Summary

Following the successful execution and verification of **Migration 002** in Phase 2.6, this forensic audit examines the entire PocketKirana application layer against the 15 approved Phase 2 business rules. 

While PostgreSQL now houses the canonical schema extensions (`free_delivery_enabled`, `delivery_fee_tiers`, straight-line radius CHECK constraint `(3.00, 4.00, 5.00)`, non-negative free-delivery threshold CHECK, retired `minimum_order_value = 0.00`, index `idx_orders_store_id`, and `admin_store_assignments`), the application layer remains heavily coupled to legacy, mock, and Firestore-based business rules:

1. **Active 5% GST Imposition:** `app/api/checkout/route.ts` (Line 299), `components/customer/CartDrawer.tsx` (Line 53), and `app/checkout/page.tsx` (Line 121) actively calculate 5% tax and add it to customer totals, directly violating the mandate that GST charging is **DISABLED** (tax = ₹0).
2. **Obsolete Minimum Order Value Checks:** `lib/serverServiceability.ts` (Line 276) and `app/api/checkout/route.ts` (Line 144) continue to evaluate `subtotal < store.minimumOrderValue` and reject checkouts with `MINIMUM_ORDER_VALUE_NOT_MET`.
3. **Road Detour Distance & Multiplier Cutoffs:** `lib/serverServiceability.ts` (Lines 304–317) continues to enforce an artificial 1.35× road multiplier and 4.5 km maximum road cutoff (`ROAD_LIMIT_EXCEEDED`), overriding the straight-line Haversine radius rule.
4. **Split-Brain Store Configuration:** `app/api/serviceability/check/route.ts`, `app/api/checkout/validate/route.ts`, and `app/api/checkout/validate-serviceability/route.ts` query in-memory arrays and Firestore (`fetchShopsFS()`), completely bypassing PostgreSQL `stores`.
5. **Admin Operations Disconnected from PostgreSQL:** `app/admin/stores/page.tsx`, `app/admin/service-area/page.tsx`, and `app/api/admin/stores/[id]/route.ts` mutate in-memory state and Firestore documents. None write to PostgreSQL. Furthermore, neither developer authorization nor audit logging is enforced for store coordinate changes.
6. **Unused RBAC Assignment Schema:** `admin_store_assignments` exists in PostgreSQL with 0 rows, but zero application routes check it. Any user with role `admin` or `store_manager` can mutate any store.

---

## 2. Audit Scope

The audit covered all relevant layers of the repository:
* **Checkout Core:** `app/api/checkout/route.ts`, `app/api/checkout/calculate-price/route.ts`, `app/api/checkout/quote/route.ts`, `app/api/checkout/validate/route.ts`, `app/api/checkout/validate-serviceability/route.ts`.
* **Serviceability Authority:** `lib/serverServiceability.ts`, `lib/locationServices.ts`, `app/api/serviceability/check/route.ts`.
* **Pricing & Delivery Fees:** `lib/freeDelivery.ts`, `lib/pricingEngine.ts`, `lib/store.ts`.
* **Store Management & Admin APIs:** `app/api/admin/stores/route.ts`, `app/api/admin/stores/[id]/route.ts`, `app/api/admin/store/operations/route.ts`, `lib/storeOperationsService.ts`.
* **Frontend Web & Mobile App:** `app/checkout/page.tsx`, `components/customer/CartDrawer.tsx`, `customer-app/app/checkout/page.tsx`, `customer-app/app/cart/page.tsx`.
* **Firebase & Cloud Functions:** `functions/src/inventory/validateDeliveryZone.ts`, `functions/src/utils.ts`, `lib/firebaseServices.ts`.
* **Test Suite:** `test/server-serviceability.test.ts`, `test/checkout-total-state.test.ts`, `test/free-delivery-progress.test.ts`, `test/e2e-lifecycle.test.ts`.

---

## 3. Repository State

* **Current Branch:** `fix/page-readiness-production`
* **HEAD Commit:** `63dba53 feat: enforce canonical server-side serviceability`
* **Tracked Modifications:** `0` (100% clean tracked working tree)
* **Untracked Documentation / Reports:**
  * `POCKETKIRANA_PHASE0_BASELINE.md`
  * `POCKETKIRANA_PHASE1A_SERVICEABILITY_AUDIT.md`
  * `POCKETKIRANA_PHASE2_1_DATABASE_ARCHITECTURE_AUDIT.md`
  * `POCKETKIRANA_PHASE2_2_DATABASE_DECISION_AUDIT.md`
  * `POCKETKIRANA_PHASE2_3_MIGRATION_002_DRAFT_REVIEW.md`
  * `POCKETKIRANA_PHASE2_4_MIGRATION_002_FINAL_CODE_AUDIT.md`
  * `POCKETKIRANA_PHASE2_5A_CORRECTED_PRE_EXECUTION_SAFETY_CHECK.md`
  * `POCKETKIRANA_PHASE2_5B_FINAL_PRE_MIGRATION_VERIFICATION.md`
  * `POCKETKIRANA_PHASE2_5B_HOST_BACKUP_VERIFICATION.md`
  * `POCKETKIRANA_PHASE2_5B_PRE_MIGRATION_BACKUP_REPORT.md`
  * `POCKETKIRANA_PHASE2_6_MIGRATION_002_EXECUTION_REPORT.md`
  * `POCKETKIRANA_PHASE2_FINAL_ARCHITECTURE_AUDIT.md`
  * `POCKETKIRANA_PHASE2_READONLY_BUSINESS_RULE_AUDIT.md`
  * `scripts/migrations/002_add_phase2_store_operational_settings.js`
* **Audit Safety Attestation:** Zero files modified, zero commits made, zero database mutations executed.

---

## 4. Business Rule Compliance Matrix

| Rule | Approved Requirement | Current Implementation | File | Line | Classification | Severity | Compliant? | Required Future Change |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :---: | :--- |
| **1. Service Radius** | Straight-line only in (3, 4, 5) km; no multiplier or road cutoff | Computes road detour (1.35×) and rejects if > 4.5 km (`ROAD_LIMIT_EXCEEDED`) | `lib/serverServiceability.ts` | 304–317 | ACTIVE PRODUCTION LOGIC | **CRITICAL** | ❌ NO | Remove road detour check and multiplier; enforce straight-line Haversine only |
| **1. Service Radius** | Store-specific radius from PostgreSQL | Hardcodes 4.5 km fallback or 3.0 km default in non-PostgreSQL checks | `app/api/serviceability/check/route.ts` | 46 | ACTIVE PRODUCTION LOGIC | **HIGH** | ❌ NO | Query PostgreSQL `stores.delivery_radius_km` |
| **2. Store Location** | Permanent coords; dev auth required to change; audited | Any admin can change coordinates in memory/Firestore without dev auth | `app/admin/service-area/page.tsx` | 131–132 | ADMIN/OPERATIONAL LOGIC | **HIGH** | ❌ NO | Lock coordinate updates behind dev credentials + PostgreSQL audit log |
| **3. Store Hours** | Store-specific from PostgreSQL | Hardcodes 06:00–23:30 in darkstore operations service | `lib/storeOperationsService.ts` | 74–75 | ADMIN/OPERATIONAL LOGIC | **MEDIUM** | ❌ NO | Read `opening_time` and `closing_time` from PostgreSQL row |
| **4. Multi-Store** | PostgreSQL is authoritative; multi-store | In-memory and Firestore assume single store `Maule Kirana` / `store-1` | `lib/locationServices.ts` | 616 | MOCK/DEMO / ACTIVE | **HIGH** | ❌ NO | Deprecate `STORES_STATE` in favor of PostgreSQL pool queries |
| **5. Minimum Order** | Retired to 0.00; zero order rejection | Rejects carts if subtotal < minimumOrderValue (`MINIMUM_ORDER_VALUE_NOT_MET`) | `lib/serverServiceability.ts` | 276–283 | ACTIVE PRODUCTION LOGIC | **CRITICAL** | ❌ NO | Delete minimum order rejection branch completely |
| **6. GST / Tax** | GST charging DISABLED; tax = ₹0 | Calculates 5% tax and adds to order total (`Math.round(subtotal * 0.05)`) | `app/api/checkout/route.ts` | 299 | ACTIVE PRODUCTION LOGIC | **CRITICAL** | ❌ NO | Set `const tax = 0;` and persist `tax_amount = 0` |
| **6. GST / Tax** | Cart UI tax = ₹0 | Cart drawer calculates and displays 5% GST | `components/customer/CartDrawer.tsx` | 53 | FRONTEND DISPLAY LOGIC | **HIGH** | ❌ NO | Set `tax = 0` and remove tax line from customer summary |
| **6. GST / Tax** | Checkout UI tax = ₹0 | Customer checkout page calculates 5% GST and adds to grand total | `app/checkout/page.tsx` | 121 | FRONTEND DISPLAY LOGIC | **HIGH** | ❌ NO | Set `tax = 0` and remove GST row |
| **6. GST / Tax** | Mobile checkout tax = ₹0 | Mobile app calculates 5% tax in cart and checkout | `customer-app/app/checkout/page.tsx` | 92 | MOBILE LOGIC | **HIGH** | ❌ NO | Align mobile checkout to tax = 0 |
| **7. Delivery Fee** | Per-store JSONB tiers; ₹29 fallback | Fixed ₹29 fallback or hardcoded ₹15/₹25 without tier evaluation | `app/api/checkout/route.ts` | 298 | ACTIVE PRODUCTION LOGIC | **HIGH** | ❌ NO | Evaluate `delivery_fee_tiers` JSONB before falling back to `delivery_fee` |
| **8. Free Delivery** | Controlled by `free_delivery_enabled` & threshold | Unconditionally grants free delivery if subtotal >= threshold | `app/api/checkout/route.ts` | 298 | ACTIVE PRODUCTION LOGIC | **HIGH** | ❌ NO | Check `store.freeDeliveryEnabled === true` before waiving delivery fee |
| **8. Free Delivery** | Canonical threshold is ₹499 | Frontend hardcodes ₹500 threshold | `lib/freeDelivery.ts` | 7 | FRONTEND DISPLAY LOGIC | **HIGH** | ❌ NO | Align threshold constant to ₹499 or dynamic store query |
| **11. Serviceability Security**| Server must not trust client distance or store rules | Endpoints accept client coordinates and query Firestore instead of DB | `app/api/checkout/validate/route.ts` | 20–25 | LEGACY | **MEDIUM** | ❌ NO | Refactor or deprecate legacy checkout validation endpoints |
| **12. RBAC** | Main Admin vs Store Admin scoped | `requireRole` only verifies global role name; no store scoping | `lib/routeAuth.ts` | 74–82 | ADMIN/OPERATIONAL LOGIC | **HIGH** | ❌ NO | Add `requireStoreAccess(req, storeId)` querying `admin_store_assignments` |
| **13. Admin Store Assignments** | Scoped assignment mapping | Table created in DB (0 rows); zero code reads or writes it | `app/api/admin/stores/route.ts` | 12 | ADMIN/OPERATIONAL LOGIC | **HIGH** | ❌ NO | Create assignment APIs and guard store routes |
| **14. Store Registration**| Controlled store registration via PostgreSQL | No registration API exists; only in-memory push | `app/api/admin/stores/route.ts` | — | ADMIN/OPERATIONAL LOGIC | **MEDIUM** | ❌ NO | Implement `POST /api/admin/stores` inserting into PostgreSQL `stores` |
| **15. Store Deletion**| Guarded deactivation/deletion verifying 0 pending orders | No `DELETE` endpoint exists; status toggle ignores pending orders | `app/api/admin/stores/[id]/route.ts` | — | ADMIN/OPERATIONAL LOGIC | **MEDIUM** | ❌ NO | Implement `DELETE /api/admin/stores/[id]` with order and inventory dependency gates |

---

## 5. Serviceability Audit

### Active Inconsistencies:
1. **`lib/serverServiceability.ts` (Lines 303–317):**
   ```typescript
   const roadDistanceKm = Number((straightLineDistanceKm * store.roadDistanceMultiplier).toFixed(1));
   if (roadDistanceKm > store.maxRoadDistanceKm) {
     return {
       serviceable: false,
       code: 'ROAD_LIMIT_EXCEEDED',
       error: `Estimated road distance (${roadDistanceKm} km) exceeds the maximum allowed road limit of ${store.maxRoadDistanceKm} km for ${store.name}.`,
     };
   }
   ```
   *Conflict:* Phase 2 Approved Rule 1 strictly mandates: *"Serviceability uses ONLY straight-line Haversine distance. NO road-distance cutoff. NO OSRM distance for serviceability. NO radius multiplier. NO 1.35x or 1.40x multiplier. NO 4.5 km or 6 km rejection rule."*
2. **`app/api/serviceability/check/route.ts` (Lines 38–47):**
   * Conflict: Queries `getStores()` (in-memory mock array) rather than PostgreSQL. Fallback radius is `4.5 km`. Returns user message: `"PocketKirana currently delivers within 3 KM of our Neral store"`.
3. **`lib/locationServices.ts` (Lines 920–939):**
   * Fallback defines `DELIVERY_RADIUS_KM = 4.5;`, `roadDistanceKm = Math.round(distanceKm * 1.35 * 10) / 10;`, `deliveryFee = 15;`.

---

## 6. Checkout Audit

### Active Inconsistencies in `app/api/checkout/route.ts`:
1. **Line 144:**
   ```typescript
   const serviceabilityDecision = await evaluateServerServiceability(
     storeId,
     address?.latitude,
     address?.longitude,
     preflightSubtotal
   );
   ```
   *Impact:* Rejection will trigger if `preflightSubtotal < store.minimumOrderValue` (if non-zero) or if road distance exceeds 4.5 km.
2. **Line 298:**
   ```typescript
   const deliveryFee = subtotal >= resolvedStore.freeDeliveryThreshold ? 0 : resolvedStore.deliveryFee;
   ```
   *Conflict:* 
   - Does NOT inspect `free_delivery_enabled`. If disabled by admin, free delivery is still given.
   - Does NOT inspect or evaluate `delivery_fee_tiers` JSONB.
3. **Line 299:**
   ```typescript
   const tax = Math.round((subtotal - discount) * 0.05);
   ```
   *Conflict:* Imposes 5% tax on every order. Approved Rule 6 mandates GST is disabled (tax = 0).
4. **Line 300:**
   ```typescript
   const total = Math.max(0, subtotal - discount + deliveryFee + tax);
   ```
   *Conflict:* Overcharges customer by adding `tax`.

---

## 7. GST / Tax Audit

Active production and frontend locations applying 5% tax:
1. `app/api/checkout/route.ts:299` — `const tax = Math.round((subtotal - discount) * 0.05);` (ACTIVE PRODUCTION LOGIC — CRITICAL)
2. `components/customer/CartDrawer.tsx:53` — `const tax = Math.round((subtotal - discount) * 0.05);` (FRONTEND DISPLAY LOGIC — HIGH)
3. `app/checkout/page.tsx:121` — `const tax = mounted ? Math.round((subtotal - discount) * 0.05) : 0;` (FRONTEND DISPLAY LOGIC — HIGH)
4. `customer-app/app/checkout/page.tsx:92` — `const tax = mounted ? Math.round((subtotal - discount) * 0.05) : 0;` (MOBILE LOGIC — HIGH)
5. `customer-app/app/cart/page.tsx:65` — `const tax = Math.round(Math.max(0, subtotal - discount) * 0.05);` (MOBILE LOGIC — HIGH)
6. `app/api/checkout/quote/route.ts:38` — `const tax = Math.round((subtotal - discount) * 0.05);` (LEGACY API — MEDIUM)

---

## 8. Minimum Order Audit

Active locations checking minimum order value:
1. `lib/serverServiceability.ts:276–283` — Rejects orders if `subtotal < store.minimumOrderValue` with error code `MINIMUM_ORDER_VALUE_NOT_MET`. (ACTIVE PRODUCTION LOGIC — CRITICAL)
2. `lib/serverServiceability.ts:181` — Fallback reads `minimumOrderValue: parseInt(String(row.minimum_order_value ?? 199), 10)`. (ACTIVE PRODUCTION LOGIC — HIGH)
3. `functions/src/utils.ts:107` — Cloud Functions fallback configures `minimumOrderValue: 99`. (FIREBASE — MEDIUM)
4. `lib/mockData.ts:979` — Mock store defines `minimumOrderValue: 199`. (MOCK/DEMO — LOW)
5. `app/admin/stores/page.tsx:54` — Admin UI sets state `minOrder: activeStore.minimumOrderValue || 199`. (ADMIN/OPERATIONAL LOGIC — MEDIUM)

---

## 9. Delivery Fee Audit

Active delivery fee variations across the codebase:
1. `₹29.00`: PostgreSQL `stores.delivery_fee`, `lib/serverServiceability.ts:179`, `lib/freeDelivery.ts:8`, `app/api/checkout/route.ts:298`. (Canonical Fallback)
2. `₹15.00`: `lib/locationServices.ts:760, 939`, `app/admin/stores/page.tsx:55`, `lib/mockData.ts:980`. (Legacy mock/in-memory fee)
3. `₹25.00`: `lib/locationServices.ts:909` (if distance > 1km), `functions/src/utils.ts:108`. (Cloud Functions / Firestore default)
4. `₹20.00`: `app/api/checkout/quote/route.ts:37`. (Legacy quote route)
5. Dynamic Tiered Fee: `stores.delivery_fee_tiers` (JSONB) is present in PostgreSQL but not yet resolved by `lib/serverServiceability.ts` or `app/api/checkout/route.ts`.

---

## 10. Free Delivery Audit

Active free delivery logic:
1. **PostgreSQL Reality:** `free_delivery_enabled` (BOOLEAN, default `true`), `free_delivery_threshold` (NUMERIC, default `499.00`).
2. **`lib/serverServiceability.ts` & `app/api/checkout/route.ts`:** Resolves threshold (`499.00`), but completely ignores `free_delivery_enabled`. If disabled by admin in PostgreSQL, free delivery is still erroneously awarded.
3. **`lib/freeDelivery.ts:7` & `test/free-delivery-progress.test.ts:9`:** Hardcodes `FREE_DELIVERY_THRESHOLD = 500`. (Discrepancy: ₹500 vs PostgreSQL ₹499).
4. **`functions/src/utils.ts:109`:** Hardcodes `freeDeliveryThreshold: 299`.
5. **`app/api/checkout/validate/route.ts:45`:** Grants free delivery if `distKm <= 1.0` regardless of subtotal.

---

## 11. Store Configuration Audit

Currently, four competing store configuration sources exist in the project:
1. **PostgreSQL `stores` Table (Canonical):** Contains `store_primary` and `store_central_001` with authoritative operational fields.
2. **In-Memory `STORES_STATE` (`lib/locationServices.ts:616`):** Initialized from `INITIAL_STORES` (`lib/mockData.ts:960`). Used by `getStores()` and updated by `updateStoreConfig()`.
3. **Firestore `shops` Collection (`lib/firebaseServices.ts:1250`):** Polled and subscribed to by frontend pages via `fetchShopsFS()`.
4. **Firestore `settings/store` Document (`functions/src/utils.ts:99`):** Queried by Firebase Cloud Functions.

---

## 12. Multi-Store Audit

* **PostgreSQL:** Fully multi-store capable. Both `store_primary` and `store_central_001` exist and are active. `orders` contains orders for both stores.
* **Application Services:** `lib/storeOperationsService.ts:69` performs `SELECT ... FROM stores LIMIT 1`, assuming a single store.
* **Frontend Web:** `app/checkout/page.tsx:78` defaults `storeId = 'store-001'` without customer store selector UI.
* **Customer App:** Hardcoded to single darkstore hub.

---

## 13. Store Registration Audit

* **Target Rule:** Main Admin controls store registration initially; future registration permission must be RBAC-configurable.
* **Current State:**
  * No PostgreSQL store registration API exists (`POST /api/admin/stores` is missing).
  * `app/api/admin/stores/route.ts` only implements `GET` returning in-memory `getStores()`.
  * Store registration can only be done via raw SQL scripts or database migrations.

---

## 14. Store Deletion / Deactivation Audit

* **Target Rule:** Deletion/deactivation must verify: zero pending orders, inventory audit complete, zero unresolved discrepancies, zero blocking database dependencies.
* **Current State:**
  * No store deletion endpoint exists (`DELETE /api/admin/stores/[id]` is missing).
  * Store deactivation can be triggered via `app/api/admin/stores/[id]/route.ts` (PUT/PATCH), but it only updates in-memory `locationServices.ts` without checking pending orders or inventory in PostgreSQL.

---

## 15. RBAC Audit

* **Target Roles:** Main Admin, Store Admin, Picker, Delivery Partner, Customer.
* **Current Implementation (`lib/routeAuth.ts`):**
  * `requireRole(req, allowedRoles)` checks role name from headers (`x-pk-role`) or session cookie.
  * Does NOT perform store-scoped authorization. A Store Admin assigned to `store_central_001` can perform operations on `store_primary` if granted `admin` or `store_manager` role.
  * Server-side store authorization helper (`requireStoreAccess`) does not exist.

---

## 16. Admin Store Assignment Audit

* **PostgreSQL Target:** `admin_store_assignments` table created in Migration 002.
* **Current State:** Exactly `0` rows.
* **Application Usage:** Zero references across `app/`, `lib/`, `components/`, or `functions/`.
* **Required Implementation:** Assignment management APIs (`GET /api/admin/assignments`, `POST /api/admin/assignments`, `DELETE /api/admin/assignments/[id]`) and middleware verification.

---

## 17. Permanent Store Location Protection Audit

* **Target Rule:** Store coordinates are permanent operational coordinates. Normal Store Admin cannot change them. Developer authorization required. Location changes must be audited with old/new coordinates, actor, and timestamp. Never expose developer credentials to client.
* **Current Vulnerabilities:**
  * `app/admin/service-area/page.tsx:111–139`: Admin UI permits dragging map pin or entering coordinates and clicking save.
  * `app/admin/stores/page.tsx:88–89`: Allows editing latitude and longitude in form inputs.
  * Neither UI nor API checks for developer authorization.
  * No database audit table exists for coordinate revisions.

---

## 18. Frontend Duplication Audit

* **Customer Web Cart Drawer (`components/customer/CartDrawer.tsx`):**
  * Line 49: Hardcoded threshold `499`.
  * Line 51: Hardcoded delivery fee `29`.
  * Line 53: Hardcoded 5% GST calculation.
* **Customer Web Checkout Page (`app/checkout/page.tsx`):**
  * Line 88: Syncs stores from Firestore (`fetchShopsFS()`).
  * Line 105: Validates serviceability using in-memory `checkZoneServiceability`.
  * Line 121: Computes 5% tax.
  * Line 848: Renders "Taxes (GST) ₹{tax}".
* **Free Delivery Hook (`lib/freeDelivery.ts`):**
  * Line 7: Hardcoded `FREE_DELIVERY_THRESHOLD = 500`.
  * Line 8: Hardcoded `DEFAULT_DELIVERY_FEE = 29`.

---

## 19. Mobile Duplication Audit

* **`customer-app/app/checkout/page.tsx`:**
  * Line 92: `const tax = mounted ? Math.round((subtotal - discount) * 0.05) : 0;`
  * Line 93: `const total = mounted ? Math.max(0, subtotal - discount + deliveryCharge + tax) : 0;`
  * Lines 561–562: Displays Taxes row.
* **`customer-app/app/cart/page.tsx`:**
  * Line 65: `const tax = Math.round(Math.max(0, subtotal - discount) * 0.05);`
  * Lines 491–492: Displays "Govt. Taxes & GST".
* **`customer-app/app/orders/[id]/OrderTrackingClient.tsx`:**
  * Line 216: Legacy fee fallback `itemTotal > 199 ? 0 : 15`.

---

## 20. Firebase / Cloud Functions Duplication Audit

* **`functions/src/inventory/validateDeliveryZone.ts`:**
  * Evaluates Haversine distance against Firestore `settings/store` document.
  * Bypasses PostgreSQL `stores` table entirely.
* **`functions/src/utils.ts:101–112`:**
  * Fallback store config sets `minimumOrderValue: 99`, `deliveryFee: 25`, `freeDeliveryThreshold: 299`.
* **`lib/firebaseServices.ts:1250–1356`:**
  * Maintains separate Firestore store documents (`shops` collection) with `saveShopConfigFS` and `updateShopLocationAndRadiusFS`.

---

## 21. Test / Mock / Legacy Audit

Tests encoding obsolete business rules that must be updated in Phase 2.8:
1. `test/server-serviceability.test.ts`:
   * Lines 136–147: Asserts rejection of carts < ₹199 with `MINIMUM_ORDER_VALUE_NOT_MET`.
   * Lines 166–191: Asserts rejection when road detour exceeds 4.5 km with `ROAD_LIMIT_EXCEEDED`.
2. `test/free-delivery-progress.test.ts`:
   * Line 10: Asserts `FREE_DELIVERY_THRESHOLD` is 500.
   * Line 60: Asserts cart at ₹499 is not unlocked.
3. `test/checkout-total-state.test.ts`:
   * Lines 51–54, 96–97, 244–249: Asserts that 5% tax is calculated and added to totals.
4. `test/transactional-red-team.test.ts`:
   * Line 328: Asserts `expect(pricing.taxAmount).toBe(25);`.
5. `test/e2e-lifecycle.test.ts`:
   * Line 32: Mock store defines `minimum_order_value: 50`.

---

## 22. Security / BYPASS Audit

1. **Serviceability Bypass via Secondary Endpoints:**
   * While `POST /api/checkout` strictly validates coordinates and distance server-side via PostgreSQL, `POST /api/checkout/validate` and `POST /api/checkout/validate-serviceability` accept arbitrary addresses and validate against Firestore/mocks. A client relying on these pre-check endpoints receives inaccurate serviceability feedback.
2. **Unenforced Free Delivery Toggle:**
   * If a store admin disables free delivery in PostgreSQL (`free_delivery_enabled = false`), `POST /api/checkout` line 298 still grants free delivery because the code only evaluates `subtotal >= resolvedStore.freeDeliveryThreshold`.
3. **Cross-Store Administrative Action Risk:**
   * Any authenticated `admin` or `store_manager` can invoke `app/api/admin/store/operations` or `app/api/admin/stores/[id]` with arbitrary store IDs. The server never validates whether the user is assigned to that store in `admin_store_assignments`.
4. **Unauthorized Store Relocation:**
   * `app/admin/service-area/page.tsx` allows updating store latitude and longitude without requiring developer password verification or signing a security audit token.

---

## 23. Canonical Source-of-Truth Audit

| Dimension | Canonical Target (PostgreSQL) | Current Active Source in Code | Divergence Severity |
| :--- | :--- | :--- | :---: |
| **Store Identity & List** | `stores` table (2 rows) | `lib/locationServices.ts` (`INITIAL_STORES`) & Firestore (`shops`) | **CRITICAL** |
| **Delivery Radius** | `stores.delivery_radius_km` (3, 4, 5 km) | Mixed: 4.5 km in mocks, 3.0 km in serviceability route | **HIGH** |
| **Road Multiplier & Cutoff** | DEPRECATED (Straight-line only) | Active in `lib/serverServiceability.ts` (1.35×, 4.5 km) | **CRITICAL** |
| **Store Hours** | `stores.opening_time`, `closing_time` | Hardcoded 06:00–23:30 in `lib/storeOperationsService.ts` | **MEDIUM** |
| **Minimum Order** | Retired (`0.00`) | Enforced in `lib/serverServiceability.ts` (rejection < min) | **CRITICAL** |
| **GST / Tax** | DISABLED (`0.00`) | Enforced 5% tax in `app/api/checkout/route.ts` & cart drawer | **CRITICAL** |
| **Free Delivery Toggle** | `stores.free_delivery_enabled` | Unchecked in checkout; assumed always enabled | **HIGH** |
| **Free Delivery Threshold**| `stores.free_delivery_threshold` (₹499) | Conflicting: ₹500 in `lib/freeDelivery.ts`, ₹299 in functions | **HIGH** |
| **Delivery Fee** | `stores.delivery_fee_tiers` + fallback | Fixed ₹29 or hardcoded ₹15/₹25 in secondary routes | **HIGH** |

---

## 24. Complete File Change Inventory

The following files require modification in subsequent implementation phases (DO NOT MODIFY NOW):

| File Path | Relevant Lines | Affected Rule | Type of Change | Subsystem |
| :--- | :---: | :--- | :--- | :--- |
| `app/api/checkout/route.ts` | 144, 298–300 | 5, 6, 7, 8 | Disable 5% tax (`tax = 0`); support tiered delivery fee; remove minimum order rejection; check `free_delivery_enabled` | Backend |
| `lib/serverServiceability.ts` | 16–18, 135–182, 276–283, 303–320 | 1, 5, 7, 8 | Remove road multiplier & 4.5 km limit; remove minimum order rejection; query `free_delivery_enabled` & `delivery_fee_tiers` | Backend |
| `app/api/serviceability/check/route.ts` | 38–47 | 1, 4, 10 | Query PostgreSQL `stores` table instead of in-memory `locationServices.ts` | Backend |
| `app/api/checkout/quote/route.ts` | 37–39 | 6, 7, 8 | Align pricing to tax = 0 and canonical delivery fee | Backend |
| `app/api/checkout/validate/route.ts` | 20–46 | 1, 10, 11 | Deprecate or refactor to use PostgreSQL `evaluateServerServiceability` | Backend |
| `app/api/checkout/validate-serviceability/route.ts`| 42–88 | 1, 10, 11 | Deprecate or refactor to use PostgreSQL `evaluateServerServiceability` | Backend |
| `lib/freeDelivery.ts` | 7, 28–33 | 7, 8 | Update threshold from 500 to 499; support dynamic store threshold | Frontend Core |
| `components/customer/CartDrawer.tsx` | 49–54, 311 | 6, 8 | Set tax = 0; align threshold to 499; remove tax UI row | Frontend UI |
| `app/checkout/page.tsx` | 88, 121–122, 847–848 | 4, 6, 10 | Set tax = 0; remove tax row; load stores from PostgreSQL API | Frontend UI |
| `lib/routeAuth.ts` | 74–82 | 12, 13 | Add `requireStoreAccess(req, storeId)` helper querying `admin_store_assignments` | Security / Auth |
| `app/api/admin/stores/route.ts` | 12–16 | 4, 10, 14 | Query PostgreSQL `stores` table; implement `POST` for store registration | Admin API |
| `app/api/admin/stores/[id]/route.ts` | 14, 35, 61 | 2, 4, 10, 15 | Query/update PostgreSQL `stores`; add developer auth gate for coords; add `DELETE` gate | Admin API |
| `app/api/admin/store/operations/route.ts` | 29, 62–68 | 1, 3, 12 | Check store-level authorization; update PostgreSQL hours & radius | Admin API |
| `lib/storeOperationsService.ts` | 65–77, 132–139 | 1, 3, 4 | Remove hardcoded hours (06:00–23:30) and radius (5.0); persist changes to PostgreSQL | Backend Core |
| `app/admin/service-area/page.tsx` | 127–148 | 2, 10 | Lock coordinate changes behind developer authorization; save to PostgreSQL | Admin UI |
| `app/admin/stores/page.tsx` | 54–61, 140–145 | 1, 2, 5, 10 | Remove road multiplier; set min order to 0; lock coordinates; save to PostgreSQL | Admin UI |
| `customer-app/app/checkout/page.tsx` | 92–93, 561–562 | 6 | Set tax = 0; remove Taxes row in mobile checkout | Mobile |
| `customer-app/app/cart/page.tsx` | 65–66, 491–492 | 6 | Set tax = 0; remove Taxes row in mobile cart | Mobile |
| `test/server-serviceability.test.ts` | 136–191 | 1, 5 | Remove obsolete tests asserting road detour rejection & min order rejection | Test / QA |
| `test/checkout-total-state.test.ts` | 51–54, 96–97, 244–249 | 6 | Update expected total assertions to reflect tax = 0 | Test / QA |
| `test/free-delivery-progress.test.ts` | 10, 60–66, 105–106 | 8 | Align expected threshold to ₹499 | Test / QA |

---

## 25. Conflicting Business Rules Inventory

| Old / Conflicting Rule | Exact Location in Code | Current Active Behavior | Approved Target Rule |
| :--- | :--- | :--- | :--- |
| **5% Sales Tax** | `app/api/checkout/route.ts:299` | Calculates `Math.round((subtotal - discount) * 0.05)` and adds to total | GST charging is DISABLED. Tax = ₹0. Total = subtotal - discount + delivery fee |
| **5% Tax in Cart** | `components/customer/CartDrawer.tsx:53` | Displays `Taxes: ₹{tax}` and includes in grand total | Tax = ₹0. Tax row removed from customer cart drawer |
| **5% Tax in Checkout**| `app/checkout/page.tsx:121` | Displays `Taxes (GST): ₹{tax}` and includes in payment total | Tax = ₹0. Tax row removed from checkout payment breakdown |
| **Minimum Order Rejection**| `lib/serverServiceability.ts:276` | Rejects order if `subtotal < store.minimumOrderValue` | Minimum order requirement is retired. Orders must NOT be rejected |
| **Road Detour Cutoff** | `lib/serverServiceability.ts:308` | Rejects order if `straightLine * 1.35 > maxRoadDistanceKm` | Serviceability uses ONLY straight-line Haversine distance; no road cutoff |
| **Unchecked Free Delivery**| `app/api/checkout/route.ts:298` | Awards free delivery whenever subtotal >= 499 | Free delivery requires `free_delivery_enabled = true` in PostgreSQL |
| **Fixed ₹500 Threshold** | `lib/freeDelivery.ts:7` | Progress bar and eligibility use hardcoded ₹500 | Canonical threshold is ₹499 (or store-specific from PostgreSQL) |
| **In-Memory Store Listing**| `app/api/admin/stores/route.ts:12` | Returns `INITIAL_STORES` array from memory | Returns live stores from PostgreSQL `stores` table |
| **Firestore Service Area** | `app/admin/service-area/page.tsx:145`| Saves store settings to Firestore `shops` document | Saves store operational settings to PostgreSQL `stores` table |
| **Unrestricted Coordinates**| `app/api/admin/stores/[id]/route.ts:35`| Allows updating latitude/longitude without developer auth | Permanent coordinates require developer authorization & audit log |
| **Unscoped Store Admin** | `lib/routeAuth.ts:74` | Checks only role name; allows cross-store access | Must enforce `admin_store_assignments` mapping per store |

---

## 26. Recommended Phase 2.7 Implementation Order

To prevent regressions, broken builds, or order failures, the implementation should be executed in the following strict order:

1. **Step 1: Core Backend & Checkout Alignment**
   * Refactor `lib/serverServiceability.ts`:
     * Query `free_delivery_enabled` and `delivery_fee_tiers` from PostgreSQL.
     * Remove road multiplier calculation and `ROAD_LIMIT_EXCEEDED` check.
     * Remove `MINIMUM_ORDER_VALUE_NOT_MET` validation branch.
     * Implement delivery fee tier resolution fallback to `delivery_fee`.
     * Check `free_delivery_enabled` before zeroing delivery fee.
   * Refactor `app/api/checkout/route.ts`:
     * Set `const tax = 0;` and persist `tax_amount = 0`.
     * Update total calculation: `Math.max(0, subtotal - discount + deliveryFee)`.
     * Ensure `freeDeliveryEnabled` is respected.
2. **Step 2: Canonical Serviceability API Alignment**
   * Refactor `app/api/serviceability/check/route.ts` to query PostgreSQL `stores` table dynamically using `evaluateServerServiceability`.
   * Deprecate or align secondary checkout validation endpoints (`validate/route.ts`, `validate-serviceability/route.ts`, `quote/route.ts`).
3. **Step 3: Frontend & Customer App Alignment**
   * Update `lib/freeDelivery.ts` threshold constant to `499` (or dynamic store-based resolution).
   * Update `components/customer/CartDrawer.tsx` to set `tax = 0` and remove tax row.
   * Update `app/checkout/page.tsx` to set `tax = 0`, remove tax row, and fetch stores from PostgreSQL API.
   * Update `customer-app/app/checkout/page.tsx` and `cart/page.tsx` to set `tax = 0`.
4. **Step 4: Admin Store & RBAC API Implementation**
   * Implement PostgreSQL-backed `app/api/admin/stores/route.ts` (GET all stores, POST register store).
   * Implement PostgreSQL-backed `app/api/admin/stores/[id]/route.ts` (GET, PATCH operational settings, DELETE with order dependency gates).
   * Implement coordinate protection middleware requiring developer credentials and recording audit entries.
   * Implement `requireStoreAccess` in `lib/routeAuth.ts` and assignment APIs (`/api/admin/assignments`).
5. **Step 5: Admin UI Integration**
   * Align `app/admin/stores/page.tsx` and `app/admin/service-area/page.tsx` to call PostgreSQL admin APIs instead of in-memory/Firestore mutators.
6. **Step 6: Test Suite Alignment & Regression Pass**
   * Update `test/server-serviceability.test.ts` (remove road cutoff and min order tests; test straight-line and tiered fees).
   * Update `test/checkout-total-state.test.ts` (assert tax = 0).
   * Update `test/free-delivery-progress.test.ts` (assert threshold = 499).
   * Run full test suite (`npm test`) and Next.js build validation.

---

## 27. Risks / Blockers

* **Test Suite Failure Risk:** Modifying `app/api/checkout/route.ts` to zero out tax will immediately cause `test/checkout-total-state.test.ts` and `test/transactional-red-team.test.ts` to fail until those test assertions are aligned.
* **Serviceability Test Failure Risk:** Removing `MINIMUM_ORDER_VALUE_NOT_MET` and `ROAD_LIMIT_EXCEEDED` will fail corresponding tests in `test/server-serviceability.test.ts` until tests are refactored.
* **E2E Lifecycle Dependency:** `test/e2e-lifecycle.test.ts` relies on mocked pool queries. Alignment must preserve the transaction structure (`BEGIN`, `NEXTVAL`, `FOR UPDATE`, `COMMIT`).

---

## 28. Final Gate

==================================================  
### READY FOR PHASE 2.7B IMPLEMENTATION DESIGN  
==================================================

The audit is complete. All 15 approved business rules have been benchmarked against the codebase, every conflicting file and line number has been cataloged, and a risk-mitigated implementation sequence has been established.

**Status:** Awaiting user command before drafting Phase 2.7B Implementation Design. Zero application code or database changes have been made.
