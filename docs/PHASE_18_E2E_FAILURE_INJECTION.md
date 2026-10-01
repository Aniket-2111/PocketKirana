# Phase 18 — Full E2E Lifecycle & Failure Injection Specification

## 1. Objective
To validate the full end-to-end lifecycle of PocketKirana as a unified, cohesive system under both golden-path conditions and active failure injections (database outages, worker crashes, network partitions, payment tampering, and concurrency races).

---

## 2. End-to-End Golden Path Workflow

```text
Customer (PWA/Web)
       │
       ▼
1. Serviceability Check (Dark store geofence)
       │
       ▼
2. Cart & Price Quote (Server-side price locks)
       │
       ▼
3. Atomic Checkout & FEFO Reservation (PostgreSQL FOR UPDATE row locks)
       │
       ▼
4. Outbox Event Appended (order.created)
       │
       ▼
5. PhonePe / Razorpay Webhook (SHA256 / HMAC verified)
       │
       ▼
6. Order Status → CONFIRMED & Picker Auto-Assigned
       │
       ▼
7. Picker Claims & Scans FEFO Batch (Status → PICKING → PACKED)
       │
       ▼
8. Rider Dispatched & Accepts (Status → ASSIGNED → ARRIVED_AT_STORE)
       │
       ▼
9. Rider Scans / Confirms Pickup (Status → OUT_FOR_DELIVERY)
       │
       ▼
10. Live GPS Navigation & Customer Realtime Tracking
       │
       ▼
11. Delivery OTP Verification (4-digit code with 5-attempt brute force lock)
       │
       ▼
12. Final Delivery Confirmation (Status → DELIVERED)
       │
       ▼
13. Outbox Event Published → Invoice PDF Generated & Push Notification Sent
```

---

## 3. Failure Injection Scenarios & Cryptographic Invariants

### 3.1 Database Outage & Recovery
- **Injection:** PostgreSQL pool connectivity severed during checkout or state transitions.
- **Expected Invariant:** Fail-closed with structured HTTP 503 response. Zero dirty partial writes in PostgreSQL; automatic reconnection on pool recovery.

### 3.2 Outbox Worker Crash & Lease-Token Fencing
- **Injection:** Worker A claims outbox event with `lease_token = token_A`, simulates a processing stall causing lease expiration. Worker B reclaims event with `lease_token = token_B` and completes publication. Worker A resumes and attempts to mark the event published.
- **Expected Invariant:** Worker A update fails (`rowCount === 0`) due to SQL fence `WHERE lease_token = $2 AND status = 'LEASED'`. Zero double processing or corrupt state overwrites.

### 3.3 Inventory Concurrency & Overselling Protection
- **Injection:** 20 concurrent customers attempt to purchase the single remaining stock unit ($N=1$).
- **Expected Invariant:** Exactly 1 reservation succeeds; 19 transactions safely aborted (`INSUFFICIENT_STOCK`). Physical and available inventory balances never drop below 0.

### 3.4 Payment Webhook Tampering & Replay
- **Injection:** Gateway callback delivers tampered amount (₹1 instead of ₹500) or sends duplicate webhooks.
- **Expected Invariant:** Amount mismatch rejected and flagged; duplicate webhooks handled idempotently with 200 ACK and zero duplicate ledger entries.

### 3.5 Delivery OTP Brute-Force Abuse
- **Injection:** Automated script sends 5 consecutive incorrect OTPs to `/api/delivery/orders/[id]/verify-otp`.
- **Expected Invariant:** 5th attempt locks the order permanently (`deliveryOtpLocked = true`, HTTP 429). Subsequent valid OTP is rejected until admin override.
