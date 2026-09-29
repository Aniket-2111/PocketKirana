# PocketKirana — Canonical Order State Machine

## 1. Canonical Status Enum

All order state transitions in PocketKirana are executed exclusively in uppercase values by [lib/services/orderService.ts](file:///d:/pocketkirana/lib/services/orderService.ts).

```
   ┌─────────┐
   │ PLACED  │
   └────┬────┘
        │ (Payment Success or COD confirmed)
        ▼
  ┌───────────┐
  │ CONFIRMED │
  └─────┬─────┘
        │ (Picker starts picking)
        ▼
   ┌─────────┐
   │ PICKING │
   └────┬────┘
        │ (Items scanned & packed)
        ▼
   ┌─────────┐
   │ PACKING │
   └────┬────┘
        │ (Bag sealed & barcode printed)
        ▼
┌──────────────────┐
│ READY_FOR_PICKUP │
└────────┬─────────┘
         │ (Broadcasted to nearest partner)
         ▼
   ┌──────────┐
   │ ASSIGNED │
   └─────┬────┘
         │ (Partner accepts within expires_at)
         ▼
   ┌──────────┐
   │ ACCEPTED │
   └─────┬────┘
         │ (Partner arrives & scans bag pickup OTP)
         ▼
  ┌───────────┐
  │ PICKED_UP │
  └─────┬─────┘
        │ (Transit begins)
        ▼
┌──────────────────┐
│ OUT_FOR_DELIVERY │
└────────┬─────────┘
         │ (Within 500m geofence)
         ▼
┌─────────────────────┐
│ ARRIVED_AT_CUSTOMER │
└──────────┬──────────┘
           │ (Customer OTP verified + Payment collected)
           ▼
     ┌───────────┐
     │ DELIVERED │ (Terminal)
     └───────────┘
```

---

## 2. Precise Lifecycle Status Definitions

- **PLACED**: Order record successfully created, authoritative price frozen, inventory reservation created in PostgreSQL (`stock_reservations`), but payment or COD confirmation has not yet completed. Order is **not** yet eligible for picking.
- **CONFIRMED**: Payment is confirmed via PhonePe webhook/verify (or COD eligibility/confirmation accepted). Stock reservation is locked and order is now placed on the store picking board.
- **PICKING**: An authorized picker has claimed the task and has begun physically scanning product barcodes on store shelves.
- **PACKING**: All line items have been picked and verified against FEFO batch numbers; items are being packed into tamper-evident bags.
- **READY_FOR_PICKUP**: Bag sealed, physical package weight/count logged, pickup OTP generated, and dispatch engine activated for driver matching.
- **ASSIGNED**: Dispatch engine selected an available delivery partner; 60s countdown timer initiated.
- **ACCEPTED**: Delivery partner accepted the assignment and is navigating to the store.
- **PICKED_UP**: Store staff verified the delivery partner's pickup OTP and handed over the sealed package.
- **OUT_FOR_DELIVERY**: Delivery partner departed store and is en route to customer destination.
- **ARRIVED_AT_CUSTOMER**: Delivery partner entered the 500-meter delivery geofence.
- **DELIVERED**: Delivery OTP verified with customer, cash collected (if COD), invoice finalized. **Terminal state**.
- **CANCELLED**: Order aborted by customer, admin, or payment timeout. **Terminal state**.

---

## 3. Order vs. Picker State Coordination Matrix

To prevent drift between picker tasks and customer-facing order states, the coordination is enforced centrally by the service layer:

| Order Status | Picker Task Status | Coordinator Action / Transition Trigger |
| :--- | :--- | :--- |
| **CONFIRMED** | `PENDING` | Order confirmed; task inserted and broadcasted to eligible store pickers. |
| **CONFIRMED** | `ASSIGNED` | Picker accepts task; Order status remains `CONFIRMED`. |
| **PICKING** | `IN_PROGRESS` | Picker begins scanning physical item barcodes. |
| **PACKING** | `PACKED` | Picker completes scanning and packs items into bags. |
| **READY_FOR_PICKUP**| `READY_FOR_PICKUP` | Bag sealed, barcode printed, handed over to dispatch queue. |

---

## 4. Cancellation & Perishable Refund Rules Matrix

> **Important**: Transitioning to `CANCELLED` does **not** automatically imply an automatic full refund. PocketKirana carries perishable grocery goods (dairy, produce, bread) requiring granular financial and restocking rules:

| Situation at Cancellation | Inventory Restocking Action | Financial & Refund Settlement Policy |
| :--- | :--- | :--- |
| **PLACED + Unpaid** | Release PostgreSQL stock reservations immediately. | None (No payment captured). |
| **PhonePe Failed / Expired** | Release reservations back to available stock. | None (Transaction failed at gateway). |
| **CONFIRMED (Paid, Pre-picking)** | Release reservations back to available stock. | Automatic full refund initiated via PhonePe Refund API. |
| **PICKING (Paid)** | Return non-perishable items to shelves; inspect perishables. | Full refund if cancelled due to store delay; policy-based if customer-initiated. |
| **PACKED (Paid)** | Ambient goods restocked; perishable/cut goods written off. | Refund minus perishable write-off and packing fee if customer-initiated. |
| **OUT_FOR_DELIVERY** | Driver returns bag to store; goods placed in quarantine. | Delivery partner trip compensation deducted; partial refund per policy. |
| **DELIVERED** | No cancellation permitted. | Customer must use Dispute / Refund workflow (photo required for perishables). |

---

## 5. Admin Override & Audit Guarantees

When an administrator forces a state transition (e.g. recovering from driver emergency or store exception):
1. **Mandatory Justification**: The override requires a non-empty `reason` parameter.
2. **Comprehensive Audit Tuple**: The audit entry records:
   - `audit_id`: Cryptographically unique identifier (`aud_*`).
   - `actor_uid`: Administrator Firebase UID.
   - `actor_role`: `'admin'`.
   - `order_id`: Target order ID.
   - `old_status`: Previous canonical status.
   - `new_status`: Target canonical status.
   - `reason`: Admin justification text.
   - `timestamp`: Server timestamp.
   - `request_id`: Tracing request ID.
   - `ip_address`: Client remote IP.
   - `user_agent`: Admin browser/device identifier.
3. **Atomic Transaction Enclosure**:
   ```text
   admin override
          ↓
   same PostgreSQL transaction
          ↓
   UPDATE orders
          ↓
   INSERT order_status_history
          ↓
   INSERT audit_logs
          ↓
   INSERT outbox_events
          ↓
   COMMIT
   ```
   No standalone audit write after transaction commit; all records commit together atomically.

---

## 6. Transition Rules Matrix

| From Status | Permitted Target Statuses | Actor Roles Allowed | Key Invariant Requirements |
| :--- | :--- | :--- | :--- |
| **PLACED** | `CONFIRMED`, `CANCELLED` | `system`, `admin` | Gateway payment confirmed or COD verified. |
| **CONFIRMED** | `PICKING`, `CANCELLED` | `picker`, `admin` | Picker accepts task for assigned store. |
| **PICKING** | `PACKING`, `CANCELLED` | `picker`, `admin` | All items scanned matching barcodes & FEFO batches. |
| **PACKING** | `READY_FOR_PICKUP`, `CANCELLED` | `picker`, `admin` | Bag count & weight verified. |
| **READY_FOR_PICKUP**| `ASSIGNED`, `ACCEPTED`, `PICKED_UP`, `CANCELLED` | `system`, `delivery_partner`, `admin` | Dispatch engine finds partner; Pickup OTP generated. |
| **ASSIGNED** | `ACCEPTED`, `PICKED_UP`, `CANCELLED` | `delivery_partner`, `admin` | Partner accepts within server-side `expires_at`. |
| **ACCEPTED** | `PICKED_UP`, `CANCELLED` | `delivery_partner`, `admin` | Store staff verifies pickup OTP. |
| **PICKED_UP** | `OUT_FOR_DELIVERY`, `ARRIVED_AT_CUSTOMER`, `DELIVERED`, `CANCELLED` | `delivery_partner`, `admin` | Transit milestone logged. |
| **OUT_FOR_DELIVERY**| `ARRIVED_AT_CUSTOMER`, `DELIVERED`, `CANCELLED` | `delivery_partner`, `admin` | Geofence proximity reached. |
| **ARRIVED_AT_CUSTOMER**| `DELIVERED`, `CANCELLED` | `delivery_partner`, `admin` | Cash collection confirmed (if COD). |
| **DELIVERED** | None (Terminal) | None | Authoritative delivery OTP verified; Invoice finalized. |
| **CANCELLED** | None (Terminal) | `customer`, `admin`, `system`| Inventory reservations released back to stock. |

---

## 7. Transactional Guarantees

Every call to `OrderService.transitionOrder`:
1. Executes inside `withTransaction(...)` in PostgreSQL.
2. Acquires row-level exclusive lock: `SELECT ... FROM orders WHERE id = $1 FOR UPDATE`.
3. Verifies transition eligibility against `CANONICAL_TRANSITIONS`.
4. Updates `orders` table.
5. Appends audit record to `order_status_history`.
6. Appends audit record to `audit_logs` (for admin overrides).
7. Logs event to `order_events`.
8. Appends domain event to `outbox_events` (e.g. `order.confirmed`, `order.delivered`).
9. Returns idempotent response if current status matches target status.
