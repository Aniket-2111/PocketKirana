# Phase 2.8 — Production Readiness Master Audit

**Execution Date:** 2026-10-04  
**Audit Scope:** Full-Stack Production Readiness Forensic Audit & Gap Identification  
**Execution Mode:** STRICT AUDIT ONLY (Read-Only Verification; Zero DDL/DML, Zero Code Modification, Zero Deployments)  
**System Evaluated:** PocketKirana Monorepo & Distributed Architecture (Web, Mobile APKs, Ops Portals, PostgreSQL, Firebase, Cloudflare, PhonePe, MSG91)

---

## Executive Summary & Final Verdict

```text
================================================================================
FINAL PRODUCTION READINESS VERDICT:
🔴 NOT PRODUCTION READY
================================================================================
Critical Blockers:
1. P0 — PhonePe State Disconnect: Simulation & Webhook flows fail to consistently 
        reconcile PostgreSQL `orders.payment_status` to 'paid'. `OrderService.transitionOrder`
        does not support updating `payment_status`. Webhook SQL relies on `WHERE id = $1`
        which matches 0 rows when passed an `orderNumber` instead of the internal UUID.
2. P0 — Root Production Build Failure: Untracked experimental directories 
        (`app/api/copilotkit/` and `app/assistant/`) trigger fatal TypeScript compilation
        errors (TS2307, TS7031, TS7006), causing root Next.js `npm run build` to fail.
================================================================================
```

---

## 1. Production Architecture Inventory

| Component | Production Role | Current Location | Dependency | Production Ready? | Evidence |
|---|---|---|---|---|---|
| **Customer Web** | Customer storefront, catalog, cart, checkout | `app/` (Root Next.js) | Next.js 15, React 19, Tailwind, PostgreSQL API | 🔴 **BLOCKER** | Root build blocked by untracked experimental CopilotKit modules; serviceability canonicalized in Phase 2.7C. |
| **Customer Android APK** | Customer mobile application | `customer-app/` | Capacitor 8, Next.js static export (`out/`), MSG91 OTP SDK | 🟡 **PARTIAL** | Static build generates 199 static routes cleanly; release build configuration requires production API domain confirmation. |
| **Admin Web Portal** | Multi-store operational administration | `app/admin/*` | Next.js 15, PostgreSQL `stores`, Firebase Auth | 🟢 **READY** | Canonical store operations aligned with PostgreSQL in Phase 2.7C.7.6-C; coordinate relocation secured via developer HMAC tokens. |
| **Picker Android App** | Darkstore item picking, FEFO selection, packing | `picker-app/` | Capacitor 8, Next.js static export, Firebase Firestore | 🟢 **READY** | Builds cleanly (code 0); isolated operational client communicating via Firestore & operational APIs. |
| **Delivery Partner App** | Order dispatch, live transit, delivery OTP verification | `delivery-app/` | Capacitor 8, Next.js static export, Geolocation | 🟢 **READY** | Builds cleanly (code 0, 21 static routes); independent earnings model separated from customer delivery fees. |
| **Backend API Routes** | Core checkout, serviceability, payment endpoints | `app/api/*` | Node.js, `pg.Pool`, Next.js Route Handlers | 🔴 **BLOCKER** | Checkout & Serviceability APIs canonicalized; Payment verify & webhook routes harbor critical state transition bugs (Finding A). |
| **Firebase Cloud Functions** | Legacy triggers & background helpers | `functions/` | Node 18, Firebase Admin SDK | 🟢 **READY** | Builds cleanly with `tsc`; legacy `placeOrder` order-creation authority decommissioned and sealed in Phase 2.7C.7.6-A. |
| **PostgreSQL Database** | Canonical single source of transactional truth | Remote Host `192.168.0.105:5433` (Target: Cloud SQL) | PostgreSQL 18.6 MSVC 64-bit | 🟡 **PARTIAL** | Schema is robust (62 tables, indexes, constraints, audit logs); however, backup restore drills have never been executed. |
| **Firebase Auth** | Identity provider & phone OTP token bridge | Cloud Firebase Auth | Google Cloud Identity Platform | 🟢 **READY** | Role claims verified server-side; decoupled from transactional business authority. |
| **Cloud Firestore** | Real-time read projections & event bus | Cloud Firestore | Firebase SDK | 🟢 **READY** | Strictly downstream read projection; zero order-creation authority. |
| **Firebase Storage / R2** | Product media, catalog assets, store banners | Cloudflare R2 / Cloud Storage | S3 API / Cloudflare Workers | 🟢 **READY** | S3 client implemented via `@aws-sdk/client-s3` in `lib/r2.ts`; public CDN routing configured. |
| **FCM (Cloud Messaging)** | Real-time order & delivery push alerts | Google FCM | Firebase Admin SDK | 🟢 **READY** | Notifications dispatched asynchronously from outbox worker; cannot block DB transactions. |
| **Cloudflare** | Edge reverse proxy, SSL termination, WAF, CDN | Cloudflare Edge | DNS / SSL Full (Strict) | 🟢 **READY** | Proxy active for `pocketkirana.in`; HTTPS enforced. |
| **PM2 & VPS Runtime** | Application process manager & worker daemon | Linux/Windows VPS host | Node.js, PM2 Cluster Mode | 🟡 **PARTIAL** | Multi-worker PM2 execution breaks in-memory coordinate nonces (Finding B); outbox worker requires distinct worker IDs. |
| **PhonePe Gateway** | Primary digital payment processor | External PG API | PhonePe PG V1 / V2 API | 🔴 **BLOCKER** | Signature validation verified; database reconciliation and state machine transition disconnected (Finding A). |
| **MSG91** | Transactional SMS & OTP delivery | MSG91 API | SendOTP Widget & REST API | 🟢 **READY** | Configured in mobile clients and backend verification routes; production credentials present. |
| **Map / Geocoding API** | Geolocation, geocoding, distance evaluation | OSM / Google Maps | Client Geolocation / Haversine | 🟢 **READY** | Server-side Haversine distance evaluation in PostgreSQL `evaluateServerServiceability()`. |

