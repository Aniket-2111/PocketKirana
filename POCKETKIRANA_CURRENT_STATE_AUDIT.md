# POCKETKIRANA — COMPLETE CURRENT-SYSTEM AUDIT
**Document Path:** `POCKETKIRANA_CURRENT_STATE_AUDIT.md`  
**Audit Date:** October 2, 2026  
**Auditor Roles:** Senior Full-Stack Engineer, Senior Software Architect, Senior Database Engineer, Senior DevOps Engineer, Senior Security Engineer, Senior QA Engineer, Senior UI/UX Engineer  
**Status:** AUDIT ONLY — ZERO CODE MODIFICATIONS  

---

## 1. Executive Summary

PocketKirana is a multi-surface hyperlocal quick-commerce platform engineered for the Neral, Maharashtra operating zone (15–30 minute delivery promise). The platform coordinates four client-facing surfaces (Customer Web, Customer Android App, Delivery Partner Android App, Picker Android App) and an Admin Operations Portal, backed by Next.js 15, PostgreSQL 14+, Firebase (Authentication, Firestore read projections, FCM), and PhonePe payment gateway integration.

This audit represents a comprehensive, factual inspection of the physical codebase as it currently exists on disk. Every finding below is verified directly against active code, schemas, and git state.

### Key Headline Findings:
1. **Serviceability Enforcement Gap:** While a sophisticated 3-layer serviceability engine exists in frontend libraries (`lib/locationServices.ts` and `lib/locationFlowService.ts`), the canonical order creation API (`POST /api/checkout`) **completely lacks backend serviceability, coordinate, and distance validation**. Any client can place orders for delivery to addresses hundreds of kilometers away.
2. **Radius & Delivery Fee Inconsistencies:** The service radius is contradictory across files: `4.5 KM` in darkstore configuration (`mockData.ts`), `3.0 KM` in fallback code, `6.0 KM` max road distance, and `3 KM` in customer rejection messages. Delivery fee is defined as `₹15` in store settings but calculated as `₹29` (waived at `₹500`) in checkout and pricing engines.
3. **PhonePe Pending-State Status:** The historical issue where orders remained in a `pending` state after successful PhonePe verification was caused by `OrderService.transitionOrder` updating `order_status` without updating `payment_status`. In the current local working tree, this has been **partially mitigated via uncommitted direct SQL updates** in `app/api/payments/phonepe/verify/route.ts`, but the underlying bug in `OrderService.transitionOrder` remains unfixed and simulation mode remains vulnerable.
4. **Coupon Calculation Divergence:** `app/api/checkout/route.ts` hardcodes a flat ₹50 discount for any non-empty coupon code, completely bypassing the authoritative 13-rule `promotionsEngine.ts`.
5. **Shop Operational Hours Bypass:** Store opening/closing hours ('06:00' to '23:00') are checked only in frontend UI pre-checks; `/api/checkout` permits orders to be placed 24/7.
6. **Sub-App Code Duplication:** Android apps (`customer-app`, `delivery-app`, `picker-app`) are discrete Next.js static export projects with their own `node_modules` and component copies, creating severe drift risk against the root application.

---

## 2. Project Structure

The repository is structured as a monorepo containing a unified Next.js root application alongside three dedicated Capacitor-packaged sub-applications:

### Directory Tree & Functional Mapping:
- **`app/`**: Root Next.js 15 App Router application.
  - `app/api/`: 133 API routes serving backend endpoints for customer, admin, picker, delivery, inventory, payments, notifications, and catalog.
  - `app/admin/`: Admin Operations Portal (orders, products, delivery fleet, invoices, service area).
  - `app/delivery/`: Web-based delivery partner portal.
  - `app/picker/`: Web-based darkstore picker portal.
  - `app/checkout/`, `app/orders/`, `app/product/`, `app/category/`, `app/track/`, etc.: Customer web storefront.
- **`customer-app/`**: Standalone customer mobile application.
  - `customer-app/android/`: Native Android project (`com.pocketkirana.customer`).
  - `customer-app/app/`: Next.js frontend compiled to static HTML/JS export in `out/`.
  - `customer-app/capacitor.config.json`: Capacitor bridge configuration.
- **`delivery-app/`**: Dedicated delivery partner application.
  - `delivery-app/android/`: Native Android project (`com.pocketkirana.delivery`).
  - `delivery-app/app/`: Specialized mobile workflow (active orders, navigation, cash collection, OTP verification).
- **`picker-app/`**: Dedicated darkstore order assembly application.
  - `picker-app/android/`: Native Android project (`com.pocketkirana.picker`).
  - `picker-app/app/`: Specialized darkstore workflows (picking tasks, barcode scan verification, packing, rider handoff).
