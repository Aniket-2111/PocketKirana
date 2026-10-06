# Phase 2.7C.7.6 Forensic Audit & Remediation Design — Legacy Business-Rule Authority

**Document ID:** `PHASE_2_7C_7_6_FORENSIC_AUDIT_AND_REMEDIATION_DESIGN.md`  
**Execution Phase:** Phase 2.7C.7.6 (Audit + Design Only — ZERO CODE/DB MODIFICATIONS)  
**Execution Timestamp:** 2026-10-02T21:25:00+05:30  
**Baseline Git Commit:** `63dba5363579334b67e4ac9a401d94060be244bf`  
**Prior Hardening Verifications:** F-01 (GREEN), F-02 (GREEN), F-03 (GREEN), F-04 (GREEN), F-05 (GREEN)  
**Final Audit Gate:** **GREEN**  

---

## 1. Executive Summary

Phase 2.7C.7.1 through Phase 2.7C.7.5 systematically eliminated all active production dependencies on legacy Firebase Cloud Functions, Firestore store settings, and client-side hardcoded heuristics from customer checkout and onboarding flows:
1. **F-05:** Removed Cloud Function fallback `callPlaceOrder` from `app/checkout/page.tsx`.
2. **F-01:** Removed hardcoded 4.5 km blocker and client-side Haversine checks from `customer-app/app/checkout/page.tsx`.
3. **F-04:** Unblocked saved address clicks in `components/customer/LocationPickerModal.tsx` and connected canonical `/api/serviceability/check`.
4. **F-02:** Removed road distance multiplier (1.35) and road cutoff (1.4) from `app/checkout/page.tsx`.
5. **F-03:** Replaced `validateDeliveryZoneServerSide` in `customer-app/app/setup-address/page.tsx` with canonical `/api/serviceability/check`.

This Phase 2.7C.7.6 forensic audit comprehensively surveyed the entire repository to determine if **ANY** competing legacy authority remains active anywhere in production code.

**Key Findings:**
* **Zero Active Production Callers for Legacy Order Creation:** Neither web checkout nor customer-app checkout invokes Firebase `placeOrder` or `callPlaceOrder`. `POST /api/checkout` is the sole active order creation authority.
* **Zero Active Production Callers for Legacy Serviceability Callables:** Neither web nor mobile checkout/setup invokes `validateDeliveryZone`, `callValidateDeliveryZone`, or `validateDeliveryZoneServerSide`.
* **Advisory Location Permission Guard Discovered:** `customer-app/components/LocationPermissionGuard.tsx` invokes `locationFlowService.evaluateServiceability()`, which evaluates `checkZoneServiceability()`. This displays a non-blocking "Outside Delivery Area" modal if in-memory `STORES_STATE` fails, but includes a "Continue Browsing" button and does not block checkout or order placement.
* **Legacy Admin Service Area Sync:** `app/admin/service-area/page.tsx` continues to write updates to Firestore `shops` collection via `saveShopConfigFS()`. Since customer checkouts now read PostgreSQL `stores`, this admin write represents an isolated legacy mirror.
* **Firebase Auth & FCM Infrastructure Fully Intact:** Phone number authentication, user token creation, and FCM push notifications operate independently from legacy business-rule functions and must remain fully active.

---

## 2. Baseline Architecture

