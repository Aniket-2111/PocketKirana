# Phase 2.7C.5 — Repository-Wide Business-Rule Authority Scan Report

**Document ID:** `PHASE_2_7C_5_BUSINESS_RULE_AUTHORITY_SCAN.md`  
**Execution Mode:** STRICTLY AUDIT ONLY — NO CODE CHANGES, NO DB MUTATIONS, NO COMMITS  
**Scan Timestamp:** 2026-10-02T17:25:00+05:30  
**Repository:** `PocketKirana`  
**Base Commit:** `63dba5363579334b67e4ac9a401d94060be244bf`  
**Authoritative Backend:** PostgreSQL `stores` table + `lib/serverServiceability.ts` (`evaluateServerServiceability`, `resolveDeliveryFee`)  

---

## 1. Executive Summary

Phase 2.7C.1 through 2.7C.4 successfully canonicalized the backend evaluation engine (`lib/serverServiceability.ts`), the public serviceability route (`/api/serviceability/check`), the canonical order creation pipeline (`POST /api/checkout`), and established zero caller dependency on legacy checkout validation routes (`/api/checkout/validate` and `/api/checkout/validate-serviceability`).

However, this repository-wide forensic audit proves that **competing business-rule authorities still actively intercept and block production user journeys before they ever reach the canonical backend.**

Specifically:
1. **Active Client Checkout Blockers:** `customer-app/app/checkout/page.tsx` (Lines 152–166) contains an inline Haversine pre-check using hardcoded store coordinates `(19.0224536, 73.3210018)` and an arbitrary `4.5 KM` radius cutoff combined with hardcoded pincode/text matching (`410101`, `"neral"`). Any order exceeding 4.5 km is terminated client-side with an error toast and never reaches `POST /api/checkout`.
2. **Active Legacy Zone Blocking in Customer Checkout:** `app/checkout/page.tsx` (Lines 204–207) invokes `checkZoneServiceability` from `lib/locationServices.ts` right before calling `/api/checkout`. If `checkZoneServiceability` evaluates `isServiceable: false` (utilizing in-memory `STORES_STATE`, 1.35× road multiplier, and 1.4× road radius limits), the order submission is aborted client-side.
3. **Active Address Onboarding Interception:** `customer-app/app/setup-address/page.tsx` (Lines 112, 130–135) calls `validateDeliveryZoneServerSide()`, which calls the Firebase Cloud Function `validateDeliveryZone` (backed by Firestore `settings/store`), falling back to hardcoded Maule Kirana coordinates and a 4.5 km radius. If deemed unserviceable, the user is redirected to `/not-serviceable` and prevented from saving or using the delivery address.
4. **Active Address Selection Blocking:** `components/customer/LocationPickerModal.tsx` (Lines 521–527) executes `checkZoneServiceability(addr.latitude, addr.longitude)` on saved addresses and explicitly disables click-selection (`onClick={() => addrServiceable && handleSelectSaved(addr)}`), rendering addresses unselectable based on non-canonical rules.
5. **Secondary Order Creation Shadow Path:** `app/checkout/page.tsx` (Lines 268–280) contains a silent fallback `callPlaceOrder` that calls the Firebase Cloud Function `placeOrder` if the direct call to `/api/checkout` encounters a network/runtime exception. `placeOrder` in Cloud Functions is backed by Firestore and enforces hardcoded `minimumOrderValue` and legacy fee rules.

**Final Scan Verdict:** **RED** (Active competing production authorities exist in client-side checkout gates, address validation, and fallback order pipelines).

---

## 2. Authority Map

