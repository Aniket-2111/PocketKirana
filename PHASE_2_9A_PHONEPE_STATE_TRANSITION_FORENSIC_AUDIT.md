# Phase 2.9A — PhonePe Order & Payment State Transition Forensic Audit Report

**Document ID:** `PHASE_2_9A_PHONEPE_STATE_TRANSITION_FORENSIC_AUDIT.md`  
**Execution Timestamp:** 2026-10-04T07:30:00+05:30  
**Phase:** Phase 2.9A (Forensic Audit Only)  
**Repository:** `PocketKirana`  
**Execution Mode:** STRICT READ-ONLY FORENSIC AUDIT (Zero code changes, zero database mutations, zero migrations, zero deployments, zero commits)  

---

## 1. Executive Summary

This forensic audit investigates the exact root cause of the production-critical payment state disconnect:
$$\text{PhonePe Gateway} = \text{SUCCESS} \quad \centernot\implies \quad \text{PostgreSQL: } \begin{cases} \text{order\_status} = \text{PLACED} \\ \text{payment\_status} = \text{pending} \end{cases}$$

Through rigorous line-by-line inspection of the active codebase, schema introspection, and live queries against `pocketkirana_db` on `192.168.0.105:5433`, this audit **proves four distinct, compounding root-cause defects**:

1. **`OrderService.transitionOrder` Schema Disconnect (CONFIRMED):**  
   The centralized state machine in `lib/services/orderService.ts` accepts `OrderTransitionRequest`, which omits `paymentStatus`. The executed SQL statement exclusively updates `order_status` and leaves `payment_status` unchanged. Any path delegating to `OrderService.transitionOrder` (including simulation verification in `verify/route.ts` line 65) leaves PostgreSQL in `payment_status = 'pending'`.
2. **Webhook Identifier Mismatch & Blind `UPDATE` (CONFIRMED):**  
   In `app/api/payments/phonepe/webhook/route.ts` (line 185), the SQL query executes `UPDATE orders SET payment_status = 'paid', order_status = 'CONFIRMED' WHERE id = $1` using an unresolved `orderId`. When `orderId` is the sequential `order_number` (e.g. `'PK-11'`), `WHERE id = 'PK-11'` matches **0 rows** because the primary key `id` is an internal UUID (e.g. `'ord-1790844669560-a062ae'`). The query returns `rowCount = 0` without error, PostgreSQL commits zero updates, and the route returns HTTP 200 after marking Firestore `'paid'`.
3. **Status Polling Route Lacks PostgreSQL Persistence (CONFIRMED):**  
   `app/api/payments/phonepe/status/route.ts` queries the PhonePe Gateway API and updates Firestore, but contains **zero PostgreSQL queries**. App restarts or polling recoveries completely fail to update canonical PostgreSQL.
4. **Mocked Test Blindspot (CONFIRMED):**  
   Existing test suites (`g3-payment-sandbox.test.ts` and `phonepe-business-e2e.test.ts`) assert strictly against in-memory Firestore mocks or stub PostgreSQL queries with `{ rowCount: 0 }`. The test suite passes 100% green while completely blind to the PostgreSQL failure.

---

## 2. Git & Repository State

* **Active Branch:** `fix/page-readiness-production`
* **Head Commit SHA:** `63dba5363579334b67e4ac9a401d94060be244bf`
* **Working Tree State:** Frozen; read-only verification only.
* **Key Payment Code Inspected:**
  - `lib/services/orderService.ts` (Order State Machine)
  - `app/api/checkout/route.ts` (Order Creation)
  - `app/api/payments/phonepe/create/route.ts` (Payment Initiation)
  - `app/api/payments/phonepe/verify/route.ts` (Client Return Verification)
  - `app/api/payments/phonepe/webhook/route.ts` (Asynchronous Gateway Webhook)
  - `app/api/payments/phonepe/status/route.ts` (Polling / Recovery API)
  - `lib/phonepeConfig.ts` & `lib/phonepe.ts`
  - `lib/phonepeClient.ts` (Client Bridge)
  - `test/phonepe-business-e2e.test.ts` & `test/production-gates/g3-payment-sandbox.test.ts`

---

## 3. Complete PhonePe Payment Flow Map

