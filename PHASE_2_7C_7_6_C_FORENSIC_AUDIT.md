# Phase 2.7C.7.6-C — Admin Service-Area Firestore Split-Brain Forensic Audit

**Document ID:** `PHASE_2_7C_7_6_C_FORENSIC_AUDIT.md`  
**Phase:** Phase 2.7C.7.6-C (Admin Service-Area Firestore Split-Brain Forensic Audit)  
**Execution Timestamp:** 2026-10-04T06:40:00+05:30  
**Repository:** `PocketKirana`  
**Execution Mode:** STRICT AUDIT / DESIGN ONLY (Zero code modifications, zero database mutations, zero migrations, zero deletions, zero deployments)  
**Baseline Commit / HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`  

---

## 1. Executive Summary

This forensic audit executes Phase 2.7C.7.6-C to investigate the operational disconnect and potential split-brain architecture between the administrative service-area management UI (`app/admin/service-area/page.tsx`) and the canonical PostgreSQL transactional backend (`stores` table post-Migration 002).

Following the successful completion and approval of Phase 2.7C.1 through Phase 2.7C.7.6-B:
- **Canonical Customer Authority:** Customer serviceability evaluation (`GET /api/serviceability/check`), web checkout (`app/checkout/page.tsx`), mobile address onboarding (`customer-app/app/setup-address/page.tsx`), and transactional order placement (`POST /api/checkout`) are 100% authoritative and powered by PostgreSQL `stores` via `lib/serverServiceability.ts`.
- **Legacy Firebase Order Authority Eliminated:** In Phase 2.7C.7.6-A, Cloud Function `placeOrder` was decommissioned and rejected at entry (`501 Not Implemented`).
- **Advisory Alignment Complete:** In Phase 2.7C.7.6-B, `LocationPermissionGuard` and `locationFlowService` were re-pointed to canonical `GET /api/serviceability/check`.

However, this forensic audit reveals a critical administrative disconnect:
1. **Administrative Illusion of Control:** The Admin Service Area UI (`app/admin/service-area/page.tsx`) loads store configuration from Firestore (`fetchShopsFS()`) and saves configuration changes exclusively to Firestore (`saveShopConfigFS()`) and in-memory client state (`STORES_STATE`). It makes **0 requests to PostgreSQL** and **0 requests to any backend API**.
2. **Complete Operational Disconnect:** Any operational change made by an administrator—including toggling store active/disabled status, expanding or contracting the delivery radius, adjusting delivery fees, or updating store opening/closing hours—is written solely to Firestore `shops/{shopId}`. Because customer serviceability and checkout read exclusively from PostgreSQL `stores`, **admin modifications made in the service-area UI have zero effect on customer order placement, serviceability, delivery fees, or operational hours**.
3. **Severe Coordinate Vulnerability:** Store latitude and longitude can be edited by any administrator directly in standard numeric input fields on the service-area page, even while the UI toggle displays "Location Locked". No developer-only authorization, one-time token, server-side gate, or persistent PostgreSQL audit trail exists for coordinate changes.
4. **Schema Constraint Mismatch:** The Admin Service Area UI allows configuring delivery radius from 1.0 km to 15.0 km in increments of 0.5 km. However, PostgreSQL enforces a strict check constraint: `CHECK (delivery_radius_km IN (3.00, 4.00, 5.00))`. Directly piping UI inputs to PostgreSQL without an API mediation and validation layer would crash with constraint violation errors.
5. **Divergent Field Retirement:** The Admin UI continues to expose a "Min. Order (₹)" input defaulting to ₹199, whereas PostgreSQL Migration 002 permanently retired minimum order values to ₹0.00 (`minimum_order_value = 0.00`).
6. **Unenforced RBAC Assignments:** While Migration 002 created the relational table `admin_store_assignments`, it currently holds 0 rows and is checked by 0 application routes.

---

## 2. Baseline Commit

- **Git Commit SHA:** `63dba5363579334b67e4ac9a401d94060be244bf`
- **Branch:** `main` (or tracking branch)
- **Local Modifications:** Active working tree contains Phase 2.7C.7.6-A and 2.7C.7.6-B remediations. Zero modifications have been made during Phase 2.7C.7.6-C.

---

## 3. Admin Service-Area Flow

### Complete Execution Architecture

```text
Admin User Browser
    │
    ▼
Next.js Edge Middleware (middleware.ts)
    │  [Verifies Firebase ID token / session cookie for role: 'admin']
    ▼
