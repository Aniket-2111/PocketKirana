# Pocket Kirana — Final Release Gate & Governance Specification

> **🟢 APPLICATION RELEASE CANDIDATE APPROVED — CODE FREEZE ACTIVE 🔒**  
> **🟡 PHASE G PRODUCTION INFRASTRUCTURE — PENDING G1–G5 VERIFICATION**  
> **🔴 LIVE CUSTOMER TRAFFIC — NOT YET ENABLED**  

---

## 1. Application Layer Sign-Off (Frozen Baseline)

| Verification Subsystem | Contract | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **Next.js Production Build** | Next.js 15.5 App Router compilation | 🟢 **81/81 Pages** | `next build` |
| **TypeScript / Linter** | Strict type validity, zero warnings | 🟢 **PASS** | `tsc --noEmit` |
| **Unit & Invariant Suite** | Automated regression & invariant tests | 🟢 **25/25 PASS** | [`test/transactional-red-team.test.ts`](file:///d:/pocketkirana/test/transactional-red-team.test.ts) |
| **PWA & Branding** | Vector SVG (`pocketkirana-logo.svg`), multi-res icons, offline shell | 🟢 **PASS** | [`public/manifest.webmanifest`](file:///d:/pocketkirana/public/manifest.webmanifest) |
| **Authentication / RBAC** | RS256 JWKS + session token verification | 🟢 **PASS** | [`lib/routeAuth.ts`](file:///d:/pocketkirana/lib/routeAuth.ts) |
| **PostgreSQL Transactions** | ACID isolation, code `40001`/`40P01` retry logic | 🟢 **PASS** | [`lib/postgres.ts`](file:///d:/pocketkirana/lib/postgres.ts) |
| **Inventory Concurrency** | Row locks (`SELECT ... FOR UPDATE`), zero oversell | 🟢 **PASS** | [`test/transactional-red-team.test.ts`](file:///d:/pocketkirana/test/transactional-red-team.test.ts) |
| **FEFO Allocation** | Earliest expiring batches consumed first | 🟢 **PASS** | [`test/transactional-red-team.test.ts`](file:///d:/pocketkirana/test/transactional-red-team.test.ts) |
| **Authoritative Pricing** | Server-side totals, 5% GST, tiered coupons | 🟢 **PASS** | [`lib/pricingEngine.ts`](file:///d:/pocketkirana/lib/pricingEngine.ts) |
| **Transaction Rollback** | Atomic abort leaves 0 partial records in DB | 🟢 **PASS** | [`test/transactional-red-team.test.ts`](file:///d:/pocketkirana/test/transactional-red-team.test.ts) |
| **PhonePe Gateway** | SHA256 `x-verify` + exact amount match + replay protection | 🟢 **PASS** | [`app/api/payments/phonepe/webhook/route.ts`](file:///d:/pocketkirana/app/api/payments/phonepe/webhook/route.ts) |
| **Razorpay Gateway** | HMAC SHA256 signature verification & replay check | 🟢 **PASS** | [`app/api/payments/verify/route.ts`](file:///d:/pocketkirana/app/api/payments/verify/route.ts) |
| **Cash on Delivery (COD)** | Doorstep settlement lock & OTP delivery gate | 🟢 **PASS** | [`test/transactional-red-team.test.ts`](file:///d:/pocketkirana/test/transactional-red-team.test.ts) |
| **Order State Machine** | Strict server-side rejection of illegal shortcuts | 🟢 **PASS** | [`app/api/orders/[id]/status/route.ts`](file:///d:/pocketkirana/app/api/orders/%5Bid%5D/status/route.ts) |
| **Delivery OTP** | Single-use 4-digit OTP matching assigned rider | 🟢 **PASS** | [`app/api/delivery/orders/[id]/verify-otp/route.ts`](file:///d:/pocketkirana/app/api/delivery/orders/%5Bid%5D/verify-otp/route.ts) |
| **Push / FCM** | Asynchronous out-of-band push with dev fallback | 🟢 **PASS** | [`lib/notificationDispatcher.ts`](file:///d:/pocketkirana/lib/notificationDispatcher.ts) |

---

## 2. Phase G — Controlled Production Infrastructure Verification

```text
                 🔒 RC FROZEN
                      │
                      ▼
             G1 Database ── 🟢
                      │
                      ▼
             G2 Secrets ─── 🟢
                      │
                      ▼
             G3 Sandbox ─── 🟢
                      │
                      ▼
             G4 Live Pay ── 🟢
                      │
                      ▼
             G5 Monitoring ─🟢
                      │
                      ▼
              25/25 REGRESSION
                      │
                      ▼
                 GO / NO-GO
                      │
                      ▼
              🟢 PRODUCTION LIVE
```

### G1 — Production Database & Holistic Connection Topology
- **Holistic Capacity Invariant:**
  $$\text{PostgreSQL max\_connections} \ge (\text{App Workers} \times 25) + \text{Background Workers} + \text{Admin/Migration Cons} + \text{Monitoring Cons} + \text{Buffer (20)}$$
  *Core Rule:* The application must never be able to exhaust PostgreSQL's available connections under the maximum expected deployment topology.
- Applied migrations, verified schema constraints, and tuned high-traffic indexes.
- TLS/SSL connection enforcement, daily automated backups, and verified staging restore test.
- Test that a DB restart / transient disconnect triggers clean rollback without partial order or inventory leakage.

### G2 — Production Secrets & Environment Hardening
- Populate production environment variables in deployment host (never in Git):
  `DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_SALT_INDEX`, `PHONEPE_ENV=production`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
- Confirm `NODE_ENV=production` strictly fails closed and refuses simulation/sandbox fallback modes.

### G3 — Staging Provider Sandbox
- Execute a complete synthetic order through the operational chain in provider sandbox:
  `Customer Login` → `Browse` → `Cart` → `Checkout` → `Inventory Row Lock` → `Sandbox Webhook` → `Order Confirmed` → `Picker` → `Packed` → `Rider Delivery OTP` → `Delivered` → `Tax Invoice Generation`.

### G4 — Controlled Production Payment Smoke Test
- Execute **one real low-value live transaction** (e.g. ₹1) on production PhonePe/Razorpay credentials.
- **4-Way Payment Reconciliation Invariant (Validated Immediately Post-Payment):**
  $$\text{Gateway Transaction Record} \equiv \text{PostgreSQL Payment} \equiv \text{PostgreSQL Order (CONFIRMED)} \equiv \text{Customer Invoice}$$
  All four must agree on:
  - Provider Transaction / Reference ID
  - Order ID & Number
  - Gross Amount in Paise / INR
  - Currency (`INR`)
  - Payment Status (`PAID` / `completed`)
  - Order Status (`CONFIRMED`)
- Execute a single webhook replay to verify **zero duplicate mutations**.
- Refund or close the transaction according to merchant test procedures.
- *Separately*, advance the order through physical fulfillment (`CONFIRMED` $\rightarrow$ `PACKING` $\rightarrow$ `PACKED` $\rightarrow$ `OUT_FOR_DELIVERY` $\rightarrow$ `DELIVERED`).

### G5 — Production Observability & Alerting
- Real-time telemetry configured for: 5xx spikes, checkout latency, webhook delivery failures, DB pool saturation, and FCM push drops.
- Persistent audit logs: `order_status_history`, payment audit records, webhook idempotency logs.

---

## 3. Decoupled Rollback Runbook (Zero Second Outage)

> **Architectural Rule:** Never roll back database migrations as part of an application rollback unless the migration has explicitly been proven backward-reversible.

```text
1. PAUSE NEW TRAFFIC:
   Set MAINTENANCE_MODE=true on edge routing to halt incoming customer checkouts.

2. PRESERVE PAYMENT RECONCILIATION:
   Keep /api/payments/*/webhook active to settle in-flight transactions.

3. ROLLBACK APPLICATION BINARY:
   Redeploy previous known-good application bundle (R1) against the compatible database schema.

4. AUDIT 4-WAY RECONCILIATION:
   Run automated reconciliation between gateway export and PostgreSQL orders/payments tables.

5. RESUME SERVICE:
   Clear maintenance flag once state consistency is confirmed.
```

---

## 4. Mandatory Go / No-Go Checklist

```text
PHASE G — GO-LIVE GATE

[ ] Production PostgreSQL backup verified & WAL recovery active
[ ] Production database restore tested in staging
[ ] Connection pool capacity verified: max_connections >= (App Workers * 25) + Admin + Mon + Buffer
[ ] Production Firebase project configured (authorized domains, security rules)
[ ] Production environment variables verified (NODE_ENV=production, zero sandbox fallbacks)
[ ] PhonePe production HTTPS webhook verified in merchant dashboard
[ ] Razorpay production HTTPS webhook verified in merchant dashboard
[ ] TLS certificate & DNS routing verified (pocketkirana.com)
[ ] Production monitoring & APM enabled
[ ] Error alerts configured (5xx spikes, DB saturation, webhook failures)
[ ] Rollback deployment artifact tagged and prepared (Decoupled schema policy)
[ ] Low-value live payment completed (4-Way Payment Reconciliation Verified)
[ ] Live payment record reconciled against PostgreSQL ledger
[ ] Webhook replay verified to produce 0 duplicate mutations
[ ] Full physical order lifecycle verified (Placed → Confirmed → Packing → Packed → Out for Delivery → Delivered)
[ ] GST tax invoice generation verified on real order ID
[ ] FCM device push notification verified on physical device
[ ] PostgreSQL database integrity verified post-smoke test
[ ] 25/25 regression test suite re-executed and passing

                    ↓

              🟢 GO LIVE
```