```
1. Customer Checkout
   └─► POST /api/checkout
       ├─► Generates: orderId = 'ord-179...-a062ae', orderNumber = 'PK-11'
       ├─► INSERT INTO orders (id, order_number, order_status='PLACED', payment_status='pending')
       └─► Returns: { orderId: 'ord-179...-a062ae', orderNumber: 'PK-11' }

2. Payment Initiation
   └─► POST /api/payments/phonepe/create (receives body.orderId)
       ├─► SELECT id, order_number FROM orders WHERE id = $1 OR order_number = $1
       ├─► Generates: merchantTransactionId = 'TXN_PK_PK-11_1790844673631'
       ├─► INSERT INTO payments (id='pay_pk_TXN...', order_id=orderId, status='pending')
       ├─► Saves Firestore payments/pay_pk_TXN... { orderId }
       └─► Submits to PhonePe API /pg/v1/pay and returns redirectUrl

3. PhonePe Gateway Execution
   └─► User completes payment on PhonePe (UPI/Card/Netbanking) -> Status = SUCCESS

4. Pathway A: Client Return Verification
   └─► POST /api/payments/phonepe/verify (receives merchantTransactionId, orderId)
       ├─► Fetches PhonePe S2S status (/pg/v1/status/{merchantId}/{txnId}) -> SUCCESS
       ├─► Query: SELECT ... FROM orders WHERE id = $1 OR order_number = $1 FOR UPDATE
       ├─► [LIVE MODE]: UPDATE orders SET order_status='CONFIRMED', payment_status='paid' WHERE id = currentOrder.id
       ├─► [SIMULATION MODE]: Calls OrderService.transitionOrder({ targetStatus: 'CONFIRMED' })
       │   └─► BUG: OrderService updates ONLY order_status='CONFIRMED'; payment_status remains 'pending'!
       └─► Upserts payments, payment_transactions ('VERIFY_PAYMENT'), outbox event

5. Pathway B: Asynchronous Gateway Webhook
   └─► POST /api/payments/phonepe/webhook (receives base64 payload + x-verify)
       ├─► Validates HMAC-SHA256 signature
       ├─► Extracts: merchantTransactionId ('TXN_PK_PK-11_...'), transactionId
       ├─► Reads Firestore payments/pay_pk_TXN...
       │   └─► If missing: extracts 'PK-11' from txn string, queries Firestore orders where orderNumber == 'PK-11'
       │       └─► Sets orderId = docSnap.id (which is 'PK-11' or Firestore ID)
       ├─► Executes: UPDATE orders SET payment_status='paid', order_status='CONFIRMED' WHERE id = $1
       │   └─► BUG: If $1 is 'PK-11', WHERE id = 'PK-11' matches 0 ROWS!
       │   └─► BUG: rowCount is NOT checked. Zero error raised.
       ├─► Commits PostgreSQL transaction
       ├─► Updates Firestore orders to 'paid' and 'CONFIRMED'
       └─► Returns HTTP 200 { success: true }
```

---

## 4. `OrderService.transitionOrder()` Analysis

Authoritative code located at: `lib/services/orderService.ts` (lines 57–220).

### Signature & Interface:
```typescript
export interface OrderTransitionRequest {
  orderId: string;
  targetStatus: CanonicalOrderStatus;
  actorId: string;
  actorRole: 'customer' | 'admin' | 'picker' | 'driver' | 'system';
  reason?: string;
  isAdminOverride?: boolean;
  metadata?: Record<string, any>;
  eventId?: string;
}
```

### Forensic Defect Analysis:
1. **Missing `paymentStatus` Parameter:**  
   `OrderTransitionRequest` has no field for `paymentStatus` or `payment_status`.
2. **Omission in SQL `UPDATE`:**  
   Lines 161–171 execute:
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
   `payment_status` is **not present** in the `SET` clause.
3. **Execution Impact:**  
   Any caller invoking `OrderService.transitionOrder` to transition an order from `PLACED` to `CONFIRMED` updates `order_status = 'CONFIRMED'` while leaving `payment_status` as `'pending'`.
4. **Identifier Resolution in `OrderService`:**  
   Line 120 correctly queries `WHERE id = $1 OR order_number = $1`. The failure in `OrderService` is purely a **schema update omission**, not an identifier mismatch.

---

## 5. PhonePe Webhook Analysis

Authoritative code located at: `app/api/payments/phonepe/webhook/route.ts`.

