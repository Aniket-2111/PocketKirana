# Cutover Gap Matrix

**Mode:** Audit / contract only. This matrix converts the ownership findings into a controlled cutover backlog. It does not approve implementation, data migration, legacy-writer shutdown, or deletion.

## Preconditions

- A corresponding row in [Business Rule Approval Matrix](BUSINESS_RULE_APPROVAL_MATRIX.md) must be approved before its cutover work begins.
- PostgreSQL table names below are candidate persistence targets found in `scripts/init_client_postgres_tables.js` and `scripts/migrate_to_clean_architecture.js`. Confirm the live schema and constraints before using them.
- A Firestore projection is optional. If retained, it is read-model/realtime state only and must never regain business-command ownership.
- “Done” requires reconciliation evidence and failure/retry testing, not merely code deployment.

| Domain | Legacy writer(s) | Canonical command / API missing or to be proven | Candidate PostgreSQL persistence | Required outbox event(s) | Firestore projection / reader migration | Cutover gaps | Exit evidence before legacy shutdown | Approval / owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer order | `functions/src/orders/placeOrder.ts` | Authenticated, idempotent customer `POST /api/orders` (or explicitly approved replacement) that owns one full transaction. | `orders`, `order_items`, `order_addresses`, `order_status_history`, `stock_reservations`, `idempotency_keys`. | `order.created`, `inventory.reservation.requested`, `order.realtime.changed`. | If required, an orders/task summary projection; migrate customer/admin order reads to API/canonical read model. | No canonical endpoint; no established transaction across order + reservation + idempotency + event; client still calls Function. | Parallel/shadow comparison, duplicate-submit test, concurrent-stock test, reader cutover metric, rollback rehearsal. | ⬜ /  |
| Order status | Functions plus PhonePe paths; `PATCH /api/orders/[id]/status` also exists. | One role-aware status-transition command that validates the approved graph and writes history. | `orders`, `order_status_history`, optional `order_notes`. | `order.status.changed`. | Optional Firestore order status projection; migrate all UIs to canonical status vocabulary. | Competing writers and conflicting status sets. | Invalid-transition, concurrent-transition, replay, and end-to-end fulfilment tests. | ⬜ /  |
| PhonePe payment | `app/api/payments/phonepe/{create,verify,webhook}`. | One payment-attempt command; one authenticated webhook processor; durable verifier/reconciler for `UNKNOWN`. | `payments`, `payment_transactions`, `idempotency_keys`; add approved reconciliation/attempt fields or tables. | `payment.initiated`, `payment.confirmed`, `payment.failed`, `payment.unknown`, `payment.reconciled`. | Project a safe customer payment status only; move checkout/order reads to canonical API. | Multiple state-mutating paths, no durable `UNKNOWN`, no callback event ledger/outbox. | Signed callback replay, timeout/webhook-loss recovery, amount mismatch, duplicate callback, reconciliation report. | ⬜ /  |
| Razorpay payment | `app/api/payments/create-order` and `verify`; checkout client. | Canonical order/payment linkage, signature verification, webhook processor, and reconciler—not only a client-returned verification result. | `payments`, `payment_transactions`, `idempotency_keys`. | Same approved payment events as PhonePe. | Safe payment-status projection if needed; checkout consumes canonical response. | Persistence/webhook/circuit-breaker policy is incomplete; mock path exists. | Real and mock-mode separation, signature/webhook replay, duplicate-payment/retry tests. | ⬜ /  |
| Payment uncertainty | No durable writer; PhonePe returns `UNKNOWN_ERROR` only. | Payment resolution command and scheduled/manual reconciliation workflow governed by approved `UNKNOWN` rule. | Extend payment attempt/reconciliation persistence; retain immutable provider evidence. | `payment.unknown`, `payment.reconciliation.requested`, `payment.reconciled`. | Expose only approved customer support state; no fulfilment projection until resolution. | Rule, storage, owner, timer/SLA, and escalation process absent. | Timeouts and ambiguous provider responses remain traceable until human/system resolution. | ⬜ /  |
| Reservation | Firestore `placeOrder`, `cancelOrder`, `releaseExpiredReservations`, `verifyPickup`. | Transactional reserve/release/commit/expire commands linked to canonical order/payment state. | `stock_reservations`, `inventory`, `inventory_transactions` or `inventory_events`. | `inventory.reserved`, `inventory.released`, `inventory.committed`, `reservation.expired`. | Optional availability/realtime task projection; all inventory reads trace to canonical availability rule. | Payment-uncertainty lifetime unresolved; split inventory writers remain. | High-contention reservation test, expiry test, cancellation/unknown-payment test, stock reconciliation. | ⬜ /  |
| Picking and packing | Firestore order Function/task mutations; PostgreSQL picking/packing routes coexist. | Decide the command owner; complete task acceptance/item-pick/packing commands against canonical order state. | `picking_tasks`, `picking_task_items`, `packing_tasks`, `packing_items`. | `picking.task.created/updated`, `packing.task.created/updated`. | Firestore tasks may be projection only; picker apps stop reading/writing legacy task facts. | Existing API and Function paths are mixed; contract/projection pipeline absent. | Task/order consistency, reassignment, cancellation-after-pick, offline/retry tests. | ⬜ /  |
| Delivery lifecycle | Firestore delivery Functions and PostgreSQL delivery API routes. | One assignment/accept/pickup/deliver command family with stable assignment/event identifiers. | `delivery_assignments`, `delivery_status_history`, `delivery_tracking`. | `delivery.assigned`, `delivery.picked_up`, `delivery.completed`, `delivery.failed`. | Retain Firestore GPS/realtime projection if needed; migrate assignment business reads. | Split command ownership and no idempotent event ledger. | Duplicate completion, OTP/pickup, assignment race, projection replay, GPS lag tests. | ⬜ /  |
| COD collection | `functions/src/delivery/completeDelivery.ts`. | Approved collection confirmation/exception command separate from delivery status. | `payments`, `payment_transactions`; approved cash exception/ledger storage if required. | `cod.collection.recorded`, `cod.collection.exception`, `payment.confirmed`. | Customer/admin delivery/payment projections from canonical event. | Collection proof and shortfall policy unresolved. | Cash collection reconciliation; failed/partial collection workflow; duplicate completion protection. | ⬜ /  |
| Refund | `functions/src/orders/cancelOrder.ts` records `REQUESTED`. | Approved refund request/approve/submit/reconcile command family and gateway worker. | `refunds`, `payments`, `payment_transactions`, `idempotency_keys`. | `refund.requested`, `refund.submitted`, `refund.completed`, `refund.failed`. | Safe refund status projection; admin/customer readers use canonical state. | No confirmed gateway execution, retry, or finality process. | Provider-request idempotency, duplicate cancellation, delayed/failed refund, operator replay tests. | ⬜ /  |
| Earnings | `functions/src/delivery/completeDelivery.ts` increments aggregates. | Immutable earning-credit command keyed by assignment completion; reversal command if approved. | `delivery_earnings`; partner aggregate/projection tables if required. | `partner.earning.credited`, `partner.earning.reversed`. | Partner balance may be a projection; migrate earnings readers to ledger-derived data. | Direct aggregate mutation can duplicate; no uniqueness/reversal rule. | Duplicate delivery completion yields one ledger credit; aggregates reconcile exactly to ledger. | ⬜ /  |
| Notifications | Functions utility plus `lib/notificationService.ts` / dispatcher pathways. | Outbox consumer that creates deduplicated inbox records and delivery attempts. | `notifications`; add approved notification-attempt/dedupe/outbox persistence. | Consume the domain events above; optionally `notification.sent/failed`. | Firestore notification inbox only if it remains a projection; clients read one selected source. | Multiple writers, random IDs, no durable retry/dead-letter ownership. | Replay produces no duplicate business notice; retry/dead-letter/operator runbook verified. | ⬜ /  |
| Audit logs | Firestore `writeAuditLog`; PostgreSQL `lib/auditLogger.ts`. | One immutable audit-event append policy invoked by canonical commands. | `audit_logs`; outbox/projection only if Firebase Console copy is approved. | `audit.recorded` only if a projection needs it. | Choose canonical audit reader and migrate operational views. | Dual primary-like implementations, differing coverage. | Event parity sample, tamper/access/retention checks, reconciliation report. | ⬜ /  |
| Transactional outbox | None found. | Schema, atomic writer, lease-based publisher, retry/backoff, dead-letter/replay, metrics, and on-call owner. | New approved `outbox_events` and delivery-attempt/dead-letter persistence; do not infer an existing table. | All event types listed above. | Publisher is the only authorised writer of any Firestore business projection. | Entire mechanism absent. | Atomic rollback test, crash-after-commit test, duplicate publish, poison event, replay, alerting drill. | ⬜ /  |

## Required cutover sequence for each row

```text
Approved rule
  → canonical contract (IDs/statuses/ownership)
  → PostgreSQL schema verified and migration reviewed
  → canonical command + idempotency
  → transactional outbox + projection worker
  → readers migrated
  → dual-read/shadow reconciliation and failure tests
  → legacy writer disabled behind a reversible control
  → monitoring period and sign-off
  → collection/table/code retirement decision
```

## Explicit no-go conditions

- Any business-rule row remains unapproved.
- A legacy writer has no named canonical command and no reconciliation report.
- A Firestore projection can still be written directly by a client or legacy business command after cutover.
- `UNKNOWN` payments lack durable evidence, an owner, and a reconciliation path.
- The outbox failure/replay path has not been tested.

## Cutover evidence register

When a domain enters implementation, add a dated link or identifier for: approved business rule, contract version, migration identifier, test evidence, reconciliation report, rollback test, dashboard/alert, monitoring window, and final shutdown approval.
