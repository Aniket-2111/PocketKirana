# PhonePe Payment Gateway Integration

Overview and onboarding guide for the PhonePe (Pay Page API) integration. This file covers merchant onboarding and the big picture; detailed documentation lives in [`docs/`](docs/).

**Architecture:** see [`diagrams/payment-auth-architecture.svg`](diagrams/payment-auth-architecture.svg) — customer apps → middleware session verification → payment routes → PhonePe → Firestore → picking queue.

> **Docs map:** reference (routes/env/data model) → [`docs/reference-payments.md`](docs/reference-payments.md) · setup walkthrough → [`docs/howto-phonepe-setup.md`](docs/howto-phonepe-setup.md) · first payment in 10 minutes → [`docs/tutorial-first-payment.md`](docs/tutorial-first-payment.md) · design rationale → [`docs/explanation-payment-security.md`](docs/explanation-payment-security.md)

---

## 1. Environment Variables

Server-side only (never `NEXT_PUBLIC_` prefixed, never committed):

```bash
PHONEPE_ENV=sandbox          # 'sandbox' | 'production'
PHONEPE_MERCHANT_ID=<from PhonePe dashboard>
PHONEPE_SALT_KEY=<from PhonePe dashboard>
PHONEPE_SALT_INDEX=1
NEXT_PUBLIC_SITE_URL=https://yourdomain.com   # redirects + webhook callback URL
```

Local development instead uses `PHONEPE_SIMULATION_MODE=true` (no credentials needed; refused in production). Missing credentials make the payment routes **fail closed with 503** — there are no fallback credentials anywhere in the codebase.

## 2. Onboarding & Merchant Dashboard

To move from sandbox to production:

1. **Onboarding**: complete KYC and register on the [PhonePe Business Portal](https://www.phonepe.com/business-solutions/).
2. **Credentials**: Developer Settings → generate production **Merchant ID**, **Salt Key**, **Salt Index**.
3. **Webhook URL**: set to `https://yourdomain.com/api/payments/phonepe/webhook` (HTTPS required).
4. **Auth**: set `NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED=true` in production — payment routes enforce session auth, and page RBAC verifies real Firebase ID tokens.

## 3. How the Integration Works

### Payment initiation — `POST /api/payments/phonepe/create`
Session-authenticated. Loads the order from Firestore, checks ownership and paid-status, computes paise from the server-side total, builds the payload with `X-VERIFY = SHA256(Base64Payload + "/pg/v1/pay" + saltKey) + "###" + saltIndex`, POSTs to PhonePe, returns `instrumentResponse.redirectInfo.url`.

### Client redirect & verification
PhonePe redirects back to `/checkout/success?merchantTransactionId=...&orderId=...`. The success page calls `POST /api/payments/phonepe/verify`, which does the authoritative checksummed status query against PhonePe, guards the amount, and idempotently writes `paymentStatus: 'paid'`, `orderStatus: 'CONFIRMED'`, the payment doc, and the picker task.

### Webhook status sync — `POST /api/payments/phonepe/webhook`
Server-to-server. `X-VERIFY` signature validation is **mandatory**: without configured credentials or with a bad signature the webhook ACKs 200 and processes nothing (retry-storm prevention); the client-side verify route recovers any missed confirmation. Valid webhooks run the same idempotent confirmation as verify.

Full request/response semantics: [`docs/reference-payments.md`](docs/reference-payments.md).

## 4. Security Invariants

Implemented in `lib/phonepeConfig.ts`, `lib/razorpayConfig.ts`, `middleware.ts`, and the route handlers — enforced by `npm test`:

1. Credentials come only from env vars; no hardcoded merchant IDs or salt keys anywhere.
2. Simulation requires `PHONEPE_SIMULATION_MODE=true` and is refused when `VERCEL_ENV=production` or `NODE_ENV=production`.
3. Client-supplied strings can never trigger simulation; verify rejects `test_phonepe_` orders unless simulation is on.
4. Both `/create` and `/verify` require a valid session (401 in strict mode without one).
5. Webhook signature validation is mandatory; failures ACK without state changes.
6. Every confirmation path is idempotent (`paymentStatus !== 'paid'` guard) and re-derives amounts server-side (paise mismatch → payment marked `failed`).

The reasoning behind these rules: [`docs/explanation-payment-security.md`](docs/explanation-payment-security.md).

## 5. Local Simulator / Developer Testing

```bash
# .env.local (dev machines only)
PHONEPE_SIMULATION_MODE=true
```

- `create` redirects to the mock pay page `/checkout/mock-phonepe` (Success / Fail buttons exercise both lifecycle paths).
- Order ids containing `test_phonepe_` form an offline demo harness that works without Firebase (auth middleware disabled); verify still refuses them unless simulation is on.
- Simulation off + credentials missing = 503 fail-closed. By design.

Step-by-step: [`docs/tutorial-first-payment.md`](docs/tutorial-first-payment.md).
