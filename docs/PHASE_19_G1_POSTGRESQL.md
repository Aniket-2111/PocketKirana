# Phase 19 — Gate G1: Production PostgreSQL Verification

## 1. Specification & Criteria
The G1 Gate establishes the authoritative criteria for PostgreSQL 16 on GCP Cloud SQL (`pocketkirana-db-prod`, `asia-south1`).

### 1.1 Infrastructure & Connectivity
- **PostgreSQL Version:** 16.x
- **Network Security:** TLS 1.3 enforced (`sslmode=verify-full` / `require`).
- **Connection Pooling:** PgBouncer connection pooling active (`max_client_conn=500`, `default_pool_size=50`).
- **Encoding & Timezone:** UTF-8, UTC.

### 1.2 Dual-User Role Privilege Model
- `pk_app_user`: DML only (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). Zero DDL (`CREATE`, `DROP`, `ALTER`).
- `pk_migrator`: Schema migration and DDL management. Application runtimes must never connect as `pk_migrator`.

### 1.3 Schema & Relational Integrity
- **Tables:** 62 tables.
- **Foreign Keys:** 79 foreign keys with `ON DELETE RESTRICT` or `CASCADE` where appropriate.
- **Indexes:** 147 performance and uniqueness indexes.
- **Sequences:** `pk_order_seq` for monotonic order numbers.

### 1.4 Backup & Disaster Recovery
- **Daily Automated Snapshots:** 7-day retention in Cloud SQL.
- **Point-In-Time Recovery (PITR):** WAL archiving enabled with $\le 5\text{m}$ RPO.
- **Offsite Coldline Archive:** `gs://pocketkirana-db-backups-asia-south1-coldline` (30-day retention with CMEK encryption).
