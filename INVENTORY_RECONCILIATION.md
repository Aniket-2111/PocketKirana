# PocketKirana — Daily Physical Inventory Reconciliation Workflow
**Module:** Darkstore WMS & Inventory Auditing  
**Primary Engine:** `lib/fefo.ts` & `app/api/inventory/adjust/route.ts`  

---

## 1. Physical vs System Stock Variance Workflow

```text
System Physical Stock (inventory_balances)
              │
              ▼
Physical Shelf Audit by Picker (picker-app/StockCountModal)
              │
              ▼
Variance Calculation (System Qty - Physical Qty)
              │
              ▼
Reason Selection (Damaged / Expired / Missing / Supplier Discrepancy)
              │
              ▼
Darkstore Manager Review & Approval
              │
              ▼
Atomic Stock Adjustment (UPDATE inventory_balances)
              │
              ▼
Immutable Ledger Entry (INSERT INTO inventory_events)
```

---

## 2. Standard Discrepancy Codes & Reasons
1. `DAMAGED`: Goods physically broken, leaked, or packaging torn.
2. `EXPIRED`: Product passed Best Before / Expiry date without clearance sale.
3. `MISSING`: Physical count less than system records (theft / untracked pick).
4. `WRONG_RECEIVING`: Inbound supplier quantity was miscounted at putaway.
5. `PICKING_ERROR`: Wrong SKU was physically picked for a previous order.
6. `CUSTOMER_RETURN`: Undelivered goods returned back to shelf inventory.
7. `SUPPLIER_DISCREPANCY`: Shortage in vendor shipment box.
8. `MANUAL_CORRECTION`: System inventory adjustment approved by Store Manager.

---

## 3. Double-Entry Audit Guarantee
Every single inventory change writes an immutable event into `inventory_events`:
```sql
INSERT INTO inventory_events (
  warehouse_id, variant_id, batch_id, event_type, quantity,
  balance_after, reference_type, reference_id, performed_by, notes, created_at
) VALUES (...);
```
Zero stock changes occur without a logged actor and timestamp.
