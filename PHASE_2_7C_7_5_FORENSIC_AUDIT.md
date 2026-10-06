# Phase 2.7C.7.5 — Forensic Audit: Finding F-03 (Customer App Address Setup Zone Validation)

**Document ID:** `PHASE_2_7C_7_5_FORENSIC_AUDIT.md`  
**Phase:** Phase 2.7C.7.5 (Forensic Audit & Remediation Design — Finding F-03 Only)  
**Execution Timestamp:** 2026-10-02T19:56:00+05:30  
**Repository:** `PocketKirana`  
**Base Commit / HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`  
**Target Finding:** Finding F-03 from Phase 2.7C.5 / Phase 2.7C.6  
**Mode:** AUDIT / DESIGN ONLY — ZERO CODE MODIFICATIONS  

---

## 1. Executive Summary & Audit Status

### **Status: GREEN**

This forensic audit investigates Finding F-03: the Customer App address setup flow in `customer-app/app/setup-address/page.tsx` invoking `validateDeliveryZoneServerSide()`, which calls the Firebase Cloud Function `validateDeliveryZone` (backed by Firestore `settings/store`), with an offline fallback to hardcoded Maule Kirana coordinates (`19.0224536, 73.3210018`) and a 4.5 km radius.

The audit confirms:
1. **Competing Authority Confirmed:** `validateDeliveryZone` reads Firestore `settings/store` and hardcoded fallback defaults (`minimumOrderValue: 99`, `deliveryFee: 25`, `freeDeliveryThreshold: 299`, `deliveryRadiusKm: 3`, and boolean `isOpen`). It operates completely disconnected from PostgreSQL `stores` and `evaluateServerServiceability`.
2. **Single Production Caller:** `customer-app/app/setup-address/page.tsx:112` is the **ONLY** active production caller of `validateDeliveryZoneServerSide()`.
3. **Address Save Semantics:** Addresses ARE saved to user state (`saveOrUpdateAddress`) regardless of serviceability. If unserviceable, navigation is redirected to `/not-serviceable?dist=${dist}&lat=${lat}&lon=${lon}`.
4. **Canonical Replacement Feasibility:** Canonical `GET /api/serviceability/check?lat=...&lng=...&storeId=store-001` provides all data needed (`serviceable`, `distanceKm`, `maximumDistanceKm`, `message`) without changing or compromising PostgreSQL-backed canonical business rules.

---

## 2. Customer App Address Setup Flow Trace

**Target File:** `customer-app/app/setup-address/page.tsx`

```text
User initiates location detection (Capacitor GPS) or searches manually (Nominatim OSM)
                                ↓
Coordinates obtained: (latitude, longitude)
                                ↓
verifyAndNavigate(latitude, longitude, knownDisplay) invoked
                                ↓
Parallel Execution:
├─ Nominatim OSM reverse geocoding → geoDisplay string
└─ validateDeliveryZoneServerSide(latitude, longitude) [LEGACY AUTHORITY]
                                ↓
saveOrUpdateAddress(latitude, longitude, geoDisplay)
[Address persisted to Zustand addresses & localStorage pk_location_granted]
                                ↓
Serviceability Decision Evaluation:
├─ if (!zoneResult.isServiceable):
│    - Set status message: "Location is outside our 3 KM delivery radius in Neral."
│    - router.replace(`/not-serviceable?dist=${zoneResult.distanceKm}&lat=${latitude}&lon=${longitude}`)
│    - TERMINATE onboarding navigation
└─ if (zoneResult.isServiceable):
     - Set status message: "Location verified! Taking you to Pocket Kirana…"
     - router.replace('/home')
                                ↓
Error / Exception Handling:
└─ catch (err):
     - Logs error to console
     - Fallback: saveOrUpdateAddress(latitude, longitude, knownDisplay || 'Neral')
     - router.replace('/home') [Fails open to allow checkout gate to validate]
