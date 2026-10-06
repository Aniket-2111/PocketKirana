# Phase 2.7C — Final Business Authority Scan Forensic Report

**Document ID:** `PHASE_2_7C_FINAL_BUSINESS_AUTHORITY_SCAN.md`  
**Phase:** Phase 2.7C (Final Business Authority Scan)  
**Execution Timestamp:** 2026-10-04T07:10:00+05:30  
**Repository:** `PocketKirana`  
**Execution Mode:** STRICT READ-ONLY FORENSIC AUDIT (Zero code changes, zero database mutations, zero migrations, zero deployments, zero commits)  
**Baseline Commit / HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`  

---

## 1. Executive Summary

This forensic audit represents the definitive repository-wide verification of business authority following the completion of:
- **Phase 2.7C.7.6-A:** Legacy Firebase `placeOrder` authority decommissioned.
- **Phase 2.7C.7.6-B:** `LocationPermissionGuard` and `locationFlowService` aligned with canonical serviceability.
- **Phase 2.7C.7.6-C:** Admin Store Operations and Service Area UI aligned with PostgreSQL and protected with server-side authorization.
- **Phase 2.7C.7.6-D:** Remaining legacy UI cleanup, `/not-serviceable` parameterization, dead checkout SDK stub removal, and legacy Firebase serviceability callable deprecation.

### Core Architecture Confirmed:
```
Customer Web / Customer Mobile
        ↓
GET /api/serviceability/check
        ↓
POST /api/checkout
        ↓
evaluateServerServiceability()
        ↓
PostgreSQL stores
        ↓
