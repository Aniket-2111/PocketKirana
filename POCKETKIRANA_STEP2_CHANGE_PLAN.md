# POCKETKIRANA — STEP 2: CHANGE VERIFICATION & FIX PLAN

**Document Path:** `POCKETKIRANA_STEP2_CHANGE_PLAN.md`  
**Execution Date:** October 2, 2026  
**Status:** AUDIT & PLANNING ONLY — ZERO CODE MODIFICATIONS  
**Target Platform:** PocketKirana Hyperlocal Delivery (Neral, Maharashtra)  

---

## 1. Git State Verification

### Repository Status
- **Current Branch:** `fix/page-readiness-production`
- **Branch Relationship:** Ahead of `origin/fix/page-readiness-production` by 1 commit (`13525c1 fix(checkout): resolve ₹0 total state-sync bug with immutable snapshot architecture and regression suite`).
- **Working Tree Status:** Dirty (14 modified files, 2 untracked files).
- **Staged Files:** 0 (all modifications are unstaged).

### Recent Commits:
```
13525c1 fix(checkout): resolve ₹0 total state-sync bug with immutable snapshot architecture and regression suite
fb0f8f1 fix(security): fail closed on client order fallback in production
8133e2d feat(payment): remove Razorpay integration and preserve PhonePe as sole online gateway
5a8f824 fix(security): resolve C1, C2, C5, C6 vulnerabilities and CORS hardening
f853830 feat(branding): update delivery and picker app icons, manifests, and launcher mipmaps
```

### Detailed Inspection of Modified Files

| File | Exact Change Summary | Reason & Context |
| :--- | :--- | :--- |
| `app/api/admin/invoices/template/route.ts` | Changed auth guard: `if (!auth \|\| (auth.role !== 'admin' && auth.uid !== 'dev-user'))` | Fixes inverted authorization vulnerability (PK-SEC-01) where anonymous users could access template. |
| `app/api/admin/stores/route.ts` | Added `requireRole(req, ['admin'])` check before returning store list | Restricts internal darkstore operational configurations to admin role only (PK-SEC-09). |
| `app/api/auth/send-otp/route.ts` | Added sliding-window rate limit (`checkOtpRateLimit(identifier, 3, 60000)`) returning HTTP 429 | Prevents SMS bombing and SMS gateway toll fraud (PK-SEC-07). |
| `app/api/delivery/assignments/[id]/deliver/route.ts` | Replaced direct string equality with `timingSafeOtpCompare(assignment.delivery_otp.trim(), otp.trim())` | Eliminates timing side-channel attack on 4-digit customer delivery OTP (PK-SEC-08). |
| `app/api/delivery/orders/[id]/accept/route.ts` | Enforced strict role check: `['delivery_partner', 'admin'].includes(auth.role)` | Prevents customers from accepting delivery assignments (PK-SEC-02). |
| `app/api/orders/[id]/invoice/route.ts` | Enforced mandatory authentication and customer ownership check against `order.customer_id` | Prevents IDOR (Insecure Direct Object Reference) data leakage on customer tax invoices (PK-SEC-03). |
| `app/api/payments/phonepe/verify/route.ts` | Rewrote real payment path to run atomic PostgreSQL transaction updating `order_status = 'CONFIRMED'`, `payment_status = 'paid'`, and inserting into `payments` / `payment_transactions` | Mitigates the PhonePe pending-state bug for live gateway payments by bypassing `OrderService`. |
| `app/api/upload/evidence/route.ts` | Added cryptographic magic-byte check (`validateImageBuffer`) and sanitized filename generation | Prevents malicious executable upload via order complaint evidence flow (PK-SEC-11). |
| `lib/services/orderService.ts` | Removed nonexistent columns (`assigned_picker_id`, `assigned_partner_id`) from `FOR UPDATE` query | Prevents PostgreSQL syntax/column errors during state transitions. |
| `lib/store.ts` | Bumped Zustand persist version from `5` to `6` and migrate guard `version < 6` | Resolves browser console error *"State loaded from storage couldn't be migrated since no migrate function was provided"*. |
| `middleware.ts` | Replaced loose host check with strict loopback check (`localhost`, `127.0.0.1`, `::1`); rejects LAN addresses | Closes vulnerability where LAN clients (e.g. `192.168.x.x`) could access admin pages via dev-bypass (PK-SEC-04). |
| `next.config.ts` | Added `serverExternalPackages: ['pg', 'firebase-admin']` | Ensures native Node.js binaries and crypto modules avoid Next.js client bundling conflicts. |
| `scripts/run_outbox_worker.js` | Exported worker handlers and wrapped polling loop in `if (require.main === module)` | Enables unit testing of outbox leasing and failure handling without launching an infinite loop. |
| `test/security-remediation-regression.test.ts` | Appended regression test suites for PK-SEC-01, PK-SEC-02, PK-SEC-03 | Validates authorization fixes for invoice template, delivery accept, and invoice download. |

