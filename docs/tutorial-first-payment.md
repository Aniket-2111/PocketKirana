# Tutorial: Run Your First Simulated Payment

You'll take a PocketKirana order through the full payment lifecycle — create, "pay", verify, confirm — without a PhonePe account, real money, or even internet access to any gateway. By the end you'll have seen every piece of the payment pipeline work and know where each piece lives in the code.

Time: ~10 minutes. You need the repo checked out, `npm install` done, and Firebase configured (`.env.local` with the `NEXT_PUBLIC_FIREBASE_*` values — the app won't create orders without it).

## What you're building

The flow you'll exercise is the same one production uses — only the last mile (the PhonePe pay page) is replaced by a local mock:

```
checkout → create (route) → mock pay page → verify (route) → order CONFIRMED → picker task
```

## Step 1: Turn on simulation

Add one line to `.env.local` (create it from `.env.example` if it doesn't exist):

```bash
PHONEPE_SIMULATION_MODE=true
```

This flag is the *only* way the app enters simulation. It can never be triggered by request data, and the code refuses it entirely in production builds (`lib/phonepeConfig.ts` enforces both).

## Step 2: Start the server and place an order

```bash
npm run dev
```

Open `http://localhost:3000`, add something to the cart, and check out. If you're not logged in, the cart's "Proceed to Checkout" asks you to log in first (the SMS OTP flow) — that's the auth gate working; log in and retry.

At checkout, confirm the order. The app calls `POST /api/payments/phonepe/create`, which sees the simulation flag and responds with a redirect to the local mock pay page instead of PhonePe:

```
/checkout/mock-phonepe?transactionId=TXN_PK_MOCK_...&orderId=...&amount=...
```

Seeing that page is your first milestone — the create route, session auth, and order checks all passed.

## Step 3: Pay with the mock page

Click **Success** on the mock PhonePe page.

You'll land on `/checkout/success`, which calls `POST /api/payments/phonepe/verify` with the transaction id. That route flips the order to `paymentStatus: 'paid'` + `orderStatus: 'CONFIRMED'` and creates a picker task. The confirmation screen ("Your Order has been accepted") is your second milestone — the verify → Firestore → picking-task chain ran clean.

If you click **Fail** instead, verify records `status: 'failed'` on the payment doc and the UI shows the failure path. That's the same lifecycle a declined real card takes.

## Step 4: Look at what changed

Open Firestore (or the admin console's order view) for that order:

- `orders/{orderId}` — `paymentStatus: 'paid'`, `orderStatus: 'CONFIRMED'`, `paymentDetails.transactionId` populated
- `payments/pay_pk_{transactionId}` — `status: 'completed'`, `paidAt` timestamp
- `pickingTasks` (and legacy `picking_tasks`) — a task exists for the order

All three writes are the verify route's idempotent block (`app/api/payments/phonepe/verify/route.ts`, "IDEMPOTENT DB UPDATE" section). They only run if the order wasn't already paid — refreshing the success page won't duplicate anything.

## Step 5: Break it on purpose (optional but recommended)

Restart the server without the flag (`PHONEPE_SIMULATION_MODE` removed), then click Success on a stale mock tab. The verify route answers 400 "Invalid transaction reference" — mock transaction ids are refused the moment simulation is off. You've just watched the fail-closed rule protect a production-shaped deploy from mock data.

## What you built

You ran the complete payment lifecycle: create → pay → verify → confirmed order → picker task, plus the failure path and the fail-closed guard. From here:

- [Configure PhonePe sandbox credentials](howto-phonepe-setup.md) to run the same flow against the real gateway
- [Reference: payments & auth](reference-payments.md) for every route's responses and the data model
- [Why the payment system fails closed](explanation-payment-security.md) for the reasoning behind the guards you just saw