---

## 2. Environment & Secret Audit

Inspection was conducted across root `.env.example`, `.env.local`, `.env.production.template`, `customer-app/.env.local`, `customer-app/.env.production`, `delivery-app/.env*`, and `picker-app/.env*`.

### Secret Classification Table

| Secret / Environment Variable | Scope | Status in Workspace | Exposure Risk | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | SERVER-ONLY | PRESENT (`.env.local`) | NONE | Strictly server-side; not prefixed with `NEXT_PUBLIC_`. |
| `DB_PASSWORD` / `DB_USER` | SERVER-ONLY | PRESENT (`.env.local`) | NONE | Restricted to backend database connection pool. |
| `JWT_SECRET` / `NEXTAUTH_SECRET` | SERVER-ONLY | PRESENT (`.env.production.template`) | NONE | Used for session tokens and HMAC coordinate protection fallback. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | SERVER-ONLY | PRESENT (`.env.production.template`) | NONE | Server-side service account credentials; never bundled. |
| `PHONEPE_MERCHANT_ID` | SERVER-ONLY | PRESENT (`.env.local`) | NONE | Stored server-side; passed only to backend payment handlers. |
| `PHONEPE_SALT_KEY` | SERVER-ONLY | PRESENT (`.env.local`) | NONE | Critical cryptographic secret; strictly server-side. |
| `PHONEPE_SALT_INDEX` | SERVER-ONLY | PRESENT (`.env.local`) | NONE | Numeric key index for HMAC calculation. |
| `MSG91_AUTHKEY` | SERVER-ONLY | PRESENT (`.env.local`) | NONE | Used by server-side OTP validation routes. |
| `R2_SECRET_ACCESS_KEY` / `R2_ACCESS_KEY_ID` | SERVER-ONLY | PRESENT (`.env.example`) | NONE | S3 API credentials for media uploads. |
| `COORDINATE_OVERRIDE_SECRET` | SERVER-ONLY | ABSENT (Defaults to fallback) | LOW | Used by `lib/coordinateProtection.ts`; falls back to `JWT_SECRET` or `DATABASE_URL`. Must be set explicitly in production. |
| `NEXT_PUBLIC_FIREBASE_*` (API Key, Project ID, App ID, etc.) | CLIENT-SAFE | PRESENT | NONE (Public By Design) | Standard Firebase client configuration; restricted by Firebase Security Rules. |
| `NEXT_PUBLIC_MSG91_WIDGET_ID` / `TOKEN_KEY` | CLIENT-SAFE | PRESENT | NONE (Public By Design) | MSG91 SendOTP widget identifiers for customer login. |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SITE_URL` | CLIENT-SAFE | PRESENT (`https://pocketkirana.in`) | NONE | Base URL for API client requests. |
| `CPK_INTELLIGENCE_API_KEY` | SERVER-ONLY | PRESENT (`.env.example`) | NONE | Experimental CopilotKit key; untracked in source. |

### Environment Audit Findings:
1. **Secret Leakage to Client:** ZERO server secrets (`DATABASE_URL`, `PHONEPE_SALT_KEY`, `MSG91_AUTHKEY`, `R2_SECRET_ACCESS_KEY`) are leaked into client bundles or prefixed with `NEXT_PUBLIC_`.
2. **Environment Separation:** Staging/development credentials exist in `.env.local`. Production values are mapped via `.env.production.template`.
3. **Hardcoded Secrets:** Git search confirmed no private keys, passwords, or salts are committed to repository tracking.

---

## 3. PostgreSQL Production Readiness

