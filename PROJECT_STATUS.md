# Pocket Kirana — Project Status & Release Governance

> **🟢 CUSTOMER UI/UX — FROZEN 🔒**  
> **🟢 CORE CHECKOUT INTEGRATION — RESOLVED IN CODE**  
> **🟢 DELIVERY OTP STORAGE — RESOLVED IN CODE**  
> **🟡 AUTHENTICATION — DEVICE E2E PENDING**  
> **🔴 VPS/DATABASE — SERVER VERIFICATION REQUIRED**  
> **🔴 PHONEPE — SANDBOX E2E REQUIRED**  
> **🟡 FULFILLMENT — REAL ORDER TEST REQUIRED**  
> **🟡 ORDER TRACKING — DEVICE E2E REQUIRED**  
> **🔴 LIVE CUSTOMER TRAFFIC — NOT APPROVED**  

*See [FUNCTIONAL_QA_BASELINE.md](file:///d:/pocketkirana/FUNCTIONAL_QA_BASELINE.md) for detailed verification checklists.*

---

## 1. Verified Release Candidate Snapshot

- **Customer UI/UX:** 🟢 **FROZEN** (Realme RMX5000 physical-device QA passed)
- **Production Build:** 🟢 **Next.js 15.5 App Router + Customer App**
- **TypeScript / Linter:** 🟢 **0 Errors** (`tsc --noEmit` clean on both main and customer apps)
- **Checkout Integration:** 🟢 **PostgreSQL Transaction + Immediate Firestore Mirror + COD Trigger**
- **Delivery Verification:** 🟢 **`orders.delivery_otp` persistent in PostgreSQL, Firestore, and client**

---

## 2. Code Freeze Policy

The following core modules are **FROZEN** as the Release Candidate baseline:
- `lib/pricingEngine.ts`, `/api/checkout/*`
- `lib/postgres.ts`, `/api/inventory/*`
- `/api/payments/phonepe/*`, `/api/payments/verify`
- `/api/orders/[id]/status`
- `/api/delivery/orders/[id]/verify-otp`
- `middleware.ts`, `lib/routeAuth.ts`
- `public/manifest.webmanifest`, `public/firebase-messaging-sw.js`

If a defect is discovered during Phase G, it will be treated as a release-blocking issue: reproduce the defect, patch only the affected subsystem, and rerun the complete 25-test regression suite before resuming.

---

## 3. Phase G Progression Gates

```text
G1: Production PostgreSQL Database
    Capacity Check: PostgreSQL max_connections >= (Workers * 25) + 20
    Migrations, Constraints, Indexes, TLS, Automated Backups & Staging Restore Test
           ↓
G2: Production Firebase Project
    Authorized Domains, Production Security Rules, FCM VAPID Key, No Dev Fallbacks
           ↓
G3: Provider Sandbox E2E
    Complete Synthetic Order Lifecycle in Sandbox
           ↓
G4: Controlled Production Payment Smoke Test
    1x Real Low-Value Transaction (e.g. ₹1)
    4-Way Reconciliation Invariant: Gateway Txn == PG Payment == PG Order == Invoice Amount
    Single Webhook Replay Tested (0 Duplicate Mutations) & Test Refund Processed
           ↓
G5: Production Observability & Alerting
    APM, Error Spikes, Webhook Failure Logs, DB Saturation Alerts
           ↓
🟢 PUBLIC GO-LIVE
```
