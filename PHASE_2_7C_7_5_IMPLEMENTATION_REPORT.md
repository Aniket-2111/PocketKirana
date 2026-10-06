# Phase 2.7C.7.5 Implementation Report — Finding F-03: Customer App Address Setup Zone Validation

**Document ID:** `PHASE_2_7C_7_5_IMPLEMENTATION_REPORT.md`  
**Execution Phase:** Phase 2.7C.7.5 (Finding F-03 Remediation)  
**Execution Timestamp:** 2026-10-02T20:20:00+05:30  
**Target Finding:** F-03 (Customer App Address Setup Zone Validation)  
**Final Status:** **GREEN**  

---

## 1. Baseline Commit

* **Commit SHA:** `63dba5363579334b67e4ac9a401d94060be244bf`
* **Branch:** `main`
* **Zero Commits Executed:** Confirmed. All modifications exist strictly in the working tree.
* **Zero Deployments:** Confirmed. No deployment scripts, VPS operations, or container restarts were triggered.

---

## 2. Files Changed

| File | Change Description | Scope |
| :--- | :--- | :--- |
| `customer-app/app/setup-address/page.tsx` | Removed legacy `validateDeliveryZoneServerSide` import and invocation. Integrated canonical `GET /api/serviceability/check?lat=...&lng=...&storeId=store-001`. Preserved address-saving order before serviceability routing. Replaced hardcoded `"3 KM delivery radius in Neral"` with dynamic `maximumDistanceKm`. Preserved onboarding fail-open resilience in catch block. | **Target Remediation** |
| `lib/locationServices.ts` | Added `@deprecated NON-AUTHORITATIVE` JSDoc annotation above `validateDeliveryZoneServerSide`. | **Deprecation Annotation** |
| `lib/functionsClient.ts` | Added `@deprecated NON-AUTHORITATIVE` JSDoc annotation above `callValidateDeliveryZone`. | **Deprecation Annotation** |
| `test/checkout-f03-setup-address-canonical-serviceability.test.ts` | Comprehensive regression test suite covering all 15 invariants for F-03 and prior hardening phases. | **New Test Suite** |

---

## 3. Exact F-03 Remediation

Finding F-03 identified that during customer onboarding in `customer-app/app/setup-address/page.tsx`, the application invoked `validateDeliveryZoneServerSide()`, which bridged to the Firebase Cloud Function `validateDeliveryZone` backed by Firestore and offline fallbacks.

The remediation applied:
1. Removed `import { validateDeliveryZoneServerSide } from '@/lib/locationServices'`.
2. Replaced `validateDeliveryZoneServerSide(latitude, longitude)` inside `Promise.all` with a direct call to:
   ```ts
   /api/serviceability/check?lat=${latitude}&lng=${longitude}&storeId=store-001
   ```
3. Parsed the canonical response fields:
   * `isServiceable = Boolean(data?.serviceable)`
   * `distanceKm = typeof data?.distanceKm === 'number' ? data.distanceKm : (typeof data?.straightLineDistanceKm === 'number' ? data.straightLineDistanceKm : 0)`
   * `maximumDistanceKm = typeof data?.maximumDistanceKm === 'number' ? data.maximumDistanceKm : 3`
4. Replaced the hardcoded message:
   ```ts
   // Old:
   setStatusMessage('Location is outside our 3 KM delivery radius in Neral.');

   // New:
   const maxRadius = zoneResult.maximumDistanceKm || 3;
   setStatusMessage(`Location is outside our ${maxRadius} KM delivery radius.`);
   ```
5. Preserved routing destination:
   ```ts
   router.replace(`/not-serviceable?dist=${zoneResult.distanceKm}&lat=${latitude}&lon=${longitude}`);
   ```

---

## 4. Old Firebase Flow Removed

* **Firebase Cloud Function Removed from Flow:** `validateDeliveryZone` (invoked via `validateDeliveryZoneServerSide`) is no longer called during setup-address flow.
* **Active Production Callers:** `customer-app/app/setup-address/page.tsx` was the **sole** active production caller of `validateDeliveryZoneServerSide()`. The function now has **zero** active production callers across the entire repository.
* **Deprecation Notice Added:** `validateDeliveryZoneServerSide` in `lib/locationServices.ts` is explicitly marked `@deprecated NON-AUTHORITATIVE`.

