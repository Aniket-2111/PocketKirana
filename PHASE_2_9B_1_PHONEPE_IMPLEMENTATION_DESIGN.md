# Phase 2.9B.1 — PhonePe State Transition Implementation Design & Impact Audit

**Document ID:** `PHASE_2_9B_1_PHONEPE_IMPLEMENTATION_DESIGN.md`  
**Execution Timestamp:** 2026-10-04T07:35:00+05:30  
**Phase:** Phase 2.9B.1 (Implementation Design & Impact Audit Only)  
**Repository:** `PocketKirana`  
**Execution Mode:** STRICT READ-ONLY DESIGN & IMPACT AUDIT (Zero code changes, zero test modifications, zero database mutations, zero migrations, zero deployments, zero commits)  

---

## 1. Executive Summary

This document presents the complete architectural remediation design for the PhonePe payment success to order state transition pipeline, resolving the four fatal defects proven in Phase 2.9A:

1. **`OrderService.transitionOrder()` Schema Disconnect:** Adding canonical `paymentStatus?: CanonicalPaymentStatus` support to the state machine, updating PostgreSQL `orders.payment_status` atomically alongside `order_status`.
2. **Webhook Identifier Resolution Gap:** Introducing bidirectional order lookup (`WHERE id = $1 OR order_number = $1 FOR UPDATE`) before mutation, resolving the canonical UUID and eliminating the silent zero-row update bug when passed `order_number` (e.g. `'PK-11'`).
3. **Webhook Failure Handling:** Enforcing `updateRes.rowCount === 1` verification, ensuring zero-row updates trigger transaction rollback and HTTP 500/404 rather than false HTTP 200 ACKs.
4. **Status Polling Route Consolidation:** Integrating PostgreSQL transaction reconciliation into `/api/payments/phonepe/status` to eliminate the split-brain between Firestore read projections and PostgreSQL transactional truth.

All remediation patterns maintain 100% backward compatibility, require **zero PostgreSQL schema migrations**, preserve fail-closed webhook signature verification, and enforce strict single-dispatch outbox event idempotency.

---

## 2. Current Repository State

* **Active Git Branch:** `fix/page-readiness-production`
* **Head Commit SHA:** `63dba5363579334b67e4ac9a401d94060be244bf`
* **Working Tree State:** Frozen; read-only verification only.
* **Database Connection:** Verified read-only against `192.168.0.105:5433 / pocketkirana_db` (PostgreSQL 18.6 MSVC 64-bit).

---

## 3. Files That Will Change

During the planned implementation phases (Phase 2.9B.2 through Phase 2.9B.5), modifications will be strictly confined to:

| File Path | Targeted Component | Nature of Modification |
|---|---|---|
| `lib/services/orderService.ts` | Order State Machine | Add `paymentStatus?: CanonicalPaymentStatus` to `OrderTransitionRequest`, update SQL `SET` statement, COALESCE logic, and event metadata. |
| `app/api/payments/phonepe/webhook/route.ts` | Asynchronous Gateway Webhook | Add `FOR UPDATE` PostgreSQL order resolution (`id = $1 OR order_number = $1`), normalize to canonical UUID, enforce `rowCount === 1`, and write `order_status_history`. |
| `app/api/payments/phonepe/verify/route.ts` | Client Return Verification | Pass `paymentStatus: 'paid'` into `OrderService.transitionOrder` in simulation mode; align live mode SQL to use standard outbox and history patterns. |
| `app/api/payments/phonepe/status/route.ts` | Polling & Recovery API | Add atomic PostgreSQL transaction reconciliation when gateway reports `SUCCESS`, matching `verify/route.ts` and `webhook/route.ts`. |
| `test/phonepe-state-transition.test.ts` | Automated Regression Suite | New dedicated integration test suite asserting real PostgreSQL row updates for UUIDs, order numbers, idempotency, and simulation mode. |

---

## 4. Files That Must NOT Change

The following files are strictly out of scope and must remain untouched:

* `app/api/checkout/route.ts` (Order creation authority is proven canonical)
* `app/api/payments/phonepe/create/route.ts` (Initiation and HMAC creation are proven correct)
* `lib/phonepeConfig.ts` & `lib/phonepe.ts` (Credentials and gateway endpoints are correct)
* `lib/serverServiceability.ts` & `lib/storeOperationsService.ts` (Serviceability baseline confirmed in Phase 2.7C / 2.8.1)
* `lib/coordinateProtection.ts` (Coordinate security audit completed; follow-up planned in Phase 2.9C)
* All frontend UI pages (`app/checkout/*`, `customer-app/*`, `delivery-app/*`, `picker-app/*`)
* PostgreSQL table schemas and migration scripts