* **Git HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`
* **Canonical Flow:**
  ```text
  Customer Web / Mobile UI
          ↓
  GET /api/serviceability/check?lat=...&lng=...&storeId=store-001
          ↓
  POST /api/checkout (Payload: address, items, paymentMethod, idempotencyKey)
          ↓
  evaluateServerServiceability()
          ↓
  PostgreSQL stores (Authority for radius, active status, hours, fee, threshold)
          ↓
  PostgreSQL orders + order_items + inventory_batches (Atomic Transaction)
  ```
* **PostgreSQL Schema Authority:** `stores` table (columns: `delivery_radius_km`, `is_active`, `opening_time`, `closing_time`, `delivery_fee`, `free_delivery_threshold`, `free_delivery_enabled`).

---

## 3. Repository Scope

The audit surveyed all sub-applications, libraries, and functions in the repository:
1. `app/` (Next.js App Router: Web customer routes, admin portal, API endpoints)
2. `customer-app/` (Mobile Capacitor customer app)
3. `picker-app/` (Warehouse picking & packing app)
4. `components/` (Shared UI components)
5. `lib/` (Core services: `locationServices.ts`, `serverServiceability.ts`, `functionsClient.ts`, `locationFlowService.ts`, `store.ts`, `firebaseServices.ts`)
6. `functions/` (Firebase Cloud Functions: `orders/`, `inventory/`, `delivery/`, `auth/`, `admin/`)
7. `services/` (Client API SDK wrappers)
8. `test/` (Vitest suites)

---

## 4. Legacy Authority Inventory

| Authority Artifact | Location | Type | Current Status | Production Risk |
| :--- | :--- | :--- | :--- | :--- |
| `placeOrder` | `functions/src/orders/placeOrder.ts` | Cloud Function (Callable) | **DEPRECATED** (0 active callers) | Can act as shadow order authority if directly invoked via Firebase SDK |
| `callPlaceOrder` | `lib/functionsClient.ts:89` | Client SDK Wrapper | **DEPRECATED** (0 active callers) | None (unreferenced in application code) |
| `validateDeliveryZone` | `functions/src/inventory/validateDeliveryZone.ts` | Cloud Function (Callable) | **DEPRECATED** (0 active callers) | None (unreferenced by active clients) |
| `callValidateDeliveryZone` | `lib/functionsClient.ts:150` | Client SDK Wrapper | **DEPRECATED** (0 active callers) | None (unreferenced) |
| `validateDeliveryZoneServerSide` | `lib/locationServices.ts:879` | Client Service Helper | **DEPRECATED** (0 active callers) | None (unreferenced; F-03 removed sole caller) |
| `checkZoneServiceability` | `lib/locationServices.ts:704` | In-Memory 3-Layer Evaluator | **ADVISORY ONLY** (used by `locationFlowService`) | Can trigger non-blocking advisory popup in Customer App |
| `STORES_STATE` / `getStores` | `lib/locationServices.ts:616` | In-Memory Stores Repository | **DEPRECATED** | Admin stores GET endpoint reads this array |
| `fetchShopsFS` | `lib/firebaseServices.ts:1250` | Firestore `shops` Reader | **TRANSITIONAL / ADMIN ONLY** | Admin service-area reads Firestore shops |
| `saveShopConfigFS` | `lib/firebaseServices.ts:1270` | Firestore `shops` Writer | **TRANSITIONAL / ADMIN ONLY** | Admin service-area updates Firestore instead of Postgres |
| `getStoreConfig` | `functions/src/utils.ts:97` | Firestore `settings/store` Reader | **LEGACY CLOUD FUNCTION UTIL** | Reads Firestore `settings/store` with hardcoded fallback |
| `/api/checkout/validate` | `app/api/checkout/validate/route.ts` | Next.js API Route | **DEPRECATED** (0 active callers) | None |
| `/api/checkout/validate-serviceability` | `app/api/checkout/validate-serviceability/route.ts` | Next.js API Route | **DEPRECATED** (0 active callers) | None |
| `/api/location/serviceability` | `app/api/location/serviceability/route.ts` | Next.js API Route | **DEPRECATED** (0 active callers) | None |

---

## 5. Complete Production Caller Graph

```mermaid
graph TD
    subgraph Active Production Authority
        CW[Customer Web Checkout] -->|POST| API_CHECKOUT[/api/checkout]
        CA[Customer App Checkout] -->|POST| API_CHECKOUT
        CSA[Customer App Address Setup] -->|GET| API_CHECK[/api/serviceability/check]
        CW_PREV[Customer Web Preview] -->|GET| API_CHECK
        LPM[LocationPickerModal] -->|GET| API_CHECK
        API_CHECK --> ESS[evaluateServerServiceability]
        API_CHECKOUT --> ESS
        ESS --> PG[(PostgreSQL stores)]
        API_CHECKOUT --> PG_ORD[(PostgreSQL orders + items + outbox)]
    end

    subgraph Advisory & Mirror Paths
        CSHELL[CustomerShell] --> LPG[LocationPermissionGuard]
        LPG --> LFS[locationFlowService]
        LFS --> CZS[checkZoneServiceability - In-Memory Advisory]
        CZS --> MODAL[UnserviceableAreaModal - Continue Browsing]
        ADMIN_SA[Admin Service Area Page] --> FS_SHOPS[(Firestore shops)]
    end

    subgraph Deprecated Legacy Functions Zero Callers
        CF_PO[functions: placeOrder] -.->|Zero Callers| D1[Unused]
        CF_VDZ[functions: validateDeliveryZone] -.->|Zero Callers| D2[Unused]
        CPO[callPlaceOrder] -.->|Zero Callers| D3[Unused]
        CVDZ[callValidateDeliveryZone] -.->|Zero Callers| D4[Unused]
        VDZSS[validateDeliveryZoneServerSide] -.->|Zero Callers| D5[Unused]
        API_VAL[/api/checkout/validate] -.->|Zero Callers| D6[Unused]
        API_VAL_SERV[/api/checkout/validate-serviceability] -.->|Zero Callers| D7[Unused]
        API_LOC_SERV[/api/location/serviceability] -.->|Zero Callers| D8[Unused]
    end
