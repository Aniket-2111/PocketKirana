# POCKETKIRANA — PRODUCTION CLEAN-SLATE PLAN REPORT

---

## 1. Executive Summary

This report establishes the complete, evidence-based plan for resetting PocketKirana's PostgreSQL database (`pocketkirana_db`) into a clean production state.

### Core Cleanup Objectives:
1. **Preserve Master Catalog & Schema**: Preserve all 65 master products, 219 product variants, 54 categories, 13 brands, 28 product identifiers, and 5 system roles. Preserve all 65 table structures, indexes, foreign keys, triggers, and procedures.
2. **Purge Test & Operational Noise**: Remove all 58 test orders, 51 order items, 14 order addresses, 31 order status histories, 33 delivery assignments, 38 picking tasks, 34 packing tasks, 68 test inventory batches, 49 test inventory balances, 188 inventory events, 39 test warehouses (37 orphan + 2 test store warehouses), and 2 test stores (`store_primary` and `store_central_001`).
3. **Clean-Slate Baseline**: Leave the database in a state with **0 active orders, 0 stock quantities, 0 test warehouses, and 0 test stores**.
4. **Backup Verification**: Backup file `D:\pocketkirana\backups\pocketkirana_pre_production_cleanup_20261005_115356.dump` was verified with SHA256 checksum `83DE1D1EF5EEC595791F11715C5DF8168FBD076EE2FD021498D6D51D2C830579`.

---

## 2. Backup Verification Status

- **File Location**: `D:\pocketkirana\backups\pocketkirana_pre_production_cleanup_20261005_115356.dump`
- **Expected SHA256**: `83de1d1ef5eec595791f11715c5df8168fbd076ee2fd021498d6d51d2c830579`
- **Actual SHA256**: `83DE1D1EF5EEC595791F11715C5DF8168FBD076EE2FD021498D6D51D2C830579`
- **Verification Result**: **MATCH CONFIRMED (PASS)**.

---

## 3. Complete Table Inventory & Row Counts

The database contains **65 total tables** in the `public` schema.