app/admin/service-area/page.tsx
    │
    ├── 1. On Mount (Load Flow):
    │      ├── fetchShopsFS() [@/lib/firebaseServices.ts:1250]
    │      │     └── Firestore: getDocs(collection(firestore, 'shops'))
    │      ├── setStoresState(shops) [@/lib/locationServices.ts:24]
    │      │     └── Mutates in-memory STORES_STATE array in browser memory
    │      ├── fetchServiceRequestsFS() [@/lib/firebaseServices.ts]
    │      │     └── Firestore: getDocs(collection(firestore, 'serviceRequests'))
    │      └── Populates local React state (storeName, lat, lng, deliveryRadiusKm, deliveryFee, etc.)
    │
    ├── 2. Interactive Editing:
    │      ├── Location Pin Drag (InteractiveMapCanvas)
    │      │     └── Guarded by client-side boolean `isLocationLocked`
    │      │     └── Calls resolveLocationFromCoords (OpenStreetMap Nominatim reverse geocode)
    │      ├── Coordinate Inputs (Lines 351–373):
    │      │     └── Direct numeric inputs for Lat & Lng
    │      │     └── ⚠️ NOT GUARDED by `isLocationLocked`! Any admin can type new coordinates
    │      ├── Radius Slider (Lines 376–399):
    │      │     └── Range slider: min=1, max=15, step=0.5
    │      └── Hours / Fee / Status Buttons (Lines 303–347, 401–420)
    │
    └── 3. On Save (handleSaveServiceArea, Lines 123–154):
           ├── updateStoreConfig(updatedStore.id, updatedStore) [@/lib/locationServices.ts:34]
           │     └── Mutates in-memory STORES_STATE in current browser tab only
           ├── saveShopConfigFS(updatedStore) [@/lib/firebaseServices.ts:1312]
           │     └── Firestore: setDoc(doc(firestore, 'shops', shop.id), { ...shop, updatedAt })
           ├── addAuditLog('UPDATE_SERVICE_AREA', 'Store', updatedStore.id) [@/lib/store.ts]
           │     └── Appends entry to client-side Zustand store (lost on page reload)
           └── showToast('Store settings & ... KM service area saved!', 'success')