```

---

## 6. `placeOrder` Forensic Audit

| Audit Question | Finding & Evidence |
| :--- | :--- |
| **1. Is there any active production caller?** | **NO.** A complete repository search confirms 0 callers across web, mobile, and API layers. |
| **2. Is there any web caller?** | **NO.** `app/checkout/page.tsx` was remediated in Phase 2.7C.7.1 (F-05). It calls `POST /api/checkout`. |
| **3. Is there any customer-app caller?** | **NO.** `customer-app/app/checkout/page.tsx` calls `POST /api/checkout`. |
| **4. Is there any mobile customer caller?** | **NO.** Capacitor mobile build uses `customer-app/app/checkout/page.tsx`. |
| **5. Is there any API route that invokes it?** | **NO.** No Next.js route calls `placeOrder` or `callPlaceOrder`. |
| **6. Is it dynamically imported anywhere?** | **NO.** Dynamic import searches confirm zero dynamic imports. |
| **7. Can it create an order?** | **YES**, if invoked directly via Firebase callable SDK by an authenticated client knowing the function name `placeOrder`. It writes to Firestore `orders` (`placedAt`, `orderNumber`, status: `CREATED`). |
| **8. Can it reserve inventory?** | **YES**, it writes reservations to Firestore `stockReservations` collection, completely disconnected from PostgreSQL FEFO inventory. |
| **9. Can it change order status?** | **YES**, it transitions COD orders to `CONFIRMED` in Firestore. |
| **10. Does it calculate delivery fee?** | **YES**, using Firestore `config.freeDeliveryThreshold` (299) and `config.deliveryFee` (25). |
| **11. Does it use `minimumOrderValue`?** | **YES**, enforces Firestore `config.minimumOrderValue` (99). |
| **12. Does it read Firestore store settings?** | **YES**, calls `getStoreConfig()` which reads Firestore `settings/store`. |
| **13. Does it use hardcoded fallback configuration?** | **YES**, if `settings/store` document is absent, it falls back to Maule Kirana coordinates (`19.0224536, 73.3210018`), 3 km radius, and ₹99 min order. |
| **14. Can it bypass `POST /api/checkout`?** | **YES**, direct callable invocation bypasses PostgreSQL entirely. |
| **15. Can it create a second order-creation authority?** | **YES**, it represents a deployed secondary shadow order authority. |

**Classification:** **DEPRECATED ORDER-CREATION AUTHORITY CANDIDATE**.  
**Recommendation:** Do NOT delete in this phase. In C.7.6, annotate with `@deprecated` in `functions/src/orders/placeOrder.ts` and in `lib/functionsClient.ts:89`. In a future deployment, replace the callable body with an explicit rejection directing callers to `POST /api/checkout`.

---

## 7. `validateDeliveryZone` Forensic Audit

| Function / Wrapper | File | Active Callers | Status | Details |
| :--- | :--- | :---: | :--- | :--- |
| `validateDeliveryZone` | `functions/src/inventory/validateDeliveryZone.ts:18` | **0** | **DEPRECATED** | Cloud Function HTTPS callable. Reads Firestore `settings/store`. |
| `callValidateDeliveryZone` | `lib/functionsClient.ts:150` | **0** | **DEPRECATED** | Client wrapper. Marked `@deprecated` in Phase 2.7C.7.5. |
| `validateDeliveryZoneServerSide` | `lib/locationServices.ts:879` | **0** | **DEPRECATED** | Client SDK bridge. Sole production caller (`setup-address/page.tsx:112`) eliminated in Phase 2.7C.7.5. Marked `@deprecated`. |

**Verdict:**
* `validateDeliveryZone`: **DEPRECATED**
* `callValidateDeliveryZone`: **DEPRECATED**
* `validateDeliveryZoneServerSide`: **DEPRECATED**

---

## 8. Firestore Authority Audit

| Firestore Path | Read Locations | Write Locations | Classification | Impact |
| :--- | :--- | :--- | :--- | :--- |
| `settings/store` | `functions/src/utils.ts:getStoreConfig()` | `app/api/seed/route.ts` | **DEPRECATED CLOUD CONFIG** | Only read by deprecated Cloud Functions (`placeOrder`, `validateDeliveryZone`, `assignDeliveryPartner`). Zero active customer checkout readers. |
| `shops` | `lib/firebaseServices.ts:fetchShopsFS()` | `app/admin/service-area/page.tsx:saveShopConfigFS()` | **TRANSITIONAL / ADMIN MIRROR** | Read by admin service area and deprecated routes (`validate`, `validate-serviceability`, `location/serviceability`). Zero active checkout readers. |
| `orders` | Delivery partner functions, admin views | `placeOrder.ts:286`, delivery partner triggers | **TRANSITIONAL MIRROR** | Deployed mobile delivery partner flows listen to Firestore orders. Orders created in PostgreSQL are projected to Firestore for driver apps. |
| `stockReservations` | `releaseExpiredReservations.ts` | `placeOrder.ts:299` | **DEPRECATED** | Unused by active PostgreSQL checkout (which uses `inventory_batches`). |
| `users` | Auth triggers, profile hooks | Client auth, `userAuth.ts` | **ACTIVE AUTH INFRASTRUCTURE** | Firebase Authentication user metadata. MUST REMAIN ACTIVE. |
| `fcmTokens` | `sendFcmToUser()`, `sendFcmToRole()` | `functionsClient.ts:saveFcmToken()` | **ACTIVE NOTIFICATION INFRASTRUCTURE** | Push notification delivery. MUST REMAIN ACTIVE. |

---

## 9. Client Authority Audit

| Subsystem | File / Component | Logic Evaluated | Classification | Can Block Customer Journey? |
| :--- | :--- | :--- | :--- | :--- |
| Customer Web Checkout | `app/checkout/page.tsx` | Asynchronous preview via `/api/serviceability/check` | **ACTIVE DISPLAY** | **NO.** Preview displays server-provided values. Server (`POST /api/checkout`) is sole gate. |
| Customer App Checkout | `customer-app/app/checkout/page.tsx` | Direct post to `/api/checkout` | **DELEGATED TO SERVER** | **NO.** Does not perform client distance checks. Surfaces server error. |
| Customer App Address Setup | `customer-app/app/setup-address/page.tsx` | Asynchronous check via `/api/serviceability/check` | **ACTIVE GATE (CANONICAL)** | **YES** (redirects unserviceable address to `/not-serviceable`), but uses canonical server result. Out-of-zone address is saved first. |
| Location Picker Modal | `components/customer/LocationPickerModal.tsx` | Fetches `/api/serviceability/check` for badges | **ACTIVE DISPLAY** | **NO.** Unconditional address selection unblocked in F-04. |
| Location Permission Guard | `customer-app/components/LocationPermissionGuard.tsx` | Calls `locationFlowService.evaluateServiceability()` | **ADVISORY ONLY** | **NO.** Shows modal on initial location fix, but contains "Continue Browsing" button; does not block checkout. |
| Customer Not Serviceable Page | `customer-app/app/not-serviceable/page.tsx` | Reads `searchParams.get('dist')` | **DISPLAY ONLY** | **NO.** Informational display screen. |
| Admin Service Area Page | `app/admin/service-area/page.tsx` | Edits radius and writes Firestore | **TRANSITIONAL ADMIN TOOL** | **NO.** Writes to Firestore, but production checkout reads PostgreSQL. |
| Admin Stores Page | `app/admin/stores/page.tsx` | Edits in-memory `updateStoreConfig` | **TRANSITIONAL ADMIN TOOL** | **NO.** Does not write to PostgreSQL directly. |

---

## 10. Hardcoded Business-Rule Scan

| Term / Value | Codebase Occurrences | Context & Active Authority Assessment | Classification |
| :--- | :--- | :--- | :--- |
| `3 km` / `3 KM` | `customer-app/app/not-serviceable/page.tsx:65,92`, `LocationPickerModal.tsx:433` | Hardcoded copy text in static UI templates. In PostgreSQL, 3.0 km is the canonical store radius. | **STATIC UI COPY** (Harmless display copy; does not gate logic) |
| `4.5 km` / `4.5 KM` | `mockData.ts:976`, `locationServices.ts:938`, `functionsClient.ts:439` | Legacy mock store and fallback in deprecated functions. Zero active production authority. | **DEPRECATED / MOCK** |
| `5 km` / `5 KM` | `storeOperationsService.ts:76`, `app/api/checkout/validate/route.ts:39` | Legacy storeOperations fallback and deprecated route. Allowed in PostgreSQL radius range (3, 4, 5 km). | **DEPRECATED / ALLOWED RADIUS** |
| `1.3` / `1.35` / `1.4` | `locationServices.ts:82, 152, 741` | Used in OSRM routing fallback for driver turn-by-turn map polylines (legitimate) and deprecated `checkZoneServiceability`. Removed from web checkout in F-02. | **LEGITIMATE NAVIGATION / DEPRECATED IN CHECKOUT** |
| `₹15` / `15` | `mockData.ts:980`, `locationServices.ts:771`, `admin/service-area/page.tsx:89` | In-memory mock store fee. Canonical fee is PostgreSQL `stores.delivery_fee` (25.00). | **DEPRECATED MOCK** |
| `₹25` / `25` | PostgreSQL `stores.delivery_fee`, `functions/src/utils.ts:108` | Canonical standard delivery fee in PostgreSQL. Also used as Cloud Functions default. | **ACTIVE CANONICAL (PostgreSQL) / LEGACY (Functions)** |
| `₹29` / `29` | `app/api/checkout/validate/route.ts:51`, `lib/store.ts:1785` | Legacy fallback fee in Zustand store when server pricing is omitted. Active checkout passes `serverPricing`. | **FALLBACK SNAPSHOT DEFAULT** |
| `₹99` / `99` | `functions/src/utils.ts:107`, `app/api/seed/route.ts:45` | Cloud Function fallback minimum order. In PostgreSQL, minimum order is 0.00. | **DEPRECATED CLOUD DEFAULT** |
| `₹199` / `199` | `mockData.ts:979`, `admin/service-area/page.tsx:88`, `admin/stores/page.tsx:54` | In-memory mock and admin form input default. | **DEPRECATED MOCK** |
| `₹299` / `299` | `functions/src/utils.ts:109` | Cloud Function fallback free delivery threshold. In PostgreSQL, threshold is 500.00. | **DEPRECATED CLOUD DEFAULT** |
| `₹499` / `499` | `app/api/checkout/validate/route.ts:51` | Legacy validation route free delivery rule. Deprecated. | **DEPRECATED ROUTE** |
| `₹500` / `500` | PostgreSQL `stores.free_delivery_threshold`, `lib/store.ts:1785` | Canonical free delivery threshold in PostgreSQL. Client fallback matches server. | **ACTIVE CANONICAL** |
| `minimumOrderValue` | `serverServiceability.ts:24,262`, `placeOrder.ts:180` | Evaluated server-side in `evaluateServerServiceability` against `stores.minimum_order_value`. Legacy check in `placeOrder`. | **ACTIVE CANONICAL (Server) / DEPRECATED (Functions)** |
| `deliveryFee` / `delivery_fee` | `serverServiceability.ts`, PostgreSQL `stores.delivery_fee` | Resolved server-side in `resolveDeliveryFee`. | **ACTIVE CANONICAL** |
| `freeDeliveryThreshold` | `serverServiceability.ts`, PostgreSQL `stores.free_delivery_threshold` | Evaluated server-side in `resolveDeliveryFee`. | **ACTIVE CANONICAL** |
| `deliveryRadiusKm` | `serverServiceability.ts`, PostgreSQL `stores.delivery_radius_km` | Evaluated server-side in `evaluateServerServiceability`. | **ACTIVE CANONICAL** |

---

## 11. Fallback Safety Audit

| Fallback Scenario | Where Executed | Can Affect Production Customer? | Can Block Checkout? | Can Change Pricing/Eligibility? | Classification |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `getStoreConfig()` fallback defaults | `functions/src/utils.ts:101` | **NO** | **NO** | **NO** | **DEPRECATED** (0 active production callers) |
| `validateDeliveryZoneServerSide` offline fallback | `lib/locationServices.ts:930` | **NO** | **NO** | **NO** | **DEPRECATED** (0 active production callers) |
| `callPlaceOrderFallback` | `lib/functionsClient.ts:399` | **NO** | **NO** | **NO** | **DEPRECATED** (0 active production callers) |
| Setup Address Network Error Fail-Open | `customer-app/app/setup-address/page.tsx:144` | **YES** | **NO** | **NO** | **SAFE NON-AUTHORITATIVE** (Saves address and allows browsing; final checkout independently validates) |
| Checkout Preview Network Failure | `app/checkout/page.tsx:139` | **YES** | **NO** | **NO** | **SAFE NON-AUTHORITATIVE** (Disables client preview; final order submission to `/api/checkout` validates authoritatively) |
| Store Selection Default `store-001` | `app/api/serviceability/check/route.ts:49` | **YES** | **NO** | **NO** | **SAFE CANONICAL FALLBACK** (Resolves default darkstore if client omits storeId) |

---

## 12. Business Rule Authority Map

| Business Rule | Canonical Authority | Competing Legacy Authority | Active Production Caller | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Store Selection** | PostgreSQL `stores.id` (`store-001`) | In-memory `STORES_STATE` | `GET /api/serviceability/check`, `POST /api/checkout` | **CANONICAL ONLY** |
| **Store Active Status** | PostgreSQL `stores.is_active` | Firestore `settings/store.isOpen`, `shops.status` | `evaluateServerServiceability` via `/api/checkout` | **CANONICAL ONLY** |
| **Store Coordinates** | PostgreSQL `stores.latitude, longitude` | `STORE_HUB_LAT/LON`, `settings/store` | `evaluateServerServiceability` | **CANONICAL ONLY** |
| **Service Radius** | PostgreSQL `stores.delivery_radius_km` | In-memory 3.0 km, Cloud Function 3.0/4.5 km | `evaluateServerServiceability` | **CANONICAL ONLY** |
| **Serviceability Gate** | `evaluateServerServiceability` | `checkZoneServiceability`, `validateDeliveryZone` | `GET /api/serviceability/check`, `POST /api/checkout` | **CANONICAL ONLY** |
| **Operating Hours** | PostgreSQL `stores.opening_time, closing_time` | In-memory `isStoreCurrentlyOpen()` | `evaluateServerServiceability` | **CANONICAL ONLY** |
| **Delivery Fee** | `resolveDeliveryFee` (PostgreSQL `stores.delivery_fee`) | In-memory ₹15, Zustand ₹29, Cloud Function ₹25 | `POST /api/checkout`, `/api/serviceability/check` | **CANONICAL ONLY** |
| **Free Delivery Threshold** | PostgreSQL `stores.free_delivery_threshold` | Cloud Function ₹299, Route ₹499, Zustand ₹500 | `resolveDeliveryFee` | **CANONICAL ONLY** |
| **Minimum Order Value** | PostgreSQL `stores.minimum_order_value` (₹0) | Cloud Function ₹99, In-memory ₹199 | `evaluateServerServiceability` | **CANONICAL ONLY** |
| **Order Creation** | `POST /api/checkout` | Cloud Function `placeOrder` | Web and Mobile Checkout | **CANONICAL ONLY** |
| **Inventory Reservation** | PostgreSQL `inventory_batches` (FEFO) | Firestore `stockReservations` | `POST /api/checkout` | **CANONICAL ONLY** |
| **Order Status Transitions** | PostgreSQL `orders.status` (`PATCH /api/orders/[id]/status`) | Firestore `orders.update()` | API Routes / Drivers | **CANONICAL ONLY** |

---

## 13. Order Creation Authority Map

| Path | Can Create Order? | Active Production Caller? | Backend Target | Status |
| :--- | :---: | :---: | :--- | :--- |
| `POST /api/checkout` | **YES** | **YES** (Web & Customer App) | PostgreSQL `orders` + `order_items` + `inventory_batches` | **SOLE CANONICAL AUTHORITY** |
| Firebase `placeOrder` | **YES** (if called directly) | **NO** (0 callers) | Firestore `orders` + `stockReservations` | **DEPRECATED SHADOW PATH** |
| `checkoutApi.placeOrder` (`services/api/index.ts`) | **NO** (Endpoint 404s) | **NO** (0 callers) | Non-existent `/api/checkout/place-order` | **DEAD SDK STUB** |
| `store.placeOrder` (`lib/store.ts`) | **NO** (State update only) | **YES** (Post-checkout snapshot) | Client Zustand store memory | **LOCAL STATE PROJECTION** |
| Any other route/action | **NO** | **NO** | None | **NO OTHER PATHS EXIST** |

---

## 14. Firebase Function Classification

### Category 1: MUST REMAIN ACTIVE (Auth & FCM Infrastructure)
* **`setUserRole`** (`functions/src/auth/setUserRole.ts`): Sets Firebase Custom Claims for role-based access control.
* **`onUserCreated`** (`functions/src/auth/userAuth.ts`): Initializes user profile on Firebase Auth user signup.
* **`updateUserProfile`** (`functions/src/auth/userAuth.ts`): Updates customer name and contact details.
* **`saveFcmToken`** (`functions/src/auth/userAuth.ts`): Registers FCM push notification device tokens.

### Category 2: TRANSITIONAL / MIRROR ONLY (Driver & Warehouse Workflows)
* **`acceptDeliveryAssignment`** (`functions/src/delivery/acceptAssignment.ts`): Driver assignment acceptance in mobile driver app.
* **`rejectDeliveryAssignment`** (`functions/src/delivery/acceptAssignment.ts`): Driver assignment rejection.
* **`verifyStorePickup`** (`functions/src/delivery/verifyPickup.ts`): OTP-based darkstore pickup verification.
* **`updateDeliveryStage`** (`functions/src/delivery/verifyPickup.ts`): Driver transit stage updates.
* **`completeDelivery`** (`functions/src/delivery/completeDelivery.ts`): Customer OTP delivery completion.
* **`recordDeliveryFailure`** (`functions/src/delivery/completeDelivery.ts`): Delivery failure tracking.
* **`assignDeliveryPartner`** (`functions/src/delivery/assignPartner.ts`): Background Firestore trigger matching orders to nearest online driver.
* **`scanBarcode`** (`functions/src/inventory/scanBarcode.ts`): Barcode scan lookup for picking.
* **`confirmPutaway`** (`functions/src/inventory/putaway.ts`): Stock putaway verification.
* **`cancelOrder`** (`functions/src/orders/cancelOrder.ts`): Order cancellation in Firestore mirror.
* **`autoCompleteOrders`** (`functions/src/orders/autoCompleteOrders.ts`): Cron trigger auto-completing delivered orders.
* **`releaseExpiredReservations`** (`functions/src/inventory/releaseExpiredReservations.ts`): Cron trigger cleaning up expired Firestore reservations.

### Category 3: DEPRECATED BUSINESS-RULE AUTHORITY (Replaced by PostgreSQL)
* **`placeOrder`** (`functions/src/orders/placeOrder.ts`): Superseded by `POST /api/checkout`. Zero active callers.
* **`validateDeliveryZone`** (`functions/src/inventory/validateDeliveryZone.ts`): Superseded by `GET /api/serviceability/check`. Zero active callers.

### Category 4: UNUSED (Safe Deletion Candidates in Future Cleanup)
* **`getDashboardSummary`** (`functions/src/admin/getDashboardSummary.ts`): Zero callers across the repository. Admin metrics are served by Next.js analytics routes.

---

## 15. Exact Findings

1. **Finding F-06A: Deployed Cloud Function `placeOrder` remains callable:** While active web and customer apps have zero callers to `placeOrder`, the Cloud Function is exported in `functions/src/index.ts` and deployed. If an external client invokes it directly with valid Firebase auth tokens, it would create shadow orders in Firestore with obsolete pricing rules.
2. **Finding F-06B: Customer App Advisory Permission Guard (`LocationPermissionGuard`):** `customer-app/components/LocationPermissionGuard.tsx` invokes `locationFlowService.evaluateServiceability()`, which calls legacy `checkZoneServiceability()`. When in-memory `STORES_STATE` marks an address outside 3.0 km, it renders `UnserviceableAreaModal`. Although dismissable via "Continue Browsing", it creates an advisory inconsistency with canonical PostgreSQL serviceability.
3. **Finding F-06C: Static Copy Strings in Customer App (`/not-serviceable`):** `customer-app/app/not-serviceable/page.tsx` contains hardcoded static strings (`"3 KM"`, `"Maule Kirana Shop (Neral)"`) rather than displaying dynamic parameters from the backend.
4. **Finding F-06D: Admin Service Area Firestore Split-Brain:** `app/admin/service-area/page.tsx` reads and writes Firestore `shops` via `fetchShopsFS()` and `saveShopConfigFS()`. Changes made on this page do not propagate to PostgreSQL `stores`.
5. **Finding F-06E: Dead SDK Stub in `services/api/index.ts`:** `checkoutApi.placeOrder` references `/api/checkout/place-order`, a route that does not exist.

---

## 16. Proposed Phase 2.7C.7.6 Remediation Design (For Future Implementation Phase)

> [!IMPORTANT]
> **AUDIT ONLY RULE RESPECTED:** The following is the design plan for the future implementation phase. No code or database modifications are performed in this phase.

### Step 1: Deprecate Cloud Function `placeOrder` & `validateDeliveryZone`
* In `functions/src/orders/placeOrder.ts`, prepend an explicit `@deprecated` banner and add a guard returning an error response directing callers to the canonical API:
  ```ts
  /**
   * @deprecated NON-AUTHORITATIVE / DECOMMISSIONED
   * Canonical order creation is strictly handled by POST /api/checkout.
   */
  ```
* In `functions/src/inventory/validateDeliveryZone.ts`, add a matching `@deprecated` banner.
* In `lib/functionsClient.ts:89`, add `@deprecated NON-AUTHORITATIVE` to `callPlaceOrder`.

### Step 2: Align `LocationFlowService` with Canonical Serviceability
* In `lib/locationFlowService.ts:296`, modify `evaluateServiceability(lat, lon, pincode)`:
  Instead of evaluating synchronous in-memory `checkZoneServiceability`, perform an asynchronous query to `/api/serviceability/check?lat=${lat}&lng=${lon}&storeId=store-001`, aligning the advisory modal with PostgreSQL darkstore boundaries.

### Step 3: Parameterize `/not-serviceable` UI Copy
* In `customer-app/app/not-serviceable/page.tsx`, read `maxDist` query parameter (or fallback gracefully to server-provided values) so that displays reflect the true darkstore delivery radius.

### Step 4: Decommission Dead SDK Stubs
* In `services/api/index.ts`, annotate `checkoutApi` with `@deprecated` or remove unreferenced dead stubs.

---

## 17. Test Design (For Future Implementation Phase)

The following test suite should be created when implementing the remediation (`test/checkout-f06-legacy-authority-decommission.test.ts`):
1. **Cloud Function Callers:** Assert zero production callers of `placeOrder`, `callPlaceOrder`, `validateDeliveryZone`, and `callValidateDeliveryZone`.
2. **Sole Order Authority:** Assert `POST /api/checkout` is the only active order creation endpoint in `app/` and `customer-app/`.
3. **Advisory Alignment:** Assert `locationFlowService` does not use hardcoded 1.35x multiplier or 4.5 km cutoffs to block users.
4. **Auth & FCM Integrity:** Assert `setUserRole`, `onUserCreated`, `updateUserProfile`, and `saveFcmToken` remain exported and intact.
5. **No DB Changes:** Assert 0 DDL, 0 DML.

---

## 18. Rollback Plan

If any issue arises during future implementation of Phase 2.7C.7.6 remediation:
* **Rollback Mechanism:** Revert working tree code to baseline commit `63dba5363579334b67e4ac9a401d94060be244bf` via git.
* **No Runtime Toggles:** No feature flag or dynamic fallback switching.
* **Zero Database Impact:** Database remains untouched; no rollback migrations required.

---

## 19. Non-Goals

Phase 2.7C.7.6 and subsequent cleanup phases explicitly do NOT modify:
* PhonePe payment gateway integration
* Payment webhook verification
* Inventory/FEFO batch deduction and ledger
* Transactional outbox pattern
* Firebase Authentication (SMS OTP, custom claims)
* Firebase Cloud Messaging (FCM token management)
* Cloudflare CDN / R2 storage
* PostgreSQL schema, roles, or ownership
* VPS or server infrastructure

---

## 20. Final Audit Gate

### Checklist:
* [x] Every relevant Firebase business-rule function is identified and inspected.
* [x] Every production caller is identified and verified.
* [x] `placeOrder` is fully traced from Cloud Function to all potential callers.
* [x] `validateDeliveryZone` is fully traced across all wrappers.
* [x] Firestore business-rule reads (`settings/store`, `shops`) are mapped.
* [x] Client business-rule logic is classified across all sub-apps.
* [x] All hardcoded numbers and thresholds are identified and classified.
* [x] All fallback paths are classified with safety ratings.
* [x] Order-creation authority is mapped with exactly ONE canonical path.
* [x] Firebase Auth and FCM are strictly separated from legacy business logic.
* [x] Zero unexplained production paths remain.

### Final Gate Status: **GREEN**

**Execution Safety Confirmation:**
* Application Code Changes: **0**
* Database Changes: **0**
* DDL: **0**
* DML: **0**
* Migrations: **0**
* Git Commits: **0**
* Deployments: **0**

Implementation is STOPPED. Standing by for review before any subsequent phase.