- **`components/`**: Reusable UI components (Customer layout, Admin components, UI library, Toast, Modals, Maps).
- **`lib/`**: Core business domain logic, database pools, authentication helpers, and third-party integrations:
  - `lib/postgres.ts`: Production PostgreSQL pool and transaction manager.
  - `lib/locationServices.ts`: 3-layer serviceability engine, Haversine formula, and OSRM routing.
  - `lib/locationFlowService.ts`: Reactive location state machine for customer onboarding.
  - `lib/pricingEngine.ts` & `lib/freeDelivery.ts`: Delivery fee and ₹500 free-delivery threshold calculations.
  - `lib/promotionsEngine.ts`: 13-offer type promotions and loyalty engine.
  - `lib/fefo.ts`: Batch inventory allocation (First Expiry, First Out).
  - `lib/db/outbox.ts`: Transactional outbox database operations.
  - `lib/services/outboxWorker.ts`: Projection worker service for Firestore and FCM.
  - `lib/services/orderService.ts`: Order state machine transition authority.
  - `lib/phonepeConfig.ts`: PhonePe gateway credentials and simulation guard.
  - `lib/notificationDispatcher.ts`: Centralized Firebase Cloud Messaging dispatcher.
- **`scripts/`**: 64 administrative, migration, inspection, and background daemon scripts:
  - `scripts/init_client_postgres_tables.js`: Canonical PostgreSQL DDL script (38 core tables).
  - `scripts/run_outbox_worker.js`: Standalone background worker process.
- **`test/`**: 49 Vitest test suites covering lifecycle, security regressions, payment sandbox, and state verification.
- **`ecosystem.config.js`**: PM2 production process configuration for Oracle Cloud VPS.

---

## 3. Technology Stack

A strict comparison between documented dependencies and actual installed runtime versions:

| Technology / Library | Documented / Expected | Actual Installed Version | Status / Notes |
| :--- | :--- | :--- | :--- |
| **Next.js** | 15.x | `15.1.3` (Webpack) | Verified in `package.json` |
| **React** | 19.x | `19.0.0` / React DOM `19.0.0` | Production React 19 |
| **TypeScript** | 5.x | `5.7.2` | Clean typecheck passing |
| **TailwindCSS** | 3.x | `3.4.17` | Using standard Tailwind 3 |
| **Node.js** | >= 18 | `v24.18.0` active in runtime | Compatible |
| **PostgreSQL Client (`pg`)** | 8.x | `pg@8.23.0` (`@types/pg@8.23.1`) | Active connection pooling |
| **Firebase SDK** | 12.x | `firebase@12.17.1` (sub-apps: `12.18.0`) | Client-side Firestore & Auth |
| **Firebase Admin SDK** | 14.x | `firebase-admin@14.4.0` | Server-only FCM & projections |
| **Capacitor Core / Geolocation** | 8.x | `@capacitor/core@8.5.2`, `@capacitor/geolocation@8.2.2` | Android bridge layer |
| **Android SDK** | API 34-36 | `compileSdkVersion = 36`, `targetSdkVersion = 36`, `minSdkVersion = 24`, Java 21 | Up-to-date modern Android target |
| **Zustand** | 5.x | `zustand@5.0.2` (sub-apps: `5.0.15`) | Client global state |
| **MSG91 SDK** | 1.x | `@msg91comm/sendotp-sdk@1.0.1` | Mobile OTP verification |
| **Leaflet / Mapping** | 1.9.x | `leaflet@1.9.4`, `@types/leaflet@1.9.22` | Client map canvas & tracking |
| **PostHog Analytics** | 1.x / 5.x | `posthog-js@1.434.15`, `posthog-node@5.54.1` | Observability & telemetry |
| **Vitest** | 5.x | `vitest@5.0.0` | Test runner |
| **`jiti`** | Undeclared | Present in `node_modules` | **Undeclared dependency** in `package.json` required by `run_outbox_worker.js` |

---

## 4. Application Audit

### A. Customer Web
- **Entry Point:** `app/layout.tsx` -> `app/page.tsx`
- **Framework:** Next.js 15 (App Router)
- **Routes / Screens:** Home (`/`), Category (`/category/[slug]`), Product Detail (`/product/[id]`), Cart Drawer/Page, Checkout (`/checkout`), Order Tracking (`/track`, `/orders/[id]`), Saved Addresses (`/saved-addresses`), Legal / Policies.
- **Authentication:** Phone OTP via MSG91 Widget and HttpOnly session cookies (`pk_session`).
- **APIs Used:** `/api/products/discover`, `/api/location/serviceability`, `/api/checkout/calculate-price`, `/api/checkout`, `/api/payments/phonepe/create`, `/api/payments/phonepe/verify`.
- **Database / Backend Access:** Indirect via Next.js API routes; real-time order tracking queries Firestore directly via `onSnapshot`.
- **Production Readiness Concerns:** Server-side serviceability bypass; potential checkout price mismatch when coupons are applied.

### B. Customer Android App
- **Entry Point:** `customer-app/app/layout.tsx` -> `customer-app/app/page.tsx`
- **Framework:** Next.js 15 Static Export (`out/`) + Capacitor 8.5.0 Android wrapper.
- **Package ID:** `com.pocketkirana.customer`
- **Routes / Screens:** Mirrors customer web with localized mobile header, bottom navigation bar, and native geolocation.
- **APIs Used:** Connects to remote API base URL `https://pocketkirana.in`.
- **Production Readiness Concerns:** Code duplication with root app; updates made to root components do not automatically propagate without a manual rebuild of `customer-app/out`.

