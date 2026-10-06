# PocketKirana — Phase 2.7B Implementation Design Review

**Document Version:** 4.0.0 (Final Technical Correction Post-Audit Design)  
**Phase:** Phase 2.7B — Implementation Design Review (READ-ONLY)  
**Roles:** Senior Production Software Architect, Backend Architect, PostgreSQL Architect, Application Security Engineer, Release Engineer  
**Date:** 2026-10-02  
**Target Environment:** `pocketkirana_db` on `192.168.0.105:5433`  
**Execution Mode:** 100% DESIGN ONLY — ZERO CODE MODIFICATIONS — ZERO DATABASE MUTATIONS  

---

## Section 1 — Executive Summary

### 1.1 The Current Architecture Problem
During Phase 2.6, **Migration 002** was executed and committed in PostgreSQL, successfully establishing canonical schema columns (`free_delivery_enabled`, `delivery_fee_tiers`), check constraints (`delivery_radius_km IN (3.00, 4.00, 5.00)`, `free_delivery_threshold >= 0.00`), in-place retirement of `minimum_order_value = 0.00`, index `idx_orders_store_id`, and table `admin_store_assignments`.

However, as revealed by the Phase 2.7A audit:
1. **Active 5% GST Imposition:** Production checkout (`app/api/checkout/route.ts:299`), cart drawer, customer web checkout, and mobile app code actively calculate and charge a 5% sales tax on net cart subtotal, directly violating the business rule that **GST charging is disabled (₹0 tax)**.
2. **Obsolete Minimum Order Rejection:** `lib/serverServiceability.ts:276` and `app/api/checkout/route.ts:144` reject valid customer carts below ₹199 with `MINIMUM_ORDER_VALUE_NOT_MET`, despite the rule that minimum order requirements are retired to `0.00`.
3. **Artificial Road Detour Rejections:** `lib/serverServiceability.ts:303` applies an unapproved 1.35× detour multiplier and rejects serviceable addresses exceeding 4.5 km with `ROAD_LIMIT_EXCEEDED`, overriding the canonical straight-line Haversine rule.
4. **Split-Brain Store Configuration:** Pre-checkout endpoints (`/api/serviceability/check`, `/api/checkout/validate`) query in-memory mock arrays (`INITIAL_STORES`) and Firestore (`fetchShopsFS()`), completely bypassing PostgreSQL `stores`.
5. **Disconnected Admin & RBAC Layer:** Admin pages mutate in-memory state and Firestore documents. Store coordinates can be edited without developer authentication. `admin_store_assignments` exists with 0 rows and zero application enforcement, allowing any authenticated admin or manager to manage any store.

### 1.2 Target Architecture
The target Phase 2.7 architecture establishes a **single authoritative backend flow** rooted in PostgreSQL:
* **Canonical Store Configuration:** All operational settings (coordinates, radius $\in \{3, 4, 5\}$ km, operating hours, `free_delivery_enabled`, `free_delivery_threshold`, and `delivery_fee_tiers`) are fetched directly from PostgreSQL `stores`.
* **Pure Straight-Line Haversine Serviceability:** Addresses within `delivery_radius_km` are serviceable; road multipliers and road-distance cutoffs are completely decommissioned for serviceability decisions.
* **Zero Minimum Order Requirement:** No customer cart is ever rejected due to cart subtotal.
* **Zero Tax Imposition:** Server-side checkout hardcodes `tax = 0`, writes `tax_amount = 0` to `orders`, and eliminates tax line items from client UIs.
* **Tiered & Fallback Delivery Fees:** Evaluates store-specific `free_delivery_enabled` and `free_delivery_threshold` first. If disabled or threshold not met, resolves `delivery_fee_tiers` JSONB. Since exact tier pricing has not yet been finalized by the business, `delivery_fee_tiers` remains empty (`[]`), safely falling back to that store's configured `stores.delivery_fee` column. For the existing stores (`store_primary` and `store_central_001`), the current persisted fallback value of the existing store configuration is ₹29. This is NOT a universal default for future stores.
* **2-Decimal Currency Precision:** Delivery fee tier calculations and store fallback delivery fees preserve monetary precision to two decimal places (`Math.round(fee * 100) / 100`). Fees are never prematurely rounded to whole integers.
* **Store-Specific Free Delivery Threshold:** Free delivery thresholds are store-specific attributes stored in PostgreSQL (`stores.free_delivery_threshold`). For existing stores, the current persisted free-delivery threshold of the existing store configuration is ₹499. This is NOT a universal global application constant or a default for all future stores.
* **Explicit Configuration for New Stores:** New store registration requires explicit configuration of delivery fee tiers, free delivery enabled/disabled state, free delivery threshold, service radius, and operating hours. Universal defaults are NOT assumed.
* **Cloud Functions Non-Authority:** Cloud Functions are strictly a deprecated/transitional layer. They do NOT act as a second pricing or serviceability authority and do NOT introduce global business defaults. Customer serviceability decisions route authoritatively through the Next.js API backed by PostgreSQL.
* **Server-Controlled One-Time Developer Location Authorization:** Store coordinate changes require a two-step, server-controlled, single-use, short-lived authorization flow (`request` $\to$ challenge $\to$ `authorize`). No reusable developer secrets are ever submitted via the browser or bundled into client code. Every change writes to `audit_logs`.
* **Safe Store Deactivation:** Store deactivation uses the existing `is_active` boolean (no unapproved `deleted_at` column) gated by 4 mandatory safety checks.

---

## Section 2 — Architecture Target

### 2.1 Target Request & Data Flow
```
Customer Client (Web / Mobile)
   │
   │ 1. Submits Cart + Address Coordinates (lat, lng) + Optional Coupon
   ▼
Next.js API Gateway (/api/checkout)
   │
   │ 2. Catalog & Stock Pre-validation (Authoritative Price & Inventory)
   ▼
Server Serviceability Engine (evaluateServerServiceability)
   │
   │ 3. Query PostgreSQL stores (coordinates, radius, hours, free delivery, tiers)
   ▼
PostgreSQL Canonical Store Configuration (public.stores)
   │
   │ 4. Validates:
   │    a. lat/lng format & range
   │    b. store.is_active === true
   │    c. current_time BETWEEN store.opening_time AND store.closing_time
   │    d. Haversine(store.lat, store.lng, lat, lng) <= store.delivery_radius_km
   │    [NO road multiplier / NO road cutoff / NO minimum order rejection]
   ▼
Authoritative Delivery Pricing Engine (resolveDeliveryFee)
   │
   │ 5. Evaluate Free Delivery:
   │    IF store.free_delivery_enabled === true AND subtotal >= store.free_delivery_threshold
   │       delivery_fee = 0
   │    ELSE IF store.delivery_fee_tiers.length > 0
   │       delivery_fee = resolveTier(store.delivery_fee_tiers, subtotal)
   │    ELSE
   │       delivery_fee = normalize2Decimals(store.delivery_fee)
   │       (Note: current persisted fallback value of the existing store configuration is ₹29)
   ▼
Authoritative Checkout Pricing & Totals Engine
   │
   │ 6. Calculates:
   │    discount    = evaluateCoupon(couponCode, subtotal)
   │    deliveryFee = resolvedDeliveryFee
   │    tax         = 0  (GST DISABLED)
   │    total       = Math.max(0, subtotal - discount + deliveryFee)
   ▼
PostgreSQL ACID Transaction
   │
   │ 7. BEGIN -> FOR UPDATE (Inventory Locks) -> FEFO Allocation ->
   │    INSERT INTO orders (subtotal, discount_amount, delivery_fee, tax_amount=0, total_amount) ->
   │    INSERT INTO order_items -> INSERT INTO outbox_events -> COMMIT
   ▼
Response to Client (Authoritative Confirmation Snapshot)
```

### 2.2 System Responsibilities & Boundaries

| Subsystem | Classification | Authoritative Responsibilities | Prohibited Actions |
| :--- | :--- | :--- | :--- |
| **PostgreSQL `stores`** | **CANONICAL BUSINESS CONFIGURATION** | Store identity, permanent coordinates, allowed radius (3, 4, 5 km), hours, `free_delivery_enabled`, `free_delivery_threshold`, `delivery_fee_tiers`. | Cannot be bypassed by in-memory arrays or Firestore configs. |
| **Next.js API & `lib/serverServiceability.ts`** | **AUTHORITATIVE** | Server-side Haversine calculation, active store verification, operating hours verification, authoritative delivery fee resolution. | Must NOT evaluate road multipliers, road-distance cutoffs, or minimum order limits. |
| **`app/api/checkout/route.ts`** | **AUTHORITATIVE** | Inventory lock acquisition, authoritative subtotal, coupon discount, delivery fee inclusion, tax = 0 enforcement, total amount calculation, order insertion. | Must NOT trust client-supplied totals, tax, delivery fee, or serviceability status. |
| **`lib/routeAuth.ts`** | **AUTHORITATIVE** | JWT session verification, user identity, global role extraction, store-level assignment verification via `admin_store_assignments`. | Must NOT rely solely on unverified client headers (`x-pk-role`). |
| **Customer Web (`app/`)** | **DISPLAY / CACHE** | Displays cart, fetches serviceability preview from API, renders server-calculated totals. | Must NOT decide serviceability, compute taxable totals, or override delivery fees. |
| **Customer Mobile (`customer-app/`)** | **DISPLAY / CACHE** | Native mobile UI, displays order tracking and cart breakdown. | Must NOT implement divergent tax or minimum order calculations. |
| **Cloud Functions (`functions/`)** | **DEPRECATED / TRANSITIONAL ONLY** | Legacy background handlers. Must NOT decide serviceability or pricing. | Must NOT become a second pricing/serviceability authority or introduce global business defaults. |
| **Firestore (`shops`, `settings/store`)** | **LEGACY / CACHE** | Read-only mirror for mobile real-time listeners if needed. | Must NOT serve as the source of truth for checkout or store configuration. |
| **`INITIAL_STORES` / `STORES_STATE`** | **DEPRECATED** | In-memory mocks used in development fallback. | Must NOT be queried by production checkout or admin routes. |

