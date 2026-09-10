# Why the Payment System Fails Closed

Every payment route in PocketKirana is built around one rule: **when something is missing or suspicious, refuse to act** — never guess, never fall back to a test credential, never auto-approve. This doc explains why that rule exists, what it costs, and what was tried before.

## The problem

A payment system has two ways to be wrong. It can block a real payment (annoying, recoverable), or it can mark an unpaid order as paid (lost money, angry merchant, unrecoverable trust damage). These are not symmetric. A "helpful" fallback that keeps the demo working can quietly tip the system into the second failure mode.

PocketKirana learned this concretely. Before the hardening pass, three fallbacks existed:

1. **Hardcoded Razorpay test keys** (`rzp_test_PocketKiranaKey`) — deploy without env vars and every payment "verified" as paid, because the code couldn't tell "test key" from "no key".
2. **Simulation by inference** — anything that looked like a mock transaction could get mock-verified, driven by client-supplied strings.
3. **UAT credential fallbacks** — the app silently hit PhonePe's public sandbox when real config was absent.

Each converted a *configuration mistake* (forgot an env var) into a *money bug* (unpaid orders confirmed).

## The approach

The rule is implemented in two small config modules and one middleware:

```
lib/phonepeConfig.ts      getPhonePeConfig() → null | {merchantId, saltKey, ...}
lib/razorpayConfig.ts     getRazorpayConfig() → null | {keyId, keySecret}
                          isSimulationMode() / isRazorpaySimulationMode()
middleware.ts             Edge session verification (RS256), strips inbound
                          x-pk-* headers, injects only verified identity
```

- **Credentials are all-or-nothing.** The getter returns `null` unless every required variable is present. Routes translate `null` into HTTP 503 "Payment gateway is not configured. Please contact support." A missing env var is a *loud outage*, not a silent downgrade to test credentials.
- **Simulation is explicit and env-only.** `PHONEPE_SIMULATION_MODE=true` — and it's refused outright in production (`NODE_ENV`/`VERCEL_ENV`). Client data (an order id containing `test_phonepe_`) can trigger the *demo harness* only when auth middleware is disabled; verify still refuses those ids unless simulation is on. The simulation decision never reads request bodies.
- **The webhook trusts signatures, not reachability.** Without a salt key the webhook cannot verify authenticity — so it ACKs with 200 and processes nothing. This looks like failing *open*, but it's the safe shape: the client-side verify route independently confirms every payment before goods leave the store.
- **Every state mutation is idempotent.** Verify and webhook both check `paymentStatus !== 'paid'` before writing. PhonePe retries webhooks; users refresh the success page; double-delivery is a when, not an if.
- **Amounts are re-derived server-side.** The paise amount comes from the Firestore order doc, never the client. Both verify and webhook compare the gateway amount against the order and hard-fail on mismatch (`AMOUNT_MISMATCH`).
- **Auth has one trust boundary.** Inbound `x-pk-uid`/`x-pk-role` headers are stripped at the Edge; only a signature-verified Firebase ID token (RS256 via Google's JWKS, checked `iss`/`aud`/`exp`) can re-inject them. Payment routes additionally read the session cookie directly. A forged role header is a 401, not an order mutation.

Flow of a successful payment (see `diagrams/payment-auth-architecture.svg` for the full picture):

```
create → PhonePe pay page → redirect to /checkout/success
       → verify (server-to-server status check, amount guard, idempotent write)
       → webhook (signature-checked, idempotent, usually a no-op after verify)
       → picking task created once
```

## Trade-offs

- **503 beats silent sandbox.** A misconfigured deploy takes payments *down* instead of silently charging a test rail or auto-approving. That's a pager alert instead of a reconciliation nightmare — chosen deliberately. (An earlier real-sandbox test proved the value of the defensive path too: PhonePe returns empty bodies for unknown transactions, and unguarded parsing there would 500 the success page.)
- **Invalid-signature webhooks are ACKed (200), not rejected (4xx).** This looks wrong — shouldn't tampered traffic fail loudly? PhonePe retries non-2xx webhooks aggressively; ACKing a signature failure stops retry storms while making certain no state changes. The verify route is the real confirmation, so nothing is lost.
- **CORS `Access-Control-Allow-Origin: *` on payment routes.** The Capacitor Android WebView needs it today. It's a known debt: the payment routes are session-authenticated (a browser attacker can't do anything with an unauthenticated CORS response), but an origin allowlist is the correct long-term answer. Flagged, not fixed — it's a behavior change for the app, not a cleanup.
- **Demo user `usr-cust-1` exists at all.** With auth middleware disabled (local dev), sessionless requests run as a shared demo customer. In strict mode or production this path is dead: no cookie → 401.

## Alternatives considered

- **Silent UAT fallback for missing prod credentials** (the original design): rejected — it converts forgotten env vars into test-mode charges against a real storefront.
- **Verifying webhooks by re-querying PhonePe instead of the signature** (skip `X-VERIFY`, call the status API): workable, but the signature is free, local, and PhonePe-mandated; skipping it invites "webhook processed" log lines for traffic we never authenticated.
- **Trusting decoded JWT payloads without signature checks** (the original middleware): rejected after audit — anyone with a base64 editor was admin. The RS256 verifier (`lib/sessionVerify.ts`) added zero dependencies (WebCrypto + JWKS) at the cost of a key-fetch cache, a fair trade.

## Related

- [Reference: payments & auth](reference-payments.md) — exact routes, statuses, env vars
- [How to: configure PhonePe for sandbox and production](howto-phonepe-setup.md)
- `test/gateway-config.test.ts` — the fail-closed rules as executable tests
