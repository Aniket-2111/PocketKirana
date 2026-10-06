# Phase 2.7C.7.1 — Implementation Report: Removal of Cloud Function Order Fallback

**Document ID:** `PHASE_2_7C_7_1_IMPLEMENTATION_REPORT.md`  
**Phase:** 2.7C.7.1 (Controlled Implementation — Finding F-05 Only)  
**Execution Timestamp:** 2026-10-02T17:38:00+05:30  
**Repository:** `PocketKirana`  
**Base Commit:** `63dba5363579334b67e4ac9a401d94060be244bf`  

---

## 1. Scope

Phase 2.7C.7.1 executed the controlled implementation of **Finding F-05 ONLY** from the Phase 2.7C.6 remediation design:
- Removed the active fallback invocation of `callPlaceOrder` (`functions/src/orders/placeOrder.ts`) in the web checkout handler (`app/checkout/page.tsx`).
- Removed the unused import `import { callPlaceOrder } from '@/lib/functionsClient'`.
- Implemented canonical API error handling for `POST /api/checkout` rejection (e.g. out of stock, unserviceable location, closed store) and network failure without falling back to Firebase/Firestore.
- Added comprehensive Vitest tests verifying the complete elimination of the Cloud Function fallback path and preservation of `x-idempotency-key` semantics.

---

## 2. Files Changed

1. **`app/checkout/page.tsx`**:
   - Removed line 16: `import { callPlaceOrder } from '@/lib/functionsClient';`
   - Replaced lines 254–281:
     - Successfully processed `/api/checkout` responses (`checkoutRes.ok && checkoutData.success`) assign `result`.
     - Rejected `/api/checkout` responses extract `checkoutData?.error`, clear frozen snapshots, surface the authoritative error via toast, re-enable the button (`isProcessing: false`), and return immediately.
     - Caught network/request errors log to console, clear frozen snapshots, surface a retryable network error toast, re-enable the button, and return immediately.
     - **Completely deleted** lines 268–280 (`callPlaceOrder` invocation).
2. **`test/checkout-f05-fallback-removal.test.ts`** (New Test Suite):
   - Added 9 automated tests verifying static invariants, API success, business error 400 rejection, network failure recovery, idempotency key preservation, and repository-wide caller absence.

---

## 3. Files Not Changed

As strictly required by the Phase 2.7C.7.1 constraints, the following subsystems were **100% UNTOUCHED**:
- **Database Schema & Data:** 0 DDL, 0 DML, 0 queries executed against production tables.
- **Database Migrations:** 0 migrations created or run.
- **Firebase Authentication:** Auth token verification and sessions untouched.
- **Firebase Cloud Messaging (FCM):** Push notification channels untouched.
- **PhonePe / Payment Logic:** Payment redirection, webhooks, and status polling untouched.
- **Inventory / FEFO Logic:** PostgreSQL inventory reservations, batches, and triggers untouched.
- **Transactional Outbox:** Outbox table, leasing, and worker loop untouched.
- **PostgreSQL Roles, Ownership, Credentials:** Database infrastructure untouched.
- **Delivery Partner / Picker Logic:** Task queues and assignment untouched.
- **Cloud Function Business Logic (`placeOrder.ts`):** Preserved untouched in `functions/` (deprecation marking reserved for C.7.6).
- **Mobile Architecture (`customer-app/`):** Untouched in this step (reserved for C.7.2 & C.7.4).
- **Cloudflare / R2:** Untouched.

---

## 4. F-05 Verification

Prior to this change, if `POST /api/checkout` rejected an order (e.g., status 400 for out-of-stock items or unserviceable distance) or suffered a temporary network failure, `app/checkout/page.tsx` fell back to `callPlaceOrder`, creating an order in Firestore with conflicting business rules (`minimumOrderValue: 99`, legacy delivery fees).

Following this change:
- `POST /api/checkout` is the **ONLY** order-creation path invoked by the web checkout handler.
- If `POST /api/checkout` rejects an order, the error message is displayed to the user via `showToast(errorMsg, 'error')`, the frozen snapshot is cleared, and `isProcessing` is reset to `false`.
- If a network error occurs, the user receives `"Network error while placing order. Please check your connection and try again."` and can click "Place Order" to retry against `POST /api/checkout` using the existing idempotency mechanism.
- Zero fallback to Firebase Cloud Functions occurs under any condition.

---

## 5. Repository-Wide `callPlaceOrder` & `placeOrder` Search

A complete repository scan for `callPlaceOrder` and `placeOrder` yields:

### `callPlaceOrder` References
| File | Context | Classification |
| :--- | :--- | :--- |
| `app/checkout/page.tsx` | None (removed) | **ELIMINATED** |
| `customer-app/app/checkout/page.tsx` | None | **SAFE (NEVER PRESENT)** |
| `lib/functionsClient.ts:89,99,105,114,117,397` | Unreferenced function definition | **DEPRECATED CANDIDATE** (zero active callers) |
| `test/checkout-f05-fallback-removal.test.ts` | Automated assertions verifying 0 callers | **TEST / FIXTURE** |
| Historical documentation (`.md`) | Audit and design records | **DOCUMENTATION** |