* **Host & Port:** `192.168.0.105:5433` (Testing host); Target Production: GCP Cloud SQL (`pocketkirana-db-prod`).
* **PostgreSQL Engine:** `PostgreSQL 18.6 on x86_64-windows, compiled by msvc-19.44.35228, 64-bit`.
* **Database Name:** `pocketkirana_db`.
* **Runtime Application Role (`pk_app_user`):**
  - Confirmed: Restricted to DML operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
  - Lacks DDL privileges (`CREATE`, `ALTER`, `DROP`). Cannot alter table structures or bypass constraints.
* **Migration Role (`postgres`):**
  - Superuser / administrative migration role utilized strictly during controlled migrations (Migration 001, Migration 002).
* **Connection Pooling:**
  - Managed via `pg.Pool` in `lib/postgres.ts`.
  - Max connections: 20 per pool instance; Idle timeout: 30,000 ms; Connection timeout: 5,000 ms.
  - Implements `withTransaction()` utility with automatic `ROLLBACK` on unhandled exceptions.
* **Schema Integrity:**
  - 62 canonical tables.
  - Foreign keys, unique constraints, and check constraints enforced on orders, inventory, and payments.
  - Outbox table (`outbox_events`) equipped with row-level leasing locks (`FOR UPDATE SKIP LOCKED`).

---

## 4. Database Backup & Restore

* **Latest Verified Backup:**
  - Target Archive: `D:\pocketkirana\backups\pocketkirana_pre_migration_002_20261002.dump`
  - Created Date: `2026-10-02T10:18:09Z`
  - Format: PostgreSQL Custom Archive (`pg_dump -Fc`)
  - Size: `221,204 bytes`
  - Checksum (SHA-256): `62273375CEABA277B2C97816542B74AC81D1D95D1681BCF9A35BBE2C5CB22A31`
  - TOC Content: 455 structural elements.
* **Host Location Finding:**
  - Workstation (`192.168.0.100`) is NOT the PostgreSQL host (`192.168.0.105:5433`).
  - Workstation lacks local `pg_dump` and `pg_restore` executables; backups must be executed directly on the host instance or via Cloud SQL automated snapshots.
* **Disaster Recovery Gap (CRITICAL):**
  > **No restore test or drill has ever been executed on a drill/test database.**
  Under standard production criteria, an untested backup cannot guarantee disaster recovery.

---

## 5. Database Data-Integrity Audit

Read-only forensic verification across all database tables revealed:

### Orders & Items:
* Total Orders: **53**
* Store Distribution:
  - `store_central_001`: 25 orders
  - Legacy `store-001`: 9 orders
  - `NULL` (Early phase testing records): 19 orders
* Orphaned Order Items: **0** (All `order_items` match valid `order_id` references).
* Duplicate Order Numbers: **0** (Unique constraint `orders_order_number_key` enforced).

### Stores:
* Active Stores: **2** (`store_primary`, `store_central_001`)
* Location: Coordinates `(19.02245360, 73.32100180)`
* Operational Parameters:
  - `delivery_radius_km`: `15.00 km`
  - `min_order_amount`: `₹100.00`
  - `free_delivery_threshold`: `₹499.00`
  - `base_delivery_fee`: `₹25.00`
  - `operating_hours`: Valid JSON structure (`open: "07:00"`, `close: "23:00"`).
* Inactive Stores with active operational dependencies: **0**.

### Inventory:
* Legacy `inventory` table: **0** rows (Decommissioned).
* Canonical `inventory_balances`: **49** rows.
* Canonical `inventory_batches`: **68** rows.
* Active `stock_reservations`: **0** rows.
* Negative Stock: **0** rows.
* Expired Unreleased Reservations: **0** rows.

---

## 6. PhonePe Production Audit — CRITICAL (Known Finding A)

### Trace of Customer Payment Path:
1. Customer initiates checkout at `POST /api/checkout`. Canonical order inserted into PostgreSQL with `order_status = 'PLACED'`, `payment_status = 'pending'`.
2. PhonePe transaction initialized at `POST /api/payments/phonepe/initiate`.
3. Customer completes transaction at PhonePe Gateway.
4. User redirected to `GET /api/payments/phonepe/verify` or PhonePe delivers asynchronous webhook to `POST /api/payments/phonepe/webhook`.

### Detailed Investigation of Known Finding A:
Forensic analysis of the codebase confirmed that **Known Finding A is STILL PRESENT**:

1. **`OrderService.transitionOrder` Schema Disconnect:**
   - In `lib/services/orderService.ts` (lines 57–172), `OrderTransitionRequest` accepts:
     `orderId`, `targetStatus`, `actorId`, `actorRole`, `reason`, `isAdminOverride`, `metadata`, `eventId`.
   - It **does NOT accept or update `payment_status`**.
   - The executed SQL query is:
     ```sql
     UPDATE orders
     SET order_status = $1,
         delivery_otp = COALESCE($2, delivery_otp),
         updated_at = CURRENT_TIMESTAMP,
         confirmed_at = CASE WHEN $1 = 'CONFIRMED' AND confirmed_at IS NULL THEN CURRENT_TIMESTAMP ELSE confirmed_at END,
         delivered_at = CASE WHEN $1 = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
         cancelled_at = CASE WHEN $1 = 'CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancelled_at END
     WHERE id = $3
     ```
   - `payment_status` is completely omitted from the update.

