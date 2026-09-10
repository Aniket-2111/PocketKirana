# PocketKirana

Fast local grocery delivery for Neral (15–30 min) — a multi-surface platform: customer web app (Next.js 15), customer Android app (Capacitor), and admin/picker/delivery portals, backed by Firebase (Auth/Firestore/Functions) and PostgreSQL, with PhonePe payments.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Firebase + gateway credentials
npm run dev                  # http://localhost:3000
```

Simulated payments (no gateway account needed): add `PHONEPE_SIMULATION_MODE=true` to `.env.local` — checkout then uses the local mock pay page.

## Documentation

| Doc | What it covers |
|---|---|
| [docs/tutorial-first-payment.md](docs/tutorial-first-payment.md) | Run your first simulated payment end-to-end (~10 min) |
| [docs/howto-phonepe-setup.md](docs/howto-phonepe-setup.md) | Configure PhonePe for local, sandbox, and production |
| [docs/reference-payments.md](docs/reference-payments.md) | Payment routes, env vars, session auth, data model |
| [docs/explanation-payment-security.md](docs/explanation-payment-security.md) | Why the payment system fails closed (design rationale) |
| [PHONEPE_INTEGRATION.md](PHONEPE_INTEGRATION.md) | PhonePe onboarding overview + architecture diagram |
| [diagrams/payment-auth-architecture.svg](diagrams/payment-auth-architecture.svg) | Payment + auth architecture (editable `.excalidraw` alongside) |
| [TESTING.md](TESTING.md) | Test setup, conventions, layers (`npm test`) |

Operational references in the repo root: `OPERATIONS_RUNBOOK.md`, `PRODUCTION_CHECKLIST.md`, `PAYMENT_RECONCILIATION.md`, `POCKETKIRANA_PROJECT_MASTER_AUDIT.md`.

## Development

```bash
npm test          # vitest suite (gateway config fail-closed rules)
npm run lint      # next lint
npx tsc --noEmit  # typecheck
```

Stack: Next.js 15 (App Router), TypeScript, Tailwind, Firebase, Capacitor (Android apps in `customer-app/`, `picker-app/`, `delivery-app/`), Cloud Functions in `functions/`.
