# PocketKirana — Phase 1A: Server-Side Serviceability & Checkout Forensic Audit

**Audit Date:** October 2, 2026  
**Auditor:** Senior Full-Stack, Security & Systems Architecture Audit Team  
**Git Baseline Commit:** `91853644a6c58466f2d6e990a0c6777ea2f94204`  
**Git Branch:** `fix/page-readiness-production`  
**Audit Scope:** Server-side Serviceability Enforcement, Checkout API, Location Services, Operating Hours, and Store Configuration.  
**Mode:** READ-ONLY FORENSIC AUDIT (Zero source code modified).

---

## 1. Executive Summary

A comprehensive forensic audit of PocketKirana's order checkout pipeline and serviceability verification mechanisms was conducted. The primary objective was to determine why and how orders can currently be placed outside the valid delivery zone, and to specify the exact architectural design required to enforce server-side serviceability at `POST /api/checkout`.

### Critical Findings:
1. **Zero Server-Side Serviceability at Checkout:** `POST /api/checkout` (`app/api/checkout/route.ts`) performs **no coordinate validation, no distance calculation, no delivery radius check, and no operating hours check**. It accepts arbitrary addresses (including addresses in Mumbai or Delhi 60–1000+ km away, or payloads with omitted coordinates), locks PostgreSQL inventory, creates orders, generates delivery OTPs, and fires outbox events.
2. **Client-Side Verification Illusion:** The customer frontend (`app/checkout/page.tsx` line 204) invokes `checkZoneServiceability()` before dispatching the request. However, this is purely client-side advisory logic. Direct API calls, modified payloads, or manipulated Zustand store states completely bypass it.
3. **Database Schema Deficit:** The PostgreSQL `stores` table DDL (`scripts/init_client_postgres_tables.js` line 155) **lacks columns for service radius, road limits, opening time, closing time, minimum order value, and delivery fees**. Any updates made via the admin operations UI are either silently discarded by the SQL query or saved only in transient memory (`STORES_STATE`) or Firestore (`shops`), leading to split-brain configuration states.
4. **Multiple Conflicting Radii & Hours Across Codebase:** Delivery radius is variously defined as **3.0 KM** (fallback in `locationServices.ts` & rejection messages), **4.5 KM** (store object in `lib/mockData.ts`), **5.0 KM** (`storeOperationsService.ts` and `app/api/checkout/validate/route.ts`), and **6.0 KM** (max road distance limit in `INITIAL_STORES`). Shop hours similarly diverge between `06:00`–`23:00` and `06:00`–`23:30`.
5. **Existing E2E Test Codifies the Vulnerability:** In `test/e2e-lifecycle.test.ts` (lines 111–125), an order is placed to `{ city: 'Mumbai', pincode: '400001' }` with no latitude/longitude, and the test explicitly asserts HTTP 200 `success: true`.

---

## 2. Checkout Request Trace

Analysis of `app/api/checkout/route.ts` (Total lines: 511):