2. **Simulation Mode State Split:**
   - In `app/api/payments/phonepe/verify/route.ts` (lines 64–99), simulation verification calls:
     ```ts
     await OrderService.transitionOrder({
       orderId,
       targetStatus: 'CONFIRMED',
       actorId: 'sim-phonepe-verify',
       actorRole: 'system',
       reason: `Simulation payment verified: ${txnId}`,
     });
     ```
   - Because `transitionOrder` ignores `payment_status`, PostgreSQL `orders.payment_status` remains `'pending'`.
   - Meanwhile, lines 82–92 update Firestore: `paymentStatus: 'paid'`.
   - **Result:** Split-brain where Firestore shows `'paid'` and PostgreSQL remains `'pending'`.

3. **Webhook SQL Mismatch Vulnerability:**
   - In `app/api/payments/phonepe/webhook/route.ts` (lines 179–187):
     ```sql
     UPDATE orders 
     SET payment_status = 'paid', 
         order_status = 'CONFIRMED', 
         confirmed_at = NOW(), 
         updated_at = NOW() 
     WHERE id = $1
     ```
   - In line 186, parameter `$1` is passed `orderId` extracted from Firestore documents or transaction strings (e.g. `PK-01`).
   - If `orderId` is an `order_number` rather than the PostgreSQL UUID `id`, `WHERE id = $1` matches **0 rows**.
   - Unlike `verify/route.ts` (which correctly queries `WHERE id = $1 OR order_number = $1`), the webhook route fails silently without updating PostgreSQL.

4. **Test Suite Blindspot:**
   - In `test/production-gates/g3-payment-sandbox.test.ts` (lines 33–40):
     ```ts
     vi.mock('../../lib/postgres', () => ({
       getPostgresPool: vi.fn(() => ({
         connect: vi.fn().mockResolvedValue({
           query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
           release: vi.fn(),
         }),
       })),
     }));
     ```
   - The test mocks PostgreSQL queries with static `{ rowCount: 0 }`, never asserting whether `orders` was mutated or whether `payment_status` became `'paid'`.

* **Finding Status:** 🔴 **P0 CRITICAL PRODUCTION BLOCKER**

---

## 7. Order State Machine Audit

Canonical order statuses defined in `lib/services/orderService.ts`:
* `PLACED`: Initial checkout state.
* `CONFIRMED`: Payment verified or COD accepted.
* `PICKING`: Assigned to darkstore picker.
* `PACKING`: Picking complete; packing in progress.
* `READY_FOR_PICKUP`: Packed and staged for courier. Delivery OTP generated.
* `ASSIGNED`: Delivery partner assigned.
* `ACCEPTED`: Delivery partner accepted dispatch.
* `PICKED_UP`: Handed over to rider.
* `OUT_FOR_DELIVERY`: En route to customer.
* `ARRIVED_AT_CUSTOMER`: Courier at delivery coordinates.
* `DELIVERED`: Terminal state; OTP validated.
* `CANCELLED`: Terminal state; inventory reservations released.

### Transition Enforcement:
* Transitions are strictly checked against `CANONICAL_TRANSITIONS` lookup dictionary.
* Illegal transitions throw an exception (`Illegal order transition from X to Y`).
* Admin override requires `isAdminOverride: true` AND a non-empty `reason`.
* Every transition writes an audit entry to `order_status_history` and an immutable event to `order_events` in the same transaction.

---

## 8. Inventory / FEFO Audit

* **Architecture:** Multi-batch inventory managed via `inventory_batches` and aggregated in `inventory_balances`.
* **FEFO Allocation (`lib/inventory/fefoService.ts`):**
  - Queries `inventory_batches` ordered by `expiry_date ASC, created_at ASC`.
  - Enforces row-level locks (`SELECT ... FOR UPDATE`) during checkout reservation.
  - Guarantees stock balances cannot drop below zero (`CHECK (available_quantity >= 0)`).
* **Cancellation & Release:**
  - `OrderService.transitionOrder` triggers reservation release if an order transitions to `CANCELLED`.
* **Expired Batch Protection:**
  - Expired batches (`expiry_date <= CURRENT_DATE`) are filtered out of serviceable picking pools.

---

## 9. Transactional Outbox Audit

* **Table Structure:** `outbox_events` (columns: `id`, `aggregate_type`, `aggregate_id`, `event_type`, `payload`, `status`, `lease_token`, `lease_expires_at`, `retry_count`, `created_at`).
* **Atomic Guarantees:**
  - Business mutations (order creation, payments, inventory deductions) insert outbox events in the same PostgreSQL transaction (`appendOutboxEvent()`).