### `placeOrder` References
| Identifier / Context | File(s) | Classification |
| :--- | :--- | :--- |
| `functions/src/orders/placeOrder.ts` | Cloud Functions order handler | **DEPRECATED CANDIDATE** (zero active web callers; C.7.6 will mark `@deprecated`) |
| `store.placeOrder(...)` | `lib/store.ts:307,1756` | **LOCAL STATE MUTATION** (records completed order into Zustand store) |
| `store.placeOrder` calls | `customer-app/app/checkout/page.tsx:239`, `app/checkout/page.tsx:299,330` | **LOCAL STATE SNAPSHOT** (called only after canonical order creation succeeds) |
| `checkoutApi.placeOrder` | `services/api/index.ts:149` | **UNREFERENCED SDK STUB** (zero callers across codebase) |

---

## 6. Test & Quality Verification

### 1. Focused F-05 Test Suite (`test/checkout-f05-fallback-removal.test.ts`)
```text
✓ test/checkout-f05-fallback-removal.test.ts (9 tests)
  ✓ Invariant 1: app/checkout/page.tsx does NOT import callPlaceOrder
  ✓ Invariant 2: app/checkout/page.tsx does NOT invoke callPlaceOrder anywhere in handlePlaceOrder
  ✓ Invariant 3: app/checkout/page.tsx does NOT import placeOrder from Firebase Cloud Functions
  ✓ Invariant 4: POST /api/checkout is the single order submission endpoint in app/checkout/page.tsx
  ✓ Test 1 — API success: processes order via /api/checkout and does NOT trigger any Cloud Function fallback
  ✓ Test 2 — API business rejection: returns error toast, does NOT call callPlaceOrder, and returns to retryable state
  ✓ Test 3 — API/network failure: surfaces retryable error, re-enables checkout button, and executes zero Firebase fallback
  ✓ Test 4 — Idempotency preservation: x-idempotency-key header is passed in request to POST /api/checkout
  ✓ Test 5 — Repository-Wide Active Caller Scan: zero active callers of callPlaceOrder
```
*Result:* **9 passed (9 total)**

### 2. Canonical Server Serviceability Suite (`test/server-serviceability.test.ts`)
```text
✓ test/server-serviceability.test.ts (76 tests)
```
*Result:* **76 passed (76 total)**

### 3. Full Repository Test Suite (`vitest run`)
```text
Test Files  51 passed (51)
     Tests  718 passed (718)
  Duration  17.88s
```
*Result:* **All 51 test suites and 718 unit/integration tests passed with 0 failures.**

### 4. TypeScript Strict Check (`npm run typecheck`)
```text
> pocketkirana@1.0.0 typecheck
> tsc --noEmit
```
*Result:* **Exit code 0. Zero TypeScript compile errors.**

### 5. Production Next.js Build (`npm run build`)
```text
✓ Compiled successfully in 18.2s
Linting and checking validity of types ...
Generating static pages (133/133) ...
Finalizing page optimization ...
```
*Result:* **Exit code 0. Full production bundle generated successfully.**

---

## 7. Security Result

- **No Alternate Order Writer:** There is no longer any condition under which `app/checkout/page.tsx` can divert order creation to Firebase or Firestore.
- **Client Cannot Force Fallback:** No environment variables, query parameters, or client headers can trigger Cloud Function order creation.
- **PostgreSQL Primacy Preserved:** All web checkout orders must acquire serialized stock reservations in PostgreSQL through `POST /api/checkout`.
- **Payment & Inventory Unchanged:** PhonePe flow, COD flow, FEFO reservations, and outbox event dispatch remain strictly under canonical control.

---

## 8. Git Safety Verification

- **Base Commit:** `63dba5363579334b67e4ac9a401d94060be244bf`
- **Ending Commit:** `63dba5363579334b67e4ac9a401d94060be244bf` (HEAD unchanged)
- **Commits Created:** **NO (0 commits)**
- **Deployments Triggered:** **NO (0 deployments)**
- **Git Diff Summary:**
  ```text
  app/checkout/page.tsx | 30 ++++++++++--------------------
  1 file changed, 10 insertions(+), 20 deletions(-)
  ```

---

## 9. Final Gate Assessment

# **GREEN**

**Assessment Rationale:**  
Finding F-05 has been surgically and safely remediated. `callPlaceOrder` is completely removed from the web checkout path, error and network failure handling are robust, zero TypeScript errors exist, all 718 tests in the repository pass, and the production build completes cleanly.

**Ready to proceed to Phase 2.7C.7.2 (Finding F-01: Remove Hardcoded 4.5 km Blocker in Customer App).**