---

## Section 3 — Exact File Change Plan

### 3.1 `lib/serverServiceability.ts`
* **Current responsibility:** Authoritative server-side serviceability evaluator and store settings cache.
* **Problem:** Computes road detour distance (`1.35×`) and rejects orders $> 4.5\text{ km}$ (`ROAD_LIMIT_EXCEEDED`). Evaluates `subtotal < store.minimumOrderValue` and rejects with `MINIMUM_ORDER_VALUE_NOT_MET`. Fails to query `free_delivery_enabled` and `delivery_fee_tiers`.
* **Approved target behavior:**
  * Straight-line Haversine distance only ($\le \text{deliveryRadiusKm}$).
  * Zero minimum order rejection.
  * Query `free_delivery_enabled` (boolean) and `delivery_fee_tiers` (JSONB) from PostgreSQL.
  * Implement safe delivery fee tier resolution preserving 2-decimal precision, falling back to that store's configured `store.deliveryFee` (the current persisted fallback value of the existing store configuration is ₹29).
  * Evaluate store-specific `free_delivery_enabled` and `free_delivery_threshold` before zeroing fee.
* **Exact functions/components affected:**
  * Interface `StoreOperationalSettings` (lines 3–18): add `freeDeliveryEnabled: boolean`, `deliveryFeeTiers: DeliveryFeeTier[]`; remove/deprecate road multiplier/cutoff fields.
  * Type `ServiceabilityErrorCode` (lines 20–28): remove `MINIMUM_ORDER_VALUE_NOT_MET`, `ROAD_LIMIT_EXCEEDED`.
  * Function `getStoreOperationalSettings` (lines 134–185): update SQL query to SELECT `free_delivery_enabled`, `delivery_fee_tiers`; parse into settings object.
  * Function `evaluateServerServiceability` (lines 200–330): remove lines 276–283 (min order check); remove lines 303–317 (road detour check); update lines 320–329 for fee tier resolution with 2-decimal precision.
* **Approximate lines:** 3–18, 20–28, 134–185, 276–283, 303–329.
* **Dependencies:** `lib/postgres.ts`.
* **Risk:** High (Core checkout gate).
* **Testing required:** Unit tests covering 2.9 km (pass), 3.1 km (fail), 4 km and 5 km radius stores, hours check, ₹0 min order check, tiered fees with decimal values.

### 3.2 `app/api/checkout/route.ts`
* **Current responsibility:** Core checkout API, payment routing, and order transaction execution.
* **Problem:** Line 299 computes 5% GST (`tax = Math.round((subtotal - discount) * 0.05)`). Line 298 grants free delivery without checking `free_delivery_enabled`. Line 300 adds `tax` to grand total. Line 144 passes preflight subtotal into serviceability evaluator which could reject on min order.
* **Approved target behavior:**
  * Hardcode `const tax = 0;`.
  * Set `const total = Math.max(0, subtotal - discount + deliveryFee);`.
  * In `INSERT INTO orders`: bind `$8` (`tax_amount`) as `0`.
  * Resolve `deliveryFee` respecting `resolvedStore.freeDeliveryEnabled`, store-specific `freeDeliveryThreshold`, and `delivery_fee_tiers` with 2-decimal precision.
* **Exact functions/components affected:** `POST` route handler (lines 144, 297–328).
* **Approximate lines:** 144, 297–301, 318–324.
* **Dependencies:** `lib/serverServiceability.ts`, `lib/postgres.ts`.
* **Risk:** Critical (Direct impact on live revenue and order placement).
* **Testing required:** Transactional integration tests, COD and PhonePe orders verifying `tax_amount = 0` in database snapshot.

### 3.3 `app/api/serviceability/check/route.ts`
* **Current responsibility:** Public serviceability pre-check API for address input.
* **Problem:** Queries in-memory `getStores()` and `INITIAL_STORES[0]` (`Maule Kirana`); hardcodes 4.5 km fallback; returns static Neral copy.
* **Approved target behavior:**
  * Accept `latitude`, `longitude`, and optional `storeId`.
  * Query PostgreSQL via `evaluateServerServiceability` or direct SQL on `stores`.
  * Return store-specific straight-line serviceability, operating hours status, and delivery fee.
* **Exact functions/components affected:** `POST` handler (lines 16–140).
* **Approximate lines:** 37–57, 58–140.
* **Dependencies:** `lib/serverServiceability.ts`.
* **Risk:** Medium (Customer address feedback).
* **Testing required:** Address input tests inside and outside 3 km, 4 km, 5 km zones.

### 3.4 `app/api/checkout/validate/route.ts` & `validate-serviceability/route.ts`
* **Current responsibility:** Legacy secondary validation endpoints.
* **Problem:** Both query Firestore `fetchShopsFS()`; enforce 5.0 km radius and custom `distKm <= 1.0` free delivery rule; bypass PostgreSQL.
* **Approved target behavior:**
  * Refactor to wrap `evaluateServerServiceability`.
  * Return standard Phase 2 serviceability responses. Mark routes as deprecated for future removal.
* **Exact functions/components affected:** `POST` handlers.
* **Approximate lines:** Lines 20–55 in `validate/route.ts`, lines 40–85 in `validate-serviceability/route.ts`.
* **Dependencies:** `lib/serverServiceability.ts`.
* **Risk:** Low.
* **Testing required:** Verify fallback client requests receive consistent decisions.

### 3.5 `app/api/checkout/quote/route.ts`
* **Current responsibility:** Pre-checkout price quote calculator.
* **Problem:** Hardcodes legacy delivery fee and 5% tax (line 38).
* **Approved target behavior:**
  * Refactor: Set `tax = 0`; compute delivery fee via store threshold / tier resolver with 2-decimal precision; return aligned quote.
* **Exact functions/components affected:** `POST` handler (lines 37–40).
* **Approximate lines:** 37–40, 47–48.
* **Dependencies:** `lib/serverServiceability.ts`.
* **Risk:** Low.
* **Testing required:** Test quote returns `tax: 0` and accurate subtotal.

### 3.6 `lib/freeDelivery.ts`
* **Current responsibility:** Client presentation and progress indicator helper.
* **Problem:** Line 7 hardcodes `FREE_DELIVERY_THRESHOLD = 500` as an application global.
* **Approved target behavior:**
  * Document clearly: `lib/freeDelivery.ts` is **NOT** authoritative business logic. Authoritative thresholds come strictly from PostgreSQL via the selected store configuration (`selectedStore.freeDeliveryThreshold`).
  * Functions `calculateDeliveryFee` and `calculateFreeDeliveryProgress` must accept `threshold: number` parameter supplied by the selected store configuration.
  * Provide an exported fallback constant `DEFAULT_FREE_DELIVERY_THRESHOLD = 499` solely as a temporary UI display fallback while store configuration is loading (matching the current persisted free-delivery threshold of the existing store configuration).
* **Exact functions/components affected:** `FREE_DELIVERY_THRESHOLD` (line 7), `calculateDeliveryFee` (lines 28–33), `calculateFreeDeliveryProgress` (lines 38–43).
* **Approximate lines:** 7, 28–33, 38–60.
* **Dependencies:** None.
* **Risk:** Medium (Cart drawer progress bar and messaging).
* **Testing required:** Unit tests in `test/free-delivery-progress.test.ts`.

### 3.7 `lib/pricingEngine.ts`
* **Current responsibility:** Client-side price breakdown helper.
* **Problem:** Line 265 calculates 5% GST (`taxAmount = Math.round(taxableAmount * 0.05)`). Line 264 uses hardcoded global threshold 500.
* **Approved target behavior:**
  * Set `taxAmount = 0;`.
  * Compute `grandTotal = Math.max(0, taxableAmount + deliveryCharge);`.
  * Accept store-specific `freeDeliveryThreshold` parameter; use `499` solely as temporary display fallback when configuration is absent.
* **Exact functions/components affected:** `calculateAuthoritativeCartPrice` (lines 262–267).
* **Approximate lines:** 262–267.
* **Dependencies:** `lib/freeDelivery.ts`.
* **Risk:** Medium.
* **Testing required:** Pricing engine unit tests.

### 3.8 `lib/store.ts`
* **Current responsibility:** Zustand client state store.
* **Problem:** Lines 1785–1791 in `placeOrder` calculate 5% tax as fallback (`Math.round(Math.max(0, subtotal - discount) * 0.05)`) and use threshold 500. Hardcodes `storeId: 'store-1'`.
* **Approved target behavior:**
  * Set fallback tax to 0.
  * Use selected store's threshold for display fallback.
  * Accept dynamic `storeId`.
* **Exact functions/components affected:** `placeOrder` action (lines 1783–1806).
* **Approximate lines:** 1783–1806.
* **Dependencies:** None.
* **Risk:** High (Client order placement snapshot).
* **Testing required:** `test/checkout-total-state.test.ts`.

