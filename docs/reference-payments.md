# Payments & Auth Reference

Complete technical reference for PocketKirana's payment gateways (PhonePe, Razorpay) and the session auth that guards them. Every claim here is traceable to code; for the "why", see [Explanation: payment security design](explanation-payment-security.md).

## Environment variables

All gateway credentials are **server-side only** (no `NEXT_PUBLIC_` prefix — client bundles never see them).

| Variable | Required for | Default | Effect if missing |
|---|---|---|---|
| `PHONEPE_MERCHANT_ID` | real PhonePe payments | — | Routes return **503** (fail closed) |
| `PHONEPE_SALT_KEY` | real PhonePe payments | — | Same as above; webhook ACKs and skips processing |
| `PHONEPE_SALT_INDEX` | real PhonePe payments | `1` | Falls back to `1` when credentials exist |
| `PHONEPE_ENV` | real PhonePe payments | `sandbox` | `production` switches base URL to `api.phonepe.com/apis/hermes` |
| `PHONEPE_SIMULATION_MODE` | local dev only | off | `true` enables the mock pay page; **refused** when `NODE_ENV=production` or `VERCEL_ENV=production` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | real Razorpay payments | — | Razorpay routes return **503** (fail closed) |
| `RAZORPAY_SIMULATION_MODE` | local dev only | off | Same rules as PhonePe simulation |
| `NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED` | production auth | `false` | `true` = strict mode: invalid/absent sessions are rejected at middleware; demo fallbacks off |
| `NEXT_PUBLIC_SITE_URL` | redirects/callbacks | `http://localhost:3000` | Used for PhonePe `redirectUrl` and `callbackUrl` |

PhonePe sandbox credentials for local testing are published by PhonePe (see their "test credentials UAT" page). Never put production salt keys in any committed file.

## Session authentication

| Concern | Implementation |
|---|---|
| Cookie names accepted | `pk_session` (written by `lib/sessionCookie.ts` on login), legacy `__pk_session`, `__session` |
| Edge verification | `middleware.ts` verifies RS256 Firebase ID tokens via `lib/sessionVerify.ts` (WebCrypto + Google JWKS, 6h key cache) |
| Route-level auth | `authenticateRequest()` in `app/api/payments/phonepe/shared.ts` reads the cookie and decodes the payload; in strict mode the middleware has already rejected invalid tokens before routes execute |
| Dev fallback | When `NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED !== 'true'`, requests without a session run as demo user `usr-cust-1` |
| Fail-closed rule | Strict mode + no/invalid cookie → **401** from the route |
| Header trust | Inbound `x-pk-uid` / `x-pk-role` headers are stripped by middleware; only verified tokens re-inject them for `routeAuth`-guarded routes |

## API routes (PhonePe)

### `POST /api/payments/phonepe/create`

Creates a payment for an existing order and returns a redirect URL.

- **Auth:** session required (strict mode) / demo user (dev)
- **Body:** `{ orderId: string }`
- **Order checks:** exists (404), ownership `orderData.customerId === uid` (403), not already paid (400)
- **Amount:** `Math.round(order.total * 100)` paise
- **Simulation:** redirects to `/checkout/mock-phonepe?transactionId=...&orderId=...&amount=...`
- **Real:** SHA256 checksum `base64(payload) + "/pg/v1/pay" + saltKey` in `X-VERIFY: <hash>###<saltIndex>`, POSTs to `{baseUrl}/pg/v1/pay`, returns `data.redirectUrl` from `instrumentResponse.redirectInfo.url`
- **Writes:** `payments/pay_pk_{txnId}` doc with `status: 'pending'` (real + DB-backed simulation paths)
- **Responses:** 200 `{ success, data: { merchantTransactionId, redirectUrl, isSimulation } }` · 400/401/403/404 · 502 gateway initiation failure or missing redirect URL · 503 unconfigured

### `POST /api/payments/phonepe/verify`

Authoritative status check. Called by the success page and usable as a recovery path when the webhook is missed.