---

## 5. Canonical API Integration

* **Endpoint:** `GET /api/serviceability/check`
* **Query Parameters:** `lat=${latitude}&lng=${longitude}&storeId=store-001`
* **Request Timeout:** 5000ms (`AbortSignal.timeout(5000)`)
* **Backend Authority:** Evaluated by `evaluateServerServiceability` against PostgreSQL `stores` operational settings (`delivery_radius_km`, operating hours, store status).
* **Distance Metric:** Canonical straight-line Haversine distance (`distanceKm` / `straightLineDistanceKm`).

---

## 6. Address-Save Behavior Verification

The address persistence ordering is strictly preserved:
```text
obtain coordinates
      ↓
query canonical serviceability + reverse geocoding in parallel
      ↓
saveOrUpdateAddress(latitude, longitude, geoDisplay)
      ↓
evaluate serviceability:
  - If !serviceable → set dynamic status message → redirect to /not-serviceable
  - If serviceable  → set verified status message → redirect to /home
```
**Key Invariant:** Address creation and updates are **never** dependent on serviceability. An out-of-zone customer address is persisted so that the user's location is saved across sessions.

---

## 7. Routing Behavior Verification

* **Serviceable Address:** Routes to `/home`.
* **Unserviceable Address:** Routes to `/not-serviceable?dist=${zoneResult.distanceKm}&lat=${latitude}&lon=${longitude}`.
* **Canonical Distance:** Passed straight from server response (`data.distanceKm ?? data.straightLineDistanceKm`). No client recalculation.

---

## 8. Error / Fail-Open Behavior

* If `/api/serviceability/check` throws a network or timeout error, execution falls into the existing `catch (err)` block:
  ```ts
  } catch (err) {
    console.error('Service check error:', err);
    // Save address and recheck
    await saveOrUpdateAddress(latitude, longitude, knownDisplay || 'Neral');
    router.replace('/home');
  }
  ```
* **Resilience Rationale:** Fail-open onboarding allows the customer to save their address and view the product catalog. Authoritative serviceability and operational gate enforcement are executed independently on every subsequent checkout attempt at `POST /api/checkout`.
* **Zero Client Heuristics:** No hardcoded store coordinates, road multipliers, or fallback radii are introduced in the error path.

---

## 9. Remaining Legacy Occurrences & Classifications

Post-implementation scans were executed across the codebase for the targeted terms:

| Keyword | Total Occurrences | Active Production Authority | Deprecated | Test / Mock | Documentation / Report |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `validateDeliveryZoneServerSide` | 27 | **0** | 1 (`lib/locationServices.ts:884`) | 4 (`test/checkout-f03...`) | 22 |
| `validateDeliveryZone` | 13 | **0** | 2 (`lib/functionsClient.ts:186`, `lib/locationServices.ts:908`) | 5 (`test/checkout-f03...`) | 6 (Functions backend files) |
| `callValidateDeliveryZone` | 4 | **0** | 1 (`lib/functionsClient.ts:152`) | 2 (`test/checkout-f03...`) | 1 |
| `4.5` (in `.ts`/`.tsx`) | 45 | **0** (in checkout/serviceability) | 2 (deprecated fallbacks) | 16 (tests/mocks) | 27 (UI ratings, margins, icon sizes) |
| `1.3` / `1.35` (in setup-address) | **0** | **0** | **0** | **0** | **0** |
| `3 KM` (in setup-address) | **0** | **0** | **0** | **0** | **0** |
| `deliveryRadiusKm` | 48 | 3 (`serverServiceability.ts`, PostgreSQL `stores`) | 4 (`locationServices.ts`, `functionsClient.ts`) | 10 | 31 (admin/types/schemas) |
| `minimumOrderValue` | 18 | 2 (`serverServiceability.ts`, `placeOrder.ts`) | 0 | 2 | 14 (admin/types/schemas) |

