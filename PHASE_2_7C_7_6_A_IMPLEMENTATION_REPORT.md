# PocketKirana — Phase 2.7C.7.6-A Implementation Report

**Document ID:** `PHASE_2_7C_7_6_A_IMPLEMENTATION_REPORT.md`  
**Phase:** Phase 2.7C.7.6-A: Legacy Firebase `placeOrder` Authority Decommission  
**Timestamp:** 2026-10-04T05:46:00+05:30  
**Repository:** `PocketKirana`  
**Base Commit / HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`  
**Gate Status:** 🟢 GREEN — implementation complete and validated

---

## 1. Executive Summary

Phase 2.7C.7.6-A successfully decommissions the legacy Firebase Cloud Function `placeOrder` order-creation authority, eliminating the remaining architectural vulnerability where a Firebase callable could create shadow/duplicate orders in Firestore using legacy business rules.

Key changes implemented:
1. **Server-Side Rejection Guard in `functions/src/orders/placeOrder.ts`:**
   The `placeOrder` Firebase `onCall` function has been transformed into a server-side decommission guard that unconditionally throws a Firebase callable error (`HttpsError('failed-precondition', ...)`). The function terminates immediately, with zero execution of Firestore order creation, reservation creation, inventory mutations, status mutations, pricing calculations, minimum-order checks, delivery-fee logic, or store configuration lookups. The callable signature is preserved to maintain deployment packaging integrity.
2. **Client Wrapper Deprecation in `lib/functionsClient.ts`:**
   The `callPlaceOrder` client wrapper function has been documented and marked with `@deprecated NON-AUTHORITATIVE / DECOMMISSIONED`, referencing canonical `POST /api/checkout` as the sole authority.
3. **Dedicated Test Suite in `test/checkout-c76a-place-order-decommission.test.ts`:**
   Added 12 rigorous tests verifying zero production callers, runtime rejection with `failed-precondition`, static proof of zero order/reservation writes and zero pricing logic, and proof that canonical `POST /api/checkout` remains the active order creation authority.

---

## 2. Baseline

* **Starting Commit:** `63dba5363579334b67e4ac9a401d94060be244bf`
* **Current HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`
* **Verification:** Confirmed via `git rev-parse HEAD`.

---

## 3. Caller Audit

A comprehensive search of the repository for `placeOrder`, `callPlaceOrder`, and Firebase callable references was conducted:

| Query / Target | Location Found | Active Production Caller? | Status / Evidence |
| :--- | :--- | :--- | :--- |
| `callPlaceOrder` | `lib/functionsClient.ts` | **NO** | Zero production callers across web checkout (`app/checkout/page.tsx`) and customer app checkout (`customer-app/app/checkout/page.tsx`). |
| `placeOrder` (callable) | `functions/src/orders/placeOrder.ts` | **NO** | Firebase function definition only. |
| `placeOrder` (callable) | `functions/src/index.ts` | **NO** | Export registration only (`export { placeOrder } from './orders/placeOrder'`). |
| `placeOrder` (client store) | `lib/store.ts` | **NO (Not a callable)** | Zustand client state updater invoked *after* successful `fetch('/api/checkout')`. Does not create orders. |
| Web Checkout Order Path | `app/checkout/page.tsx` | N/A | Exclusively invokes `fetch('/api/checkout', { method: 'POST', ... })`. |
| Customer App Order Path | `customer-app/app/checkout/page.tsx` | N/A | Exclusively invokes `fetch('/api/checkout', { method: 'POST', ... })`. |

**Conclusion:** Zero active production callers invoke the legacy Firebase `placeOrder` callable. Canonical `POST /api/checkout` is the sole active order-creation authority.

---

## 4. Files Changed

### A. Modified Production Files

