# PHASE 2.9B.4 — PHONEPE STATUS / RECOVERY RECONCILIATION FORENSIC AUDIT REPORT

**Execution Timestamp:** 2026-10-04T02:25:30Z (07:55:30 IST)  
**Branch:** `fix/page-readiness-production`  
**Git HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`  
**Phase Mode:** STRICT FORENSIC AUDIT / DESIGN ONLY (Zero Code / Schema / DB Mutations)  
**Author:** AI Agent (Antigravity)  
**Final Verdict:** 🟢 READY FOR IMPLEMENTATION  

---

## 1. Executive Summary

Following the successful execution and approval of Phase 2.9B.2 (OrderService canonical payment status) and Phase 2.9B.3 (authoritative PhonePe webhook reconciliation), Phase 2.9B.4 performed an exhaustive, read-only forensic audit of:
`app/api/payments/phonepe/status/route.ts` and its related recovery flows.

### Core Forensic Finding
**The PhonePe status route is completely disconnected from PostgreSQL.**
It contains:
- **0** lines of PostgreSQL connection, pooling, or transaction code.
- **0** queries to PostgreSQL `orders`, `payments`, `payment_transactions`, or `order_status_history`.
- **0** transactional `outbox_events`.
- **0** row-locking mechanisms (`SELECT ... FOR UPDATE`).

### The Critical Defect
When a customer APK restarts, crashes, or polls `GET /api/payments/phonepe/status`:
1. The route queries PhonePe gateway status API.
2. PhonePe confirms the transaction with `responseCode: 'SUCCESS'`.
3. The route updates **only Firestore** (`updateDoc` on `orders`, `setDoc` on `payments`, and `ensurePickingTaskForOrder`).
4. It returns HTTP 200 `{ verified: true, paymentStatus: 'paid', orderStatus: 'CONFIRMED' }` to the client.
5. **PostgreSQL remains untouched in:**
   ```
   order_status = 'PLACED'
   payment_status = 'pending'
   ```
This confirms that the status/recovery path contains the exact split-brain vulnerability that was uncovered during Phase 2.9A. If an order's payment webhook was dropped, blocked, or delayed, and recovery relied on `GET /api/payments/phonepe/status`, PostgreSQL was left permanently inconsistent.

---

## 2. Files Audited

| File Path | Role in Architecture | Key Audit Finding |
|---|---|---|
| [`app/api/payments/phonepe/status/route.ts`](file:///d:/pocketkirana/app/api/payments/phonepe/status/route.ts) | Primary status & recovery endpoint | **Critical defect:** 100% Firestore-only; zero PostgreSQL integration. |
| [`lib/phonepeClient.ts`](file:///d:/pocketkirana/lib/phonepeClient.ts) | Client-side SDK / APK bridge | Calls `/api/payments/phonepe/status` in `checkPhonePePaymentRecovery()`. |
| [`app/api/payments/phonepe/verify/route.ts`](file:///d:/pocketkirana/app/api/payments/phonepe/verify/route.ts) | Browser/app redirect verification | Uses PostgreSQL `withTransaction` & `FOR UPDATE`, but has minor simulation split-brain. |
| [`app/api/payments/phonepe/webhook/route.ts`](file:///d:/pocketkirana/app/api/payments/phonepe/webhook/route.ts) | Canonical webhook (reconciled in B.3) | Frozen reference baseline for canonical PostgreSQL reconciliation. |
| [`lib/services/orderService.ts`](file:///d:/pocketkirana/lib/services/orderService.ts) | Canonical state machine (B.2) | Supports `paymentStatus?: CanonicalPaymentStatus`. |
| [`test/phonepe-business-e2e.test.ts`](file:///d:/pocketkirana/test/phonepe-business-e2e.test.ts) | E2E integration test suite | Test 3B checks only Firestore and is a false-green test. |

---

## 3. Actual Status Flow Traced

### Current Status Route Trace (Defective As-Is)

```
Customer Mobile App / Polling / Recovery
        │
        ▼ (GET /api/payments/phonepe/status?merchantTransactionId=...&orderId=...)
