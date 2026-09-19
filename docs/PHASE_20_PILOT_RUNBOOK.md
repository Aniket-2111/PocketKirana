# Phase 20 — Pilot Operational Runbook

## 1. Monitoring Windows Execution Guide

```text
┌──────────────────────────────────────────────────────────────┐
│ WINDOW A: Pre-Opening Health & Inventory Audit (T - 60m)      │
│  - Execute GET /api/health?deep=true (DB, Outbox, Firebase)  │
│  - Verify dark store inventory batches & FEFO expiry dates   │
│  - Verify PhonePe & Razorpay production gateway heartbeats   │
│  - Verify Picker & Rider device registration & FCM tokens    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ WINDOW B: Active Pilot Live Operations (T to T + 8h)          │
│  - Live order tracking from Checkout → Picking → Delivery    │
│  - Monitor Outbox queue latency (stale events > 60s trigger) │
│  - Realtime rider GPS broadcast & telemetry streaming        │
│  - 4-digit OTP handover validation & payment confirmation     │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ WINDOW C: Post-Order & End-of-Day Reconciliation (T + 8h)    │
│  - Run node scripts/verify_payment_reconciliation.js         │
│  - Run node scripts/verify_backup_status.js                  │
│  - Audit zero negative stock in inventory_balances           │
│  - Compile SLA metrics & order lifecycle durations           │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Emergency Kill-Switch Activation Procedure
If any critical discrepancy or failure trigger occurs:
1. Update `config/pilot-limits.json` $\to$ set `"killSwitchActive": true`.
2. The checkout route immediately rejects new order attempts with HTTP 503 (`PILOT_TEMPORARILY_PAUSED`).
3. In-flight orders currently in `PICKING` or `OUT_FOR_DELIVERY` are allowed to complete delivery and settle payments.
4. Execute payment and inventory reconciliation scripts.