| Aspect | Current Implementation in `app/api/checkout/route.ts` | Code Reference / Quotes |
|---|---|---|
| **HTTP Method** | `POST` | Line 64: `export async function POST(req: NextRequest)` |
| **Authentication Requirement** | **Optional / Guest Allowed.** Uses `getRouteAuth(req)`. If no JWT is present, assigns `usr-guest-${Date.now()}`. Does not enforce session authentication. | Line 69: `const auth = getRouteAuth(req);`<br>Line 86: `const customerId = auth?.uid \|\| 'usr-guest-' + Date.now();` |
| **Request Body Schema** | Accepts `cartItems`, `address`, `addressId`, `paymentMethod`, `couponCode`, `storeId`, `idempotencyKey`. | Lines 54–63: `interface CheckoutRequestBody { ... }` |
| **Address Fields Received** | `id`, `fullName`, `name`, `phone`, `mobile`, `addressLine1`, `addressLine2`, `landmark`, `city`, `state`, `pincode`, `latitude`, `longitude`. | Lines 38–52: `interface CheckoutAddressInput { ... }` |
| **Latitude Field** | `address.latitude` | Lines 50, 344 |
| **Longitude Field** | `address.longitude` | Lines 51, 345 |
| **Pincode Field** | `address.pincode` (defaults to `'410206'` if null) | Lines 49, 343 |
| **City Field** | `address.city` (defaults to `'Panvel'` if null) | Lines 47, 341 |
| **Address ID** | Extracted from `body.addressId` and `address.id`. **Completely ignored.** Never queried from database. | Lines 57, 74 |
| **Coordinate Trust** | **Blindly trusted from client.** Coordinates from `address.latitude` and `address.longitude` are written directly to DB without bounds checks or proximity verification. | Lines 344–345: `address.latitude \|\| null, address.longitude \|\| null` |
| **Coordinates Loaded from DB?** | **NO.** Never looked up from `saved_addresses` or `users` table. | Absent from codebase. |
| **Address Ownership Verified?** | **NO.** No check verifies if the authenticated user owns `addressId` or the supplied address. | Absent from codebase. |
| **Order Address Snapshot** | Inserted into PostgreSQL `order_addresses` table during the order transaction. | Lines 327–348: `INSERT INTO order_addresses (id, order_id, receiver_name, phone, address_line_1, address_line_2, landmark, city, state, pincode, latitude, longitude) VALUES (...)` |
| **Inventory Locking** | Row-level locking via PostgreSQL `SELECT ... FOR UPDATE` on `inventory` table, followed by `stock_reservations` and FEFO batch deduction. | Lines 180–250: `SELECT id, quantity, reserved_quantity FROM inventory WHERE (variant_id = $1 OR id = $1) AND store_id = $2 FOR UPDATE` |
| **Pricing Calculation** | Pre-flight validation via `validateServerPricing()` in `lib/catalogSync.ts`, plus line totals calculated on lines 254–270. | Line 111: `validateServerPricing(...)`<br>Line 255: `const authoritativeUnitPrice = validatedCatItem ? ...` |
| **Delivery Fee Calculation** | **Hardcoded flat logic.** ₹0 if subtotal > ₹499, else ₹29. Zero road-distance or zone-based fee calculation. | Line 273: `const deliveryFee = subtotal > 499 ? 0 : 29;` |
| **Coupon Discount Calculation** | **Hardcoded flat logic.** Flat ₹50 if `couponCode` string is present, completely bypassing `lib/promotionsEngine.ts`. | Line 272: `const discount = couponCode ? 50 : 0;` |
| **Order Creation** | Inserted into PostgreSQL `orders` table, followed by `order_items`, `order_status_history`, and transactional outbox. | Lines 280–304: `INSERT INTO orders (...) VALUES (...)` |
| **Serviceability Check** | **COMPLETELY ABSENT.** No check for coordinates, distance, store status, or store hours. | **0 checks across the entire route.** |

---

## 3. Trace the Existing Serviceability API

Inspection of `app/api/checkout/validate-serviceability/route.ts` (Total lines: 118):

### Call Chain:
```
POST /api/checkout/validate-serviceability (route.ts)
  │
  ├── 1. Request Body Parsing: extracts { latitude, longitude, address, cartTotal }
  ├── 2. Coordinate Range Validation: checks lat in [-90, 90], lng in [-180, 180]
  ├── 3. Store Hub Discovery: calls fetchShopsFS() [@/lib/firebaseServices]
  │      └── Fallback: if Firestore empty/unavailable -> getStores() [@/lib/locationServices]
  │      └── Sync: setStoresState(activeStores) [@/lib/locationServices]
  ├── 4. Distance Calculation:
  │      └── for each active store: calculateDistanceKm(sLat, sLng, lat, lng) [@/lib/locationServices]
  │          └── Haversine formula (Earth radius R = 6371 km)
  ├── 5. Target Store Selection: picks closest store or fallback { deliveryRadiusKm: 4.5, ... }
  ├── 6. Serviceability Decision:
  │      ├── radiusKm = targetStore.deliveryRadiusKm || 3.0 (Line 75)
  │      ├── isServiceable = distanceKm <= radiusKm && targetStore.status === 'active' (Line 79)
  │      └── roadDistanceKm = Math.round(distanceKm * 1.35 * 10) / 10 (Line 77)
  └── 7. Response Serialization: returns ServiceabilityResponse JSON
```