* **Worker Execution (`lib/db/outboxWorker.ts`):**
  - Worker acquires pending events via optimistic leasing (`status = 'PENDING' OR lease_expires_at < NOW()`).
  - Lease duration: 30 seconds.
  - Successfully published events updated to `status = 'PUBLISHED'`.
  - Max retries: 5. Unrecoverable events transition to `status = 'DEAD_LETTER'`.
* **Multi-Worker Concurrency Warning:**
  - When running under PM2 cluster mode (multiple worker instances), workers must use unique worker tokens (`worker_id = hostname:pid`) to avoid lease collision and duplicate notification dispatches.

---

## 10. Firebase Auth / RBAC Audit

* **Token Verification:**
  - Server-side JWT validation in `lib/auth/tokenVerification.ts` and `lib/routeAuth.ts`.
  - Decodes Firebase ID token and matches against PostgreSQL `admin_users` or role claims.
* **Role Hierarchy:**
  - `admin`: Superadmin with global store privileges.
  - `store_admin` / `store_manager`: Scoped to stores mapped in `admin_store_assignments`.
  - `picker` / `driver`: Operational roles restricted to respective application surfaces.
  - `customer`: Restricted to own profile, orders, and addresses.
* **Store-Scoping Protection:**
  - In `app/api/admin/store/operations/route.ts`, authorization strictly validates whether the caller has assignment to the requested `storeId`.
* **Darkstore Coordinate Protection (Known Finding B):**
  - Modifying darkstore coordinates (`latitude`, `longitude`) is blocked for all normal admins.
  - Requires signed developer HMAC token (`verifyAndConsumeDeveloperToken`).
  - **Vulnerability:** Nonce tracker (`consumedNonces`) is an in-memory `Map`. It does not survive PM2 cluster worker routing or process restarts.
  - Status: 🟡 **P1 High Priority Hardening**.

---

## 11. FCM / Notification Audit

* **Token Registration:** Handled via `user_fcm_tokens` table.
* **Asynchronous Decoupling:** Push notifications to customers, pickers, and drivers are generated as `outbox_events` (`notification.dispatch`).
* **Failure Isolation:** An FCM network timeout or invalid device token failure cannot rollback a PostgreSQL order or payment transaction.

---

## 12. MSG91 / OTP Audit

* **Customer Authentication:** MSG91 SendOTP widget integration on mobile and web.
* **Server Verification:** `app/api/auth/otp/verify/route.ts` calls MSG91 API with server-only `MSG91_AUTHKEY`.
* **Brute-Force Protection:** MSG91 rate-limits OTP generation per phone number (max 3 retries in 10 minutes).
* **Credentials:** Separated into client-safe widget IDs and server-only auth keys.

---

## 13. Customer Web Production Audit

* **Canonical Serviceability:** Confirmed aligned with PostgreSQL `evaluateServerServiceability()` via Phase 2.7C.
* **Build Status:** 🔴 **BLOCKED**.
  - `npm run build` at the repository root fails webpack/TypeScript compilation due to untracked experimental files in `app/api/copilotkit/` and `app/assistant/`.
  - Must be resolved before web deployment can succeed.

---

## 14. Customer Android APK Audit

* **Configuration:** `customer-app/capacitor.config.json`
  - App ID: `com.pocketkirana.customer`
  - App Name: `PocketKirana`
  - Web Directory: `out` (Static export)
* **API Endpoints:**
  - `.env.production` sets `NEXT_PUBLIC_API_URL=https://pocketkirana.in`.
  - Capacitor `allowNavigation` includes `msg91.com`, `pocketkirana.in`, `firebaseapp.com`, `mercury.phonepe.com`.
* **Cleartext Traffic:** Disabled (`cleartext: false`).
* **Previous Localhost Bug Analysis:**
  - Earlier testing builds hardcoded `localhost:3000` into mobile assets, preventing network requests on physical Android devices.
  - Verified: `customer-app/services/api/index.ts` and `.env.production` now reference production domain `https://pocketkirana.in`.

---

## 15. Delivery Partner App Audit

* **Architecture:** `delivery-app/` Next.js + Capacitor application.
* **Build Verification:** Compiles cleanly (`npm run build` completed with code 0; 21 static routes generated).
* **Driver Earnings vs Delivery Fee Separation:**
  - Verified: Customer delivery fee logic (`evaluateServerServiceability`) is strictly distinct from driver transit payout calculation.
* **Delivery Security:** Enforces 4-digit numeric delivery OTP verification before order can transition to `DELIVERED`.

---

## 16. Picker App Audit

* **Architecture:** `picker-app/` Next.js + Capacitor application.
* **Build Verification:** Compiles cleanly (`npm run build` completed with code 0).
* **Picking Queue & FEFO Guidance:**
  - Interfaces with Firestore picking tasks and PostgreSQL batch assignments.
  - Validates barcode scanning and batch expiry dates before packing.

---

## 17. Admin Portal Audit

