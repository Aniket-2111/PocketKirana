# Phase 19 — Gate G4: Controlled ₹1 Real Transaction Specification

## 1. Safety Guardrails & Human Control
- **Explicit Approval Required:** Never executed automatically in CI.
- **Single Transaction Policy:** Exactly one controlled transaction executed on test SKU with `amount = ₹1.00`.
- **Reconciliation Audit:** Complete lifecycle traced from PhonePe/Razorpay production gateway through PostgreSQL ledger `payment_transactions`, Outbox event `payment.confirmed`, and tax invoice generation.

## 2. Invariant Checklist
1. Order total is computed server-side as ₹1.00 (100 paise).
2. Gateway callback sends verified SHA256 checksum matching production salt key.
3. Webhook updates canonical `orders.payment_status = 'paid'` and inserts into `payments` table.
4. Outbox worker emits `payment.confirmed` event and triggers Firestore projection.
5. End-of-day reconciliation script confirms zero ledger discrepancies.