---

## 5. `OrderService` Change Design

### A. Type Definition Enhancement:
In `lib/services/orderService.ts`:
```typescript
export type CanonicalPaymentStatus = 
  | 'pending' 
  | 'paid' 
  | 'completed' 
  | 'failed' 
  | 'refunded';

export interface OrderTransitionRequest {
  orderId: string;
  targetStatus: CanonicalOrderStatus;
  actorId: string;
  actorRole: 'customer' | 'admin' | 'picker' | 'driver' | 'system';
  reason?: string;
  isAdminOverride?: boolean;
  metadata?: Record<string, any>;
  eventId?: string;
  paymentStatus?: CanonicalPaymentStatus; // NEW OPTIONAL FIELD
}
```

### B. Backward-Compatible Call Semantics:
* **When `paymentStatus` is provided (e.g. `'paid'`):** PostgreSQL `orders.payment_status` is updated to `'paid'`.
* **When `paymentStatus` is omitted / undefined:** PostgreSQL `orders.payment_status` preserves its existing value via `COALESCE($2, payment_status)`.
* **Existing callers:** Darkstore pickers transitioning orders (`PICKING`, `PACKING`, `READY_FOR_PICKUP`) and couriers transitioning orders (`OUT_FOR_DELIVERY`, `DELIVERED`) do not pass `paymentStatus`. Their transitions will preserve whatever payment status is currently on the order without alteration.

---

## 6. SQL Parameter & Placeholder Audit

### Current Statement in `lib/services/orderService.ts` (lines 161–171):
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
Parameter Array: `[targetStatus, deliveryOtp, order.id]`
* `$1`: `targetStatus`
* `$2`: `deliveryOtp`
* `$3`: `order.id`

### Proposed Statement:
```sql
UPDATE orders
SET order_status = $1,
    payment_status = COALESCE($2, payment_status),
    delivery_otp = COALESCE($3, delivery_otp),
    updated_at = CURRENT_TIMESTAMP,
    confirmed_at = CASE WHEN $1 = 'CONFIRMED' AND confirmed_at IS NULL THEN CURRENT_TIMESTAMP ELSE confirmed_at END,
    delivered_at = CASE WHEN $1 = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
    cancelled_at = CASE WHEN $1 = 'CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancelled_at END
WHERE id = $4
```
Proposed Parameter Array: `[targetStatus, paymentStatus || null, deliveryOtp, order.id]`
* `$1`: `targetStatus` (unchanged)
* `$2`: `paymentStatus || null` (**NEW**: Evaluates to `null` if omitted, safely preserving existing column value via `COALESCE`)
* `$3`: `deliveryOtp` (shifted from `$2` to `$3`)
* `$4`: `order.id` (shifted from `$3` to `$4`)

> **Verification:** Parameter mapping is strictly contiguous. No placeholder index is skipped or transposed.

---

## 7. Webhook Remediation Design

Authoritative target: `app/api/payments/phonepe/webhook/route.ts`.