### Specific Forensic Attributes:
* **Request Fields:** `latitude`, `longitude`, `address` (optional object containing `latitude`, `longitude`), `cartTotal`.
* **Response Fields:** `success`, `isServiceable`, `isTenMinuteEligible`, `zoneId`, `zoneName`, `storeId`, `storeName`, `distanceKm`, `roadDistanceKm`, `estimatedDeliveryMinutes`, `deliveryFee`, `radiusKm`, `message`.
* **Latitude/Longitude Handling:** Converts to `Number()`. If missing or outside bounds, returns HTTP 400.
* **Store Lookup:** Queries Firestore `shops` collection via `fetchShopsFS()`. Falls back to in-memory `getStores()` from `lib/locationServices.ts`.
* **Radius Lookup:** Uses `targetStore.deliveryRadiusKm || 3.0`.
* **Road Distance Lookup:** Uses a static multiplier: `distanceKm * 1.35`. **Does not call OSRM.**
* **Opening Hours Lookup:** **NONE.** Does not check `openingTime` or `closingTime`.
* **Active/Inactive Handling:** Filters stores with `status !== 'inactive'`.
* **OSRM Behavior:** OSRM is **not invoked** in this route. The 1.35 multiplier is pure in-memory arithmetic and cannot fail due to network.
* **Conflicting Rejection Message:** On line 92, the rejection message explicitly hardcodes `"delivers within 3 KM"`, even if `targetStore.deliveryRadiusKm` was 4.5 KM.

---

## 4. Audit Location Services

Inspection of `lib/locationServices.ts` (Total lines: 954) and `lib/locationFlowService.ts` (Total lines: 431):

### Distance Metrics:
* **Haversine Formula:** Lines 61–78 in `lib/locationServices.ts`.
* **Earth Radius Constant:** `const R = 6371;` (Standard Earth radius in kilometers).
* **Road Distance Calculation:** Two implementations:
  1. Full OSRM routing with polyline geometry in `getRoadRoute()` (lines 134–230).
  2. Estimated detour calculation: `straightLineDistanceKm * multiplier` (default multiplier = 1.35).
* **OSRM Endpoint:** `https://router.project-osrm.org` (or `process.env.NEXT_PUBLIC_OSRM_URL`).
* **Fallback Multiplier:** 1.35 (`straightKm * 1.35`).
* **Maximum Road Distance:** `selectedStore.maxRoadDistanceKm || Number((radiusKm * 1.4).toFixed(1))`.
* **Rounding Behavior:** `Math.round(R * c * 10) / 10` (rounded to 1 decimal place / 100 meters).

---

### Radius Source Inventory

