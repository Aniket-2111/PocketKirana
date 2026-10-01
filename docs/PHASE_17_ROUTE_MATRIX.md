# Phase 17 — Authoritative Route Matrix & Surface Inventory

## 1. Executive Summary & Inventory Reconciliation

The PocketKirana codebase contains **102 Next.js API Routes**, **52 Application Page Routes**, and **19 Background Cloud Functions**. This comprehensive audit reconciles the historical 74-route baseline across all operational surfaces.

| Surface Category | Count | Primary Role | Auth Mode | Database Authority |
| :--- | :---: | :---: | :---: | :---: |
| **Admin Operations (`/api/admin/*`)** | 20 | Admin | RS256 JWT / Session | PostgreSQL / Firestore |
| **Picker & Packing Tasks (`/api/picker/*`, `/api/picking/*`, `/api/packing/*`)** | 8 | Picker / Admin | RS256 JWT | PostgreSQL / Outbox |
| **Delivery Partner Workflows (`/api/delivery/*`)** | 18 | Delivery / Admin | RS256 JWT | PostgreSQL / Outbox |
| **Customer Orders & Checkout (`/api/checkout/*`, `/api/orders/*`, `/api/cart/*`)** | 11 | Customer | RS256 JWT | PostgreSQL (Row Locked) |
| **Catalog, Products & Public Auth (`/api/products/*`, `/api/brands/*`, `/api/categories/*`, `/api/auth/send-otp`)** | 40 | Public / Read | Public Read, Admin Write | PostgreSQL / Redis |
| **Authenticated Session (`/api/auth/me`, `/api/auth/logout`)** | 3 | Authenticated User | RS256 JWT / Session | Firebase / PostgreSQL |
| **Payments & Webhooks (`/api/payments/*`)** | 1 | Payment Gateway | HMAC-SHA256 / Checksum | PostgreSQL / Outbox |
| **System Diagnostics (`/api/health`)** | 1 | Public / Health Probe | Fast Liveness & Deep | PostgreSQL / Outbox |
| **Total Next.js API Routes** | **102** | — | — | — |

---

## 2. Complete API Route Matrix