**Conclusion:** There is **zero active Customer App setup-address dependency on Firebase `validateDeliveryZone`**.

---

## 10. Tests and Results

### Focused Test Suite: `test/checkout-f03-setup-address-canonical-serviceability.test.ts`
* **Result:** **PASS (22/22 tests passed)**
* **Duration:** 57ms

### Full Hardening Regression Suites:
Command executed:
```bash
npx vitest run test/checkout-f03-setup-address-canonical-serviceability.test.ts \
               test/server-serviceability.test.ts \
               test/checkout-f01-customer-app-blocker-removal.test.ts \
               test/checkout-f02-web-checkout-road-multiplier-removal.test.ts \
               test/checkout-f04-location-picker-unblock.test.ts \
               test/checkout-f05-fallback-removal.test.ts
```
* **Result:** **6 passed files, 146 passed tests (100% green)**

### Complete Project Test Suite:
Command executed:
```bash
npm run test
```
* **Result:** **55 passed files, 779 passed tests (100% green)**
* **Exit Code:** `0`

---

## 11. TypeScript Results

### Standard Typecheck:
Command executed:
```bash
npm run typecheck
```
* **Output:** `tsc --noEmit` exited with code `0`. Zero type errors.

### Customer App Typecheck:
Command executed:
```bash
npx tsc --noEmit --project customer-app/tsconfig.json
```
* **Output:** Exited with code `0`. Zero type errors.

---

## 12. Production Build Result

Command executed:
```bash
npm run build
```
* **Output:** Next.js 15 production build compiled successfully.
* **Exit Code:** `0`
* **All Static & Dynamic Routes Generated:** Yes (including `/api/serviceability/check`, `/checkout`, `/setup-address`).

---

## 13. Database Safety

* **DDL Queries:** 0
* **DML Queries:** 0
* **Migrations Created:** 0
* **Schema Alterations:** 0
* **PostgreSQL Writes:** 0
* **Status:** Database was completely untouched during this phase.

---

## 14. Git Status

### Command: `git status --short`
```text
 M app/api/checkout/route.ts
 M app/api/checkout/validate-serviceability/route.ts
 M app/api/checkout/validate/route.ts
 M app/api/serviceability/check/route.ts
 M app/checkout/page.tsx
 M components/customer/LocationPickerModal.tsx
 M customer-app/app/checkout/page.tsx
 M customer-app/app/setup-address/page.tsx
 M lib/functionsClient.ts
 M lib/locationServices.ts
 M lib/serverServiceability.ts
 M test/server-serviceability.test.ts
?? PHASE_2_7C_5_BUSINESS_RULE_AUTHORITY_SCAN.md
?? PHASE_2_7C_6_REMEDIATION_DESIGN.md
?? PHASE_2_7C_7_1_IMPLEMENTATION_REPORT.md
?? PHASE_2_7C_7_2_IMPLEMENTATION_REPORT.md
?? PHASE_2_7C_7_3_IMPLEMENTATION_REPORT.md
?? PHASE_2_7C_7_4_IMPLEMENTATION_REPORT.md
?? PHASE_2_7C_7_5_FORENSIC_AUDIT.md
?? PHASE_2_7C_7_5_IMPLEMENTATION_REPORT.md
?? PHASE_2_7C_CHECKPOINT_C7_2_C7_3.md
... (reports and test files)
?? test/checkout-f01-customer-app-blocker-removal.test.ts
?? test/checkout-f02-web-checkout-road-multiplier-removal.test.ts
?? test/checkout-f03-setup-address-canonical-serviceability.test.ts
?? test/checkout-f04-location-picker-unblock.test.ts
?? test/checkout-f05-fallback-removal.test.ts
```

---

## 15. Commit / Deployment Status

* **Git Commit:** NONE (0 commits made).
* **Git Push:** NONE.
* **Production Deployment:** NONE.
* **VPS Configuration:** UNTOUCHED.

---

## 16. Final Status

**FINAL STATUS: GREEN**

All requirements for **Finding F-03** have been implemented, tested, and validated. The Customer App address setup flow is fully aligned with the canonical serviceability authority.

Implementation is complete. Standing by for review before any subsequent phase.