| Table Name | Current Row Count | Planned Action | Classification |
|---|---|---|---|
| `admin_store_assignments` | 0 | PRESERVE | REQUIRED REFERENCE |
| `admin_users` | 0 | PRESERVE | REQUIRED REFERENCE |
| `audit_logs` | 4 | **DELETE (4 rows)** | DELETE (Test Audit Data) |
| `brand_categories` | 24 | **PRESERVE (24 rows)** | KEEP (Master Catalog Mapping) |
| `brand_subcategories` | 35 | **PRESERVE (35 rows)** | KEEP (Master Catalog Mapping) |
| `brands` | 13 | **PRESERVE (13 rows)** | KEEP (Master Catalog) |
| `cart_items` | 0 | PRESERVE | REQUIRED REFERENCE |
| `carts` | 0 | PRESERVE | REQUIRED REFERENCE |
| `categories` | 54 | **PRESERVE (54 rows)** | KEEP (Master Catalog Taxonomy) |
| `coupon_usage` | 0 | PRESERVE | REQUIRED REFERENCE |
| `coupons` | 0 | PRESERVE | REQUIRED REFERENCE |
| `daily_statistics` | 0 | PRESERVE | REQUIRED REFERENCE |
| `delivery_assignments` | 33 | **DELETE (33 rows)** | DELETE (Test Delivery Operations) |
| `delivery_earnings` | 4 | **DELETE (4 rows)** | DELETE (Test Earnings) |
| `delivery_partners` | 18 | **DELETE (18 rows)** | DELETE (Test Partner Accounts) |
| `delivery_status_history` | 0 | PRESERVE | REQUIRED REFERENCE |
| `delivery_tracking` | 0 | PRESERVE | REQUIRED REFERENCE |
| `delivery_zones` | 0 | PRESERVE | REQUIRED REFERENCE |
| `expiry_alerts` | 0 | PRESERVE | REQUIRED REFERENCE |
| `expiry_records` | 0 | PRESERVE | REQUIRED REFERENCE |
| `idempotency_keys` | 11 | **DELETE (11 rows)** | DELETE (Test Requests) |
| `inventory` | 0 | PRESERVE | REQUIRED REFERENCE |
| `inventory_balances` | 49 | **DELETE (49 rows)** | DELETE (Test Stock Balances) |
| `inventory_batches` | 68 | **DELETE (68 rows)** | DELETE (Test FEFO Batches) |
| `inventory_events` | 188 | **DELETE (188 rows)** | DELETE (Test Audit Ledger) |
| `inventory_transactions` | 0 | PRESERVE | REQUIRED REFERENCE |
| `invoice_records` | 1 | **DELETE (1 row)** | DELETE (Test Invoice) |
| `notifications` | 0 | PRESERVE | REQUIRED REFERENCE |
| `offer_categories` | 0 | PRESERVE | REQUIRED REFERENCE |
| `offer_products` | 0 | PRESERVE | REQUIRED REFERENCE |
| `offers` | 0 | PRESERVE | REQUIRED REFERENCE |
| `order_addresses` | 14 | **DELETE (14 rows)** | DELETE (Test Order Addresses) |
| `order_items` | 51 | **DELETE (51 rows)** | DELETE (Test Order Items) |
| `order_notes` | 0 | PRESERVE | REQUIRED REFERENCE |
| `order_status_history` | 31 | **DELETE (31 rows)** | DELETE (Test Status History) |
| `orders` | 58 | **DELETE (58 rows)** | DELETE (Test Orders) |
| `outbox_events` | 15 | **DELETE (15 rows)** | DELETE (Test Domain Events) |
| `packing_items` | 4 | **DELETE (4 rows)** | DELETE (Test Packing Items) |
| `packing_tasks` | 34 | **DELETE (34 rows)** | DELETE (Test Packing Tasks) |
| `partner_auth_tokens` | 0 | PRESERVE | REQUIRED REFERENCE |
| `payment_transactions` | 1 | **DELETE (1 row)** | DELETE (Test Transactions) |
| `payments` | 2 | **DELETE (2 rows)** | DELETE (Test Payments) |
| `permissions` | 0 | PRESERVE | REQUIRED REFERENCE |
| `picking_task_items` | 4 | **DELETE (4 rows)** | DELETE (Test Picking Items) |
| `picking_tasks` | 38 | **DELETE (38 rows)** | DELETE (Test Picking Tasks) |
| `product_attribute_values` | 0 | PRESERVE | REQUIRED REFERENCE |
| `product_attributes` | 0 | PRESERVE | REQUIRED REFERENCE |
| `product_identifiers` | 28 | **PRESERVE (28 rows)** | KEEP (Master Barcodes) |
| `product_images` | 0 | PRESERVE | REQUIRED REFERENCE |
| `product_variants` | 219 | **PRESERVE (219 rows)** | KEEP (Master SKUs) |
| `products` | 65 | **PRESERVE (65 rows)** | KEEP (Master Products) |
| `promotion_usage_logs` | 0 | PRESERVE | REQUIRED REFERENCE |
| `promotions` | 4 | **PRESERVE (4 rows)** | KEEP (Marketing Promotions) |
| `refunds` | 0 | PRESERVE | REQUIRED REFERENCE |
| `reviews` | 0 | PRESERVE | REQUIRED REFERENCE |
| `role_permissions` | 0 | PRESERVE | REQUIRED REFERENCE |
| `roles` | 5 | **PRESERVE (5 rows)** | KEEP (System RBAC Roles) |
| `sales_summaries` | 0 | PRESERVE | REQUIRED REFERENCE |
| `stock_disposals` | 4 | **DELETE (4 rows)** | DELETE (Test Write-Offs) |
| `stock_reservations` | 0 | PRESERVE | REQUIRED REFERENCE |
| `stores` | 2 | **DELETE (2 rows)** | DELETE (Test Stores) |
| `support_tickets` | 0 | PRESERVE | REQUIRED REFERENCE |
| `warehouses` | 39 | **DELETE (39 rows)** | DELETE (Test Warehouses) |
| `wishlist_items` | 0 | PRESERVE | REQUIRED REFERENCE |
| `wishlists` | 0 | PRESERVE | REQUIRED REFERENCE |

---

## 4. Summary Classification

- **KEEP (Real Master / Catalog & Roles)**: **9 Tables** (`products`, `product_variants`, `categories`, `brands`, `brand_categories`, `brand_subcategories`, `product_identifiers`, `roles`, `promotions`). Total rows kept: **448 rows**.
- **DELETE (Test & Temporary Operational Data)**: **23 Tables** (`orders`, `order_items`, `order_addresses`, `order_status_history`, `payments`, `payment_transactions`, `invoice_records`, `outbox_events`, `audit_logs`, `idempotency_keys`, `picking_tasks`, `picking_task_items`, `packing_tasks`, `packing_items`, `delivery_assignments`, `delivery_earnings`, `delivery_partners`, `inventory_batches`, `inventory_balances`, `inventory_events`, `stock_disposals`, `stores`, `warehouses`). Total rows deleted: **624 rows**.
- **REQUIRED REFERENCE (Empty Structural Tables Preserved)**: **33 Tables** (Preserved with 0 rows).
- **UNKNOWN**: **0 Tables** (All tables 100% categorized).

