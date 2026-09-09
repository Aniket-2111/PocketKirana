# Cutover Gap Verification

**Mode:** Audit / contract only  
**Scope:** Source inspection plus read-only live PostgreSQL schema/data audit.  
**Rule:** A gap is not permission to implement it, and an existing table or collection is not permission to delete it.

## Verification result

The source confirms a partial PostgreSQL operational path alongside active Firestore business writers. It does **not** prove a safe ownership transfer for the Orders → Reservations → Payments critical path.

An earlier audit script defaulted to `192.168.0.101:5433`; its refused connection was a **verification-target mismatch**, not evidence that PostgreSQL was unavailable. The corrected, limited verification targeted `192.168.0.103:5433` and completed successfully in `BEGIN TRANSACTION READ ONLY`, ending with `ROLLBACK`.

The prior `.101` attempt returned:

```text
connect ECONNREFUSED 192.168.0.101:5433
```

The live result below is limited to the ten agreed tables and database catalog metadata. It verifies existence, row counts, status distributions, foreign-key relationships, recovery-related column presence, and idempotency counts. It does not verify application traffic, Firestore parity, completeness of historical data, or a safe cutover.

## Corrected live PostgreSQL result — `192.168.0.103:5433`

| Check | Result |
| --- | --- |
| Read safety | `BEGIN TRANSACTION READ ONLY` used; query session ended with `ROLLBACK`; no database writes, migrations, or schema changes. |
| Requested tables | All ten exist: `orders`, `order_items`, `stock_reservations`, `payments`, `payment_transactions`, `refunds`, `idempotency_keys`, `inventory_batches`, `inventory_balances`, `inventory_events`. |
| Orders | 44 rows: 33 `delivered`, 4 `cancelled`, 3 `picking`, 3 `placed`, 1 `ready_for_pickup`. |
| Order items | 37 rows; foreign keys connect `order_items.order_id` to `orders.id` and `order_items.product_id` to `products.id`. |
| Reservations | `stock_reservations` exists but has **0 rows**. Its FKs point to `stores` and `product_variants`; no active reservation can be evidenced from PostgreSQL. |
| Payments | `payments` and `payment_transactions` both exist but have **0 rows**. `payments.order_id → orders.id` and `payment_transactions.payment_id → payments.id` exist. No PostgreSQL payment writer has produced a record in this database. |
| Refunds | Table exists but has **0 rows**; FKs connect to `orders` and `payments`. No PostgreSQL refund lifecycle can be evidenced. |
| Idempotency | `idempotency_keys` has 9 rows and 0 unexpired rows. This proves the table has been used, but not that order/payment commands use it. |
| Inventory model | 68 `inventory_batches` rows (60 `ACTIVE`, 4 `CLEARANCE`, 4 `DISPOSED`), 49 `inventory_balances` rows, and 188 `inventory_events` rows. FKs link balances/events to batch, variant, and warehouse records. |
| Recovery fields | Payment tables have gateway/transaction/status/response fields; reservations have status and expiry; refunds have reason/status/gateway refund ID. Their zero row counts mean no live recovery evidence currently exists for payment, reservation, or refund effects. |

## Critical-path verification

