# Phase 2.7C.7.6-D — Remaining Legacy UI & Business-Rule Cleanup Implementation Report

**Document ID:** `PHASE_2_7C_7_6_D_IMPLEMENTATION_REPORT.md`  
**Phase:** Phase 2.7C.7.6-D (Remaining Legacy UI & Business-Rule Cleanup)  
**Execution Timestamp:** 2026-10-04T07:05:00+05:30  
**Repository:** `PocketKirana`  
**Baseline Commit / HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`  

---

## 1. Executive Summary

Phase 2.7C.7.6-D completes the cleanup of remaining legacy UI business-rule authority, hardcoded copy strings, dead SDK stubs, and legacy callable deprecations. 

In this phase:
1. **Not-Serviceable Page Cleanup (`/not-serviceable`):** Parameterized `customer-app/app/not-serviceable/page.tsx` and created `app/not-serviceable/page.tsx` for the web app. Hardcoded claims (`3 KM`, `3.0 KM`, `Maule Kirana Shop (Neral)`, `3 KM Zone`) were completely removed and replaced with dynamic query parameters (`dist`, `maxDist`, `store`) and neutral fallback copy.
2. **Dead SDK Stub Removal:** Removed dead `checkoutApi.placeOrder` stub in `services/api/index.ts` pointing to the nonexistent `/api/checkout/place-order` route.
3. **Legacy Firebase Callable Deprecation:** Annotated `functions/src/inventory/validateDeliveryZone.ts` with explicit `@deprecated NON-AUTHORITATIVE` notices, matching `validateDeliveryZoneServerSide` and `callValidateDeliveryZone`.
4. **Clean Production Gate Authority:** Verified that no active production checkout or order path uses `checkZoneServiceability`, `validateDeliveryZone`, or legacy `placeOrder`.
5. **Full Regression Validation:** 18 new focused tests in `test/checkout-c76d-legacy-ui-cleanup.test.ts` pass, all 218 C.7 regression suite tests pass, and the full test suite passes with 851/851 tests green (100%).

---

## 2. Files Changed

### Modified Files:
1. [`customer-app/app/not-serviceable/page.tsx`](file:///d:/pocketkirana/customer-app/app/not-serviceable/page.tsx):
   - Parameterized query parameters `dist`, `maxDist`, `store`.
   - Replaced static "3 KM of our Neral store" and "Maule Kirana Shop (Neral)" with dynamic values or neutral fallback copy ("This location is currently outside the delivery area for the selected store.").
   - Eliminated hardcoded "3 KM Zone" footer.
2. [`services/api/index.ts`](file:///d:/pocketkirana/services/api/index.ts):
   - Removed dead stub `checkoutApi.placeOrder` pointing to non-existent `/api/checkout/place-order`.
3. [`functions/src/inventory/validateDeliveryZone.ts`](file:///d:/pocketkirana/functions/src/inventory/validateDeliveryZone.ts):
   - Added `@deprecated NON-AUTHORITATIVE` JSDoc annotation.
   - Compiled to `functions/lib/inventory/validateDeliveryZone.js` via `npm --prefix functions run build`.

### Created Files:
4. [`app/not-serviceable/page.tsx`](file:///d:/pocketkirana/app/not-serviceable/page.tsx):
   - Added canonical parameterized not-serviceable page to web Next.js app.
5. [`test/checkout-c76d-legacy-ui-cleanup.test.ts`](file:///d:/pocketkirana/test/checkout-c76d-legacy-ui-cleanup.test.ts):
   - 18 focused regression tests verifying UI neutrality, authority absence, deprecations, and admin alignment.

---

## 3. D.1 Not-Serviceable Cleanup

Inspected and updated:
- `customer-app/app/not-serviceable/page.tsx`
- `app/not-serviceable/page.tsx`

### Specific Changes Made:
- **Universal 3 KM Claim:** Removed `<span className="font-black text-[#004D21] dark:text-emerald-400">3 KM</span> of our Neral store.` Now dynamically renders `{maxRadiusKm.toFixed(1)} KM` if provided by query parameters; otherwise renders: `"This location is currently outside the delivery area for the selected store."`
- **Store Identity:** Removed hardcoded `"Maule Kirana Shop (Neral)"`. Now displays `{storeName || 'Selected Store'}`.
- **Max Radius Metric:** Replaced hardcoded `3.0 KM` with `{maxRadiusKm !== null ? `${maxRadiusKm.toFixed(1)} KM` : 'Area Limit'}`.
- **Warning Notice:** Replaced hardcoded `"📍 Orders and checkout are restricted to addresses within 3 KM of Maule Kirana."` with dynamic or neutral copy: `"📍 Orders and checkout are restricted to addresses within the verified delivery area."`
- **Links & Footer:** Removed `"About Maule Kirana · PocketKirana"` (now `"About PocketKirana"`) and removed `"Pocket Kirana · Neral Express Delivery (3 KM Zone)"` (now `"Pocket Kirana · Express Delivery"`).

---

## 4. D.2 Legacy Authority Scan

Repository-wide scan for legacy symbols confirmed:
- `checkZoneServiceability`: 0 callers in checkout or address setup. Retained only in `lib/locationServices.ts` marked `@deprecated NON-AUTHORITATIVE`.
- `calculateDeliveryFee`: 0 callers in checkout. Delivery fee is computed authoritatively by backend `resolveDeliveryFee()` from PostgreSQL `stores`.
- `STORES_STATE` / `INITIAL_STORES`: Confined to client-side mock initializations and fallback mocks. Zero authority in `POST /api/checkout` or `GET /api/serviceability/check`.
- `fetchShopsFS` / `saveShopConfigFS`: `fetchShopsFS` removed from admin service area. `saveShopConfigFS` removed from admin UI save path; retained strictly as a secondary non-fatal transitional mirror write in `lib/storeOperationsService.ts:377` after PostgreSQL commit.
- `validateDeliveryZone` / `validateDeliveryZoneServerSide` / `callValidateDeliveryZone`: 0 production callers. All three marked `@deprecated NON-AUTHORITATIVE`.
- `minimumOrderValue` / `minimumOrder` / `minOrder`: Permanently `0.00` in PostgreSQL `stores`. UI displays `₹0 (Retired in v2.6)`. Zero checkout blockers.
- `roadDistanceKm` / `roadDistanceMultiplier` / `1.35` / `1.4`: 0 occurrences in checkout routes. Haversine straight-line distance is canonical.
- `4.5`: Completely removed as hardcoded radius cutoff.
- `₹29` / `₹499`: Loaded dynamically from PostgreSQL `stores.delivery_fee` and `stores.free_delivery_threshold`.
- `₹199`: Retired minimum order value; removed from checkout gates.
- `Maule Kirana` / `Neral`: Removed from serviceability UI copy. Preserved only in legal / FSSAI disclosure documents (`lib/legalData.ts`, `lib/invoiceEngine.ts`).

---

## 5. D.3 Active Authority Findings

**Zero active legacy authority remains.**
- No active production path blocks checkout based on client-side distance or legacy rules.
- No active production path enforces minimum order amounts.
- No active production path computes authoritative delivery fees on the client.
- No active production path creates orders through Firebase `placeOrder` or `/api/checkout/place-order`.
- PostgreSQL `stores` evaluated by `evaluateServerServiceability()` in `POST /api/checkout` is the sole transactional authority.

---

## 6. D.4 LocationPermissionGuard Verification

Inspected:
- `customer-app/components/LocationPermissionGuard.tsx`
- `lib/locationFlowService.ts`

### Findings:
- Aligned in Phase 2.7C.7.6-B.
- Renders `{children}` unconditionally.
- Does not block navigation to `/checkout` or order submission.
- Calls canonical `GET /api/serviceability/check?lat=...&lon=...`.
- Does not calculate authoritative fees.
- Does not enforce minimum order rules.

---

## 7. D.5 Firebase Serviceability Verification

Inspected:
- `functions/src/inventory/validateDeliveryZone.ts`
- `lib/locationServices.ts:887` (`validateDeliveryZoneServerSide`)
- `lib/functionsClient.ts:155` (`callValidateDeliveryZone`)

### Findings:
- `functions/src/inventory/validateDeliveryZone.ts` annotated with `@deprecated NON-AUTHORITATIVE`.
- Built cleanly with `npm --prefix functions run build`.
- Zero active production callers across the repository.
- Firebase Auth and FCM remain untouched.

---

## 8. D.6 Legacy SDK Verification

Inspected:
- `services/api/index.ts`

### Findings:
- `checkoutApi.placeOrder` previously called nonexistent `/api/checkout/place-order`.
- Audited codebase: zero callers existed.
- Method safely removed.
- `checkoutApi.getQuote` remains for quote checks.
- No new checkout endpoints or order-creation paths introduced.

---

## 9. D.7 Admin Service Area Regression

Inspected:
- `app/admin/service-area/page.tsx`
- `lib/storeOperationsService.ts`

### Findings:
- Reads and writes strictly via canonical `/api/admin/store/operations`.
- Delivery radius constrained strictly to `[3.0, 4.0, 5.0]` km segmented buttons.
- Minimum order input removed; displays badge `₹0 (Retired in v2.6)`.
- Free delivery toggle and threshold controls active and functional.
- Coordinates displayed read-only with "Protected GPS Coordinates" badge.
- Firestore write occurs only as secondary background mirror in `lib/storeOperationsService.ts`.

---

## 10. D.8 Business Default Verification

Confirmed zero introduction of fallback business authority defaults:
- No hardcoded `radius = 3`, `radius = 4.5`, or `radius = 5` in customer business logic.
- No hardcoded `fee = 29` or `threshold = 499` in checkout.
- No minimum order defaults (`₹199`, `₹99`).
- No road multipliers (`1.35`, `1.4`).
- All business metrics dynamically resolved by server via `evaluateServerServiceability` and PostgreSQL `stores`.

---

## 11. Tests

### 1. Focused C.7.6-D Suite:
```bash
npx vitest run test/checkout-c76d-legacy-ui-cleanup.test.ts
```
**Result:** 18 passed (18 tests, 100%)

### 2. C.7 Regression Suite:
```bash
npx vitest run test/checkout-c76d-legacy-ui-cleanup.test.ts test/checkout-c76c-admin-service-area-canonical-alignment.test.ts test/checkout-c76b-location-guard-serviceability.test.ts test/checkout-c76a-place-order-decommission.test.ts test/checkout-f01-customer-app-blocker-removal.test.ts test/checkout-f02-web-checkout-road-multiplier-removal.test.ts test/checkout-f03-setup-address-canonical-serviceability.test.ts test/checkout-f04-location-picker-unblock.test.ts test/checkout-f05-fallback-removal.test.ts test/server-serviceability.test.ts
```
**Result:** 10 passed (218 tests, 100%)

### 3. Full Repository Test Suite:
```bash
npm test
```
**Result:** 59 passed (851 tests, 100%)

---

## 12. TypeScript Verification

- **Customer App:** `npx tsc --noEmit` in `customer-app` passed with **0 errors**.
- **Functions:** `npm --prefix functions run build` passed with **0 errors**.
- **Core PocketKirana Web App:** PocketKirana application files have **0 errors** (pre-existing untracked `app/api/copilotkit/` and `app/assistant/` experimental files remain isolated).

---

## 13. Build Verification

- **Customer App Production Build:** `npm --prefix customer-app run build` succeeded with code **0**. All 199 static routes generated cleanly, including `/not-serviceable`.
- **Functions Build:** `tsc` compiled cleanly.

---

## 14. Database Safety

A live READ-ONLY verification was executed against PostgreSQL:
```sql
SELECT id, name, code, is_active, latitude, longitude, delivery_radius_km, minimum_order_value FROM stores;
```
### Database State Verified:
- `stores`: 2 rows (`store_primary` and `store_central_001`), both active, coordinates `(19.02245360, 73.32100180)` untouched, `minimum_order_value` = 0.
- `orders`: 53 rows untouched.
- `inventory`: 0 rows untouched.
- `admin_store_assignments`: 0 rows untouched.
- `audit_logs`: 0 rows untouched.
- **DDL / DML mutations executed:** **0**.

---

## 15. Deployment Safety

- Zero deployments executed.
- Zero commits or pushes performed.
- All changes are backward-compatible and local to the working tree.

---

## 16. Repository-Wide Classification Matrix

| Legacy Pattern | Occurrences in Code | Active Authority? | Classification | Action Taken |
|---|---:|:---:|---|---|
| `checkZoneServiceability` | 1 (`lib/locationServices.ts:704`) | **NO** | DEPRECATED | Retained with `@deprecated` annotation; 0 callers in checkout. |
| `calculateDeliveryFee` | 0 in checkout paths | **NO** | DEPRECATED / MOCK | Backend `resolveDeliveryFee` is canonical. |
| `placeOrder` (Firebase callable) | 1 (`functions/src/orders/placeOrder.ts`) | **NO** | DECOMMISSIONED | Throws `failed-precondition` unconditionally; 0 callers. |
| `placeOrder` (SDK stub) | 0 (`services/api/index.ts`) | **NO** | DEAD SDK STUB | Removed dead stub in C.7.6-D. |
| `saveShopConfigFS` | 1 (`lib/storeOperationsService.ts:377`) | **NO** | TRANSITIONAL MIRROR | Secondary non-fatal mirror after PostgreSQL commit. |
| `fetchShopsFS` | 0 in admin service-area | **NO** | DEPRECATED | Removed from canonical admin UI. |
| `validateDeliveryZone` | 1 (`functions/src/inventory/...`) | **NO** | DEPRECATED | Marked `@deprecated NON-AUTHORITATIVE`. |
| `validateDeliveryZoneServerSide` | 1 (`lib/locationServices.ts:887`) | **NO** | DEPRECATED | Marked `@deprecated NON-AUTHORITATIVE`. |
| `callValidateDeliveryZone` | 1 (`lib/functionsClient.ts:155`) | **NO** | DEPRECATED | Marked `@deprecated NON-AUTHORITATIVE`. |
| `minimumOrder` / `minOrder` | 0 in checkout gates | **NO** | RETIRED (v2.6) | Display badge `₹0 (Retired in v2.6)`; 0 checkout enforcement. |
| `roadDistanceMultiplier` / `1.35` / `1.4` | 0 in checkout routes | **NO** | NAVIGATION HELPER | Retained in OSRM polylines for drivers; removed from checkout. |
| `4.5` (km cutoff) | 0 in checkout routes | **NO** | RETIRED | Replaced by PostgreSQL `delivery_radius_km`. |
| `3 KM` / `5 KM` | 0 hardcoded claims in UI | **NO** | PARAMETERIZED | `/not-serviceable` consumes dynamic query parameters. |
| `₹29` / `₹499` | 0 hardcoded in checkout | **NO** | CANONICAL DB | Managed in PostgreSQL `stores`. |
| `₹199` | 0 in checkout gates | **NO** | RETIRED | Removed. |
| `Maule Kirana` / `Neral` | 0 in serviceability UI | **NO** | LEGAL DISCLOSURE | Removed from customer UI; retained in legal/FSSAI disclosures. |

---

## 17. Remaining Risks

1. **Inherited from C.7.6-C (In-Memory Nonce Tracker):**  
   In `lib/coordinateProtection.ts`, developer coordinate override nonces are tracked in Node.js process heap memory. In a multi-worker cluster (e.g., PM2 with multiple workers) or horizontally scaled multi-instance deployment, nonces are process-isolated. This remains scheduled for post-C.7 hardening (persisting consumed nonces to PostgreSQL `consumed_developer_nonces`).
2. **Untracked Experimental CopilotKit Files:**  
   `app/api/copilotkit/` and `app/assistant/` remain in working tree from an earlier experiment. They do not affect production PocketKirana code, but prevent root `next build` from compiling unless removed or ignored.

---

## 18. Rollback Plan

If rollback of Phase 2.7C.7.6-D is required:
1. Revert `customer-app/app/not-serviceable/page.tsx` via `git checkout -- customer-app/app/not-serviceable/page.tsx`.
2. Remove `app/not-serviceable/page.tsx`.
3. Revert `services/api/index.ts` via `git checkout -- services/api/index.ts`.
4. Revert `functions/src/inventory/validateDeliveryZone.ts` via `git checkout -- functions/src/inventory/validateDeliveryZone.ts`.
5. Remove `test/checkout-c76d-legacy-ui-cleanup.test.ts`.

---

## 19. Final Gate

### 🟢 GREEN — C.7.6-D complete and safe to proceed to final authority scan

*(Note: The inherited C.7.6-C infrastructure risk regarding in-memory nonce tracking in multi-worker PM2 remains documented and will be addressed during post-C.7 infrastructure hardening).*

**STOP CONDITION MET:** Execution is paused awaiting user review. Do not proceed to any subsequent phase.
