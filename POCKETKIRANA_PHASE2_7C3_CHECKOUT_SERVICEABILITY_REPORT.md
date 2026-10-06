# PocketKirana — Phase 2.7C.3 Report
## Checkout Serviceability Gate — Canonical Evaluator Integration

---

## A. Execution Status

* **Start Timestamp:** 2026-10-02T16:47:30+05:30
* **End Timestamp:** 2026-10-02T17:05:00+05:30
* **Branch:** `fix/page-readiness-production`
* **Base Commit:** `63dba53`
* **Files Changed:**
  1. `app/api/checkout/route.ts` — Authoritative checkout order creation endpoint.
  2. `test/server-serviceability.test.ts` — Extended focused test suite with Section 8 covering all 23 required serviceability, security, delivery fee, and checkout integration scenarios.
* **DB Changed:** NO (0 DDL, 0 DML, 0 schema mutations)
* **Migrations Created/Executed:** NO (Migration 003 does not exist)
* **Git Commits Created:** NO (0 commits)
* **Deployment Triggered:** NO (0 deployments)

---

## B. Checkout Path Identified

* **Authoritative Route:** `POST /api/checkout` ([`app/api/checkout/route.ts`](file:///d:/pocketkirana/app/api/checkout/route.ts))
* **Forensic Finding:** A full repository inspection verified that `app/api/checkout/route.ts` is the single authoritative order-creation path in PocketKirana. It manages inventory reservations, inserts into PostgreSQL `orders`, `order_items`, `order_addresses`, `order_status_history`, and writes to the transactional outbox (`outbox_events`).
* **Pre-flight Serviceability Placement:**
  The serviceability check executes at Step 2.7 (Lines 141–164) strictly **before** acquiring a database connection from the pool, starting the SQL transaction (`BEGIN`), or taking locks on inventory rows (`SELECT ... FOR UPDATE`).
  ```typescript
  // 2.7 CANONICAL POSTGRESQL SERVICEABILITY & STORE OPERATIONAL GATE
  // Evaluated strictly BEFORE acquiring DB connection, beginning transaction, or locking inventory rows.
  const preflightSubtotal = catalogValidation.recalculatedSubtotal;
  const serviceabilityDecision = await evaluateServerServiceability(
    storeId,
    address?.latitude,
    address?.longitude,
    preflightSubtotal
  );

  if (!serviceabilityDecision.serviceable) {
    return NextResponse.json(
      {
        success: false,
        error: serviceabilityDecision.error || 'Address is not serviceable.',
        code: serviceabilityDecision.code || 'SERVICEABILITY_REJECTED',
      },
      { status: 400 }
    );
  }
  ```

---

## C. Before/After Authority

| Aspect | Previous Implementation | Phase 2.7C.3 Canonical Authority |
| :--- | :--- | :--- |
| **Serviceability Evaluator** | Called `evaluateServerServiceability` | Retained and strictly verified `evaluateServerServiceability` |
| **Delivery Fee Calculation** | Line 298: `const deliveryFee = subtotal >= resolvedStore.freeDeliveryThreshold ? 0 : resolvedStore.deliveryFee;` (Ignored `free_delivery_enabled` and `delivery_fee_tiers`) | Line 298: `const deliveryFee = resolveDeliveryFee(resolvedStore, subtotal);` (Canonical resolver from `lib/serverServiceability.ts`) |
| **Free Delivery Toggle** | Bypassed: always awarded ₹0 delivery fee if subtotal reached threshold | Enforced: `free_delivery_enabled` must be `true` in store configuration |
| **Delivery Fee Tiers** | Ignored in order creation | Evaluated via `resolveDeliveryFee` with fallback to `store.deliveryFee` |
| **Fee Decimal Precision** | Variable | Strictly 2 decimal places (`Math.round(val * 100) / 100`) |
| **Store Source** | PostgreSQL `stores` | PostgreSQL `stores` |
| **Geographic Rule** | Haversine straight-line distance | Haversine straight-line distance (`distanceKm <= store.deliveryRadiusKm`) |
| **Minimum Order Value** | Zero minimum order enforced | Zero minimum order enforced (never rejects carts < ₹199 or ₹0) |
| **Secondary Legacy Endpoints** | `app/api/checkout/validate/route.ts`, `validate-serviceability/route.ts` | Documented as legacy pre-check endpoints (untouched in this phase; scheduled for Phase 2.7C.4/subsequent phases) |

---

## D. Security Verification

The checkout endpoint was audited against client-spoofing vectors:

1. **Client-Supplied Serviceability Overrides:**
   * In `POST /api/checkout`, the request body destructuring only extracts:
     `{ cartItems, address, paymentMethod, couponCode, storeId, idempotencyKey }`.
   * Any client-sent `serviceable: true`, `distanceKm`, `straightLineDistanceKm`, `maximumDistanceKm`, `radiusKm`, `deliveryFee`, `deliveryCharge`, `freeDeliveryThreshold`, `freeDeliveryEnabled`, `storeLatitude`, `storeLongitude` are completely ignored.
2. **Delivery Fee Spoofing:**
   * A client sending `deliveryFee: 0` or `deliveryCharge: 0` is ignored; the server assigns `resolveDeliveryFee(resolvedStore, subtotal)` and binds that value to `$7` in `INSERT INTO orders`.
3. **Store Coordinate Spoofing:**
   * Store coordinates are fetched directly from PostgreSQL `stores` (`resolvedStore.latitude`, `resolvedStore.longitude`). A client sending fake store coordinates cannot shift the store center.
4. **Boundary & Remote Address Bypass:**
   * Fake `distanceKm: 0.1` sent with remote coordinates (e.g., Colaba, 65 km away) fails server Haversine evaluation with HTTP 400 and `code: 'OUT_OF_SERVICE_AREA'`.
5. **Missing Coordinates:**
   * Omitting latitude/longitude in the customer address fails with HTTP 400 and `code: 'INVALID_COORDINATES'` before acquiring a connection or opening a transaction.

---

## E. Business Rule Verification

* **PostgreSQL Canonical Source:** `getStoreOperationalSettings` reads authoritative store configuration from PostgreSQL table `stores`.
* **Store Identifier Compatibility:** `store-001` automatically maps to `store_primary` via canonical resolution.
* **Haversine-Only:** Straight-line distance calculation via `calculateDistanceKm`. Zero road multipliers (1.35x/1.40x) or cutoffs (4.5 km/6.0 km) in checkout.
* **Radius Restrictions:** Store radius is strictly enforced from PostgreSQL `delivery_radius_km` (3.0, 4.0, or 5.0 km).
* **Operating Hours:** Evaluated via `isStoreWithinHours(store.openingTime, store.closingTime)`. Orders placed outside operating hours fail closed with HTTP 400 `STORE_CLOSED`.
* **Zero Minimum Order Requirement:** Orders with ₹0 subtotal or below historical thresholds (₹25, ₹50, ₹199, ₹499) are never rejected on minimum order value.
* **Store-Specific Delivery Fee & Free Delivery:** Delivery fee is derived via `resolveDeliveryFee(resolvedStore, subtotal)` using store-specific `delivery_fee`, `free_delivery_enabled`, `free_delivery_threshold`, and `delivery_fee_tiers`.
* **Unknown Store Fails Closed:** Queries for non-existent store IDs fail with HTTP 400 `STORE_NOT_FOUND`.
* **Inactive Store Fails Closed:** Stores with `is_active: false` fail with HTTP 400 `STORE_OFFLINE`.

---

## F. Test Results

### 1. Focused Server Serviceability Test Suite (76/76 Tests Passed)
Command:
```bash
npx vitest run test/server-serviceability.test.ts
```
Output:
```text
 ✓ test/server-serviceability.test.ts (76 tests) 228ms

 Test Files  1 passed (1)
      Tests  76 passed (76)
   Start at  16:56:37
   Duration  4.03s (environment 55%, transform 22%, import 16%, tests 6%)
```

All 23 required scenarios in Section 8 passed:
1. Customer inside 3 km store radius succeeds through checkout gate (`PK-101` created).
2. Customer outside store radius fails with 400 `OUT_OF_SERVICE_AREA`.
3. Exact radius boundary follows canonical behavior (distance <= radius passes, distance > radius fails).
4. Inactive store fails closed with 400 `STORE_OFFLINE`.
5. Unknown store fails closed with 400 `STORE_NOT_FOUND`.
6. Store operating hours are strictly enforced (`STORE_CLOSED` outside operating hours).
7. Subtotal of ₹0 is accepted from a serviceability perspective.
8. No minimum-order rejection exists for carts below historical thresholds (₹25, ₹50, ₹199, ₹499).
9. Delivery fee is resolved from canonical store configuration (not hardcoded ₹29).
10. Client-supplied delivery fee cannot override server result.
11. Empty fee tiers preserve canonical fallback behavior (`store.delivery_fee`).
12. Decimal delivery fee remains 2-decimal precise (`15.75`).
13. Store-specific free-delivery toggle is respected (fee charged if `free_delivery_enabled` is false).
14. Store-specific threshold is respected (subtotal >= threshold gets ₹0 delivery fee; subtotal < threshold charges fee).
15. Client cannot override free delivery threshold or toggle.
16. Fake distance cannot bypass serviceability.
17. Fake radius cannot bypass serviceability.
18. Fake store coordinates cannot bypass serviceability.
19. Fake `serviceable: true` cannot bypass serviceability.
20. Omitting serviceability fields cannot bypass server validation (`INVALID_COORDINATES`).
21. A non-serviceable customer cannot create an order (no `BEGIN`, no `INSERT INTO orders`).
22. A serviceable customer can proceed through the existing checkout gate to order creation.
23. Checkout uses the requested/authoritative store rather than an arbitrary store.

### 2. Full Regression Test Suite (709/709 Tests Passed across 50 Test Files)
Command:
```bash
npx vitest run
```
Output:
```text
 Test Files  50 passed (50)
      Tests  709 passed (709)
   Start at  16:56:51
   Duration  19.07s
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

* **Database Schema Changes:** NONE (No DDL executed, no migration files added).
* **Payment Architecture:** UNTOUCHED (PhonePe webhook, configuration, and checksum untouched).
* **Inventory / FEFO Engine:** UNTOUCHED (Reservation and locking logic preserved as-is).
* **Transactional Outbox Engine:** UNTOUCHED (`appendOutboxEvent` and outbox schema preserved).
* **Firebase / Firestore:** UNTOUCHED.
* **Cloud Functions:** UNTOUCHED.
* **Mobile / Frontend Code:** UNTOUCHED.
* **Cloudflare / R2:** UNTOUCHED.

---

## H. Final Gate

**READY FOR PHASE 2.7C.4**