| Source File | Line | Radius Value | Purpose / Context | Runtime Authority? |
|---|---:|:---:|---|---|
| `types/index.ts` | 58 | `number` | TypeScript interface definition `Store.deliveryRadiusKm` | Type definition |
| `lib/mockData.ts` | 976 | **4.5 KM** | `INITIAL_STORES[0].deliveryRadiusKm` (Maule Kirana Store, Neral) | **Yes** (initial memory state) |
| `lib/mockData.ts` | 977 | **6.0 KM** | `INITIAL_STORES[0].maxRoadDistanceKm` (Road detour limit) | **Yes** (Layer 2 road limit) |
| `lib/locationServices.ts` | 55–56 | N/A | Store Anchor: `STORE_HUB_LAT = 19.0224536`, `STORE_HUB_LON = 73.3210018` | Constant coordinates |
| `lib/locationServices.ts` | 648 | **3.0 KM** | Fallback in `updateStoreConfig()` when creating new store | Fallback default |
| `lib/locationServices.ts` | 726 | **3.0 KM** | Fallback in `checkZoneServiceability()` (`selectedStore.deliveryRadiusKm \|\| 3.0`) | Fallback default |
| `lib/locationServices.ts` | 906–907 | **3.0 KM** | Fallback in legacy `checkServiceability()` | Fallback default |
| `lib/storeOperationsService.ts` | 76 | **5.0 KM** | Hardcoded `deliveryRadiusKm = 5.0` in `getDarkstoreOperationalStatus()` | **Yes** (Darkstore capacity API) |
| `components/admin/StoreOperationsControlView.tsx` | 29 | **5.0 KM** | Initial state `useState(5.0)` | Admin UI default |
| `app/api/checkout/validate/route.ts` | 33, 39 | **5.0 KM** | Fallback store and radius in `validate/route.ts` | Legacy validation route |
| `app/api/checkout/validate-serviceability/route.ts` | 71 | **4.5 KM** | Fallback target store definition | Overridden by line 75 |
| `app/api/checkout/validate-serviceability/route.ts` | 75 | **3.0 KM** | Fallback `targetStore.deliveryRadiusKm \|\| 3.0` | Fallback default |
| `app/api/checkout/validate-serviceability/route.ts` | 92 | **3.0 KM** | Customer user-facing rejection message: `"delivers within 3 KM"` | Display message |
| `app/admin/service-area/page.tsx` | 57 | **3.0 KM** | Initial state: `INITIAL_STORES[0].deliveryRadiusKm \|\| 3.0` | Admin UI default |
| `functions/src/utils.ts` | 106 | **3.0 KM** | Cloud Function config fallback `deliveryRadiusKm: 3` | Cloud Functions |
| `functions/src/inventory/validateDeliveryZone.ts` | 39, 45 | **3.0 KM** | Cloud Function delivery zone validation | Cloud Functions |

---

## 5. Audit Shop Hours

Sources of Operating Hours and Store Status:

| Location | Opening Time | Closing Time | Purpose | Authority Level |
|---|:---:|:---:|---|---|
| `lib/mockData.ts` (Line 974–975) | `06:00` | `23:00` | Initial store seed data | In-memory baseline |
| `lib/locationServices.ts` (Line 646–647) | `06:00` | `23:00` | Default fallback in `updateStoreConfig()` | In-memory fallback |
| `lib/locationServices.ts` (Line 744) | `06:00` | `23:00` | Fallback format string for operating hours display | Display fallback |
| `lib/storeOperationsService.ts` (Line 40–41) | `06:00` | `23:30` | Default parameters for `isStoreCurrentlyOpen()` | Function defaults |
| `lib/storeOperationsService.ts` (Line 74–75) | `06:00` | `23:30` | Hardcoded values in `getDarkstoreOperationalStatus()` | Darkstore Operations API |
| `components/admin/StoreOperationsControlView.tsx` (Line 27–28) | `06:00` | `23:30` | Admin control panel initial state | Frontend UI |
| `app/admin/stores/page.tsx` (Line 58–59) | `06:00` | `23:00` | Admin store management initial state | Frontend UI |
| `app/admin/service-area/page.tsx` (Line 60–61) | `06:00` | `23:00` | Admin service area initial state | Frontend UI |
| `lib/firestoreSchema.ts` (Line 159–160) | `06:00` | `23:00` | Firestore schema documentation | Documentation |
| `app/api/checkout/route.ts` | **NONE** | **NONE** | Order placement API | **Completely unenforced** |

### Authority Breakdown:
1. **Frontend Authority:** Evaluates `isStoreCurrentlyOpen()` inside `checkZoneServiceability()` via `lib/locationFlowService.ts` and `app/checkout/page.tsx`.
2. **Backend Authority:** **ABSENT.** Neither `POST /api/checkout` nor `POST /api/checkout/validate-serviceability` enforces operating hours.
3. **Firestore Authority:** Stores `openingTime` and `closingTime` in `shops/{shopId}` document if saved via `app/admin/service-area/page.tsx`.
4. **PostgreSQL Authority:** **NONE.** The `stores` table does not have `opening_time` or `closing_time` columns.
5. **In-Memory Authority:** `STORES_STATE` in `lib/locationServices.ts` stores hours during runtime, lost on Node server restart.
6. **Default/Fallback Values:** `06:00` to `23:00` (or `23:30`).

---

## 6. Audit Store Configuration Storage Matrix