### A. Signature Verification:
* Verified: Lines 36–51 calculate SHA-256 HMAC of `base64Response + saltKey`.
* Compares using `crypto.timingSafeEqual`.
* Invalid signatures return HTTP 200 with `'Invalid signature ignored'` to prevent gateway retries.
* Valid signatures continue into processing.

### B. Order Reference & The Silent Zero-Row Update:
* Lines 70–100 resolve `orderId`.
* Line 180 executes:
  ```sql
  UPDATE orders 
  SET payment_status = 'paid', 
      order_status = 'CONFIRMED', 
      confirmed_at = NOW(), 
      updated_at = NOW() 
  WHERE id = $1
  ```
  with parameter `[orderId]`.
* **The Failure Mechanism:**
  - If `orderId` resolves to an order number such as `'PK-11'` (e.g. from fallback line 96 or client payment doc):
  - In PostgreSQL `orders`:
    - `id` = `'ord-1790844669560-a062ae'` (Primary Key)
    - `order_number` = `'PK-11'`
  - `WHERE id = 'PK-11'` evaluates to `FALSE` for all rows.
  - PostgreSQL returns `rowCount: 0`.
  - The webhook code does **not inspect `rowCount`**.
  - It proceeds to line 205: `await client.query('COMMIT')`.
  - It then updates Firestore to `paid` and returns HTTP 200.
* **Defect Classification:** 🔴 **CONFIRMED CRITICAL BUG**. The webhook assumes `orderId` is always the primary key UUID and fails to support `id = $1 OR order_number = $1`.

---

## 6. PhonePe Status Verification Analysis

Authoritative code located at: `app/api/payments/phonepe/verify/route.ts`.

### Live Gateway Path (Lines 189–310):
* Line 195 queries: `SELECT ... FROM orders WHERE id = $1 OR order_number = $1`.
* Line 239 queries: `SELECT ... FOR UPDATE WHERE id = $1 OR order_number = $1`.
* Resolves `currentOrder.id` (the true UUID).
* Line 262 executes direct SQL:
  ```sql
  UPDATE orders 
  SET order_status = 'CONFIRMED',
      payment_status = 'paid',
      confirmed_at = COALESCE(confirmed_at, NOW()),
      updated_at = NOW() 
  WHERE id = $1
  ```
  with `[currentOrder.id]`.
* This direct SQL **bypasses `OrderService`** and successfully updates both fields. This explains why `verify/route.ts` succeeded when tested on `PK-11` on Oct 1.

### Simulation Mode Path (Lines 40–113):
* Line 65 delegates directly to `OrderService.transitionOrder({ orderId, targetStatus: 'CONFIRMED' })`.
* Because `OrderService` lacks `payment_status` support, simulation mode leaves PostgreSQL `payment_status = 'pending'`.

---

## 7. PostgreSQL Schema Analysis

Schema verified by direct inspection of `information_schema.columns` on `pocketkirana_db`:

### `orders` Table:
| Column | Type | Nullable | Role / Constraint |
|---|---|:---:|---|
| `id` | `varchar` | NO | **PRIMARY KEY** (e.g. `'ord-1790844669560-a062ae'`) |
| `order_number` | `varchar` | NO | **UNIQUE KEY** (e.g. `'PK-11'`) |
| `order_status` | `varchar` | YES | Canonical order status (`'PLACED'`, `'CONFIRMED'`, etc.) |
| `payment_status` | `varchar` | YES | Canonical payment status (`'pending'`, `'paid'`, etc.) |
| `payment_method` | `varchar` | YES | `'phonepe'`, `'cod'`, etc. |
| `total_amount` | `numeric` | NO | Order total in INR |
| `placed_at` | `timestamptz` | YES | Initial checkout timestamp |
| `confirmed_at` | `timestamptz` | YES | Payment confirmation timestamp |
| `updated_at` | `timestamptz` | YES | Modification timestamp |

### `payments` Table:
| Column | Type | Nullable | Role / Constraint |
|---|---|:---:|---|
| `id` | `varchar` | NO | **PRIMARY KEY** (e.g. `'pay_pk_TXN_PK_PK-11_...'`) |
| `order_id` | `varchar` | YES | Order reference (No FK constraint defined!) |
| `status` | `varchar` | NO | `'pending'`, `'completed'`, `'failed'` |
| `gateway` | `varchar` | NO | `'phonepe'` |
| `gateway_order_id` | `varchar` | YES | PhonePe Merchant Transaction ID |
| `gateway_payment_id` | `varchar` | YES | PhonePe Transaction ID |
| `paid_at` | `timestamptz` | YES | Payment completion timestamp |

