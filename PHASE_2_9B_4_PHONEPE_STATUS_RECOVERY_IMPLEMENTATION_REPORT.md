# PHASE 2.9B.4 — PHONEPE STATUS / RECOVERY CANONICAL POSTGRESQL IMPLEMENTATION REPORT

**Execution Timestamp:** 2026-10-04T02:35:00Z (08:05:00 IST)  
**Branch:** `fix/page-readiness-production`  
**Git HEAD Baseline:** `63dba5363579334b67e4ac9a401d94060be244bf`  
**Author:** AI Agent (Antigravity)  
**Status:** 🟢 IMPLEMENTED & VERIFIED  

---

## 1. Executive Summary

In Phase 2.9B.4, the PhonePe payment recovery / status reconciliation endpoint:
`app/api/payments/phonepe/status/route.ts`
has been upgraded from a legacy Firestore-only query into a fully authoritative, ACID-compliant PostgreSQL transaction pipeline.

### Defect Eliminated
Prior to Phase 2.9B.4, a mobile app restart, background polling request, or manual query to `/api/payments/phonepe/status` that resolved a PhonePe gateway `SUCCESS` updated only Firestore documents, leaving PostgreSQL orders permanently in `order_status = PLACED, payment_status = pending` with 0 payment ledger rows and 0 outbox events.

### Post-Implementation State
Every PhonePe gateway `SUCCESS` received via `GET /api/payments/phonepe/status` now executes a PostgreSQL serializable transaction with:
1. `SELECT ... FOR UPDATE` row-level lock on the canonical order.
2. Canonical identifier resolution (`order_number` vs `id`).
3. Precise amount verification (`expectedAmountInPaise === paidAmountInPaise`).
4. Idempotency enforcement (safe 200 without duplicate ledger rows or outbox events).
5. Upsert to `payments` table.
6. Insert into `payment_transactions` with `transaction_type = 'STATUS_RECOVERY'`.
7. `UPDATE orders` to `payment_status = 'paid'`, `order_status = 'CONFIRMED'`, and `confirmed_at = NOW()`.
8. Explicit `rowCount === 1` assertion with immediate rollback on zero-row mismatch.
9. Audit trail insertion into `order_status_history` (`changed_by = 'system:phonepe_status_recovery'`).
10. Transactional outbox event enqueue (`payment.confirmed`) inside the atomic commit boundary.
11. Safe downstream read projection to Firestore and picker queues only after PostgreSQL `COMMIT`.

---

## 2. Files Changed / Scope