* **Location:** `app/admin/*`
* **Authority Alignment:**
  - Service-area management migrated from Firestore to PostgreSQL `stores` in Phase 2.7C.7.6-C.
  - Coordinate tampering blocked by HMAC developer authorization tokens (`lib/coordinateProtection.ts`).
  - Sensitive store settings (`delivery_radius_km`, `min_order_amount`, `operating_hours`, `store_status`) enforced via PostgreSQL constraints and audit logging (`audit_logs` table).

---

## 18. Cloudflare / R2 / CDN Audit

* **DNS & Proxy:** `pocketkirana.in` proxied through Cloudflare with TLS 1.3 / Full (Strict) SSL.
* **Object Storage (R2):**
  - Bucket: `pocketkirana-catalog`
  - Managed via `@aws-sdk/client-s3` in `lib/r2.ts`.
  - Credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) are server-only.
  - Image delivery served via custom CDN domain or signed URLs.

---

## 19. VPS / PM2 / Runtime Audit

* **Target OS:** Ubuntu 22.04 LTS / Windows Server VPS.
* **Node Version:** Node.js v18 LTS or v20 LTS.
* **PM2 Process Configuration:**
  - Cluster mode recommended for web (`instances: "max"`).
  - Outbox worker daemon must run as a **single instance** (`instances: 1`) to prevent duplicate notification/webhook processing.
* **Runtime Caveat (Finding B):**
  - Cluster mode will isolate in-memory coordinate nonces across workers unless backed by PostgreSQL.

---

## 20. Domain & TLS Audit

* **Production Domains:**
  - Storefront & API: `https://pocketkirana.in`
  - Admin Portal: `https://pocketkirana.in/admin`
* **Hardcoded Development Hostnames:**
  - Audited production code: Zero hardcoded `localhost:3000` or `127.0.0.1` URLs remain in active production paths.
  - Experimental CopilotKit route (`app/api/copilotkit/[[...slug]]/route.ts`) contained loopback checks for local development demos.

---

## 21. Observability Audit

| Observability Component | Status | Implementation Details |
|---|---|---|
| **Application Logs** | 🟡 **PARTIAL** | Console logging present; structured JSON logging (Winston/Pino) not standardized. |
| **Telemetry & Analytics** | 🟢 **READY** | PostHog integrated across web and mobile clients (`posthog-js`). |
| **Error Tracking (Sentry)** | ⚪ **NOT VERIFIED** | Sentry SDK configuration absent from root Next.js config. |
| **Database Monitoring** | 🟡 **PARTIAL** | Standard PostgreSQL `pg_stat_activity`; query latency metrics not exported to Prometheus. |
| **Outbox Monitoring** | 🟡 **PARTIAL** | Outbox events table tracks status and retries; dead-letter alerting queue missing. |
| **Payment Alerts** | 🔴 **BLOCKER** | Failed webhook and state reconciliation alerts not integrated into an on-call system. |
| **Health Check Endpoint** | 🟢 **READY** | `GET /api/health` returns database connectivity and timestamp. |

---

## 22. Disaster Recovery

* **RPO Target:** $\le 5$ Minutes (Continuous WAL / Cloud SQL snapshots).
* **RTO Target:** $\le 30$ Minutes.
* **Cold Storage Offsite Retention:** Documented target `gs://pocketkirana-db-backups-coldline`.
* **Production Disaster Recovery Readiness:** 🔴 **BLOCKED**.
  - A disaster recovery architecture cannot be declared production-ready until an actual restoration drill is successfully executed from a backup snapshot.

---

## 23. Security Audit

* **SQL Injection:** 🟢 **PROTECTED**. All SQL queries in `app/api/*`, `lib/services/*`, and `lib/storeOperationsService.ts` utilize parameterized queries (`$1, $2, ...`). Zero raw string concatenation found.
* **Cross-Site Scripting (XSS):** 🟢 **PROTECTED**. React 19 default escaping enforced; no `dangerouslySetInnerHTML` on unvetted user input.
* **IDOR Protection:** 🟢 **PROTECTED**. Order retrieval and customer profile endpoints enforce `firebase_uid` matching against authenticated session JWT.
* **Store Coordinate Tampering:** 🟡 **HARDENED WITH MULTI-WORKER GAP**. Normal admins cannot relocate darkstores without an HMAC token, but nonces are held in process memory.
* **Webhook Signature Forgery:** 🟢 **PROTECTED**. PhonePe webhooks validate SHA-256 HMAC checksums (`X-VERIFY`) against `PHONEPE_SALT_KEY`.

---

## 24. Production Build Audit (Known Finding C)

### Root Project Build (`next build`):
* **Status:** 🔴 **FAILING**
* **Root Cause:** Untracked experimental directories `app/api/copilotkit/` and `app/assistant/`.
* **Errors Triggered:**
  - `app/api/copilotkit/[[...slug]]/route.ts`: TS2307 (Cannot find module `@copilotkit/runtime/v2`).
  - `app/assistant/providers.tsx`: TS2307 (Cannot find module `@copilotkit/react-core/v2`), TS7031, TS7006.
