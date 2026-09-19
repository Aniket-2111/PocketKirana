const fs = require('fs');
const path = require('path');

const routes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'phase-17-routes.json'), 'utf8'));

let md = `# Phase 17 — Authoritative Route Matrix & Surface Inventory

## 1. Executive Summary & Inventory Reconciliation

The PocketKirana codebase contains **102 Next.js API Routes**, **52 Application Page Routes**, and **19 Background Cloud Functions**. This comprehensive audit reconciles the historical 74-route baseline across all operational surfaces.

| Surface Category | Count | Primary Role | Auth Mode | Database Authority |
| :--- | :---: | :---: | :---: | :---: |
| **Admin Operations (\`/api/admin/*\`)** | 20 | Admin | RS256 JWT / Session | PostgreSQL / Firestore |
| **Picker & Packing Tasks (\`/api/picker/*\`, \`/api/picking/*\`, \`/api/packing/*\`)** | 8 | Picker / Admin | RS256 JWT | PostgreSQL / Outbox |
| **Delivery Partner Workflows (\`/api/delivery/*\`)** | 18 | Delivery / Admin | RS256 JWT | PostgreSQL / Outbox |
| **Customer Orders & Checkout (\`/api/checkout/*\`, \`/api/orders/*\`, \`/api/cart/*\`)** | 11 | Customer | RS256 JWT | PostgreSQL (Row Locked) |
| **Catalog, Products & Public Auth (\`/api/products/*\`, \`/api/brands/*\`, \`/api/categories/*\`, \`/api/auth/send-otp\`)** | 40 | Public / Read | Public Read, Admin Write | PostgreSQL / Redis |
| **Authenticated Session (\`/api/auth/me\`, \`/api/auth/logout\`)** | 3 | Authenticated User | RS256 JWT / Session | Firebase / PostgreSQL |
| **Payments & Webhooks (\`/api/payments/*\`)** | 1 | Payment Gateway | HMAC-SHA256 / Checksum | PostgreSQL / Outbox |
| **System Diagnostics (\`/api/health\`)** | 1 | Public / Health Probe | Fast Liveness & Deep | PostgreSQL / Outbox |
| **Total Next.js API Routes** | **102** | — | — | — |

---

## 2. Complete API Route Matrix

| Route Path | Allowed Methods | Category | Required Role | Auth Required | Database | Idempotent |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: |
`;

for (const r of routes) {
  md += `| \`${r.route}\` | ${r.methods.join(', ') || 'GET'} | ${r.category} | ${r.requiredRole} | ${r.authRequired ? '✅ Yes' : '❌ Public/HMAC'} | ${r.database} | ${r.idempotencyRequired ? '✅ Yes' : '—'} |\n`;
}

md += `
---

## 3. Cloud Functions Inventory (19 Functions)

| Function Name | Trigger Type | Primary Role / Responsibility |
| :--- | :--- | :--- |
| \`placeOrder\` | HTTPS | Atomic order creation and FEFO reservation fallback |
| \`processPayment\` | HTTPS | Server-side payment initialization |
| \`phonepeWebhook\` | HTTPS | PhonePe payment webhook callback handler |
| \`razorpayWebhook\` | HTTPS | Razorpay payment webhook callback handler |
| \`updateDeliveryLocation\` | HTTPS | Rider GPS location updates and realtime projection |
| \`updateOrderStatus\` | HTTPS | Canonical order lifecycle transitions |
| \`assignPicker\` | HTTPS | Auto-dispatch order to active store picker |
| \`assignDeliveryPartner\` | HTTPS | Auto-dispatch order to nearby rider |
| \`sendOrderNotification\` | Firestore Trigger | Push notification dispatch via FCM |
| \`generateInvoicePdf\` | Firestore Trigger | PDF tax invoice generation and Cloud Storage upload |
| \`fefoInventorySync\` | Scheduled Cron | Daily FEFO stock balance and batch expiry sync |
| \`dailyReconciliation\` | Scheduled Cron | End-of-day payment ledger reconciliation |
| \`cleanupStaleCarts\` | Scheduled Cron | Garbage collection of abandoned carts |
| \`checkServiceability\` | HTTPS | Geofence and dark store serviceability validation |
| \`syncProductsPostgres\` | Firestore/HTTPS | Product catalog synchronization to PostgreSQL |
| \`aggregateAnalytics\` | Scheduled Cron | Daily sales, order volume, and latency aggregation |
| \`backupDatabaseCron\` | Scheduled Cron | Automated PostgreSQL backup snapshot trigger |
| \`healthCheck\` | HTTPS | Cloud Function liveness and dependency diagnostic probe |
| \`reconcileOutboxEvents\` | Scheduled Cron | Periodic sweep for stalled/failed outbox events |
`;

fs.writeFileSync(path.join(__dirname, '..', 'docs', 'PHASE_17_ROUTE_MATRIX.md'), md);
console.log('Generated docs/PHASE_17_ROUTE_MATRIX.md successfully.');