app/api/payments/phonepe/status/route.ts
        │
        ├─► 1. authenticateRequest() [Headers: x-pk-uid, etc.]
        │
        ├─► 2. Read Firestore payment doc: doc(db, 'payments', `pay_pk_${merchantTransactionId}`)
        │      Read Firestore order doc: doc(db, 'orders', resolvedOrderId)
        │
        ├─► 3. If Firestore orderData.paymentStatus === 'paid' -> Return HTTP 200 (PG never checked!)
        │
        ├─► 4. Query PhonePe Gateway API: GET /pg/v1/status/{merchantId}/{merchantTransactionId}
        │      Verify X-VERIFY checksum on response.
        │
        ├─► 5. PhonePe returns { responseCode: 'SUCCESS' }
        │
        ├─► 6. MUTATE FIRESTORE ONLY:
        │      - updateDoc(orders, { paymentStatus: 'paid', orderStatus: 'CONFIRMED' })
        │      - setDoc(payments, { status: 'completed', paidAt: NOW })
        │      - ensurePickingTaskForOrder(...) [Routes to Picker Queue in Firestore]
        │
        ├─► 7. POSTGRESQL EFFECT:
        │      - orders table: UNTOUCHED (order_status = PLACED, payment_status = pending)
        │      - payments table: UNTOUCHED
        │      - payment_transactions ledger: UNTOUCHED
        │      - order_status_history: UNTOUCHED
        │      - outbox_events: UNTOUCHED (No outbox event created)
        │
        └─► 8. Return HTTP 200 to Customer { verified: true, paymentStatus: 'paid', orderStatus: 'CONFIRMED' }
```

### Contrast: Required Canonical Flow (To Be Implemented in B.4)

```
Customer Mobile App / Polling / Recovery
        │
        ▼ (GET /api/payments/phonepe/status?merchantTransactionId=...&orderId=...)
app/api/payments/phonepe/status/route.ts
        │
        ├─► 1. authenticateRequest()
        ├─► 2. Query PhonePe Gateway API & verify checksum
        ├─► 3. Extract candidate identifiers (merchantTransactionId parts, orderId)
        ├─► 4. Begin PostgreSQL transaction (client.query('BEGIN'))
        ├─► 5. SELECT id, order_number, total_amount, payment_status, order_status FROM orders
        │      WHERE id = $1 OR order_number = $1 ... FOR UPDATE
        ├─► 6. If no order -> ROLLBACK, return HTTP 404
        ├─► 7. Resolve canonicalOrderId = currentOrder.id
        ├─► 8. Validate amount: expectedPaise === phonepeAmountInPaise (Mismatch -> ROLLBACK, HTTP 400)
        ├─► 9. Check idempotency: if already CONFIRMED + paid -> COMMIT, return HTTP 200
        ├─► 10. Upsert PostgreSQL payments (order_id = canonicalOrderId, status = 'completed')
        ├─► 11. Insert payment_transactions (transaction_type = 'STATUS_RECOVERY', status = 'SUCCESS')
        ├─► 12. UPDATE orders SET payment_status = 'paid', order_status = 'CONFIRMED' WHERE id = canonicalOrderId
        ├─► 13. Assert updateRes.rowCount === 1
        ├─► 14. Insert order_status_history ('system:phonepe_status_recovery')
        ├─► 15. appendOutboxEvent ('payment.confirmed')
        ├─► 16. client.query('COMMIT')
        ├─► 17. Downstream read projection to Firestore (updateDoc, setDoc, ensurePickingTaskForOrder)
        └─► 18. Return HTTP 200 to Customer
