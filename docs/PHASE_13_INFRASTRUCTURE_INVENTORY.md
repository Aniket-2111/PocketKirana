# PocketKirana — Phase 13A: Production Infrastructure & Environment Inventory

**Timestamp:** 2026-09-19  
**Branch:** `phase-13-production-infrastructure`  
**Git Tag Baseline:** `phase-12-complete` (Commit `0485509`)  
**Test Suite:** 81 / 81 passing (100%)  

---

## 1. Domain Architecture & DNS Configuration

| Item | Current State / Configuration | Target Production Value | Notes |
| :--- | :--- | :--- | :--- |
| **Primary Domain** | `pocketkirana.com` / `pocketkirana.in` | `https://pocketkirana.com` | Configured in `NEXT_PUBLIC_SITE_URL` |
| **Customer App / Web** | Port `3000` / root | `https://pocketkirana.com` | Next.js 15 PWA |
| **API Domain** | Next.js API Routes `/api/*` | `https://api.pocketkirana.com` or `https://pocketkirana.com/api` | Reverse-proxied via Cloudflare / Nginx |
| **Admin Dashboard** | `/admin/*` on main domain | `https://admin.pocketkirana.com` | RBAC-protected via Firebase Custom Claims & PostgreSQL |
| **Picker / Packing App** | Port `3001` (in `picker-app`) | `https://picker.pocketkirana.com` | Standalone PWA / Android APK |
| **Delivery Partner App** | Standalone Next.js PWA / APK | `https://delivery.pocketkirana.com` | Standalone PWA / Android APK |
| **DNS / SSL Provider** | Local / Development | **Cloudflare** (Universal SSL, Full Strict TLS, HSTS, DDoS Protection) | Strict Origin SSL & Edge caching |

---

## 2. PostgreSQL Database Infrastructure