### 3.9 `lib/locationServices.ts`
* **Current responsibility:** In-memory store repository and geocoding services.
* **Problem:** Contains legacy hardcoded constants (`DELIVERY_RADIUS_KM = 4.5`, `roadMultiplier = 1.35`).
* **Approved target behavior:**
  * Deprecate in-memory mutators (`updateStoreConfig`).
  * Add `@deprecated` annotations pointing to PostgreSQL pool queries.
* **Exact functions/components affected:** `STORES_STATE` (line 616), `getStores` (lines 750–770), `updateStoreConfig` (lines 800–820).
* **Approximate lines:** 616, 750–820, 920–939.
* **Dependencies:** None.
* **Risk:** Low.
* **Testing required:** Regression testing for admin pages.

### 3.10 `lib/storeOperationsService.ts`
* **Current responsibility:** Darkstore capacity and operations service.
* **Problem:** Lines 67–70 query `stores LIMIT 1` ignoring storeId. Lines 74–76 hardcode hours `06:00`–`23:30` and radius `5.0`. Lines 132–138 perform upsert hardcoded to `STORE-001`.
* **Approved target behavior:**
  * Parameterize by `storeId`.
  * Read `opening_time`, `closing_time`, `delivery_radius_km` from PostgreSQL record.
  * `updateDarkstoreOperations`: UPDATE `stores` SET `is_active = $2, opening_time = $3, closing_time = $4, delivery_radius_km = $5 WHERE id = $1`.
* **Exact functions/components affected:** `getDarkstoreOperationalStatus` (lines 60–116), `updateDarkstoreOperations` (lines 121–139).
* **Approximate lines:** 65–77, 132–139.
* **Dependencies:** `lib/postgres.ts`.
* **Risk:** Medium.
* **Testing required:** Capacity and operational status tests for `store_primary` and `store_central_001`.

### 3.11 `lib/routeAuth.ts`
* **Current responsibility:** Next.js route auth and role verification helper.
* **Problem:** `requireRole` only validates string role name (`admin`, `store_manager`); does not verify store assignment.
* **Approved target behavior:**
  * Implement `requireStoreAccess(req: NextRequest, storeId: string): Promise<RouteAuthContext | null>`.
  * If role is `main_admin` (or global `admin`), grant access.
  * If role is `store_admin` (or `store_manager`), query PostgreSQL `admin_store_assignments` for `(admin_user_id, store_id)`.
* **Exact functions/components affected:** Add `requireStoreAccess` helper; export `StoreAuthContext`.
* **Approximate lines:** 70–83.
* **Dependencies:** `lib/postgres.ts`.
* **Risk:** High (Admin security boundary).
* **Testing required:** RBAC unit tests: cross-store access denied, assigned store allowed, main admin allowed everywhere.

### 3.12 `app/api/admin/stores/route.ts` & `app/api/admin/stores/[id]/route.ts`
* **Current responsibility:** Admin store management APIs.
* **Problem:** Reads and mutates in-memory `locationServices.ts`. No PostgreSQL queries. No store registration `POST`. No coordinate protection.
* **Approved target behavior:**
  * `GET /api/admin/stores`: SELECT all stores from PostgreSQL `stores`.
  * `POST /api/admin/stores`: Main Admin only. Insert new store into PostgreSQL `stores` requiring explicit delivery configurations.
  * `GET /api/admin/stores/[id]`: SELECT store by id from PostgreSQL.
  * `PATCH /api/admin/stores/[id]`: Store Admin or Main Admin. Update operational fields (`name`, `is_active`, `opening_time`, `closing_time`, `delivery_radius_km`, `free_delivery_enabled`, `free_delivery_threshold`, `delivery_fee`, `delivery_fee_tiers`). **Disallow latitude/longitude changes.**
  * `DELETE /api/admin/stores/[id]`: Verify 4 safety gates before deactivation. Soft deactivation sets `is_active = false, updated_at = NOW()` (no `deleted_at`).
* **Exact functions/components affected:** All route handlers.
* **Approximate lines:** `stores/route.ts` (lines 5–17), `stores/[id]/route.ts` (lines 5–74).
* **Dependencies:** `lib/postgres.ts`, `lib/routeAuth.ts`, `lib/auditLogger.ts`.
* **Risk:** High.
* **Testing required:** Admin CRUD tests, validation of radius constraints $\in \{3, 4, 5\}$.

### 3.13 `app/admin/stores/page.tsx` & `app/admin/service-area/page.tsx`
* **Current responsibility:** Admin store management and service area UI.
* **Problem:** Directly mutates `STORES_STATE` and saves to Firestore `saveShopConfigFS()`. Allows editing latitude/longitude in ordinary inputs.
* **Approved target behavior:**
  * Fetch store list from `GET /api/admin/stores` (PostgreSQL).
  * Save operational settings to `PATCH /api/admin/stores/[id]`.
  * Remove road distance multiplier input. Set min order to 0 (read-only/hidden).
  * Disable direct coordinate editing. Display a "Request Store Relocation" button initiating the server-controlled two-step authorization flow.
* **Exact functions/components affected:** Form state, save handlers (`handleSaveServiceArea`, `handleSelectStore`).
* **Approximate lines:** `stores/page.tsx` (lines 48–62, 88–99), `service-area/page.tsx` (lines 123–154).
* **Dependencies:** Admin Store APIs.
* **Risk:** Medium.
* **Testing required:** Admin UI navigation and setting persistence checks.

### 3.14 `app/checkout/page.tsx` & `components/customer/CartDrawer.tsx`
* **Current responsibility:** Customer web checkout page and sliding cart drawer.
* **Problem:** Calculate 5% GST and display "Taxes (GST) ₹{tax}".
* **Approved target behavior:**
  * Set `tax = 0;`. Remove Taxes row from order summary.
  * Display free delivery threshold dynamically from selected store's configuration.
  * Load store operational status from PostgreSQL API.
* **Exact functions/components affected:** `CartDrawer.tsx` (lines 49–54, 311), `checkout/page.tsx` (lines 120–123, 847–848).
* **Approximate lines:** `CartDrawer.tsx`: 49–54; `checkout/page.tsx`: 120–123.
* **Dependencies:** `lib/freeDelivery.ts`.
* **Risk:** High (Customer-facing presentation).
* **Testing required:** Web UI snapshot tests, cart total calculation tests.

### 3.15 `customer-app/app/checkout/page.tsx` & `customer-app/app/cart/page.tsx`
* **Current responsibility:** Mobile Capacitor customer checkout and cart views.
* **Problem:** Compute 5% GST on net subtotal and render tax lines.
* **Approved target behavior:**
  * Set `tax = 0;`. Remove "Govt. Taxes & GST" line items.
  * Grand total equals `Math.max(0, subtotal - discount + deliveryCharge)`.
  * Display threshold dynamically from selected store configuration.
* **Exact functions/components affected:** `checkout/page.tsx` (lines 92–93, 561–562), `cart/page.tsx` (lines 65–66, 491–492).
* **Approximate lines:** `checkout/page.tsx`: 92–93; `cart/page.tsx`: 65–66.
* **Dependencies:** None (business logic alignment only).
* **Risk:** Medium.
* **Testing required:** Mobile cart and checkout total verification.

### 3.16 `functions/src/utils.ts` & `functions/src/inventory/validateDeliveryZone.ts`
* **Current responsibility:** Deprecated / transitional legacy functions.
* **Problem:** `functions/src/inventory/validateDeliveryZone.ts` and `functions/src/utils.ts` replicate serviceability rules in Firebase.
* **Approved target behavior:**
  * Mark `functions/src/inventory/validateDeliveryZone.ts` as **DEPRECATED**.
  * Migrate customer address setup in `customer-app/app/setup-address/page.tsx` to call Next.js API `/api/serviceability/check` directly, ensuring direct access to PostgreSQL canonical store settings.
  * Document `functions/src/utils.ts` store config fallback as a **transitional/deprecated compatibility layer ONLY**, not as an authoritative business configuration.
  * Do NOT assign global or universal business defaults (e.g. universal ₹29 or ₹499) in Cloud Functions.
  * Do NOT invent replacement fee or threshold values in Cloud Functions.
  * Do NOT introduce PostgreSQL read replicas or new database infrastructure.
* **Exact functions/components affected:** `getStoreConfig` (lines 101–113), `validateDeliveryZone` (lines 32–40).
* **Approximate lines:** `utils.ts`: 101–113; `validateDeliveryZone.ts`: 32–40.
* **Dependencies:** Firebase Admin SDK.
* **Risk:** Low (Pre-checkout validation).
* **Testing required:** Cloud Function unit tests.

### 3.17 `lib/firebaseServices.ts`
* **Current responsibility:** Client Firestore helper functions (`fetchShopsFS`, `saveShopConfigFS`).
* **Problem:** Allows client admin pages to directly overwrite store coordinates and radius in Firestore `shops`.
* **Approved target behavior:**
  * Mark `saveShopConfigFS` and `updateShopLocationAndRadiusFS` as deprecated.
  * Direct all writes through Next.js PostgreSQL admin APIs.
* **Exact functions/components affected:** Lines 1250–1356.
* **Approximate lines:** 1250–1356.
* **Dependencies:** None.
* **Risk:** Low.
* **Testing required:** Verify Firestore listener receives updates if synced from backend.

---

## Section 4 — Server Serviceability Design