| Domain | Current writer | Current reader / caller evidence | PostgreSQL table / command evidence | Idempotency and transaction boundary | Outbox / Firebase projection | Reconciliation and failure-test gap | Legacy shutdown condition | Provisional classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Orders | **Firestore active:** `functions/src/orders/placeOrder.ts` creates `orders`, reserves Firestore stock, and creates Firestore picking tasks. PostgreSQL is used only for `pk_order_seq`. | Customer checkout imports `callPlaceOrder` from `lib/functionsClient.ts`; Functions client invokes callable `placeOrder`. `GET /api/orders/[id]` reads PostgreSQL. | Live: `orders` (44) and `order_items` (37) exist, and their relationship is constrained. `PATCH /api/orders/[id]/status` is an existing PostgreSQL transaction, but no `POST /api/orders` exists. | `lib/idempotency.ts` exists but is not imported by the active order writer or verified order-status path. Status patch locks the order and writes history atomically; it does not create an outbox row. | No transactional outbox found. Status route and business dispatcher call notifications after commit; this is best-effort, not an outbox. | No order dual-write/shadow comparison, idempotent customer retry, or create-to-read reconciliation evidence found. | Approved contract; canonical create command proven; all customer readers migrated; reconciliation and rollback pass. | **KEEP** legacy writer. **REPLACE** only after proof. No removal. |
| Inventory / reservations | **Firestore active:** order Function reserves; `cancelOrder`, `releaseExpiredReservations`, and `verifyPickup` release/commit inventory/reservations. PostgreSQL inventory APIs also exist for adjacent inventory operations. | Order/delivery Functions and inventory services read Firestore reservation/inventory facts; checkout depends on the Function. | Live: `stock_reservations` and `inventory_events` exist; reservations have 0 rows, while `inventory_events` has 188. No canonical PostgreSQL reserve/release/commit command found. | Firestore transaction protects current reservation updates. No PostgreSQL reservation command using `withIdempotency` or an idempotency key was found. | No outbox publisher found. Projection ownership is therefore undefined. | The approved `UNKNOWN` reservation lifetime does not exist; no stock parity/concurrent reservation/expiry reconciliation evidence found. | Approved payment/reservation rule; canonical DB transactions; stock reconciliation and high-contention retry tests pass. | **KEEP** Firestore lifecycle; **REPLACE** command path is missing. No migration/removal. |
| Payments / PhonePe | **Firestore active:** PhonePe create/verify/webhook read and mutate Firestore `payments` and `orders`. Razorpay create/verify returns gateway data without a durable canonical record. | Checkout calls PhonePe create; success page/mock page call PhonePe verify; checkout calls Razorpay create/verify. | Live: `payments`, `payment_transactions`, and `refunds` exist but each has 0 rows. No canonical PostgreSQL payment command or webhook ledger found. | Payment code implements conditional Firestore status checks but its mutations are not one durable transaction. `UNKNOWN_ERROR` is returned from PhonePe verify without persisted canonical uncertainty. | No transactional outbox/circuit breaker found. Notifications on adjacent status changes are direct/best-effort. | No signed callback replay, gateway-timeout reconciliation, amount parity, duplicate callback, or `UNKNOWN` recovery evidence found. | Approved payment rule; durable provider evidence; one canonical webhook/verification owner; reconciliation worker and tests pass. | **KEEP** Firestore payment paths; **REPLACE** is required. No removal. |

## Verification by requested priority

| Priority / domain | Source-confirmed state | Missing or unproven item | Provisional classification |
| --- | --- | --- | --- |
| 1. Orders | PostgreSQL `GET /api/orders/[id]` and `PATCH /api/orders/[id]/status` exist. The patch path uses `BEGIN`, `SELECT … FOR UPDATE`, update, history insert, then direct notification dispatch. The live database has 44 orders/37 items. Firestore callable remains customer create owner. | Customer create command, order-create transaction, request idempotency, transactional outbox, reader cutover, and source-to-live order reconciliation. | **KEEP / REPLACE** |
| 2. Inventory / reservations | Firestore has the complete active reservation lifecycle. PostgreSQL has inventory data/events but zero reservation rows. | Canonical reserve/release/commit/expiry command, approved uncertainty duration, unique operation keys, outbox/projection, parity reconciliation. | **KEEP / REPLACE** |
| 3. Payments / PhonePe | PhonePe uses three Firestore-mutating routes; Razorpay create/verify does not persist a canonical payment result. PostgreSQL payment/transaction/refund tables exist but are empty. | Durable payment-attempt/reconciliation data, `UNKNOWN` state, one webhook path, idempotency, gateway circuit-breaker, outbox, recovery tests. | **KEEP / REPLACE** |
| 4. Refunds | `functions/src/orders/cancelOrder.ts` creates a Firestore `REQUESTED` refund record when paid. | Gateway refund executor, canonical refund graph, provider idempotency, reconciliation, retry/dead-letter handling. | **KEEP / REPLACE** |
| 5. Picking / packing | PostgreSQL picking accept/item/complete and packing complete routes exist and use SQL transactions. Firestore order Function still creates Firestore picking tasks; picker code calls the PostgreSQL picking endpoints. | Which task identifier/source the live picker uses, creation handoff from canonical order command, idempotency/outbox, Firestore projection rule, live table verification. | **KEEP / MIGRATE / PROJECT (undecided)** |
| 6. Delivery | PostgreSQL assignment accept/pickup/deliver routes exist and transact order status/history; deliver inserts `delivery_earnings`. Firestore Cloud Functions and `lib/functionsClient.ts` still provide active delivery commands. | One lifecycle owner, assignment creation path, stable completion uniqueness constraint, COD canonical payment recording, realtime projection/reconciliation, live schema verification. | **KEEP / MIGRATE / PROJECT (undecided)** |
| 7. Notifications / audit | `notificationDispatcher` sends FCM and appends Firestore inbox records; it deduplicates only in memory for 15 seconds. Cloud Functions also write Firestore notifications/audits; `lib/auditLogger.ts` and `businessEventDispatcher` provide PostgreSQL audit side effects. | Transactional outbox, durable notification attempts/deduplication, selected audit primary, parity reconciliation, retry/dead-letter/replay process. | **KEEP / PROJECT (undecided)** |
| 8. Analytics | `lib/analyticsService.ts` queries PostgreSQL order, inventory, batch, and disposal tables. | Live data/table verification; reconciled source-of-truth inputs while upstream ownership is split; correctness tests against orders/payments/refunds. | **KEEP** PostgreSQL analytics reads; **RECONCILE** before relying on outputs. |

