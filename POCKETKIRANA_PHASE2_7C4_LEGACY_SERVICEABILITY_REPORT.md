# PocketKirana — Phase 2.7C.4 Report
## Legacy Checkout Serviceability Endpoint Audit & Canonicalization

---

## A. Execution Status

* **Start Timestamp:** 2026-10-02T17:04:36+05:30
* **End Timestamp:** 2026-10-02T17:12:00+05:30
* **Branch:** `fix/page-readiness-production`
* **Base Commit:** `63dba53`
* **Files Changed:**
  1. `app/api/checkout/validate/route.ts` — Added JSDoc `@deprecated` marker; documented as Option B (Unused / Deprecation Candidate).
  2. `app/api/checkout/validate-serviceability/route.ts` — Added JSDoc `@deprecated` marker; documented as Option B (Unused / Deprecation Candidate).
* **DB Changed:** NO (0 DDL, 0 DML, 0 schema mutations)
* **Migrations Created/Executed:** NO (Migration 003 does not exist)
* **Git Commits Created:** NO (0 commits)
* **Deployment Triggered:** NO (0 deployments)

---

## B. Endpoint Usage Audit

A comprehensive repository-wide forensic audit was conducted across all customer web code, customer mobile code, delivery app, picker app, checkout/cart components, location/serviceability UI, shared API clients, hooks, stores, and tests.

### 1. `POST /api/checkout/validate` ([`app/api/checkout/validate/route.ts`](file:///d:/pocketkirana/app/api/checkout/validate/route.ts))

