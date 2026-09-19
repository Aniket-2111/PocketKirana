# Phase 19 — Gate G3: Payment Sandbox Verification

## 1. Specification & Criteria
Gate G3 validates sandbox integrations for PhonePe (UAT) and Razorpay (Test) payment gateways.

### 1.1 PhonePe Sandbox Integration
- **Endpoint:** UAT Sandbox (`https://api-preprod.phonepe.com/apis/pg-sandbox`)
- **Checksum Invariant:** `X-VERIFY: SHA256(payload + saltKey) + "###" + saltIndex`
- **Reconciliation:** Payloads compared against PostgreSQL canonical `order.total * 100` paise.
- **Idempotency:** Webhook duplicate deliveries ACKed with 200 without creating duplicate ledger rows.

### 1.2 Razorpay Sandbox Integration
- **HMAC Signature Invariant:** `HMAC-SHA256(order_id + "|" + payment_id, key_secret)`
- **Amount Verification:** Client-supplied payment amount is never trusted; canonical PostgreSQL order total is verified.
