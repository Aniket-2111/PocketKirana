# PocketKirana — Inventory & FEFO Reservation Architecture

## 1. Overview & Single Source of Truth

PostgreSQL is the single authoritative source of truth for stock levels and batch tracking.
Inventory is partitioned into batches with expiry dates to enforce **First-Expired, First-Out (FEFO)** picking.

Tables:
- `products`: Product master and aggregated stock counts.
- `inventory_batches`: Individual batch lots with batch number, manufacturing date, and expiry date.
- `stock_reservations`: Active holds against orders during checkout and picking.
- `inventory_transactions`: Immutable double-entry ledger of all stock additions, reservations, releases, and deductions.

---

## 2. Synchronous Transactional Reservation vs Async Outbox

Inventory reservation and order placement execute in a **single synchronous PostgreSQL transaction**. The outbox worker does NOT perform or control the stock reservation that decides whether an order exists.

### Synchronous Checkout Transaction Workflow:
```text
BEGIN TRANSACTION
  1. Authoritatively validate and freeze pricing against catalog
  2. Lock inventory batches for all order items:
       SELECT id, available_quantity, expiry_date 
       FROM inventory_batches 
       WHERE product_id = $1 AND available_quantity > 0 AND expiry_date > CURRENT_DATE
       ORDER BY expiry_date ASC 
       FOR UPDATE;
  3. Validate available >= requested; fail immediately if insufficient
  4. Allocate FEFO batch quantities and deduct available_quantity
  5. Write stock_reservations with 15-minute expiration
  6. Write immutable inventory_transactions ledger entry
  7. Write orders, order_items, order_addresses
  8. Write order_status_history (status: 'PLACED')
  9. Write outbox_events (eventType: 'order.placed')
COMMIT
```

### Asynchronous Outbox Downstream:
```text
outbox_events ('order.placed')
       │
       ▼
outbox worker polling
       ├──► Customer push notification / order confirmation SMS
       ├──► Project order to Firestore live mirror
       └──► Order analytics / dashboard counters
```

This guarantees zero stock races: an order cannot exist without physical reservation, and delays or failures in background workers cannot cause overselling or missed reservations.

---

## 3. Core Inventory Invariants

1. **Synchronous Reservation**: Inventory reservation occurs exclusively inside the synchronous checkout database transaction.
2. **Prevent Negative Inventory**: DB constraints ensure `available_quantity >= 0` at all times.
3. **Strict FEFO Allocation**: Batches with the nearest expiry date are reserved first. Expired items (`expiry_date <= CURRENT_DATE`) are strictly excluded.
4. **Reservation Lifespan**: Reservations have an `expires_at` timestamp (default: 15 minutes). If payment fails or times out, reservations are unlocked and returned to available inventory.
5. **Order Cancellation**: When an order transitions to `CANCELLED`, all associated reservations are unlocked and returned to `inventory_batches.available_quantity` within the same transaction.
6. **Delivery Completion**: On `DELIVERED`, the reserved stock is finalized as consumed and permanently recorded in the inventory transaction ledger.