### C. Delivery Partner App
- **Entry Point:** `delivery-app/app/layout.tsx` -> `delivery-app/app/home/page.tsx`
- **Framework:** Next.js 15 Static Export + Capacitor 8.5.0 Android wrapper (`com.pocketkirana.delivery`).
- **Routes / Screens:** Login (`/login`), Active Task (`/active`), Order Details (`/order/[id]`), Delivery History (`/history`), Messages (`/messages`), Profile (`/profile`).
- **Key Features:** Live GPS broadcasting to `/api/delivery/location`, order accept/arrive/pickup transitions, Cash on Delivery (COD) collection modal, customer delivery OTP verification.
- **Production Readiness Concerns:** Separate codebase; lacks background native location tracking service when app is terminated.

### D. Picker App
- **Entry Point:** `picker-app/app/layout.tsx` -> `picker-app/app/home/page.tsx`
- **Framework:** Next.js 15 Static Export + Capacitor 8.5.2 Android wrapper (`com.pocketkirana.picker`).
- **Routes / Screens:** Login (`/login`), Task Queue (`/tasks`), Picking List (`/picking/[id]`), Item Barcode Scanning (`/scan`), Packing Verification (`/packing/[id]`), Driver Handoff (`/handoff/[id]`).
- **Key Features:** Real-time barcode matching against SKU/barcode database, FEFO batch selection display, damaged item substitution flow.
- **Production Readiness Concerns:** Separate codebase; fallback store name hardcoded to `'PocketKirana Neral Hub'`.

### E. Admin Portal
- **Entry Point:** `app/admin/page.tsx`
- **Framework:** Next.js 15 App Router (Server & Client Components)
- **Routes / Screens:** Overview Dashboard (`/admin`), Orders Management (`/admin/orders`), Products & Catalog (`/admin/products`), Delivery Fleet (`/admin/delivery-fleet`), Darkstore Configuration (`/admin/stores`), Service Area & Hours (`/admin/service-area`), Invoices (`/admin/invoices`).
- **Authentication & RBAC:** Enforced by `middleware.ts` requiring role `'admin'`.
- **Production Readiness Concerns:** Changes made on `/admin/service-area` (radius, opening hours) save to Firestore and memory only; they do not write to PostgreSQL `stores` table because the table schema lacks corresponding columns.

---

## 5. Database Audit (PostgreSQL Schema)

The PostgreSQL database acts as the single source of truth for all transactional, inventory, and order data. Inspected from `scripts/init_client_postgres_tables.js` and supplemental migration scripts.

### Schema Metrics:
- **Total Tables:** 43 Tables across 10 functional modules.
- **Transaction Engine:** Managed connection pool in `lib/postgres.ts` with bounded timeouts and automatic deadlock retry (`withTransaction`).

### Table Breakdown by Module:
1. **Catalog Module:**
   - `categories`: Hierarchical category tree with parent references.
   - `brands`: Manufacturer and brand metadata.
   - `products`: Master product catalog (name, slug, HSN code, GST rate).
   - `product_variants`: SKU, weight value, unit, MRP, selling price, barcode.
   - `product_images`: Binary BYTEA storage or R2 image metadata.
   - `product_attributes` & `product_attribute_values`: EAV model for technical specifications.
2. **Store & Inventory Module:**
   - `stores`: Darkstore hubs (`id, name, code, phone, address, city, state, pincode, latitude, longitude, is_active`).
   - `inventory`: Variant stock balances per store (`quantity, reserved_quantity, low_stock_threshold`).
   - `inventory_transactions`: Historical ledger for stock receipts, adjustments, and write-offs.
   - `stock_reservations`: Transient stock locks with 15-minute expiration windows.
   - `inventory_batches` & `inventory_balances`: FEFO batch expiration tracking and per-batch stock levels.
3. **Cart & Wishlist Module:**
   - `carts`, `cart_items`, `wishlists`, `wishlist_items`: Relational cart tables (currently unused by frontend, which relies on Zustand/localStorage).
4. **Orders Module:**
   - `orders`: Canonical order entity (`order_number, total_amount, order_status, payment_status, delivery_otp, confirmed_at, delivered_at`).
   - `order_items`: Line items capturing historical unit price, quantity, line total.
   - `order_addresses`: Delivery address snapshots attached to specific orders.
   - `order_status_history`: Immutable transition log (`old_status, new_status, changed_by, notes`).
   - `order_notes`: Internal support and fulfillment notes.
5. **Payment Module:**
   - `payments`: Payment records (`gateway, amount, status, gateway_payment_id`).
   - `payment_transactions`: Raw webhook and verification payload ledger.
   - `refunds`: Refund tracking linked to orders and payments.
6. **Delivery Module:**
   - `delivery_zones`: Pincode-based delivery zones with fixed fees.
   - `delivery_partners`: Rider profiles, vehicle registration, and active status.
   - `delivery_assignments`: Pairing of delivery partners to specific orders.
   - `delivery_status_history` & `delivery_tracking`: Historical GPS trajectory points.
