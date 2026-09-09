# Reader / Writer Ownership Matrix

**Mode:** Audit / contract only. This is source-code evidence, not an authorization to migrate or delete. “Candidate target” expresses the intended architectural direction found in comments or adjacent code; it is **not** proof of a replacement.

## Executive finding

There is **no active PostgreSQL customer order-creation writer** in the inspected application path. The deployed customer order writer is `functions/src/orders/placeOrder.ts`, which writes the Firestore `orders` collection and then Firestore reservations/tasks. The Next API exposes `GET /api/orders/[id]` and `PATCH /api/orders/[id]/status`, but no `POST /api/orders`. PostgreSQL is therefore not yet a demonstrated replacement for customer order creation.

| Domain / business fact | Active writers (evidence) | Active readers / callers (evidence) | Current authoritative behavior | Candidate target / exact replacement required | Retirement gate |
| --- | --- | --- | --- | --- | --- |
| Customer order creation | `functions/src/orders/placeOrder.ts` → Firestore `orders`; uses PostgreSQL only for `pk_order_seq` number allocation. | `lib/functionsClient.ts`; order UI/services; `app/api/orders/[id]/route.ts` is a separate PostgreSQL reader. | Firestore owns order document creation. | A transactional PostgreSQL order command must create `orders`, items, address snapshot, reservation intent, idempotency record, and outbox event; expose a single authenticated customer endpoint/function. | Prove successful shadow/reconciliation runs and cut client traffic before disabling Function. |
| Order status | Firestore Functions: `placeOrder`, `cancelOrder`, `autoCompleteOrders`, delivery functions; PhonePe webhook/verify also update order status. PostgreSQL status path: `app/api/orders/[id]/status/route.ts`. | Customer/admin/picker/delivery UIs; `app/api/orders/[id]/route.ts`; Firestore service readers. | Split ownership; status vocabulary conflicts. | Approved canonical status graph plus one command owner. Realtime copies may only be post-commit projections. | Approved graph; all readers use canonical projection; invalid-transition tests pass. |
| Online payment record | `app/api/payments/phonepe/create`, `verify`, `webhook` write Firestore `payments`; PhonePe paths mutate Firestore orders. Razorpay verify only verifies signature/returns a result. | Checkout (`app/checkout/page.tsx`); payment reconciliation documentation; order flows. | Firestore payment record is active for PhonePe; Razorpay persistence is incomplete. | PostgreSQL `payments` + immutable gateway-attempt/transaction records, idempotency, and reconciliation queue. | Reconcile gateway IDs/amounts/statuses; webhook replay tests; no unresolved legacy payments. |
| `UNKNOWN` payment uncertainty | No durable canonical writer found; PhonePe verify returns `UNKNOWN_ERROR` in response. | Checkout/client verification caller. | Unresolved uncertainty can disappear after response. | Durable PostgreSQL payment/attempt state and scheduled/manual reconciler, per approved rule. | Approved rule plus demonstrated recovery from timeout, webhook loss, and duplicate callbacks. |
| Stock reservation | `placeOrder` creates `stockReservations` and increments Firestore inventory; `cancelOrder` and `releaseExpiredReservations` release; `verifyPickup` commits. | Order placement/cancellation/delivery functions; inventory UI/function readers. | Firestore transaction owns reservation lifecycle. | PostgreSQL reservation rows and inventory ledger/locking policy tied to the approved payment-uncertainty rule. | Stock/accounting reconciliation across active reservations; expiry and concurrent-checkout tests. |
| Picking / packing | `placeOrder` creates Firestore `pickingTasks`; cancellation and picker/delivery functions update task/order records. PostgreSQL API routes exist for picking/packing task operations. | Picker app calls `/api/picking/...` with Function fallback patterns; task UI reads context/services. | Mixed / unproven replacement. | Specify whether Postgres task APIs become command owner and Firestore becomes projection only. | Map every client call and migrate readers/writers; prove task/order consistency. |
| Delivery assignment & tracking | Firestore Functions `assignPartner`, `acceptAssignment`, `verifyPickup`, `completeDelivery`; API delivery routes use PostgreSQL. | Delivery app/API routes; customer tracking views. | Assignment lifecycle is split; tracking intentionally suits Firestore realtime. | Postgres owns assignment/business lifecycle; Firestore may retain GPS/realtime projection after post-commit outbox publish. | Idempotent assignment and handover tests; projection lag and replay tested. |
| COD collection | `completeDelivery.ts` creates/updates Firestore `payments` and order/assignment data. | Delivery completion flow, reconciliation reporting. | Cash collection is recorded during delivery but exact proof/shortfall policy is not frozen. | Approved COD transaction/collection and exception ledger in PostgreSQL. | Approved COD rule; cash mismatch operational runbook and reconciliation pass. |
| Refund | `cancelOrder.ts` creates Firestore `refunds` with `REQUESTED`; no gateway-execution writer found. | Admin/UI policies and cancellation path. | A request is recorded, but execution/state advancement is incomplete. | Approved PostgreSQL refund state machine and gateway worker/outbox events. | Gateway integration, idempotent retry, reconciliation, and manual-review tests. |
| Partner earnings | `completeDelivery.ts` increments Firestore aggregate balances (`today/week/month`, wallet) directly. | Delivery partner UI and reporting. | Aggregate mutation is vulnerable to duplicate completion effects. | PostgreSQL immutable earnings ledger keyed by assignment/event, with projections. | Exactly-once and reversal tests; aggregate reconciliation to ledger. |
| Notifications | `functions/src/utils.ts#createNotificationRecord` writes Firestore `notifications`; sends FCM directly; `lib/notificationService.ts` and dispatcher also participate. | Admin/customer notification components/services and FCM clients. | Multiple paths; time/random IDs and best-effort sends do not establish durable dedupe/retry ownership. | Outbox-backed notification event/attempt model; Firestore inbox only if approved as projection. | Dedupe/retry/dead-letter policy approved; replay produces no duplicate business notice. |
| Audit logs | Cloud Functions `writeAuditLog` writes Firestore `auditLogs`; `lib/auditLogger.ts` writes PostgreSQL `audit_logs`. | Admin/audit tooling. | Dual implementations; no declared primary enforced in all paths. | Select PostgreSQL as immutable business audit primary, with optional Firestore console projection. | Event parity/reconciliation and retention/access policy approved. |
| PostgreSQL idempotency keys | `lib/idempotency.ts` creates/uses `idempotency_keys`, but no active order/payment route imports it in the inspected paths. | No active caller found for customer order/payment creation. | Capability exists but is not the proven boundary. | Bind it (or approved successor) to every canonical command, using request scope and response semantics. | Concurrency, retry, process-restart, and failed-write tests. |
| Outbox | No active outbox table, writer, publisher, or retry worker found. | N/A. | Missing ownership boundary. | Create only after business approvals: authoritative DB transaction owns event insertion; named worker owns publish/retry/dead-letter. | Owner/runbook/metrics/replay approval and failure-mode tests. |

