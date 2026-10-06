# POCKETKIRANA — PHASE 4 INFRASTRUCTURE & ARCHITECTURE AUDIT

**Audit Date:** Phase 4 Production Preparation  
**Target Environment:** Oracle Cloud Infrastructure (OCI) Compute VPS + Cloudflare Enterprise CDN / Zero Trust  
**Application Tier:** Next.js 15.1.3 App Router (Node.js 20 LTS Server Runtime)  
**Database Tier:** PostgreSQL 16+ (Localhost / Dedicated Private Interface)  
**Asynchronous Tier:** Transactional Outbox Projection Worker (PM2 Fork Process)  
**Object Storage:** Cloudflare R2 (`pocketkirana-catalog-images`)  

---

## 1. Application Runtime Requirements

| Component | Repository Specification | Production Requirement |
| :--- | :--- | :--- |
| **Framework** | Next.js `^15.1.3` (App Router) | Standalone Node.js server execution (`next start -p 3000` or custom server) |
| **Language Runtime** | Node.js (Compatible with v20.x LTS / v22.x) | Node.js 20.x LTS (`Active LTS` on Ubuntu 22.04/24.04 LTS) |
| **Package Manager** | npm `10.x` | npm with clean dependency installs (`npm ci --omit=dev` for production) |
| **UI Framework** | React `^19.0.0` / React DOM `^19.0.0` | Server-side rendering (SSR) + Client Hydration |
| **Styling Engine** | Tailwind CSS `^3.4.17` + PostCSS | Pre-compiled static CSS chunks at build time |
| **State Management**| Zustand `^5.0.2` | Browser client state + session storage persistence |

---

## 2. Database Tier Requirements