7. **Marketing & Promotions Module:**
   - `coupons` & `coupon_usage`: Promotional codes and usage counters.
   - `offers`, `offer_products`, `offer_categories`: 13-rule discount engine tables.
8. **Operations & Audit Module:**
   - `reviews`: Customer feedback and ratings.
   - `notifications`: Push and SMS delivery ledger.
   - `support_tickets`: Customer complaints and returns.
   - `admin_users`, `roles`, `permissions`, `role_permissions`: RBAC authorization tables.
   - `audit_logs`: Administrative mutation logs.
   - `daily_statistics` & `sales_summaries`: Analytics aggregations.
   - `invoice_records` & `pk_order_seq`: Invoicing sequence generators.
9. **Outbox Module:**
   - `outbox_events`: Transactional outbox table (`aggregate_type, event_type, payload, status, lease_token, leased_until, retry_count`).

---

## 6. Location + Serviceability Audit

A forensic analysis of the physical code reveals the exact mechanics of the location and serviceability engine:

1. **Current Service Radius:**  
   - In `lib/mockData.ts` (Store object): `deliveryRadiusKm: 4.5`, `maxRoadDistanceKm: 6.0`.  
   - In `lib/locationServices.ts` (Fallback constant): `radiusKm = selectedStore.deliveryRadiusKm || 3.0`.  
   - In `app/api/checkout/validate-serviceability/route.ts`: Evaluates against store `deliveryRadiusKm` (defaults to 3.0), but returns a rejection message stating: `"PocketKirana currently delivers within 3 KM of our Neral store. You are ${distanceKm} km away."`  
   - In `lib/legalData.ts`: States service coverage is `"3–5 km from our central darkstore hub"`.
2. **Store Anchor Coordinates:**  
   - Primary Store: Maule Kirana Store, Station Road, Neral, Maharashtra.  
   - Exact Coordinates: **`Latitude: 19.0224536, Longitude: 73.3210018`** (Pincode: `410101`).
3. **Formula & Calculation:**  
   - Straight-line distance uses the standard **Haversine formula** with Earth radius $R = 6371$ km (`calculateDistanceKm`).  
   - Road distance uses real **OSRM driving route geometry** via `router.project-osrm.org` (or a fallback heuristic multiplier of $1.35 \times \text{Haversine}$).
4. **3-Layer Serviceability Decision Matrix (`checkZoneServiceability`):**  
   - **Layer 1 (Radius):** $\text{Haversine Distance} \le \text{Store Delivery Radius}$.  
   - **Layer 2 (Road Limit):** $\text{Road Distance} \le \text{Max Road Limit}$ ($1.4 \times \text{Radius}$).  
   - **Layer 3 (Operational):** Store status must be `'active'` and current time must fall within `openingTime` and `closingTime`.
5. **Storage & Admin Configuration:**  
   - Store coordinates and radius are **NOT stored in PostgreSQL** (the `stores` table lacks radius and operating hours columns).  
   - When Admin changes radius in `/admin/service-area`, it is saved to Firestore `shops` collection and Node.js process memory (`STORES_STATE`).
6. **Bypass Vulnerability:**  
   - **YES, a user can bypass serviceability.** While the customer UI blocks checkout if `checkZoneServiceability` fails, the backend order creation endpoint (`POST /api/checkout`) **performs zero serviceability or coordinate checks**. Anyone can construct a direct POST request to create an order outside the delivery zone.

---

## 7. Shop Open/Closed System Audit

- **Operating Hours:** Defined as **`06:00` to `23:00`** (6:00 AM to 11:00 PM IST).
- **Implementation:** `isStoreCurrentlyOpen(openingTime, closingTime)` in `lib/locationServices.ts` parses local time in minutes and supports midnight crossovers.
- **Admin Control:** Admin can modify operating hours and toggle emergency status (`'active'`, `'inactive'`, `'maintenance'`) on `/admin/service-area`. Saved to Firestore `shops`.
- **Customer UI Behavior:** Customer is greeted with a `'STORE_CLOSED'` banner and non-blocking browsing modal explaining store hours.
- **Backend Enforcement:** **ABSENT.** `POST /api/checkout` does not check store operating hours. An order submitted at 2:00 AM will successfully write to the database and reserve inventory.

---

## 8. Pricing & Delivery Fee Audit

Pricing calculations are fragmented across three distinct implementations:

### Comparison of Pricing Calculations:

| Parameter | Frontend (`pricingEngine.ts`) | Pre-Flight API (`calculate-price`) | Order Creation API (`/api/checkout`) |
| :--- | :--- | :--- | :--- |
| **Product Unit Price** | Local store / cart state | Authoritative PostgreSQL lookup | Server validated via `validateServerPricing` |
| **Delivery Fee** | ₹29 (or ₹0 if subtotal $\ge$ ₹500) | Handled by `promotionsEngine` | `subtotal > 499 ? 0 : 29` (Hardcoded) |
| **Free Delivery Threshold**| **₹500** (`FREE_DELIVERY_THRESHOLD`) | **₹500** (`promotionsEngine.ts`) | **₹500** (`subtotal > 499`) |
| **Coupon Discounts** | Calculated via coupon rules | Evaluated via 13-type engine | **Hardcoded flat ₹50** (`couponCode ? 50 : 0`) |
| **Tax (GST)** | 5% on taxable amount | 5% GST on taxable amount | `Math.round((subtotal - discount) * 0.05)` |
| **Discrepancy Note** | Matches `freeDelivery.ts` | Complete promotions evaluation | **Critical Divergence:** ignores coupon rules! |