| Route Path | Allowed Methods | Category | Required Role | Auth Required | Database | Idempotent |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| `/api/admin/analytics/overview` | GET | ADMIN | admin | ✅ Yes | Firestore | — |
| `/api/admin/analytics` | GET | ADMIN | admin | ✅ Yes | None | — |
| `/api/admin/dispatch` | GET, POST | ADMIN | admin | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/admin/exceptions` | GET, POST, OPTIONS | ADMIN | admin | ✅ Yes | Firestore | ✅ Yes |
| `/api/admin/festival-campaigns/emergency-toggle` | GET, POST | ADMIN | admin | ✅ Yes | None | ✅ Yes |
| `/api/admin/festival-campaigns` | GET, POST | ADMIN | admin | ✅ Yes | Firestore | ✅ Yes |
| `/api/admin/festival-campaigns/[id]/publish` | POST | ADMIN | admin | ✅ Yes | None | ✅ Yes |
| `/api/admin/festival-campaigns/[id]/rollback` | POST | ADMIN | admin | ✅ Yes | None | ✅ Yes |
| `/api/admin/festival-templates/generate-ai` | POST | ADMIN | admin | ✅ Yes | None | ✅ Yes |
| `/api/admin/festival-templates` | GET, POST | ADMIN | admin | ✅ Yes | None | ✅ Yes |
| `/api/admin/invoices/preview` | POST | ADMIN | admin | ✅ Yes | None | ✅ Yes |
| `/api/admin/invoices` | GET | ADMIN | admin | ✅ Yes | None | — |
| `/api/admin/invoices/template` | GET, POST | ADMIN | admin | ✅ Yes | None | ✅ Yes |
| `/api/admin/notifications/compose` | GET, POST | ADMIN | admin | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/admin/payments/summary` | GET, OPTIONS | ADMIN | admin | ✅ Yes | Firestore | — |
| `/api/admin/reports/sales` | GET | ADMIN | admin | ✅ Yes | None | — |
| `/api/admin/settlements` | GET, POST, OPTIONS | ADMIN | admin | ✅ Yes | Firestore | ✅ Yes |
| `/api/admin/store/operations` | GET, PUT | ADMIN | admin | ✅ Yes | None | ✅ Yes |
| `/api/admin/stores` | GET | ADMIN | admin | ✅ Yes | None | — |
| `/api/admin/stores/[id]` | GET, PUT, PATCH | ADMIN | admin | ✅ Yes | None | ✅ Yes |
| `/api/auth/logout` | POST | AUTHENTICATED | user | ✅ Yes | None | ✅ Yes |
| `/api/auth/logout-all` | POST | AUTHENTICATED | user | ✅ Yes | None | ✅ Yes |
| `/api/auth/me` | GET | AUTHENTICATED | user | ✅ Yes | None | — |
| `/api/auth/otp/verify` | POST | PUBLIC | none | ❌ Public/HMAC | None | ✅ Yes |
| `/api/auth/send-otp` | POST | PUBLIC | none | ❌ Public/HMAC | None | ✅ Yes |
| `/api/auth/verify-otp` | POST | PUBLIC | none | ❌ Public/HMAC | None | ✅ Yes |
| `/api/auth/verify-otp-token` | POST | PUBLIC | none | ❌ Public/HMAC | Firestore | ✅ Yes |
| `/api/brands/reorder` | POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/brands` | GET, POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/brands/[id]` | GET, PUT, DELETE | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/campaigns/active` | GET | PUBLIC | none | ❌ Public/HMAC | Firestore | — |
| `/api/cart/validate` | POST | CUSTOMER | customer | ✅ Yes | Firestore | ✅ Yes |
| `/api/categories/move` | POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/categories/reorder` | POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/categories` | GET, POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/categories/[id]` | GET, PUT, DELETE | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/checkout/calculate-price` | POST | CUSTOMER | customer | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/checkout/quote` | POST | CUSTOMER | customer | ✅ Yes | Firestore | ✅ Yes |
| `/api/checkout` | POST | CUSTOMER | customer | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/checkout/validate` | POST | CUSTOMER | customer | ✅ Yes | Firestore | ✅ Yes |
| `/api/checkout/validate-serviceability` | POST | CUSTOMER | customer | ✅ Yes | Firestore | ✅ Yes |
| `/api/delivery/assignments/[id]/accept` | POST | DELIVERY | delivery_partner | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/delivery/assignments/[id]/deliver` | POST | DELIVERY | delivery_partner | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/delivery/assignments/[id]/pickup` | POST | DELIVERY | delivery_partner | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/delivery/location` | GET, POST | DELIVERY | delivery_partner | ✅ Yes | Firestore | ✅ Yes |
| `/api/delivery/orders/[id]/accept` | POST | DELIVERY | delivery_partner | ✅ Yes | None | ✅ Yes |
| `/api/delivery/orders/[id]/arrived-store` | POST | DELIVERY | delivery_partner | ✅ Yes | None | ✅ Yes |
| `/api/delivery/orders/[id]/deliver` | POST, OPTIONS | DELIVERY | delivery_partner | ✅ Yes | Firestore | ✅ Yes |
| `/api/delivery/orders/[id]/delivered` | POST | DELIVERY | delivery_partner | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/delivery/orders/[id]/exception` | POST, OPTIONS | DELIVERY | delivery_partner | ✅ Yes | Firestore | ✅ Yes |
| `/api/delivery/orders/[id]/location` | POST | DELIVERY | delivery_partner | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/delivery/orders/[id]/out-for-delivery` | POST | DELIVERY | delivery_partner | ✅ Yes | None | ✅ Yes |
| `/api/delivery/orders/[id]/payment/collect-cash` | POST, OPTIONS | DELIVERY | delivery_partner | ✅ Yes | Firestore | ✅ Yes |
| `/api/delivery/orders/[id]/payment/create` | POST, OPTIONS | DELIVERY | delivery_partner | ✅ Yes | Firestore | ✅ Yes |
| `/api/delivery/orders/[id]/payment/status` | GET, POST, OPTIONS | DELIVERY | delivery_partner | ✅ Yes | Firestore | ✅ Yes |
| `/api/delivery/orders/[id]/pickup` | POST | DELIVERY | delivery_partner | ✅ Yes | None | ✅ Yes |
| `/api/delivery/orders/[id]/resend-otp` | POST, OPTIONS | DELIVERY | delivery_partner | ✅ Yes | Firestore | ✅ Yes |
| `/api/delivery/orders/[id]/verify-otp` | POST, OPTIONS | DELIVERY | delivery_partner | ✅ Yes | Firestore | ✅ Yes |
| `/api/delivery/route` | GET | DELIVERY | delivery_partner | ✅ Yes | None | — |
| `/api/health` | GET | HEALTH | none | ❌ Public/HMAC | PostgreSQL | — |
| `/api/inventory/adjust` | POST | PUBLIC | none | ❌ Public/HMAC | None | ✅ Yes |
| `/api/inventory/batches` | GET, POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/inventory/events` | GET | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | — |
| `/api/inventory/expiry/clearance` | GET, POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/inventory/expiry` | GET, POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/location/reverse-geocode` | POST | PUBLIC | none | ❌ Public/HMAC | None | ✅ Yes |
| `/api/location/saved` | GET, POST, DELETE | PUBLIC | none | ❌ Public/HMAC | None | ✅ Yes |
| `/api/location/search` | GET | PUBLIC | none | ❌ Public/HMAC | None | — |
| `/api/location/serviceability` | GET, POST | PUBLIC | none | ❌ Public/HMAC | Firestore | ✅ Yes |
| `/api/notifications/devices/register` | POST, DELETE | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/notifications/preferences` | GET, POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/notifications` | GET, PATCH | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/orders/[id]/acknowledge` | POST | CUSTOMER | customer | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/orders/[id]/events` | POST | CUSTOMER | customer | ✅ Yes | None | ✅ Yes |
| `/api/orders/[id]/invoice` | GET | CUSTOMER | customer | ✅ Yes | PostgreSQL | — |
| `/api/orders/[id]` | GET | CUSTOMER | customer | ✅ Yes | PostgreSQL | — |
| `/api/orders/[id]/status` | PATCH | CUSTOMER | customer | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/packing/tasks/[id]/complete` | POST | PICKER | picker | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/payments/create-order` | POST | PUBLIC | none | ❌ Public/HMAC | None | ✅ Yes |
| `/api/payments/phonepe/create` | POST | PUBLIC | none | ❌ Public/HMAC | Firestore | ✅ Yes |
| `/api/payments/phonepe/verify` | POST | PUBLIC | none | ❌ Public/HMAC | Firestore | ✅ Yes |
| `/api/payments/phonepe/webhook` | POST | WEBHOOK | gateway_hmac | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/payments/verify` | POST | PUBLIC | none | ❌ Public/HMAC | None | ✅ Yes |
| `/api/picker/orders/[id]/accept` | POST | PICKER | picker | ✅ Yes | None | ✅ Yes |
| `/api/picker/orders/[id]/pack` | POST | PICKER | picker | ✅ Yes | None | ✅ Yes |
| `/api/picker/orders/[id]/scan` | POST | PICKER | picker | ✅ Yes | None | ✅ Yes |
| `/api/picker/orders/[id]/start` | POST | PICKER | picker | ✅ Yes | None | ✅ Yes |
| `/api/picking/tasks/[id]/accept` | POST | PICKER | picker | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/picking/tasks/[id]/complete` | POST | PICKER | picker | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/picking/tasks/[id]/items/[itemId]/pick` | POST | PICKER | picker | ✅ Yes | PostgreSQL | ✅ Yes |
| `/api/products/barcode/[value]` | GET | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | — |
| `/api/products/identifiers/verify` | POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/products` | GET | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | — |
| `/api/products/[id]/identifiers` | GET, POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/products/[id]/variants/reorder` | POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/products/[id]/variants` | GET, POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/products/[id]/variants/[variantId]` | GET, PUT, DELETE | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/seed` | GET, POST | PUBLIC | none | ❌ Public/HMAC | Firestore | ✅ Yes |
| `/api/service-requests` | GET, POST, PATCH | PUBLIC | none | ❌ Public/HMAC | Firestore | ✅ Yes |
| `/api/serviceability/check` | GET, POST | PUBLIC | none | ❌ Public/HMAC | None | ✅ Yes |
| `/api/v1/products` | GET, POST | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |
| `/api/v1/products/[id]` | GET, PUT, DELETE | PUBLIC | none | ❌ Public/HMAC | PostgreSQL | ✅ Yes |

---

## 3. Cloud Functions Inventory (19 Functions)

| Function Name | Trigger Type | Primary Role / Responsibility |
| :--- | :--- | :--- |
| `placeOrder` | HTTPS | Atomic order creation and FEFO reservation fallback |
| `processPayment` | HTTPS | Server-side payment initialization |
| `phonepeWebhook` | HTTPS | PhonePe payment webhook callback handler |
| `razorpayWebhook` | HTTPS | Razorpay payment webhook callback handler |
| `updateDeliveryLocation` | HTTPS | Rider GPS location updates and realtime projection |
| `updateOrderStatus` | HTTPS | Canonical order lifecycle transitions |
| `assignPicker` | HTTPS | Auto-dispatch order to active store picker |
| `assignDeliveryPartner` | HTTPS | Auto-dispatch order to nearby rider |
| `sendOrderNotification` | Firestore Trigger | Push notification dispatch via FCM |
| `generateInvoicePdf` | Firestore Trigger | PDF tax invoice generation and Cloud Storage upload |
| `fefoInventorySync` | Scheduled Cron | Daily FEFO stock balance and batch expiry sync |
| `dailyReconciliation` | Scheduled Cron | End-of-day payment ledger reconciliation |
| `cleanupStaleCarts` | Scheduled Cron | Garbage collection of abandoned carts |
| `checkServiceability` | HTTPS | Geofence and dark store serviceability validation |
| `syncProductsPostgres` | Firestore/HTTPS | Product catalog synchronization to PostgreSQL |
| `aggregateAnalytics` | Scheduled Cron | Daily sales, order volume, and latency aggregation |
| `backupDatabaseCron` | Scheduled Cron | Automated PostgreSQL backup snapshot trigger |
| `healthCheck` | HTTPS | Cloud Function liveness and dependency diagnostic probe |
| `reconcileOutboxEvents` | Scheduled Cron | Periodic sweep for stalled/failed outbox events |