1. [functions/src/orders/placeOrder.ts](file:///d:/pocketkirana/functions/src/orders/placeOrder.ts)
   * **Why changed:** Converted the legacy Cloud Function into an immediate server-side rejection guard. Removed all legacy Firestore order creation, reservation creation, pricing rules, and hardcoded values.
   * **Implementation:** The callable handler immediately throws `new HttpsError('failed-precondition', 'The legacy placeOrder Cloud Function has been decommissioned. Orders must be placed via the canonical PostgreSQL API: POST /api/checkout.')`.
2. [functions/lib/orders/placeOrder.js](file:///d:/pocketkirana/functions/lib/orders/placeOrder.js) & [functions/lib/orders/placeOrder.js.map](file:///d:/pocketkirana/functions/lib/orders/placeOrder.js.map)
   * **Why changed:** Compiled output of `functions/src/orders/placeOrder.ts` produced by `npm run --prefix functions build`.
3. [lib/functionsClient.ts](file:///d:/pocketkirana/lib/functionsClient.ts)
   * **Why changed:** Annotated `callPlaceOrder` with JSDoc `@deprecated NON-AUTHORITATIVE / DECOMMISSIONED` warning developers and tooling that order creation must use canonical `POST /api/checkout`. Preserved interface to avoid breaking any legacy test or development tooling.

### B. New Test Files

4. [test/checkout-c76a-place-order-decommission.test.ts](file:///d:/pocketkirana/test/checkout-c76a-place-order-decommission.test.ts)
   * **Why added:** Dedicated test suite validating all requirements of Phase 2.7C.7.6-A.

---

## 5. Legacy Function Behavior: Before vs After

| Property / Action | BEFORE Phase 2.7C.7.6-A | AFTER Phase 2.7C.7.6-A |
| :--- | :--- | :--- |
| **Callable Execution Result** | Allowed creating orders in Firestore | Throws `HttpsError('failed-precondition')` unconditionally |
| **Firestore Order Creation** | `db.collection('orders').doc(orderId).set(...)` executed | **ELIMINATED** — Zero executable paths to write Firestore orders |
| **Reservation Creation** | Reserved inventory in Firestore `reservations` collection | **ELIMINATED** — Zero executable paths to create reservations |
| **Inventory Mutation** | Mutated stock counts in Firestore `inventory` collection | **ELIMINATED** — Zero executable paths to mutate inventory |
| **Minimum Order Validation** | Applied hardcoded `minOrderAmount` rule (`99` / `settings/store`) | **ELIMINATED** — Zero executable paths to evaluate minimum order |
| **Delivery Fee Calculation** | Applied hardcoded fee `25` / free delivery threshold `299` | **ELIMINATED** — Zero executable paths to calculate delivery fee |
| **Store Settings Lookup** | Read `settings/store` from Firestore | **ELIMINATED** — Zero executable paths to read store settings |
| **Exported Signature** | `onCall({ region: 'asia-south1', cors: true }, ...)` | **PRESERVED** — Safe for Cloud Functions packaging and deployment |

---

## 6. Test and Build Verification

### A. Phase 2.7C.7.6-A Dedicated Tests
Command: `npx vitest run test/checkout-c76a-place-order-decommission.test.ts`
* **Result:** **12 passed / 12 tests (100% pass)**
* **Coverage:**
  1. No active production checkout callers in `app/checkout/page.tsx`
  2. No active production checkout callers in `customer-app/app/checkout/page.tsx`
  3. `lib/functionsClient.ts:callPlaceOrder` is marked `@deprecated`
  4. Runtime invocation of `placeOrder` callable handler throws `failed-precondition`
  5. Error message explicitly directs caller to `POST /api/checkout`
  6. Source file contains no Firestore `orders` collection write
  7. Compiled output contains no Firestore `orders` collection write
  8. Source file contains no `reservations` collection write
  9. Compiled output contains no `reservations` collection write
  10. Source file contains no legacy pricing logic or store configuration lookups
  11. Compiled output contains no legacy pricing logic
  12. `POST /api/checkout` exists, is exported, and remains the sole transactional order authority

### B. Checkout and Serviceability Regression Suite
Command: `npx vitest run test/checkout-c76a-place-order-decommission.test.ts test/checkout-f05-fallback-removal.test.ts test/checkout-f01-customer-app-blocker-removal.test.ts test/checkout-f02-web-checkout-road-multiplier-removal.test.ts test/checkout-f03-setup-address-canonical-serviceability.test.ts test/checkout-f04-location-picker-unblock.test.ts test/server-serviceability.test.ts`
* **Result:** **7 test files passed, 158 passed / 158 tests (100% pass)**

### C. Full Repository Test Suite
Command: `npm run test`
* **Result:** **56 test files passed, 791 passed / 791 tests (100% pass)**

### D. TypeScript Validation
* `npm run --prefix functions build` (`tsc`): **0 errors (Exit code 0)**
* `npx tsc --noEmit --project customer-app/tsconfig.json`: **0 errors (Exit code 0)**
* `npx tsc --noEmit --project functions/tsconfig.json`: **0 errors (Exit code 0)**
* Root `npm run typecheck` (`tsc --noEmit`): Reports only the pre-existing, unrelated uninstalled `@copilotkit` package types in `app/api/copilotkit/` and `app/assistant/` (identical to baseline across all Phase 2.7C checkpoints). Zero errors in modified files.

### E. Production Build Validation
* `npm run --prefix customer-app build`: **PASS (Compiled successfully in 17.2s, 199 static/SSG pages generated cleanly)**
* `npm run --prefix functions build`: **PASS (Compiled successfully in 4.1s)**

---

## 7. Database Safety

* **PostgreSQL DDL executed:** 0
* **PostgreSQL DML executed:** 0
* **Migrations executed:** 0
* **Schema changes:** 0
* **Stores / Orders / Inventory / Roles modified:** 0

Database changes remain **exactly zero**.

---

## 8. Deployment Status and Distinction

* **Deployment Performed:** **NONE**
* **Deployment Distinction:**
  * The repository code (`functions/src/orders/placeOrder.ts` and `functions/lib/orders/placeOrder.js`) now rejects the legacy callable with `failed-precondition`.
  * The deployed Firebase runtime in Google Cloud Functions will remain unchanged until this function is explicitly deployed during an authorized release step.
  * Therefore, live production runtime protection is **NOT** to be claimed until a later authorized deployment/verification step.

---

## 9. Scope Protection Confirmation

The following systems and modules were **strictly preserved and NOT modified**:
* [x] `POST /api/checkout`
* [x] `GET /api/serviceability/check`
* [x] `evaluateServerServiceability`
* [x] PhonePe payment integration & webhooks
* [x] PostgreSQL schema, roles, and migrations
* [x] Inventory & FEFO reservation engine
* [x] Transactional Outbox pattern & workers
* [x] Firebase Auth & Firebase Cloud Messaging (FCM)
* [x] Cloudflare DNS / R2 storage
* [x] VPS / PM2 infrastructure
* [x] `LocationPermissionGuard` & `/not-serviceable`
* [x] Admin service-area configuration
* [x] Native mobile architecture

---

## 10. Final Gate

**Status:** 🟢 **GREEN — implementation complete and validated**

Phase 2.7C.7.6-A is complete. The legacy Firebase `placeOrder` authority has been cleanly decommissioned in the codebase, with 100% test coverage and full regression validation.

**STOP CONDITION:** Execution halts here. Awaiting explicit user review before any subsequent phases (C.7.6-B, C.7.6-C, C.7.6-D).