* **Impact:** Next.js crawls all routes under `app/` during production build. These compilation errors abort the build immediately.
* **Production Dependencies:** These experimental files are **NOT imported** by any canonical customer, admin, or checkout code.

### Subproject Builds:
* `customer-app`: 🟢 **PASS** (199 static pages generated).
* `delivery-app`: 🟢 **PASS** (21 static pages generated).
* `picker-app`: 🟢 **PASS** (Static pages generated).
* `functions`: 🟢 **PASS** (`tsc` compiles with 0 errors).
* Automated Tests: 🟢 **PASS** (59 test suites passed, 851/851 tests green).

---

## 25. Production Readiness Scorecard

| Area | Status | Severity | Evidence | Production Blocker? |
|---|---|---|---|---|
| **Business Authority** | 🟢 READY | None | Final Business Authority Scan confirmed PostgreSQL is sole authority. | NO |
| **PostgreSQL Schema** | 🟢 READY | None | 62 canonical tables, strict foreign keys, indexes, and constraints. | NO |
| **Database Permissions** | 🟡 PARTIAL | Medium | Runtime role `pk_app_user` lacks DDL, but deployment script separation must be verified. | NO |
| **Backups & Restore** | 🔴 BLOCKER | High | Pre-migration dump exists on host, but restore drill has never been executed. | YES |
| **PhonePe Payments** | 🔴 BLOCKER | Critical | Finding A: State machine and webhook disconnect leave orders in pending status. | YES |
| **Order State Machine** | 🟡 PARTIAL | High | Canonical status transitions strictly validated, but lacks `payment_status` parameter. | YES |
| **Inventory / FEFO** | 🟢 READY | None | Row-level locking, FEFO batch selection, zero negative balances. | NO |
| **Transactional Outbox** | 🟡 PARTIAL | Medium | Optimistic locking works; multi-worker PM2 requires distinct worker tokens. | NO |
| **Firebase Auth & RBAC** | 🟢 READY | None | Server-side token verification and store assignment enforcement. | NO |
| **FCM Notifications** | 🟢 READY | None | Asynchronously decoupled through outbox events. | NO |
| **MSG91 OTP** | 🟢 READY | None | Mobile SDK and server verification configured with separation. | NO |
| **Customer Web** | 🔴 BLOCKER | Critical | Root build fails due to untracked CopilotKit modules. | YES |
| **Customer APK** | 🟡 PARTIAL | Medium | Static export builds cleanly; release binary APK generation pending. | NO |
| **Delivery App** | 🟢 READY | None | Clean build, delivery OTP verification, separate earnings logic. | NO |
| **Picker App** | 🟢 READY | None | Clean build, FEFO batch scanning, Firestore task sync. | NO |
| **Admin Portal** | 🟢 READY | None | Store operations canonicalized to PostgreSQL with audit logging. | NO |
| **Cloudflare & CDN** | 🟢 READY | None | Strict SSL proxy active; DNS resolved. | NO |
| **R2 Storage** | 🟢 READY | None | S3 API integration in `lib/r2.ts` for media uploads. | NO |
| **VPS / PM2 Runtime** | 🟡 PARTIAL | Medium | PM2 cluster mode incompatible with in-memory coordinate nonces. | NO |
| **TLS / DNS** | 🟢 READY | None | HTTPS enforced; no localhost URLs in production configurations. | NO |
| **Observability** | 🟡 PARTIAL | Medium | PostHog active; centralized APM / Sentry error tracking missing. | NO |
| **Disaster Recovery** | 🔴 BLOCKER | High | Untested restore capability; offsite automated export not verified. | YES |
| **Application Security** | 🟡 PARTIAL | Medium | Parameterized SQL and HMAC protection in place; coordinate nonce persistence needed. | NO |

---

## 26. Critical Production Blockers & Risk Prioritization

### P0 — Critical Production Blockers (Must Be Fixed Before ANY Production Launch)

1. **P0-1: PhonePe Order & Payment State Reconciliation Failure (Known Finding A)**
   - **Affected Component:** `lib/services/orderService.ts`, `app/api/payments/phonepe/verify/route.ts`, `app/api/payments/phonepe/webhook/route.ts`.
   - **Evidence:** `OrderService.transitionOrder` does not update `payment_status`. Simulation mode leaves PostgreSQL orders in `payment_status = 'pending'`. Webhook route executes `UPDATE orders ... WHERE id = $1` with Firestore `orderId`, which matches 0 rows when passed `order_number`.
   - **Why It Matters:** Customers who successfully pay via PhonePe will have their orders stuck in `PLACED` and `payment_status = 'pending'`, preventing picking, dispatch, and delivery.
   - **Required Remediation:** Controlled code update to add `paymentStatus` support to `OrderTransitionRequest`, atomic query update in `transitionOrder`, and UUID/order_number resolution in the webhook route.

