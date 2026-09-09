# Canonical Command Path Design

**Mode:** Audit / contract only.  
**Purpose:** Define the minimum PostgreSQL command and recovery path that must be approved, implemented, and proven before Firestore stops being the business authority for orders, reservations, and payments.

This document makes no production change and does not authorize a migration, cutover, writer shutdown, schema deletion, or Firestore deletion.

---

## Verified starting point

- Firestore remains the active customer command path: order creation, reservation lifecycle, and PhonePe payment state mutation occur there.
- PostgreSQL is a live operational system with orders and inventory data, but has zero live rows in `stock_reservations`, `payments`, `payment_transactions`, and `refunds` as of the read-only verification.
- `idempotency_keys` exists and contains expired rows, but is not evidenced as the active order/payment boundary.
- There is no transactional outbox writer or publisher.

The design target is therefore a **new canonical command path**, not an inference that existing PostgreSQL tables already supply one.

---

## Contract prerequisites

The following Business Rule Approval Matrix decisions must be approved before implementation details are frozen:

1. Canonical order and payment state graphs, including terminal states and allowed actors.
2. `UNKNOWN` payment semantics, reconciliation owner/SLA, and fulfilment prohibition/exception.
3. Reservation duration for pending, failed, and `UNKNOWN` payments.
4. COD confirmation, collection proof, and fulfilment policy.
5. Cancellation/refund eligibility and gateway refund state machine.
6. Exactly-once earnings and notification semantics.
7. Outbox ownership, retry, dead-letter, replay, and observability rules.

Until then, statuses below are **contract placeholders**, not approved production values.

---

## Canonical ownership boundary

```text
Customer / gateway / operator request
            │
            ▼
Authenticated PostgreSQL Command API
  validation + idempotency check + single DB transaction
            │
            ├── Canonical Business Tables (orders, stock_reservations, payments, tasks)
            └── Transactional Outbox Table (outbox_events)
                         │ (Atomic COMMIT)
                         ▼
             Durable Outbox Publisher Worker
              (FOR UPDATE SKIP LOCKED lease)
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
Third-party Call    Async Jobs      Firestore Read Projection
(Gateway query,     (Reconciler,     (Read-only cache / onSnapshot
 SMS/FCM send)       Ledger sync)     client tracking; NO business logic)
```

Only a canonical command executed inside an ACID PostgreSQL transaction may alter business authority. Firebase receives strictly derived read-only projections after the PostgreSQL transaction commits. A client app, Cloud Function, webhook handler, or projection worker must **never** bypass that command boundary or alter business state in Firestore directly.

---

## Canonical IDs and immutable correlation

Every command and side effect must carry stable, immutable identifiers to enable end-to-end trace correlation, idempotency, and auditability:

| Fact | Required immutable identifier / relationship | Format / Example | Constraint / Uniqueness |
| --- | --- | --- | --- |
| Customer Request | `idempotency_key`, actor ID, request fingerprint, first response payload | `client_req_UUID` | Unique per `(firebase_uid, idempotency_key)` in `idempotency_keys` |
| Order | Internal canonical `id` (UUID) + sequential `order_number` | `ord_123e4567...`, `PK-1042` | `orders.id` PK, `order_number` UNIQUE |
| Reservation | Internal `reservation_id` (UUID) linked to `order_id` and store | `res_123e4567...` | `(order_id, store_id, variant_id)` unique active reservation |
| Payment Attempt | Internal `payment_id` (UUID) + `merchant_transaction_id` | `pay_123...`, `MT_ord_1042_att_1` | `payments.id` PK, `merchant_transaction_id` UNIQUE |
| Payment Provider Txn | Provider `transaction_id`, callback/event reference | `T24090518001234` | Unique in `payment_transactions` |
| Refund Attempt | Internal `refund_id` (UUID) + `merchant_refund_id` | `ref_123...`, `MR_pay_123_1` | `refunds.id` PK, unique gateway refund request ID |
| Outbox Event | Internal `event_id` (UUID), `aggregate_id`, `event_type` | `evt_123...`, `order.confirmed` | `outbox_events.id` PK, sequential version/timestamp |
| Firebase Projection | Target doc ID derived from canonical ID + `_last_applied_event_id` | `orders/{order_id}` | Guarded by `_last_applied_event_id` and monotonic `_seq` |