- **Store Setting Conflict:** `mockData.ts` sets `INITIAL_STORES[0].deliveryFee = 15` and `minimumOrderValue = 199`, whereas the actual checkout pipelines enforce `₹29` delivery fee and `₹500` free-delivery threshold.

---

## 9. Cart + Checkout Flow Audit

### Complete Flow Trace:
$$\text{Product Card} \xrightarrow{\text{Zustand Store}} \text{Cart Drawer} \xrightarrow{\text{Local State}} \text{Checkout Page (/checkout)} \xrightarrow{\text{Client Zone Check}} \text{POST /api/checkout} \xrightarrow{\text{PostgreSQL ACID}} \text{Order Placed}$$

### Architectural Weaknesses & Race Conditions:
1. **No Cart Persistence on Server:** Cart exists exclusively in browser `localStorage` under key `pocketkirana-store-v4`. Cart is not synchronized to server until the checkout button is clicked.
2. **Client-Side Price Sniffing Guard:** The checkout route successfully re-validates item prices against PostgreSQL (`validateServerPricing`), preventing client price tampering.
3. **Inventory Locking Mechanism:** `POST /api/checkout` correctly acquires row-level locks on PostgreSQL inventory (`SELECT ... FOR UPDATE`), preventing overselling during concurrent checkouts.
4. **Idempotency Protection:** Enforced via `x-idempotency-key` header and `idempotency_keys` table.

---

## 10. PhonePe Payment Audit

### Architecture:
- **Initiation:** `POST /api/payments/phonepe/create/route.ts` creates standard PhonePe payload with Base64 encoding and SHA256 checksum (`/pg/v1/pay` + salt).
- **Webhook Callback:** `POST /api/payments/phonepe/webhook/route.ts` receives asynchronous gateway confirmation, validates `X-VERIFY` HMAC, and verifies amount against `expectedAmountInPaise`.
- **Client Verification:** `POST /api/payments/phonepe/verify/route.ts` queries PhonePe S2S status API (`/pg/v1/status/{merchantId}/{txnId}`) on return redirect.

### Status of the Known "Pending-State" Bug:
- **Root Cause:** A previous sandbox test revealed that while PhonePe returned `SUCCESS` and the webhook verified the signature and amount, PostgreSQL order state remained `pending`. Inspection reveals that `OrderService.transitionOrder` only executed:
  ```sql
  UPDATE orders SET order_status = $1 WHERE id = $3
  ```
  It **never updated `payment_status` in PostgreSQL**.
- **Current Code Status:**
  - **In Webhook (`route.ts`):** Fixed. The webhook executes direct SQL: `UPDATE orders SET payment_status = 'paid', order_status = 'CONFIRMED' WHERE id = $1`.
  - **In Client Verify (`route.ts`):** **Partially fixed in uncommitted local working tree changes.** Lines 262–270 now execute an atomic SQL update setting `payment_status = 'paid'`.
  - **In Simulation Mode (`route.ts` line 65):** **STILL BROKEN.** Simulation mode still calls `OrderService.transitionOrder`, leaving PostgreSQL order `payment_status` as `pending`.
  - **In `OrderService.ts`:** **STILL UNFIXED.** `OrderService.transitionOrder` does not have support for mutating `payment_status`.

---

## 11. Outbox + Background Workers Audit

- **Transactional Outbox Table:** `outbox_events` in PostgreSQL.
- **Worker Process:** `scripts/run_outbox_worker.js` running `lib/services/outboxWorker.ts`.
- **Lease Mechanism:** Employs PostgreSQL row-level locks with `FOR UPDATE SKIP LOCKED` on `status IN ('PENDING', 'RETRY_SCHEDULED')`.
- **Dead-Letter Handling:** Exponential backoff ($2^{\text{retry}} \times 5$ seconds) up to `max_retries` (default: 5), then status transitions to `DEAD_LETTERED`.
- **Deployment Readiness:**
  - Configured in `ecosystem.config.js` as singleton fork worker `pocketkirana-outbox-worker`.
  - **Blocker:** Worker script requires `jiti` at runtime (`require('jiti')(__filename)`), but `jiti` is **missing from `package.json` dependencies**.

---

## 12. Authentication + Authorization Audit

- **Customer Auth:** Mobile phone verification via MSG91 OTP Widget. Sessions are issued as HttpOnly `pk_session` cookies managed by `lib/serverSession.ts`.
- **Admin / Staff Auth:** Firebase ID Tokens (RS256 JWT) verified via JWKS public keys in `lib/sessionVerify.ts`.
- **Middleware Gating (`middleware.ts`):**
  - Sanitizes inbound headers by aggressively stripping untrusted `x-pk-*` headers.
  - Re-injects verified `x-pk-uid` and `x-pk-role` after cryptographic token verification.
  - Restricts `/admin` to role `admin`, `/picker` to `picker`/`admin`, `/delivery` to `delivery_partner`/`admin`.
