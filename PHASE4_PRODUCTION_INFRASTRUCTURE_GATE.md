# POCKETKIRANA — PHASE 4 PRODUCTION INFRASTRUCTURE GATE CHECKLIST

**Gate Date:** Phase 4 Production Preparation Sign-Off  
**Gate Objective:** Complete verification of all deployment architecture, security isolation, process management, backup plans, and tunnel specifications.  

---

## 1. Production Readiness Checklist

| Domain | Item | Status | Verification Detail |
| :--- | :--- | :---: | :--- |
| **Compute & OS** | Oracle VPS Specification | 🟢 GREEN | Documented in `ORACLE_VPS_PRODUCTION_SETUP.md`. Ubuntu LTS, dedicated user `pocketkirana`, zero public web ports. |
| **Database** | PostgreSQL 16+ Architecture | 🟢 GREEN | Bound strictly to `127.0.0.1:5432`. Singleton pool bounded to 20 connections. Separated roles: `pk_app_user` (DML) & `pk_migrator` (DDL). |
| **Resilience** | Database Backup Strategy | 🟢 GREEN | Documented in `PRODUCTION_DISASTER_RECOVERY.md`. Daily compressed logical dumps + 7-day local / 30-day offsite retention. |
| **Disaster Recovery**| Restore Procedure | 🟢 GREEN | Tested `pg_restore` verification workflow documented. Decryption & integrity checks validated. |
| **Application Runtime**| Node.js 20 LTS Compatibility | 🟢 GREEN | Clean TypeScript compilation (`0 errors`), Next.js 15.1.3 App Router build passes. |
| **Process Management**| PM2 Configuration | 🟢 GREEN | `ecosystem.config.js` created. Cluster mode for Web/API, fork mode for Outbox worker, memory caps enforced. |
| **Asynchronous Engine**| Outbox Projection Worker | 🟢 GREEN | `scripts/run_outbox_worker.js` created. FOR UPDATE SKIP LOCKED leases, exponential backoff, DLQ, graceful SIGTERM shutdown. |
| **Origin Cloaking** | Cloudflare Tunnel Plan | 🟢 GREEN | `CLOUDFLARE_TUNNEL_PRODUCTION_PLAN.md` created. Origin connects to Cloudflare via outbound QUIC. Zero open inbound ports. |
| **Perimeter Security**| Cloudflare Access (Zero Trust)| 🟢 GREEN | Documented in `PRODUCTION_DEPLOYMENT_RUNBOOK.md`. `admin.pocketkirana.com` gated behind corporate email OTP/SSO + app RBAC. |
| **DNS Configuration** | Production DNS Mapping | 🟡 YELLOW | Target hostnames defined (`pocketkirana.com`, `admin.pocketkirana.com`, `api.pocketkirana.com`, `images.pocketkirana.com`). DNS switch held for Phase 5. |
| **Object Storage** | Cloudflare R2 Integration | 🟢 GREEN | `lib/r2.ts` native SigV4 client verified. S3 secrets isolated server-side. Custom domain `images.pocketkirana.com` configured. |
| **Secret Management** | Environment Matrix | 🟢 GREEN | Documented in `PRODUCTION_ENVIRONMENT_MATRIX.md`. Strict classification (PUBLIC vs SERVER_SECRET). Zero secrets in Git or APKs. |
| **Observability** | Health Probes | 🟢 GREEN | `/api/health` (Liveness) & `/api/health?deep=true` (Readiness: DB latency, saturation, outbox age, Firebase, R2). Zero credential leakage. |
| **Contingency** | Rollback Runbooks | 🟢 GREEN | Step-by-step rollback procedures documented for build, process, database, tunnel, and DNS layers. |
| **Code Stability** | Test Suite Baseline | 🟢 GREEN | **535 / 535 tests passing** (43 files, 0 regressions). |

---

## 2. Gate Verification Summary

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FINAL PHASE 4 GATE STATUS                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   🟡 PRODUCTION INFRASTRUCTURE PREPARED                                │
│   🔴 LIVE CUSTOMER TRAFFIC NOT ENABLED                                 │
│                                                                        │
│   - Application Codebase: Production Ready                             │
│   - Process & Outbox Management: Configured & Verified                 │
│   - Security & Network Isolation: Hardened (Zero Public Ports)         │
│   - Real Catalog Migration: HELD (Non-destructive)                     │
│   - Production DNS Switch: HELD for Phase 5 Cutover                    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```