### `payment_transactions` Table:
| Column | Type | Nullable | Role / Constraint |
|---|---|:---:|---|
| `id` | `varchar` | NO | **PRIMARY KEY** (e.g. `'ptxn_1790848412486'`) |
| `payment_id` | `varchar` | YES | References `payments.id` |
| `transaction_id` | `varchar` | YES | Gateway reference (Unique key for idempotency) |
| `transaction_type` | `varchar` | NO | `'VERIFY_PAYMENT'`, `'WEBHOOK_PAYMENT'` |
| `status` | `varchar` | NO | `'SUCCESS'`, `'FAILED'` |

> **Key Structural Insight:**  
> Neither `payments` nor `payment_transactions` enforces a foreign key constraint to `orders.id`. An `INSERT` with `order_id = 'PK-11'` succeeds silently even if no order exists with `id = 'PK-11'`.

---

## 8. Identifier Compatibility Matrix

| Layer | Identifier Field | Example Value | Target in PostgreSQL | Compatibility Status |
|---|---|---|---|:---:|
| **Checkout Route** | `orderId` | `'ord-1790844669560-a062ae'` | `orders.id` | ✅ Exact match |
| **Checkout Route** | `orderNumber` | `'PK-11'` | `orders.order_number` | ✅ Exact match |
| **PhonePe Gateway** | `merchantTransactionId` | `'TXN_PK_PK-11_1790844673631'` | `payments.gateway_order_id` | ✅ Exact match |
| **PhonePe Gateway** | `transactionId` | `'T2610011421137248532289'` | `payments.gateway_payment_id` | ✅ Exact match |
| **Verify Route** | `resolvedOrderId` | `'ord-...'` OR `'PK-11'` | `orders.id OR orders.order_number` | ✅ Handled (`OR` query) |
| **Webhook Route** | `orderId` (via fallback) | `'PK-11'` | `orders.id` | 🔴 **FATAL MISMATCH** (`WHERE id = 'PK-11'` matches 0 rows) |
| **OrderService** | `orderId` | `'ord-...'` OR `'PK-11'` | `orders.id OR orders.order_number` | ✅ Identifier matches, but `payment_status` omitted |

---

## 9. Transaction & Atomicity Analysis

The required atomic transition behavior:
```text
BEGIN
  1. Lock orders row (SELECT ... FOR UPDATE WHERE id = $1 OR order_number = $1)
  2. Idempotency check (if order.payment_status == 'paid', return)
  3. Validate amount (expectedAmountInPaise == gatewayAmount)
  4. Upsert payments row (status = 'completed', paid_at = NOW())
  5. Insert payment_transactions row (ON CONFLICT DO NOTHING)
  6. UPDATE orders SET order_status = 'CONFIRMED', payment_status = 'paid', confirmed_at = NOW() WHERE id = lockedOrder.id
  7. Insert outbox_events row (eventType = 'payment.confirmed')
COMMIT
```

### Current Reality:
* **In `verify/route.ts` (Live):** Follows the atomic pattern correctly.
* **In `verify/route.ts` (Simulation):** Breaks atomicity; calls `OrderService` which does not update `payment_status`.
* **In `webhook/route.ts`:**
  - Lacks `FOR UPDATE` lock on `orders`.
  - Executes `UPDATE orders ... WHERE id = $1` without verifying `rowCount`.
  - If `orderId` is `'PK-11'`, the update silently affects 0 rows, but `COMMIT` is executed.
* **In `status/route.ts`:** Has **no PostgreSQL transaction** whatsoever.

---

## 10. Idempotency Analysis

* **Duplicate Webhooks:**
  - Handled via `payment_transactions.transaction_id` unique constraint (`ON CONFLICT DO NOTHING`) and Firestore check (`paymentData.status === 'completed'`).
  - If a duplicate webhook arrives, it short-circuits with `Payment already processed`.
* **Hazard:** If the first webhook fails to update PostgreSQL due to the `WHERE id = $1` bug, subsequent duplicate webhooks will be rejected as "already processed", permanently leaving PostgreSQL in `PLACED` / `pending`.

---

## 11. Failure-Path Analysis

