# PocketKirana — Phase 15: Production Observability & Health Monitoring

**Document Version:** 1.0.0  
**Effective Date:** 2026-09-19  
**Branch:** `phase-13-production-infrastructure`  
**Classification:** Internal Technical Architecture & Production Operations  

---

## 1. Observability Architecture Overview

The PocketKirana observability pipeline provides real-time telemetry, structured JSON logs, business metrics, and automated anomaly alerts across 11 core component domains.

```text
       [Customer / Picker / Delivery / Admin Clients]
                             │
                             ▼
                 [Cloudflare Edge & WAF]
                             │
                             ▼
                 [Next.js API & Web PWA]
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     [Structured Logs]   [Metrics]     [Health Probes]
     (JSON + Redaction) (Counters/p95) (Liveness/Readiness)
            │                │                │
            └────────────────┼────────────────┘
                             ▼
                 [Observability Platform]
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
   [PagerDuty / Slack Alerts]      [Operations Dashboard]
```

---

## 2. Telemetry & Monitoring Matrix Across 11 Domains

| Domain | Key Metrics | Health Check | Failure Threshold | Action / Escalation |
| :--- | :--- | :--- | :--- | :--- |
| **1. Next.js API** | `http_requests_total`, `p95_latency_ms`, `http_5xx_rate` | `GET /api/health` (Liveness) | 5xx $> 1\%$ for 5m, p95 $> 1500\text{ms}$ | Auto-scale pods; alert on-call engineer |
| **2. PostgreSQL 16** | `active_connections`, `pool_saturation_%`, `query_latency_ms`, `lock_waits` | `GET /api/health?deep=true` | Saturation $> 80\%$, query latency $> 2000\text{ms}$ | Scale pool size; investigate slow queries |
| **3. Outbox Worker** | `pending_events`, `oldest_event_age_sec`, `lease_lost_total`, `dead_lettered` | In-flight probe on `outbox_events` | Oldest pending $> 60\text{s}$, dead-lettered $> 0$ | Trigger worker restart; investigate unhandled payload |
| **4. Cloud Functions (19)** | `function_invocations`, `function_errors`, `execution_duration_ms` | `healthCheck` endpoint ping | Error rate $> 2\%$ for 5m | Cloud Logging alert; rollback if deployment issue |
| **5. Firebase & Firestore** | `firestore_read_latency`, `rule_denials`, `auth_failures` | Firebase SDK initialization check | Rule denials spike $> 100/\text{min}$ | Inspect token validity & client app versions |
| **6. FCM & Notifications** | `fcm_sent_total`, `fcm_failed_total`, `stale_tokens_cleaned` | Multicast result telemetry | Delivery failure $> 5\%$ | Check FCM credentials & quota |
| **7. PhonePe Gateway** | `phonepe_initiated`, `phonepe_success`, `phonepe_webhook_duplicates` | Webhook ingress telemetry | Success rate $< 90\%$ on checkout | Verify PhonePe merchant gateway status |
| **8. Razorpay Gateway** | `razorpay_orders_created`, `razorpay_signatures_valid` | Signature verification rate | Invalid signature $> 0$ | Security alert; verify webhook secret keys |
| **9. Cloudflare & Edge** | `edge_requests`, `waf_blocks`, `origin_5xx`, `ssl_handshakes` | Cloudflare Edge Health Checks | Origin error rate $> 2\%$ | Failover origin; inspect WAF false positives |
| **10. PM2 Process Manager**| `pm2_restarts`, `memory_usage_mb`, `cpu_%`, `event_loop_lag` | PM2 cluster status monitor | Restart count $> 3$ in 10m (Crash Loop) | Inspect memory leak or unhandled promise rejection |
| **11. Backup & DR Engine** | `latest_backup_age_hours`, `wal_archiving_lag_sec`, `pitr_status` | `scripts/verify_backup_status.js` | Snapshot age $> 24\text{h}$, WAL lag $> 5\text{m}$ | **Critical Alert**; execute immediate manual backup |

---

## 3. Request Tracing & Correlation IDs

Every inbound HTTP request to PocketKirana is stamped with a unique correlation identifier:
```text
x-correlation-id: pk_req_ln8w3f10_9b4a2e1c
```
- Generated at the API boundary via `extractCorrelationId()`.
- Propagated through Next.js route handlers, PostgreSQL query comments, Outbox event records, and FCM push data payloads.
- Enables single-request tracing across client, database, worker, and mobile app logs.

---

## 4. Sensitive Data Redaction Specification

The structured logger automatically scrubs all high-risk credentials prior to logging:
```json
{
  "level": "INFO",
  "service": "checkout",
  "event": "order_created",
  "correlationId": "pk_req_ln8w3f10_9b4a2e1c",
  "orderId": "PK-20260829-00125",
  "metadata": {
    "customerId": "usr_99812",
    "total": 450,
    "paymentMethod": "phonepe",
    "deliveryOtp": "[REDACTED]",
    "password": "[REDACTED]",
    "saltKey": "[REDACTED]"
  },
  "timestamp": "2026-09-19T11:15:00.000Z"
}
```
Scrubbed fields include: `password`, `salt`, `secret`, `token`, `otp`, `private_key`, `authorization`, `cookie`, `cvv`, `cardNumber`, `authkey`.

---

## 5. Operations Dashboard Specification

The unified monitoring dashboard groups real-time telemetry into 5 operational panels:
1. **Core Platform:** HTTP throughput (RPS), P95 latency (ms), 5xx error percentage, active PM2 instances.
2. **PostgreSQL & Database:** Active connections, connection pool saturation %, slow query count, replication lag.
3. **Outbox & Event Processing:** Pending event backlog, oldest pending age (s), lease loss events, dead-letter count.
4. **Order & Payments Lifecycle:** Checkout conversions, PhonePe vs Razorpay vs COD success rates, reconciliation exceptions.
5. **Backups & Reliability:** Latest snapshot timestamp, backup age (hours), WAL streaming lag (seconds).
