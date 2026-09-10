# How to Configure PhonePe for Sandbox and Production

Get PhonePe payments working locally with the simulator, then move the same code to real sandbox and production credentials. End state: a real payment verified end-to-end with order confirmation and a picker task.

## Prerequisites

- Repo checked out, `npm install` run, Firebase configured (`.env.local` exists with `NEXT_PUBLIC_FIREBASE_*` vars)
- A PhonePe merchant account ([Business Portal](https://www.phonepe.com/business-solutions/)) for production; sandbox test credentials are published on PhonePe's developer "test credentials UAT" page
- Dev server: `npx next dev -p 3000` (or your `NEXT_PUBLIC_SITE_URL`)

## Steps

### Local development (simulation)

1. Add simulation mode to `.env.local` (do **not** commit it):

   ```bash
   PHONEPE_SIMULATION_MODE=true
   ```

   That's the only required flag. Leave `PHONEPE_MERCHANT_ID`/`PHONEPE_SALT_KEY` unset — the code doesn't need them in simulation.

2. Restart the dev server and place an order in the UI. Checkout redirects to `/checkout/mock-phonepe` instead of PhonePe.

3. Click **Success** on the mock page. Expected: redirect to `/checkout/success`, order shows `paymentStatus: 'paid'`, `orderStatus: 'CONFIRMED'`, and a `pickingTasks` doc exists in Firestore.

   If the mock page refuses the transaction with 400: the verify route rejects `test_phonepe_` demo orders unless simulation is on — check the flag actually reached the server process (restart after editing `.env.local`).

### Sandbox (real gateway, test money)

1. Fill the sandbox credentials in `.env.local` and remove simulation:

   ```bash
   PHONEPE_ENV=sandbox
   PHONEPE_MERCHANT_ID=<sandbox merchant id>
   PHONEPE_SALT_KEY=<sandbox salt key>
   PHONEPE_SALT_INDEX=1
   # PHONEPE_SIMULATION_MODE=   # must be absent or false
   ```

2. Restart, place a real order, and pay on the PhonePe test page. Expected: redirect back to `/checkout/success?merchantTransactionId=...&orderId=...`, verify returns `verified: true`.

3. Confirm the `payments/pay_pk_<txnId>` doc flipped from `pending` to `completed`.

   If checkout returns **503 "Payment gateway is not configured"**: at least one of merchant id / salt key is missing or empty in the server environment — that's the fail-closed guard, by design. If the success page shows "pending" forever: the status check hit a non-JSON gateway response (visible in server logs as `[PhonePe Status Check] Non-JSON gateway response`) — retry the verification; the user never sees a crash.

### Production

1. Complete KYC on the PhonePe Business Portal, then from **Developer Settings** copy the production **Merchant ID**, **Salt Key**, and **Salt Index**.
2. Set the webhook URL in the PhonePe dashboard to `https://<yourdomain>/api/payments/phonepe/webhook` (HTTPS required).
3. Configure the deploy environment (never commit these):

   ```bash
   PHONEPE_ENV=production
   PHONEPE_MERCHANT_ID=<prod merchant id>
   PHONEPE_SALT_KEY=<prod salt key>
   PHONEPE_SALT_INDEX=1
   NEXT_PUBLIC_SITE_URL=https://<yourdomain>
   NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED=true
   ```

   `NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED=true` is load-bearing in production: it enforces session auth on the payment routes and the RBAC'd pages. Without it, production behaves demo-permissive for invalid tokens.

4. Run one real end-to-end order. Expected in server logs: `[PhonePe Webhook Success] Order #... confirmed, paid, and sent to picker queue!` (or the verify path confirming first — the webhook is then a no-op idempotency ACK).

## Verification checklist

- [ ] Simulation locally: mock pay page → paid + `CONFIRMED` + picking task
- [ ] Sandbox: real redirect → verified → payment doc `completed`
- [ ] Production: webhook URL registered, one real order through both verify AND webhook paths
- [ ] `npm test` green (fail-closed config rules)
- [ ] Amount mismatch handling: known by inspection — both verify and webhook compare paise amounts and mark `failed` on mismatch

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 503 on create/verify | credentials missing/empty | set `PHONEPE_MERCHANT_ID` + `PHONEPE_SALT_KEY`, restart |
| 401 on create/verify | strict auth on, no/invalid session cookie | log in via the app (writes `pk_session`); check `NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED` matches your intent |
| 403 on create | order belongs to another customer | expected guard — use the owning account |
| Webhook logs "Invalid signature ignored" | salt key mismatch between dashboard and env, or salt index wrong | re-copy credentials; confirm `PHONEPE_SALT_INDEX` |
| Webhook logs "gateway not configured" | salt key absent server-side | the ACK-200-without-processing is by design; the client verify path still confirms payments, but set credentials to enable webhook processing |
| "Unexpected end of JSON input" style 500s | pre-fix behavior | already fixed — gateway bodies parse defensively; if you reintroduce an unguarded `res.json()`, tests won't catch it but this doc will judge you |

## Related

- [Reference: payments & auth](reference-payments.md) — every env var and route response
- [Tutorial: your first simulated payment](tutorial-first-payment.md) — the 5-minute version
- `PHONEPE_INTEGRATION.md` — merchant onboarding details