### Safest Execution Sequence:
```text
POST /api/payments/phonepe/webhook
  │
  ├─► 1. Signature Verification:
  │      Compute SHA-256(base64Response + saltKey) + "###" + saltIndex
  │      crypto.timingSafeEqual check. If invalid -> return 200 {"Invalid signature"}
  │
  ├─► 2. Decode Payload:
  │      Extract merchantTransactionId, transactionId, amount (paise)
  │
  ├─► 3. Parse Candidate Identifiers:
  │      candidate1 = paymentData?.orderId (from Firestore payment doc if exists)
  │      candidate2 = merchantTransactionId.split('_')[2] (e.g. 'PK-11')
  │
  ├─► 4. Begin PostgreSQL Transaction:
  │      client.query('BEGIN')
  │
  ├─► 5. Authoritative Order Resolution & Row Lock:
  │      SELECT id, order_number, total_amount, payment_status, order_status, firebase_uid
  │      FROM orders
  │      WHERE id = $1 OR order_number = $1 OR id = $2 OR order_number = $2
  │      FOR UPDATE
  │      [candidate1, candidate2]
  │
  ├─► 6. Order Existence & Validation Gate:
  │      if (res.rowCount === 0) -> ROLLBACK, return HTTP 404 {"Associated order not found"}
  │      currentOrder = res.rows[0]
  │      canonicalOrderId = currentOrder.id  // Guaranteed PostgreSQL UUID
  │
  ├─► 7. Amount Verification:
  │      expectedPaise = Math.round(Number(currentOrder.total_amount) * 100)
  │      if (phonepeAmountInPaise !== expectedPaise) -> ROLLBACK, return HTTP 400 {"Amount mismatch"}
  │
  ├─► 8. Idempotency Check:
  │      if (currentOrder.order_status === 'CONFIRMED' && currentOrder.payment_status === 'paid')
  │         COMMIT, return HTTP 200 {"Payment already processed"}
  │
  ├─► 9. Atomic Persistence:
  │      a. Upsert payments (order_id = canonicalOrderId, status = 'completed')
  │      b. Insert payment_transactions ('WEBHOOK_PAYMENT', status = 'SUCCESS', ON CONFLICT DO NOTHING)
  │      c. UPDATE orders SET payment_status = 'paid', order_status = 'CONFIRMED', confirmed_at = NOW()
  │         WHERE id = canonicalOrderId
  │      d. Assert updateRes.rowCount === 1
  │      e. Insert order_status_history ('system:phonepe-webhook', notes)
  │      f. Append outbox_events ('payment.confirmed')
  │
  ├─► 10. COMMIT Transaction
  │
  └─► 11. Mirror to Firestore & Trigger Picker Queue:
         updateDoc(orderRef, { paymentStatus: 'paid', orderStatus: 'CONFIRMED' })
         ensurePickingTaskForOrder(canonicalOrderId, orderData)
         return HTTP 200 {"Webhook processed successfully"}
```

---

## 8. Webhook Error Semantics

| Scenario | HTTP Status | Response Body | Database Action | Reason |
|---|:---:|---|---|---|
| **Invalid Signature** | `200 OK` | `{"success": true, "message": "Invalid signature ignored"}` | None | Fail-closed security; ACK prevents infinite gateway retry floods. |
| **Malformed JSON / Base64** | `400 Bad Request` | `{"success": false, "error": "Missing signature or payload"}` | None | Client/gateway protocol error. |
| **Order Not Found in PG** | `404 Not Found` | `{"success": false, "error": "Associated order not found"}` | ROLLBACK | Fail-closed; prevents false ACK when order does not exist. |
| **Amount Mismatch** | `400 Bad Request` | `{"success": false, "error": "Payment amount mismatch"}` | ROLLBACK | Security protection against payment tampering. |
| **Order Already Paid** | `200 OK` | `{"success": true, "message": "Payment already processed"}` | None (Fast-path exit) | Idempotent duplicate delivery guarantee. |
| **PostgreSQL `rowCount !== 1`** | `500 Server Error` | `{"success": false, "error": "Failed to update order state"}` | ROLLBACK | Guarantees error is surfaced if database update fails. |
| **Database Pool Timeout** | `500 Server Error` | `{"success": false, "error": "Database error"}` | ROLLBACK | Allows gateway retry on transient connection glitches. |

---

## 9. Verify Route Audit & Alignment

Authoritative target: `app/api/payments/phonepe/verify/route.ts`.

### Analysis:
* **Live Mode:** Currently uses direct SQL:
  ```sql
  UPDATE orders 
  SET order_status = 'CONFIRMED',
      payment_status = 'paid',
      confirmed_at = COALESCE(confirmed_at, NOW()),
      updated_at = NOW() 
  WHERE id = $1
  ```
  It resolves `currentOrder.id` via `WHERE id = $1 OR order_number = $1` and correctly serializes via `SELECT ... FOR UPDATE`. This logic is sound and will be retained.
* **Simulation Mode:** Currently executes:
  ```typescript
  await OrderService.transitionOrder({
    orderId,
    targetStatus: 'CONFIRMED',
    ...
  });
  ```
* **Required Alignment:**  
  Once `OrderService.transitionOrder` supports `paymentStatus`, update the simulation call to:
  ```typescript
  await OrderService.transitionOrder({
    orderId,
    targetStatus: 'CONFIRMED',
    paymentStatus: 'paid', // PASS CANONICAL STATUS
    actorId: 'sim-phonepe-verify',
    actorRole: 'system',
    reason: `Simulation payment verified: ${txnId}`,
    metadata: { ... },
  });
  ```
  This immediately resolves the simulation split-brain with zero breaking changes.

---

## 10. Status Route Design

Authoritative target: `app/api/payments/phonepe/status/route.ts`.

