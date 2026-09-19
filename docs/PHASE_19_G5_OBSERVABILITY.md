# Phase 19 — Gate G5: Production Observability & Alerting Verification

## 1. Specification & Criteria
Gate G5 validates active telemetry capture across all 11 component domains (API, PostgreSQL, Outbox Worker, Payments, FCM, PM2, Cloud Functions, and Backups).

### 1.1 Alerting & Detection Verification
- **API Health Probes:** `GET /api/health` (liveness) & `GET /api/health?deep=true` (dependency readiness).
- **Outbox Backlog Alerting:** Stale events $>60\text{s}$ trigger `degraded` health status and emit alerts.
- **Connection Saturation:** PostgreSQL connection pool saturation $>80\%$ emits operational warning.
- **Structured Correlation IDs:** Trace IDs `pk_req_...` propagate across HTTP headers and structured JSON logs.
- **Automatic Sensitive Data Redaction:** Passwords, OTPs, salt keys, CVVs, and private keys scrubbed from all log streams.