### 4.1 Specification for `evaluateServerServiceability`
The function `evaluateServerServiceability` in `lib/serverServiceability.ts` is the **single authoritative serviceability gate** for PocketKirana.

#### Function Signature:
```typescript
export async function evaluateServerServiceability(
  storeId: string | undefined,
  latInput: unknown,
  lngInput: unknown,
  subtotal: number,
  options?: EvaluateServiceabilityOptions
): Promise<ServiceabilityDecision>
```

#### Inputs:
* `storeId`: String identifier (`store_primary`, `store_central_001`, or legacy alias `store-001`).
* `latInput`: Coordinate latitude (number or numeric string).
* `lngInput`: Coordinate longitude (number or numeric string).
* `subtotal`: Net catalog subtotal of verified in-stock items (number).
* `options`: Optional overrides (`currentTime?: Date`, `bypassCache?: boolean`).

#### Outputs (`ServiceabilityDecision`):
```typescript
export interface ServiceabilityDecision {
  serviceable: boolean;
  code?: ServiceabilityErrorCode;
  error?: string;
  store?: StoreOperationalSettings;
  straightLineDistanceKm?: number;
  deliveryFee?: number;
  freeDeliveryThreshold?: number;
}
```

#### Error Codes:
* `INVALID_COORDINATES`: Coordinates missing, NaN, or out of range ($-90 \le \text{lat} \le 90$, $-180 \le \text{lng} \le 180$).
* `STORE_NOT_FOUND`: Store does not exist in PostgreSQL.
* `STORE_OFFLINE`: `stores.is_active === false`.
* `STORE_CLOSED`: Current time is outside `opening_time` to `closing_time`.
* `OUT_OF_SERVICE_AREA`: Straight-line Haversine distance exceeds `stores.delivery_radius_km`.
* `SERVICEABILITY_ERROR`: Database connection or execution failure.

### 4.2 Step-by-Step Evaluation Algorithm
1. **Coordinate Format Validation:**
   Parse `latInput` and `lngInput`. If missing or invalid, return `{ serviceable: false, code: 'INVALID_COORDINATES' }`.
2. **Store Lookup:**
   Query PostgreSQL `stores` matching `id = $1 OR UPPER(code) = UPPER($1)`.
   If row missing, return `{ serviceable: false, code: 'STORE_NOT_FOUND' }`.
3. **Active State Validation:**
   If `!store.isActive`, return `{ serviceable: false, code: 'STORE_OFFLINE' }`.
4. **Operating Hours Validation:**
   Compare `currentTime` (or `new Date()`) against `store.openingTime` and `store.closingTime`.
   If closed, return `{ serviceable: false, code: 'STORE_CLOSED' }`.
5. **Straight-Line Haversine Distance Check:**
   Compute `straightLineDistanceKm = calculateDistanceKm(store.latitude, store.longitude, lat, lng)`.
   Check:
   $$\text{straightLineDistanceKm} \le \text{store.deliveryRadiusKm}$$
   Where $\text{store.deliveryRadiusKm} \in \{3.00, 4.00, 5.00\}$.
   If distance exceeds radius, return `{ serviceable: false, code: 'OUT_OF_SERVICE_AREA' }`.
6. **DECOMMISSIONED RULES (Explicitly Omitted):**
   * **NO** road multiplier calculation (`straightLine * 1.35`).
   * **NO** road limit check (`roadDistance > 4.5`).
   * **NO** minimum order value check (`subtotal < store.minimumOrderValue`).
7. **Delivery Fee Calculation:**
   Invoke `resolveDeliveryFee(store, subtotal)`.
   Return `{ serviceable: true, store, straightLineDistanceKm, deliveryFee, freeDeliveryThreshold: store.freeDeliveryThreshold }`.

---

## Section 5 — Delivery Fee Tier Engine Design

### 5.1 JSONB Schema Contract for `delivery_fee_tiers`
The `stores.delivery_fee_tiers` column in PostgreSQL stores a JSONB array conforming to the schema contract:

```json
[
  {
    "minSubtotal": number,
    "maxSubtotal": number | null,
    "fee": number
  }
]
```

#### Explicit Rules:
1. **Business tier values are NOT finalized:** No concrete tier fees or threshold amounts are defined by leadership at this stage.
2. **Phase 2.7C must NOT seed any tier values:** The engine design provides the schema contract and resolver logic only.
3. **Current database value remains `[]`:** In Migration 002, `stores.delivery_fee_tiers` was created as `'[]'::jsonb`. This remains completely untouched during Phase 2.7.
4. **Fallback mechanism:** When `delivery_fee_tiers` is empty (`[]`), the resolver safely falls back to that store's configured `stores.delivery_fee` column.
5. **Current fallback value:** For the existing stores (`store_primary` and `store_central_001`), the current persisted fallback value of the existing store configuration is ₹29. This is NOT a universal default for future stores.
6. **2-Decimal Currency Precision:** The engine preserves monetary precision to 2 decimal places (`Math.round(fee * 100) / 100`).

### 5.2 TypeScript Interfaces
```typescript
export interface DeliveryFeeTier {
  minSubtotal: number;
  maxSubtotal: number | null; // null represents unbounded upper range
  fee: number;
}
```

### 5.3 Safe Resolver Algorithm: `resolveDeliveryFee`
```typescript
export function resolveDeliveryFee(
  store: {
    freeDeliveryEnabled: boolean;
    freeDeliveryThreshold: number;
    deliveryFee: number;
    deliveryFeeTiers?: DeliveryFeeTier[];
  },
  subtotal: number
): number {
  const cleanSubtotal = Math.max(0, typeof subtotal === 'number' && !isNaN(subtotal) ? subtotal : 0);

  // 1. FREE DELIVERY GATE (Highest Priority)
  // Free delivery waives the fee ONLY if explicitly enabled AND subtotal meets store threshold
  if (store.freeDeliveryEnabled && cleanSubtotal >= store.freeDeliveryThreshold) {
    return 0;
  }

  // 2. TIERED RESOLUTION (Evaluated only if tiers are populated in database)
  if (Array.isArray(store.deliveryFeeTiers) && store.deliveryFeeTiers.length > 0) {
    for (const tier of store.deliveryFeeTiers) {
      if (typeof tier.minSubtotal !== 'number' || typeof tier.fee !== 'number' || tier.fee < 0) {
        continue; // Skip malformed tier safely
      }

      const meetsMin = cleanSubtotal >= tier.minSubtotal;
      const meetsMax = tier.maxSubtotal === null || cleanSubtotal <= tier.maxSubtotal;

      if (meetsMin && meetsMax) {
        // Preserve 2-decimal monetary precision
        return Math.max(0, Math.round(tier.fee * 100) / 100);
      }
    }
  }

  // 3. CANONICAL FALLBACK
  // Used when tiers array is empty ([]) or no tier matched.
  // Safely returns that store's configured delivery_fee column with 2-decimal precision.
  // (Note: the current persisted fallback value of the existing store configuration is ₹29).
  return Math.max(0, Math.round((store.deliveryFee ?? 0) * 100) / 100);
}
```

### 5.4 Boundary, Error & Precision Handling
* **Empty Array (`[]`):** Safely falls back to `store.deliveryFee`.
* **Boundary Condition:** `minSubtotal <= cleanSubtotal <= maxSubtotal`.
* **Negative Fee Protection:** Clamped to `Math.max(0, ...)`. Fees cannot be negative.
* **Malformed JSON:** Any tier lacking numeric `minSubtotal` or `fee` is ignored, falling back to `store.deliveryFee`.
* **Unbounded Maximum:** `maxSubtotal: null` matches any subtotal $\ge \text{minSubtotal}$.
* **Subtotal & Currency Precision:** Currency evaluated at 2 decimal places (`Math.round(value * 100) / 100`). Fees are never prematurely rounded to whole integers.

---

## Section 6 — Checkout Design

### 6.1 Authoritative Server Calculation vs Client Display Calculation
A strict architectural boundary is enforced between client display calculations and authoritative server calculations:

* **Client Display Calculation:** The web or mobile client renders estimates (subtotal, coupon deduction, delivery fee, tax = 0, total) for immediate user responsiveness using store configuration received from the API. **The client's calculation has zero authority.**
* **Authoritative Server Calculation:** When the order request is submitted to `POST /api/checkout`, the server recalculates every line item from the database catalog, resolves the store operational settings from PostgreSQL, evaluates free delivery and delivery tiers, forces tax to 0, and determines the binding grand total. **The server never trusts client-supplied fees or totals.**

```typescript
// 1. Authoritative Catalog Recalculation from PostgreSQL
const subtotal = validatedItems.reduce((sum, item) => sum + item.totalPrice, 0);

// 2. Authoritative Coupon Discount Evaluation
const discount = couponCode ? evaluateCouponDiscount(couponCode, subtotal) : 0;
const netTaxableSubtotal = Math.max(0, subtotal - discount);

// 3. Authoritative Free Delivery & Tier Resolution from PostgreSQL Store Config
const deliveryFee = resolveDeliveryFee(resolvedStore, subtotal);

// 4. GST Disabled (Zero Tax Mandate)
const tax = 0; // Mandate: GST charging is DISABLED

// 5. Authoritative Grand Total
const total = Math.max(0, netTaxableSubtotal + deliveryFee + tax);
```