* **Production Callers:** **NONE (0 callers).**
  * Web checkout ([`app/checkout/page.tsx`](file:///d:/pocketkirana/app/checkout/page.tsx)) does NOT call `/api/checkout/validate`. It performs preflight validation directly against `POST /api/checkout`.
  * Customer mobile app ([`customer-app/app/checkout/page.tsx`](file:///d:/pocketkirana/customer-app/app/checkout/page.tsx)) does NOT call `/api/checkout/validate`. It posts directly to `POST /api/checkout`.
  * Delivery and picker apps have no checkout or cart validation flows.
  * Cloud Functions do not call this endpoint.
* **Test Callers:** **NONE (0 callers).** No test in `test/**` imports or invokes this route.
* **Mock Callers:** **NONE (0 callers).**
* **Documentation References:** Listed in `docs/phase-17-routes.json` and `docs/PHASE_17_ROUTE_MATRIX.md` as a legacy Phase 17 customer route; referenced in historical audit documents (`POCKETKIRANA_PHASE1A_SERVICEABILITY_AUDIT.md`, `POCKETKIRANA_PHASE2_7A_BACKEND_ALIGNMENT_AUDIT.md`, `POCKETKIRANA_PHASE2_7B_IMPLEMENTATION_DESIGN.md`).
* **Unused Status:** **PROVEN UNUSED / DEPRECATION CANDIDATE (Option B).**
* **Request Contract:**
  * Method: `POST`
  * Body: `{ address?: { latitude?: number; longitude?: number }; latitude?: number; longitude?: number; storeId?: string; cartTotal?: number }`
* **Response Contract:**
  * Success (200): `{ success: true, isServiceable: boolean, isTenMinuteEligible: boolean, distanceKm: number, radiusKm: number, storeId: string, storeName: string, estimatedDeliveryMins: number, deliveryFee: number }`
  * Failure (400): `{ success: false, isServiceable: false, error: string, distanceKm?: number, radiusKm?: number, storeName?: string }`

### 2. `POST /api/checkout/validate-serviceability` ([`app/api/checkout/validate-serviceability/route.ts`](file:///d:/pocketkirana/app/api/checkout/validate-serviceability/route.ts))

* **Production Callers:** **NONE (0 callers).**
  * Audited all mobile APK sources (`customer-app/**`, `delivery-app/**`, `picker-app/**`). No component, hook, or screen references `validate-serviceability`.
  * Audited web application (`app/**`, `components/**`). No component references `validate-serviceability`.
* **Test Callers:** **NONE (0 callers).** No test in `test/**` imports or invokes this route.
* **Mock Callers:** **NONE (0 callers).**
* **Documentation References:** Listed in `docs/phase-17-routes.json` and `docs/PHASE_17_ROUTE_MATRIX.md` as "Legacy mobile pre-check"; analyzed in Phase 1A, 2.7A, and 2.7B audits.
* **Unused Status:** **PROVEN UNUSED / DEPRECATION CANDIDATE (Option B).**
* **Request Contract:**
  * Method: `POST`
  * Body: `{ latitude?: number; longitude?: number; address?: { latitude?: number; longitude?: number }; cartTotal?: number }`
* **Response Contract (`ServiceabilityResponse`):**
  * Success (200): `{ success: true, isServiceable: boolean, isTenMinuteEligible: boolean, zoneId: string, zoneName: string, storeId: string, storeName: string, distanceKm: number, roadDistanceKm: number, estimatedDeliveryMinutes: number, deliveryFee: number, radiusKm: number, message: string }`
  * Failure (400/500): `{ success: false, isServiceable: false, error: string }`

---

## C. Legacy Rule Audit

Forensic inspection of both legacy route files identified the following competing rules:

| Route | Code Location | Competing Rule | Nature of Conflict with Phase 2 Canonical Architecture | Audit Disposition |
| :--- | :--- | :--- | :--- | :--- |
| `validate/route.ts` | Lines 20–25 | Firestore `fetchShopsFS()` & in-memory `getStores()` | Bypasses PostgreSQL `stores` authority; split-brain store config | **Proven unreachable by active production code** (Option B) |
| `validate/route.ts` | Lines 28–35 | Hardcoded fallback store: `id: 'store-1'`, lat `19.033`, lng `73.317`, radius `5.0 KM` | Conflicts with PostgreSQL Neral store (19.0224536, 73.3210018, 3.0 KM) | **Proven unreachable by active production code** (Option B) |
| `validate/route.ts` | Line 45 | Universal ₹29 delivery fee & ₹499 free delivery threshold | Violates store-specific delivery fee and threshold configuration | **Proven unreachable by active production code** (Option B) |
| `validate/route.ts` | Line 45 | `distKm <= 1.0 -> deliveryFee = 0` | Competing, non-canonical 1 km free delivery rule | **Proven unreachable by active production code** (Option B) |
| `validate/route.ts` | Lines 41–44 | Arbitrary 10-minute delivery estimation heuristic | Not part of canonical evaluator | **Proven unreachable by active production code** (Option B) |
| `validate-serviceability/route.ts` | Lines 42–47 | Firestore `fetchShopsFS()` & in-memory `getStores()` | Bypasses PostgreSQL `stores` authority | **Proven unreachable by active production code** (Option B) |
| `validate-serviceability/route.ts` | Lines 66–73 | Hardcoded fallback store: `id: 'store-1'`, lat `19.0224536`, lng `73.3210018`, radius `4.5 KM` | Conflicts with PostgreSQL 3.0 KM radius | **Proven unreachable by active production code** (Option B) |
| `validate-serviceability/route.ts` | Line 77 | `roadDistanceKm = Math.round(distanceKm * 1.35 * 10) / 10` | Uses deprecated 1.35x road-distance multiplier decommissioned in Phase 2.7C.1 | **Proven unreachable by active production code** (Option B) |
| `validate-serviceability/route.ts` | Line 88 | Hardcoded ₹15 delivery fee | Universal ₹15 fee conflicts with PostgreSQL store `delivery_fee` (₹29.00) | **Proven unreachable by active production code** (Option B) |
| `validate-serviceability/route.ts` | Line 92 | Hardcoded rejection message: *"delivers within 3 KM"* | User-facing string ignores dynamic store radius (4 or 5 km) | **Proven unreachable by active production code** (Option B) |

---

## D. Canonical Architecture & Canonicalization Strategy

Under Step 3 criteria:
* **Option A (Canonical Adapter):** Reserved for endpoints still actively called by production code.
* **Option B (Unused / Deprecation Candidate):** Applies when repository-wide inspection proves zero production callers. Instructs: *"leave it unchanged unless a safe minimal deprecation marker is clearly appropriate. Do not break historical compatibility without evidence."*

### Strategy Selection:
Both `app/api/checkout/validate/route.ts` and `app/api/checkout/validate-serviceability/route.ts` are classified as **OPTION B — UNUSED / DEPRECATION CANDIDATE**.

* Safe JSDoc `@deprecated` annotations have been affixed to both route handlers.
* Neither endpoint is referenced by any active customer or internal surface.
* The authoritative public serviceability endpoint remains **`GET/POST /api/serviceability/check`** (delegating to `evaluateServerServiceability`), canonicalized in Phase 2.7C.2.
* The authoritative final order-creation gate remains **`POST /api/checkout`** (delegating to `evaluateServerServiceability` and `resolveDeliveryFee`), canonicalized in Phase 2.7C.3.
* If legacy mobile client compatibility ever requires runtime redirection in a future phase, a drop-in adapter wrapping `evaluateServerServiceability` can be introduced without disrupting existing contracts.

---

## E. Security Verification

Because production checkout order creation strictly routes through `POST /api/checkout`:
1. **Zero Gate Bypass:** An attacker attempting to call `/api/checkout/validate` or `/api/checkout/validate-serviceability` cannot create orders, reserve stock, or acquire transaction locks. The final order-creation path in `app/api/checkout/route.ts` independently runs `evaluateServerServiceability` and ignores any client-supplied distance, radius, or fee claims.
2. **Canonical Serviceability Integrity:** Production customer flows query `/api/serviceability/check`, where all store parameters, operating hours, delivery fees, and radius boundaries are verified against PostgreSQL.

---

## F. Tests & Regression Results

### 1. Focused Server Serviceability Test Suite (76/76 Tests Passed)
Command:
```bash
npx vitest run test/server-serviceability.test.ts
```
Output:
```text
 ✓ test/server-serviceability.test.ts (76 tests) 341ms

 Test Files  1 passed (1)
      Tests  76 passed (76)
   Start at  17:07:51
   Duration  6.02s
```

### 2. Full Regression Test Suite (709/709 Tests Passed across 50 Test Files)
Command:
```bash
npx vitest run
```
Output:
```text
 Test Files  50 passed (50)
      Tests  709 passed (709)
   Start at  17:08:14
   Duration  20.07s
```

### 3. TypeScript Static Analysis (0 Errors)
Command:
```bash
npx tsc --noEmit
```
Output:
```text
Exit code: 0 (Zero errors)
```

### 4. Production Build (Passed)
Command:
```bash
npm run build
```
Output:
```text
Exit code: 0
✓ Compiled successfully
```

---

## G. Scope Safety Confirmation

* **Database Schema Changes:** NONE (0 DDL, 0 DML).
* **Database Migrations:** NONE (Migration 003 not created).
* **Payment Architecture:** UNTOUCHED (PhonePe webhook, configuration, and checksum untouched).
* **Inventory / FEFO Engine:** UNTOUCHED (Reservation and locking logic preserved as-is).
* **Transactional Outbox Engine:** UNTOUCHED (`appendOutboxEvent` and outbox schema preserved).
* **Firebase / Firestore Configuration:** UNTOUCHED.
* **Cloud Functions:** UNTOUCHED.
* **Mobile / Frontend Code:** UNTOUCHED.
* **Cloudflare / R2:** UNTOUCHED.

---

## H. Final Gate

**READY FOR PHASE 2.7C.5**