---

## The 6-Stage Minimum Canonical Command Chain

Before Firestore can stop being the business authority, this exact 6-stage PostgreSQL command path must be implemented, tested, and proven:

```text
1. Order Creation ──► 2. Stock Reservation ──► 3. Payment Capture & Reconciliation ──► 4. Fulfilment Handoff ──► 5. Transactional Outbox ──► 6. Firebase Projection
```

### Stage 1 & 2: Atomic Order Creation and Stock Reservation (`CreateOrderAndReserve`)

To prevent distributed partial failure (e.g. order saved but stock reservation rejected), quick-commerce inventory reservation and order placement must execute inside **one atomic PostgreSQL transaction**:

1. **Transaction Begin (`BEGIN`)**
2. **Idempotency Guard**:
   - Check `idempotency_keys` for `(firebase_uid, idempotency_key)`.
   - If present and status is `COMPLETED`, return the cached response immediately without executing queries.
   - If present and status is `IN_PROGRESS`, return `409 Conflict` (concurrent request).
   - If missing, insert `idempotency_keys` with status `IN_PROGRESS`.
3. **Cart & Store Preconditions**:
   - Validate store open status, delivery radius (Haversine), minimum order value.
4. **Stock Reservation & In-Transaction Lock**:
   - For each requested item, execute row-level locking:
     `SELECT id, quantity, reserved_quantity, damaged_quantity FROM inventory WHERE store_id = $1 AND variant_id = $2 FOR UPDATE;`
   - Calculate available quantity: `quantity - reserved_quantity - damaged_quantity`.
   - If `available < requested`, abort transaction with `ROLLBACK` and raise `INSUFFICIENT_STOCK`.
   - Update `inventory`: `reserved_quantity = reserved_quantity + requested`.
   - Insert row in `stock_reservations` (`id`, `store_id`, `variant_id`, `order_id`, `quantity`, `status = 'reserved'`, `expires_at = NOW() + INTERVAL '15 minutes'`).
5. **Order Persistence**:
   - Insert `orders` (`id`, `order_number`, `firebase_uid`, `store_id`, `subtotal`, `delivery_fee`, `tax_amount`, `total_amount`, `payment_method`, `payment_status = 'pending'`, `order_status = 'placed'`).
   - Insert `order_items` (snapshot of product name, variant name, SKU, unit price, quantity, totals).
   - Insert `order_addresses` (snapshot of customer coordinates, phone, lines, landmark).
   - Insert `order_status_history` (`order_id`, `new_status = 'placed'`, `changed_by = uid`).
6. **Outbox Event Append**:
   - Insert into `outbox_events` (`event_type = 'order.placed'`, `aggregate_type = 'order'`, `aggregate_id = order_id`, `payload = {...}`, `status = 'PENDING'`).
7. **Idempotency Finalization**:
   - Update `idempotency_keys` to status `COMPLETED` with response body snapshot.
8. **Transaction Commit (`COMMIT`)**

*Rule:* If any validation, price check, or stock locking fails, the entire transaction rolls back cleanly. Zero orphaned orders, zero phantom stock reservations.

---

### Stage 3: Payment Capture, Callback Verification & `UNKNOWN` Handling

Payments must be tracked through distinct attempts with immutable evidence:

#### A. Payment Initiation (`InitiatePayment`)
- Generates stable `merchant_transaction_id` linked to `order_id`.
- Inserts `payments` row (`id`, `order_id`, `firebase_uid`, `payment_method`, `amount`, `currency = 'INR'`, `status = 'pending'`, `gateway = 'phonepe'|'razorpay'`).
- Appends `payment.initiated` to `outbox_events`.
- Calls payment gateway SDK/API to obtain payment token/redirect URL. (Outside the DB transaction).