2. **P0-2: Root Production Build Webpack Failure (Known Finding C)**
   - **Affected Component:** `app/api/copilotkit/[[...slug]]/route.ts`, `app/assistant/providers.tsx`.
   - **Evidence:** `npx tsc --noEmit` and `npm run build` fail with fatal compilation errors (`Cannot find module '@copilotkit/runtime/v2'`).
   - **Why It Matters:** Root Next.js container/VPS deployment (`next build`) cannot complete.
   - **Required Remediation:** Quarantine or prune untracked experimental CopilotKit files from `app/` so production builds compile cleanly.

---

### P1 — High Priority Hardening (Required Before Full Scale Traffic)

1. **P1-1: In-Memory Coordinate Nonce Tracker (Known Finding B)**
   - **Affected Component:** `lib/coordinateProtection.ts`.
   - **Evidence:** `consumedNonces` is stored in an in-memory JavaScript `Map`.
   - **Why It Matters:** In a multi-worker PM2 cluster or across server restarts, replay protection fails across workers during the 5-minute token TTL window.
   - **Required Remediation:** Implement PostgreSQL table `consumed_developer_nonces` for shared single-use nonce tracking across all PM2 cluster processes.

2. **P1-2: Untested Database Backup & Disaster Recovery Drill**
   - **Affected Component:** PostgreSQL infrastructure & backup storage.
   - **Evidence:** Pre-migration dump exists on testing host, but `pg_restore` verification drill has never been executed against a staging/test target.
   - **Why It Matters:** A backup that cannot be restored does not provide disaster recovery.
   - **Required Remediation:** Perform a non-destructive restore drill into a temporary staging database.

3. **P1-3: Outbox Worker Multi-Process Fencing**
   - **Affected Component:** `lib/db/outboxWorker.ts`.
   - **Evidence:** Lease acquisition works, but PM2 cluster execution without instance-specific worker identifiers can lead to redundant lease attempts.
   - **Why It Matters:** Risks duplicate event notifications under high concurrency.
   - **Required Remediation:** Configure PM2 ecosystem file to run outbox worker as a dedicated single-instance daemon (`instances: 1`).

---

### P2 — Medium Priority (Post-Launch Operations & Monitoring)

1. **P2-1: Centralized Error Monitoring (Sentry / APM)**
   - Implement Sentry or Google Cloud Error Reporting for real-time unhandled exception capture.
2. **P2-2: Structured Logging (Pino/Winston)**
   - Replace standard `console.log` / `console.warn` with structured JSON logging containing request trace IDs.
3. **P2-3: Customer Release APK Signing & Distribution**
   - Generate release Android App Bundle (AAB) / APK signed with production keystore.

---

### P3 — Cleanup

1. **P3-1: Prune Legacy Phase 0/1 Test Orders**
   - Clean up the 19 test orders with `store_id = NULL` from early database initialization before production launch.

---

## 27. Final Production Verdict

### 🔴 NOT PRODUCTION READY

**Rationale:**  
While PocketKirana's core business-rule architecture (PostgreSQL authority, inventory FEFO, and subproject mobile builds) is robust and correctly decoupled from legacy Firebase logic, the system cannot be deployed to production in its current state due to two absolute blockers:
1. The PhonePe payment state transition disconnect (Finding A) leaves successful customer payments in an unresolved `pending` state in PostgreSQL.
2. The untracked CopilotKit experimental files in `app/` (Finding C) prevent the root Next.js production build from completing.

---

## 28. "DO NOT FIX YET" — Future Controlled Implementation Inventory

In accordance with Phase 2.8 strict audit rules, **NO code or database changes were made during this audit**. The following issues are cataloged for controlled future implementation phases:

1. **Phase 2.9A — PhonePe State Transition & OrderService Disconnect Fix:**
   - Update `OrderService.transitionOrder` to accept `paymentStatus?: string` and update `payment_status` in PostgreSQL.
   - Align `app/api/payments/phonepe/verify/route.ts` and `app/api/payments/phonepe/webhook/route.ts` to update `orders` atomically by either UUID `id` or `order_number`.
   - Replace mocked unit tests with integration verification asserting actual database row mutations.

2. **Phase 2.9B — Experimental Files Cleanup & Root Build Unblock:**
   - Remove or relocate untracked `app/api/copilotkit/` and `app/assistant/` out of the Next.js `app/` hierarchy into an isolated lab directory or branch.
   - Validate clean root `next build` execution.

3. **Phase 2.9C — Coordinate Nonce Persistence & Multi-Worker Hardening:**
   - Add PostgreSQL-backed table for consumed developer nonces in `lib/coordinateProtection.ts`.
   - Configure PM2 ecosystem configuration for single-instance outbox worker execution.

4. **Phase 2.9D — Disaster Recovery Verification Drill:**
   - Execute non-destructive `pg_restore` verification drill against a test PostgreSQL instance.

---
**Audit Complete. System awaiting review.**
