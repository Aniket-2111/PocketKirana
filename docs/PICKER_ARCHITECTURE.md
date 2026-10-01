# PocketKirana — Picker Task Architecture

## 1. Task Lifecycle & Ownership

Picker tasks originate from confirmed orders and belong authoritatively to PostgreSQL (`picker_tasks` and `picker_task_items`).

### Status Lifecycle & Order Synchronization
```text
Order:   CONFIRMED ──────► CONFIRMED ──────► PICKING ──────► PACKING ──────► READY_FOR_PICKUP
             │                 │                │               │                  │
Picker:   PENDING  ──────►  ASSIGNED ──────► IN_PROGRESS ──►  PACKED  ──────► READY_FOR_PICKUP
```

### Picker vs Order State Coordination Table:
| Picker Task Status | Order Status | System & Transactional Action |
| :--- | :--- | :--- |
| `PENDING` | `CONFIRMED` | Created upon payment/COD confirmation; eligible pickers alerted. |
| `ASSIGNED` | `CONFIRMED` | Store picker claims task; order status remains `CONFIRMED`. |
| `IN_PROGRESS` | `PICKING` | Picker scans first shelf item; order transitions to `PICKING`. |
| `PACKED` | `PACKING` | Picker completes scanning; packing bags initiated. |
| `READY_FOR_PICKUP` | `READY_FOR_PICKUP` | Bags sealed, package weight/count logged, pickup OTP generated. |

Both systems are coordinated via `PickerService` calling `OrderService.transitionOrder` in PostgreSQL transactions so the two states never drift independently.

---

## 2. Barcode Validation & FEFO Enforcement

1. **Barcode Scan**: The picker must scan the physical barcode (EAN-13, UPC, or custom SKU) matching `order_items.sku`.
2. **Batch Verification**: The system guides the picker to the specific FEFO batch allocated during order reservation.
3. **Quantity Bounds**: Picked quantity can never exceed the quantity reserved for that order line item.
4. **Substitutions**: If an item is damaged or out of stock, substitution or quantity reduction triggers customer notification and recalculates the order invoice.

---

## 3. Realtime Projection & State Reflection

- State updates are written first to PostgreSQL `picker_tasks`.
- Realtime mirrors are projected to Firestore `picking_tasks/{taskId}` to provide instant visual feedback on the picker Android tablet.
- Firestore serves as a reactive view only; attempts to update picker state directly via the Firebase Client SDK without calling `/api/picker/**` are rejected by security rules.