- **CSRF Protection:** State-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`) validate `Origin` header against whitelist.
- **Rate Limiting:** In-memory sliding window limiter in `lib/cryptoUtils.ts` (3 OTP requests per minute per phone).

---

## 13. Push Notifications Audit

- **Provider:** Firebase Cloud Messaging (FCM) via server-side `firebase-admin` in `lib/notificationDispatcher.ts`.
- **Device Registration:** Device FCM tokens are registered via `POST /api/devices/register` and stored in Firestore `notificationTokens/{uid}`.
- **Order Notification Pipeline:**
  $$\text{PostgreSQL Outbox Event} \xrightarrow{\text{Outbox Worker}} \text{Notification Dispatcher} \xrightarrow{\text{FCM Admin SDK}} \text{Device Notification}$$
- **Covered Events:** `ORDER_PLACED`, `ORDER_CONFIRMED`, `PICKING_STARTED`, `ORDER_PACKED`, `ORDER_OUT_FOR_DELIVERY`, `DELIVERY_ARRIVING`, `ORDER_DELIVERED`, `ORDER_CANCELLED`.
- **Operational Requirement:** Requires `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable in production.

---

## 14. Inventory + FEFO Audit

- **FEFO Logic (`lib/fefo.ts`):** `allocateFefoBatches` filters out expired batches, sorts remaining batches by earliest `expiryDate` (NULLS LAST), with secondary FIFO sort by `receivedAt`.
- **PostgreSQL Inventory Locks:** `app/api/checkout/route.ts` acquires row locks with `SELECT ... FOR UPDATE` on the `inventory` table.
- **Ledger Invariant:** Every stock movement writes an audit ledger entry to `inventory_events` with references to `orderId` or `batchId`.

---

## 15. Demo / Mock / Sample Data Inventory

Complete inventory of mock data assets declared in `lib/mockData.ts`:

| Data Asset | Quantity / Scope | Classification | Recommended Action |
| :--- | :--- | :--- | :--- |
| `INITIAL_STORAGE_LOCATIONS` | 14 Shelf locations (Aisle 1–3) | REPLACE WITH REAL DATA | Update with client physical darkstore bin layout |
| `INITIAL_CATEGORIES` | 25 Categories & subcategories | KEEP | Retain structure; refine icons and metadata |
| `INITIAL_BRANDS` | 20 National & regional brands | KEEP | Retain Amul, Tata, Britannia, etc. |
| `INITIAL_STORES` | 1 Store (`store-1`, Maule Kirana) | REPLACE WITH REAL DATA | Update with exact darkstore business details |
| `INITIAL_PRODUCTS` | 48 Kirana & grocery products | REPLACE WITH REAL DATA | Replace with real store catalog & live stock counts |
| `INITIAL_BANNERS` | 6 Promotional hero banners | REPLACE WITH REAL DATA | Swap Unsplash placeholder images with client banners |
| `INITIAL_COUPONS` | 0 Coupons (empty array) | BUILD | Seed real launch coupons (e.g. `WELCOME50`) |
| `INITIAL_DELIVERY_PARTNERS` | 4 Mock riders | DEVELOPMENT ONLY | Delete; onboard real delivery staff |
| `INITIAL_ADDRESSES` | 4 Neral sample addresses | DEVELOPMENT ONLY | Delete prior to production go-live |
| `INITIAL_ORDERS` | 10 Historical mock orders | DEVELOPMENT ONLY | Purge before launch |
| `INITIAL_NOTIFICATIONS` | 15 Mock system notifications | DEVELOPMENT ONLY | Purge before launch |
| `INITIAL_PICKERS` | 2 Mock darkstore pickers | DEVELOPMENT ONLY | Delete; onboard real store employees |
| `INITIAL_PICKING_TASKS` | 5 Mock assembly tasks | DEVELOPMENT ONLY | Purge before launch |
| `INITIAL_INVENTORY_MOVEMENTS`| 5 Sample stock adjustments | DEVELOPMENT ONLY | Purge before launch |

---

## 16. UI/UX Audit

- **Customer Web:**
  - Modern, responsive quick-commerce aesthetic (inspired by top Indian delivery platforms).
  - High-impact visual hierarchy: Sticky location & search header, category rail, product grid with quantity counters, sliding cart drawer, and interactive delivery tracker.
  - UI Inconsistency: Store information card advertises "Delivery ₹15", while cart progress bar specifies "Free delivery on orders above ₹500, otherwise ₹29".
- **Mobile Interaction Patterns:**
  - Bottom navigation bar on mobile viewports (`Home`, `Categories`, `Orders`, `Profile`).
  - Pre-login location prompt modal with "Use Current Location" and manual address selection.
- **Admin & Portals:**
  - Dark theme (Slate 900/950) with high contrast metrics, data tables, and interactive Leaflet map canvas for darkstore geofencing.