Inspection of PostgreSQL DDL (`scripts/init_client_postgres_tables.js`), Firestore helpers (`lib/firebaseServices.ts`), and Admin routes:

| Setting | Current Storage | Current Writer | Current Reader | Persistent Across Restarts? |
|---|---|---|---|:---:|
| **Store Latitude** | PostgreSQL `stores.latitude`, Firestore `shops.latitude`, In-Memory `STORES_STATE` | `init_client_postgres_tables.js`, `saveShopConfigFS()`, `updateStoreConfig()` | `calculateDistanceKm()`, `fetchShopsFS()`, `getStores()` | **YES** (Postgres + Firestore) |
| **Store Longitude** | PostgreSQL `stores.longitude`, Firestore `shops.longitude`, In-Memory `STORES_STATE` | `init_client_postgres_tables.js`, `saveShopConfigFS()`, `updateStoreConfig()` | `calculateDistanceKm()`, `fetchShopsFS()`, `getStores()` | **YES** (Postgres + Firestore) |
| **Service Radius** | Firestore `shops.deliveryRadiusKm`, In-Memory `STORES_STATE` | `app/admin/service-area/page.tsx` via `saveShopConfigFS()` & `updateStoreConfig()` | `checkZoneServiceability()`, `validate-serviceability/route.ts` | **PARTIAL** (Firestore only; **MISSING from PostgreSQL**) |
| **Max Road Distance** | In-Memory `STORES_STATE` | `app/admin/stores/page.tsx` via `updateStoreConfig()` | `checkZoneServiceability()` (Layer 2) | **NO** (In-memory only; lost on server restart) |
| **Opening Time** | Firestore `shops.openingTime`, In-Memory `STORES_STATE` | `app/admin/service-area/page.tsx` via `saveShopConfigFS()` | `isStoreCurrentlyOpen()` | **PARTIAL** (Firestore only; **MISSING from PostgreSQL**) |
| **Closing Time** | Firestore `shops.closingTime`, In-Memory `STORES_STATE` | `app/admin/service-area/page.tsx` via `saveShopConfigFS()` | `isStoreCurrentlyOpen()` | **PARTIAL** (Firestore only; **MISSING from PostgreSQL**) |
| **Active Status** | PostgreSQL `stores.is_active`, Firestore `shops.status`, In-Memory `STORES_STATE` | `updateDarkstoreOperations()`, `saveShopConfigFS()`, `updateStoreConfig()` | `getDarkstoreOperationalStatus()`, `checkZoneServiceability()` | **YES** (PostgreSQL + Firestore) |
| **Delivery Fee** | Hardcoded in `pricingEngine.ts`, `freeDelivery.ts`, `checkout/route.ts` | Hardcoded in source code | `calculateDeliveryFee()`, `checkout/route.ts` | **HARDCODED** (Not dynamically persistent) |
| **Minimum Order** | In-Memory `STORES_STATE`, Firestore `shops.minimumOrderValue` | `app/admin/service-area/page.tsx` | UI checks only | **PARTIAL** (Firestore only; **MISSING from PostgreSQL**) |
| **Free Delivery Threshold** | Hardcoded in `lib/freeDelivery.ts` (₹499) and `checkout/route.ts` (line 273) | Hardcoded in source code | `calculateDeliveryFee()`, `checkout/route.ts` | **HARDCODED** (₹499) |

---

## 7. Customer Address Data Flow

Trace of customer coordinates through the system:

```
1. Customer Location Selection:
   - GPS via navigator.geolocation / Capacitor Geolocation
   - OR Manual map pin / Search autocomplete via Nominatim (lib/locationServices.ts)
   │
2. Client Persistence:
   - Stored in browser localStorage under key: 'pk_selected_location'
   - Stored in Zustand AppState.addresses[] (persisted via Zustand persist key: 'pocketkirana-storage-v5', version 6)
   │
3. Saved Address Structure:
   - Persisted in Zustand and Firestore users/{userId}/addresses/{addressId}
   - Contains: { fullName, phone, addressLine1, city, postalCode, latitude, longitude, isDefault }
   │
4. Cart & Checkout Page:
   - User selects saved address (app/checkout/page.tsx line 101)
   - Evaluates: checkZoneServiceability(selectedAddr.latitude, selectedAddr.longitude)
   - Dispatches POST /api/checkout with body.address = selectedAddr
   │
5. POST /api/checkout:
   - Receives address object with latitude and longitude
   - Does NOT verify if customer owns the address
   - Does NOT verify coordinates against darkstore geofence
   - Does NOT verify whether city/pincode matches coordinates
   - Inserts directly into order_addresses table
```