PostgreSQL order/inventory transaction (ACID)
```

**PostgreSQL store configuration and server-side evaluation are the sole authoritative business-rule path for customer serviceability and checkout.**

Zero active competing authority remains across the entire repository. All legacy mechanisms have been cleanly classified as deprecated, transitional mirrors, test/mock, documentation, navigation helpers, or legal disclosures.

---

## 2. Architecture Authority Verification

| Architectural Domain | Authoritative Implementation | Client Override Possible? | Competing Authority? |
|---|---|:---:|:---:|
| **Public Serviceability API** | `GET /api/serviceability/check` (`app/api/serviceability/check/route.ts`) | ❌ NO | None |
| **Order Creation Gate** | `POST /api/checkout` (`app/api/checkout/route.ts`) | ❌ NO | None |
| **Serviceability Evaluator** | `evaluateServerServiceability()` (`lib/serverServiceability.ts`) | ❌ NO | None |
| **Delivery Fee Calculator** | `resolveDeliveryFee()` (`lib/serverServiceability.ts`) | ❌ NO | None |
| **Persistence Layer** | PostgreSQL database tables: `stores`, `orders`, `order_items`, `inventory`, `inventory_balances`, `outbox_events`, `audit_logs` | ❌ NO | None |

---

## 3. Service Radius Authority

- **Canonical Authority:** PostgreSQL `stores.delivery_radius_km` evaluated dynamically by `evaluateServerServiceability()` via straight-line Haversine distance formula.
- **Active Callers:**
  - `GET /api/serviceability/check` (customer location checks)
  - `POST /api/checkout` (pre-flight order transaction gate)
  - `LocationPermissionGuard` / `locationFlowService` (advisory UI guidance)
- **Legacy Callers:** 
  - `checkZoneServiceability` in `lib/locationServices.ts` (0 active callers in checkout; marked `@deprecated NON-AUTHORITATIVE`).
- **Display-Only Callers:**
  - `customer-app/app/not-serviceable/page.tsx` and `app/not-serviceable/page.tsx` (consumes dynamic `maxDist` query parameter; falls back to neutral copy with zero fallback radius).
- **Test / Mock Callers:**
  - `test/server-serviceability.test.ts`, `test/checkout-c76b-location-guard-serviceability.test.ts`, etc.
- **Client Override Possible:** ❌ **NO.** The client cannot dictate the delivery radius. Any client submitting a radius or distance parameter is ignored; the server independently looks up the store radius from PostgreSQL.
- **Verdict:** ✅ **CANONICAL ONLY.**

---

## 4. Store Coordinate Authority

- **Canonical Authority:** PostgreSQL `stores.latitude`, `stores.longitude`. (Currently `19.02245360`, `73.32100180` for darkstore anchors).
- **Protection Architecture:**
  - Normal `admin`, `store_admin`, and `store_manager` users cannot alter coordinates via UI or API (`403 Forbidden: STORE_COORDINATES_PROTECTED`).
  - Relocation requires a cryptographic, time-limited (5-minute), single-use, store-scoped developer token validated by `validateCoordinateModification()` in `lib/coordinateProtection.ts`.
  - Zero developer secrets or override headers exist in client/browser bundles.
- **Client Override Possible:** ❌ **NO.**
- **Verdict:** ✅ **CANONICAL ONLY.**

---

## 5. Delivery Fee Authority

- **Canonical Authority:** `resolveDeliveryFee(store, subtotal)` in `lib/serverServiceability.ts` reading from PostgreSQL `stores.delivery_fee`, `stores.free_delivery_threshold`, and `stores.delivery_fee_tiers`.
- **Enforcement:**
  - Client sends cart items and address.
  - Server recalculates subtotal authoritatively via `validateServerPricing()`.
  - Server evaluates delivery fee via `resolveDeliveryFee(resolvedStore, subtotal)`.
  - Calculated fee is written directly into PostgreSQL `orders.delivery_fee` in the ACID transaction.
  - Precision is strictly enforced as two decimal places (or integer paise/rupees).
- **Client Override Possible:** ❌ **NO.** Client cannot set or manipulate delivery fees.
- **Verdict:** ✅ **CANONICAL ONLY.**

---

## 6. Free Delivery Authority

- **Canonical Authority:** PostgreSQL `stores.free_delivery_enabled` and `stores.free_delivery_threshold` (currently ₹499 in database store settings, fully configurable per store via Admin API).
- **Universal Constant Absence:** There is no universal, hardcoded ₹499 constant in the order authority. If an admin disables free delivery or sets threshold to ₹799 in PostgreSQL, the server strictly honors the database record.
- **Client Override Possible:** ❌ **NO.**
- **Verdict:** ✅ **CANONICAL ONLY.**

---

## 7. Minimum Order Authority

- **Canonical Authority:** PostgreSQL `stores.minimum_order_value`.
- **Approved Business Rule:** Permanently `0.00` (retired in v2.6).
- **Enforcement Check:**
  - `POST /api/checkout` contains zero minimum-order checks or rejections.
  - `customer-app/app/checkout/page.tsx` and `app/checkout/page.tsx` contain zero minimum-order blockers.
  - Admin UI displays informational badge: `₹0 (Retired in v2.6)`.
- **Client Override Possible:** ❌ **NO.**
- **Verdict:** ✅ **RETIRED (v2.6) / CANONICAL ZERO.**

---

## 8. Operating Hours Authority

- **Canonical Authority:** PostgreSQL `stores.opening_time` and `stores.closing_time` (e.g. `06:00` to `23:00`).
- **Enforcement:**
  - Evaluated server-side in `evaluateServerServiceability()` via `isStoreCurrentlyOpen()`.
  - If closed, returns `STORE_CLOSED` and rejects checkout.
- **Client Override Possible:** ❌ **NO.** Client clock or client-side checks cannot force order creation when a darkstore is closed.
- **Verdict:** ✅ **CANONICAL ONLY.**

---

## 9. Store Active Status Authority

- **Canonical Authority:** PostgreSQL `stores.is_active` (`BOOLEAN`).
- **Enforcement:**
  - Evaluated in `evaluateServerServiceability()`: `if (!store.is_active) return { serviceable: false, code: 'STORE_INACTIVE' };`.
  - `POST /api/checkout` fails closed immediately if store is marked inactive.
- **Client Override Possible:** ❌ **NO.**
- **Verdict:** ✅ **CANONICAL ONLY.**

---

## 10. Store Selection Authority

- **Canonical Authority:** PostgreSQL `stores.id`.
- **Resolution Behavior:**
  - The client may pass a target `storeId` (e.g., `store-001`, `store_primary`, `store_central_001`).
  - `resolveCanonicalStore()` in `lib/serverServiceability.ts` validates the ID against PostgreSQL `stores`.
  - Well-defined compatibility aliases (`store-001` -> `store_primary`) safely resolve to the canonical database record.
  - Unrecognized or non-existent store IDs **fail closed** with `STORE_NOT_FOUND` (404/400).
  - Client-supplied store metadata is completely discarded.
- **Client Override Possible:** ❌ **NO.**
- **Verdict:** ✅ **CANONICAL ONLY.**

---

## 11. Order Creation Authority

- **Canonical Authority:** `POST /api/checkout`. Exactly one order-creation path exists.
- **Transactional Guarantees:**
  - Idempotency key check (`idempotency_keys`).
  - Pre-flight catalog validation & stock check (`validateServerPricing`).
  - Pre-flight server serviceability gate (`evaluateServerServiceability`).
  - PostgreSQL transaction (`BEGIN`):
    - Concurrency-safe sequential order number (`NEXTVAL('pk_order_seq')`).
    - Row-level lock stock reservation (`SELECT ... FOR UPDATE` on `inventory`).
    - FEFO batch reservation (`inventory_balances`).
    - Order record insertion (`orders`).
    - Order line items insertion (`order_items`).
    - Transactional Outbox event insertion (`outbox_events`).
    - `COMMIT`.
- **Decommissioned Competitors:**
  - Firebase Cloud Function `placeOrder` (`functions/src/orders/placeOrder.ts`): Throws `failed-precondition` unconditionally.
  - `callPlaceOrder` (`lib/functionsClient.ts`): Throws error unconditionally.
  - `checkoutApi.placeOrder` (`services/api/index.ts`): Removed in C.7.6-D.
- **Client Override Possible:** ❌ **NO.**
- **Verdict:** ✅ **CANONICAL ONLY.**

---

## 12. Client Trust Boundary

Verification of client-server security boundary across all customer surfaces:

| Client Surface | Client Input | Server-Side Validation & Authority | Bypass Possible? |
|---|---|---|:---:|
| **Web Checkout** (`app/checkout/page.tsx`) | Address, items, payment method | Re-validated authoritatively in `POST /api/checkout` | ❌ NO |
| **Customer App Checkout** (`customer-app/app/checkout/page.tsx`) | Address, items, payment method | Re-validated authoritatively in `POST /api/checkout` | ❌ NO |
| **Address Setup** (`customer-app/app/setup-address/page.tsx`) | Lat, Lng, address string | Validates serviceability via `GET /api/serviceability/check` | ❌ NO |
| **Location Permission Guard** (`customer-app/components/LocationPermissionGuard.tsx`) | User coordinates | Advisory guidance only; no checkout gate | ❌ NO |
| **Pricing & Cart** | Item selections, quantities | Re-priced authoritatively by `validateServerPricing()` | ❌ NO |

---

## 13. Firebase / Firestore Split-Brain Audit

| Collection / Path | Reading Components | Writing Components | Role / Authority | Status |
|---|---|---|---|:---:|
| `shops/{storeId}` | Legacy projections, delivery partner app | `lib/storeOperationsService.ts:377` | Transitional Secondary Mirror ONLY | ✅ Mirror |
| `settings/store` | `functions/src/utils.ts` (deprecated functions) | None | Deprecated Legacy Document | ✅ Deprecated |
| `fetchShopsFS()` | `delivery-app` | None | Client Display Projection | ✅ Non-authoritative |
| `saveShopConfigFS()` | `lib/storeOperationsService.ts` | Server operations service (non-fatal try/catch) | Secondary Mirror Write | ✅ Non-fatal Mirror |

- **Zero Firestore Dependency in Customer Paths:**
  - `GET /api/serviceability/check` does NOT read Firestore.
  - `POST /api/checkout` does NOT read Firestore.
  - If Firestore is offline or disconnected, customer serviceability, checkout, and PostgreSQL store operations proceed with 100% availability.

---

## 14. Admin Authority Audit

Verified with [`app/api/admin/store/operations/route.ts`](file:///d:/pocketkirana/app/api/admin/store/operations/route.ts) and [`lib/storeOperationsService.ts`](file:///d:/pocketkirana/lib/storeOperationsService.ts):
- **Canonical API:** `GET /api/admin/store/operations` and `PUT /api/admin/store/operations`.
- **RBAC Enforced:**
  - `admin` (Main Admin): Global access to all stores.
  - `store_admin` / `store_manager`: Restricted strictly to stores assigned in `admin_store_assignments` table. Cross-store requests return `403 Forbidden`.
  - Non-admin roles return `403`; unauthenticated returns `401`.
- **Coordinate Protection:** Relocations without developer token return `403 STORE_COORDINATES_PROTECTED`.
- **Radius Bounds:** Radius is restricted to `3.0`, `4.0`, or `5.0` km (other values return `400 Bad Request`).
- **Audit Logging:** Every update writes an immutable entry to PostgreSQL `public.audit_logs`.

---

## 15. Legacy Function Audit

| Function Name | Location | Status | Active Callers in Checkout / Setup? |
|---|---|:---:|:---:|
| `validateDeliveryZone` | `functions/src/inventory/validateDeliveryZone.ts` | **DEPRECATED** | ❌ ZERO |
| `validateDeliveryZoneServerSide` | `lib/locationServices.ts:887` | **DEPRECATED** | ❌ ZERO |
| `callValidateDeliveryZone` | `lib/functionsClient.ts:155` | **DEPRECATED** | ❌ ZERO |
| `placeOrder` (Callable) | `functions/src/orders/placeOrder.ts` | **DECOMMISSIONED** | ❌ ZERO |
| `callPlaceOrder` | `lib/functionsClient.ts:188` | **DECOMMISSIONED** | ❌ ZERO |
| `checkZoneServiceability` | `lib/locationServices.ts:704` | **DEPRECATED** | ❌ ZERO |

---

## 16. Business-Rule Constant Scan

Static scan of known legacy constants across the codebase:

| Value | Typical File Context | Production Path? | Authority? | Classification |
|---|---|:---:|:---:|---|
| **`19.0224536, 73.3210018`** | PostgreSQL `stores`, mock fixtures, test cases | YES (as default DB seed) | Store Data | **STORE DATA / TEST** |
| **`3.0` / `3 KM`** | PostgreSQL `stores.delivery_radius_km`, UI options | YES | Store Data | **STORE DATA / PARAMETERIZED** |
| **`4.5`** | Deprecated helpers, mock fixtures | NO | NO | **DEPRECATED / TEST** |
| **`5.0`** | Admin segmented options, test fixtures | YES | Store Data | **STORE DATA / OPTION** |
| **`1.35` / `1.4`** | Driver turn-by-turn routing polylines | NO (Navigational only) | NO | **NAVIGATION HELPER** |
| **`29` / `₹29`** | PostgreSQL `stores.delivery_fee`, mock fixtures | YES | Store Data | **STORE DATA / TEST** |
| **`499` / `₹499`** | PostgreSQL `stores.free_delivery_threshold`, mock fixtures | YES | Store Data | **STORE DATA / TEST** |
| **`199` / `₹199`** | Retired minimum order copy in tests/docs | NO | NO | **RETIRED / HISTORICAL** |
| **`99` / `₹99`** | Retired minimum order copy in tests/docs | NO | NO | **RETIRED / HISTORICAL** |
| **`Maule Kirana`** | Invoices (`invoiceEngine.ts`), Legal (`legalData.ts`) | YES (Legal invoices) | Legal Entity | **LEGAL DISCLOSURE** |
| **`Neral`** | Invoices, darkstore address, legal disclosures | YES (Legal invoices) | Legal Address | **LEGAL DISCLOSURE** |

---

## 17. Security Bypass Audit

- **No Client Bypass Mechanism:** No URL parameters, request headers (e.g. `x-pk-developer-override`), or body flags allow bypassing serviceability, coordinates, fees, or operating hours.
- **Developer Coordinate Relocation:**
  - Token is generated with server-side HMAC-SHA256 signature using `COORDINATE_OVERRIDE_SECRET` / `JWT_SECRET`.
  - Tokens expire in 300 seconds (5 minutes).
  - Target store ID is embedded in the signed token payload.
  - Nonces are consumed upon use to enforce single-use.
  - Zero browser secrets exist.
- **Multi-Worker Infrastructure Follow-up:** As noted in C.7.6-C, nonces are tracked in-memory. In a multi-worker PM2 deployment, nonces are process-isolated. This is a known infrastructure-hardening follow-up and does not invalidate the single-process authority verification.

---

## 18. Database Read-Only Verification

Direct live inspection of PostgreSQL database:
- **`stores` count:** `2`
- **Store IDs:** `store_primary` and `store_central_001`
- **Coordinates:** `19.02245360`, `73.32100180` (both active)
- **Delivery Radius:** `3.00` km
- **Delivery Fee:** `₹29`
- **Free Delivery:** Enabled, threshold `₹499`
- **Minimum Order:** `₹0`
- **Orders count:** `53`
- **Inventory count:** `0`
- **Admin store assignments:** `0`
- **Audit logs:** `0`
- **DDL Mutations:** **0**
- **DML Mutations:** **0**
- **Migrations Run:** **0**

---

## 19. Test Verification Results

### 1. Focused C.7 Regression Suites:
- `test/server-serviceability.test.ts`: **76 / 76 PASS**
- `test/checkout-f01-customer-app-blocker-removal.test.ts`: **9 / 9 PASS**
- `test/checkout-f02-web-checkout-road-multiplier-removal.test.ts`: **15 / 15 PASS**
- `test/checkout-f03-setup-address-canonical-serviceability.test.ts`: **22 / 22 PASS**
- `test/checkout-f04-location-picker-unblock.test.ts`: **15 / 15 PASS**
- `test/checkout-f05-fallback-removal.test.ts`: **9 / 9 PASS**
- `test/checkout-c76a-place-order-decommission.test.ts`: **12 / 12 PASS**
- `test/checkout-c76b-location-guard-serviceability.test.ts`: **20 / 20 PASS**
- `test/checkout-c76c-admin-service-area-canonical-alignment.test.ts`: **22 / 22 PASS**
- `test/checkout-c76d-legacy-ui-cleanup.test.ts`: **18 / 18 PASS**
**Total C.7 Regression Tests:** **218 / 218 PASS (100%)**

### 2. Full Test Suite (`npm test`):
- **59 test files passed (59 / 59)**
- **851 total tests passed (851 / 851, 100%)**

### 3. TypeScript & Build:
- Customer app `npx tsc --noEmit`: **0 errors**
- Customer app build (`next build`): **199 static routes generated, 0 errors**
- Functions build (`npm run build`): **0 errors**
- Core PocketKirana code: **0 errors** (isolated pre-existing untracked CopilotKit experimental files noted)

---

## 20. Final Authority Matrix

| Business Rule | Canonical Authority | Active Competing Authority | Client Override Possible? | Verdict |
|---|---|---|:---:|:---:|
| **Service Radius** | PostgreSQL `stores.delivery_radius_km` via `evaluateServerServiceability()` | None | ❌ NO | ✅ **CANONICAL ONLY** |
| **Store Coordinates** | PostgreSQL `stores.latitude, longitude` | None | ❌ NO | ✅ **CANONICAL ONLY** |
| **Delivery Fee** | PostgreSQL `stores` via `resolveDeliveryFee()` | None | ❌ NO | ✅ **CANONICAL ONLY** |
| **Free Delivery** | PostgreSQL `stores.free_delivery_enabled, threshold` | None | ❌ NO | ✅ **CANONICAL ONLY** |
| **Minimum Order** | PostgreSQL `stores.minimum_order_value` (0.00) | None | ❌ NO | ✅ **RETIRED (v2.6) / ZERO** |
| **Operating Hours** | PostgreSQL `stores.opening_time, closing_time` | None | ❌ NO | ✅ **CANONICAL ONLY** |
| **Store Active Status** | PostgreSQL `stores.is_active` | None | ❌ NO | ✅ **CANONICAL ONLY** |
| **Store Selection** | PostgreSQL `stores.id` via `resolveCanonicalStore()` | None | ❌ NO | ✅ **CANONICAL ONLY** |
| **Order Creation** | `POST /api/checkout` (PostgreSQL ACID Transaction) | None | ❌ NO | ✅ **CANONICAL ONLY** |

---

## 21. Remaining Risks

1. **Multi-Worker PM2 Nonce Isolation (Infrastructure Hardening):**  
   In `lib/coordinateProtection.ts`, single-use developer coordinate nonces are stored in Node.js process memory (`consumedNonces: Map<string, number>`). In a multi-worker cluster (e.g. PM2 with multiple worker processes), nonces are process-isolated. While 5-minute cryptographic signing and expiration prevent unauthorized modifications, full cluster-wide replay protection requires persisting nonces in PostgreSQL (`consumed_developer_nonces`) or Redis. This remains scheduled for post-C.7 infrastructure hardening.
2. **Untracked Experimental CopilotKit Files:**  
   `app/api/copilotkit/` and `app/assistant/` remain in working tree from an earlier local experiment. They do not affect production PocketKirana code, but should be pruned or cleaned up before production packaging.

---

## 22. Final Verdict

### 🟡 GREEN WITH PRODUCTION RISK — Authority correct, infrastructure hardening remains

> **Explicit Authority Declaration:**  
> **PostgreSQL store configuration and server-side evaluation are the sole authoritative business-rule path for customer serviceability and checkout.**  
>
> All remaining legacy code in the repository is strictly:
> - **Deprecated** (`checkZoneServiceability`, `validateDeliveryZone`, `validateDeliveryZoneServerSide`, `callValidateDeliveryZone`),
> - **Transitional Mirror** (`saveShopConfigFS` secondary non-fatal write),
> - **Test / Mock** (vitest fixtures),
> - **Documentation** (architectural and audit markdown files),
> - **Navigation-only** (OSRM routing polyline helpers for drivers), or
> - **Legal-only** (seller disclosure and FSSAI registration invoices).

---

## STOP

Forensic audit is complete. No further actions taken.
Awaiting user review.