| Dimension | Production Specification | Security & Operational Policy |
| :--- | :--- | :--- |
| **Engine** | PostgreSQL 16+ | Native Linux install or hardened container on Oracle VPS |
| **Network Binding** | `127.0.0.1:5432` / Private Interface | **STRICTLY FORBIDDEN from public Internet exposure** |
| **Application User** | `pk_app_user` | Strict DML permissions (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on tables & sequences |
| **Migration User** | `pk_migrator` | DDL permissions (`CREATE`, `ALTER`, `INDEX`) used solely during migrations |
| **Connection Pooling**| Singleton PG Pool (`lib/postgres.ts`) | `PG_MAX_POOL_SIZE = 20`, 5s connection timeout, 4s statement timeout |
| **Transactions** | `withTransaction` pattern | Connection returned to pool via `try/finally` before HTTP response |
| **Read Protection** | 30s Negative Cache (`_pkProductNegativeCache`) | Bounded to 1,000 entries; shields PostgreSQL from fake ID floods |

---

## 3. Background / Outbox Worker Requirements

| Dimension | Details |
| :--- | :--- |
| **Pattern** | Transactional Outbox Pattern (`outbox_events` table in PostgreSQL) |
| **Process Management**| Dedicated PM2 fork process: `node scripts/run_outbox_worker.js` (`pocketkirana-outbox-worker`) |
| **Concurrency Guard**| Concurrency-safe leases via `FOR UPDATE SKIP LOCKED` |
| **Backoff & DLQ** | Exponential backoff ($5 \times 2^{\text{retry\_count}}$ seconds), dead-letters poison pills after 5 retries |
| **Memory Limit** | Capped at 450 MB via PM2 `max_memory_restart` |
| **Graceful Shutdown**| Catches `SIGINT` / `SIGTERM`, drains in-flight event processing before closing DB pool |

---

## 4. External Services & Third-Party Integrations

1. **Cloudflare R2 Object Storage:**
   - S3-compatible S3 SigV4 client in `lib/r2.ts`.
   - Used for product, category, brand, and promotional images.
   - Endpoint: `https://images.pocketkirana.com/`.
   - Credentials strictly server-side (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).
2. **Firebase Admin SDK (v14.4.0):**
   - Push notifications (FCM) to Customer, Delivery, and Picker Android APKs.
   - Server-side auth token verification.
   - Initialized via `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`.
3. **PhonePe Business Payment Gateway:**
   - Server-to-server payment order creation (`/api/payments/phonepe/create`).
   - Webhook callback verification (`/api/payments/phonepe/webhook`) with SHA-256 `X-VERIFY` signature check and amount reconciliation.
   - Credentials: `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_SALT_INDEX`.
4. **MSG91 SendOTP SMS Gateway:**
   - Customer OTP verification.
   - Client widget ID (`NEXT_PUBLIC_MSG91_WIDGET_ID`) and Server auth key (`MSG91_AUTHKEY`).

---

## 5. Filesystem, PDF & Excel Processing

| Capability | Module | Filesystem Impact | Production Constraint |
| :--- | :--- | :--- | :--- |
| **Invoice PDF Generation** | `jspdf` `^4.2.1` + `jspdf-autotable` `^5.0.8` | In-memory `Buffer` streaming via HTTP response | No persistent disk writes; zero disk exhaustion risk. |
| **Catalog Excel Import/Export** | `xlsx` `^0.18.5` | In-memory `Buffer` parsing | Streamed via memory buffer; size capped at 10 MB. |
| **Local Uploads** | Legacy fallback | `public/uploads` (deprecated) | Replaced by Cloudflare R2 S3 streaming. |
| **Static Build Output** | Next.js output tracing | `.next/` directory | Requires ~500 MB disk space during build. |

---

## 6. Required Network Ports & Bindings

| Port | Service | Allowed Network Interface | Exposure Policy |
| :---: | :--- | :--- | :--- |
| **3000** | Next.js Web & API Server | `127.0.0.1` (Localhost) | **INTERNAL ONLY** (Reached solely via Cloudflare Tunnel) |
| **5432** | PostgreSQL Database | `127.0.0.1` (Localhost) | **STRICTLY BLOCKED** from public Internet |
| **22** | SSH Administration | Public (Hardened with Key-Only Auth + Fail2ban) | Optional: Limit to admin source IP / Cloudflare Access SSH |
| **N/A** | Cloudflare Tunnel | Outbound HTTPS (Port 443) to Cloudflare Edge | **Zero inbound firewall holes required** |

---

## 7. Startup & Management Commands

- **Production Build:**
  ```bash
  npm run build
  ```
- **PM2 Service Startup:**
  ```bash
  pm2 start ecosystem.config.js --env production
  pm2 save
  pm2 startup
  ```
- **Cloudflare Tunnel Daemon:**
  ```bash
  sudo systemctl enable --now cloudflared
  ```

---

## 8. Health Check Endpoints

- **Fast Liveness Probe:**
  ```text
  GET http://127.0.0.1:3000/api/health
  Response: 200 OK {"status":"ok","service":"pocketkirana-api"}
  ```
- **Deep Readiness Probe:**
  ```text
  GET http://127.0.0.1:3000/api/health?deep=true
  Response: 200 OK (or 503 if DB unavailable)
  Evaluates: Database latency, Pool saturation, Outbox backlog, Firebase, R2
  Zero secret disclosure.
  ```

---

## 9. Production Risk Analysis & Mitigations

| Risk | Impact | Mitigation Established |
| :--- | :--- | :--- |
| **PostgreSQL Port Exposure** | Database brute force / data leakage | Bind `127.0.0.1` only. UFW denies all inbound to 5432. |
| **Public Application Port (3000) Exposure**| Direct DDoS bypassing Cloudflare WAF | Node.js listens on `127.0.0.1:3000`. Cloudflare Tunnel terminates SSL and forwards locally. |
| **Outbox Lease Stalling** | Notification delays | Worker leases auto-expire after 30s. Other worker cycles pick up stalled events. |
| **Memory Leaks in SSR** | Node.js OOM crashes | PM2 cluster mode with `max_memory_restart: 900M` performs zero-downtime rolling restart. |
| **Poison Pill Events** | Infinite retry loop | Outbox events dead-letter to `DEAD_LETTERED` after 5 failed attempts. |