| Business Rule | Canonical Authority | Active Competing Authority? | Status | Summary of Conflict |
| :--- | :--- | :--- | :--- | :--- |
| **1. Service Radius** | PostgreSQL `stores.delivery_radius_km` via `evaluateServerServiceability` | **YES (ACTIVE)** | **COMPETING** | `customer-app/app/checkout/page.tsx` enforces hardcoded 4.5 km; `setup-address/page.tsx` enforces 3.0 km / 4.5 km via Cloud Function & fallback; `lib/locationServices.ts` defaults to 3.0 km. |
| **2. Delivery Fee** | PostgreSQL `stores.delivery_fee` & `stores.delivery_fee_tiers` via `resolveDeliveryFee` | **YES (DISPLAY / SHADOW)** | **COMPETING** | `lib/freeDelivery.ts` hardcodes ₹29; `lib/locationServices.ts` hardcodes ₹15; Cloud Function `placeOrder` reads Firestore; `app/checkout/page.tsx` displays client fee before canonical order total. |
| **3. Free Delivery Threshold** | PostgreSQL `stores.free_delivery_enabled` & `stores.free_delivery_threshold` via `resolveDeliveryFee` | **YES (DISPLAY / SHADOW)** | **DESYNCHRONIZED** | PostgreSQL configured to `₹499.00`; `lib/freeDelivery.ts` hardcodes `₹500`; `functions/src/utils.ts` fallback hardcodes `₹299`; `recommendationsEngine.ts` defaults to `₹499`. |
| **4. Minimum Order Requirement** | PostgreSQL `stores` — Canonical rule is **NO minimum order** (`0.00`) | **YES (SHADOW PATH)** | **COMPETING** | Backend correctly retired to `0.00`; however, Cloud Function `placeOrder.ts` line 180 rejects orders if `subtotal < config.minimumOrderValue` (Firestore/default ₹99). |
| **5. Road-Distance Multipliers & Limits** | **RETIRED / NON-AUTHORITATIVE** (Straight-line Haversine only) | **YES (ACTIVE CLIENT PRE-CHECK)** | **COMPETING** | `lib/locationServices.ts` line 730 calculates `straightLineDistanceKm * 1.35` and rejects if `> radiusKm * 1.4`. Invoked by `app/checkout/page.tsx` and `LocationPickerModal.tsx`. |
| **6. Store Coordinates** | PostgreSQL `stores.latitude`, `stores.longitude` | **YES (ACTIVE HARDCODED PRE-CHECKS)** | **COMPETING** | Hardcoded `(19.0224536, 73.3210018)` in `customer-app/app/checkout/page.tsx:154`, `lib/locationServices.ts:55,920`, `functions/src/utils.ts:13`. |
| **7. Store Selection & Fallback** | PostgreSQL `stores.id` or `stores.code` (`store-001` → `store_primary`); fails closed if not found | **YES (ACTIVE CLIENT / LOCAL STATE)** | **COMPETING** | Frontend hardcodes `'store-001'` in checkout payloads; `lib/locationServices.ts` falls back to `INITIAL_STORES[0]` (`'store-1'`); `LocationPickerModal` uses Firestore shop sync. |
| **8. Store Operating Hours** | PostgreSQL `stores.opening_time`, `stores.closing_time` via `isStoreWithinHours` | **YES (DISPLAY / IN-MEMORY)** | **COMPETING** | `lib/locationServices.ts:666` runs client-side `isStoreCurrentlyOpen`; `lib/storeOperationsService.ts:74` hardcodes `06:00` - `23:30`. |
| **9. Store Active / Inactive Status** | PostgreSQL `stores.is_active` | **YES (IN-MEMORY / FIRESTORE)** | **COMPETING** | `lib/locationServices.ts` filters `STORES_STATE` by `status === 'active'`; Cloud Functions check Firestore `settings/store.isOpen`. |
| **10. Delivery Eligibility & Serviceability** | PostgreSQL + `evaluateServerServiceability` | **YES (ACTIVE CLIENT BLOCKERS)** | **COMPETING** | Client-side filters abort before calling `/api/checkout` if client distance > 4.5 km or `checkZoneServiceability` returns false. |

---

## 3. Comprehensive Findings Inventory

### Classification Legend
* **A. CANONICAL:** Correctly delegates to approved PostgreSQL / server-side serviceability evaluator.
* **B. NON-AUTHORITATIVE DISPLAY:** UI display or telemetry only; does not independently decide eligibility or pricing.
* **C. TECHNICAL CONSTANT:** Used for technical typing, rate limits, or non-business operations.
* **D. TEST / MOCK / FIXTURE:** Test suites, mocks, fixtures, and local seeds.
* **E. DEPRECATED / UNREACHABLE:** Legacy code with zero active production callers.
* **F. ACTIVE COMPETING AUTHORITY:** Independently decides business rules that actively affect production behavior.
* **G. UNKNOWN / REQUIRES REVIEW:** Cannot prove behavior through static analysis alone.