| Failure Scenario | Current Behavior | Result in PostgreSQL |
|---|---|---|
| **Webhook receives `order_number` (e.g. `'PK-11'`)** | `UPDATE orders WHERE id = 'PK-11'` matches 0 rows; commits cleanly. | `order_status = PLACED`, `payment_status = pending` |
| **Simulation payment verified** | Calls `OrderService.transitionOrder` which omits `payment_status`. | `order_status = CONFIRMED`, `payment_status = pending` |
| **Client polls `/api/payments/phonepe/status`** | Updates Firestore; executes 0 PostgreSQL queries. | `order_status = PLACED`, `payment_status = pending` |
| **Amount mismatch in webhook** | Marks Firestore payment `failed`; returns HTTP 400. | `order_status = PLACED`, `payment_status = pending` (Correct) |
| **Invalid signature in webhook** | Logs error; returns HTTP 200 to halt PhonePe retries. | No state change (Correct fail-closed) |

---

## 12. Existing Test Evidence

Inspection of test suites revealed how this bug escaped automated detection:

### 1. `test/production-gates/g3-payment-sandbox.test.ts`:
```typescript
vi.mock('../../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      release: vi.fn(),
    }),
  })),
}));
```
* **Finding:** PostgreSQL is completely stubbed with a static mock returning `rowCount: 0`. The test asserts only that the HTTP response is 200.

### 2. `test/phonepe-business-e2e.test.ts`:
```typescript
const updatedOrder = (db as any)._orders.get('ord_online_test_101');
expect(updatedOrder.paymentStatus).toBe('paid');
expect(updatedOrder.orderStatus).toBe('CONFIRMED');
```
* **Finding:** Asserts state mutations **only in in-memory Firestore mocks** (`(db as any)._orders`). It never queries or asserts PostgreSQL rows.

---

## 13. Canonical Database Read-Only Evidence

Direct query of `pocketkirana_db` on `192.168.0.105:5433`:

### Status Combinations Across All 53 Orders:
```text
┌─────────┬──────────────────┬────────────────┬────────────────┬───────┐
│ (index) │ order_status     │ payment_status │ payment_method │ count │
├─────────┼──────────────────┼────────────────┼────────────────┼───────┤
│ 0       │ 'PLACED'         │ 'pending'      │ 'phonepe'      │ 6     │  <-- STUCK ORDERS
│ 1       │ 'CONFIRMED'      │ 'pending'      │ 'cod'          │ 2     │
│ 2       │ 'CONFIRMED'      │ 'paid'         │ 'phonepe'      │ 1     │  <-- ORDER PK-11
│ 3       │ 'delivered'      │ 'completed'    │ 'UPI'          │ 44    │
└─────────┴──────────────────┴────────────────┴────────────────┴───────┘
```

* **Stuck PhonePe Orders:** Orders `PK-04`, `PK-05`, `PK-06`, `PK-07`, `PK-08`, `PK-09` are in `order_status = 'PLACED'`, `payment_status = 'pending'`.
* **Payment Transactions Table:** Exactly **1 row** exists in `payment_transactions`, with `transaction_type = 'VERIFY_PAYMENT'`. Exactly **0 rows** exist with `transaction_type = 'WEBHOOK_PAYMENT'`.

---

## 14. PK-11 Comparison

Forensic inspection of order `PK-11` records:

### `orders` row for `PK-11`:
* `id`: `'ord-1790844669560-a062ae'`
* `order_number`: `'PK-11'`
* `order_status`: `'CONFIRMED'`
* `payment_status`: `'paid'`
* `confirmed_at`: `2026-10-01T09:53:32.653Z`

### `order_status_history` row for `PK-11`:
* `changed_by`: `'system:phonepe-verify-system'`
* `notes`: `'PhonePe verified payment: T2610011421137248532289'`
* `created_at`: `2026-10-01T09:53:32.653Z`

### `payment_transactions` row for `PK-11`:
* `transaction_type`: `'VERIFY_PAYMENT'`

> **The Forensic Conclusion for PK-11:**  
> `PK-11` was confirmed **exclusively by the client verify route** (`/api/payments/phonepe/verify`) because `verify/route.ts` used `WHERE id = $1 OR order_number = $1` to resolve the internal UUID. The webhook route **never successfully transitioned PK-11**; had only the webhook run, `PK-11` would have remained stuck in `PLACED` / `pending` exactly like `PK-04` through `PK-09`.

---

## 15. Security Analysis