## Active Firestore business writers requiring explicit replacement mapping

- `functions/src/orders/placeOrder.ts`
- `functions/src/orders/cancelOrder.ts`
- `functions/src/orders/autoCompleteOrders.ts`
- `functions/src/inventory/releaseExpiredReservations.ts`
- `functions/src/delivery/assignPartner.ts`
- `functions/src/delivery/acceptAssignment.ts`
- `functions/src/delivery/verifyPickup.ts`
- `functions/src/delivery/completeDelivery.ts`
- `app/api/payments/phonepe/create/route.ts`
- `app/api/payments/phonepe/verify/route.ts`
- `app/api/payments/phonepe/webhook/route.ts`

## Contract conflicts to resolve before any migration

1. `lib/firestoreSchema.ts` declares orders/payments/refunds/reservations as removed or PostgreSQL-only, while `functions/src/utils.ts` and the active Functions still define and write these Firestore collections.
2. Firestore remains the active customer order writer; PostgreSQL currently contributes order-number allocation in that path, not an order row.
3. PhonePe has several independent state-mutating paths (create/verify/webhook), without a durable `UNKNOWN` state or a transactional outbox.
4. Firestore task/assignment writers coexist with PostgreSQL API task/assignment routes; ownership must be assigned per command before reader migration.

## Required next artifact

For every row, add an implementation mapping only after approval:

`legacy writer → canonical command/API → PostgreSQL tables → outbox event → Firestore projection (if any) → readers migrated → reconciliation report → shutdown owner/date`.