#### B. Authoritative Webhook / Callback Processing (`RecordGatewayResult`)
- Must verify provider cryptographic signature (SHA-256 HMAC) before doing any DB write.
- Begins DB transaction (`BEGIN`):
  1. Checks `payment_transactions` for provider `transaction_id`. If already processed, commits and returns HTTP 200 (idempotent duplicate callback).
  2. Inserts `payment_transactions` with full payload in `response_data` (JSONB) and `status = payload.status`.
  3. Validates amount: compare `response_data.amount` with `orders.total_amount`. If mismatch, marks payment `fraud_flagged` and writes alert event.
  4. If payment confirmed (`SUCCESS`):
     - Update `payments`: `status = 'completed'`, `paid_at = NOW()`.
     - Update `orders`: `payment_status = 'paid'`, `order_status = 'confirmed'`, `confirmed_at = NOW()`.
     - Update `stock_reservations`: `status = 'committed'`.
     - Update `inventory`: `quantity = quantity - reserved_quantity`, `reserved_quantity = reserved_quantity - requested`.
     - Insert `order_status_history` (`new_status = 'confirmed'`).
     - Insert outbox event `payment.confirmed` and `order.confirmed`.
  5. If payment failed (`PAYMENT_ERROR` / `DECLINED`):
     - Update `payments`: `status = 'failed'`.
     - Update `orders`: `payment_status = 'failed'`, `order_status = 'payment_failed'`.
     - Update `stock_reservations`: `status = 'released'`.
     - Revert `inventory.reserved_quantity`.
     - Insert outbox event `payment.failed` and `inventory.released`.
- Commits DB transaction (`COMMIT`).

#### C. Payment Uncertainty & `UNKNOWN` State Machine
- When a gateway query or callback returns timeout, network partition, or ambiguous status:
  1. Record `payments.status = 'unknown'`.
  2. Record `payment_transactions.status = 'unknown'` with raw error response.
  3. **DO NOT** cancel the order; **DO NOT** confirm the order.
  4. Extend `stock_reservations.expires_at` by the approved reconciliation window (e.g. +30 minutes).
  5. Emit `payment.unknown` to outbox.
  6. **Strict Fulfilment Prohibition:** No picking task, packing task, or delivery assignment may be created for an order whose payment is in `unknown` state unless an authorized store manager provides an explicit signed override.
  7. Scheduled Reconciler worker polls gateway status every 2 minutes for up to 20 minutes before escalating to manual human review.

---

### Stage 4: Fulfilment Handoff (`StartFulfilment` & `CompleteFulfilment`)

Fulfilment work can only proceed from authoritative PostgreSQL state:

1. **Preconditions**:
   - Order must have `order_status = 'confirmed'` AND (`payment_status = 'paid'` OR `payment_method = 'cod'`).
   - If payment is `unknown` or `pending` (for online orders), picking task creation is strictly rejected.
2. **Picking & Packing**:
   - Atomic transaction creates `picking_tasks` (`id`, `order_id`, `order_number`, `status = 'pending'`).
   - Transitions `orders.order_status` from `confirmed` to `processing` (or `picking`).
   - Emits `fulfilment.picking_started` outbox event.
3. **Delivery Handoff & Dispatch**:
   - When packing is completed, creates `delivery_assignments` (`id`, `order_id`, `delivery_partner_id`, `status = 'assigned'`).
   - Generates delivery OTP and persists hashed/secure representation.
   - Emits `delivery.assigned` outbox event.
4. **Completion & Earnings**:
   - Delivery verified via OTP and customer sign-off.
   - Updates `delivery_assignments.status = 'delivered'`, `delivered_at = NOW()`.
   - Updates `orders.order_status = 'delivered'`, `delivered_at = NOW()`.
   - If COD: records `payments.status = 'completed'` and verifies collected cash amount.
   - Writes immutable delivery earning entry to `delivery_earnings` ledger (keyed by assignment ID to prevent duplicate credits on retries).
   - Emits `order.delivered` outbox event.

---

### Stage 5: Transactional Outbox Engine

Remote side effects (FCM, SMS, email, Firestore sync) must **never** be performed inside the business transaction. Instead, the transaction writes to an `outbox_events` table:

```sql
CREATE TABLE IF NOT EXISTS outbox_events (
  id VARCHAR(64) PRIMARY KEY,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',  -- PENDING, LEASED, PUBLISHED, RETRY_SCHEDULED, DEAD_LETTERED
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 5,
  lease_token VARCHAR(128),
  leased_until TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, leased_until) WHERE status IN ('PENDING', 'RETRY_SCHEDULED');
```

