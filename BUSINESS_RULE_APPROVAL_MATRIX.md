# Business Rule Approval Matrix

**Mode:** Audit / contract only. This document records decisions required before any production-code, schema, collection, or data-removal change.

**Decision protocol:** A named business owner records an approval, rejection, or amended rule for every row. Engineering may only turn an approved rule into a versioned contract and implementation. A blank approval means **do not implement, migrate, or delete**.

| Area | Decision required | Observed state | Proposed safety rule (not approved) | Approval | Business owner / date | Contract reference |
| --- | --- | --- | --- | --- | --- | --- |
| Order | Final status vocabulary and permitted transition graph | Conflicting: `lib/orderStateMachine.ts`, Cloud Functions, and API/UI paths use overlapping status sets. | Freeze one order-status graph; reject invalid transitions atomically and retain a timestamped transition history. | ⬜ |  |  |
| Payment | Meaning and handling of `UNKNOWN` | Proposed only; PhonePe verify currently returns `UNKNOWN_ERROR` without a durable canonical state. | `UNKNOWN` means an external debit/credit effect cannot be determined. Persist it with gateway evidence; never infer failure or success; queue reconciliation. | ⬜ |  |  |
| Payment | Fulfilment while payment is `UNKNOWN` | Unresolved. | Do not create/advance fulfilment work for online payments in `UNKNOWN`; permit only an explicitly approved exception workflow. | ⬜ |  |  |
| Reservation | Lifetime during payment uncertainty | Existing Firestore order placement reserves for 30 minutes; expiry/release policy does not address `UNKNOWN`. | Reservation remains held only for an approved bounded reconciliation window; then move to a review/escalation state, never silently release if payment may have succeeded. | ⬜ |  |  |
| Cancellation | Cancellation after picking or packing | Conflicting: public policy says preparation blocks cancellation; state-machine/UI paths expose broader actions. | Define cancellation eligibility by canonical order state, actor, and compensation/refund outcome; no client-side interpretation. | ⬜ |  |  |
| Refund | Gateway execution, owner, and state graph | Incomplete: `cancelOrder` creates a Firestore `REQUESTED` record but does not execute a gateway refund. | Model request, approval, submission, gateway acknowledgement, settlement, failure, and manual-review states with immutable gateway references. | ⬜ |  |  |
| COD | Payment and fulfilment behavior | Existing Function confirms COD immediately, keeps payment pending, and collects at delivery. | Approve when COD becomes an accepted order, when stock commits, what proves collection, and the handling of short/failed collection. | ⬜ |  |  |
| Earnings | Exactly-once creation and reversal | Proposed only; delivery completion increments Firestore partner aggregates directly. | Create one immutable earning ledger entry per completed assignment using a stable uniqueness key; aggregate as a projection and create compensating reversals only. | ⬜ |  |  |
| Notifications | Exactly-once and retry semantics | Proposed only; records use time/random IDs and sends are best-effort. | Define delivery as at-least-once; deduplicate by business-event + recipient + channel, retain attempts, and make inbox records idempotent. | ⬜ |  |  |
| Outbox | Event ownership, publisher, retries, and failure handling | Unresolved; no transactional outbox writer/worker was found. | The authoritative transaction writes the business change and outbox event together; one owned worker publishes with retry/backoff and a visible dead-letter/replay path. | ⬜ |  |  |
| PhonePe | Circuit-breaker thresholds and cooldown | Unresolved; no circuit-breaker implementation found. | Keep this outside the legacy Firestore flow. Approve failure window, threshold, open duration, half-open probes, and customer fallback before implementation. | ⬜ |  |  |
| Razorpay | Circuit-breaker thresholds and cooldown | Unresolved; current route can use mock credentials and has no circuit-breaker. | Approve the same breaker policy independently for Razorpay; include mock/test-mode exclusion and an operator override policy. | ⬜ |  |  |
| Firestore | Legacy business-writer shutdown criteria | Active legacy business writers remain in Cloud Functions and PhonePe routes; schema comments claim some are PostgreSQL-only. | Disable a legacy writer only after its PostgreSQL replacement is live, shadow/reconciliation evidence passes, readers are migrated, rollback is tested, and an owner signs off. | ⬜ |  |  |

## Approval gates

1. Approve every row above (or explicitly mark it out of scope).
2. Freeze canonical IDs, order statuses, payment states, and transition ownership in a versioned contract.
3. Complete the reader/writer ownership matrix and name one authoritative writer for each business fact.
4. Only then design the PostgreSQL replacement, idempotency boundary, and transactional outbox.

## Non-negotiable uncertainty rule

`UNKNOWN` is evidence of unresolved external payment effect, not a display label. The eventual implementation must keep: provider, merchant transaction ID, amount/currency, observed responses, timestamps, verification attempts, reconciler outcome, and the actor/system that resolved it.

## Prohibited until approved

- Deleting Firestore order, payment, refund, reservation, or fulfilment collections.
- Removing PostgreSQL tables or legacy code.
- Treating a timeout/error as a failed payment.
- Adding a PhonePe/Razorpay circuit breaker to the legacy flow.
