# POCKETKIRANA — DATABASE MIGRATION PLAN & GOVERNANCE

**Status:** 🟡 **PLANNING & GOVERNANCE GATE (NO AUTOMATIC DESTRUCTIVE DDL)**  
**Target Engine:** PostgreSQL 16 (on Oracle Cloud Infrastructure / Localhost)  
**Security Model:** Dual-User Migration Execution (`pk_migrator` for DDL, `pk_app_user` for runtime DML)

---

## 1. Zero-Downtime Migration Philosophy
1. **Decoupled Application & Schema Deployments:** Application code must be backward and forward compatible with the database schema for $N-1$ and $N+1$ versions.
2. **Never Roll Back Destructive DDL:** Migrations are strictly additive. Column drops or table deletions are conducted only after code running the old version has been completely decommissioned for $> 48$ hours.
3. **No Unbounded Table Locks:** Always use `CONCURRENTLY` for index additions (`CREATE INDEX CONCURRENTLY`) and lock timeouts on table alterations (`SET lock_timeout = '2s'`).

---

## 2. Identified Schema Migrations Prior to Production Cutover

### Migration 01: Product Discovery Indexes & Performance Optimization
- **Reason:** Optimize high-frequency catalog discovery queries (`/api/products/discover`, `/api/products/[id]`, and search) to prevent sequential scans during high traffic.
- **Affected Tables:** `products`, `product_variants`.
- **Affected Indexes:**
  - `idx_products_discover_sort` on `products(is_featured DESC, created_at DESC)`
  - `idx_products_category` on `products(category_id)`
  - `idx_products_brand` on `products(brand_id)`
  - `idx_products_status` on `products(status)`
  - `idx_variants_product_display` on `product_variants(product_id, display_order, created_at)`
- **Data Impact:** Zero data loss. Indexes are created non-blockingly.
- **Downtime Requirement:** 0 seconds (zero downtime).
- **Rollback SQL:**
  ```sql
  DROP INDEX CONCURRENTLY IF EXISTS idx_products_discover_sort;
  DROP INDEX CONCURRENTLY IF EXISTS idx_variants_product_display;
  ```
- **Verification Query:**
  ```sql
  SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('products', 'product_variants');
  ```

---

### Migration 02: Dual-User Least-Privilege Provisioning
- **Reason:** Prevent application runtime compromise from executing DDL, `TRUNCATE`, or schema destruction.
- **Affected Tables:** All tables in schema `public`.
- **Roles Created:** `pk_app_user` (DML only), `pk_migrator` (DDL only).
- **Data Impact:** None.
- **Downtime Requirement:** 0 seconds.
- **Script Location:** [`scripts/provision_db_users.sql`](file:///d:/pocketkirana/scripts/provision_db_users.sql)
- **Rollback SQL:**
  ```sql
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM pk_app_user;
  DROP ROLE IF EXISTS pk_app_user;
  ```
- **Verification Query:**
  ```sql
  SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'pk_app_user' LIMIT 10;
  ```

---

### Migration 03: Outbox Leased-Until Performance Index
- **Reason:** Ensure outbox polling query (`WHERE status IN ('PENDING', 'RETRY_SCHEDULED') AND (leased_until IS NULL OR leased_until < NOW()) FOR UPDATE SKIP LOCKED`) utilizes an index seek.
- **Affected Tables:** `outbox_events`.
- **Affected Indexes:** `idx_outbox_pending` on `outbox_events(status, leased_until)`.
- **Data Impact:** None.
- **Downtime Requirement:** 0 seconds.
- **Rollback SQL:**
  ```sql
  DROP INDEX CONCURRENTLY IF EXISTS idx_outbox_pending;
  ```
- **Verification Query:**
  ```sql
  EXPLAIN SELECT id FROM outbox_events WHERE status = 'PENDING' AND leased_until < NOW() FOR UPDATE SKIP LOCKED;
  ```