| Component | Current Development State | Target Production Environment (Phase 13B–13D) |
| :--- | :--- | :--- |
| **Host / Endpoint** | `192.168.0.101:5433` (Local Dev Machine) ⚠️ | **Managed PostgreSQL 16** (AWS RDS / GCP Cloud SQL / Neon / Supabase Managed) |
| **TLS / SSL** | Unencrypted local socket / disabled | `sslmode=require` / `ssl: { rejectUnauthorized: true }` |
| **Tables & Schema** | 62 tables, 79 FKs, 147 indexes, `pk_order_seq` | Migrated via reproducible migration scripts (`scripts/migrate_to_clean_architecture.js`, `init_client_postgres_tables.js`, `init_outbox_table.js`, `init_notification_tables.js`) |
| **Connection Pooling** | Local pg Pool (`max: 20`) | Managed PgBouncer / Connection pooler (`max: 50`, `idleTimeout: 30s`) |
| **Access Control** | Single `postgres` superuser ⚠️ | **Dual User Model**: <br>1. `pk_app_user`: Restricted `DML` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`)<br>2. `pk_migrator`: DDL only during deployments |
| **Automated Backups** | Local script `scripts/backup_database.js` | Automated Daily Snapshots + WAL Point-in-Time Recovery (PITR) + Offsite GCS bucket |

---

## 3. Firebase & Google Cloud Project

| Resource | Development Configuration | Target Production Configuration (Phase 13E) |
| :--- | :--- | :--- |
| **Firebase Project** | `pocketkirana` (`.firebaserc`) | `pocketkirana-prod` (Dedicated production project) |
| **Firebase Auth** | Email/Password, Phone OTP (MSG91/Firebase Auth) | Multi-factor, SMS OTP via verified production MSG91 Sender ID |
| **Firestore Security Rules** | `firestore.rules` (Role-based access) | Enforced closed-read/write rules for internal tables; public read for verified catalog |
| **Cloud Storage** | `storage.rules` (Product images & invoices) | Restricted bucket with Uniform Bucket-Level Access and signed URLs |
| **Service Account** | `FIREBASE_SERVICE_ACCOUNT_JSON` | Google Secret Manager / GCP Workload Identity (No hardcoded keys) |

---

## 4. Cloud Functions Deployment (19 Functions)

| Function Name | Trigger | Role | Build Status |
| :--- | :--- | :--- | :---: |
| `placeOrder` | HTTPS Callable | Canonical checkout pre-auth | ✅ 0 Errors |
| `processPayment` | HTTPS Callable | Payment initiation | ✅ 0 Errors |
| `phonepeWebhook` | HTTPS | Payment webhook ingress | ✅ 0 Errors |
| `razorpayWebhook` | HTTPS | Razorpay webhook ingress | ✅ 0 Errors |
| `updateDeliveryLocation` | HTTPS / Firestore Trigger | GPS location ingestion | ✅ 0 Errors |
| `updateOrderStatus` | HTTPS Callable | Status transition validation | ✅ 0 Errors |
| `assignPicker` | HTTPS Callable | Store picking assignment | ✅ 0 Errors |
| `assignDeliveryPartner` | HTTPS Callable | Dispatch algorithm | ✅ 0 Errors |
| `sendOrderNotification` | Firestore Trigger | FCM push dispatch | ✅ 0 Errors |
| `sendPromotionalNotification` | HTTPS Callable | Campaign dispatch | ✅ 0 Errors |
| `generateInvoicePdf` | Storage / Firestore Trigger | Automated invoice PDF creation | ✅ 0 Errors |
| `fefoInventorySync` | Schedule (Cron) | Expiry clearance & FEFO sync | ✅ 0 Errors |
| `dailyReconciliation` | Schedule (Cron) | Payment & ledger reconciliation | ✅ 0 Errors |
| `cleanupStaleCarts` | Schedule (Cron) | Cart & reservation garbage collector | ✅ 0 Errors |
| `checkServiceability` | HTTPS Callable | Geo-fence & hub polygon check | ✅ 0 Errors |
| `syncProductsPostgres` | HTTPS Callable / Trigger | Product catalog replication | ✅ 0 Errors |
| `aggregateAnalytics` | Schedule (Cron) | Daily GMV & sales aggregation | ✅ 0 Errors |
| `backupDatabaseCron` | Schedule (Cron) | Periodic DB dump trigger | ✅ 0 Errors |
| `healthCheck` | HTTPS | Ping / Uptime probe | ✅ 0 Errors |

---

## 5. Payment Gateways & Banking Integration

| Gateway | Sandbox / Testing | Production Configuration (Phase 13F / G3–G4) |
| :--- | :--- | :--- |
| **PhonePe** | `PHONEPE_ENV=sandbox`<br>`MERCHANT_ID=PGTESTPAYUAT86` | `PHONEPE_ENV=production`<br>`PHONEPE_MERCHANT_ID=M22...`<br>`PHONEPE_SALT_KEY` (Secret Manager) |
| **Razorpay** | `rzp_test_xxxxxxxxxx` | `rzp_live_xxxxxxxxxx` (Secret Manager) |
| **Webhook Security** | SHA256 checksum verification implemented | Secret-based HMAC signature verification with replay protection |
| **COD Workflow** | OTP-verified delivery with cash ledger | PostgreSQL `payments.payment_status = 'paid'` upon delivery agent verification |

---

## 6. Push Notifications (FCM) & SMS (MSG91)

| Channel | Component | Configuration Target |
| :--- | :--- | :--- |
| **FCM Web Push** | `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Production VAPID Key pair registered in Firebase Console |
| **FCM Android / iOS** | Google Services JSON / Service Account | Production FCM Multicast via `firebase-admin` with automatic token rotation & stale cleanup |
| **SMS OTP** | `MSG91_AUTHKEY`, `NEXT_PUBLIC_MSG91_WIDGET_ID` | Production DLT-approved templates for Order OTP, Delivery OTP, and Login OTP |

---

## 7. Outbox Worker & Realtime Projection Engine

| Component | Production Architecture |
| :--- | :--- |
| **Process Manager** | Managed daemon via PM2 cluster (`ecosystem.config.js`) or Docker sidecar |
| **Lease Mechanism** | `SELECT ... FOR UPDATE SKIP LOCKED` with 30s leases |
| **Backoff & DLQ** | Exponential backoff (`5s * retry_count^2`) up to 5 retries, then `DEAD_LETTERED` |
| **Isolation** | Outbox failures are isolated; never abort or rollback PostgreSQL transactions |

---

## 8. Version Control & Repository Status

| Item | Details |
| :--- | :--- |
| **Repository** | `https://github.com/Aniket-2111/PocketKirana.git` |
| **Active Working Branch** | `phase-13-production-infrastructure` |
| **Production Baseline Tag** | `phase-12-complete` (Commit `0485509`) |
| **CI / CD Pipeline** | Automated Vitest test suite (`81/81` tests passing), TypeScript strict checking across root web app, 3 sub-apps, and 19 Cloud Functions |