- **Auth:** session required (it mutates order state)
- **Body:** `{ merchantTransactionId: string, orderId?: string, isMockSuccess?: boolean }`
- **Mock rejection:** `orderId` containing `test_phonepe_` is refused with 400 unless simulation is on
- **Real flow:** checksummed GET `{baseUrl}/pg/v1/status/{merchantId}/{txnId}`; non-JSON/empty gateway responses return `verified: false, status: 'PAYMENT_PENDING'` (graceful, not 500)
- **Amount guard:** gateway paise amount must equal the order total; mismatch → payment doc marked `failed` with reason, response `AMOUNT_MISMATCH`
- **Idempotent success:** only when `paymentStatus !== 'paid'`: sets `paymentStatus: 'paid'`, `orderStatus: 'CONFIRMED'`, updates payment doc, creates the picker task (`ensurePickingTaskForOrder` in `lib/firebaseServices.ts`, writes both `pickingTasks` and legacy `picking_tasks`)
- **Failure statuses:** `PAYMENT_ERROR`, `TIMED_OUT`, `PAYMENT_DECLINED` mark the payment doc `failed`

### `POST /api/payments/phonepe/webhook`

Server-to-server callback. No session (PhonePe calls it); authenticity is the `X-VERIFY` signature.

- **Signature (mandatory):** `SHA256(base64Response + saltKey) + "###" + saltIndex` compared to the `x-verify` header
- **No credentials configured:** ACK 200 `"Webhook received but gateway not configured"` — nothing processed
- **Invalid signature:** ACK 200 `"Invalid signature ignored"` — deliberately 200 so PhonePe does not retry-storm tampered traffic; the client-side verify route recovers the payment
- **Idempotency:** payment doc already `completed` → ACK "already processed"
- **Fallback resolution:** if the payment doc is missing, resolves the order via `orderNumber` parsed from the transaction id
- **Amount mismatch:** marks payment `failed`, responds 400 (genuine processing errors do return non-200)

### `OPTIONS` (all three routes)

CORS preflight: `Access-Control-Allow-Origin: *`, methods `GET, POST, OPTIONS`, headers `Content-Type, Authorization, X-VERIFY`. The wildcard origin supports the Capacitor Android WebView; tightening is a deliberate decision (see explanation doc).

## Razorpay routes

`app/api/payments/create-order` and `app/api/payments/verify` follow the same pattern via `lib/razorpayConfig.ts`: explicit `RAZORPAY_SIMULATION_MODE=true` for mocks, 503 when credentials are missing, no hardcoded key fallbacks (the old `rzp_test_PocketKiranaKey` auto-verify behavior was removed as a security fix). Long-term, PhonePe is the primary Indian rail; keep Razorpay config aligned when touching either.

## Data model

| Collection | Doc id | Key fields |
|---|---|---|
| `payments` | `pay_pk_{merchantTransactionId}` | `orderId`, `customerId`, `amount`, `currency: 'INR'`, `method: 'phonepe'`, `status` (`pending`/`completed`/`failed`), `gateway`, `gatewayOrderId`, `gatewayPaymentId`, `createdAt`, `paidAt`, `failureReason` |
| `orders` | order id | `paymentStatus` (`pending` → `paid`), `orderStatus` (`CREATED` → `CONFIRMED` → …), `total`, `customerId`, `orderNumber`, `paymentDetails` |
| `pickingTasks` (+ legacy `picking_tasks`) | per order | created on payment success by `ensurePickingTaskForOrder` |

Order status transitions are validated by the shared state machine (`lib/orderStateMachine.ts`): `PAYMENT_PENDING → CONFIRMED` is the "Confirm Payment" edge used by both verify and webhook.

## Local test helpers

- **Mock pay page:** `/checkout/mock-phonepe` (Success / Fail buttons) — reachable only through simulation redirects
- **Offline demo:** order ids containing `test_phonepe_` work without Firebase when auth middleware is disabled (UAT/demo harness; simulation flag still gates verify)
- **Unit tests:** `npm test` — `test/gateway-config.test.ts` locks the fail-closed config behavior (10 tests)

## Related

- [Tutorial: your first simulated payment](tutorial-first-payment.md)
- [How to: configure PhonePe for sandbox and production](howto-phonepe-setup.md)
- [Explanation: why the payment system fails closed](explanation-payment-security.md)
- `PHONEPE_INTEGRATION.md` — onboarding overview and merchant dashboard steps