#### Outbox Publisher Worker Contract:
1. **Concurrency-safe Lease**:
   ```sql
   UPDATE outbox_events
   SET status = 'LEASED',
       lease_token = $1,
       leased_until = NOW() + INTERVAL '30 seconds'
   WHERE id IN (
     SELECT id FROM outbox_events
     WHERE status IN ('PENDING', 'RETRY_SCHEDULED')
       AND (leased_until IS NULL OR leased_until < NOW())
     ORDER BY created_at ASC
     LIMIT 50
     FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
   ```
2. **Dispatch Handlers**:
   - Handler A: **Firestore Read Projector** (mirrors state to Firestore read collections).
   - Handler B: **Customer Notification Service** (sends FCM / WhatsApp / SMS).
   - Handler C: **Admin / Partner Event Stream**.
3. **Commit or Backoff**:
   - If all handlers succeed: `status = 'PUBLISHED'`, `published_at = NOW()`.
   - If any handler fails transiently: `retry_count += 1`, `status = 'RETRY_SCHEDULED'`, `leased_until = NOW() + (retry_count^2 * 5 seconds)`.
   - If `retry_count >= max_retries`: `status = 'DEAD_LETTERED'`, alert operator.
4. **Crash Recovery**: If the publisher process crashes while processing, the 30-second lease expires, allowing the next worker loop to safely re-claim and publish the events.

---

### Stage 6: Firebase Read Projection Contract

Firestore ceases to be a primary writer and functions solely as a derived, low-latency, read-only projection:

1. **One-Way Unidirectional Flow**:
   - `PostgreSQL (Authority) ──► Outbox ──► Projection Worker ──► Firestore (Cache / Read View)`.
   - Direct writes from client apps or Cloud Functions to Firestore `orders`, `stockReservations`, or `payments` are strictly prohibited (enforced via locked-down Firestore Security Rules: `allow write: if false`).
2. **Event Versioning & Monotonic Ordering**:
   - Every projection write includes `_lastEventId` and monotonic `_seq`:
     ```typescript
     await db.collection('orders').doc(orderId).set({
       ...projectedOrderFields,
       _lastEventId: event.id,
       _lastEventType: event.eventType,
       _updatedAt: event.createdAt,
     }, { merge: true });
     ```
   - If an out-of-order event arrives (older `_seq`), the projector drops it as a no-op.
3. **Projection Independence**:
   - If Firestore is offline or throttling, PostgreSQL transactions continue uninterrupted. The outbox simply queues events until Firestore connectivity is restored.
   - Rebuilding Firestore projections is trivial: an operator script can replay `outbox_events` from any timestamp to reconstruct the exact Firestore read state.

---

## Recovery and Rollback Matrix

| Failure Mode | Point of Failure | System Behavior & Immediate Action | Recovery Protocol |
| --- | --- | --- | --- |
| **Pre-commit failure** | DB disconnect or stock shortfall during `CreateOrder` | PostgreSQL transaction automatically issues `ROLLBACK`. No rows written to `orders`, `stock_reservations`, or `outbox_events`. | Client receives immediate error; retry executes safely with fresh stock check. |
| **Response drop after commit** | PostgreSQL commits order, but client network drops before HTTP response | `idempotency_keys` holds the committed result. | Client retries with identical `idempotency_key`; server replays saved order confirmation without creating duplicate order. |
| **Gateway Timeout / Hang** | PhonePe/Razorpay API does not respond during payment verification | Payment marked `unknown`; order kept in `placed`; stock reservation extended by +30 min. Fulfilment is BLOCKED. | Background reconciler queries gateway status endpoint every 2 min; resolves to `confirmed` or `failed` based on gateway evidence. |
| **Duplicate Webhook** | PhonePe fires webhook 3 times for the same transaction | Webhook worker checks `payment_transactions` for `transaction_id`. Duplicate detected. | Returns HTTP 200 immediately; leaves payment and order untouched; no duplicate events or stock commits. |
| **Outbox Worker Crash** | Publisher crashes mid-flight while syncing to Firestore | Lease on `outbox_events` expires after 30 seconds (`leased_until < NOW()`). | Next publisher worker claims event via `SKIP LOCKED`; Firestore projector applies event idempotently. |
| **Firestore Outage** | Firestore 503 Unavailable or network partition | PostgreSQL transactions commit successfully; outbox events move to `RETRY_SCHEDULED` with exponential backoff. | Once Firestore recovers, worker drains pending outbox queue in order; zero business interruption. |
| **Reservation Expiry Race** | Reservation expires while customer is typing OTP | Reconciler locks reservation row `FOR UPDATE`; checks payment status. If payment succeeded, reservation is committed despite timer. | If payment failed, reservation is released and stock returned to pool. |