---

## 17. API Audit

Total APIs Identified: **133 Endpoints** under `app/api`.

### Summary by Functional Group:
- **Admin Operations (29 APIs):** Analytics, dispatch, festival campaigns, homepage CMS, invoice generation, returns inspection, store configuration, R2 uploads.
- **Authentication (6 APIs):** Send OTP, verify OTP, verify MSG91 access token, me, logout, logout-all.
- **Catalog, Categories & Brands (13 APIs):** Category reordering, brand management, barcode lookup, product recommendations, variant reordering, V1 catalog sync.
- **Checkout & Pricing (5 APIs):** Authoritative pricing calculator (`/api/checkout/calculate-price`), quote generator, pre-flight serviceability check, canonical order placement (`/api/checkout`).
- **Delivery Fleet (17 APIs):** Rider assignment, acceptance, store arrival, pickup, out-for-delivery, live GPS tracking, delivery OTP verification, cash collection.
- **Inventory & Batches (7 APIs):** Stock adjustments, batch expiry management, clearance discounting, stock receipt.
- **Orders & Orchestration (7 APIs):** Order status polling, event streams, invoice download, customer issue submission.
- **Picking & Packing (7 APIs):** Task assignment, barcode scanning, item picking checklist, packing completion.
- **Payment Gateway (4 APIs):** PhonePe payment creation, verification, status query, and S2S webhook.

---

## 18. Security Audit

- **Secret Storage:** Zero production secrets are committed in source code files. Environment variable templates (`.env.example`, `.env.production.template`) contain placeholder values.
- **Accidentally Tracked Env Files:**
  - `customer-app/.env.production`
  - `delivery-app/.env.production`
  - `picker-app/.env.production`
  - *Inspection:* These contain only public identifiers (`NEXT_PUBLIC_FIREBASE_API_KEY`, MSG91 Widget IDs). No private AuthKeys or DB credentials are exposed.
- **Database Credentials:** Protected via server-side environment variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`). Sanitized logging in `lib/postgres.ts` redacts passwords from error logs.
- **SQL Injection Prevention:** 100% of analyzed database queries utilize parameterized SQL statements (`$1`, `$2`). Zero dynamic string concatenation detected in query construction.
- **CORS & Origin Security:** Middleware strictly blocks cross-origin state mutations (CSRF protection) and handles APK origin headers (`capacitor://localhost`).

---

## 19. Deployment Audit

- **Application Hosting Architecture:** Designed for deployment on an Oracle Cloud Ubuntu Linux VPS managed via PM2 (`ecosystem.config.js`).
- **Web App Process:** Next.js cluster mode (`pocketkirana-web`) listening on port 3000.
- **Worker Process:** Standalone Node process (`pocketkirana-outbox-worker`) running `scripts/run_outbox_worker.js`.
- **Ingress & Networking:** Cloudflare Tunnel (`cloudflared`) terminates public TLS at `pocketkirana.in` and proxies traffic to localhost:3000.
- **Static Asset Storage:** Cloudflare R2 object storage configured with custom domain `images.pocketkirana.com`.
- **Database Connectivity:** Direct TCP connection pool to PostgreSQL instance.

---

## 20. Build + Test Audit

- **Typecheck Status:** `npm run typecheck` (`tsc --noEmit`) exited with **Code 0 (Clean, 0 errors)**.
- **Test Suite Status:** 49 test files under `test/`. Execution of test suites via Vitest passes cleanly.
- **Build Configuration:** Next.js Webpack configuration in `next.config.ts` includes standalone output settings and header security rules.

---

## 21. Git Audit

- **Current Working Branch:** `fix/page-readiness-production` (ahead of origin by 1 commit).
- **Working Tree State:** Dirty (14 modified files, 1 untracked file).
  - Modified files include payment verify routes, orderService, middleware, outbox worker, and store.ts.
  - Untracked: `test/security-audit-batch2-regression.test.ts`.
- **Risk:** Uncommitted changes must be reviewed and cleanly committed or stashed before any production rollout.

---

## 22. Production Blockers

### 🔴 CRITICAL (Must fix before launch)
1. **Unenforced Serviceability on Order Creation (`/api/checkout`):** The canonical order creation route has no check for customer latitude/longitude, store distance, or serviceability. A customer outside Neral can bypass UI checks and place an order.
2. **Missing Dependency in Worker:** `scripts/run_outbox_worker.js` requires `jiti` (`require('jiti')`), which is not listed in `package.json`. Running this worker in a clean production install will crash.
3. **Coupon Evaluation Divergence in Checkout:** `POST /api/checkout` hardcodes a flat ₹50 discount whenever `couponCode` is present, completely ignoring minimum order values and coupon validation rules defined in `promotionsEngine.ts`.
4. **PhonePe Simulation Payment Incomplete State:** Simulation verification in `app/api/payments/phonepe/verify/route.ts` leaves order payment status as `pending` in PostgreSQL because `OrderService.transitionOrder` does not update `payment_status`.

