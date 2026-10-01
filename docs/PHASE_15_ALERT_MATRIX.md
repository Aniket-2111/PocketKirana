# PocketKirana — Phase 15: Production Alert Matrix & Escalation SLA

**Document Version:** 1.0.0  
**Effective Date:** 2026-09-19  
**Classification:** Internal Operational Runbook  

---

## 1. Severity Levels & SLA Targets

| Severity | Definition | Response SLA | Resolution Target | Notification Channels |
| :--- | :--- | :--- | :--- | :--- |
| **P1 — Critical** | Complete service outage, database down, checkout blocked, stale backups $> 24\text{h}$ | **$< 5$ Minutes** | **$< 30$ Minutes** | PagerDuty Call + SMS + Slack `#war-room` |
| **P2 — High** | Outbox worker stalled, payment gateway failing, connection pool $> 80\%$, PM2 crash loop | **$< 15$ Minutes** | **$< 2$ Hours** | PagerDuty Push + Slack `#alerts-critical` |
| **P3 — Medium** | FCM notification failure $> 5\%$, elevated API latency (P95 $> 1500\text{ms}$), high memory usage | **$< 1$ Hour** | **$< 8$ Hours** | Slack `#alerts-ops` |
| **P4 — Low** | Minor telemetry drift, non-critical background task retry, minor catalog sync lag | **$< 4$ Hours** | **$< 24$ Hours** | Slack `#alerts-dev` |

---

## 2. Production Alert Trigger Matrix

| Alert Identifier | Severity | Trigger Condition | Auto-Mitigation Action | Primary On-Call |
| :--- | :---: | :--- | :--- | :--- |
| `API_LIVENESS_FAILED` | **P1** | `GET /api/health` returns non-200 or times out for 3 consecutive probes | Cloudflare origin failover + PM2 restart | Platform Lead |
| `POSTGRES_UNAVAILABLE` | **P1** | Database connection ping fails or returns fatal error | Trigger Cloud SQL HA failover | Database Operator |
| `BACKUP_SNAPSHOT_STALE` | **P1** | Latest snapshot age $> 24\text{ hours}$ in `verify_backup_status.js` | Trigger immediate automated backup snapshot | DevOps Engineer |
| `OUTBOX_WORKER_STALLED` | **P2** | `oldest_pending_age > 60s` or backlog $> 200$ events | Restart PM2 Outbox Worker daemon | Backend Lead |
| `OUTBOX_DEAD_LETTERED` | **P2** | Any outbox event reaches `DEAD_LETTERED` status ($5$ retries exhausted) | Log poison pill payload to DLQ investigation table | Backend Lead |
| `OUTBOX_LEASE_LOST_SPIKE`| **P2** | `lease_lost > 5` occurrences in $5\text{ minutes}$ | Inspect worker node CPU and database lock waits | Backend Lead |
| `PAYMENT_GATEWAY_FAILURE`| **P2** | Payment failure rate $> 10\%$ over $10\text{ consecutive}$ transactions | Auto-switch preferred gateway to fallback | Payment Operator |
| `PM2_CRASH_LOOP` | **P2** | Application instance restarts $> 3$ times in $10\text{ minutes}$ | Capture crash stack trace and alert on-call | Platform Lead |
| `DB_POOL_SATURATION` | **P2** | Active PostgreSQL connection pool saturation $> 80\%$ | Scale PgBouncer pool limits | Database Operator |
| `FCM_DISPATCH_FAILURE` | **P3** | FCM multicast failure rate $> 5\%$ for $> 10\text{ minutes}$ | Trigger stale token cleanup routine | Mobile Lead |
| `API_LATENCY_P95_HIGH` | **P3** | P95 latency $> 1500\text{ms}$ over a rolling $10\text{ minute}$ window | Inspect slow database queries and Cloudflare cache | Backend Lead |
| `CLOUD_FUNCTION_ERROR` | **P3** | Cloud Function invocation error rate $> 2\%$ | Inspect Cloud Function execution logs | Backend Lead |
