# PocketKirana — Production Truth Matrix
**Version:** 1.0.0 (Phase 1.5 Specification)  
**Governance Framework:** FIVE-TIER PRODUCTION TRUTH  
**Target Delivery Date:** 12 September 2026  

---

## 1. The Five-Tier Production Truth Architecture

To avoid assumptions and deliver an enterprise-grade production platform on 12 September 2026, PocketKirana aligns all engineering decisions across five verifiable dimensions of truth:

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ 1. FILE TRUTH         │ Physical reality of assets in the repository      │
├───────────────────────┼───────────────────────────────────────────────────┤
│ 2. CODE TRUTH         │ Real runtime behavior, compilation & error states │
├───────────────────────┼───────────────────────────────────────────────────┤
│ 3. DATA TRUTH         │ Live state of PostgreSQL & Firestore persistence  │
├───────────────────────┼───────────────────────────────────────────────────┤
│ 4. BUSINESS TRUTH     │ End-to-end operational flows & SLA invariants     │
├───────────────────────┼───────────────────────────────────────────────────┤
│ 5. RELEASE TRUTH      │ Hard gating criteria for 12 September delivery    │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tier 1: File Truth (What Physically Exists)

```text
Repository Root: d:\pocketkirana
Total Root Files: 44
Total Subdirectories: 19
Total Application Pages: 74 routes across 4 apps
Total API Handlers: 58 routes under app/api/
Total Cloud Function Source Files: 16 files under functions/src/
Total Automation/Test Scripts: 34 JavaScript files under scripts/
Total Release Binaries: 3 compiled APKs under release-apks/
```

### Verified File Realities
- **Root Web Application (`app/`):** 43 routes including store front, darkstore administration, rider fleet monitoring, service area geofence, dynamic catalog editor.
- **Customer Mobile Application (`customer-app/`):** 15 routes + Android Capacitor project.
- **Delivery Partner Application (`delivery-app/`):** 6 routes + Android Capacitor project.
- **Warehouse Picker Application (`picker-app/`):** 10 routes + Android Capacitor project.
- **Non-Source Bloat:** Leaked Gradle wrapper daemon caches (`8.14.3`, `9.1.0`) and generated Next.js caches (`.next/`, `out/`).

---

## 3. Tier 2: Code Truth (What Actually Executes vs Fails)

| Component | Code Claim | Actual Runtime Reality | Diagnostic / Severity |
| :--- | :--- | :--- | :--- |
| `functions/src/orders/placeOrder.ts` | Serverless order creation | **Fails compilation with TS2307** (`../../lib/postgres` missing). Package cannot be built or deployed. | 🔴 CRITICAL BLOCKER |
| `customer-app/next.config.ts` | Production customer app | **`ignoreBuildErrors: true`** enabled. Type errors are suppressed during APK compilation. | 🔴 HIGH RISK |
| `delivery-app/next.config.ts` | Production rider app | **`ignoreBuildErrors: true`** enabled. Type errors suppressed. | 🔴 HIGH RISK |
| `picker-app/next.config.ts` | Production warehouse app | **`ignoreBuildErrors: true`** enabled. Type errors suppressed. | 🔴 HIGH RISK |
| `app/api/payments/phonepe/*` | Payment processing | Checksum and payload generation works; active checkout relies on mock gateway in dev. | 🔴 HIGH RISK |
| `lib/orderRoutingEngine.ts` | Dispatch scoring | Deterministic SLA ranking verified against unit test suite. | 🟢 CODE VERIFIED |
| `lib/pricingEngine.ts` | Pricing & tax engine | Tiered discounts, tax calculations, coupon rules verified against unit tests. | 🟢 CODE VERIFIED |
| `lib/fefo.ts` | FEFO batch allocation | Batch lot sorting by earliest expiration verified against test suite. | 🟢 CODE VERIFIED |

---

## 4. Tier 3: Data Truth (Live Persistence Reality)

