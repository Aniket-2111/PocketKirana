# POCKETKIRANA — PRODUCTION HEALTH CHECK & OBSERVABILITY PLAN

**Endpoint:** `/api/health`  
**Security Policy:** Fail-closed, zero secret leakage, zero hostname exposure, zero database credential disclosure.  
**Consumers:** Cloudflare Health Checks, PM2 Monitoring, Uptime Kuma / Datadog probes, Kubernetes / Docker readiness probes.  

---

## 1. Probe Specifications

### A. Fast Liveness Probe (`GET /api/health`)
- **Purpose:** Verifies that the Node.js event loop is responsive and Next.js is serving traffic.
- **Latency Target:** $< 5$ ms.
- **Database Dependency:** None (Shields PostgreSQL from probe overhead).
- **HTTP Status:** `200 OK`.
- **Response Payload:**
  ```json
  {
    "status": "ok",
    "service": "pocketkirana-api",
    "version": "1.0.0",
    "timestamp": "2026-09-27T18:00:00.000Z"
  }
  ```

---

### B. Deep Readiness Probe (`GET /api/health?deep=true`)
- **Purpose:** Comprehensive dependency validation before routing customer traffic or during automated canary deploys.
- **Latency Target:** $< 50$ ms.
- **HTTP Status:**
  - `200 OK`: All critical systems healthy or operating normally.
  - `503 Service Unavailable`: Critical system failure (e.g. PostgreSQL offline).
- **Response Payload:**
  ```json
  {
    "status": "ok",
    "service": "pocketkirana-api",
    "version": "1.0.0",
    "timestamp": "2026-09-27T18:00:00.000Z",
    "totalDurationMs": 14,
    "checks": {
      "database": {
        "status": "ok",
        "latencyMs": 3,
        "poolSaturationPercent": 0
      },
      "outbox": {
        "status": "ok",
        "pendingEventsCount": 2,
        "oldestPendingAgeSeconds": 4
      },
      "firebase": {
        "status": "ok"
      },
      "r2": {
        "status": "ok"
      }
    }
  }
  ```

---

## 2. Component Health Evaluation Matrix

| Component | Check Logic | Warning / Degraded Threshold | Failure Threshold | Action Triggered |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Pool** | Ping query `SELECT 1` via singleton pool | Latency $> 2000$ ms OR Saturation $> 80\%$ | Query times out (5000 ms) or throws `ECONNREFUSED` | Returns 503; triggers database alert |
| **Outbox Backlog** | `SELECT COUNT(*)` where status in `PENDING` | Backlog $> 100$ events | Oldest pending event age $> 60$ seconds | PM2 alert; investigates worker status |
| **Firebase Admin** | Credential validation in memory | Not configured in dev | Missing credentials in production (`NODE_ENV=production`) | Degraded status alert |
| **Cloudflare R2** | `isR2Configured()` checks secret availability | Missing in local dev | Missing in production environment | Image uploads fallback to error state |

---

## 3. Strict Security & Information Disclosure Guards

1. **Zero Credential Disclosure:**
   Passwords, hostnames (`127.0.0.1`, DB names), API tokens, and secret keys are **never** included in health check outputs.
2. **Zero Stack Trace Leaks:**
   Errors are caught internally and categorized into sanitized statuses (`ok`, `degraded`, `unavailable`) without exposing raw SQL errors or filesystem paths.
3. **Cache Invalidation:**
   Headers enforce: `Cache-Control: no-cache, no-store, must-revalidate` so proxies never return stale health indicators.
4. **Correlation Tracing:**
   Requests return an `x-correlation-id` header allowing telemetry log correlation in production logs without disclosing internal runtime context.
