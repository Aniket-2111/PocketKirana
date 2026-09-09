# PocketKirana — Phase 2 Production Verification Checklist
**Target Release:** PocketKirana v1.1.0  
**Status:** Pre-Pilot Operational Verification  

---

## 1. Complete Order Lifecycle Verification Matrix (12 Real Scenarios)

| Test ID | Scenario Description | Expected Outcome | Execution Status |
| :---: | :--- | :--- | :---: |
| **TC-01** | Cash on Delivery (COD) Order | Stock reserved -> FEFO picking -> QR Handover -> Delivery OTP -> Cash marked received | 🟢 READY |
| **TC-02** | PhonePe Standard Checkout / UPI | SHA-256 Checksum generated -> Redirect -> Webhook marks order `CONFIRMED` -> Dispatched | 🟢 READY |
| **TC-03** | Razorpay Payment Gateway | Razorpay Order ID created -> Client signature verified via HMAC SHA256 -> `CONFIRMED` | 🟢 READY |
| **TC-04** | Payment Failure Handling | Payment marked `PAYMENT_FAILED` -> Reserved stock returned to available inventory | 🟢 READY |
| **TC-05** | Customer Order Cancellation | Order in `CONFIRMED` stage cancelled -> Immediate stock unlock -> Audit log written | 🟢 READY |
| **TC-06** | Out-of-Stock Item in Pick Walk | Picker marks SKU out-of-stock -> Customer notified -> Order adjusted or refunded | 🟢 READY |
| **TC-07** | Expired Batch Exclusion (FEFO) | Batch with `expiry_date < TODAY` skipped automatically by `lib/fefo.ts` | 🟢 READY |
| **TC-08** | Barcode Mismatch Scan | Scanner beeps error tone (`lib/audioAlerts.ts`) -> Blocks pick until correct barcode scanned | 🟢 READY |
| **TC-09** | Delivery Rider Offline / Capacity | Order routed to next available rider; max 2 concurrent orders per rider enforced | 🟢 READY |
| **TC-10** | Picker Offline Failover | Unassigned tasks trigger SLA escalation alert on Admin Dispatch Control View | 🟢 READY |
| **TC-11** | Network Disconnect during Pick Walk | Local Zustand state queues scanned barcodes -> Flushes upon reconnection | 🟢 READY |
| **TC-12** | Browser Tab Close during Checkout | Idempotency token prevents duplicate order creation if payment callback arrives | 🟢 READY |

---

## 2. Infrastructure & Subsystem Verification Gate

```text
[X] Database Schema: 38 tables verified via scripts/audit_postgres_schema.js
[X] Database Transactions: Deadlock retry & rollback verified via lib/postgres.ts
[X] Database Backup & Recovery: Snapshot verified via scripts/test_backup_restore.js
[X] Edge Security: RBAC route gating (/admin, /picker, /delivery) verified in middleware.ts
[X] CSRF Protection: State mutations verified in middleware.ts
[X] Pricing Engine: Tiered coupons (POCKETSAVER) & 5% GST verified in lib/pricingEngine.ts
[X] Real-Time Sync: Firestore order & GPS tracking verified in lib/firebaseServices.ts
[X] Process Supervision: PM2 clustering verified in ecosystem.config.js
```
