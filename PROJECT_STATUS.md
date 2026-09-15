# Pocket Kirana — Project Status & Release Governance

> **🟢 APPLICATION RELEASE CANDIDATE APPROVED — CODE FREEZE ACTIVE 🔒**  
> **🟡 PHASE G PRODUCTION INFRASTRUCTURE — PENDING G1–G5 VERIFICATION**  
> **🔴 LIVE CUSTOMER TRAFFIC — NOT YET ENABLED**  

---

## 1. Verified Release Candidate Snapshot

- **Production Build:** 🟢 **81/81 Pages Compiled** (Next.js 15.5 App Router)
- **TypeScript / Linter:** 🟢 **0 Errors / 0 Warnings** (`tsc --noEmit`)
- **Automated Invariant Suite:** 🟢 **25/25 Tests Passing** (`npm test`)
- **Payment Verification:**
  - PhonePe: 🟢 Verified (SHA256 `x-verify` + exact amount in paise + idempotent ACK)
  - Razorpay: 🟢 Verified (HMAC SHA256 + fail-closed production check)
  - Cash on Delivery: 🟢 Verified (Doorstep settlement lock + delivery OTP)

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
