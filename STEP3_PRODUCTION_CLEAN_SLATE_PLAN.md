# POCKETKIRANA — STEP 3 PRODUCTION CLEAN-SLATE PLAN

## Executive Verdict

```text
🟢 STEP 3 VERIFIED — CLEAN-SLATE PLAN READY
```

---

## 1. Executive Summary

This read-only forensic planning audit inspects all entities in the production database `pocketkirana_db` to establish a clean-slate recommendation prior to commercial customer launch.

- **Verified Pre-Cleanup Backup**: `D:\pocketkirana\backups\pocketkirana_pre_production_cleanup_20261005_115356.dump` (SHA256: `83de1d1ef5eec595791f11715c5df8168fbd076ee2fd021498d6d51d2c830579`)
- **Execution Confirmation**: **NO DATABASE CLEANUP WAS EXECUTED.** Zero production rows were modified, inserted, updated, or deleted during this planning audit.

---

## 2. Current Production Baseline

- **Database Name**: `pocketkirana_db`
- **PostgreSQL Version**: PostgreSQL 18.6
- **Stores**: 2
- **Warehouses**: 39
- **Products**: 65
- **Orders Total**: 57 (53 historical UAT + 4 today's verification orders)
- **Order Items**: 50
- **Order Addresses**: 13
- **Order Status History**: 22
- **Payments**: 1
- **Outbox Events**: 14
- **Admin Users**: 0
- **Admin Store Assignments**: 0
- **Audit Logs**: 0

---

## 3. Store Classification (Phase 1)

| Store ID | Store Code | Store Name | Status | Coordinates (Lat, Long) | Service Radius | Delivery Fee | Free Delivery Threshold | Business Hours | Classification | Action / Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `store_primary` | `STORE-001` | PocketKirana Central Darkstore | Active (`is_active: true`) | `19.02245360`, `73.32100180` | 3.0 km | ₹29 | ₹499 | 06:00 – 23:00 | **KEEP** | Primary active darkstore for Neral operations. |
| `store_central_001` | `PK-STORE-01` | PocketKirana Central Store | Active (`is_active: true`) | `19.02245360`, `73.32100180` | 3.0 km | ₹29 | ₹499 | 06:00 – 23:00 | **REVIEW** | Duplicate entry created during initial setup. Review whether to keep as secondary store or consolidate into `store_primary`. |

---

## 4. Warehouse Classification (Phase 2)

Total Warehouses: **39**

| Warehouse Range / ID | Store Linkage (`store_id`) | Type | Count | Status | Classification | Action / Notes |
|---|---|---|---|---|---|---|
| `wh_primary` | `store_primary` | Main Darkstore | 1 | Active | **KEEP** | Legitimate darkstore warehouse linked to `store_primary`. |
| `wh_central_001` | `store_central_001` | Main Store | 1 | Active | **KEEP** | Warehouse linked to `store_central_001`. |
| `wh_test_033678` ... `wh_test_296412` | `null` | Main Store | 37 | Active | **REMOVE LATER** | 37 synthetic test warehouses with `store_id = null` created during legacy test runs. |

---

## 5. Product Catalog Classification (Phase 3)

- **Total Master Products**: 65
- **Active Products**: 65
- **Classification**: **KEEP**
- **Notes**: The 65 master products represent the verified catalog (e.g. `p-carrot-1kg`, essential groceries, staples, beverages). All product master data should be retained intact.

---

## 6. Inventory Classification (Phase 4)

- **Inventory Ledgers & Balances**: 190 events recorded in `inventory_events_id_seq`.
- **Classification**:
  - Stock assigned to `wh_primary`: **KEEP**
  - Stock references assigned to synthetic `wh_test_*` warehouses: **REMOVE LATER**

---

## 7. Order Classification (Phase 5)

Total Orders Analyzed: **57**

| Order Group | Range / Order Numbers | Count | Placed Date | Order Status Breakdown | Classification | Action / Notes |
|---|---|---|---|---|---|---|
| **Legacy UAT Orders** | Orders #1 – #44 (`PK-D1-1001` to `PK-E2E-248798`) | 44 | Aug 29 – Sep 02, 2026 | 35 Delivered, 5 Cancelled, 3 Picking, 1 Ready for Pickup | **REMOVE LATER** | Synthetic test orders from early UAT testing. |
| **PhonePe Test Orders** | Orders #45 – #53 (`PK-03` to `PK-11`) | 9 | Sep 29 – Oct 01, 2026 | 6 Placed (PhonePe UAT), 3 Confirmed | **REMOVE LATER** | Synthetic test orders created during PhonePe integration testing. |
| **Today's E2E Verification** | Orders #54 – #56 (`PK-12`, `PK-13`, `PK-14`) | 3 | Oct 05, 2026 | 3 Confirmed | **REMOVE LATER** | Preliminary setup test orders created during auth alignment. |
| **Today's E2E Verified COD Order** | Order #57 (`PK-15`) | 1 | Oct 05, 2026 | 1 Delivered | **REMOVE LATER** | Successful end-to-end verification test order (`ord-1791199051342-e80aa9`). |

*Real Commercial Customer Orders Found: **0** (All 57 orders are test/verification orders).*

---

## 8. Dependency Map for Safe Future Cleanup (Phase 6)

To execute a clean-slate order purge in a future execution step without causing foreign key constraint violations or orphaned records, deletion must follow this exact reverse dependency order:

```text
1. outbox_events (where aggregate_id IN order_ids)
2. order_status_history (where order_id IN order_ids)
3. order_addresses (where order_id IN order_ids)
4. order_items (where order_id IN order_ids)
5. payments (where order_id IN order_ids)
6. orders (DELETE FROM orders WHERE id IN order_ids)
```

---

## 9. Sequence Analysis (Phase 7)

| Sequence Name | Current Value | Restart Safety | Recommended Action for Clean-Slate |
|---|---|---|---|
| `pk_order_seq` | 15 | SAFE | Reset to `1` via `ALTER SEQUENCE pk_order_seq RESTART WITH 1;` so first live customer order starts at `PK-01`. |
| `invoice_number_seq` | 1001 | SAFE | Reset to `1001` via `ALTER SEQUENCE invoice_number_seq RESTART WITH 1001;`. |
| `inventory_events_id_seq` | 190 | SAFE | Preserve or reset depending on stock ledger re-alignment. |
| `pk_product_seq` | 1 | SAFE | Preserve intact. |

---

## 10. KEEP / REVIEW / REMOVE-LATER Recommendation Matrix (Phase 8)

| Data Area | Current Count | KEEP | REVIEW | REMOVE LATER | Reason & Action Plan |
|---|---:|---|---|---|---|
| `stores` | 2 | 1 (`store_primary`) | 1 (`store_central_001`) | 0 | `store_primary` is active darkstore; review duplicate `store_central_001`. |
| `warehouses` | 39 | 2 (`wh_primary`, `wh_central_001`) | 0 | 37 (`wh_test_*`) | 37 synthetic test warehouses with `store_id = null`. |
| `products` | 65 | 65 | 0 | 0 | Valid production master product catalog. |
| `product_variants` | 65 | 65 | 0 | 0 | Valid production SKU variants. |
| `inventory` | Active | Active Darkstore Stock | 0 | Synthetic Stock | Re-align stock balances to `wh_primary`. |
| `orders` | 57 | 0 | 0 | 57 | All 57 orders are synthetic/UAT/verification test orders. |
| `order_items` | 50 | 0 | 0 | 50 | Child records of synthetic test orders. |
| `order_addresses` | 13 | 0 | 0 | 13 | Child records of synthetic test orders. |
| `order_status_history` | 22 | 0 | 0 | 22 | Child records of synthetic test orders. |
| `payments` | 1 | 0 | 0 | 1 | Child records of synthetic test orders. |
| `outbox_events` | 14 | 0 | 0 | 14 | Operational test outbox events. |
| `audit_logs` | 0 | 0 | 0 | 0 | Clean state. |
| `admin_users` | 0 | 0 | 0 | 0 | Clean state. |
| `admin_store_assignments` | 0 | 0 | 0 | 0 | Clean state. |

---

## 11. Risks & Mitigation

1. **FK Order Deletion Violation Risk**: Deleting from `orders` directly will fail if child tables (`order_items`, `order_status_history`, `order_addresses`, `payments`) are deleted in wrong sequence.
   - *Mitigation*: Strictly follow the 6-step Dependency Map in Phase 8.
2. **Order Number Collision Risk**: If `pk_order_seq` is not reset after order cleanup, live customer orders would start at `PK-16` instead of `PK-01`.
   - *Mitigation*: Reset `pk_order_seq` to 1 after order table cleanup.

---

## 12. Recommended Cleanup Sequence

When an explicit future cleanup step is executed:

1. Delete synthetic warehouses (`DELETE FROM warehouses WHERE id LIKE 'wh_test_%'`).
2. Delete child order records (`outbox_events`, `order_status_history`, `order_addresses`, `order_items`, `payments`).
3. Delete synthetic orders (`DELETE FROM orders`).
4. Reset sequences (`pk_order_seq` to 1, `invoice_number_seq` to 1001).
5. Verify database integrity against pre-cleanup backup `D:\pocketkirana\backups\pocketkirana_pre_production_cleanup_20261005_115356.dump`.

---

## 13. Execution Confirmation

```text
NO DATABASE CLEANUP WAS EXECUTED.
ZERO PRODUCTION ROWS WERE MODIFIED, INSERTED, UPDATED, OR DELETED.
```

---

# FINAL VERDICT

```text
🟢 STEP 3 VERIFIED — CLEAN-SLATE PLAN READY
```