### Forensic Findings on Customer Address:
* **Where Coordinates Originate:** Device GPS or Nominatim reverse-geocoding in `LocationPickerModal.tsx`.
* **Are Coordinates Persisted?** Yes, in `localStorage` and Zustand client state.
* **Do Saved Addresses Contain Lat/Lng?** Yes, `Address` interface requires `latitude: number` and `longitude: number`.
* **Can Checkout Operate Without Coordinates?** **YES.** If a client sends `{ addressLine1: "123 Street", city: "Mumbai" }` without `latitude` or `longitude`, `/api/checkout` accepts it and saves `latitude: null, longitude: null`.
* **Is Pincode Alone Sufficient?** In the backend, **yes**. The backend does not require coordinates or validate the pincode.
* **Are Stale Coordinates Possible?** Yes. If a user moves physical locations but selects an address saved 6 months ago, the saved address coordinates are sent without re-verification.
* **Can Customer Manually Alter Coordinates?** Yes. Any client tool (cURL, Postman, browser console) can submit modified coordinates.
* **Is Address Ownership Enforced?** **NO.** `POST /api/checkout` does not verify whether `addressId` or the address payload belongs to `auth.uid`.

---

## 8. Security & Bypass Analysis

| Bypass Vector | Status | Architectural Vulnerability & Explanation |
|---|:---:|---|
| **Omit latitude/longitude** | `POSSIBLE` | `app/api/checkout/route.ts` lines 344–345 write `address.latitude \|\| null, address.longitude \|\| null`. No pre-condition checks for coordinates. Order is placed successfully. |
| **Send fake latitude/longitude** | `POSSIBLE` | A client can pass `{ latitude: 19.0224, longitude: 73.3210 }` (the store's exact coordinates) while requesting delivery to New Delhi. The server does not validate cross-consistency between text address and GPS coordinates. |
| **Send valid pincode (410101) but distant coordinates** | `POSSIBLE` | The server performs no distance calculation. The order is accepted and committed regardless of coordinates. |
| **Send store coordinates but remote text address** | `POSSIBLE` | Even in the frontend, `checkZoneServiceability()` checks only numeric `lat`/`lng`. The server blindly inserts the remote text into `order_addresses.address_line_1`. |
| **Modify saved address ID (`addressId`)** | `POSSIBLE` | `body.addressId` is extracted but never queried from PostgreSQL. The route uses whatever is inside `body.address`, verifying no database records or ownership. |
| **Modify delivery address after client serviceability check** | `POSSIBLE` | A client can pass the frontend check using a serviceable address, intercept the HTTP request, replace the address with an unserviceable one, and `POST /api/checkout` will commit it. |
| **Call `/api/checkout` directly** | `POSSIBLE` | Direct API calls via cURL/Postman bypass all Next.js React frontend checks. Zero server-side serviceability exists. |
| **Skip `/api/checkout/validate-serviceability`** | `POSSIBLE` | `/api/checkout` is completely decoupled from `/api/checkout/validate-serviceability`. It does not require a signature, session token, or validation proof. |
| **Manipulate client-side Zustand state** | `POSSIBLE` | Setting `addresses[0].latitude` to a serviceable coordinate in DevTools bypasses the client-side check on `app/checkout/page.tsx` line 204. |

---

## 9. Checkout Data Contract for Phase 1

The following data contract is required for server-side serviceability enforcement at `POST /api/checkout`:

### Input Contract:
```typescript
interface VerifiedCheckoutAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;   // REQUIRED: -90 <= lat <= 90
  longitude: number;  // REQUIRED: -180 <= lng <= 180
}

interface ServerCheckoutRequest {
  storeId: string;
  cartItems: CartItemInput[];
  address: VerifiedCheckoutAddress;
  paymentMethod: 'cod' | 'phonepe' | 'upi' | 'card';
  couponCode?: string;
  idempotencyKey?: string;
}
```

### Internal Server-Side Validation Output:
```typescript
interface ServiceabilityEvaluationResult {
  isServiceable: boolean;
  storeId: string;
  storeName: string;
  distanceKm: number;
  roadDistanceKm: number;
  radiusKm: number;
  isStoreOpen: boolean;
  isStoreActive: boolean;
  rejectionReason?: 'OUTSIDE_RADIUS' | 'ROAD_DETOUR_EXCEEDED' | 'STORE_CLOSED' | 'STORE_OFFLINE' | 'INVALID_COORDINATES';
  rejectionMessage?: string;
}
```

---

## 10. Existing Test Coverage Audit

| Test Name | File Path | What It Currently Verifies | Missing Coverage / Gaps |
|---|---|---|---|
| `e2e-lifecycle.test.ts` (Lines 111–125) | `test/e2e-lifecycle.test.ts` | E2E order flow, PhonePe webhook, outbox worker | **Actively asserts success for Mumbai address with missing coordinates!** Needs negative test cases. |
| `checkout-total-state.test.ts` | `test/checkout-total-state.test.ts` | Zustand store cart total, delivery fee (₹29), tax, snapshot retention | Tests only client-side Zustand store methods (`store.placeOrder`). Does not test `/api/checkout` endpoint. |
| `location-tracking.test.ts` | `test/location-tracking.test.ts` | Haversine calculation, OSRM road route fetching, route deviation detection, GPS update validation | Tests helper functions in isolation. Does not test checkout serviceability enforcement. |
| `location-notification-flow.test.ts` | `test/location-notification-flow.test.ts` | `LocationFlowService` state machine, permission flows, modal visibility | Frontend client-side flow only. Does not verify API rejection. |
| `security-verification.test.ts` | `test/security-verification.test.ts` | CSRF origin checks on `/api/checkout`, OTP brute-force protection | Tests middleware headers. Does not test coordinate or serviceability enforcement. |
| `security-remediation-regression.test.ts` | `test/security-remediation-regression.test.ts` | Inverted auth, rate limiting, timing safe OTP | Does not test checkout serviceability or address validation. |

---

## 11. Identified Risks

1. **Test Regression Risk:** Existing tests in `test/e2e-lifecycle.test.ts` send mock orders without coordinates or with city `'Mumbai'`. Adding strict server-side coordinate validation without updating test fixtures will break the test suite.
2. **Missing Database Columns:** Any backend serviceability check reading `deliveryRadiusKm`, `openingTime`, or `closingTime` from PostgreSQL will fail or fall back to defaults unless columns are added to the `stores` table.
3. **Split-Brain Configuration:** If an admin updates store hours or radius in the UI, it writes to Firestore `shops` but NOT to PostgreSQL `stores`. A server-side check reading only PostgreSQL will not see admin changes made in Firestore.
4. **Third-Party API Dependency (OSRM):** Calling public OSRM during `POST /api/checkout` introduces network latency (100–1000ms), rate limiting, and potential point of failure. Server-side road distance checks must use local arithmetic (Haversine * multiplier) as fallback.
5. **Guest Checkout Address Spoofing:** Because guest checkout is permitted (`usr-guest-*`), attackers can generate endless guest sessions to probe store geofences.

---

## 12. Recommended Phase 1 Implementation Sequence

The implementation should follow this strict sequence:

1. **Step 1: Database Migration (Pre-requisite):**
   Add missing operational columns to PostgreSQL `stores` table:
   - `delivery_radius_km NUMERIC(4, 2) DEFAULT 3.0`
   - `max_road_distance_km NUMERIC(4, 2) DEFAULT 4.5`
   - `road_distance_multiplier NUMERIC(3, 2) DEFAULT 1.35`
   - `opening_time VARCHAR(8) DEFAULT '06:00'`
   - `closing_time VARCHAR(8) DEFAULT '23:00'`
   - `delivery_fee INT DEFAULT 29`
   - `free_delivery_threshold INT DEFAULT 499`
   - `minimum_order_value INT DEFAULT 199`

2. **Step 2: Canonical Server-Side Serviceability Evaluator:**
   Create a dedicated, pure, zero-dependency server function:
   `evaluateServerServiceability(storeRecord, customerCoordinates)` that evaluates:
   - Layer 1: Valid coordinate bounds (-90 to 90, -180 to 180)
   - Layer 2: Store operational status (`is_active` === true, current clock time within `opening_time` and `closing_time`)
   - Layer 3: Haversine distance <= `delivery_radius_km`
   - Layer 4: Road distance estimate (Haversine * multiplier) <= `max_road_distance_km`

3. **Step 3: Inject Validation into `POST /api/checkout`:**
   Place the validation in `app/api/checkout/route.ts` immediately after idempotency check and before starting the PostgreSQL transaction.
   - If coordinates missing or unserviceable -> Return HTTP 400 immediately.
   - Prevents acquiring PostgreSQL client connections, inventory locks, or sequential order numbers for rejected orders.

4. **Step 4: Align Admin Store Configuration Writers:**
   Update `app/api/admin/store/operations/route.ts` and `lib/storeOperationsService.ts` to write `delivery_radius_km`, `opening_time`, and `closing_time` into PostgreSQL `stores`, eliminating the Firestore/Postgres split-brain state.

5. **Step 5: Update Test Fixtures:**
   Update `test/e2e-lifecycle.test.ts` to use valid Neral store coordinates (`19.0224, 73.3210`) in order checkout requests, and add explicit negative tests verifying that distant coordinates or missing coordinates are rejected with HTTP 400.

---

## 13. Exact Files That Will Need Modification in Phase 1

1. `scripts/init_client_postgres_tables.js` (Add operational columns to `stores` table DDL).
2. `lib/postgres.ts` or new migration script (Apply schema changes to live database).
3. `lib/services/serviceabilityService.ts` (NEW: Canonical server-side serviceability evaluator).
4. `app/api/checkout/route.ts` (Inject server-side serviceability validation before DB transaction).
5. `lib/storeOperationsService.ts` (Persist radius and hours into PostgreSQL `stores`).
6. `app/api/admin/store/operations/route.ts` (Support updating all store operational parameters).
7. `test/e2e-lifecycle.test.ts` (Update mock address fixtures to include valid Neral coordinates).
8. `test/serviceability-checkout-enforcement.test.ts` (NEW: Unit and regression test suite for checkout rejection).

---

## 14. Database Migration Requirements

```sql
-- Phase 1 Migration: Store Operational Parameters
ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC(4, 2) DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS max_road_distance_km NUMERIC(4, 2) DEFAULT 4.5,
  ADD COLUMN IF NOT EXISTS road_distance_multiplier NUMERIC(3, 2) DEFAULT 1.35,
  ADD COLUMN IF NOT EXISTS opening_time VARCHAR(8) DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS closing_time VARCHAR(8) DEFAULT '23:00',
  ADD COLUMN IF NOT EXISTS delivery_fee INT DEFAULT 29,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold INT DEFAULT 499,
  ADD COLUMN IF NOT EXISTS minimum_order_value INT DEFAULT 199;

-- Ensure primary store has default Neral configuration
UPDATE stores 
SET 
  latitude = 19.0224536,
  longitude = 73.3210018,
  delivery_radius_km = 3.0,
  max_road_distance_km = 4.5,
  road_distance_multiplier = 1.35,
  opening_time = '06:00',
  closing_time = '23:00',
  is_active = TRUE
WHERE id = 'store-001' OR code = 'STORE-001';
```

---

## 15. Final Git Status

```
On branch fix/page-readiness-production
Your branch is ahead of 'origin/fix/page-readiness-production' by 2 commits.
  (use "git push" to publish your local commits)

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	POCKETKIRANA_PHASE0_BASELINE.md
	POCKETKIRANA_PHASE1A_SERVICEABILITY_AUDIT.md

nothing added to commit but untracked files present (use "git add" to track)
```

**Verification:** Zero tracked source files were modified during this forensic audit.