```

### Trace Analysis Findings

1. **Zero PostgreSQL Integration:** Neither `pg`, nor `getPostgresPool`, nor any server API route (`/api/*`) is imported or called by `app/admin/service-area/page.tsx`.
2. **Zero Server-Side Action / Route Handler:** All writes occur directly from the browser to Firestore using client Firebase SDK credentials.
3. **Downstream Impact on Customer App:** Because customer serviceability (`GET /api/serviceability/check`) and customer checkout (`POST /api/checkout`) query PostgreSQL `stores` directly, updates saved in `app/admin/service-area/page.tsx` never reach customer-facing systems.

---

## 4. Firestore Write Analysis

### Investigation of `saveShopConfigFS()`

- **File & Line:** `lib/firebaseServices.ts:1312–1324`
- **Signature:** `export async function saveShopConfigFS(shop: Store): Promise<boolean>`
- **Implementation:**
  ```typescript
  export async function saveShopConfigFS(shop: Store): Promise<boolean> {
    const firestore = getFirestoreInstance();
    if (!firestore || !shop || !shop.id) return false;

    try {
      const docRef = doc(firestore, COLLECTIONS.SHOPS, shop.id);
      await setDoc(docRef, { ...shop, updatedAt: new Date().toISOString() }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error saving shop config to Firestore:', error);
      return false;
    }
  }
  ```
- **Callers in Repository:** Exactly **1 caller**: `app/admin/service-area/page.tsx:145`.
- **Target Document:** Firestore collection `shops`, document ID = `shop.id` (typically `'store-1'` from `INITIAL_STORES[0]`).
- **Data Payload Written:**
  - `id`: string
  - `name`: string
  - `address`: string
  - `latitude`: number
  - `longitude`: number
  - `deliveryRadiusKm`: number (1.0 to 15.0)
  - `minimumOrderValue`: number
  - `deliveryFee`: number
  - `openingTime`: string (`HH:mm`)
  - `closingTime`: string (`HH:mm`)
  - `status`: `'active' | 'inactive' | 'maintenance'`
  - `updatedAt`: ISO timestamp string

### Other Firestore Store Helpers in `lib/firebaseServices.ts`
- `updateShopLocationAndRadiusFS` (line 1326): **0 callers** across entire repository.
- `fetchShopFS` (line 1296): **0 callers** across entire repository.
- `subscribeShopsFS` (line 1272): **0 callers** across entire repository.

---

## 5. PostgreSQL Canonical Analysis

### Canonical PostgreSQL `stores` Schema (Post-Migration 002)

| Column Name | Data Type | Nullable | Default | Constraints & Rules |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `code` | `varchar(50)` | NO | None | Unique constraint `stores_code_key` |
| `name` | `varchar(255)` | NO | None | Darkstore display name |
| `address_line1` | `text` | NO | None | Physical address line 1 |
| `address_line2` | `text` | YES | None | Physical address line 2 |
| `city` | `varchar(100)` | NO | None | Store city |
| `state` | `varchar(100)` | NO | None | Store state |
| `postal_code` | `varchar(20)` | NO | None | Store postal code (e.g. `410101`) |
| `latitude` | `numeric(10, 7)` | NO | None | Permanent store latitude (`19.0224536`) |
| `longitude` | `numeric(10, 7)` | NO | None | Permanent store longitude (`73.3210018`) |
| `is_active` | `boolean` | NO | `true` | Operational status (checked by checkout & serviceability) |
| `opening_time` | `time` | NO | `'06:00:00'` | CHECK constraint: `opening_time < closing_time` |
| `closing_time` | `time` | NO | `'23:30:00'` | Operational closing cutoff |
| `delivery_radius_km` | `numeric(4, 2)` | NO | `5.00` | **CHECK (`delivery_radius_km IN (3.00, 4.00, 5.00)`)** |
| `delivery_fee` | `numeric(10, 2)` | NO | `15.00` | CHECK (`delivery_fee >= 0.00`) |
| `free_delivery_enabled` | `boolean` | NO | `true` | Migration 002 canonical free delivery toggle |
| `free_delivery_threshold` | `numeric(10, 2)` | NO | `499.00` | CHECK (`free_delivery_threshold >= 0.00`) |
| `delivery_fee_tiers` | `jsonb` | NO | `[]` | Distance / cart tier rules (default empty array) |
| `minimum_order_value` | `numeric(10, 2)` | NO | `0.00` | Retired in Phase 2.6 (`CHECK >= 0.00`, set to `0.00`) |
| `created_at` | `timestamptz` | NO | `now()` | Audit creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Audit update timestamp |

### Key Observations & Constraints
1. **Radius Check Constraint:** In PostgreSQL, `delivery_radius_km` MUST be either `3.00`, `4.00`, or `5.00`. Any write attempting to persist `1.5`, `2.0`, `6.0`, or `10.0` km will trigger a database error: `violates check constraint "check_stores_delivery_radius"`.
2. **Minimum Order Value Retired:** PostgreSQL stores `minimum_order_value = 0.00` to reflect zero-friction checkout. The Admin Service Area UI still prompts for `Min. Order (₹)` with default ₹199.
3. **Free Delivery Authority:** PostgreSQL houses `free_delivery_enabled` and `free_delivery_threshold` (₹499.00). The Admin Service Area UI does not expose these fields at all.

---

## 6. Consumer / Caller Matrix

### Every Consumer of Store / Service-Area Configuration

| Consumer Component / Route | Configuration Read | Authority Source | Classification | Notes |
|---|---|---|---|---|
| `app/admin/service-area/page.tsx` | Lat, Lng, Radius, Hours, Fee, MinOrder, Status | Firestore `shops` collection via `fetchShopsFS()` | **B. Active Production Display / Advisory** | Reads Firestore `shops` on mount; writes Firestore `shops` on save. Completely disconnected from PostgreSQL. |
| `app/admin/stores/page.tsx` | Lat, Lng, Radius, Hours, Fee, RoadMultiplier, Status | In-memory `INITIAL_STORES` | **E. Dead / Unused (In-Memory Only)** | Mutates in-memory `STORES_STATE` only. Never writes to Firestore or PostgreSQL. |
| `app/api/admin/stores/route.ts` | List of stores | In-memory `getStores()` | **E. Dead / Unused (In-Memory Only)** | Exposes `STORES_STATE` to admin callers. |
| `app/api/admin/stores/[id]/route.ts` | Store details & updates | In-memory `updateStoreConfig()` | **E. Dead / Unused (In-Memory Only)** | Mutates in-memory `STORES_STATE` only. Never writes to PostgreSQL. |
| `app/api/admin/store/operations/route.ts` | Store status (`is_active`) | PostgreSQL `stores` table via `updateDarkstoreOperations()` | **A. Active Production Authority (Partial)** | Only updates `is_active`. Ignores `openingTime`, `closingTime`, `deliveryRadiusKm`. |
| `lib/serverServiceability.ts` | Lat, Lng, Radius, Hours, Fee, FreeDelivery, IsActive | PostgreSQL `stores` table | **A. Active Production Authority** | The sole canonical serviceability evaluator for the entire system. |
| `app/api/serviceability/check/route.ts` | Evaluated serviceability & fee | Calls `evaluateServerServiceability()` -> PostgreSQL `stores` | **A. Active Production Authority** | Sole canonical API for customer address and pre-checkout serviceability. |
| `app/api/checkout/route.ts` | Store coordinates, radius, fee, thresholds, status | Calls `evaluateServerServiceability()` -> PostgreSQL `stores` | **A. Active Production Authority** | Sole canonical order creation authority. |
| `customer-app/app/setup-address/page.tsx` | Serviceability check | Calls `GET /api/serviceability/check` -> PostgreSQL `stores` | **A. Active Production Authority** | Aligned in Phase 2.7C.7.5 (F-03). |
| `app/checkout/page.tsx` | Serviceability check | Calls `GET /api/serviceability/check` -> PostgreSQL `stores` | **A. Active Production Authority** | Aligned in Phase 2.7C.7.4 (F-02). |
| `customer-app/app/checkout/page.tsx` | Serviceability check | Calls `GET /api/serviceability/check` -> PostgreSQL `stores` | **A. Active Production Authority** | Aligned in Phase 2.7C.7.2 (F-01). |
| `LocationPermissionGuard.tsx` / `locationFlowService.ts` | Advisory serviceability check | Calls `GET /api/serviceability/check` -> PostgreSQL `stores` | **B. Active Production Display / Advisory** | Aligned in Phase 2.7C.7.6-B. |
| `functions/src/orders/placeOrder.ts` | Legacy store config | Decommissioned | **D. Test / Mock / Decommissioned** | Throws 501 Not Implemented in Phase 2.7C.7.6-A. |
| `functions/src/inventory/validateDeliveryZone.ts` | Lat, Lng, Radius, MinOrder | Firestore `settings/store` via `getStoreConfig()` | **D. Deprecated Cloud Function** | Zero active customer callers. |
| `app/api/checkout/validate/route.ts` | Radius, Fee | Legacy `fetchShopsFS()` wrapper | **D. Deprecated API** | Deprecated in Phase 2.7C.3; zero active production callers. |
| `app/api/checkout/validate-serviceability/route.ts` | Radius, Fee | Legacy `fetchShopsFS()` wrapper | **D. Deprecated API** | Deprecated in Phase 2.7C.3; zero active production callers. |

---

## 7. Determine Exactly What the Admin Page Controls

| Field | Current Source of Truth | Firestore Written? | PostgreSQL Written? | Production Consumer | Classification |
|---|---|---|---|---|---|
| **Store Identifier** | PostgreSQL `stores.id` (`store_primary`) | YES (`shops/{id}`) | **NO** | Admin Service Area display only | **Transitional mirror / Disconnected** |
| **Store Name** | PostgreSQL `stores.name` | YES | **NO** | Admin Service Area display only | **Transitional mirror / Disconnected** |
| **Store Physical Address** | PostgreSQL `stores.address_line1` | YES | **NO** | Admin Service Area display only | **Transitional mirror / Disconnected** |
| **Store Latitude** | PostgreSQL `stores.latitude` (`19.0224536`) | YES | **NO** | Admin map marker | **Transitional mirror / Disconnected (VULNERABILITY)** |
| **Store Longitude** | PostgreSQL `stores.longitude` (`73.3210018`) | YES | **NO** | Admin map marker | **Transitional mirror / Disconnected (VULNERABILITY)** |
| **Delivery Radius** | PostgreSQL `stores.delivery_radius_km` (`5.00`) | YES (1.0 to 15.0 km) | **NO** | Admin map radius circle | **Transitional mirror / Disconnected (CONSTRAINT MISMATCH)** |
| **Active Status** | PostgreSQL `stores.is_active` (`true`) | YES (`status: active/inactive/maintenance`) | **NO** | Admin status badge | **Transitional mirror / Disconnected** |
| **Opening Time** | PostgreSQL `stores.opening_time` (`06:00:00`) | YES (`06:00`) | **NO** | Admin UI inputs | **Transitional mirror / Disconnected** |
| **Closing Time** | PostgreSQL `stores.closing_time` (`23:30:00`) | YES (`23:00`) | **NO** | Admin UI inputs | **Transitional mirror / Disconnected** |
| **Delivery Fee** | PostgreSQL `stores.delivery_fee` (`15.00`) | YES (`15`) | **NO** | Admin UI input | **Transitional mirror / Disconnected** |
| **Free Delivery Enabled** | PostgreSQL `stores.free_delivery_enabled` (`true`) | **NO (Not in UI)** | **NO** | Canonical checkout & serviceability | **Canonical authority in PostgreSQL (Missing in Admin UI)** |
| **Free Delivery Threshold** | PostgreSQL `stores.free_delivery_threshold` (`499.00`) | **NO (Not in UI)** | **NO** | Canonical checkout & serviceability | **Canonical authority in PostgreSQL (Missing in Admin UI)** |
| **Minimum Order Value** | PostgreSQL `stores.minimum_order_value` (`0.00`) | YES (`minOrder: 199`) | **NO** | Admin UI input | **Obsolete / Retired (DB retired minimum order in Phase 2.6)** |
| **Road Multiplier** | Retired in Phase 2.7C.7.4 (F-02) | NO (in `admin/stores` only) | **NO** | None | **Obsolete / Retired** |
| **Out-of-Area Requests** | Firestore `serviceRequests` collection | YES (`updateServiceRequestStatusFS`) | **NO** | Admin waitlist table | **Transitional feature / Firestore only** |

---

## 8. Location Coordinate Safety

### Investigation of Rule: "Store latitude/longitude are permanent/protected."

1. **Can normal Admin currently modify coordinates?**
   - **YES.** In `app/admin/service-area/page.tsx:351–373`, `lat` and `lng` are exposed as editable `<input type="number">` fields. Any authenticated admin can enter arbitrary decimal coordinates and click "Save Changes".
2. **Does the UI lock prevent coordinate editing?**
   - **NO.** The button `isLocationLocked` (lines 201–213) only disables map pin dragging (`handlePositionChange`). The direct text inputs for latitude and longitude do not check `isLocationLocked` at all.
   - Furthermore, `isLocationLocked` is merely a local React state variable initialized to `true`. Clicking the button immediately toggles it to `false` without requiring any authentication, confirmation code, or password.
3. **Is there developer-only authorization?**
   - **NO.** There is zero check for developer credentials, super-admin privileges, or multi-factor confirmation.
4. **Is authorization server-side?**
   - **NO.** The write goes directly from browser to Firestore via `saveShopConfigFS()`. There is no server-side endpoint validating coordinate changes.
5. **Is it one-time / short-lived?**
   - **NO.**
6. **Is every coordinate change audited?**
   - **NO.** The audit logging in `app/admin/service-area/page.tsx:147` calls `addAuditLog('UPDATE_SERVICE_AREA', 'Store', updatedStore.id)`, which only appends to an in-memory Zustand store that is cleared upon browser refresh. There is zero persistent audit logging in PostgreSQL.

### Severity Rating
- **Current State:** **LOW** in production impact today solely because the write targets Firestore `shops`, which canonical checkout ignores.
- **Future Remediation State:** **CRITICAL RISK** if the Admin Service Area UI is wired directly to PostgreSQL without introducing server-side developer authorization and coordinate immutability protections.

---

## 9. RBAC / Admin Authorization

1. **Route-Level RBAC:**
   - Next.js edge middleware (`middleware.ts`) protects `/admin/*` by checking session cookies or verified Firebase ID tokens for `role === 'admin'`.
   - Users with roles `'picker'`, `'delivery_partner'`, or `'customer'` cannot load `app/admin/service-area/page.tsx`.
2. **Store-Level Authorization:**
   - `app/admin/service-area/page.tsx` contains **no store-scoping logic**. It assumes a single darkstore and loads the first item returned by `fetchShopsFS()` or `INITIAL_STORES[0]`.
   - Any user possessing the global `'admin'` role can modify all fields on the page.
3. **`admin_store_assignments` Status:**
   - Table exists in PostgreSQL `public.admin_store_assignments` with columns:
     - `id` (uuid, PK)
     - `admin_user_id` (uuid, FK -> `admin_users.id`)
     - `store_id` (uuid, FK -> `stores.id`)
     - `created_at` (timestamptz)
   - Table currently contains **0 rows**.
   - No application route or helper in `lib/routeAuth.ts` currently verifies `admin_store_assignments`.
4. **Firestore RBAC Bypass:**
   - Direct client writes to Firestore `shops` completely bypass PostgreSQL authentication, session validation, and database constraints.

---

## 10. Split-Brain Risk Analysis

### Divergence Scenarios

| Scenario | Admin Action in Service-Area UI | Firestore State | PostgreSQL State | Customer Impact |
|---|---|---|---|---|
| **Store Emergency Closure** | Admin clicks "🔴 Disabled" and saves | `shops.status = 'inactive'` | `stores.is_active = true` | **CRITICAL SPLIT-BRAIN:** Customers continue placing orders because `POST /api/checkout` reads PostgreSQL `stores.is_active`. Orders are accepted while the store believes it is closed. |
| **Delivery Radius Expansion** | Admin increases slider from 3 KM to 5 KM | `shops.deliveryRadiusKm = 5.0` | `stores.delivery_radius_km = 3.0` | **FALSE REJECTION:** Admin believes delivery radius was expanded. Customers at 4.2 KM are rejected by `POST /api/checkout` with `DELIVERY_RADIUS_EXCEEDED`. |
| **Delivery Radius Contraction** | Admin decreases slider from 5 KM to 3 KM | `shops.deliveryRadiusKm = 3.0` | `stores.delivery_radius_km = 5.0` | **UNWANTED ORDERS:** Admin intends to restrict delivery to 3 KM. Customers at 4.8 KM continue placing orders successfully. |
| **Delivery Fee Update** | Admin updates delivery fee from ₹15 to ₹25 | `shops.deliveryFee = 25` | `stores.delivery_fee = 15` | **PRICING DIVERGENCE:** Admin expects ₹25 fee. Checkout charges ₹15 based on PostgreSQL `stores.delivery_fee`. |
| **Store Relocation** | Admin moves store pin on map to new address | `shops.latitude = 19.0300`, `longitude = 73.3300` | `stores.latitude = 19.0224536`, `longitude = 73.3210018` | **GEOGRAPHIC SPLIT-BRAIN:** Admin UI map displays new location. Customer serviceability calculates distance from the old warehouse coordinates. |
| **Opening Hours Adjustment** | Admin sets opening time to 08:00 AM | `shops.openingTime = '08:00'` | `stores.opening_time = '06:00'` | **OPERATIONAL DIVERGENCE:** Store manager expects orders to start at 08:00 AM. Customers can place orders starting at 06:00 AM. |

---

## 11. Findings with Severity

### Finding F-06D.1 — Admin UI Writes to Firestore Instead of PostgreSQL (Severity: HIGH)
- **Description:** `app/admin/service-area/page.tsx` persists store configuration changes solely to Firestore `shops` collection via `saveShopConfigFS()`. PostgreSQL `stores` is never updated.
- **Impact:** Administrative settings have zero effect on customer checkout or serviceability. High operational confusion and split-brain risk.

### Finding F-06D.2 — Unprotected Store Coordinates (Severity: HIGH)
- **Description:** Store latitude and longitude can be edited via direct text inputs by any user with admin access. The "Location Locked" toggle is client-side only and does not protect text inputs.
- **Impact:** Accidental or unauthorized relocation of the store hub coordinates, which govern all customer distance calculations.

### Finding F-06D.3 — Schema Constraint Mismatch on Delivery Radius (Severity: MEDIUM)
- **Description:** The Admin UI slider allows setting `deliveryRadiusKm` to any value from 1.0 to 15.0 km (step 0.5). PostgreSQL Migration 002 enforces `CHECK (delivery_radius_km IN (3.00, 4.00, 5.00))`.
- **Impact:** If the UI directly updates PostgreSQL without mediation, any radius selection other than 3, 4, or 5 km will crash with a database check constraint violation.

### Finding F-06D.4 — Missing Free-Delivery Controls in Admin UI (Severity: MEDIUM)
- **Description:** PostgreSQL canonical schema includes `free_delivery_enabled` (boolean) and `free_delivery_threshold` (numeric, default 499.00). The Admin Service Area UI has no controls for these fields.
- **Impact:** Store managers cannot view or configure free-delivery eligibility from the service-area admin panel.

### Finding F-06D.5 — Retired Minimum Order Value Still Exposed (Severity: LOW)
- **Description:** The Admin UI exposes an input for `minimumOrderValue` defaulting to ₹199. PostgreSQL Migration 002 retired minimum order values to ₹0.00.
- **Impact:** Misleads administrators into believing a ₹199 minimum cart value is being enforced.

### Finding F-06D.6 — Missing Server-Side Persistent Audit Logging (Severity: MEDIUM)
- **Description:** Operational changes in `app/admin/service-area/page.tsx` are only recorded in a client Zustand store and lost on refresh.
- **Impact:** No persistent trail of who changed operational hours, fees, status, or radius.

---

## 12. Remediation Strategy Evaluation

We evaluate four architectural approaches for resolving the split-brain state:

### Option A: Keep Firestore Write as Transitional Mirror
- **Mechanism:** Maintain current behavior: UI writes to Firestore `shops`.
- **Pros:** Zero risk of breaking current PostgreSQL checkout.
- **Cons:** Leaves the Admin Service Area page completely non-functional as an operational tool. High risk of operator confusion.
- **Verdict:** REJECTED.

### Option B: Direct Client-to-PostgreSQL Writes
- **Mechanism:** Import PostgreSQL client directly into Next.js client component or server action.
- **Pros:** None.
- **Cons:** Violates Next.js architecture (client components cannot connect to database directly); exposes database connection credentials to browser bundle; bypasses API security layers.
- **Verdict:** REJECTED.

### Option C: Canonical PostgreSQL Admin API with Server-Side Validation and Firestore Mirror (RECOMMENDED)
- **Mechanism:**
  1. Create or upgrade a canonical server API endpoint: `PUT /api/admin/store/operations` (or `PUT /api/admin/stores/[id]`).
  2. The endpoint verifies:
     - Authentication and admin role via `requireRole(req, ['admin'])`.
     - Validates payload against PostgreSQL constraints:
       - `delivery_radius_km` must be strictly validated (`3.0`, `4.0`, or `5.0`).
       - `opening_time < closing_time`.
       - `delivery_fee >= 0`.
       - `free_delivery_threshold >= 0`.
     - **Coordinate Protection:** Prohibits modifying `latitude` or `longitude` unless a specific developer authorization secret/header (`x-pk-developer-override`) is provided. Otherwise, coordinates remain strictly immutable.
  3. Executes transactional `UPDATE stores SET ... WHERE id = $1` in PostgreSQL.
  4. Optionally writes a background transitional mirror to Firestore `shops` collection to keep any legacy advisory listeners synchronized.
  5. Records the operational change in PostgreSQL `audit_logs` or server logs.
  6. Updates `app/admin/service-area/page.tsx` to:
     - Fetch initial configuration from `GET /api/admin/store/operations` (or `GET /api/admin/stores/[id]`).
     - Submit updates to `PUT /api/admin/store/operations`.
     - Constrain radius slider/selector to valid allowed values (3, 4, 5 km).
     - Disable coordinate inputs permanently for standard admin users, displaying a "Protected System Coordinate" badge.
     - Add controls for `free_delivery_enabled` and `free_delivery_threshold`.
     - Remove or disable the retired `minimumOrderValue` field.
- **Pros:**
  - Establishes PostgreSQL as the sole canonical source of truth for both administration and checkout.
  - Strict server-side enforcement of check constraints prevents 500 database errors.
  - Hardens location coordinates against accidental modification.
  - Fully backward compatible with existing customer checkout flows.
- **Cons:** Requires updating the admin page and the admin operations API route.
- **Verdict:** **RECOMMENDED.**

### Option D: Decommission the Admin Service Area Page Entirely
- **Mechanism:** Delete `app/admin/service-area/page.tsx`.
- **Pros:** Eliminates the split-brain page.
- **Cons:** Destroys admin visibility of the live delivery radius, interactive map, and out-of-area customer waitlist inquiries.
- **Verdict:** REJECTED.

---

## 13. Exact Files Expected to Change in Implementation (Phase 2.7C.7.6-C Remediation)

When approved for implementation, the remediation will touch ONLY the following files:

1. `app/api/admin/store/operations/route.ts` (or `app/api/admin/stores/[id]/route.ts`)
   - Expand `PUT` handler to accept and validate canonical fields (`status`, `openingTime`, `closingTime`, `deliveryRadiusKm`, `deliveryFee`, `freeDeliveryEnabled`, `freeDeliveryThreshold`).
   - Validate radius constraint (`[3, 4, 5]`).
   - Guard `latitude` and `longitude` against modification without developer override.
   - Update PostgreSQL `stores` table via parameterized query.
2. `lib/storeOperationsService.ts`
   - Update `getDarkstoreOperationalStatus` to read actual canonical columns from PostgreSQL `stores` (`delivery_radius_km`, `opening_time`, `closing_time`, `delivery_fee`, `free_delivery_enabled`, `free_delivery_threshold`, `latitude`, `longitude`).
   - Update `updateDarkstoreOperations` to persist all canonical operational columns into PostgreSQL `stores`.
3. `app/admin/service-area/page.tsx`
   - Replace mount-time `fetchShopsFS()` with API fetch to `/api/admin/store/operations`.
   - Replace `saveShopConfigFS()` with `fetch('/api/admin/store/operations', { method: 'PUT', ... })`.
   - Update radius UI control to enforce canonical values (3, 4, or 5 km).
   - Lock coordinate fields (`lat`, `lng`) as read-only with a security shield indicator.
   - Add inputs for free-delivery configuration (`free_delivery_enabled`, `free_delivery_threshold`).
   - Retire the `minOrder` input.
4. `test/admin-service-area-canonical-alignment.test.ts` (NEW TEST FILE)
   - Comprehensive test suite validating canonical admin alignment, constraint enforcement, and coordinate protection.

---

## 14. Test Plan (For Future Remediation)

The future implementation must be verified with the following automated test cases:

1. **Test 1: Admin Authentication Enforcement**
   - Unauthenticated request to `PUT /api/admin/store/operations` returns `401/403 Forbidden`.
   - Authenticated non-admin user (e.g. `customer` or `delivery_partner`) returns `403 Forbidden`.
   - Authenticated `admin` user succeeds.
2. **Test 2: PostgreSQL Canonical Persistence**
   - Updating radius to `4.0` km updates `stores.delivery_radius_km` in PostgreSQL.
   - Updating status to `PAUSED` updates `stores.is_active = false` in PostgreSQL.
   - Updating delivery fee to `20.00` updates `stores.delivery_fee` in PostgreSQL.
   - Updating operating hours updates `stores.opening_time` and `stores.closing_time`.
3. **Test 3: Check Constraint Enforcement**
   - Submitting radius `6.0` km is rejected by API with `400 Bad Request` (does not reach DB).
   - Submitting `opening_time >= closing_time` is rejected with `400 Bad Request`.
   - Submitting negative delivery fee is rejected with `400 Bad Request`.
4. **Test 4: Coordinate Protection Guard**
   - Attempting to modify `latitude` or `longitude` without developer override returns `403 Forbidden` / `400 Coordinate modification rejected`. Coordinates remain unchanged in PostgreSQL.
5. **Test 5: Live Serviceability Reflection**
   - Admin changes store radius from 3 km to 4 km via API.
   - Immediate subsequent call to `GET /api/serviceability/check` for a customer at 3.5 km switches from `UNSERVICEABLE` to `SERVICEABLE`.
6. **Test 6: Live Checkout Reflection**
   - Admin toggles store status to `CLOSED` via API (`is_active = false`).
   - Immediate subsequent call to `POST /api/checkout` fails with `STORE_INACTIVE` or `UNSERVICEABLE`.
7. **Test 7: Regression Safeguards**
   - Zero PhonePe payment flow regression.
   - Zero inventory / FEFO reservation regression.
   - Zero outbox event pattern regression.
   - Zero Firebase Auth / FCM regression.

---

## 15. Rollback Strategy

If any issue arises during or after remediation implementation:
1. **API Rollback:** The API route `app/api/admin/store/operations/route.ts` and service `lib/storeOperationsService.ts` can be reverted to their previous commit state without requiring database rollbacks or data loss.
2. **UI Rollback:** `app/admin/service-area/page.tsx` can be reverted to the Firestore write state without impacting customer checkout (since checkout reads PostgreSQL).
3. **Database Safety:** PostgreSQL `stores` schema is already complete from Migration 002. No DDL migrations are executed in Phase 2.7C.7.6-C, meaning zero schema rollback is necessary.

---

## 16. Scope Protection

During Phase 2.7C.7.6-C, the following systems remain strictly out of scope and untouched:
- `POST /api/checkout` (Canonical checkout engine)
- `GET /api/serviceability/check` (Canonical serviceability check)
- `lib/serverServiceability.ts`
- PhonePe payment gateway integration
- Inventory management / FEFO stock reservation
- Outbox event publisher
- Firebase Auth & FCM messaging infrastructure
- Cloudflare R2 object storage
- PostgreSQL database schema and existing data

---

## 17. Database Safety

- **Database Mutations:** `0`
- **DDL Executed:** `0`
- **DML Executed:** `0`
- **Migrations Created or Executed:** `0`
- **PostgreSQL Data Preserved:** 100% untouched.

---

## 18. Deployment Safety

- **Code Changes:** `0`
- **Database Mutations:** `0`
- **Migrations:** `0`
- **Commits:** `0`
- **Pushes:** `0`
- **Deployments:** `0`

---

## 19. Final Gate & Summary

The forensic audit of Phase 2.7C.7.6-C is **COMPLETE**.

The investigation confirms that `app/admin/service-area/page.tsx` currently operates as a disconnected legacy client that writes solely to Firestore `shops`, having zero effect on the canonical PostgreSQL-backed customer serviceability and checkout systems.

Remediation has been fully designed under **Option C** (Canonical PostgreSQL Admin API with constraint validation and coordinate protection).

**STOP CONDITION SATISFIED:** No implementation code has been written. Awaiting user review and explicit approval before proceeding to implementation.