---

### Finding F-01: Hardcoded Distance & Radius Pre-Check in Customer Checkout
* **File:** [customer-app/app/checkout/page.tsx](file:///d:/pocketkirana/customer-app/app/checkout/page.tsx#L152-L166) (Lines 152–166)
* **Rule:** Service Radius, Store Coordinates, Geographic Eligibility
* **Classification:** **F. ACTIVE COMPETING AUTHORITY**
* **Code:**
  ```typescript
  if (selectedAddr && typeof selectedAddr.latitude === 'number' && typeof selectedAddr.longitude === 'number') {
    const { calculateDistanceKm } = await import('@/lib/locationServices');
    const dist = calculateDistanceKm(19.0224536, 73.3210018, selectedAddr.latitude, selectedAddr.longitude);
    const isNeralPincode = selectedAddr.postalCode === '410101' || 
      (selectedAddr.city && selectedAddr.city.toLowerCase().includes('neral')) ||
      (selectedAddr.addressLine1 && selectedAddr.addressLine1.toLowerCase().includes('neral'));

    if (dist > 4.5 && !isNeralPincode) {
      showToast(`Outside delivery area: Selected address is ${dist.toFixed(1)} KM from Maule Kirana in Neral (Max radius: 4.5 KM)`, 'error');
      setBtnState('idle');
      isSubmittingRef.current = false;
      setFrozenSnapshot(null);
      return;
    }
  }
  ```
* **Active Caller / Path:** Customer checkout submission flow in `customer-app`.
* **Production Impact:** If a customer's address is 4.6 km away, this client check triggers a toast error and returns immediately, preventing the request from ever reaching `POST /api/checkout`. If the PostgreSQL store config allows 5.0 km, the customer is falsely rejected. If the customer is 4.4 km away but the PostgreSQL store radius is 3.0 km, this check passes and gives false hope until the server rejects it.
* **Recommendation:** (Do NOT implement in C.5) Remove this client-side pre-check; rely exclusively on `POST /api/checkout` or call `GET /api/serviceability/check`.

---

### Finding F-02: Client-Side `checkZoneServiceability` Submission Blocker
* **File:** [app/checkout/page.tsx](file:///d:/pocketkirana/app/checkout/page.tsx#L204-L207) (Lines 204–207)
* **Rule:** Serviceability, Road Multipliers, Store Selection
* **Classification:** **F. ACTIVE COMPETING AUTHORITY**
* **Code:**
  ```typescript
  const zone = checkZoneServiceability(deliveryAddress.latitude, deliveryAddress.longitude, deliveryAddress.pincode);
  if (!zone.isServiceable) {
    showToast(zone.unserviceableReason || 'Selected address is outside our delivery zone.', 'error');
    setSubmitting(false);
    return;
  }
  ```
* **Active Caller / Path:** Web customer checkout submission flow (`handlePlaceOrder`).
* **Production Impact:** Evaluates serviceability using in-memory `STORES_STATE` from `lib/locationServices.ts` which uses a 1.35× road multiplier and 1.4× road distance cutoff. If `zone.isServiceable` is false, it aborts order placement client-side and never calls `/api/checkout`.
* **Recommendation:** (Do NOT implement in C.5) Replace client-side `checkZoneServiceability` invocation with the canonical `/api/serviceability/check` endpoint or eliminate the pre-check entirely in favor of `POST /api/checkout`.

---

### Finding F-03: Address Onboarding Interception via Cloud Function / Fallback
* **File:** [customer-app/app/setup-address/page.tsx](file:///d:/pocketkirana/customer-app/app/setup-address/page.tsx#L112-L135) (Lines 112, 130–135)
* **Rule:** Serviceability, Service Radius, Store Coordinates
* **Classification:** **F. ACTIVE COMPETING AUTHORITY**
* **Code:**
  ```typescript
  const [zoneResult, geoDisplay] = await Promise.all([
    validateDeliveryZoneServerSide(latitude, longitude),
    ...
  ]);
  ...
  if (!zoneResult.isServiceable) {
    setStatusMessage('Location is outside our 3 KM delivery radius in Neral.');
    setTimeout(() => {
      router.replace(`/not-serviceable?dist=${zoneResult.distanceKm}&lat=${latitude}&lon=${longitude}`);
    }, 300);
    return;
  }
  ```
* **Active Caller / Path:** Address confirmation flow in `customer-app/app/setup-address`.
* **Production Impact:** Calls `validateDeliveryZoneServerSide` (`lib/locationServices.ts:868`), which calls Firebase Cloud Function `validateDeliveryZone` (Firestore-backed) with a local fallback to 4.5 km and Maule Kirana coordinates. If marked unserviceable, user is forcibly routed to `/not-serviceable`, preventing address saving.
* **Recommendation:** (Do NOT implement in C.5) Route address serviceability checks to canonical `GET /api/serviceability/check`.

---

### Finding F-04: Saved Address Selection Blocker in `LocationPickerModal`
* **File:** [components/customer/LocationPickerModal.tsx](file:///d:/pocketkirana/components/customer/LocationPickerModal.tsx#L521-L527) (Lines 521–527)
* **Rule:** Serviceability, Geographic Eligibility
* **Classification:** **F. ACTIVE COMPETING AUTHORITY**
* **Code:**
  ```typescript
  const addrZone = checkZoneServiceability(addr.latitude, addr.longitude);
  const addrServiceable = addrZone.isServiceable;
  ...
  onClick={() => addrServiceable && handleSelectSaved(addr)}
  ```
* **Active Caller / Path:** Customer address picker modal in web application.
* **Production Impact:** Renders addresses unclickable if `checkZoneServiceability` (in-memory, 1.35× road multiplier) evaluates to false, blocking users from choosing valid locations configured in PostgreSQL.
* **Recommendation:** (Do NOT implement in C.5) Use canonical server serviceability check to determine address eligibility or permit selection and validate at checkout.

---

### Finding F-05: Checkout Fallback to Firestore Cloud Function `callPlaceOrder`
* **File:** [app/checkout/page.tsx](file:///d:/pocketkirana/app/checkout/page.tsx#L268-L280) (Lines 268–280)
* **Rule:** Order Creation, Delivery Fee, Minimum Order, Firestore Authority
* **Classification:** **F. ACTIVE COMPETING AUTHORITY (SHADOW PATH)**
* **Code:**
  ```typescript
  // Fallback to Cloud Function if API was not reachable
  if (!result) {
    result = await callPlaceOrder({
      cartItems: cart.map((item) => ({
        productId: item.productId || item.product?.id || item.id,
        quantity: item.quantity,
      })),
      addressId: selectedAddr.id,
      paymentMethod: selectedPayment as 'cod' | 'phonepe' | 'upi' | 'card',
      couponCode: appliedCoupon?.code,
      storeId: 'store-001',
    });
  }
  ```
* **Active Caller / Path:** `app/checkout/page.tsx` when `fetch('/api/checkout')` throws an unhandled network error or returns a non-200 unhandled payload.
* **Production Impact:** Bypasses PostgreSQL `orders` and `lib/serverServiceability.ts`, delegating order creation to `functions/src/orders/placeOrder.ts` which uses Firestore settings, calculates fees via `calculateDeliveryFee(subtotal)`, and enforces `minimumOrderValue`.
* **Recommendation:** (Do NOT implement in C.5) Remove the Cloud Function fallback from `app/checkout/page.tsx`; let failures fail closed with user-friendly retry prompts.

---

### Finding B-01: Desynchronized Free Delivery Display Threshold
* **File:** [lib/freeDelivery.ts](file:///d:/pocketkirana/lib/freeDelivery.ts#L7-L8) (Lines 7–8)
* **Rule:** Free Delivery Threshold, Delivery Fee Display
* **Classification:** **B. NON-AUTHORITATIVE DISPLAY**
* **Code:**
  ```typescript
  export const FREE_DELIVERY_THRESHOLD = 500;
  export const DEFAULT_DELIVERY_FEE = 29;
  ```
* **Active Caller / Path:** `useFreeDeliveryProgress()` in `customer-app/app/cart/page.tsx:64`, `customer-app/app/checkout/page.tsx:91`, and `app/checkout/page.tsx:120`.
* **Production Impact:** Client displays free delivery progress based on ₹500 and calculates preview fee as ₹29. However, when the order is submitted to `POST /api/checkout`, the server recalculates the fee using PostgreSQL (`free_delivery_threshold = 499.00`). If a cart is ₹499.00, the client UI tells the user to add ₹1 more, but the server actually grants free delivery!
* **Recommendation:** (Do NOT implement in C.5) Fetch free delivery threshold and fee dynamically from `/api/serviceability/check` or align the display constant to 499.

---

### Finding B-02: Hardcoded Store Operations Metrics for Admin UI
* **File:** [lib/storeOperationsService.ts](file:///d:/pocketkirana/lib/storeOperationsService.ts#L74-L76) (Lines 74–76)
* **Rule:** Operating Hours, Service Radius
* **Classification:** **B. NON-AUTHORITATIVE DISPLAY**
* **Code:**
  ```typescript
  const openingTime = '06:00';
  const closingTime = '23:30';
  const deliveryRadiusKm = 5.0;
  ```
* **Active Caller / Path:** `app/api/admin/store/operations/route.ts` and `StoreOperationsControlView.tsx`.
* **Production Impact:** Admin metrics dashboard displays hardcoded 5.0 km radius and 06:00–23:30 hours instead of reading PostgreSQL `stores` operational columns. Has zero impact on customer checkout or serviceability.
* **Recommendation:** (Do NOT implement in C.5) Update `storeOperationsService.ts` to read `delivery_radius_km`, `opening_time`, and `closing_time` from PostgreSQL `stores`.

---

### Finding B-03: Teaser Free Delivery Threshold in Recommendations Engine
* **File:** [lib/recommendationsEngine.ts](file:///d:/pocketkirana/lib/recommendationsEngine.ts#L381) (Line 381)
* **Rule:** Free Delivery Threshold
* **Classification:** **B. NON-AUTHORITATIVE DISPLAY**
* **Code:**
  ```typescript
  export function getSmartCartOffers(
    subtotal: number,
    allProducts: Product[] = [],
    freeDeliveryThreshold: number = 499,
    freeGiftThreshold: number = 500
  ): SmartCartOfferState
  ```
* **Active Caller / Path:** `components/customer/DynamicHomepageRenderer.tsx` (Line 85).
* **Production Impact:** Used to render "Smart Cart Offers" teaser banners on the customer homepage. Matches PostgreSQL `499.00`. Display only; not authoritative.
* **Recommendation:** (Do NOT implement in C.5) Accept as non-authoritative display teaser.

---

### Finding E-01: Legacy Checkout Validation Endpoints
* **Files:** [app/api/checkout/validate/route.ts](file:///d:/pocketkirana/app/api/checkout/validate/route.ts), [app/api/checkout/validate-serviceability/route.ts](file:///d:/pocketkirana/app/api/checkout/validate-serviceability/route.ts)
* **Rule:** Serviceability, Minimum Order, Road Multipliers
* **Classification:** **E. DEPRECATED / UNREACHABLE**
* **Active Caller / Path:** NONE. Verified in Phase 2.7C.4 audit to have 0 callers across the entire codebase.
* **Production Impact:** None. Cannot affect production runtime. Marked with JSDoc `@deprecated`.
* **Recommendation:** (Do NOT implement in C.5) Remove endpoints in future dead-code elimination phase.

---

### Finding E-02: Legacy Quote Route
* **File:** [app/api/checkout/quote/route.ts](file:///d:/pocketkirana/app/api/checkout/quote/route.ts#L37-L39) (Lines 37–39)
* **Rule:** Delivery Fee, Free Delivery Threshold
* **Classification:** **E. DEPRECATED / UNREACHABLE**
* **Code:**
  ```typescript
  const deliveryCharge = subtotal > 499 || subtotal === 0 ? 0 : 20;
  const tax = Math.round((subtotal - discount) * 0.05);
  ```
* **Active Caller / Path:** Only referenced in unused `services/api/index.ts:143` (`checkoutApi.getQuote`), which has 0 imports in the entire codebase.
* **Production Impact:** None. Route is dead code.
* **Recommendation:** (Do NOT implement in C.5) Mark deprecated or delete in future phase.

---

### Finding E-03: Unused Location Serviceability Route
* **File:** [app/api/location/serviceability/route.ts](file:///d:/pocketkirana/app/api/location/serviceability/route.ts#L20)
* **Rule:** Serviceability, Road Multipliers, Firestore Sync
* **Classification:** **E. DEPRECATED / UNREACHABLE**
* **Active Caller / Path:** Only referenced in unused `services/api/index.ts:83` (`locationApi.checkServiceability`), which has 0 imports.
* **Production Impact:** None. Canonical route is `/api/serviceability/check`.
* **Recommendation:** (Do NOT implement in C.5) Mark deprecated or delete in future phase.

---

### Finding E-04: Unreferenced Pricing Engine Delivery Charge
* **File:** [lib/pricingEngine.ts](file:///d:/pocketkirana/lib/pricingEngine.ts#L264) (Line 264)
* **Rule:** Delivery Fee (₹29), Free Delivery Threshold (₹500), 5% Tax
* **Classification:** **E. DEPRECATED / UNREACHABLE (TEST-ONLY CALLERS)**
* **Code:**
  ```typescript
  const deliveryCharge = taxableAmount >= FREE_DELIVERY_THRESHOLD || cartItems.length === 0 ? 0 : 29;
  const taxAmount = Math.round(taxableAmount * 0.05);
  ```
* **Active Caller / Path:** Imported only in test files (`test/transactional-red-team.test.ts`, `test/checkout-total-state.test.ts`, `test/architecture-consolidation.test.ts`). Zero production application callers.
* **Production Impact:** None.
* **Recommendation:** (Do NOT implement in C.5) Retain for test fixture compatibility until test refactoring phase.

---

### Finding D-01: Hardcoded Test & Mock Values
* **Files:**
  - `lib/mockData.ts` (Lines 977–984): `INITIAL_STORES` with `deliveryFee: 15`, `minimumOrderValue: 199`, `deliveryRadiusKm: 3.0`.
  - `test/server-serviceability.test.ts`: Various unit tests asserting store settings, 3/4/5 km boundaries, and `resolveDeliveryFee`.
* **Classification:** **D. TEST / MOCK / FIXTURE**
* **Production Impact:** None on live PostgreSQL runtime.
* **Recommendation:** (Do NOT implement in C.5) Retain as test fixtures.

---

## 4. Active Competing Authorities (Explicit List)

The repository scan has identified the following **ACTIVE COMPETING AUTHORITIES**:

1. **`customer-app/app/checkout/page.tsx:154-165`**:
   - Computes straight-line Haversine distance client-side against hardcoded coordinates `(19.0224536, 73.3210018)`.
   - Halts order placement if distance > 4.5 km and address does not contain "neral" / 410101.
   - Competes directly with PostgreSQL `stores.delivery_radius_km` and `stores.latitude`/`longitude`.
2. **`app/checkout/page.tsx:204-207`**:
   - Calls `checkZoneServiceability` from `lib/locationServices.ts` before calling `/api/checkout`.
   - Rejects order placement client-side if in-memory `STORES_STATE` (1.35× road multiplier, 1.4× road radius cutoff) evaluates `isServiceable: false`.
   - Competes directly with `lib/serverServiceability.ts`.
3. **`customer-app/app/setup-address/page.tsx:112, 130-135`**:
   - Calls `validateDeliveryZoneServerSide()`, querying Firebase Cloud Function `validateDeliveryZone` (Firestore-backed) with a 4.5 km fallback.
   - Forcibly redirects users to `/not-serviceable` and prevents them from saving serviceable addresses.
   - Competes directly with `/api/serviceability/check`.
4. **`components/customer/LocationPickerModal.tsx:521-527`**:
   - Evaluates `checkZoneServiceability` on saved customer addresses.
   - Disables click selection if `!addrZone.isServiceable`.
   - Competes directly with PostgreSQL serviceability.
5. **`app/checkout/page.tsx:268-280`**:
   - Contains a fallback execution path `callPlaceOrder` that calls Firebase Cloud Function `placeOrder`.
   - Uses Firestore store configuration and enforces `minimumOrderValue` and legacy delivery fees if `/api/checkout` fails.

---

## 5. Deprecated / Unreachable Authorities

1. **`app/api/checkout/validate/route.ts`**: Audited in Phase 2.7C.4. Zero callers. Marked `@deprecated`.
2. **`app/api/checkout/validate-serviceability/route.ts`**: Audited in Phase 2.7C.4. Zero callers. Marked `@deprecated`.
3. **`app/api/checkout/quote/route.ts`**: Implements legacy ₹20 delivery fee and 5% tax. Only referenced by `services/api/index.ts:143`, which has zero callers across the application.
4. **`app/api/location/serviceability/route.ts`**: Implements legacy zone serviceability with Firestore sync. Only referenced by `services/api/index.ts:83`, which has zero callers.
5. **`lib/pricingEngine.ts:calculateAuthoritativeCartPrice`**: Implements ₹29 fee and 5% tax. Only imported by 3 test files; 0 production callers.

---

## 6. Client Trust Findings

| Client Input Parameter | Where Provided | Server Trust Analysis | Safe / Unsafe |
| :--- | :--- | :--- | :--- |
| `deliveryFee` / `deliveryCharge` | Sent or displayed by client cart | `POST /api/checkout` completely **ignores** client fee. Resolves fee authoritatively via `resolveDeliveryFee` on PostgreSQL store. | **SAFE** |
| `distanceKm` | Client location picker | `POST /api/checkout` **recalculates** Haversine distance authoritatively using PostgreSQL store coordinates. | **SAFE** |
| `deliveryRadiusKm` / `radius` | Client location picker | `POST /api/checkout` **reads** `stores.delivery_radius_km` from PostgreSQL. Ignores client. | **SAFE** |
| `freeDeliveryThreshold` | Client cart | `POST /api/checkout` **reads** `stores.free_delivery_threshold` from PostgreSQL. Ignores client. | **SAFE** |
| `storeCoordinates` | Hardcoded in client | `POST /api/checkout` reads coordinates strictly from PostgreSQL row. | **SAFE (on server)** |
| `storeId` | Client checkout payload (`store-001`) | Server resolves `store-001` via PostgreSQL `WHERE id = $1 OR UPPER(code) = UPPER($1)`. Returns 404/400 if not found. | **SAFE** |
| `client-side serviceability gate` | `customer-app` & `app/checkout` | Client independently terminates the user flow before making a request to the server. | **UNSAFE (Client Over-Constraint)** |

---

## 7. Store Selection Findings

1. **Store Resolution in Canonical Backend:**
   - In `lib/serverServiceability.ts:214`, query is `WHERE id = $1 OR UPPER(code) = UPPER($1) LIMIT 1`.
   - Passing `'store-001'` explicitly resolves to `store_primary` (code `STORE-001`).
   - If store ID does not exist, query returns `null` and evaluator fails closed with `{ isServiceable: false, error: 'Store ... was not found' }`. There is **NO silent fallback to a random store on the server**.
2. **Store Resolution in Client Applications:**
   - `customer-app/app/checkout/page.tsx:209` passes hardcoded `storeId: 'store-001'`.
   - `app/checkout/page.tsx:249` passes hardcoded `storeId: 'store-001'`.
   - `lib/locationServices.ts:700` falls back to `INITIAL_STORES[0]` (`storeId: 'store-1'`, name: `'Maule Kirana'`).
3. **Database Store Topology:**
   - PostgreSQL contains two stores: `store_primary` (`STORE-001`) and `store_central_001` (`PK-STORE-01`).
   - Both point to identical physical coordinates in Neral (`19.02245360`, `73.32100180`).
   - Because clients pass `store-001`, `store_primary` is consistently resolved. `store_central_001` remains an unreferenced row for default checkout flows.

---

## 8. Cloud Functions Findings

1. **`functions/src/orders/placeOrder.ts`**:
   - Contains a standalone order placement engine that queries Firestore `settings/store`.
   - Enforces:
     ```typescript
     if (subtotal < config.minimumOrderValue) {
       throw new HttpsError('failed-precondition', `Minimum order value is ₹${config.minimumOrderValue}...`);
     }
     ```
   - Enforces delivery fee from Firestore `config.deliveryFee`.
   - Status: Active callable function in Firebase deployment, but designated as a legacy/shadow path. `app/checkout/page.tsx` line 270 still contains a fallback caller to this function.
2. **`functions/src/inventory/validateDeliveryZone.ts`**:
   - Queries Firestore `settings/store` to retrieve `latitude`, `longitude`, `deliveryRadiusKm`.
   - Calculates Haversine distance and checks `distanceKm <= deliveryRadiusKm`.
   - Status: Actively invoked by `customer-app/app/setup-address/page.tsx` via `validateDeliveryZoneServerSide()`.
3. **`functions/src/utils.ts:getStoreConfig()`**:
   - Fallback configuration defines:
     `deliveryRadiusKm: 3`, `minimumOrderValue: 99`, `deliveryFee: 25`, `freeDeliveryThreshold: 299`.
4. **`functions/src/delivery/assignPartner.ts`**:
   - Calculates delivery partner earnings: `estimatedEarnings = 30 + Math.round(distanceKm * 5)` (₹30 base + ₹5/km).
   - This is operational logistics partner compensation, not a customer delivery fee.

---

## 9. Firestore Findings

1. **`fetchShopsFS()` in `lib/firebaseServices.ts`**:
   - Fetches shops from Firestore collection `shops`.
   - Invoked in `app/checkout/page.tsx:88` to populate `setStoresState(...)`.
   - Feeds the in-memory store state used by `checkZoneServiceability`.
2. **`settings/store` in Firestore**:
   - Read by Cloud Functions `placeOrder` and `validateDeliveryZone`.
   - Contains duplicate store operational configuration that is desynchronized from PostgreSQL `stores`.
3. **Dual Authority State:**
   - Server-side APIs (`/api/serviceability/check`, `POST /api/checkout`) read PostgreSQL `stores`.
   - Legacy frontend utilities (`lib/locationServices.ts`) and Cloud Functions read Firestore.

---

## 10. Test / Mock Findings

The following mock values exist strictly in tests, mocks, or local seed scripts and do not constitute active production authority:
- `lib/mockData.ts`: `deliveryFee: 15`, `minimumOrderValue: 199`, `deliveryRadiusKm: 3.0`.
- `app/api/seed/route.ts`: Contains mock products with `storeId: 'store-001'`.
- `test/server-serviceability.test.ts`: Verifies edge cases (e.g. 3 km, 4 km, 5 km radii; ₹0 fee when >= threshold).
- `test/promotions-marketing-matrix.test.ts`: Tests coupon minimum orders (₹400, ₹499). Note: Coupon-specific minimum orders are distinct from store-level minimum cart requirements and are valid promotion rules.

---

## 11. Final Verdict

### **RED**

**Verdict Justification:**  
While the backend order creation pipeline (`POST /api/checkout`) and serviceability API (`/api/serviceability/check`) are completely canonical and strictly adhere to PostgreSQL authority, **active production frontend user journeys in both `customer-app` and web `app` are gated by hardcoded client-side rules, road-multiplier checks, and Cloud Function/Firestore calls that reject or block users before they ever reach the canonical backend.**

Specifically:
- Users farther than 4.5 km are rejected client-side by `customer-app/app/checkout/page.tsx`.
- Users failing in-memory 1.35× road multiplier checks are blocked by `app/checkout/page.tsx` and `LocationPickerModal.tsx`.
- Users onboarding new addresses in `customer-app/app/setup-address` are rejected by Cloud Function `validateDeliveryZone` and routed to `/not-serviceable`.
- Web checkout retains an active fallback caller to Cloud Function `placeOrder`, which enforces Firestore minimum order values.

Until these client-side blockers and shadow paths are aligned or removed, PostgreSQL cannot be considered the sole, uncontested business-rule authority in the running production application.

---

## 12. Verification & Safety Log

- **Files Changed:** 0
- **Migrations Created:** 0
- **Database Writes Executed:** 0
- **Git Commits Created:** 0
- **Git HEAD Commit:** `63dba5363579334b67e4ac9a401d94060be244bf`
- **Working Tree Status:** Clean with respect to Phase 2.7C.5 (only approved pre-existing modifications from 2.7C.1–2.7C.4 present).
