# Phase 21 — Production Emergency Rollback & Incident Runbook

## 1. Hard-Stop Incident Triggers
Immediately trigger the emergency pause circuit breaker if any of the following occur:
1. Double payment charged to customer or payment amount mismatch $> ₹0.00$.
2. Negative inventory quantity in `inventory` or `inventory_balances`.
3. Outbox worker backlog age exceeds $60\text{s}$ SLA with lease fencing failures.
4. API 5xx error rate exceeds $1.0\%$ over a 5-minute rolling window.
5. Unauthorized customer data access / IDOR detection.

## 2. Fast Non-Destructive Circuit Breaker
```bash
# 1. Engage kill switch in production gate configuration
# Set "killSwitchActive": true in config/production-gate.json
# All new checkout attempts will receive HTTP 503 "Service Temporarily Paused"

# 2. Allow active orders to safely finish picking and delivery
# 3. Execute financial reconciliation
node scripts/verify_payment_reconciliation.js

# 4. Investigate logs via Correlation IDs
# 5. Hotfix, test (140+ tests), and resume
```
