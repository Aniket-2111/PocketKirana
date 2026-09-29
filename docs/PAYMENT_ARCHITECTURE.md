# PocketKirana — Payment Architecture & Reconciliation

## 1. Overview & Core Security Principles

PocketKirana supports two payment channels:
1. **Online Prepayment via PhonePe**: UPI, credit/debit cards, NetBanking, and PhonePe wallet.
2. **Cash on Delivery (COD)**: Partner collects cash at delivery and confirms via OTP/app verification.

### Core Security Invariants & Invariant Tuple
1. **Never Trust Client Amounts**: The PhonePe payment initiation route reads the authoritative order total directly from the PostgreSQL `orders` table. Frontend price parameters are completely ignored.
2. **SHA-256 Webhook Verification**: Every incoming webhook must have a valid `X-VERIFY` header matching `SHA256(base64Payload + saltKey) + "###" + saltIndex`.
3. **The 5-Field Payment Invariant Tuple**:
   A transaction is NEVER accepted simply because `transaction_id = valid`. Every callback and verification must strictly enforce matching on all five tuple components:
   ```text
   PhonePe transaction ID
           +
   merchant/order ID
           +
   authoritative amount
           +
   currency (INR)
           +
   payment status ('PAYMENT_SUCCESS' / 'completed')
   ```
   If any component fails (e.g. amount mismatch, wrong merchant transaction ID, non-success status, or unsupported currency), the transaction is immediately rejected and recorded in `audit_logs`.
4. **Payment Deduplication**: Webhooks and verify endpoints insert records into `payment_transactions` with `ON CONFLICT (transaction_id) DO NOTHING`. Duplicate deliveries or webhooks never result in duplicate orders or picking tasks.

---

## 2. PhonePe Payment Flow & Atomic Callback Pipeline

```
[Customer Browser / APK]
         │
         │ 1. POST /api/payments/phonepe/create { orderId }
         ▼
[Next.js Server API]
         │
         ├──► 2. Read PostgreSQL `orders` FOR UPDATE (verify ownership & amount)
         ├──► 3. Insert `payments` row (status: 'pending')
         ├──► 4. Call PhonePe /pg/v1/pay with server-calculated amount
         ▼
[Customer Redirected to PhonePe Gateway]
         │
         │ (Customer completes payment)
         ▼
[PhonePe Gateway]
         │
         ├───► A. Webhook: POST /api/payments/phonepe/webhook
         │       └── [Atomic PostgreSQL Verification Pipeline]
         │
         └───► B. Client Redirect: /checkout/success
                 └── POST /api/payments/phonepe/verify (Idempotent backup check)
```

### Atomic Webhook Verification Pipeline:
```text
verify signature (X-VERIFY checksum)
      ↓
identify order & payment from merchantTransactionId
      ↓
lock payment and order row in PostgreSQL (FOR UPDATE)
      ↓
verify merchant/order mapping (prevent cross-order replay)
      ↓
verify amount (paise received === authoritative order total * 100)
      ↓
verify currency ('INR') & status ('PAYMENT_SUCCESS')
      ↓
idempotency check (payment_transactions where transaction_id = $1)
      ↓
update payments table (status: 'completed', gateway_payment_id, paid_at)
      ↓
transition order to 'CONFIRMED' via OrderService
      ↓
append outbox event ('payment.confirmed')
      ↓
COMMIT transaction
```

---

## 3. Webhook Idempotency & Concurrency

When PhonePe delivers retried or concurrent webhooks:
1. PostgreSQL checks `SELECT id FROM payment_transactions WHERE transaction_id = $1`.
2. If row exists, the webhook responds with HTTP 200 `{ success: true, message: 'Payment already processed' }` immediately without creating duplicate tasks.
3. Order transitions are wrapped in PostgreSQL transactions with row locks, preventing race conditions between webhook execution and client redirect verification.