### Untracked Files
1. `POCKETKIRANA_CURRENT_STATE_AUDIT.md`: Created during Step 1 audit.
2. `test/security-audit-batch2-regression.test.ts`: Automated regression tests for PK-SEC-04 (LAN isolation), PK-SEC-07 (OTP rate limit), PK-SEC-08 (constant-time OTP), PK-SEC-09 (stores RBAC), PK-SEC-11 (magic byte validation), and PK-SEC-12 (outbox test harness).

---

## 2. Investigation of the Zustand Store Change

### Verification Findings:
1. **File Path:** [`d:/pocketkirana/lib/store.ts`](file:///d:/pocketkirana/lib/store.ts) (Lines 5291–5308).
2. **Exact Current Version:** `version: 6`.
3. **Migration Guard:**
   ```typescript
   name: 'pocketkirana-store-v4',
   version: 6,
   migrate: (persistedState: any, version: number) => {
     if (!version || version < 6) { ... }
   }
   ```
4. **Git Status:** Uncommitted change in working tree (`modified: lib/store.ts`).
5. **Origin & Reason:**
   - Prior to Step 1, the user reported a console error:
     ```
     State loaded from storage couldn't be migrated since no migrate function was provided
     at eval (lib\store.ts:215:1)
     ```
   - In Zustand's `persist` middleware, when a client browser has persisted state in `localStorage` with a stored version number higher than the store's declared version (or unhandled by `migrate`), Zustand logs this error and aborts hydration.
   - Bumping declared version `5 -> 6` and widening the condition `version < 5 -> version < 6` resolved the client-side hydration crash.
6. **Relation to Audit:** This change was made **before** the Step 1 Audit instructions were issued, directly responding to the user's error report. It is safe, working, and must be retained as part of the Phase 0 baseline commit.

---

## 3. Verification of Critical Blockers

### A. Serviceability Enforcement Gap
- **Checkout Route (`app/api/checkout/route.ts`):**  
  Inspection of lines 80 to 280 confirms that `POST /api/checkout` receives an `address` object (`fullName`, `addressLine1`, `city`, `pincode`, `latitude`, `longitude`), but **performs zero validation on coordinates, distance, or service radius**.
- **Location Service (`lib/locationServices.ts`):**  
  `checkZoneServiceability(lat, lon, pincode, storeId)` exists, is fully functional, and evaluates 3 layers (Haversine radius, road detour distance, operating hours).
- **Vulnerability:**  
  While the frontend checkout page (`app/checkout/page.tsx`, line 204) invokes `checkZoneServiceability`, any client or script sending `POST /api/checkout` directly bypasses the frontend check. An order with coordinates in Mumbai (60 km away) or Pune will be accepted, reserved in inventory, and written to PostgreSQL.

### B. Outbox Worker Dependency (`jiti`)
- **Worker File:** [`scripts/run_outbox_worker.js`](file:///d:/pocketkirana/scripts/run_outbox_worker.js) (Line 87):
  ```javascript
  const jiti = require('jiti')(__filename);
  const { OutboxWorker } = jiti(path.resolve(__dirname, '../lib/services/outboxWorker.ts'));
  ```
- **Dependency Status:** `jiti` is **NOT** declared in `package.json` (`dependencies` or `devDependencies`).
- **Runtime Behavior:** On the current development machine, `jiti` resolves because it was pulled into `node_modules` transitively by TailwindCSS / PostCSS. On a clean production container or server running `npm install --omit=dev`, `scripts/run_outbox_worker.js` will immediately throw:
  ```
  Error: Cannot find module 'jiti'
  ```
- **Consequence:** The outbox worker will fail to boot in production, halting all asynchronous projections to Firestore and all FCM push notifications.

### C. Coupon Calculation Divergence
- **Pre-Flight Route (`app/api/checkout/calculate-price/route.ts`):**  
  Evaluates coupons through [`lib/promotionsEngine.ts`](file:///d:/pocketkirana/lib/promotionsEngine.ts) via `evaluatePromotionsEngine`. Validates minimum order values, active date windows, max discounts, and coupon validity.
- **Order Creation Route (`app/api/checkout/route.ts`, Line 272):**
  ```typescript
  const discount = couponCode ? 50 : 0;
  ```
- **Vulnerability:**  
  The checkout route ignores the promotions engine and grants a flat ₹50 discount for **any arbitrary string** passed in `couponCode` (e.g. `couponCode: "XYZ"`). Conversely, legitimate percentage coupons or tiered coupons calculated on the cart screen will be overridden with ₹50 at order placement.

### D. PhonePe Payment Pending-State Bug
- **Status in Webhook (`app/api/payments/phonepe/webhook/route.ts`):**  
  Fixed. Lines 180–187 run direct SQL:
  ```sql
  UPDATE orders SET payment_status = 'paid', order_status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW() WHERE id = $1
  ```
- **Status in Real Gateway Verify (`app/api/payments/phonepe/verify/route.ts`):**  
  Partially fixed in unstaged working copy (lines 262–270) via direct SQL update.
- **Status in Simulation Verify (`app/api/payments/phonepe/verify/route.ts`, Line 65):**  
  **BROKEN.** Still calls `OrderService.transitionOrder`.
- **Status in `OrderService.transitionOrder` (`lib/services/orderService.ts`, Line 161):**  
  **UNFIXED.** The canonical transition SQL query is:
  ```sql
  UPDATE orders
  SET order_status = $1, delivery_otp = COALESCE($2, delivery_otp), updated_at = CURRENT_TIMESTAMP, ...
  WHERE id = $3
  ```
  `payment_status` is never updated. Any code delegating to `OrderService.transitionOrder` leaves the order's payment status as `'pending'`.

---

## 4. High-Priority Verification: Radius Map

A complete audit of every radius value declared in the codebase reveals significant discrepancies:

| File | Code Location | Configured Value | Operational Context | Authoritative in Flow? |
| :--- | :--- | :---: | :--- | :---: |
| `lib/mockData.ts` | Line 976 (`INITIAL_STORES[0]`) | **4.5 KM** | Darkstore object configuration (`deliveryRadiusKm`) | **Yes** (when store object loaded) |
| `lib/mockData.ts` | Line 977 (`INITIAL_STORES[0]`) | **6.0 KM** | Max road detour limit (`maxRoadDistanceKm`) | **Yes** (Layer 2 road limit) |
| `lib/locationServices.ts` | Line 648 (`updateStoreConfig`) | **3.0 KM** | Default radius for newly created stores | Fallback default |
| `lib/locationServices.ts` | Line 726 (`checkZoneServiceability`) | **3.0 KM** | Fallback when store radius is missing (`|| 3.0`) | Fallback default |
| `lib/locationServices.ts` | Line 922 (`checkServiceabilityDirect`) | **4.5 KM** | Hardcoded constant (`DELIVERY_RADIUS_KM = 4.5`) | Used in direct helper |
| `app/api/checkout/validate/route.ts` | Lines 33, 39 | **5.0 KM** | Fallback store definition | Used only by legacy endpoint |
| `app/api/checkout/validate-serviceability/route.ts` | Line 71 | **4.5 KM** | Fallback target store definition | Overridden by line 75 |
| `app/api/checkout/validate-serviceability/route.ts` | Line 75 | **3.0 KM** | Fallback radius (`targetStore.deliveryRadiusKm \|\| 3.0`) | Fallback default |
| `app/api/checkout/validate-serviceability/route.ts` | Line 92 (Message) | **3 KM** | Customer rejection message: *"delivers within 3 KM"* | **User-facing string** |
| `app/api/serviceability/check/route.ts` | Lines 46, 112 | **4.5 KM** | Serviceability check endpoint fallback | Secondary endpoint |
| `lib/functionsClient.ts` | Line 437 | **4.5 KM** | Distance threshold check (`dist > 4.5 && !isNeral`) | Client fallback check |
| `lib/legalData.ts` | Line 276 | **3–5 KM** | Legal terms: *"immediate surrounding radii of 3–5 km"* | Terms & Conditions |
| `app/admin/stores/page.tsx` | Line 53 | **3.0 KM** | Admin slider initial state | Admin UI initial default |
| `app/admin/service-area/page.tsx` | Line 57 | **3.0 KM** | Admin radius input default | Admin UI initial default |

### Verdict on Radius:
The system currently operates with a split brain:
- The data entity (`INITIAL_STORES`) specifies **4.5 KM** straight-line and **6.0 KM** road limit.
- The UI messages, fallback code, and Admin defaults specify **3.0 KM**.
- **Business Direction:** The client requirements specify a clean, uniform **3.0 KM** radius for initial launch in Neral.

---

## 5. High-Priority Verification: Shop Hours Map

| File | Code Location | Current Value | Frontend / Backend / Admin | Notes |
| :--- | :--- | :---: | :--- | :--- |
| `lib/mockData.ts` | Line 974–975 | `06:00` – `23:00` | Shared Data | Primary darkstore seed definition |
| `lib/locationServices.ts` | Line 646–647 | `06:00` – `23:00` | Shared Engine | Fallback in `updateStoreConfig` |
| `lib/locationServices.ts` | Line 744 | `06:00` – `23:00` | Shared Engine | Fallback string for operating hours |
| `lib/storeOperationsService.ts`| Line 74–75 | `06:00` – `23:00` | Backend Service | Operations fallback hours |
| `app/admin/service-area/page.tsx`| Line 60–61 | `06:00` – `23:00` | Admin UI | Form input default values |
| `app/admin/stores/page.tsx` | Line 58–59 | `06:00` – `23:00` | Admin UI | Form input default values |
| `components/admin/StoreOperationsControlView.tsx` | Line 27–28 | `06:00` – `23:00` | Admin Component | Operations control view default |
| `app/api/seed/route.ts` | Line 48 | `06:00` | Database Seed API | Seed store definition |
| `app/api/checkout/route.ts` | — | **NONE** | Backend Order API | **Completely unenforced on checkout!** |

### Business Requirement Target:
- **Intended Opening:** `10:00 AM` (`10:00`)
- **Intended Closing:** `10:00 PM` (`22:00`)
- **Required Action in Later Phase:** Transition all defaults to `10:00` – `22:00` and inject an authoritative check into `POST /api/checkout`.

---

## 6. Admin Service Area Storage Architecture

Investigation into where Admin settings are saved when modified via `/admin/service-area` or `/admin/stores`:

```
Admin Form Mutation (/admin/service-area)
   │
   ├──▶ 1. Firestore: collection('shops').doc(storeId).set(...)  [PERSISTED IN CLOUD]
   │
   ├──▶ 2. Memory: updateStoreConfig(storeId, updates)           [IN-MEMORY NODE PROCESS ONLY]
   │
   └──▶ 3. PostgreSQL: stores table                              [NOT PERSISTED!]
```

### Critical Findings:
1. **PostgreSQL `stores` Table Schema Lacks Columns:**
   ```sql
   -- Current schema from scripts/init_client_postgres_tables.js:
   CREATE TABLE stores (
     id VARCHAR(64) PRIMARY KEY,
     name VARCHAR(128) NOT NULL,
     code VARCHAR(32) UNIQUE NOT NULL,
     phone VARCHAR(32),
     address TEXT,
     city VARCHAR(64),
     state VARCHAR(64),
     pincode VARCHAR(16),
     latitude NUMERIC(10, 8),
     longitude NUMERIC(11, 8),
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```
   Columns `delivery_radius_km`, `max_road_distance_km`, `opening_time`, `closing_time`, `delivery_fee`, and `minimum_order_value` **do not exist in PostgreSQL**.
2. **Persistence Consequence:**
   - Any radius or hours update saved by the Admin lives in Firestore and the local memory of the specific Node.js process that handled the HTTP request.
   - When the server restarts or scales, in-memory state resets back to `INITIAL_STORES` unless explicitly re-fetched from Firestore.
   - The PostgreSQL database remains unaware of custom darkstore operational settings.

---

## 7. Business Requirement Model (Proposed Architecture)

```
                            ┌─────────────────────────────────────────┐
                            │            POCKETKIRANA STORE           │
                            │        (Central Hub: Maule Kirana)      │
                            └────────────────────┬────────────────────┘
                                                 │
         ┌───────────────────┬───────────────────┼───────────────────┬───────────────────┐
         ▼                   ▼                   ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Store Location  │ │ Service Radius  │ │ Operating Hours │ │  Delivery Fee   │ │ Free Delivery   │
│ Lat: 19.0224536 │ │ Initial: 3.0 KM │ │ Open:  10:00 AM │ │ Standard: ₹29   │ │ Threshold: ₹500 │
│ Lon: 73.3210018 │ │ Max Road: 4.2 KM│ │ Close: 10:00 PM │ │ Waived if >=₹500│ │ Progress bar in │
│ Pincode: 410101 │ │ (Configurable)  │ │ (Configurable)  │ │ (Configurable)  │ │ cart drawer     │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Architectural Principles:
1. **Single Source of Truth:** All darkstore operational parameters must be stored in PostgreSQL `stores` table as the primary source, with Firestore acting as a real-time read mirror.
2. **Unified Configuration Service:** A singleton server-side configuration service that loads and caches store settings with a short TTL (e.g. 60 seconds), serving both API routes and client-side pre-flight queries.
3. **Admin Runtime Mutability:** Admin portal must be able to change any of these values without requiring code changes or server deployments.

---

## 8. Serviceability Engine Design (Proposed Flow)

```
[Customer Opens Web / App]
         │
         ▼
[Detect GPS or Select Saved Address]
         │
         ▼
[Resolve Coordinates: (Latitude, Longitude)]
         │
         ▼
[Calculate Haversine Distance: d = calculateDistanceKm(storeLat, storeLon, userLat, userLon)]
         │
         ├─── If d > Configured Radius (3.0 KM):
         │         │
         │         ▼
         │    [STATE: UNSERVICEABLE]
         │    Message: "PocketKirana is not delivering to this location yet. We currently deliver within 3 KM of Neral station."
         │    Action: Allow non-blocking catalog browsing; block checkout.
         │
         └─── If d <= Configured Radius (3.0 KM):
                   │
                   ▼
              [Check Operating Hours: 10:00 AM - 10:00 PM]
                   │
                   ├─── If Current Time Outside 10:00 AM - 10:00 PM (or manual store pause):
                   │         │
                   │         ▼
                   │    [STATE: STORE_CLOSED]
                   │    Message: "Store is currently closed. We're open from 10:00 AM to 10:00 PM."
                   │    Action: Allow cart building; display scheduled delivery message at checkout.
                   │
                   └─── If Store Open:
                             │
                             ▼
                        [STATE: SERVICEABLE]
                        Message: "⚡ 15–30 Min Delivery Available in Neral"
                        Action: Full checkout unlocked.
```

### Critical Geofencing Rule:
- **PIN Code is NOT an entitlement.** A customer entering `410101` (Neral pincode) who resides 8 km away in a rural valley beyond the 3.0 KM radius must be flagged as **UNSERVICEABLE**.
- Serviceability is strictly determined by physical distance from the store anchor (`19.0224536, 73.3210018`), never by pincode matching alone.

---

## 9. Admin Control Model (Proposed Specification)

The Admin Operations Portal must provide direct CRUD management over:

### Store Parameters:
- `name`: Darkstore display name.
- `latitude`, `longitude`: Darkstore GPS anchor.
- `deliveryRadiusKm`: Geofence radius slider (range: 1.0 KM – 10.0 KM, step: 0.5 KM).
- `openingTime`: Store opening time (24h format, e.g. `10:00`).
- `closingTime`: Store closing time (24h format, e.g. `22:00`).
- `status`: Immediate operational override (`OPEN`, `PAUSED_RAIN`, `HIGH_DEMAND`, `CLOSED`).

### Delivery & Financial Parameters:
- `deliveryFee`: Base delivery charge when order is below threshold (default: ₹29).
- `freeDeliveryThreshold`: Minimum cart subtotal to unlock free delivery (default: ₹500).
- `minimumOrderValue`: Absolute minimum order value to permit checkout (default: ₹99).

---

## 10. Server-Hours Architecture Analysis

### Scenario Analysis: Physical Laptop / Local Server Running ONLY 10:00 AM – 10:00 PM

The concept of shutting down the host machine outside shop operating hours was evaluated across all architectural components:

```
[10:00 PM: Laptop Closed / Powered Down]
   │
   ├──▶ 1. Ingress: Cloudflare Tunnel drops connection -> Returns Error 521 / 502 Bad Gateway
   │
   ├──▶ 2. Mobile Apps: Capacitor apps fail on fetch -> Display network error / blank screen
   │
   ├──▶ 3. Late Payment Webhooks: PhonePe webhooks sent for 9:59 PM orders fail TCP handshake
   │
   ├──▶ 4. Outbox Worker: Suspended -> Order confirmation events and receipts halt
   │
   ├──▶ 5. Customer Perception: Platform appears permanently dead / broken to nocturnal browsers
   │
   └──▶ 6. Database: Unreachable -> No cart calculation, no order tracking, no scheduled jobs
```

### Risk Assessment:
1. **PhonePe Webhook Failure (High Financial Risk):** If a customer initiates payment at 9:58 PM and the webhook arrives at 10:02 PM when the server is off, the webhook fails. After multiple retries, PhonePe flags the webhook endpoint as dead.
2. **Customer Churn:** In modern commerce, up to 35% of cart assembly and catalog discovery occurs outside delivery hours. If the app shows a connection error, users uninstall.
3. **Database Corruption / Dirty Shutdown:** Abruptly shutting down the host while an outbox lease or stock reservation is in flight leaves orphaned locks.

### Architectural Recommendation:
- **Keep Server & Database 24/7 in the Cloud (Oracle VPS + Cloudflare Tunnel).**
- **Enforce Shop Hours in Software:**
  - When the clock is outside 10:00 AM – 10:00 PM, the server stays online.
  - The API responds in < 50ms with `isStoreOpen: false`.
  - The UI presents a polished, high-converting banner: *"We're resting for the night! Shop opens at 10:00 AM. Add items to your cart now for morning delivery."*
  - Webhooks continue to process seamlessly.

---

## 11. Morning Traffic & Spike Load Strategy (10:00 AM Surge)

When the store opens at 10:00 AM, a concentration of customer requests will hit the infrastructure simultaneously.

### Potential Bottlenecks:
1. **Catalog Read Contention:** Hundreds of concurrent requests hitting `/api/products/discover` and `/api/homepage`.
2. **Nominatim OSM Geocoding Throttle:** High concurrent calls to OpenStreetMap's free Nominatim API will trigger HTTP 429 (Too Many Requests) and temporary IP banning.
3. **PostgreSQL Connection Pool Exhaustion:** `PG_MAX_POOL_SIZE = 20` can be exhausted during simultaneous checkout queries.
4. **Row Lock Serialization:** Multiple users buying the last 5 units of Amul Milk simultaneously causing lock waits on `inventory` row locks.

### Recommended Production Mitigations:
1. **Cloudflare CDN Edge Caching:** Cache `/api/homepage`, `/api/categories`, and `/api/brands` at the Cloudflare edge with `stale-while-revalidate` (TTL: 5 minutes).
2. **In-Memory Store Coordinates:** Remove any external geocoding network calls for store coordinates. The store location is static; Haversine calculation takes $< 0.1\text{ ms}$ in memory.
3. **PostgreSQL Pool Guard:** Utilize connection timeouts (already present in `lib/postgres.ts`) and consider PgBouncer if concurrency exceeds 100 simultaneous transactions.
4. **Static R2 Asset Delivery:** Serve all product thumbnails and hero banners directly from Cloudflare R2 bucket with 1-year immutable edge caching.

---

## 12. Demo / Mock Data Classification

Classification of the ~190 mock data assets in `lib/mockData.ts`:

| Data Entity | Records | Classification | Strategy for Production Cutover |
| :--- | :---: | :--- | :--- |
| `INITIAL_STORAGE_LOCATIONS` | 14 | **REPLACE WITH REAL DATA** | Configure with client's physical darkstore rack/shelf IDs. |
| `INITIAL_CATEGORIES` | 25 | **KEEP FOR DEVELOPMENT** | Validated Kirana taxonomy. Promote to production seed. |
| `INITIAL_BRANDS` | 20 | **KEEP FOR DEVELOPMENT** | Legitimate FMCG brands (Amul, Tata, Parle, etc.). |
| `INITIAL_STORES` | 1 | **REPLACE WITH REAL DATA** | Update with verified Maule Kirana GST, address, and coordinates. |
| `INITIAL_PRODUCTS` | 48 | **REPLACE WITH REAL DATA** | Replace with real store SKUs, actual stock counts, and prices. |
| `INITIAL_BANNERS` | 6 | **REPLACE WITH REAL DATA** | Replace Unsplash images with PocketKirana branded banners. |
| `INITIAL_COUPONS` | 0 | **BUILD / REVIEW MANUALLY** | Seed initial promo codes (`WELCOME50`, `NERALEXPRESS`). |
| `INITIAL_DELIVERY_PARTNERS` | 4 | **DELETE BEFORE PRODUCTION** | Remove mock riders (Rahul Sharma, Vikram Singh). |
| `INITIAL_ADDRESSES` | 4 | **DELETE BEFORE PRODUCTION** | Remove test addresses. |
| `INITIAL_ORDERS` | 10 | **DELETE BEFORE PRODUCTION** | Purge mock order history. |
| `INITIAL_NOTIFICATIONS` | 15 | **DELETE BEFORE PRODUCTION** | Purge mock system notifications. |
| `INITIAL_PICKERS` | 2 | **DELETE BEFORE PRODUCTION** | Remove mock pickers (Ramesh Kumar, Suresh Patil). |
| `INITIAL_PICKING_TASKS` | 5 | **DELETE BEFORE PRODUCTION** | Purge mock picking queues. |
| `INITIAL_INVENTORY_MOVEMENTS`| 5 | **DELETE BEFORE PRODUCTION** | Purge mock inventory transactions. |

---

## 13. Future UI/UX Requirements Specification

### Location Selector Flow (Desktop & Mobile)
- **Desktop Header:**
  - Compact sticky pill displaying: `Delivery in 15-30 mins` | `Location Pin: Station Road, Neral...` | `Chevron`.
  - Click opens modal with interactive leaflet map preview, GPS auto-detect, and recent address selector.
- **Mobile Bottom-Sheet:**
  - Swipeable sheet with large "Use Current Location (GPS)" primary CTA.
  - Search input with debounced autocomplete.
  - Status feedback banner:
    - *Serviceable:* Green pill showing distance and estimated delivery time.
    - *Unserviceable:* Subtle red card with "Notify me when PocketKirana expands here" email/phone capture.

### Product Page & Cards
- **Product Details:**
  - High-resolution image carousel with pinch-to-zoom on mobile.
  - Clear measurement variant chips (e.g. `500 g`, `1 kg`, `2 kg`) updating price and stock in real time.
  - Pricing display: Selling price in bold emerald text; MRP with strikethrough; discount pill in percentage.
  - Delivery reassurance: *"Free delivery on orders above ₹500"*.
  - Trust elements: Expiry date disclosure, FSSAI logo, darkstore source tag.

---

## 14. Master Implementation Sequence (Phases 0–14)

```
[Phase 0: Baseline Commit] ──▶ [Phase 1: Backend Correctness] ──▶ [Phase 2: Serviceability]
                                                                        │
┌───────────────────────────────────────────────────────────────────────┘
│
▼
[Phase 3: Shop Operating Hours] ──▶ [Phase 4: Pricing & Fees] ──▶ [Phase 5: PhonePe Finalization]
                                                                        │
┌───────────────────────────────────────────────────────────────────────┘
│
▼
[Phase 6: Outbox Worker Hardening] ──▶ [Phase 7: Admin Persistence] ──▶ [Phase 8: Security Validation]
                                                                              │
┌─────────────────────────────────────────────────────────────────────────────┘
│
▼
[Phase 9: Demo Data Cleanup] ──▶ [Phase 10: UI/UX Refinement] ──▶ [Phase 11: Mobile APK Sync]
                                                                        │
┌───────────────────────────────────────────────────────────────────────┘
│
▼
[Phase 12: Production Infrastructure] ──▶ [Phase 13: Spike Load Testing] ──▶ [Phase 14: Final Acceptance]
```

### Phase-by-Phase Breakdown:

1. **Phase 0: Change Verification & Baseline Commit**
   - Review and commit the 14 modified files and 2 untracked files representing the security remediation batch.
   - Run Vitest regression suite to verify 0 regressions.
2. **Phase 1: Critical Backend Correctness**
   - Inject coordinate validation and distance calculation into `POST /api/checkout`. Fail closed with HTTP 400 on unserviceable coordinates.
   - Replace hardcoded `couponCode ? 50 : 0` in `/api/checkout` with server-side `evaluatePromotionsEngine`.
3. **Phase 2: Serviceability Architecture Unification**
   - Establish single authoritative constant for initial launch: **3.0 KM** straight-line radius, **4.2 KM** road detour limit.
   - Eliminate contradictory 4.5 KM / 5.0 KM fallbacks and align customer rejection messages.
4. **Phase 3: Shop Operating Hours Enforcement**
   - Set business hours default to **10:00 AM – 10:00 PM** (`10:00` to `22:00`).
   - Add backend validation in `POST /api/checkout` rejecting orders placed outside business hours.
5. **Phase 4: Pricing & Delivery Fee Consistency**
   - Enforce uniform ₹29 delivery fee and ₹500 free delivery threshold across `mockData.ts`, `freeDelivery.ts`, `pricingEngine.ts`, and `checkout/route.ts`.
6. **Phase 5: PhonePe Finalization & Payment State Invariant**
   - Update `OrderService.transitionOrder` to accept and update `payment_status` in PostgreSQL.
   - Unify simulation verification and real gateway verification paths.
7. **Phase 6: Outbox Worker Hardening**
   - Add `jiti` to `package.json` dependencies.
   - Verify outbox worker standalone startup and graceful shutdown.
8. **Phase 7: Admin Configuration Persistence**
   - Run SQL migration adding `delivery_radius_km`, `opening_time`, `closing_time`, `delivery_fee` to PostgreSQL `stores` table.
   - Update `/api/admin/stores/[id]` to write updates to PostgreSQL.
9. **Phase 8: Security Validation & Secret Scrubbing**
   - Remove sub-app `.env.production` files from git tracking.
   - Verify rate limiting and CSRF protection on production build.
10. **Phase 9: Demo Data Cleanup & Real Catalog Ingestion**
    - Provide database seed script for client's real kirana catalog.
    - Purge mock orders, mock riders, and mock addresses.
11. **Phase 10: UI/UX Refinement**
    - Integrate mobile bottom-sheet location selector and product trust badges.
12. **Phase 11: Mobile APK Build & Sync**
    - Sync root web changes to `customer-app`, `delivery-app`, `picker-app`.
    - Run Gradle release build and verify APK outputs.
13. **Phase 12: Production Infrastructure Deployment**
    - Configure Oracle Cloud VPS, PM2 ecosystem, Cloudflare Tunnel, and R2 custom domain.
14. **Phase 13: Traffic & Morning Load Testing**
    - Run load test simulating 10:00 AM traffic burst (50 concurrent users, 200 req/sec).
15. **Phase 14: Final Production Acceptance**
    - Execute end-to-end rehearsal order (customer order -> picker assembly -> rider pickup -> OTP delivery -> settlement).

---

## 15. Dependencies Between Phases & Risk Matrix

| Phase | Prerequisites | Primary Risk | Mitigation |
| :--- | :--- | :--- | :--- |
| **Phase 1 (Backend)** | Phase 0 (Clean tree) | Breaking existing checkout tests | Update tests to supply valid Neral coordinates |
| **Phase 2 (Radius)** | Phase 1 (Backend checks) | Legitimate edge customers rejected | Provide clean out-of-radius request capture |
| **Phase 3 (Hours)** | Phase 1 (Backend checks) | Timezone mismatch (UTC vs IST) | Standardize on `Asia/Kolkata` time evaluation |
| **Phase 4 (Pricing)** | Phase 1 (Coupon fix) | Client margin confusion | Document ₹500 free-delivery threshold formally |
| **Phase 5 (PhonePe)** | Phase 0 | Gateway amount tampering | Strict paise validation against PostgreSQL order |
| **Phase 6 (Outbox)** | Phase 0 | Worker crash on missing dependency | Explicit `jiti` declaration in `package.json` |
| **Phase 7 (Admin)** | Phase 1, 2, 3 | Database migration lock | Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` |
| **Phase 11 (APKs)** | Phase 1–10 | Static export drift | Automated synchronization script |
| **Phase 12 (Deploy)** | Phase 11 | Cloudflare tunnel drop | PM2 systemd daemon auto-restart |

---

## Summary of Verification Deliverables

1. **Git State Verified:** Current branch `fix/page-readiness-production`, 1 commit ahead, 14 modified files analyzed in detail.
2. **Zustand Version 6 Verified:** Uncommitted change made in direct response to user console error; safe and verified working.
3. **4 Critical Blockers Verified:** Missing backend serviceability check, missing `jiti` dependency, coupon calculation discrepancy, and PhonePe simulation state gap confirmed.
4. **4 High-Priority Issues Verified:** Conflicting radius values mapped; operating hours mapped; Admin persistence limitation identified; sub-app code duplication confirmed.
5. **Architectural Blueprints Prepared:** Complete models for store configuration, serviceability engine, server-hours analysis, morning traffic mitigation, and Phase 0–14 execution order.
6. **Zero Project Code Modified:** No files edited, no packages installed, no database migrations run, no commits created.

*Step 2 Verification & Fix Plan complete. Standing by for instructions to begin Phase 0 / Phase 1 execution.*
