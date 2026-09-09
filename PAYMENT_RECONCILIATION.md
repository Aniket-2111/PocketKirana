# PocketKirana — Payment Reconciliation Architecture & Runbook
**Purpose:** End-to-end financial settlement and mismatch detection for PhonePe, Razorpay, and COD transactions.

---

## 1. Reconciliation Lifecycle

```text
Payment Initiated (Client)
        │
        ▼
Gateway Execution (PhonePe / Razorpay / COD)
        │
        ▼
Server-to-Server Callback (app/api/payments/phonepe/webhook)
        │
        ▼
Internal Payment Record (payments & payment_transactions)
        │
        ▼
Order Confirmation (orders.payment_status = 'paid')
        │
        ▼
Daily Settlement & Mismatch Audit (Admin Payment Reconciliation Center)
```

---

## 2. Daily Mismatch Detection Matrix

| Condition | Diagnostic Meaning | Automated System Action | Operator Resolution |
| :--- | :--- | :--- | :--- |
| **Gateway = SUCCESS, Order = PENDING** | Webhook dropped or delayed | Polling cron queries `/api/payments/phonepe/verify` | Force confirm order or auto-initiate refund if order was cancelled |
| **Gateway = SUCCESS, Amount Mismatch** | Tampered client transaction | Flagged as `CRITICAL_MISMATCH` in `audit_logs` | Hold fulfillment; investigate transaction ID |
| **COD Delivered, Cash Uncollected** | Rider delivery error | Delivery OTP verified but `cashReceived = 0` | Flag rider wallet balance for deduction |
| **Customer Cancelled, Refund Pending** | Stalled gateway refund | Refund record status `initiated` in `refunds` | Re-trigger PG refund API via Admin Console |

---

## 3. Database Reconciliation Schema
* `payments`: Authoritative internal payment log.
* `payment_transactions`: Raw gateway payload snapshots for cryptographic auditing.
* `refunds`: Gateway refund IDs, timestamps, and reason codes.