```

---

## 4. Identifier Resolution Matrix

Currently in `app/api/payments/phonepe/status/route.ts`:
```typescript
const { searchParams } = new URL(request.url);
const merchantTransactionId = searchParams.get('merchantTransactionId') || searchParams.get('transactionId') || '';
const orderId = searchParams.get('orderId') || '';
```

### Identifier Inconsistencies Discovered:
1. If the caller passes `orderId = 'PK-11'` (an order number), the route passes `'PK-11'` directly to `doc(db, 'orders', 'PK-11')`. In Firestore, documents may be stored under UUID or order number, but in PostgreSQL `orders.id` is strictly the primary key (`ord-1790844669560-a062ae`), while `'PK-11'` is `orders.order_number`.
2. The route makes no attempt to normalize identifiers against PostgreSQL.
3. If `merchantTransactionId` is formatted as `TXN_PK_PK-11_1790844673631`, the route does NOT parse `parts[2]` to extract `'PK-11'`.
4. If the Firestore payment document is missing, and `orderId` was not passed in query params, the route cannot resolve the order at all (`resolvedOrderId = ''`), returning an incomplete response without verifying.

---

## 5. Order State Transition Analysis

| Dimension | Current `status/route.ts` | Approved B.2/B.3 Standard | Status |
|---|---|---|:---:|
| `orders.order_status` | Never updated in PostgreSQL | Updated to `'CONFIRMED'` | 🔴 DEFECT |
| `orders.payment_status` | Never updated in PostgreSQL | Updated to `'paid'` | 🔴 DEFECT |
| `orders.confirmed_at` | Never set in PostgreSQL | Set to `COALESCE(confirmed_at, NOW())` | 🔴 DEFECT |
| `orders.updated_at` | Never updated in PostgreSQL | Set to `NOW()` | 🔴 DEFECT |
| State Transition Engine | None (Direct Firestore mutation) | Atomic SQL / `OrderService` | 🔴 DEFECT |
| Row-Level Lock | None | `SELECT ... FOR UPDATE` | 🔴 DEFECT |

---

## 6. Payment Ledger Analysis

In the current status route:
- **`payments` table:** Zero writes. When recovery succeeds, no row is created or updated in the PostgreSQL `payments` table.
- **`payment_transactions` table:** Zero writes. There is no ledger audit trail recording that PhonePe confirmed the payment.
- **Transaction Type:** Missing entirely. (In B.3 it is `WEBHOOK_PAYMENT`; in `verify` it is `VERIFY_PAYMENT`; for status recovery it should canonically be `STATUS_RECOVERY`).
- **Unique Constraint Protection:** None. The route cannot detect duplicate confirmations via the PostgreSQL `transaction_id` unique constraint.

---

## 7. Transaction Atomicity Analysis

- **Current Implementation:** Completely non-atomic.
  - Line 165: `await updateDoc(orderRef, ...)`
  - Line 180: `await setDoc(paymentRef, ...)`
  - Line 190: `await ensurePickingTaskForOrder(...)`
  These are three separate non-transactional network calls to Firestore. If the second or third call fails, Firestore itself is left partially updated.
- **PostgreSQL Transaction:** Completely missing. No `BEGIN`, `COMMIT`, or `ROLLBACK` exists in `status/route.ts`.

---

## 8. Row Lock / Concurrency Analysis

### Concurrency Race Condition Scenarios:

1. **Simultaneous Webhook and Status Polling:**
   - A customer completes UPI payment. PhonePe sends webhook to `/api/payments/phonepe/webhook`.
   - Concurrently, the mobile app polls `/api/payments/phonepe/status`.
   - **Outcome in current code:** The webhook locks the PostgreSQL row (Phase B.3) and writes to PostgreSQL. Meanwhile, the status route bypasses PostgreSQL entirely, updates Firestore, and tells the mobile app the order is confirmed before the webhook transaction has committed.
   - If the webhook transaction were to fail or roll back due to an amount discrepancy, the customer app would have already received a false `verified: true` from the status route!
2. **Double Status Polling (Client Retry):**
   - Two concurrent GET requests from the mobile app.
   - Both call PhonePe status API. Both execute Firestore `updateDoc` and `ensurePickingTaskForOrder`.
   - Result: Duplicate picking task jobs are dispatched to the darkstore picker queue!

---

## 9. Idempotency Analysis

- In `status/route.ts` line 73:
  ```typescript
  if (orderData && orderData.paymentStatus === 'paid') {
    return corsResponse({ success: true, data: { verified: true, ... } });
  }
  ```
- **The Split-Brain Idempotency Trap:**
  If an order was previously marked paid in Firestore by an old buggy flow, but was NEVER updated in PostgreSQL (like `PK-04` through `PK-09`), calling `GET /api/payments/phonepe/status` hits line 73 and immediately returns `verified: true` **without ever repairing PostgreSQL**!
  The order remains stuck in PostgreSQL forever while the client thinks it is fine.

---

## 10. Failure Matrix Analysis

| Scenario | HTTP Status | PostgreSQL Mutation | Firestore Mutation | Outbox Mutation | Evaluation |
|---|:---:|:---:|:---:|:---:|---|
| **1. Unknown Order** | `200 OK` (with `verified: false`) | None | None | None | ⚠️ Returns 200 with `verified: false` instead of clear 404 when order does not exist anywhere. |
| **2. Invalid PhonePe Response** | `200 OK` (with `verified: false`) | None | None | None | ✅ Defensive handling prevents app crash. |
| **3. Amount Mismatch** | `200 OK` (with `status: 'AMOUNT_MISMATCH'`) | None | None | None | 🔴 Silent exit; does not roll back or record failure ledger in PostgreSQL. |
| **4. Successful PhonePe Payment** | `200 OK` (with `verified: true`) | **NONE (0 rows)** | `updateDoc`, `setDoc` | **NONE (0 events)** | 🔴 **CRITICAL DEFECT:** Leaves PostgreSQL unconfirmed and unpaid. |
| **5. Failed PhonePe Payment** | `200 OK` (with `verified: false`) | None | None | None | ✅ Accurately reports non-success. |
| **6. Pending PhonePe Payment** | `200 OK` (with `status: 'PAYMENT_PENDING'`) | None | None | None | ✅ Normal polling response. |
| **7. Duplicate Status Request** | `200 OK` (Fast-path from Firestore) | None | None | None | ⚠️ Reads Firestore cache; ignores PostgreSQL state. |
| **8. Already-Paid Order** | `200 OK` | None | None | None | ⚠️ Fast-path exit from Firestore; leaves PostgreSQL desynced if PG was pending. |
| **9. PostgreSQL update rowCount = 0** | N/A (Not implemented) | N/A | Mutates Firestore | N/A | 🔴 No rowCount check exists. |
| **10. PostgreSQL Transaction Failure** | N/A (Not implemented) | N/A | Mutates Firestore | N/A | 🔴 No transaction exists. |
| **11. Firestore Failure After PG Commit** | N/A (Not implemented) | N/A | Crashes route | N/A | 🔴 Because Firestore is primary, any Firestore glitch crashes the entire route. |

---

## 11. Test Coverage & Blind Spots

### Existing Test Audit: `test/phonepe-business-e2e.test.ts`
Line 340 contains Test 3B:
```typescript
it('3B. Status Recovery Endpoint: retrieves authoritative payment status for mobile app restart', async () => {
  const { db } = await import('../lib/firebase');
  const txnId = 'TXN_PK_PK-101_STATUS_REC_1';
  (db as any)._payments.set(`pay_pk_${txnId}`, {
    paymentId: `pay_pk_${txnId}`,
    orderId: 'ord_online_test_101',
    customerId: 'usr-cust-1',
    amount: 512,
    status: 'completed',
  });

  const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}&orderId=ord_online_test_101`, {
    method: 'GET',
  });

  const res = await phonepeStatusHandler(req);
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.success).toBe(true);
  expect(json.data.orderId).toBe('ord_online_test_101');
  expect(json.data.verified).toBe(true);
});
```

### Critical Blind Spots Identified:
1. **False-Green Assertion:** The test injects a dummy record into in-memory Firestore `_payments` and asserts that the status route returns `verified: true`.
2. **Zero PostgreSQL Assertions:** The test:
   - NEVER asserts `orders.payment_status === 'paid'`
   - NEVER asserts `orders.order_status === 'CONFIRMED'`
   - NEVER asserts `payments` table row
   - NEVER asserts `payment_transactions` ledger entry
   - NEVER asserts `outbox_events`
3. **No Network Failure Testing:** There are zero tests simulating gateway status check with a live or mocked PostgreSQL transaction.

---

## 12. Live PostgreSQL Read-Only Evidence

Direct read-only inspection of the live production database (`pocketkirana_db` on `192.168.0.105:5433`):

### A. Live Orders Table
```
┌─────────┬────────────────────────────┬──────────────┬─────────────┬──────────────┬────────────────┬────────────────┬──────────────┬──────────────────────────┐
│ (index) │ id                         │ order_number │ store_id    │ total_amount │ payment_method │ payment_status │ order_status │ confirmed_at             │
├─────────┼────────────────────────────┼──────────────┼─────────────┼──────────────┼────────────────┼────────────────┼──────────────┼──────────────────────────┤
│ 0       │ 'ord-1790844669560-a062ae' │ 'PK-11'      │ 'store-001' │ '100.00'     │ 'phonepe'      │ 'paid'         │ 'CONFIRMED'  │ 2026-10-01T09:53:32.653Z │
│ 1       │ 'ord-1790843543209-f712f3' │ 'PK-10'      │ 'store-001' │ '100.00'     │ 'cod'          │ 'pending'      │ 'CONFIRMED'  │ null                     │
│ 2       │ 'ord-1790707890316-8af5dd' │ 'PK-09'      │ 'store-001' │ '50.00'      │ 'phonepe'      │ 'pending'      │ 'PLACED'     │ null                     │
│ 3       │ 'ord-1790707696489-9a6c68' │ 'PK-08'      │ 'store-001' │ '50.00'      │ 'phonepe'      │ 'pending'      │ 'PLACED'     │ null                     │
│ 4       │ 'ord-1790707546801-b4b84d' │ 'PK-07'      │ 'store-001' │ '50.00'      │ 'phonepe'      │ 'pending'      │ 'PLACED'     │ null                     │
│ 5       │ 'ord-1790707528261-9aac94' │ 'PK-06'      │ 'store-001' │ '50.00'      │ 'phonepe'      │ 'pending'      │ 'PLACED'     │ null                     │
│ 6       │ 'ord-1790707290128-ef78d6' │ 'PK-05'      │ 'store-001' │ '50.00'      │ 'phonepe'      │ 'pending'      │ 'PLACED'     │ null                     │
│ 7       │ 'ord-1790707220510-debfa1' │ 'PK-04'      │ 'store-001' │ '50.00'      │ 'phonepe'      │ 'pending'      │ 'PLACED'     │ null                     │
└─────────┴────────────────────────────┴──────────────┴─────────────┴──────────────┴────────────────┴────────────────┴──────────────┴──────────────────────────┘
```

### B. Live Payments Table
```
┌─────────┬─────────────────────────────────────┬────────────────────────────┬──────────┬─────────────┬───────────┬──────────────────────────┐
│ (index) │ id                                  │ order_id                   │ amount   │ status      │ gateway   │ paid_at                  │
├─────────┼─────────────────────────────────────┼────────────────────────────┼──────────┼─────────────┼───────────┼──────────────────────────┤
│ 0       │ 'pay_pk_TXN_PK_PK-11_1790844673631' │ 'ord-1790844669560-a062ae' │ '100.00' │ 'completed' │ 'phonepe' │ 2026-10-01T09:53:32.653Z │
└─────────┴─────────────────────────────────────┴────────────────────────────┴──────────┴─────────────┴───────────┴──────────────────────────┘
```

### C. Live Payment Transactions Ledger Table
```
┌─────────┬──────────────────────┬─────────────────────────────────────┬───────────────────────────┬──────────────────┬──────────┬───────────┐
│ (index) │ id                   │ payment_id                          │ transaction_id            │ transaction_type │ amount   │ status    │
├─────────┼──────────────────────┼─────────────────────────────────────┼───────────────────────────┼──────────────────┼──────────┼───────────┤
│ 0       │ 'ptxn_1790848412486' │ 'pay_pk_TXN_PK_PK-11_1790844673631' │ 'T2610011421137248532289' │ 'VERIFY_PAYMENT' │ '100.00' │ 'SUCCESS' │
└─────────┴──────────────────────┴─────────────────────────────────────┴───────────────────────────┴──────────────────┴──────────┴───────────┘
```

### Forensic Takeaways from Live Data:
1. `PK-11` was confirmed by `VERIFY_PAYMENT` (via `verify/route.ts`), proving that `verify/route.ts` has at least partial PostgreSQL persistence.
2. Orders `PK-04` through `PK-09` have **zero rows** in `payments` and **zero rows** in `payment_transactions`.
3. If anyone ran status recovery on `PK-04` through `PK-09` today, it would update only Firestore and leave them in `PLACED` / `pending` in PostgreSQL.

---

## 13. Comparison Against Approved B.2/B.3 Architecture

| Architectural Feature | Approved B.2/B.3 Standard | Current `status/route.ts` |
|---|---|---|
| **Authoritative DB** | PostgreSQL (`orders`, `payments`, `payment_transactions`) | Firestore (`orders`, `payments`) |
| **Transaction Boundary** | `withTransaction` or `client.query('BEGIN'...'COMMIT')` | None |
| **Row Locking** | `SELECT ... FOR UPDATE` | None |
| **Identifier Resolution** | Multi-candidate: `WHERE id = $1 OR order_number = $1` | Unindexed Firestore doc ID |
| **Mutation Target** | Canonical `orders.id` (UUID) | External or unnormalized string |
| **Order State Mutation** | Sets `order_status = 'CONFIRMED'`, `payment_status = 'paid'` | Sets nothing in PostgreSQL |
| **RowCount Protection** | Strict assertion: `updateRes.rowCount === 1` | None |
| **Audit Ledger** | `payment_transactions` (`STATUS_RECOVERY`, `SUCCESS`) | None |
| **Order History** | `order_status_history` (`system:phonepe_status`) | None |
| **Transactional Outbox** | Appends `payment.confirmed` before commit | None |
| **Read Projection** | Firestore updated **only after** PostgreSQL commit | Firestore updated as primary |

---

## 14. Exact Defects Found in `status/route.ts`

1. **DEFECT 1 (PostgreSQL Absent):** `status/route.ts` imports no database client and executes zero PostgreSQL queries.
2. **DEFECT 2 (Unchecked Success):** When PhonePe returns `responseCode: 'SUCCESS'`, the route returns `200 OK` `{ verified: true }` while PostgreSQL remains in `order_status = 'PLACED'` and `payment_status = 'pending'`.
3. **DEFECT 3 (Missing Transaction Ledger):** No record is created in `payment_transactions`, meaning financial reconciliation cannot trace payments confirmed via the status endpoint.
4. **DEFECT 4 (Missing Status History):** No record is appended to `order_status_history`.
5. **DEFECT 5 (Missing Outbox Event):** No `payment.confirmed` event is placed into `outbox_events`, breaking downstream asynchronous notification or accounting pipelines.
6. **DEFECT 6 (No Concurrency Protection):** Missing `FOR UPDATE` lock leaves the status route susceptible to race conditions with concurrent webhooks or duplicate user queries.
7. **DEFECT 7 (False-Green Test Masking):** `test/phonepe-business-e2e.test.ts` Test 3B checks only Firestore and completely ignores PostgreSQL.

---

## 15. Recommended Remediation Design for Phase 2.9B.4 Implementation

When authorized to implement Phase 2.9B.4, update `app/api/payments/phonepe/status/route.ts` to follow the exact pattern proven in Phase 2.9B.3:

1. **Authenticate Request & Check Gateway Credentials.**
2. **Call PhonePe Gateway Status API** (`/pg/v1/status/{merchantId}/{merchantTransactionId}`) with SHA-256 `X-VERIFY` header.
3. **If PhonePe status is not `SUCCESS`:**
   - Return clean non-success response without touching database.
4. **If PhonePe status is `SUCCESS`:**
   - Extract candidate identifiers (`orderId`, `merchantTransactionId.split('_')` order numbers).
   - Begin PostgreSQL transaction: `await client.query('BEGIN')`.
   - Authoritative lookup:
     ```sql
     SELECT id, order_number, customer_id, firebase_uid, total_amount, payment_status, order_status
     FROM orders
     WHERE id = $1 OR order_number = $1 OR id = $2 OR order_number = $2 ...
     LIMIT 1
     FOR UPDATE
     ```
   - If not found: `ROLLBACK`, return HTTP 404 `{ success: false, error: 'Associated order not found' }`.
   - Validate amount: `Math.round(Number(currentOrder.total_amount) * 100) === phonepeAmountInPaise`. On mismatch: `ROLLBACK`, return HTTP 400.
   - Check idempotency: If `currentOrder.order_status === 'CONFIRMED' && currentOrder.payment_status === 'paid'`, or transaction exists in `payment_transactions` -> `COMMIT`, return HTTP 200 `{ verified: true, message: 'Payment already processed' }`.
   - **Atomic PostgreSQL Persistence:**
     - Upsert `payments` with `order_id = canonicalOrderId`, `status = 'completed'`.
     - Insert `payment_transactions` (`transaction_type = 'STATUS_RECOVERY'`, `status = 'SUCCESS'`).
     - Update `orders`:
       ```sql
       UPDATE orders
       SET payment_status = 'paid',
           order_status = 'CONFIRMED',
           confirmed_at = COALESCE(confirmed_at, NOW()),
           updated_at = NOW()
       WHERE id = $1
       ```
     - Assert `updateRes.rowCount === 1`.
     - Insert `order_status_history` (`changed_by = 'system:phonepe_status_recovery'`).
     - Append `outbox_events` (`payment.confirmed`).
   - `await client.query('COMMIT')`.
   - **Downstream Read Projection:** Update Firestore `orders` and `payments`, trigger `ensurePickingTaskForOrder`.
   - Return HTTP 200 `{ success: true, data: { verified: true, paymentStatus: 'paid', orderStatus: 'CONFIRMED', ... } }`.

---

## 16. Required Tests for Phase 2.9B.4 Implementation

A dedicated test suite `test/phonepe-status-reconciliation.test.ts` must be created to verify:
1. **TEST 1 — Status recovery confirms order:** PhonePe returns `SUCCESS` -> PostgreSQL order updated to `CONFIRMED` and `paid`, canonical ID used.
2. **TEST 2 — Order number resolution:** Status query passing `PK-11` resolves canonical UUID.
3. **TEST 3 — Payment ledger entry:** `payment_transactions` record created with `transaction_type: 'STATUS_RECOVERY'`.
4. **TEST 4 — Outbox event creation:** `outbox_events` record created with `payment.confirmed`.
5. **TEST 5 — Idempotent polling:** Subsequent status polls do not duplicate payments, transactions, or outbox events.
6. **TEST 6 — Unknown order returns 404:** When order does not exist in PostgreSQL.
7. **TEST 7 — Amount mismatch returns 400:** When gateway amount does not match PostgreSQL total.
8. **TEST 8 — Row-locking verification:** Verifies `FOR UPDATE` is present in order selection query.
9. **TEST 9 — RowCount protection:** Throws 500 and rolls back if `rowCount !== 1`.

---

## 17. Scope & Rollback Plan

- **Single File Scope:** Only `app/api/payments/phonepe/status/route.ts` will be modified in the implementation phase.
- **Rollback:** In the event of an issue, `status/route.ts` can be reverted directly via Git without impacting `webhook/route.ts` (Phase 2.9B.3) or `orderService.ts` (Phase 2.9B.2).
- **Database Safety:** Zero migrations required. No DDL.

---

## 18. Final Verdict

### 🟢 READY FOR IMPLEMENTATION

The forensic audit is complete. The defect is proven beyond doubt. The status/recovery route is currently 100% disconnected from PostgreSQL, creating a critical split-brain. The remediation path is identical to the proven, verified Phase 2.9B.3 pattern.

---

### STRICT STOP CONDITION HONORED
**Audit complete. No code changes, migrations, commits, or deployments have been performed. Awaiting user instruction before proceeding to Phase 2.9B.4 implementation.**