### 🟠 HIGH (High operational risk)
1. **Store Radius & Delivery Fee Conflict:** Store configuration claims ₹15 delivery fee and 4.5 KM radius; checkout enforces ₹29 fee (free over ₹500) and displays a 3.0 KM limit message.
2. **Admin Service Area Setting Not Stored in PostgreSQL:** Saving store operational hours and radius in Admin only persists to Firestore; the PostgreSQL `stores` table schema lacks these columns.
3. **Shop Operating Hours Unenforced on Server:** Orders can be created via API during late night hours when the physical shop is closed.
4. **Multi-App Code Drift Risk:** Android applications (`customer-app`, `delivery-app`, `picker-app`) duplicate code from the root project without a shared monorepo build package.

### 🟡 MEDIUM
1. **Dirty Git Working Tree:** 14 modified files currently uncommitted.
2. **Sub-App `.env.production` Files Committed in Git:** Should be removed from git index and managed via deployment secrets.

---

## 23. What We Should NOT Touch Yet

The following systems are currently operational or sensitive, and should remain frozen until their specific execution phases:
- **PhonePe Production Credentials & Live Keys:** Do not touch until sandbox end-to-end rehearsal is complete.
- **PostgreSQL Core Schema DDL:** Do not alter existing tables without formal migration files (`scripts/`).
- **Working UI/UX Components:** Do not redesign components or alter customer interaction flows.
- **Darkstore Primary GPS Anchor (`19.0224536, 73.3210018`):** Keep pinned to Maule Kirana, Neral.
- **Existing Mock Product Catalog:** Do not delete mock data until client delivers real inventory CSV/Excel.

---

## 24. Master Change Map

| Area | Current State | Keep | Fix | Modify | Delete Later | Build | Priority |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Customer Web** | Fully functional Next.js storefront | ✅ | | | | | High |
| **Customer App** | Duplicate code in `customer-app/` | ✅ | | ✅ | | | Medium |
| **Delivery App** | Functional Capacitor app in `delivery-app/` | ✅ | | ✅ | | | High |
| **Picker App** | Functional Capacitor app in `picker-app/` | ✅ | | ✅ | | | High |
| **Admin Portal** | Operations UI in `app/admin/` | ✅ | | | | | Medium |
| **Database** | 43 PostgreSQL tables | ✅ | | ✅ | | | Critical |
| **Location & GPS** | Haversine + OSRM routing in `locationServices` | ✅ | | | | | High |
| **Serviceability** | 3-layer engine on client; missing on server | | ✅ | | | ✅ | **Critical** |
| **3 KM / 4.5 KM Radius**| Contradictory values across 5 files | | ✅ | | | | **Critical** |
| **Shop Hours** | Client check only ('06:00'–'23:00') | | ✅ | | | | **High** |
| **Pricing Engine** | ₹500 free-delivery threshold active | ✅ | | | | | High |
| **Checkout API** | Hardcoded ₹50 coupon, no location check | | ✅ | | | | **Critical** |
| **PhonePe Gateway** | Verify route partially updated; sim broken | | ✅ | | | | **Critical** |
| **Outbox Worker** | Concurrency-safe leases; missing `jiti` dep | | ✅ | | | | **Critical** |
| **OTP / MSG91** | Functional Widget S2S verification | ✅ | | | | | High |
| **Push Notifications** | FCM via `firebase-admin` | ✅ | | | | | Medium |
| **Inventory & FEFO** | Row-locked reservation & FEFO recommendation | ✅ | | | | | High |
| **Demo / Mock Data** | 190+ mock items in `lib/mockData.ts` | | | | ✅ | | Medium |
| **Testing** | 49 passing Vitest test suites | ✅ | | | | | High |

---

## 25. Recommended Step-by-Step Execution Order

1. **Step 1: Commit & Baseline Working Tree**  
   Cleanly review, test, and commit the 14 modified files currently in the working tree.
2. **Step 2: Fix Server-Side Serviceability & Order Validation**  
   Inject mandatory coordinate and serviceability verification into `POST /api/checkout` to fail-closed on orders placed outside the Neral darkstore radius or during closed hours.
3. **Step 3: Unify Radius & Delivery Fee Constants**  
   Establish a single authoritative configuration source for darkstore radius (`4.5 KM` or `3.0 KM`) and delivery fees (`₹29`, free over `₹500`), eliminating discrepancies in messages and store settings.
4. **Step 4: Align Checkout Coupon Logic with Promotions Engine**  
   Replace hardcoded `couponCode ? 50 : 0` in `POST /api/checkout` with authoritative server-side evaluation via `evaluatePromotionsEngine`.
5. **Step 5: Fix OrderService Payment Status Invariant**  
   Update `OrderService.transitionOrder` to accept and mutate `payment_status` within its atomic transaction, guaranteeing state synchronization in both simulation and live payment modes.
6. **Step 6: Harden Outbox Worker Dependencies**  
   Add `jiti` to `package.json` dependencies and verify PM2 worker startup on a clean environment.
7. **Step 7: Production Data Ingestion & Live Cutover**  
   Seed real darkstore inventory and partner credentials; purge development-only mock orders and test users prior to launch.
