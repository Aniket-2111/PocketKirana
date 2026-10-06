# Phase 21 — Production Go-Live Operational Runbook

## 1. Timeline & Operational Execution Steps

```text
T - 120m: Pre-Flight Infrastructure Audit
  - Verify Cloud SQL instance pocketkirana-db-prod connection saturation (<20%)
  - Verify Cloudflare SSL/TLS 1.3 edge certificates
  - Run verify_g1_postgres.js, verify_g2_firebase.js, and verify_backup_status.js
  - Confirm On-Call SRE and Customer Support leads are logged in to comms
        │
        ▼
T - 30m: Health Probe Sanity
  - Query GET https://pocketkirana.com/api/health?deep=true
  - Expected: HTTP 200, status: "ok", all checks healthy
  - Confirm outbox queue pending count is 0
        │
        ▼
T - 0: Public Traffic Canary Enablement (Stage 1)
  - Enable Stage 1 in config/production-gate.json: "canaryPercentage": 10
  - Deploy edge configuration via PM2 reload
  - Monitor initial customer logins, cart additions, and first live checkout
        │
        ▼
T + 240m: Canary Promotion (Stage 2 → Stage 3)
  - Promote canaryPercentage to 50%, then 100% upon zero error thresholds
  - Verify realtime rider location broadcasts and 4-digit OTP delivery completions
        │
        ▼
T + 24h: Steady-State Operations Handover
  - Run daily payment and inventory reconciliation scripts
  - Transition to standard production monitoring & PagerDuty rotations
```