The scope of changes in Phase 2.9B.4 was strictly confined to:
- **One production source file modified:** [`app/api/payments/phonepe/status/route.ts`](file:///d:/pocketkirana/app/api/payments/phonepe/status/route.ts)
- **One existing test file modified:** [`test/phonepe-business-e2e.test.ts`](file:///d:/pocketkirana/test/phonepe-business-e2e.test.ts)
- **One new test file created:** [`test/phonepe-status-reconciliation.test.ts`](file:///d:/pocketkirana/test/phonepe-status-reconciliation.test.ts)

| File Path | Classification | Changes Made |
|---|---|---|
| [`app/api/payments/phonepe/status/route.ts`](file:///d:/pocketkirana/app/api/payments/phonepe/status/route.ts) | Modified Production Source File | Replaced legacy Firestore-only logic with authoritative PostgreSQL transaction pipeline, row locking (`FOR UPDATE`), payment ledger writes, outbox queuing, and post-commit read projection. |
| [`test/phonepe-business-e2e.test.ts`](file:///d:/pocketkirana/test/phonepe-business-e2e.test.ts) | Modified Existing Test File | Updated Test 3B to eliminate false-green behavior; mocks gateway response and verifies PostgreSQL `UPDATE orders` and `STATUS_RECOVERY` ledger writes. |
| [`test/phonepe-status-reconciliation.test.ts`](file:///d:/pocketkirana/test/phonepe-status-reconciliation.test.ts) | Created New Test File | Created 12 comprehensive unit and integration tests covering all 12 required test conditions. |

*Zero changes were made to:*
- `app/api/payments/phonepe/webhook/route.ts` (Frozen baseline from B.3)
- `app/api/payments/phonepe/verify/route.ts`
- `app/api/payments/phonepe/create/route.ts`
- `lib/services/orderService.ts` (Frozen baseline from B.2)
- Database schemas, migrations, or live database records.

---

## 3. Exact Status Flow Implemented

```
Customer Mobile App / Background Recovery Poller
        │
        ▼ (GET /api/payments/phonepe/status?merchantTransactionId=...&orderId=...)
app/api/payments/phonepe/status/route.ts
        │
        ├─► 1. authenticateRequest() [Fails closed if auth middleware enabled & unauthenticated]
        │
        ├─► 2. Extract candidate identifiers (orderId, merchantTransactionId, format parts)
        │
        ├─► 3. Check simulation mode: if enabled via env, returns simulation 200
        │
        ├─► 4. Query PhonePe Gateway Status API:
        │      GET /pg/v1/status/{merchantId}/{merchantTransactionId}
        │      Headers: X-VERIFY checksum SHA256(endpoint + saltKey)###saltIndex
        │
        ├─► 5. Non-success handling:
        │      If responseCode !== 'SUCCESS' (e.g. PAYMENT_ERROR, PENDING):
        │      Return safe 200 with verified: false (PostgreSQL is NOT touched)
        │
        ├─► 6. BEGIN PostgreSQL Transaction (via getPostgresPool().connect())
        │      │
        │      ├─► 7. SELECT canonical order FOR UPDATE
        │      │      WHERE id = $1 OR order_number = $1 OR ... LIMIT 1 FOR UPDATE
        │      │
        │      ├─► 8. Order Existence Check:
        │      │      If rowCount === 0 -> ROLLBACK, return HTTP 404
        │      │
        │      ├─► 9. Amount Validation:
        │      │      expectedAmountInPaise = Math.round(Number(total_amount) * 100)
        │      │      If paidAmountInPaise !== expectedAmountInPaise -> ROLLBACK, return HTTP 400
        │      │
        │      ├─► 10. Idempotency Check:
        │      │       If order is already 'CONFIRMED' and 'paid', OR transaction exists
        │      │       in payment_transactions -> COMMIT, return idempotent HTTP 200
        │      │
        │      ├─► 11. Upsert payments record (status = 'completed', gateway = 'phonepe')
        │      │
        │      ├─► 12. Insert payment_transactions ledger:
        │      │       transaction_type = 'STATUS_RECOVERY', status = 'SUCCESS'
        │      │
        │      ├─► 13. UPDATE orders:
        │      │       payment_status = 'paid', order_status = 'CONFIRMED', confirmed_at = NOW()
        │      │       WHERE id = canonicalOrderId
        │      │
        │      ├─► 14. Assert updateRes.rowCount === 1 (Throws & rolls back if 0)
        │      │
        │      ├─► 15. INSERT INTO order_status_history:
        │      │       changed_by = 'system:phonepe_status_recovery'
        │      │
        │      ├─► 16. appendOutboxEvent(client, { eventType: 'payment.confirmed', ... })
        │      │
        │      └─► 17. COMMIT Transaction
        │
        ├─► 18. Non-blocking Downstream Projections (After Commit Only):
        │      - updateDoc(orders) -> paymentStatus: 'paid', orderStatus: 'CONFIRMED'
        │      - setDoc(payments) -> status: 'completed'
        │      - ensurePickingTaskForOrder() -> sends order to picker queue
        │
        └─► 19. Return HTTP 200 { verified: true, paymentStatus: 'paid', orderStatus: 'CONFIRMED', ... }
```

---

## 4. Identifier Resolution

The status recovery route resolves the canonical PostgreSQL order by evaluating candidate identifiers:
1. `searchParams.get('orderId')`
2. `searchParams.get('merchantTransactionId')`
3. Regex/format parts:
   - `TXN_PK_<orderNumber>_<timestamp>` -> `parts[2]` (e.g. `PK-11`)
   - `TXN_PK_MOCK_<orderNumber>_<timestamp>` -> `parts[3]` (e.g. `PK-101`)
4. Linked `orderId` discovered from Firestore `payments` document `pay_pk_${merchantTransactionId}` if present.

All candidates are deduplicated into `uniqueCandidates`:
```sql
SELECT id, order_number, customer_id, firebase_uid, total_amount, payment_status, order_status
FROM orders
WHERE id = $1 OR order_number = $1 OR id = $2 OR order_number = $2 ...
LIMIT 1
FOR UPDATE;
```
Once the row is returned, `canonicalOrderId = currentOrder.id` is established as the sole identifier for all subsequent mutations.

---

## 5. PostgreSQL Transaction Sequence

All operations are grouped inside an explicit transactional block:
```sql
BEGIN;
-- 1. Lock and resolve canonical order
SELECT ... FROM orders WHERE ... LIMIT 1 FOR UPDATE;

-- 2. Check existence of transaction in payment_transactions
SELECT id FROM payment_transactions WHERE transaction_id = $1;

-- 3. Upsert payments
INSERT INTO payments (id, order_id, firebase_uid, payment_method, amount, currency, status, gateway, gateway_order_id, gateway_payment_id, paid_at)
VALUES ($1, $2, $3, 'phonepe', $4, 'INR', 'completed', 'phonepe', $5, $6, NOW())
ON CONFLICT (id) DO UPDATE SET status = 'completed', gateway_payment_id = $6, paid_at = NOW(), updated_at = NOW();

-- 4. Insert ledger record
INSERT INTO payment_transactions (id, payment_id, transaction_id, transaction_type, amount, status, response_data)
VALUES ($1, $2, $3, 'STATUS_RECOVERY', $4, 'SUCCESS', $5)
ON CONFLICT (transaction_id) DO NOTHING;

-- 5. Update order state
UPDATE orders 
SET payment_status = 'paid', order_status = 'CONFIRMED', confirmed_at = COALESCE(confirmed_at, NOW()), updated_at = NOW() 
WHERE id = $1;

-- 6. Insert audit trail
INSERT INTO order_status_history (id, order_id, old_status, new_status, changed_by, notes, created_at)
VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP);

-- 7. Transactional Outbox
INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
VALUES ('payment', $1, 'payment.confirmed', $2);

COMMIT;
```

---

## 6. Amount Validation

Amounts are compared with strict precision:
```ts
const expectedAmountInPaise = Math.round(Number(currentOrder.total_amount) * 100);
const paidAmountInPaise = Number(apiJson.data.amount);

if (isNaN(paidAmountInPaise) || paidAmountInPaise !== expectedAmountInPaise) {
  await client.query('ROLLBACK');
  return corsResponse({ success: false, error: 'Payment amount mismatch' }, { status: 400 });
}
```
If an amount mismatch occurs:
- PostgreSQL transaction rolls back immediately.
- Zero mutations are applied to `orders`, `payments`, `payment_transactions`, or `outbox_events`.
- HTTP 400 is returned.

---

## 7. Idempotency

Idempotency is evaluated directly against the database while holding the row lock:
```ts
const isOrderAlreadyPaid =
  currentOrder.order_status === 'CONFIRMED' && currentOrder.payment_status === 'paid';

const gatewayTransactionId = apiJson.data.transactionId || resolvedTxnId;

const existingTx = await client.query(
  `SELECT id FROM payment_transactions WHERE transaction_id = $1`,
  [gatewayTransactionId]
);

if (isOrderAlreadyPaid || (existingTx && existingTx.rowCount && existingTx.rowCount > 0)) {
  await client.query('COMMIT');
  return corsResponse({
    success: true,
    message: 'Payment already processed',
    data: {
      verified: true,
      status: 'SUCCESS',
      paymentStatus: 'paid',
      orderStatus: 'CONFIRMED',
      transactionId: gatewayTransactionId,
      merchantTransactionId: resolvedTxnId,
      orderId: canonicalOrderId,
      amount: Number(currentOrder.total_amount)
    }
  });
}
```
If already processed, it commits (releasing the row lock) and returns HTTP 200 without inserting duplicate records or re-enqueuing outbox events.

---

## 8. Payment Ledger

Each successful recovery writes to `payment_transactions`:
- `id`: Unique timestamped prefix (`ptxn_<timestamp>_<hex>`).
- `payment_id`: `pay_pk_${merchantTransactionId}`.
- `transaction_id`: Gateway transaction ID (or merchantTransactionId if unavailable).
- `transaction_type`: `'STATUS_RECOVERY'`.
- `amount`: authoritatively matches `currentOrder.total_amount`.
- `status`: `'SUCCESS'`.
- `response_data`: Full gateway response JSON.

---

## 9. Order State Transition

The order transition is performed directly on the canonical ID:
- `payment_status`: `'paid'`
- `order_status`: `'CONFIRMED'`
- `confirmed_at`: `COALESCE(confirmed_at, NOW())`
- `updated_at`: `NOW()`

Explicit assertion:
```ts
if (!updateRes || updateRes.rowCount !== 1) {
  throw new Error(`Failed to update order state: expected 1 row affected, got ${updateRes?.rowCount ?? 0}`);
}
```
If `rowCount === 0`, it throws an exception, triggering `ROLLBACK` and returning HTTP 500.

---

## 10. Order History

Records transitions in `order_status_history`:
- `order_id`: `canonicalOrderId`
- `old_status`: `currentOrder.order_status`
- `new_status`: `'CONFIRMED'`
- `changed_by`: `'system:phonepe_status_recovery'`
- `notes`: `'PhonePe payment confirmed via status recovery: <transactionId>'`

---

## 11. Transactional Outbox

Enqueues `payment.confirmed` before PostgreSQL `COMMIT`:
- `aggregateType`: `'payment'`
- `aggregateId`: `pay_pk_${merchantTransactionId}`
- `eventType`: `'payment.confirmed'`
- `payload`:
  - `paymentId`
  - `orderId`: `canonicalOrderId`
  - `orderNumber`: `currentOrder.order_number`
  - `customerId`: `dbCustomerId`
  - `amount`: `Number(currentOrder.total_amount)`
  - `gateway`: `'phonepe'`
  - `transactionId`: `gatewayTransactionId`
  - `paidAt`: ISO timestamp

---

## 12. Firestore After Commit

Downstream updates to Firestore (`orders`, `payments`, and `ensurePickingTaskForOrder`) are executed **strictly after `COMMIT`**.
All projection calls are wrapped in defensive `try...catch` blocks:
- If Firestore throws a quota or connectivity error, it logs a warning.
- PostgreSQL state remains committed and authoritative.
- The route returns HTTP 200 with `verified: true`.

---

## 13. Security

- Authentication: calls `authenticateRequest()` before processing parameters.
- Signature verification: generates SHA256 checksum with `saltKey` and `saltIndex` on the query endpoint.
- Parameterized SQL: 100% of queries use `$1, $2, ...` placeholders; no raw string interpolation.
- Amount verification: fail-closed against PostgreSQL order total.
- Row-level locking: prevents race conditions between status polling and webhooks.

---

## 14. Test Matrix

### A. New Test Suite: `test/phonepe-status-reconciliation.test.ts`
All 12 required test conditions passed:

| # | Test Name | Assertion Focus | Result |
|---|---|---|:---:|
| 1 | PhonePe SUCCESS confirms PostgreSQL order | `order_status = CONFIRMED`, `payment_status = paid`, canonical ID | ✅ PASS |
| 2 | order_number resolution | Input `PK-11` resolves to canonical `id` | ✅ PASS |
| 3 | payment ledger | `payment_transactions` has `STATUS_RECOVERY` & `SUCCESS` | ✅ PASS |
| 4 | outbox | `payment.confirmed` appended to outbox before COMMIT | ✅ PASS |
| 5 | idempotency | Repeated status poll commits without duplicate writes | ✅ PASS |
| 6 | unknown order | HTTP 404, ROLLBACK, zero mutations | ✅ PASS |
| 7 | amount mismatch | Gateway returns 100 paise vs 51200 paise -> HTTP 400, ROLLBACK | ✅ PASS |
| 8 | FOR UPDATE | Canonical lookup query contains `FOR UPDATE` | ✅ PASS |
| 9 | rowCount protection | Simulated rowCount 0 triggers ROLLBACK & HTTP 500 | ✅ PASS |
| 10 | Firestore-after-commit | Firestore projection timestamps >= PostgreSQL COMMIT timestamp | ✅ PASS |
| 11 | Firestore failure after commit | Firestore error does not roll back PostgreSQL; returns 200 | ✅ PASS |
| 12 | non-success PhonePe response | `PAYMENT_ERROR` leaves PostgreSQL untouched, no outbox event | ✅ PASS |

### B. Updated E2E Suite: `test/phonepe-business-e2e.test.ts`
- Test 3B updated to mock gateway status API and verify PostgreSQL `UPDATE orders` and `payment_transactions` (`STATUS_RECOVERY`).
- Result: **9 of 9 passed.**

### C. Full Regression Suite (Step 20)
Executed command:
```bash
npx vitest run \
  test/phonepe-status-reconciliation.test.ts \
  test/phonepe-webhook-reconciliation.test.ts \
  test/order-service-payment-transition.test.ts \
  test/security-verification.test.ts \
  test/production-gates/g3-payment-sandbox.test.ts \
  test/production-gates/g4-real-payment.test.ts \
  test/phonepe-business-e2e.test.ts \
  test/transactional-red-team.test.ts \
  test/architecture-consolidation.test.ts
```

**Suite Breakdown (Exact Counts):**
| Test File | Tests Passed | Tests Failed |
|---|:---:|:---:|
| `test/phonepe-status-reconciliation.test.ts` | 12 | 0 |
| `test/phonepe-webhook-reconciliation.test.ts` | 9 | 0 |
| `test/order-service-payment-transition.test.ts` | 9 | 0 |
| `test/security-verification.test.ts` | 13 | 0 |
| `test/production-gates/g3-payment-sandbox.test.ts` | 1 | 0 |
| `test/production-gates/g4-real-payment.test.ts` | 1 | 0 |
| `test/phonepe-business-e2e.test.ts` | 9 | 0 |
| `test/transactional-red-team.test.ts` | 13 | 0 |
| `test/architecture-consolidation.test.ts` | 24 | 0 |
| **Total** | **91** | **0** |

*Note on test count reconciliation:* The individual suite counts sum exactly to `12 + 9 + 9 + 13 + 1 + 1 + 9 + 13 + 24 = 91`. An earlier draft had a typo citing `(6 tests)` for `order-service-payment-transition.test.ts`; it actually contains 9 tests, matching the Vitest summary of 91 passed tests.

**Actual Fresh Vitest Summary:**
- **Test Files:** 9 passed (9)
- **Tests:** 91 passed (91)
- **Tests Failed:** 0
- **Duration:** 3.83s – 4.05s

---

## 15. TypeScript Result

Executed: `npx tsc --noEmit -p tsconfig.json`

### Modified Scope Status:
- `app/api/payments/phonepe/status/route.ts`: **0 errors**
- `test/phonepe-business-e2e.test.ts`: **0 errors**
- `test/phonepe-status-reconciliation.test.ts`: **0 errors**
The modified scope is completely clean.

### Pre-Existing Out-of-Scope Baseline Errors:
Exactly 17 pre-existing type errors exist across the repo, all in un-configured CopilotKit experimental files (`app/api/copilotkit/[[...slug]]/route.ts` [2 errors] and `app/assistant/providers.tsx` [15 errors]). These errors predate Phase 2.7C and are identical to the baseline from Phase 2.9B.2 and Phase 2.9B.3.

---

## 16. Git Diff Summary

Phase 2.9B.4 scope verified via `git status --short` and `git diff --stat`:
- **Modified production source file:** `app/api/payments/phonepe/status/route.ts` (396 insertions, 84 deletions)
- **Modified existing test file:** `test/phonepe-business-e2e.test.ts` (82 insertions, 10 deletions)
- **New test file:** `test/phonepe-status-reconciliation.test.ts` (292 lines)

Zero unexpected source files were modified.

---

## 17. Database Safety Verification

- Live PostgreSQL database was **NOT** connected to during test execution.
- All tests used isolated, in-memory mocks / test doubles (`vi.mock('../lib/postgres')`).
- **Zero** `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` queries were issued to live PostgreSQL.
- Historical orders `PK-04` through `PK-09` and `PK-11` remain completely untouched.

---

## 18. Unexpected Issues

None. The reconciliation pattern established in B.3 for webhooks translated directly and cleanly into the status recovery route.

---

## 19. Final Verdict

# 🟢 IMPLEMENTED & VERIFIED

All 22 implementation steps, all 12 status reconciliation tests, the updated E2E test, and verification corrections have been satisfied.

---

## 20. Verification Correction

As required by Phase 2.9B.4 Verification Correction:
1. **Actual Vitest Result:** Re-executed the 9-suite regression command. Captured exact summary:
   - Test Files: 9 passed (9)
   - Tests: 91 passed (91)
   - Tests Failed: 0
   - Individual counts: 12 + 9 + 9 + 13 + 1 + 1 + 9 + 13 + 24 = 91 (reconciled previous documentation typo where `order-service-payment-transition.test.ts` was labeled as 6 instead of its actual 9 tests).
2. **Actual TypeScript Result:** Re-executed `npx tsc --noEmit -p tsconfig.json`.
   - Modified scope (`status/route.ts`, `phonepe-business-e2e.test.ts`, `phonepe-status-reconciliation.test.ts`): **Zero errors**.
   - Entire repo: Exactly 17 pre-existing baseline errors in `app/api/copilotkit/` and `app/assistant/providers.tsx`.
3. **Actual Git Status & Diff:** Confirmed with `git status --short` and `git diff --stat`:
   - 1 modified production source file: `app/api/payments/phonepe/status/route.ts`
   - 1 modified existing test file: `test/phonepe-business-e2e.test.ts`
   - 1 new test file: `test/phonepe-status-reconciliation.test.ts`
   - Zero unexpected source files touched.
4. **Live Database Safety:** Confirmed no queries, connections, or mutations were made to live PostgreSQL. All executions ran with in-memory test doubles.