---

## 5. Foreign-Key Compliant Deletion Order

To prevent foreign-key violation errors (`violates foreign key constraint`), the cleanup execution script will execute deletions in the following strict topological order:

```sql
BEGIN;

-- Phase 1: Operational & Delivery Child Records
DELETE FROM delivery_earnings;
DELETE FROM delivery_status_history;
DELETE FROM delivery_tracking;
DELETE FROM partner_auth_tokens;
DELETE FROM packing_items;
DELETE FROM packing_tasks;
DELETE FROM picking_task_items;
DELETE FROM picking_tasks;
DELETE FROM delivery_assignments;
DELETE FROM delivery_partners;

-- Phase 2: Financial & Order Child Records
DELETE FROM payment_transactions;
DELETE FROM refunds;
DELETE FROM payments;
DELETE FROM invoice_records;
DELETE FROM order_status_history;
DELETE FROM order_notes;
DELETE FROM order_addresses;
DELETE FROM order_items;
DELETE FROM promotion_usage_logs;
DELETE FROM coupon_usage;
DELETE FROM reviews;
DELETE FROM support_tickets;
DELETE FROM audit_logs;
DELETE FROM outbox_events;
DELETE FROM idempotency_keys;
DELETE FROM orders;

-- Phase 3: Carts & Wishlists
DELETE FROM cart_items;
DELETE FROM carts;
DELETE FROM wishlist_items;
DELETE FROM wishlists;

-- Phase 4: Stock, FEFO & Inventory Ledger Records
DELETE FROM stock_disposals;
DELETE FROM expiry_alerts;
DELETE FROM expiry_records;
DELETE FROM stock_reservations;
DELETE FROM inventory_events;
DELETE FROM inventory_balances;
DELETE FROM inventory_batches;
DELETE FROM inventory_transactions;
DELETE FROM inventory;

-- Phase 5: Stores & Warehouses
DELETE FROM warehouses;
DELETE FROM admin_store_assignments;
DELETE FROM admin_users;
DELETE FROM stores;

COMMIT;
```

---

## 6. Sequence Reset Plan

| Sequence Name | Current Value | Action / Reset Command | Expected Post-Reset State |
|---|---|---|---|
| `pk_order_seq` | `16` (is_called = true) | `ALTER SEQUENCE pk_order_seq RESTART WITH 1;` | `1` (Fresh order numbers starting at #1 / PK-10001) |
| `inventory_events_id_seq` | `190` (is_called = true) | `ALTER SEQUENCE inventory_events_id_seq RESTART WITH 1;` | `1` (Fresh audit event ledger) |
| `invoice_number_seq` | `1001` (is_called = false) | `ALTER SEQUENCE invoice_number_seq RESTART WITH 1001;` | `1001` (Fresh invoice numbering baseline) |
| `pk_product_seq` | `1` (is_called = false) | **PRESERVE (Do not reset)** | `1` (Preserved for existing catalog items) |

---

## 7. Operational Model Treatment Plan

### Product Catalog Treatment:
- All **65 master products** and **219 product variants** remain intact.
- Product descriptions, SKUs, MRPs, selling prices, categories, and barcodes are preserved.
- Stock counts on `products` and `product_variants` will be initialized to `0`.

### Inventory Treatment:
- All 68 test inventory batches, 49 test balances, and 188 inventory events are deleted.
- Physical available stock starts at **0** until opening stock is inwarded by the production admin.

### Store & Warehouse Treatment:
- Both existing test stores (`store_primary` and `store_central_001`) and all 39 test warehouses will be deleted.
- When the new production store is registered via the canonical store registration API, the backend will auto-provision exactly **ONE INTERNAL STOCK LOCATION WAREHOUSE** (`wh_<new_store_id>`) linked 1-to-1 to the store.

### Order & Payment Treatment:
- All 58 test orders and dependent payments/deliveries are deleted.
- Outbox event stream and audit logs will start completely clean.

---

## 8. Final Expected Database State

- **Total Tables**: 65 Tables (0 tables dropped).
- **Master Catalog Data**: 65 Products, 219 Product Variants, 54 Categories, 13 Brands, 28 Identifiers, 5 Roles, 4 Promotions.
- **Active Orders**: 0 Orders.
- **Active Stores**: 0 Stores (Ready for single production store creation).
- **Active Warehouses**: 0 Warehouses (Ready for single internal warehouse auto-provisioning).
- **Total Stock**: 0 Available Units.

---

### MANDATORY STATEMENT

**PRE-CLEANUP PLAN COMPLETE — NO DATA MODIFIED**