### 6.2 Orders Table Persistence Contract
When executing `INSERT INTO orders`:
* `subtotal`: Exact sum of verified item lines.
* `discount_amount`: Authoritative coupon deduction.
* `delivery_fee`: `deliveryFee` (0 if free delivery or resolved tier fee).
* `tax_amount`: Bound strictly to `0` (or `tax`).
* `total_amount`: `total`.
* `store_id`: `canonicalStoreId` (resolved from PostgreSQL `stores.id`).

### 6.3 Anti-Tamper Security Verification
The client payload to `POST /api/checkout` contains only:
`{ items: [{ productId, quantity }], address: { latitude, longitude, ... }, paymentMethod, couponCode, storeId }`.

The backend **NEVER** reads:
* `body.deliveryFee`
* `body.tax`
* `body.total`
* `body.isServiceable`
* `body.deliveryRadiusKm`

Any attempt by a client to inject custom pricing or force serviceability is discarded because calculations derive 100% server-side from PostgreSQL and authoritative catalog data.

---

## Section 7 — Secondary API Strategy

| Endpoint | Recommendation | Consumers | Security Risk | Migration Strategy |
| :--- | :---: | :--- | :--- | :--- |
| **`/api/serviceability/check`** | **REFACTOR** | Address modal, landing page, customer address picker | **HIGH:** Queries in-memory mocks and returns static Neral copy. | Refactor to query PostgreSQL `stores` via `evaluateServerServiceability`. Return real store hours, radius, and fee. |
| **`/api/checkout/validate`** | **DEPRECATE** | Legacy web checkout pre-check | **MEDIUM:** Queries Firestore `fetchShopsFS()` with custom 1 km free delivery rule. | Wrap `evaluateServerServiceability` to return uniform response; mark `@deprecated` in headers; migrate frontend to `/api/serviceability/check`. |
| **`/api/checkout/validate-serviceability`** | **DEPRECATE** | Legacy mobile pre-check | **MEDIUM:** Queries Firestore; duplicates radius logic. | Wrap `evaluateServerServiceability`; mark `@deprecated`; point mobile app to unified checkout preflight. |
| **`/api/checkout/quote`** | **REFACTOR** | Cart drawer quote preview | **MEDIUM:** Hardcodes legacy delivery fee and 5% tax. | Refactor to use `tax = 0` and `resolveDeliveryFee` with 2-decimal precision. |

---

## Section 8 — Store API Design

### 8.1 API Surface Specifications

#### `GET /api/admin/stores`
* **Auth:** Required `admin` or `store_manager`.
* **Scope:** Main Admin receives all stores. Store Admin receives only assigned stores via `admin_store_assignments`.
* **SQL:**
  ```sql
  SELECT s.id, s.name, s.code, s.latitude, s.longitude, s.is_active,
         s.delivery_radius_km, s.opening_time, s.closing_time,
         s.delivery_fee, s.free_delivery_enabled, s.free_delivery_threshold,
         s.delivery_fee_tiers, s.created_at, s.updated_at
  FROM stores s
  WHERE ($1 = 'main_admin') OR EXISTS (
    SELECT 1 FROM admin_store_assignments a
    JOIN admin_users u ON u.id = a.admin_user_id
    WHERE u.firebase_uid = $2 AND a.store_id = s.id
  )
  ORDER BY s.name ASC;
  ```

#### `POST /api/admin/stores` (Store Registration)
* **Auth:** Main Admin only.
* **Requirement:** Delivery configuration, service radius, operating hours, coordinates, address, and identity must be **explicitly provided** by the administrator. No universal defaults are assumed.
* **Validation:**
  * `deliveryRadiusKm` must be explicitly chosen from `3.0`, `4.0`, or `5.0`.
  * `latitude` ($-90 \le \text{lat} \le 90$) and `longitude` ($-180 \le \text{lng} \le 180$).
  * `freeDeliveryEnabled` (boolean) must be explicitly provided.
  * `freeDeliveryThreshold` ($\ge 0.00$) must be explicitly provided.
  * `deliveryFee` ($\ge 0.00$) must be explicitly provided.
  * `delivery_fee_tiers` initialized to `[]`::jsonb.

#### `GET /api/admin/stores/[id]`
* **Auth:** Main Admin or assigned Store Admin (`requireStoreAccess(req, id)`).
* **SQL:** `SELECT ... FROM stores WHERE id = $1`.

#### `PATCH /api/admin/stores/[id]` (Operational Settings Update)
* **Auth:** Main Admin or assigned Store Admin (`requireStoreAccess(req, id)`).
* **Permitted Fields:** `name`, `is_active`, `delivery_radius_km`, `opening_time`, `closing_time`, `free_delivery_enabled`, `free_delivery_threshold`, `delivery_fee`, `delivery_fee_tiers`.
* **RESTRICTED FIELDS:** `latitude` and `longitude` **CANNOT** be updated via this route. Attempting to pass coordinates results in HTTP 403 Forbidden with message: `"Store coordinates cannot be changed via standard settings. Server-controlled developer authorization required."`

#### `DELETE /api/admin/stores/[id]` (Store Deletion / Deactivation)
* **Auth:** Main Admin only.
* **Pre-conditions:** Must pass all 4 Safety Gates (Section 13). If any gate fails, aborts with HTTP 409 Conflict.
* **Action:** Soft deactivation using the existing `is_active` column:
  ```sql
  UPDATE stores SET is_active = false, updated_at = NOW() WHERE id = $1;
  ```
  *(Note: No `deleted_at` column exists in the schema; `is_active = false` is authoritative. Hard deletion is prevented if historical dependencies exist).*

---

## Section 9 — Store Registration Design

### 9.1 Registration Payload & Database Initialization
```typescript
export interface StoreRegistrationInput {
  name: string;                         // Required, 3..128 chars
  code: string;                         // Required, uppercase alphanumeric, e.g. "STORE-003"
  address: string;                      // Required, physical street address
  latitude: number;                     // Required, -90..90
  longitude: number;                    // Required, -180..180
  deliveryRadiusKm: 3 | 4 | 5;          // Required, restricted by CHECK constraint
  openingTime: string;                  // Required, HH:MM format (e.g. "06:00")
  closingTime: string;                  // Required, HH:MM format (e.g. "23:00")
  deliveryFee: number;                  // Required, store fallback fee (preserves 2 decimals)
  freeDeliveryEnabled: boolean;         // Required, explicitly toggled ON/OFF
  freeDeliveryThreshold: number;        // Required, explicitly configured threshold (>= 0.00)
}
```

### 9.2 Explicit Configuration vs Universal Defaults
The registration design enforces the fundamental principle:
$$\textbf{CURRENT EXISTING STORE CONFIGURATION} \ne \textbf{NEW STORE UNIVERSAL DEFAULT}$$

* The existing stores (`store_primary` and `store_central_001`) currently happen to have:
  * `delivery_fee` = 29
  * `free_delivery_threshold` = 499
  * `free_delivery_enabled` = true
* These are **current persisted values of existing stores**, NOT universal future-store policies.
* When registering a new store, the administrator must explicitly specify all operational settings. Universal defaults are NOT assumed.

### 9.3 Transactional Insert
```sql
INSERT INTO stores (
  id, name, code, address, latitude, longitude, is_active,
  delivery_radius_km, opening_time, closing_time,
  delivery_fee, free_delivery_enabled, free_delivery_threshold,
  delivery_fee_tiers, minimum_order_value, created_at, updated_at
) VALUES (
  $1, $2, UPPER($3), $4, $5, $6, true,
  $7, $8, $9,
  $10, $11, $12,
  '[]'::jsonb, 0.00, NOW(), NOW()
);
```
*Note: `minimum_order_value` is explicitly set to `0.00` in accordance with approved business rules.*

---

## Section 10 — RBAC Design

### 10.1 Role Hierarchy & Permissions Matrix

| Conceptual Role | System Role Name | Store Scope | Can View Stores | Can Edit Operational Hours/Radius | Can Mutate Coordinates | Can Register Store | Can Delete Store |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Main Admin** | `admin` / `main_admin` | Global (All Stores) | ✅ | ✅ | ❌ (Dev Auth Req) | ✅ | ✅ (Gated) |
| **Store Admin** | `store_manager` | Assigned Stores Only | ✅ (Assigned) | ✅ (Assigned) | ❌ | ❌ | ❌ |
| **Picker** | `picker` | Assigned Store Only | ❌ (Operational tasks only) | ❌ | ❌ | ❌ | ❌ |
| **Delivery Partner** | `delivery_partner` | Assigned Store Only | ❌ (Fulfillment only) | ❌ | ❌ | ❌ | ❌ |
| **Customer** | `customer` | None | Public info only | ❌ | ❌ | ❌ | ❌ |

### 10.2 Server-Side Helper: `requireStoreAccess`
Located in `lib/routeAuth.ts`:

```typescript
export async function requireStoreAccess(
  req: NextRequest,
  storeId: string
): Promise<RouteAuthContext | null> {
  const auth = getRouteAuth(req);
  if (!auth) return null;

  // 1. Main Admin has unrestricted access to all stores
  if (auth.role === 'admin' || auth.role === 'main_admin') {
    return auth;
  }

  // 2. Store Admin / Manager must have an explicit assignment in PostgreSQL
  if (auth.role === 'store_manager' || auth.role === 'store_admin') {
    const pool = getPostgresPool();
    const res = await pool.query(
      `SELECT 1 
       FROM admin_store_assignments asa
       JOIN admin_users au ON au.id = asa.admin_user_id
       JOIN stores s ON s.id = asa.store_id
       WHERE au.firebase_uid = $1 
         AND asa.store_id = $2
         AND au.is_active = true
         AND s.is_active = true
       LIMIT 1;`,
      [auth.uid, storeId]
    );

    if (res.rows && res.rows.length > 0) {
      return auth;
    }
  }

  // Cross-store or unassigned access denied
  return null;
}
```

