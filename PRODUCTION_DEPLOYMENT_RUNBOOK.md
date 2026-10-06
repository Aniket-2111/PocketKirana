# POCKETKIRANA — PRODUCTION DEPLOYMENT RUNBOOK

**Target Host:** Oracle Cloud Infrastructure (OCI) Ubuntu VPS  
**Security Architecture:** Cloudflare Enterprise Edge + Cloudflare Access + Cloudflare Tunnel + Origin Cloaking  
**Protocol:** Strictly Ordered, Non-Destructive, Resumable Deployment  

---

## 1. Domain & Routing Topology Architecture

| Hostname | Edge Layer | Origin Routing | Access / Security Layer |
| :--- | :--- | :--- | :--- |
| **`pocketkirana.com`** | Cloudflare CDN | Cloudflare Pages / Workers or VPS Origin | Public customer web access; WAF & Rate Limiting |
| **`admin.pocketkirana.com`** | Cloudflare Access (Zero Trust) | `http://127.0.0.1:3000/admin` | OTP/SSO Email Authentication + App RBAC (`requireRole`) |
| **`api.pocketkirana.com`** | Cloudflare Edge | `http://127.0.0.1:3000` via Cloudflare Tunnel | Public API for Web & Mobile APKs; DDoS & WAF |
| **`images.pocketkirana.com`**| Cloudflare CDN Edge | Cloudflare R2 Bucket `pocketkirana-catalog-images` | 1-Year Immutable Caching (`max-age=31536000`) |

---

## 2. Cloudflare Access (Zero Trust) Policy for Admin

**Target:** `admin.pocketkirana.com`

1. **Access Application Type:** Self-hosted Web Application.
2. **Domain:** `admin.pocketkirana.com`
3. **Identity Providers:** One-Time Pin (OTP) via Corporate Email or Google Workspace OAuth.
4. **Access Policy:**
   - Action: `Allow`
   - Rules: `Include` $\rightarrow$ `Emails ending in @pocketkirana.com` (or authorized admin emails).
5. **Session Duration:** 24 hours.
6. **Defense in Depth Guarantee:**
   Cloudflare Access acts as an outer perimeter gate. The internal application-level RBAC (`requireRole(['admin', 'store_manager'])`) remains 100% active and enforced on every API route.

---

## 3. Ordered 21-Step Production Deployment Sequence

```text
 1. Oracle VM Provisioning (OCI Ampere A1 or AMD Compute)
    ↓
 2. Operating System Update (apt update && apt upgrade)
    ↓
 3. SSH Hardening (Disable root login, password auth disabled, key-only)
    ↓
 4. Firewall Configuration (UFW: deny all incoming except port 22)
    ↓
 5. Node.js 20 LTS Installation (NodeSource 20.x repo)
    ↓
 6. PostgreSQL 16+ Installation & Localhost Hardening (listen_addresses = '127.0.0.1')
    ↓
 7. Database Roles Separation (pk_migrator for DDL, pk_app_user for DML)
    ↓
 8. Automated Database Backup Setup (pg_dump daily cron to offsite vault)
    ↓
 9. Application Code Checkout (/home/pocketkirana/app from Git)
    ↓
10. Production Environment Secrets Configuration (.env.production chmod 600)
    ↓
11. Dependency Installation (npm ci --omit=dev)
    ↓
12. Next.js Production Build (NODE_ENV=production npm run build)
    ↓
13. PM2 Process Initialization (Next.js cluster mode via ecosystem.config.js)
    ↓
14. Outbox Worker Process Startup (pocketkirana-outbox-worker via PM2)
    ↓
15. Cloudflared Tunnel Installation (cloudflared systemd service to 127.0.0.1:3000)
    ↓
16. Health Check Probing (curl http://127.0.0.1:3000/api/health?deep=true)
    ↓
17. Cloudflare DNS Route Assignment (api.pocketkirana.com -> Cloudflare Tunnel)
    ↓
18. Cloudflare Access Policy Activation (admin.pocketkirana.com zero-trust gate)
    ↓
19. Cloudflare R2 Custom Domain Binding (images.pocketkirana.com)
    ↓
20. Staging Smoke Testing (Web, API, Mobile APK authentication, test order)
    ↓
21. Production Readiness Verification Gate (Final sign-off before public launch)
```

---

## 4. Rollback Runbook

| Failure Point | Rollback Action |
| :--- | :--- |
| **Build Fails on VPS** | Revert to last stable commit tag: `git checkout tags/v1.0.0-stable`, re-run `npm ci && npm run build`. |
| **PM2 Process Crashes** | Inspect PM2 logs: `pm2 logs pocketkirana-web --lines 100`. Verify `.env.production` syntax and DB connectivity. |
| **Database Migration Error** | Restore from pre-migration snapshot: `pg_restore -d pocketkirana_db backup_pre_mig.sql.gz`. |
| **Cloudflare Tunnel Drops** | Restart systemd service: `sudo systemctl restart cloudflared`. Check `/etc/cloudflared/config.yml`. |
| **Outbox Worker Contention**| Ensure only 1 worker instance is running: `pm2 scale pocketkirana-outbox-worker 1`. |
| **Traffic Rollback** | In Cloudflare DNS, switch CNAME pointer to maintenance worker or previous origin. |