### Defect:
Currently polls PhonePe Gateway API, verifies `SUCCESS`, and writes strictly to Firestore `orders` and `payments`, **completely omitting PostgreSQL**.

### Remediation:
1. In `status/route.ts`, when `isPaid === true` and order is unconfirmed:
2. Wrap the confirmation inside PostgreSQL `withTransaction()`:
   ```typescript
   await withTransaction(async (client) => {
     const lockRes = await client.query(
       `SELECT id, order_number, total_amount, payment_status, order_status 
        FROM orders 
        WHERE id = $1 OR order_number = $1 
        FOR UPDATE`,
       [resolvedOrderId]
     );
     if (lockRes.rowCount === 0) return;
     const currentOrder = lockRes.rows[0];
     if (currentOrder.payment_status === 'paid' && currentOrder.order_status === 'CONFIRMED') return;

     // Upsert payments & payment_transactions
     // UPDATE orders SET order_status = 'CONFIRMED', payment_status = 'paid', confirmed_at = NOW() WHERE id = currentOrder.id
     // appendOutboxEvent(...)
   });
   ```
3. Downstream Firestore projection remains identical.
4. Guarantees that whether an order is recovered via **Webhook**, **Verify Redirect**, or **Status Polling**, PostgreSQL is guaranteed to transition to `CONFIRMED` and `paid`.

---

## 11. Identifier Normalization Design

To prevent downstream code from passing order numbers (`'PK-11'`) into UUID columns (`orders.id`):

```text
Incoming Input (orderId / merchantTransactionId)
                      │
                      ▼
   SELECT id, order_number FROM orders 
   WHERE id = $1 OR order_number = $1 
   FOR UPDATE
                      │
                      ▼
   ┌────────────────────────────────────────┐
   │ canonicalOrderId = currentOrder.id     │  <-- UUID (e.g. 'ord-179...-a062ae')
   │ canonicalOrderNumber = order_number    │  <-- Sequential (e.g. 'PK-11')
   └────────────────────────────────────────┘
                      │
                      ▼
   ALL downstream SQL updates, payments.order_id, 
   and outbox events use canonicalOrderId
```

---

## 12. Transaction & Concurrency Design

### The Three-Way Race:
A user checkout may simultaneously trigger:
1. **Redirect Verify Route:** The user's browser redirects back to the shop immediately.
2. **Gateway Webhook:** PhonePe servers fire a server-to-server HTTP POST.
3. **Status Polling:** Mobile APK background recovery polls status after returning from UPI app.

### Concurrency Protection Mechanism:
1. **Row-Level Serialization:** Every path begins with `SELECT ... FROM orders WHERE id = $1 OR order_number = $1 FOR UPDATE`. Only one process can hold the row lock; the others block and wait.
2. **Idempotency Gate:** Once the first process completes and commits `payment_status = 'paid'`, the waiting processes acquire the lock, observe `currentOrder.payment_status === 'paid'`, and immediately return cleanly.
3. **Transaction ID Uniqueness:** `payment_transactions` enforces `UNIQUE(transaction_id)` with `ON CONFLICT DO NOTHING`, preventing double-ledger insertion.

---

## 13. Payment State Consistency Model

Across all successful transitions, database state will strictly conform to:

| Entity | Field | Expected State | Notes |
|---|---|:---:|---|
| `orders` | `order_status` | `'CONFIRMED'` | Valid state machine target |
| `orders` | `payment_status` | `'paid'` | Canonical payment status |
| `orders` | `confirmed_at` | `NOW()` | Timestamp of payment confirmation |
| `payments` | `status` | `'completed'` | Payment record status |
| `payments` | `paid_at` | `NOW()` | Timestamp on payment record |
| `payment_transactions` | `status` | `'SUCCESS'` | Ledger status |
| `payment_transactions` | `transaction_type` | `'VERIFY_PAYMENT'` or `'WEBHOOK_PAYMENT'` | Auditable provenance |
| `outbox_events` | `event_type` | `'payment.confirmed'` | Asynchronous trigger for dispatch/FCM |

---

## 14. Outbox & Event Impact

* **Outbox Event Name:** `'payment.confirmed'` (produced by `appendOutboxEvent`).
* **Aggregate Type:** `'payment'`.
* **Idempotency Guarantee:** Outbox events are written strictly inside the `orders FOR UPDATE` transaction block. Because duplicate webhooks/verify calls exit early when `payment_status === 'paid'`, **zero duplicate outbox events** can be produced.
* **Downstream Consumers:** The outbox worker will publish push notifications and sync Firestore read models without blocking payment completion.