---

## Minimum Proof Plan Before Authority Transfer

Before Firestore can be relieved of its business authority and switched to read-only projection, the following **6 verifiable exit gates** must be executed and evidenced:

```text
Gate 1: Schema & Constraints Audit (PostgreSQL constraints verified)
   ▼
Gate 2: Idempotency & Concurrency Stress Test (Zero duplicate orders under race conditions)
   ▼
Gate 3: Payment & Gateway Failure Scenarios (Webhook replays, timeouts, UNKNOWN reconciliation proven)
   ▼
Gate 4: Outbox Crash & Replay Drill (Crash-after-commit recovery and dead-letter replay proven)
   ▼
Gate 5: Dual-Run / Shadow Parity Report (PostgreSQL and Firestore shadow reconciliation matches 100%)
   ▼
Gate 6: Reversible Traffic Cutover (Can switch authority back to Firestore in < 60 seconds if alerts trip)
```

1. **Gate 1: Schema & Constraints Proof**:
   - Verify `outbox_events` and `idempotency_keys` tables exist with correct unique indexes and foreign keys.
   - Verify table column types align with runtime requirements.
2. **Gate 2: Concurrency & Idempotency Proof**:
   - Run a simulated concurrent blast test: 10 parallel requests with the identical `idempotency_key` must produce exactly 1 order in PostgreSQL and 9 identical idempotent replay responses.
   - Run an inventory race test: 10 concurrent requests for an item with quantity = 2 must result in exactly 2 successful orders and 8 clean out-of-stock rejections, with `inventory.reserved_quantity` perfectly balanced.
3. **Gate 3: Gateway & `UNKNOWN` Proof**:
   - Simulate PhonePe callback network failure, timeout, amount mismatch, and duplicate callbacks.
   - Prove that `UNKNOWN` payments block picking tasks and trigger automated reconciliation.
4. **Gate 4: Outbox & Projection Proof**:
   - Force kill the outbox publisher process during event dispatch; verify lease expiration and safe redelivery without duplicates.
   - Test Firestore projection lag and replay: wipe Firestore order collection in staging and run projection replayer from `outbox_events` to restore 100% parity.
5. **Gate 5: Dual-Run Shadow Reconciliation**:
   - Shadow run the canonical PostgreSQL path alongside the existing Firestore path for 7 days or 200 orders.
   - Zero discrepancies in order counts, item quantities, payment amounts, and status progressions.
6. **Gate 6: Reversible Cutover & Rollback Plan**:
   - Feature flag toggles customer checkout endpoint from Cloud Function to PostgreSQL API.
   - Automated monitoring of error rate, outbox lag, and payment reconciliation.
   - Verified 1-click rollback capability to revert to legacy Firestore writers if unhandled exceptions exceed 0.1%.

---

## Explicit No-Go Conditions

Cutover to PostgreSQL authority **MUST NOT** proceed if:
- Any payment can enter `UNKNOWN` without an automated background reconciliation loop.
- Any remote API call (FCM, Payment Gateway, Firestore) remains embedded inside a PostgreSQL transaction.
- Any client app or background job retains direct write permissions to Firestore business documents.
- The transactional outbox lacks lease locking or dead-letter observability.
- The dual-run reconciliation report shows any unexplainable discrepancy between legacy and PostgreSQL records.

---

## Completion Definition for this Design Phase

This audit and contract phase is strictly complete when:
1. The business owner reviews and approves the rules in `BUSINESS_RULE_APPROVAL_MATRIX.md`.
2. Engineering and operations sign off on the 6-stage command chain and the 6 verification exit gates defined above.
3. **No production code is changed and no database cleanup is attempted until all 6 gates are built and passed.**