```

### Detailed Observations:
- **Invocation Location:** Line 112 in `verifyAndNavigate()`.
- **Arguments Passed:** `(latitude: number, longitude: number)` only. No store ID or subtotal.
- **Response Expected:** `ZoneServiceability` object containing:
  - `isServiceable: boolean`
  - `distanceKm: number`
- **Address Persistence:** The address is saved via `saveOrUpdateAddress` **BEFORE** evaluating `if (!zoneResult.isServiceable)`. Address creation itself is not blocked; rather, the user is redirected away from `/home` to `/not-serviceable`.
- **Checkout Impact:** If redirected to `/not-serviceable`, the customer cannot browse products or reach checkout via the standard onboarding path.
- **Store Selection:** The client passes no store ID; the legacy flow forces an implicit association with hardcoded Maule Kirana / store-001.

---

## 3. Forensic Analysis of `validateDeliveryZoneServerSide()`

**Definition File:** `lib/locationServices.ts` (Lines 879–960)

```typescript
export async function validateDeliveryZoneServerSide(
  latitude: number,
  longitude: number
): Promise<ZoneServiceability>
```

### Internal Implementation Details:
1. **Caching Layer:** Uses an in-memory `ZONE_CACHE` with a 5-minute TTL (`ZONE_CACHE_TTL = 5 * 60 * 1000`) keyed by `Math.round(latitude * 1000),Math.round(longitude * 1000)`.
2. **Cloud Function Call:**
   - Dynamically imports Firebase SDK (`firebase/functions`).
   - Obtains regional callable: `functions = getFunctions(app, 'asia-south1')`.
   - Calls `httpsCallable(functions, 'validateDeliveryZone')` passing `{ latitude, longitude }`.
3. **Response Remapping (Lines 908–925):**
   - Synthesizes `ZoneServiceability` using hardcoded defaults:
     - `storeId: 'store-001'`
     - `storeName: 'PocketKirana'`
     - `roadDistanceKm: Math.round(data.distanceKm * 1.3 * 10) / 10` (1.3× multiplier applied in client adapter!)
     - `deliveryFee: data.distanceKm <= 1 ? 0 : 25` (hardcoded ₹0 / ₹25 rule!)
4. **Catch / Fallback Branch (Lines 930–959):**
   - If Firebase is unconfigured, network times out, or Cloud Function fails:
     - Evaluates Haversine distance against hardcoded Maule Kirana anchor: `STORE_LAT = 19.0224536; STORE_LNG = 73.3210018;`.
     - Enforces a hardcoded radius: `DELIVERY_RADIUS_KM = 4.5;`.
     - Multiplies distance by `1.35` for `roadDistanceKm`.
     - Enforces hardcoded fee: `deliveryFee: 15`.
     - Synthesizes store identity: `'Maule Kirana'`, `'store-1'`.

---

## 4. Forensic Analysis of Firebase `validateDeliveryZone` Cloud Function

**Definition File:** `functions/src/inventory/validateDeliveryZone.ts` (Lines 18–57)  
**Export:** `functions/src/index.ts:19`  
**Trigger:** `onCall({ region: 'asia-south1', cors: true })`

### Business Rules & Dependencies:
1. **Firestore Source:** Calls `getStoreConfig()` from `functions/src/utils.ts:97`.
2. **Firestore Document:** Reads `db.collection('settings').doc('store')`.
3. **Firestore Fallback Defaults (if doc missing):**
   ```typescript
   {
     storeId: 'store-001',
     latitude: 19.0224536,
     longitude: 73.3210018,
     deliveryRadiusKm: 3,
     minimumOrderValue: 99,
     deliveryFee: 25,
     freeDeliveryThreshold: 299,
     isOpen: true,
     codEnabled: true,
   }
   ```
4. **Geographic Evaluation:** Pure Haversine straight-line distance (`haversineKm`).
5. **Eligibility Clause (Line 39):**
   `isServiceable = distanceKm <= config.deliveryRadiusKm && config.isOpen;`
   - Does NOT evaluate PostgreSQL store operating hours (`opening_time` / `closing_time`).
   - Uses a static boolean `config.isOpen` stored in Firestore document.
6. **Zero Integration with PostgreSQL:**
   - Does not query PostgreSQL `stores`.
   - Does not use `evaluateServerServiceability()`.
   - Does not respect PostgreSQL store radius configurations (which allow 3, 4, or 5 km).
   - Returns hardcoded text messages.

---

## 5. Repository-Wide Callers Audit

### 1. `validateDeliveryZoneServerSide`
| Caller File | Context | Classification |
| :--- | :--- | :--- |
| `customer-app/app/setup-address/page.tsx:112` | Address onboarding verification | **Active Customer App Production Caller** |
| `lib/locationServices.ts:879` | Function definition | Core definition |

*Result:* Exactly **one** active production caller in the entire repository.

### 2. `validateDeliveryZone` (Cloud Function)
| Caller File | Context | Classification |
| :--- | :--- | :--- |
| `lib/locationServices.ts:903` | Inside `validateDeliveryZoneServerSide` | Client SDK bridge to Cloud Function |
| `lib/functionsClient.ts:184` | Inside `callValidateDeliveryZone` | **Unused wrapper** (0 callers in entire repo) |
| `functions/src/inventory/validateDeliveryZone.ts:18` | Cloud Function implementation | Backend Cloud Function |
| `functions/src/index.ts:19` | Cloud Function export | Backend index export |

---

## 6. Canonical API Compatibility Analysis

The canonical evaluator endpoint `GET /api/serviceability/check` (`app/api/serviceability/check/route.ts`) is 100% compatible and directly supersedes `validateDeliveryZoneServerSide`:

| Parameter / Field | `validateDeliveryZoneServerSide()` | Canonical `GET /api/serviceability/check` | Compatibility |
| :--- | :--- | :--- | :--- |
| **Latitude Input** | `latitude` (number) | `lat` (query param) | **Identical** |
| **Longitude Input** | `longitude` (number) | `lng` (query param) | **Identical** |
| **Store Target** | Implicit / hardcoded | `storeId=store-001` (default) | **Identical** |
| **Eligibility Decision** | `isServiceable` (boolean) | `serviceable` (boolean) | **Direct match** (`serviceable`) |
| **Distance Value** | `distanceKm` (number) | `distanceKm` / `straightLineDistanceKm` | **Direct match** |
| **Radius Value** | `deliveryRadiusKm` (Firestore or 4.5 km) | `maximumDistanceKm` (PostgreSQL `stores`) | **Authoritative upgrade** |
| **Store Name** | Hardcoded `'PocketKirana'` / `'Maule Kirana'` | `storeName` (from PostgreSQL `stores.name`) | **Authoritative upgrade** |
| **Operating Hours** | Firestore static `isOpen` boolean | Canonical operating hours check | **Authoritative upgrade** |
| **Fee Information** | Hardcoded ₹25 or ₹15 | Canonical `resolveDeliveryFee` tier | **Authoritative upgrade** |

---

## 7. Address-Save Semantics & UX Considerations

1. **Can an address be saved even if outside radius?**
   **YES.** The current code explicitly calls `await saveOrUpdateAddress(latitude, longitude, geoDisplay)` on line 128 before checking `if (!zoneResult.isServiceable)`. This preserves the user's address so that if PocketKirana later expands delivery, or if the user browses out-of-zone, the address record is retained.
2. **Is serviceability supposed to be a preview during setup?**
   **YES.** Address setup validates whether the address is currently eligible for 10-minute delivery to determine routing:
   - Within service area → routes to `/home`.
   - Outside service area → routes to `/not-serviceable?dist=${dist}&lat=${lat}&lon=${lon}` to inform the customer and suggest service requests.
3. **Does `/not-serviceable` need to remain?**
   **YES.** The page `customer-app/app/not-serviceable/page.tsx` is an established user-facing screen that explains that the address is currently outside the delivery radius and provides buttons to change location or browse.
4. **Does checkout independently revalidate the address?**
   **YES.** When the customer subsequently places an order on either Web or Customer App, `POST /api/checkout` independently evaluates coordinates against PostgreSQL `stores` and `evaluateServerServiceability`. The address setup status never compromises the final order gate.

---

## 8. Security & Authority Analysis

### Vulnerabilities in Current Architecture:
1. **Split-Brain Configuration:** An administrator updating delivery radius or operating hours in PostgreSQL does not update Firestore `settings/store`. A customer living at 4.2 km (with a PostgreSQL store radius of 5.0 km) is falsely rejected by the Cloud Function at address setup and redirected to `/not-serviceable`.
2. **Hardcoded Fallbacks:** If Firebase callable encounters network latency, `validateDeliveryZoneServerSide` falls back to hardcoded `4.5 km` and `(19.0224536, 73.3210018)`, introducing non-authoritative client heuristics.
3. **Client-Side Multiplication:** Lines 916 and 946 inject artificial 1.3× and 1.35× road multipliers into the customer-facing metrics.

### Canonical Hardening:
By transitioning `customer-app/app/setup-address/page.tsx` to query `/api/serviceability/check`:
- Single Source of Truth: PostgreSQL `stores` governs serviceability.
- Zero Road Detour Factors: Pure Haversine straight-line distance is enforced.
- Store Radius Integrity: Store radius (3/4/5 km) comes authoritatively from the database.

---

## 9. Proposed Remediation Plan (Phase 2.7C.7.5 Implementation Design)

### Files to Modify:
1. **`customer-app/app/setup-address/page.tsx`**:
   - Remove:
     `import { validateDeliveryZoneServerSide } from '@/lib/locationServices';`
   - In `verifyAndNavigate`:
     Replace `validateDeliveryZoneServerSide(latitude, longitude)` with:
     ```typescript
     const res = await fetch(`/api/serviceability/check?lat=${latitude}&lng=${longitude}&storeId=store-001`);
     const zoneData = await res.json().catch(() => null);
     const isServiceable = zoneData?.serviceable ?? false;
     const distanceKm = zoneData?.distanceKm ?? zoneData?.straightLineDistanceKm ?? 0;
     const maxRadius = zoneData?.maximumDistanceKm ?? 3;
     ```
   - In status message:
     Replace hardcoded `"3 KM"` with dynamic `maxRadius`:
     `setStatusMessage(`Location is outside our ${maxRadius} KM delivery radius.`);`
   - In redirect:
     `router.replace(`/not-serviceable?dist=${distanceKm.toFixed(1)}&lat=${latitude}&lon=${longitude}`);`
   - In catch block:
     Preserve existing resilience: save address and navigate to `/home` (relying on `POST /api/checkout` to gate final order submission).
2. **`lib/locationServices.ts`**:
   - Add `@deprecated NON-AUTHORITATIVE: Replaced by canonical GET /api/serviceability/check` JSDoc annotation to `validateDeliveryZoneServerSide`.
   - Do NOT delete the function to ensure zero breakage of any standalone tools.
3. **`lib/functionsClient.ts`**:
   - Add `@deprecated` annotation to `callValidateDeliveryZone`.

### Proposed Tests (`test/checkout-f03-setup-address-canonical-serviceability.test.ts`):
1. `customer-app/app/setup-address/page.tsx` does NOT import or call `validateDeliveryZoneServerSide`.
2. `customer-app/app/setup-address/page.tsx` does NOT invoke Firebase callable `validateDeliveryZone`.
3. `customer-app/app/setup-address/page.tsx` queries `/api/serviceability/check` with coordinates.
4. Unserviceable coordinates redirect to `/not-serviceable` with canonical distance metric.
5. Serviceable coordinates redirect to `/home`.
6. Address is saved to Zustand store prior to routing.
7. Zero regressions on F-01, F-02, F-04, and F-05.

### Rollback Strategy:
If an issue occurs during implementation, revert `customer-app/app/setup-address/page.tsx` to restore the `validateDeliveryZoneServerSide` import and invocation.

---

## 10. Invariant Confirmations

- **Code Changes Made in this Phase:** **0** (Audit and design only)
- **Database Migrations Executed:** **0**
- **DDL / DML Queries Run:** **0**
- **Git Commits Created:** **0**
- **Deployments Triggered:** **0**

---

## 11. Final Audit Status

# **GREEN**

The forensic audit of Finding F-03 is complete. The exact mechanism, callers, failure points, and canonical remediation design are verified and ready for controlled implementation.