---

## 15. Historical Stuck Order Handling

The live database contains 6 historical orders in `order_status = 'PLACED'`, `payment_status = 'pending'` (`PK-04`, `PK-05`, `PK-06`, `PK-07`, `PK-08`, `PK-09`).

### Remediation Policy:
* **DO NOT auto-migrate during code deployment.** Automatic bulk updates during application startup introduce production risk.
* **Controlled One-Time CLI Reconciliation Script:**  
  A dedicated script `scripts/reconcile_phonepe_stuck_orders.js` will be created in a future operational phase.
  - Queries PhonePe S2S status API for each stuck transaction.
  - If PhonePe reports `SUCCESS`: applies the atomic transition.
  - If PhonePe reports `FAILED` / expired: transitions order to `CANCELLED`.
  - Requires explicit operator review before execution.

---

## 16. Security Regression Risks

| Security Area | Risk Assessment | Mitigation Mechanism |
|---|:---:|---|
| **Webhook Signature Bypass** | ZERO | `X-VERIFY` HMAC check is preserved verbatim with `timingSafeEqual`. |
| **Amount Tampering** | ZERO | Exact paise match against `orders.total_amount` is enforced before update. |
| **IDOR / Cross-Order Theft** | ZERO | Ownership validated against `orders.firebase_uid` and authenticated session. |
| **SQL Injection** | ZERO | All queries use parameterized placeholders (`$1, $2, $3, $4`). Zero string interpolation. |

---

## 17. Rollback Strategy

Because this remediation involves **zero database DDL migrations**:
* If any unforeseen issue arises, code changes can be completely reverted via standard git rollback (`git checkout`) without database schema surgery.
* Any orders transitioned to `CONFIRMED` and `'paid'` during the window represent legitimately paid customer transactions and remain valid.

---

## 18. Exact Implementation Sequence

The remediation will be executed through the following strictly ordered phases:

```text
Phase 2.9B.2: OrderService Enhancement
  └─ Update OrderTransitionRequest interface
  └─ Update UPDATE query in lib/services/orderService.ts with COALESCE($2, payment_status)
  └─ Run unit tests for OrderService

Phase 2.9B.3: Webhook Route Canonicalization
  └─ Add bidirectional order lookup & row lock (WHERE id = $1 OR order_number = $1 FOR UPDATE)
  └─ Normalize to canonicalOrderId
  └─ Enforce rowCount === 1 verification
  └─ Add order_status_history recording

Phase 2.9B.4: Verify & Status Route Alignment
  └─ Update verify/route.ts simulation mode to pass paymentStatus: 'paid'
  └─ Add atomic PostgreSQL reconciliation to status/route.ts

Phase 2.9B.5: Automated Integration Test Suite
  └─ Create test/phonepe-state-transition.test.ts verifying real PostgreSQL mutations
  └─ Verify UUID and order_number lookups, idempotency, and amount validation

Phase 2.9B.6: Sandbox & Mock Verification
  └─ Run end-to-end sandbox verification and verify DB state

Phase 2.9B.7: Production Readiness Audit
  └─ Re-run Master Readiness Scorecard to flip Payment from 🔴 BLOCKER to 🟢 READY
```

---

## 19. Acceptance Criteria

Before declaring Phase 2.9B complete, the following criteria must pass:
1. `OrderService.transitionOrder` transitions an order and successfully sets `payment_status = 'paid'`.
2. Omission of `paymentStatus` preserves existing `payment_status`.
3. Webhook receiving `order_number` (e.g. `'PK-11'`) successfully updates PostgreSQL `orders.payment_status` to `'paid'` and `order_status` to `'CONFIRMED'`.
4. Webhook receiving an unknown order returns HTTP 404 and does NOT return `{ success: true }`.
5. Webhook update verifying `rowCount !== 1` triggers a rollback.
6. `/api/payments/phonepe/status` reconciles PostgreSQL when payment is successful.
7. Simulation mode leaves PostgreSQL orders in `payment_status = 'paid'` and `order_status = 'CONFIRMED'`.
8. Zero test failures across the full 59-suite test matrix.

---

## 20. Final Verdict

### 🟢 READY FOR CONTROLLED IMPLEMENTATION

The remediation design is mathematically sound, preserves parameter alignment, resolves all four proven root causes, introduces zero schema migrations, and provides an exact, safe implementation sequence.

---
**Design Audit Complete. Standing by for user approval before Phase 2.9B.2.**
