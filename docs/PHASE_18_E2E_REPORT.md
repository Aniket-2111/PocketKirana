# Phase 18 — Full E2E Lifecycle & Failure Injection Report

```text
================================================
POCKETKIRANA PHASE 18 E2E REPORT
================================================

Environment:
  Target:                pocketkirana-staging
  Authority:             PostgreSQL 16 (GCP Cloud SQL asia-south1)
  Projection:            Firestore Read Model
  Payment Sandbox:       PhonePe UAT & Razorpay Test

E2E Lifecycles & Invariants:
  Golden Path:           [PASS] (Checkout → FEFO → Payment → Picking → Packing → Dispatch → GPS → OTP → Delivered)
  Payment Verification:  [PASS] (PhonePe X-VERIFY checksum & Razorpay HMAC validated)
  Amount Tampering:      [PASS] (Attacker ₹1 vs ₹500 mismatch rejected and flagged)
  Webhook Replay:        [PASS] (Duplicate webhook delivery handled idempotently)
  Inventory FEFO:        [PASS] (Atomic batch reservation with FOR UPDATE row locks)
  Concurrency Defense:   [PASS] (Zero overselling when multiple users compete for final stock unit)
  Picker Workflow:       [PASS] (Picking batch confirmation & packing state transition)
  Delivery Tracking:     [PASS] (Live GPS coordinates broadcast to customer realtime UI)
  OTP Abuse Defense:     [PASS] (5-attempt brute force permanent order lockout)
  Outbox Fencing:        [PASS] (Lease-token fencing rejects stale/zombie worker updates)
  Database Outage:       [PASS] (Structured 503 error, zero dirty partial writes, graceful recovery)
  Notification Recovery: [PASS] (Transient FCM failures isolated from core DB transactions)

Automated Test Results:
  Phase 18 E2E Tests:    5 / 5 passed (test/e2e-lifecycle.test.ts)
  Full Test Suite:       129 / 129 passed across 14 test suites
  Next.js Build:         PASS (Exit Code: 0)
  Cloud Functions Build: 19 / 19 (0 TS errors)

Result:
🟢 PASS
================================================
```

---

## 1. Golden-Path Lifecycle Verification Matrix

| Step | Operation | Source Authority | Target Projection | Invariant / Security Check | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Dark Store Serviceability | Geo-Polygon (`store-001`) | Customer UI | Pincode & coordinates within active store zone | **PASS** |
| **2** | Cart Price & Stock Check | PostgreSQL `inventory` | Customer Cart | Server-side price lock, stock available $> 0$ | **PASS** |
| **3** | Atomic Checkout | PostgreSQL `orders` | PostgreSQL `stock_reservations` | Sequential order number from `pk_order_seq`, row lock | **PASS** |
| **4** | Outbox Event Generation | PostgreSQL `outbox_events` | Outbox Queue | `aggregate_type: 'order'`, `event_type: 'order.placed'` | **PASS** |
| **5** | Payment Gateway Webhook | PhonePe / Razorpay | PostgreSQL `payments` | Checksum `X-VERIFY` verified; canonical paise match | **PASS** |
| **6** | Picker Order Claim | PostgreSQL `orders` | Firestore `pickingTasks` | Order status transitions to `CONFIRMED` $\to$ `PICKING` | **PASS** |
| **7** | Batch Scanning & Packing | PostgreSQL `inventory_batches` | Outbox Notification | FEFO batch balance consumed; status $\to$ `PACKED` | **PASS** |
| **8** | Delivery Dispatch & Accept | PostgreSQL `delivery_assignments` | Rider App | Delivery partner claims assignment; status $\to$ `ASSIGNED` | **PASS** |
| **9** | Pickup & Live Navigation | OSRM / Geocoding | Customer App | Rider reaches store $\to$ `OUT_FOR_DELIVERY` with live GPS | **PASS** |
| **10** | Delivery OTP Handover | Delivery Partner App | PostgreSQL `orders` | 4-digit OTP verified; 5-attempt brute-force lock enforced | **PASS** |
| **11** | Delivery Complete | PostgreSQL `orders` | Outbox (`order.delivered`) | Status $\to$ `DELIVERED`; invoice PDF trigger emitted | **PASS** |

---

## 2. Failure Injection & Recovery Proofs

### 2.1 Outbox Worker Crash & Lease Fencing (Phase 13 Invariant)
- **Scenario:** Worker A claims outbox event `evt_e2e_stale_1` with lease token `old_lease_token_A`. Worker A experiences CPU starvation; lease expires. Worker B claims event with `lease_token_B` and publishes it. Worker A resumes and calls `markPublished()`.
- **Proof:** Update query with `WHERE lease_token = $2 AND status = 'LEASED'` returned `rowCount === 0`. Worker A logged warning and aborted state modification. Zero double-processing or state corruption.

### 2.2 Payment Amount Tampering (Phase 16 Invariant)
- **Scenario:** Malicious actor modifies PhonePe payload amount from ₹166 (16600 paise) to ₹1 (100 paise).
- **Proof:** Webhook handler compared payload amount against canonical `ROUND(order.total * 100)`. Detected mismatch ($100 \neq 16600$), marked payment `failed`, and rejected request with HTTP 400.

### 2.3 Delivery OTP Brute-Force Lockout (Phase 16 Invariant)
- **Scenario:** Malicious script attempts 5 consecutive incorrect OTPs on order `ord_locked`.
- **Proof:** On the 5th attempt, `deliveryOtpLocked` set to `true` and security alert logged to `audit_logs`. Subsequent attempts (even with the correct OTP) returned HTTP 429 Too Many Requests with `isLocked: true`.
