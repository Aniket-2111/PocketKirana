# Phase 20 — Emergency Rollback & Incident Recovery Runbook

## 1. Non-Destructive Operational Rollback Architecture
Under application anomalies or unexpected service degradation, rollback MUST NOT destroy database state or restore stale backups. The operational rollback strategy follows a controlled drain-and-pause pattern.

```text
STEP 1: ACTIVATE PILOT PAUSE KILL SWITCH
  Update config/pilot-limits.json: "killSwitchActive": true
  Effect: All incoming /api/checkout requests receive HTTP 503 "Pilot Temporarily Paused".
        │
        ▼
STEP 2: DRAIN & SETTLE ACTIVE IN-FLIGHT ORDERS
  Allow active orders in PICKING, PACKED, or OUT_FOR_DELIVERY to complete delivery.
  Delivery partners verify OTPs and record cash/UPI collections normally.
        │
        ▼
STEP 3: RUN DATA & INVENTORY RECONCILIATION
  Run node scripts/verify_payment_reconciliation.js
  Run SQL query to confirm stock_reservations consistency
        │
        ▼
STEP 4: ISOLATE ROOT CAUSE & DEPLOY HOTFIX
  Diagnose error telemetry via structured logs and correlation IDs.
  Apply fix, run automated test baseline (136+ tests), verify build.
        │
        ▼
STEP 5: CONTROLLED PILOT REOPENING
  Set "killSwitchActive": false in config/pilot-limits.json
  Resume order intake under Stage P1 limits.
```