---

## Section 11 — Store Assignment API Design

### 11.1 API Surface Specifications

#### `GET /api/admin/assignments`
* **Auth:** Main Admin only.
* **SQL:**
  ```sql
  SELECT asa.id, asa.admin_user_id, au.employee_code, au.firebase_uid,
         asa.store_id, s.name as store_name, asa.created_at
  FROM admin_store_assignments asa
  JOIN admin_users au ON au.id = asa.admin_user_id
  JOIN stores s ON s.id = asa.store_id
  ORDER BY asa.created_at DESC;
  ```

#### `POST /api/admin/assignments`
* **Auth:** Main Admin only.
* **Payload:** `{ adminUserId: string, storeId: string }`.
* **Validation:**
  * `adminUserId` must exist in `admin_users` and have `is_active = true`.
  * `storeId` must exist in `stores`.
* **SQL:**
  ```sql
  INSERT INTO admin_store_assignments (id, admin_user_id, store_id, created_at)
  VALUES ($1, $2, $3, NOW())
  ON CONFLICT (admin_user_id, store_id) DO NOTHING;
  ```

#### `DELETE /api/admin/assignments/[id]`
* **Auth:** Main Admin only.
* **SQL:** `DELETE FROM admin_store_assignments WHERE id = $1`.

---

## Section 12 — Developer Location Protection

### 12.1 Security Model for Coordinate Changes
Store latitude and longitude represent permanent physical fulfillment nodes. An incorrect coordinate change breaks Haversine geofences, halts orders, or routes deliveries to wrong zones.

#### Security Architecture Rules:
1. **No Browser Reusable Secret:** No reusable developer secret is ever sent as a normal browser credential, bundled into client-side JavaScript, or stored in localStorage/sessionStorage/cookies.
2. **Server-Controlled Two-Step Authorization Flow:**
   * **Step 1: Request Challenge:** Admin initiates relocation request specifying new coordinates. Server issues a short-lived, single-use, cryptographically signed authorization challenge tied strictly to `(storeId, newLatitude, newLongitude)`.
   * **Step 2: Authorize & Mutate:** An authorized developer provides approval through a server-controlled mechanism. The server validates challenge signature, single-use state, and coordinate matching before mutating the database.
3. **Immutability of Operational Boundaries:** Normal `PATCH /api/admin/stores/[id]` strictly rejects coordinates. The location-change flow permits altering *only* latitude and longitude; it cannot mutate radius, pricing, or hours.
4. **Audit Logging:** Every successful change records an immutable entry in PostgreSQL `audit_logs`.

### 12.2 Request & Authorization Flow
```
Store Admin / Main Admin
        │
        │ 1. Requests location change
        ▼
POST /api/admin/stores/[id]/location/request
        │
        │ Server validates:
        │ - Authenticated admin session
        │ - Store access permissions
        │ - Coordinate format (-90..90, -180..180)
        ▼
Server creates short-lived, single-use authorization challenge
(HMAC-signed payload: { storeId, targetLat, targetLng, nonce, exp: 10m })
        │
        │ 2. Developer authorization occurs via server-controlled mechanism
        ▼
POST /api/admin/stores/[id]/location/authorize
        │
        │ Server validates:
        │ - Developer authorization signature / token
        │ - Challenge validity & expiry (< 10 mins)
        │ - Single-use nonce verification
        │ - Coordinates exactly match challenged coordinates
        ▼
PostgreSQL Transaction:
        │
        ├── 1. Lock and update stores:
        │      UPDATE stores SET latitude = $newLat, longitude = $newLng, updated_at = NOW() WHERE id = $id;
        │
        └── 2. Insert audit_logs entry:
               INSERT INTO audit_logs (id, firebase_uid, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent, created_at)
               VALUES ($uuid, $actorId, 'STORE_LOCATION_MODIFIED', 'STORE', $id,
                       jsonb_build_object('latitude', $oldLat, 'longitude', $oldLng),
                       jsonb_build_object('latitude', $newLat, 'longitude', $newLng, 'reason', $reason),
                       $ip, $userAgent, NOW());
        │
        ▼
Success (HTTP 200)
```

---

## Section 13 — Store Deletion Safety Design

### 13.1 The 4 Mandatory Safety Gates
Before deactivating a store record, the backend must execute verification queries:

```
[Store Deactivation Request]
          │
          ▼
Gate 1: Pending Orders Check
SELECT COUNT(*) FROM orders 
WHERE store_id = $1 AND order_status NOT IN ('DELIVERED', 'COMPLETED', 'CANCELLED', 'PAYMENT_FAILED');
[Fail if count > 0]
          │
          ▼
Gate 2: Active Inventory Balances Check
SELECT COUNT(*) FROM inventory_balances 
WHERE store_id = $1 AND available_stock > 0;
[Fail if active stock > 0 without explicit liquidation]
          │
          ▼
Gate 3: Active Stock Reservations Check
SELECT COUNT(*) FROM stock_reservations 
WHERE store_id = $1 AND status = 'ACTIVE';
[Fail if count > 0]
          │
          ▼
Gate 4: Blocking Database Dependencies Check
SELECT COUNT(*) FROM picking_tasks pt 
JOIN orders o ON o.id = pt.order_id 
WHERE o.store_id = $1 AND pt.status IN ('pending', 'in_progress');
[Fail if open warehouse tasks exist]
          │
          ▼
[All Gates Passed: Soft Deactivate Store]
UPDATE stores SET is_active = false, updated_at = NOW() WHERE id = $1;
```

---

## Section 14 — Firebase / Cloud Functions Strategy

### 14.1 Infrastructure Constraints & Strategy
* **Zero Infrastructure Additions:** Phase 2.7C does **NOT** introduce PostgreSQL read replicas, VPC peering, or new database infrastructure.
* **Clear Authority Hierarchy:**
  ```text
  Cloud Functions
      ↓
  DEPRECATED / TRANSITIONAL ONLY

  Next.js API
      ↓
  AUTHORITATIVE

  PostgreSQL stores
      ↓
  CANONICAL BUSINESS CONFIGURATION
  ```
* **Strategy per Component:**

| Component | Current Implementation | Target Implementation | Recommendation |
| :--- | :--- | :--- | :---: |
| **`functions/src/inventory/validateDeliveryZone.ts`** | Evaluates Haversine distance against Firestore `settings/store` document. | Mark as **DEPRECATED**. Migrate customer address setup in `customer-app/app/setup-address/page.tsx` to call Next.js API `/api/serviceability/check` directly, ensuring direct access to PostgreSQL canonical store settings. | **DEPRECATED** |
| **`functions/src/utils.ts:101–112`** | Fallback store config sets `minimumOrderValue: 99`, `deliveryFee: 25`, `freeDeliveryThreshold: 299`. | Document that this fallback is **transitional/deprecated compatibility code ONLY**, not authoritative business configuration. Do NOT introduce global business defaults (such as universal ₹29 or ₹499) into Cloud Functions. | **TRANSITIONAL COMPATIBILITY ONLY** |
| **`lib/firebaseServices.ts:1250–1356`** | Directly updates Firestore `shops` collection. | Remove administrative write operations. Keep Firestore as an optional real-time push consumer only. | **DEPRECATE WRITES** |

---

## Section 15 — Frontend Strategy

### 15.1 Store-Specific Threshold & Server Authority
1. **Dynamic Store Configuration Delivery:**
   * When a customer selects an address, the frontend calls `GET /api/serviceability/check?lat={lat}&lng={lng}`.
   * The API returns the resolved store object containing `freeDeliveryEnabled`, `freeDeliveryThreshold` (for existing stores, this is currently ₹499), and `deliveryFee` (for existing stores, this is currently ₹29).
2. **Frontend Display Responsibilities:**
   * Uses `selectedStore.freeDeliveryThreshold` for the cart drawer progress bar: `"Add ₹{selectedStore.freeDeliveryThreshold - subtotal} more to get free delivery"`.
   * Displays `tax = 0` (removes tax row from summary).
   * Displays estimated delivery charge using the selected store's rules with 2-decimal precision.
3. **No Frontend Authority:**
   * The frontend display is strictly an estimate. When checkout is initiated, the server computes binding values.

---

## Section 16 — Mobile Strategy

### 16.1 Native Architecture Preservation
In accordance with mandatory constraints, the native Capacitor shell, push plugins, and native plugins are **untouched**. Only customer-app Next.js presentation code is updated:

1. **Tax Removal:** In `customer-app/app/checkout/page.tsx:92` and `customer-app/app/cart/page.tsx:65`:
   * Set `const tax = 0;`.
   * Remove "Govt. Taxes & GST" line items.
2. **Threshold Display:** Update free delivery progress bar to read `selectedStore.freeDeliveryThreshold` (using ₹499 solely as temporary UI display fallback while loading).
3. **Zero Minimum Order:** Remove any UI warning preventing checkout if cart $< \text{₹}199$.
4. **Serviceability Migration:** In `customer-app/app/setup-address/page.tsx`, migrate the serviceability check from the deprecated Cloud Function to `/api/serviceability/check`.

---

