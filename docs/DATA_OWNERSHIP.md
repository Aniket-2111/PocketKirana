# PocketKirana — Data Ownership & Storage Matrix

This document defines the single authoritative owner, secondary projections, and synchronization policies for every data entity across PocketKirana.

---

## 1. Entity Ownership Matrix

| Domain Entity | Primary Authoritative Store | Secondary / Projection Store | Synchronization Mechanism | Consistency Model |
| :--- | :--- | :--- | :--- | :--- |
| **User Identity** | Firebase Authentication | PostgreSQL `users` table | Webhook / Auth sync handler | Eventual |
| **Catalog Products** | PostgreSQL `products` | Cloudflare R2 (images), Redis | Admin API mutation + cache invalidation | Strong for edits, Cache TTL for reads |
| **Orders & Items** | PostgreSQL `orders`, `order_items` | Firestore `orders/{id}` | Outbox Worker & Transaction handler | Strong (PG), Eventual (Firestore mirror) |
| **Order Status** | PostgreSQL `orders.order_status` | Firestore `orders/{id}.orderStatus` | `OrderService.transitionOrder` transaction | Immediate in PG, async mirror to Firestore |
| **Status Audit Log**| PostgreSQL `order_status_history`| None | Written in same DB transaction | Strong |
| **Payments** | PostgreSQL `payments`, `payment_transactions` | Firestore `payments/{id}` | Webhook handler / Verify endpoint | Strong (PG), Read mirror (Firestore) |
| **Inventory & Stock**| PostgreSQL `inventory_batches`, `stock_reservations` | Memory Cache / UI | `reserveStockFefo` transaction | Strong (Row lock `FOR UPDATE`) |
| **Picking Tasks** | PostgreSQL `picker_tasks`, `picker_task_items` | Firestore `picking_tasks/{id}` | `PickerService` / Outbox event | Strong (PG), Realtime mirror for app |
| **Delivery Assign** | PostgreSQL `delivery_assignments` | Firestore `deliveries/{id}` | `DeliveryService` / Outbox event | Strong (PG), Realtime mirror for app |
| **Driver GPS** | Firebase Realtime DB / Firestore | PostgreSQL `driver_location_logs` | Periodic background flush / milestones | Realtime in Firebase, sampled PG log |
| **Invoices** | PostgreSQL `invoice_records` | Cloudflare R2 (PDFs), Firestore | `invoiceEngine` on order delivery/payment | Immutable forever (`ON DELETE RESTRICT`) |
| **Refunds** | PostgreSQL `refunds` | Firestore `refunds/{id}` | Gateway refund handler | Strong |
| **Outbox Events** | PostgreSQL `outbox_events` | None (Worker pulls directly) | Polling worker with lease fencing | At-least-once |

---

## 2. Competing Source of Truth Prevention Rules

1. **Client Never Mutates Firestore Orders**:
   - Security rules in `firestore.rules` prohibit client `update` or `create` on `/orders/{orderId}` and `/payments/{paymentId}`.
   - All mutations must be submitted via `/api/checkout`, `/api/delivery/**`, or `/api/picker/**`.

2. **Invoice Records are Permanently Immutable**:
   - The foreign key from `invoice_records.order_id` to `orders(id)` uses `ON DELETE RESTRICT`.
   - Invoices are legal accounting artifacts. Finalized invoices are never deleted, even if an order undergoes disputes or returns. In case of post-delivery cancellation or adjustments, a credit note is appended to the ledger; the original invoice is preserved forever.

3. **Synchronous Inventory Authority**:
   - Stock reservation occurs synchronously inside the PostgreSQL checkout transaction (`SELECT ... FOR UPDATE`).
   - The outbox worker does NOT perform or own inventory reservations; it only handles downstream projections and alerts.

4. **Driver GPS Throttling**:
   - High-frequency GPS pings stream exclusively to Firebase Realtime Database for live map rendering.
   - PostgreSQL only stores sampled checkpoint milestones (`driver_location_logs`) to prevent database write saturation.

5. **Cloud Functions are Subordinate Processors**:
   - Cloud Functions only consume events or perform async maintenance.
   - Cloud Functions are not permitted to invent or mutate order statuses without passing through `OrderService` or verifying against PostgreSQL.

6. **Cache Invalidation Hierarchy**:
   - A PostgreSQL transaction commit is required before invalidating edge/CDN caches or broadcasting FCM pushes.