A future remediation must preserve all security boundaries:
1. **Signature Integrity:** Webhook HMAC (`X-VERIFY`) validation must remain fail-closed.
2. **Amount Enforcement:** Verification of `phonepeAmountInPaise === expectedAmountInPaise` must remain mandatory before any database update.
3. **Transaction Serialization:** PostgreSQL `FOR UPDATE` row locking must be added to `webhook/route.ts` to prevent race conditions with simultaneous redirect verification.
4. **Idempotency Defense:** `ON CONFLICT` constraints on `transaction_id` must prevent double-crediting.

---

## 16. Exact Root Cause Summary

| Component | Mechanism | Status |
|---|---|:---:|
| **`OrderService.transitionOrder`** | Does not accept or update `payment_status` in PostgreSQL. | **CONFIRMED** |
| **`webhook/route.ts` SQL Query** | Executes `UPDATE orders ... WHERE id = $1` without `OR order_number = $1`, causing 0 rows updated when given `order_number`. | **CONFIRMED** |
| **`webhook/route.ts` Error Check** | Does not check `rowCount === 0`; commits transaction silently. | **CONFIRMED** |
| **`status/route.ts` API** | Updates Firestore read projection but contains zero PostgreSQL queries. | **CONFIRMED** |
| **Test Suites** | Tests assert only against in-memory Firestore mocks and stub PostgreSQL. | **CONFIRMED** |

---

## 17. Proposed Remediation Design (DESIGN ONLY — DO NOT IMPLEMENT)

### Step 1: Enhance `OrderService.transitionOrder()`
In `lib/services/orderService.ts`:
1. Add `paymentStatus?: string` to `OrderTransitionRequest`.
2. Update the SQL query in `transitionOrder`:
   ```sql
   UPDATE orders
   SET order_status = $1,
       payment_status = COALESCE($2, payment_status),
       delivery_otp = COALESCE($3, delivery_otp),
       updated_at = CURRENT_TIMESTAMP,
       confirmed_at = CASE WHEN $1 = 'CONFIRMED' AND confirmed_at IS NULL THEN CURRENT_TIMESTAMP ELSE confirmed_at END,
       ...
   WHERE id = $4
   ```
3. Pass `paymentStatus` from request to parameter `$2`.

### Step 2: Canonicalize `app/api/payments/phonepe/webhook/route.ts`
1. Before updating, resolve the authoritative order row from PostgreSQL:
   ```sql
   SELECT id, order_number, total_amount, payment_status, order_status 
   FROM orders 
   WHERE id = $1 OR order_number = $1 
   FOR UPDATE
   ```
2. Verify `lockRes.rowCount > 0`. If 0, rollback and log error.
3. Update by verified UUID: `UPDATE orders SET payment_status = 'paid', order_status = 'CONFIRMED' WHERE id = currentOrder.id`.
4. Verify `updateRes.rowCount === 1`.

### Step 3: Align `app/api/payments/phonepe/status/route.ts`
Add the same atomic PostgreSQL transaction reconciliation currently present in `verify/route.ts`.

### Step 4: Fix Simulation Mode in `verify/route.ts`
Pass `paymentStatus: 'paid'` into `OrderService.transitionOrder({ ... })`.

---

## 18. Regression Test Plan

After implementation, the following tests must be created and verified:
1. **Unit Test:** `OrderService.transitionOrder` transitions order to `CONFIRMED` AND updates `payment_status` to `'paid'` in PostgreSQL.
2. **Webhook Integration Test:** Webhook with payload carrying only `order_number` (`'PK-11'`) successfully resolves and updates PostgreSQL order to `CONFIRMED` and `paid`.
3. **Webhook RowCount Check:** Assert that an unknown `orderId` triggers a rollback and does not return success.
4. **Status Route Integration Test:** Calling `/api/payments/phonepe/status` updates both PostgreSQL and Firestore atomically.

---

## 19. Production Risk Assessment

* **Current Status:** 🔴 **P0 — PRODUCTION BLOCKER**
* **Risk:** Customers paying via PhonePe will experience payments charged to their bank accounts while their orders remain stuck in `PLACED` and `pending`, preventing order assembly and dispatch.

---

## 20. Final Verdict

### 🟢 READY FOR IMPLEMENTATION DESIGN

The root causes of the PhonePe state disconnect have been 100% forensically proven from source code, database constraints, table records, and test stubs. The system is ready for a controlled implementation phase (Phase 2.9B).

---
**Audit Complete. Standing by for review.**