## Section 17 — Test Design

### 17.1 Test Matrix for Phase 2.8

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   PHASE 2.8 TEST AUTOMATION SUITE                        │
├──────────────────────────┬───────────────────────────┬───────────────────┤
│ Test Domain              │ Test Scenario             │ Expected Verdict  │
├──────────────────────────┼───────────────────────────┼───────────────────┤
│ 1. Serviceability        │ 2.9 km on 3 km store      │ Serviceable (true)│
│                          │ 3.0 km on 3 km store      │ Serviceable (true)│
│                          │ 3.1 km on 3 km store      │ OUT_OF_SERVICE_AREA│
│                          │ 3.9 km on 4 km store      │ Serviceable (true)│
│                          │ 4.9 km on 5 km store      │ Serviceable (true)│
│                          │ 4.1 km straight / 5.5 road│ Serviceable (true)│
│                          │ (Verifies NO road cutoff) │                   │
├──────────────────────────┼───────────────────────────┼───────────────────┤
│ 2. Minimum Order         │ Subtotal = ₹0.00          │ NO min order error│
│                          │ Subtotal = ₹1.00          │ NO min order error│
│                          │ Subtotal = ₹50.00         │ NO min order error│
├──────────────────────────┼───────────────────────────┼───────────────────┤
│ 3. GST / Tax             │ Subtotal ₹100, no coupon  │ Tax = ₹0, Total=Fee│
│                          │ Subtotal ₹600, free deliv │ Tax = ₹0, Total600│
│                          │ Database snapshot check   │ orders.tax_amount=0│
├──────────────────────────┼───────────────────────────┼───────────────────┤
│ 4. Free Delivery & Tiers │ Free enabled, met thresh  │ delivery_fee = ₹0 │
│                          │ Free enabled, below thresh│ delivery_fee = fee│
│                          │ Free disabled, met thresh │ delivery_fee = fee│
│                          │ Empty tiers array ([])    │ delivery_fee = fee│
│                          │ Valid tiered match        │ fee = tier.fee    │
│                          │ 2-decimal fee (12.50)     │ fee = 12.50       │
├──────────────────────────┼───────────────────────────┼───────────────────┤
│ 5. Multi-Store RBAC      │ Main Admin accesses both  │ HTTP 200          │
│                          │ Store Admin -> assigned   │ HTTP 200          │
│                          │ Store Admin -> unassigned │ HTTP 403 Forbidden│
│                          │ Inactive Admin User       │ HTTP 401/403      │
├──────────────────────────┼───────────────────────────┼───────────────────┤
│ 6. Coordinate Protection │ Normal admin changes coords│ HTTP 403 Forbidden│
│                          │ Two-step developer auth   │ HTTP 200 + Audit  │
├──────────────────────────┼───────────────────────────┼───────────────────┤
│ 7. Store Deletion Safety │ Store has pending order   │ HTTP 409 Conflict │
│                          │ Store has active inventory│ HTTP 409 Conflict │
│                          │ Store clean & idle        │ HTTP 200 (Soft-del│
└──────────────────────────┴───────────────────────────┴───────────────────┘
```

---

## Section 18 — Implementation Sequence

The implementation is broken down into 11 strict, risk-mitigated sub-stages:

```
2.7B.1: Core Backend Serviceability Refactoring (lib/serverServiceability.ts)
   │
   ▼
2.7B.2: Authoritative Checkout Pricing & Tax Removal (app/api/checkout/route.ts)
   │
   ▼
2.7B.3: Secondary API Alignment & Deprecation (/api/serviceability/check, quote, validate)
   │
   ▼
2.7B.4: Admin Store API Implementation (app/api/admin/stores/**)
   │
   ▼
2.7B.5: RBAC & Store Assignment API Implementation (lib/routeAuth.ts, /api/admin/assignments)
   │
   ▼
2.7B.6: Developer Store Location Protection (/api/admin/stores/[id]/location/request & authorize)
   │
   ▼
2.7B.7: Frontend Customer Web Alignment (CartDrawer, checkout/page.tsx, freeDelivery.ts)
   │
   ▼
2.7B.8: Mobile Application Presentation Alignment (customer-app/cart, checkout)
   │
   ▼
2.7B.9: Cloud Functions Deprecation & Transitional Compatibility Documentation (functions/)
   │
   ▼
2.7B.10: Test Suite Modernization (server-serviceability.test, checkout-total-state.test)
   │
   ▼
2.7B.11: End-to-End Build & Operational Verification (npm test, npm run build)
```

---

## Section 19 — File-by-File Implementation Contract

| File | Action | Exact Change | Risk | Associated Tests | Phase |
| :--- | :---: | :--- | :---: | :--- | :---: |
| `lib/serverServiceability.ts` | **MODIFY** | Remove road multiplier, remove min order check, support `free_delivery_enabled` and `delivery_fee_tiers` with 2-decimal precision | High | `test/server-serviceability.test.ts` | 2.7C.1 |
| `app/api/checkout/route.ts` | **MODIFY** | Set `tax = 0`, persist `tax_amount = 0`, resolve tiered fee with 2-decimal precision | Critical | `test/checkout-total-state.test.ts` | 2.7C.2 |
| `app/api/serviceability/check/route.ts` | **MODIFY** | Query PostgreSQL `stores` table via `evaluateServerServiceability` | Medium | New serviceability integration test | 2.7C.3 |
| `app/api/checkout/quote/route.ts` | **MODIFY** | Set tax = 0, update delivery charge resolution | Low | Quote route test | 2.7C.3 |
| `app/api/checkout/validate/route.ts` | **MODIFY** | Wrap `evaluateServerServiceability`, mark deprecated | Low | Validation test | 2.7C.3 |
| `app/api/checkout/validate-serviceability/route.ts` | **MODIFY** | Wrap `evaluateServerServiceability`, mark deprecated | Low | Validation test | 2.7C.3 |
| `lib/freeDelivery.ts` | **MODIFY** | Parameterize threshold; use 499 solely as temporary UI fallback | Medium | `test/free-delivery-progress.test.ts` | 2.7C.7 |
| `lib/pricingEngine.ts` | **MODIFY** | Set taxAmount = 0, parameterize threshold | Medium | Pricing engine tests | 2.7C.7 |
| `lib/store.ts` | **MODIFY** | In `placeOrder`: set fallback tax to 0, dynamic store threshold | High | `test/checkout-total-state.test.ts` | 2.7C.7 |
| `lib/storeOperationsService.ts` | **MODIFY** | Parameterize by storeId, read hours & radius from PostgreSQL | Medium | Darkstore operations test | 2.7C.4 |
| `lib/routeAuth.ts` | **MODIFY** | Add `requireStoreAccess(req, storeId)` checking `admin_store_assignments` | High | Admin RBAC test | 2.7C.5 |
| `app/api/admin/stores/route.ts` | **MODIFY** | Connect GET to PostgreSQL; add POST for store registration | High | Store admin test | 2.7C.4 |
| `app/api/admin/stores/[id]/route.ts` | **MODIFY** | Connect GET/PATCH to PostgreSQL; lock coordinates; add DELETE gates using `is_active` | High | Store admin test | 2.7C.4 |
| `app/api/admin/assignments/route.ts` | **CREATE** | Implement GET and POST for `admin_store_assignments` | Medium | Assignment test | 2.7C.5 |
| `app/api/admin/assignments/[id]/route.ts`| **CREATE** | Implement DELETE for assignments | Medium | Assignment test | 2.7C.5 |
| `app/api/admin/stores/[id]/location/request/route.ts`| **CREATE** | Initiate location challenge flow | High | Coordinate audit test | 2.7C.6 |
| `app/api/admin/stores/[id]/location/authorize/route.ts`| **CREATE** | Authorize location challenge & mutate coordinates in PostgreSQL with audit log | High | Coordinate audit test | 2.7C.6 |
| `components/customer/CartDrawer.tsx` | **MODIFY** | Remove tax UI, set tax = 0, dynamic threshold | High | Cart UI visual test | 2.7C.7 |
| `app/checkout/page.tsx` | **MODIFY** | Remove tax line, set tax = 0 | High | Checkout UI visual test | 2.7C.7 |
| `customer-app/app/checkout/page.tsx` | **MODIFY** | Remove tax line, set tax = 0 | Medium | Mobile visual test | 2.7C.8 |
| `customer-app/app/cart/page.tsx` | **MODIFY** | Remove tax line, set tax = 0 | Medium | Mobile visual test | 2.7C.8 |
| `customer-app/app/setup-address/page.tsx` | **MODIFY** | Migrate serviceability check from Cloud Function to `/api/serviceability/check` | Medium | Address setup test | 2.7C.8 |
| `functions/src/utils.ts` | **DEPRECATE / TRANSITIONAL** | Document transitional status; do not assign global business fallbacks | Low | Functions unit test | 2.7C.9 |
| `functions/src/inventory/validateDeliveryZone.ts` | **DEPRECATE** | Deprecate in favor of Next.js serviceability API | Low | None | 2.7C.9 |
| `test/server-serviceability.test.ts` | **MODIFY** | Remove road cutoff & min order assertions; add tiered fee tests with decimal precision | High | Vitest suite | 2.7C.10 |
| `test/checkout-total-state.test.ts` | **MODIFY** | Update assertions to expect `tax = 0` and total = subtotal + fee | High | Vitest suite | 2.7C.10 |
| `test/free-delivery-progress.test.ts` | **MODIFY** | Update expected threshold to store-specific configuration | Medium | Vitest suite | 2.7C.10 |

---

## Section 20 — Database Impact

### Confirmation Statement
**NO DATABASE MIGRATION REQUIRED FOR PHASE 2.7B DESIGN.**

### Architectural Rationale
Migration 002 (executed in Phase 2.6) successfully created all required schema structures:
1. `stores.free_delivery_enabled` (`BOOLEAN NOT NULL DEFAULT true`)
2. `stores.delivery_fee_tiers` (`JSONB NOT NULL DEFAULT '[]'::jsonb`)
3. `stores.minimum_order_value` (retired in-place to `0.00`)
4. `stores.delivery_radius_km` constraint (`CHECK (delivery_radius_km IN (3.00, 4.00, 5.00))`)
5. `admin_store_assignments` table with foreign keys to `admin_users(id)` and `stores(id)`
6. `audit_logs` table with `old_data JSONB` and `new_data JSONB` fields
7. Store deactivation utilizes the existing `stores.is_active` boolean. No unapproved `deleted_at` column is required, completely avoiding the need for a Migration 003.

Every functional requirement in Phase 2.7 is 100% achievable within the active database schema.

---

## Section 21 — Security Threat Model

| Attack Surface | Current Vulnerability | Target Security Control | Implementation Requirement |
| :--- | :--- | :--- | :--- |
| **Manipulated Delivery Fee / Tax** | Client could send `tax: 0` or custom `deliveryFee` in legacy endpoints. | Authoritative server calculation in `POST /api/checkout`. | Completely ignore client-supplied pricing fields in request payload. |
| **Bypassing Serviceability** | Calling secondary endpoints (`/validate`) that rely on mock arrays. | Secondary endpoints wrap `evaluateServerServiceability` or are deprecated. | Route all serviceability decisions through PostgreSQL Haversine engine. |
| **Cross-Store Store Admin Mutation** | `lib/routeAuth.ts` checks only role name, allowing Store Admin of Store A to edit Store B. | `requireStoreAccess(req, storeId)` validates `admin_store_assignments`. | Enforce store assignment check in all `/api/admin/store**` handlers. |
| **Unauthorized Store Relocation** | Admin UI can edit latitude/longitude in forms. | Two-step server-controlled authorization challenge flow. | Require server-validated, single-use, short-lived developer authorization; log old/new coords to `audit_logs`. |
| **Client-Forced Delivery Radius** | Client could request 10 km delivery radius. | Check constraint `check_store_delivery_radius` on PostgreSQL. | Reject invalid radius at API layer; DB constraint acts as hard backstop. |

---

## Section 22 — Backward Compatibility

1. **Existing 53 Orders:** Orders table schema is untouched. Historical orders retain their original `subtotal`, `delivery_fee`, and `store_id` (including `store-001`, `store_primary`, `store_central_001`, and legacy nulls).
2. **Legacy `store-001` Store Alias:** `getStoreOperationalSettings` maintains alias matching `WHERE id = $1 OR UPPER(code) = UPPER($1)`. `store-001` automatically resolves to `store_primary` (`STORE-001`).
3. **Preservation of Frozen Systems:**
   * **PhonePe PG:** Unchanged. Flow consumes authoritative `total_amount` generated by checkout.
   * **Inventory & FEFO:** Row locks (`FOR UPDATE`) and batch allocation algorithm remain untouched.
   * **Transactional Outbox:** Continues to record and poll `order.created` events.
   * **Firebase Auth & FCM:** Auth token verification and push notifications are completely preserved.

---

## Section 23 — Risk Register

| Risk Level | Risk Description | Root Cause | Mitigation Strategy |
| :---: | :--- | :--- | :--- |
| **CRITICAL** | Test suite failures on first edit pass | Setting `tax = 0` will fail existing test assertions expecting 5% GST. | Refactor test assertions in `test/checkout-total-state.test.ts` concurrently in Phase 2.7C.10. |
| **HIGH** | Serviceability false positives/negatives | Transition from road distance to straight-line Haversine. | Run automated boundary tests at 2.9, 3.0, 3.1 km across all 3 radius tiers. |
| **HIGH** | Disruption of store management UI | Switching admin pages from in-memory/Firestore to PostgreSQL. | Implement PostgreSQL admin routes first; verify responses before wiring UI forms. |
| **MEDIUM** | Free delivery threshold display mismatch | Hardcoded UI constants vs store-specific PostgreSQL value. | Ensure frontend displays threshold dynamically from store config API. |
| **LOW** | Deprecated endpoint traffic | Mobile or cached clients calling `/api/checkout/validate`. | Wrap `evaluateServerServiceability` inside legacy routes to return valid structures. |

---

## Section 24 — Final Implementation Checklist

### Core Backend & Checkout
- [ ] DESIGN ONLY: Refactor `lib/serverServiceability.ts` to straight-line Haversine only
- [ ] DESIGN ONLY: Remove road distance multiplier and 4.5 km limit
- [ ] DESIGN ONLY: Remove `MINIMUM_ORDER_VALUE_NOT_MET` validation branch
- [ ] DESIGN ONLY: Implement `resolveDeliveryFee` supporting store-specific threshold, `free_delivery_enabled`, and `delivery_fee_tiers` schema with 2-decimal precision
- [ ] DESIGN ONLY: Update `app/api/checkout/route.ts` to set `tax = 0` and persist `tax_amount = 0`
- [ ] DESIGN ONLY: Update total calculation in checkout route: `subtotal - discount + deliveryFee`

### Secondary APIs
- [ ] DESIGN ONLY: Refactor `app/api/serviceability/check/route.ts` to query PostgreSQL `stores`
- [ ] DESIGN ONLY: Refactor `app/api/checkout/quote/route.ts` to tax = 0 and canonical delivery fee
- [ ] DESIGN ONLY: Refactor `app/api/checkout/validate/route.ts` to wrap `evaluateServerServiceability`
- [ ] DESIGN ONLY: Refactor `app/api/checkout/validate-serviceability/route.ts` to wrap `evaluateServerServiceability`

### Admin Store & RBAC APIs
- [ ] DESIGN ONLY: Implement `requireStoreAccess(req, storeId)` in `lib/routeAuth.ts`
- [ ] DESIGN ONLY: Refactor `app/api/admin/stores/route.ts` to read PostgreSQL; add registration `POST`
- [ ] DESIGN ONLY: Refactor `app/api/admin/stores/[id]/route.ts` to update PostgreSQL; lock coordinates
- [ ] DESIGN ONLY: Implement 4 safety gates in store `DELETE` handler (using `is_active = false`)
- [ ] DESIGN ONLY: Create `app/api/admin/assignments/route.ts` and `[id]/route.ts`
- [ ] DESIGN ONLY: Create two-step server-controlled location protection endpoints (`/request` and `/authorize`)

### Frontend & Mobile
- [ ] DESIGN ONLY: Update `lib/freeDelivery.ts` to accept store-specific threshold parameter (using 499 solely as temporary UI fallback)
- [ ] DESIGN ONLY: Update `lib/pricingEngine.ts` to tax = 0 and store-specific threshold
- [ ] DESIGN ONLY: Update `lib/store.ts` `placeOrder` fallback to tax = 0
- [ ] DESIGN ONLY: Update `components/customer/CartDrawer.tsx` to tax = 0 and remove GST row
- [ ] DESIGN ONLY: Update `app/checkout/page.tsx` to tax = 0 and remove GST row
- [ ] DESIGN ONLY: Update `customer-app/app/checkout/page.tsx` and `cart/page.tsx` to tax = 0
- [ ] DESIGN ONLY: Migrate `customer-app/app/setup-address/page.tsx` from Cloud Function to `/api/serviceability/check`

### Test Suite Alignment
- [ ] DESIGN ONLY: Update `test/server-serviceability.test.ts` (remove road cutoff & min order tests)
- [ ] DESIGN ONLY: Update `test/checkout-total-state.test.ts` (assert tax = 0 and new totals)
- [ ] DESIGN ONLY: Update `test/free-delivery-progress.test.ts` (assert threshold matches store config)

---

## Required Correction Verification

| Requirement | Status |
| :--- | :---: |
| Cloud Functions do not become a second business-rule authority | **PASS** |
| No global ₹29 delivery-fee business default introduced | **PASS** |
| No global ₹499 free-delivery business default introduced | **PASS** |
| No invented fee tiers | **PASS** |
| Delivery tier fees preserve 2-decimal precision | **PASS** |
| Store fallback fee preserves 2-decimal precision | **PASS** |
| Empty tier array still falls back to selected store configuration | **PASS** |
| Free delivery evaluated before fee tiers | **PASS** |
| Previous developer-authorization correction preserved | **PASS** |
| Previous new-store configuration correction preserved | **PASS** |
| No database migration required | **PASS** |

---

## Final Gate

==================================================  
### READY FOR PHASE 2.7C IMPLEMENTATION  
==================================================

---

## Safety Attestation

Explicitly verified conditions for Phase 2.7B:
* **0** Application source files modified
* **0** Database mutations executed
* **0** Migrations run
* **0** Firebase / Firestore writes
* **0** Cloud Function source modifications
* **0** Git commits created
* **0** Deployments executed
* **0** Packages installed
* **0** Production configuration changes
* **Working tree status:** 100% clean (`git diff --stat` returns 0 changes)

**Status:** STOPPED. Awaiting explicit user command before entering **Phase 2.7C Implementation**.
