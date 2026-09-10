# PhonePe Payment Gateway Integration Guide

This document describes the onboarding steps, credentials, architecture, and deployment procedures for the **PhonePe Payment Gateway (Pay Page API)** integration in PocketKirana.

---

## 1. Required Environment Variables

Add the following variables to your production environment or `.env.local` for testing:

```bash
# ── PhonePe Gateway Configuration
PHONEPE_ENV=sandbox # Options: 'sandbox' or 'production'
PHONEPE_MERCHANT_ID=PGUATPAYOUT # PhonePe Merchant ID
PHONEPE_SALT_KEY=e831610e-09dc-4613-bc7c-3f2df636eb01 # Cryptographic Secret Key
PHONEPE_SALT_INDEX=1 # Index of the active salt key
```

---

## 2. Onboarding & Merchant Dashboard Setup

To move from Sandbox (UAT) to Production:
1. **Onboarding**: Complete KYC and register a merchant account on the [PhonePe Business Portal](https://www.phonepe.com/business-solutions/).
2. **Retrieve Production Credentials**:
   - Navigate to the **Developer Settings** section in your PhonePe dashboard.
   - Generate your Production **Merchant ID**, **Salt Key**, and **Salt Index**.
3. **Configure Webhook URL**:
   - In the PhonePe dashboard settings, set the Webhook URL to: `https://yourdomain.com/api/payments/phonepe/webhook`
   - Permitted HTTPS certificate validation is required on the production domain.

---

## 3. How the Integration Works

### Payment Initiation
- Client requests payment via `POST /api/payments/phonepe/create` with `{ orderId }`.
- Server fetches order from Firestore, verifies ownership, and computes the paise amount (`Math.round(total * 100)`).
- Server hashes the payload: `SHA256(Base64Payload + "/pg/v1/pay" + saltKey) + "###" + saltIndex` to generate the `X-VERIFY` header.
- Sends POST request to PhonePe `/pg/v1/pay` endpoint.
- Returns redirection URL (`instrumentResponse.redirectInfo.url`) to client.

### Client Redirect & Return
- Client redirects to PhonePe standard pay page.
- Once completed, PhonePe redirects the client back to `/checkout/success?merchantTransactionId=...&orderId=...`.
- Success page mounts, displays a loading state, calls `POST /api/payments/phonepe/verify` to request status verification.
- If verified successful, order status is updated to `paid` and confirmed.

### Webhook Status Sync (Server-to-Server)
- PhonePe sends asynchronous callbacks to `/api/payments/phonepe/webhook`.
- Signature is verified by hashing: `SHA256(response + saltKey) + "###" + saltIndex`.
- Signature validation is **mandatory** — webhooks are rejected (with a 200 ACK) when credentials are missing or the signature does not match.
- Decodes base64 payload to verify status, updates payment and order status atomically.

---

## 4. Local Simulator / Developer Testing

Simulation mode must be **explicitly enabled** — it is never triggered implicitly:

```bash
# .env.local (dev machines only — production deployments refuse simulation)
PHONEPE_SIMULATION_MODE=true
```

When enabled:
- `POST /api/payments/phonepe/create` redirects to the mock payment page: `/checkout/mock-phonepe`.
- You can simulate successful payments or failure states locally.
- You can test the full database update cycle without requiring live internet hookups.

When simulation mode is OFF (the default everywhere, always off in production):
- Real gateway credentials (`PHONEPE_MERCHANT_ID` + `PHONEPE_SALT_KEY`) are **required**.
- Missing credentials cause the payment routes to **fail closed with HTTP 503** rather than silently falling back to sandbox or mock behavior.

### Security invariants (implemented in `lib/phonepeConfig.ts`)
1. Credentials come only from env vars — no hardcoded fallback merchant IDs or salt keys.
2. Simulation requires `PHONEPE_SIMULATION_MODE=true` and is refused when `VERCEL_ENV=production` or `NODE_ENV=production`.
3. Client-supplied strings (e.g. a transaction id containing "MOCK") can never trigger simulation; verify requests for `test_phonepe_` orders are rejected unless simulation is enabled.
4. The `/verify` route requires a valid session (same auth as `/create`) because it mutates order state.