## Important source findings

1. `app/api/orders/[id]/status/route.ts` is a real PostgreSQL transactional status implementation, but uses a status graph different from Firestore Functions and performs notification dispatch outside the transaction. It is a partial operational command, not evidence of a completed order cutover.
2. PostgreSQL picking, packing, and delivery commands are more developed than the order/payment entry path. This does not make them safe to cut over because Firestore Functions and callable clients remain active writers.
3. `app/api/delivery/assignments/[id]/deliver/route.ts` creates a PostgreSQL `delivery_earnings` record in the delivery transaction, while `functions/src/delivery/completeDelivery.ts` directly increments Firestore earnings aggregates. Without a shared completion key/constraint and single owner, duplicate earnings remain possible.
4. `lib/businessEventDispatcher.ts` is a post-commit asynchronous dispatcher; it contains no durable outbox persistence or worker. `lib/notificationDispatcher.ts` writes Firestore notification records directly and uses process-memory deduplication only.
5. `lib/idempotency.ts` can persist keys in PostgreSQL, but source verification found no connection from it to the active customer order, PhonePe, or Razorpay command path.

## Remaining live verification backlog

The corrected connection validates table presence and limited data state. Before any design decision, the following evidence is still required:

1. Table definitions, primary/unique/check constraints, indexes, and nullability required by canonical contracts.
2. Counts and sampled identifier/amount/status parity between Firestore and PostgreSQL for every domain before a reader or writer changes.
3. Whether an `outbox_events` equivalent exists (outside the intentionally limited table scope) and, if so, whether it contains publish/retry evidence.
4. Database-side evidence of transaction/retry failures and any duplicate order/payment/earning records.
5. Order-to-item completeness and provenance analysis: 44 PostgreSQL orders but only 37 order-item rows warrants investigation before treating the order set as production-like canonical data.

## Classification ledger

No component is classified **REMOVE**, **ARCHIVE**, or safely **MIGRATE** yet. The only safe present-tense decisions are:

| Classification | Verified items |
| --- | --- |
| **KEEP** | Active Firestore order/reservation/payment/refund Functions and routes; active PostgreSQL reads/operational routes; both notification/audit paths; PostgreSQL analytics reads. |
| **REPLACE** | Missing canonical PostgreSQL customer-order, reservation, payment, `UNKNOWN` reconciliation, refund-execution, and transactional-outbox paths. |
| **MIGRATE** | Candidate only: existing reader/client paths for picking, packing, delivery, order views, and notification/audit consumers must first be traced and moved by an approved plan. |
| **PROJECT** | Candidate only: Firestore realtime order/task/delivery/notification views may remain as projections, but only after an outbox-backed owner is approved. |
| **ARCHIVE / REMOVE** | **None.** No live-schema/data/reconciliation/shutdown evidence exists. |

## Blocking conclusion

The corrected live database check proves that PostgreSQL is available and contains an operational order/inventory model. It also proves that the payment, payment-transaction, refund, and reservation tables are currently empty. The Orders → Reservations → Payments chain therefore still has no demonstrated PostgreSQL creation/command path or durable recovery/reconciliation boundary. All legacy business writers and related data stores must remain in place. The next gate is business approval and a cutover design that accounts for the verified zero-row payment/reservation state; implementation remains out of scope.