```text
PostgreSQL Node: pocketkirana_db (192.168.0.101:5433)
Status: Operational & Connected

Live Baseline Inventory:
  ├── 62 Total Live Tables
  ├── 79 Foreign Key Constraints
  ├── 147 Database Indexes
  ├── 25 Populated Tables
  ├── 37 Empty Tables
  └── 3 Sequences (pk_order_seq active)

Database Cleanup Policy:
  └── NONE CONFIRMED (Empty tables represent unmigrated or upcoming business capabilities;
                       empty is NOT sufficient evidence for deletion)
```

### 4.1 Persistence Ownership Mapping
```text
┌───────────────────────────────┬──────────────────────┬───────────────────────────────┐
│ Domain                        │ PostgreSQL Authority │ Firestore Current State       │
├───────────────────────────────┼──────────────────────┼───────────────────────────────┤
│ Customer Identity             │ None (foreign ref)   │ users, addresses (AUTHORITY)  │
│ Product Catalog & Brands      │ products, categories │ Mirrored snapshot             │
│ Inventory Balances & Batches  │ inventory_balances   │ Legacy inventory doc          │
│ Order Command Authority       │ TARGET: orders       │ CURRENT WRITER: orders        │
│ Stock Reservation             │ TARGET: stock_res    │ CURRENT WRITER: stockRes      │
│ Payments & Transactions       │ TARGET: payments     │ CURRENT: 0 PG rows (unlinked) │
│ Rider Realtime Tracking       │ delivery_tracking    │ deliveryTracking (AUTHORITY)  │
│ Outbox Synchronization        │ MISSING (To Build)   │ None                          │
└───────────────────────────────┴──────────────────────┴───────────────────────────────┘
```

---

## 5. Tier 4: Business Flow Truth (End-to-End Operational Integrity)

```text
Customer Browse (Catalog, Variants, Brands)   ──► 🟢 WORKING (Reads from PostgreSQL/Firestore)
Cart Pricing & Tiered Discount Rules         ──► 🟢 WORKING (lib/pricingEngine.ts verified)
Geotagged Address Selection & Delivery Zone  ──► 🟢 WORKING (Haversine geofence check)
Checkout Submission & Atomic Reservation     ──► 🔴 BROKEN (Dual persistence / TS2307)
Payment Gateway Confirmation & Signature     ──► 🟡 PARTIAL (PhonePe mock verified; live pending)
PostgreSQL Order Persistence (PK-XX)         ──► 🔴 BROKEN (0 payment rows; orders in Firestore)
Outbox Event Publishing to Firestore UI      ──► 🔴 BROKEN (Outbox worker does not exist)
Warehouse Picking Task (FIFO/Urgent)         ──► 🟡 BLOCKED by missing order cutover
FEFO Batch Barcode Scan Handshake            ──► 🟡 BLOCKED by missing order cutover
Rider SLA Dispatch & Acceptance              ──► 🟡 BLOCKED by missing order cutover
Live GPS Transit Streaming                   ──► 🟢 WORKING (Firestore deliveryTracking)
Customer Handshake OTP Delivery Closing      ──► 🟢 WORKING (Logic verified in isolation)
```

---

## 6. Tier 5: Release Truth (12 September Gating Criteria)

The project will only be certified for client release when **all 8 hard gates** are passed with verifiable automated proof:

```text
[ ] GATE 1: Phase 1.5 Master Audit v2.0, Cleanup Manifest, and Truth Matrix signed off.
[ ] GATE 2: Phase 2 safe deletion of build caches & archiving completed (0 DB changes).
[ ] GATE 3: functions/src/orders/placeOrder.ts compiles cleanly with zero TS errors.
[ ] GATE 4: Canonical PostgreSQL command path active; checkout writes to orders, stock_reservations, and payments.
[ ] GATE 5: Outbox Projection Worker operational, syncing PostgreSQL order events to Firestore.
[ ] GATE 6: PhonePe live merchant ID (MID) and webhook verified with real-currency transaction.
[ ] GATE 7: Mobile apps compile with strict TypeScript (ignoreBuildErrors removed).
[ ] GATE 8: All 14 test suites pass cleanly; database backup verified via test_backup_restore.js.
```
