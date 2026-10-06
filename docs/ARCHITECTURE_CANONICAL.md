# PocketKirana — Authoritative System Architecture

## 1. Architectural Philosophy & Single Source of Truth

PocketKirana operates on a strict **authoritative transactional tier vs. projection/realtime tier** architecture.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AUTHORITATIVE SYSTEM                            │
│                 PostgreSQL (Primary Source of Truth)                   │
├────────────────────────────────────────────────────────────────────────┤
│ • orders & order_items                                                 │
│ • order_status & order_status_history                                  │
│ • payments & payment_transactions                                      │
│ • inventory_batches & stock_reservations                               │
│ • picker_tasks & task_items                                            │
│ • delivery_assignments & delivery milestones                           │
│ • invoice_records & sequence counters                                  │
│ • refunds & balance ledgers                                            │
│ • outbox_events & audit logs                                           │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   │ Outbox Worker & Synchronizers
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         PROJECTION & REALTIME                          │
│                      Firebase (Realtime Sync & FCM)                    │
├────────────────────────────────────────────────────────────────────────┤
│ • Firebase Authentication (Identity Tokens)                            │
│ • FCM Push Notifications (Customer & Partner Alerts)                   │
│ • Realtime order status mirrors (read-only projection for UI reactive) │
│ • Active delivery driver GPS location & presence                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibilities

### 2.1 Next.js App Router (Backend APIs & Web Frontend)
- **Customer Web / APK Wrapper**: Reads catalog, initiates quotes, submits checkout orders.
- **Admin Dashboard**: Store management, catalog management, inventory control, and emergency override audits.
- **Picker Interface**: Store queue, barcode validation, bin/batch assignment, packing verification.
- **Delivery Partner App**: Assignment acceptance, road routing, cash-on-delivery collection, OTP verification.
- **Authoritative API Routes** (`/api/**`): Enforce server-side RBAC, ownership, idempotency, and transactional mutations.

### 2.2 PostgreSQL Database
- Enforces strict foreign keys, unique constraints, and atomic row-level locking (`SELECT ... FOR UPDATE`).
- Manages transactional outbox events to guarantee at-least-once delivery to notification consumers.
- Sequences invoice numbers via `invoice_number_seq` to ensure immutable, non-colliding accounting records.

### 2.3 Firebase Platform
- **Authentication**: Issues RS256-signed ID tokens; server verifies signatures against Google JWKS.
- **Firestore**: Serves as a downstream projection for live reactive subscriptions; client direct mutations on transactional collections are strictly blocked.
- **Cloud Messaging (FCM)**: Dispatches customer updates, picker alerts, and delivery assignments.

### 2.4 Cloudflare R2
- S3-compatible, zero-egress object storage for high-resolution product imagery and finalized invoice PDFs.

### 2.5 PhonePe Payment Gateway
- Standard API integration with SHA256 checksums (`X-VERIFY`) and webhook event processing guarded by idempotency keys.

---

## 3. Communication Patterns & Invariant Rules

1. **Rule 1 — PostgreSQL Authoritative Writes & Synchronous Inventory**:
   - No business state (order status, payment confirmation, inventory deduction, picker assignment, delivery completion) may be finalized solely in Firestore. All mutations must commit to PostgreSQL.
   - Inventory reservation is a synchronous database transaction (`BEGIN ... SELECT FOR UPDATE ... UPDATE inventory ... COMMIT`) executed during checkout. Outbox workers do NOT perform the stock reservation.

2. **Rule 2 — Fail Closed & Protected VPS Secret Architecture**:
   - Missing secrets, unverified JWTs, or untrusted proxy headers cause an immediate 401/403/500 refusal. Mock bypasses are strictly forbidden in production.
   - Production secrets are stored exclusively at `/etc/pocketkirana/pocketkirana.env` with `chmod 600` permissions on the host, never committed to git repositories.

3. **Rule 3 — Transactional Outbox & Idempotent Consumer Semantics**:
   - All notifications and downstream projections originate as records in PostgreSQL `outbox_events`, claimed by workers using atomic lease fencing.
   - The notification contract is **at-least-once delivery + idempotent consumers**. Payloads carry `event_id` and `notification_id`. Clients deduplicate notifications locally; FCM does not guarantee zero duplicates.

4. **Rule 4 — Immutable Financial & Legal Invoices**:
   - Invoices are legal tax records and use `ON DELETE RESTRICT` against `orders(id)`. Finalized invoices are never deleted. Adjustments and refunds are handled via credit note ledgers.

5. **Rule 5 — Driver GPS Partitioning & Write Throttling**:
   - High-frequency GPS updates stream directly to Firebase Realtime Database for live map rendering.
   - PostgreSQL only stores sampled milestone coordinates (`driver_location_logs`) to prevent database write exhaustion.
