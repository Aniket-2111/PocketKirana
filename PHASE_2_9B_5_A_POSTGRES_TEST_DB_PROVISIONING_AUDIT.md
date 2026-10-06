# PHASE 2.9B.5-A — PostgreSQL Test Database Provisioning Audit

## 1. Executive Summary

### Verdict
**🟡 ADMIN ACCESS REQUIRED**

### Explanation
Provisioning a dedicated, isolated test database (`pocketkirana_test`) on PostgreSQL server `192.168.0.105:5433` is the architecturally sound, safe, and recommended solution for Phase 2.9B.5 integration testing. It ensures that the active production database (`pocketkirana_db`, containing 53 live orders) is never exposed to synthetic test DML or schema mutations.

However, read-only privilege inspection revealed that neither the application role (`pk_app_user`) nor the migration role (`pk_migrator`) holds `rolcreatedb = true`. Only the administrative role (`postgres`) holds `SUPERUSER` and `CREATEDB` privileges. The development environment currently lacks authenticated administrative credentials for the `postgres` role (SCRAM-SHA-256 authentication required).

Therefore, before Phase 2.9B.5 integration tests can execute against real PostgreSQL, an administrator must either:
1. Connect using administrative credentials (`postgres`) to execute `CREATE DATABASE pocketkirana_test;` and grant ownership/permissions to `pk_app_user`.
2. OR temporarily grant `CREATEDB` to an authorized provisioning role.

---

## 2. Environment

| Property | Value | Source / Verification Evidence |
|---|---|---|
| **PostgreSQL Host** | `192.168.0.105` | `DATABASE_URL` in `.env.local` |
| **PostgreSQL Port** | `5433` | Non-standard port confirmed via active connection |
| **Production Database** | `pocketkirana_db` | Verified active production database (53 orders) |
| **Application Role** | `pk_app_user` | `current_user` from runtime connection pool |
| **PostgreSQL Version** | `PostgreSQL 18.6` | Verified via `SELECT version();` |
| **`psql` Client Availability** | **NOT INSTALLED** | Probed system PATH & disk; client is npm package `pg` (v8.23.0) |

---

## 3. Database Inventory

Queried via read-only metadata (`pg_database` join `pg_roles`):

| Database | Owner | Size | Connection Limit | Purpose | Classification |
|---|---|---:|---:|---|---|
| `pocketkirana_db` | `postgres` | 12 MB (12,869 kB) | -1 (Unlimited) | Active live orders, store operations, inventory | **LIVE PRODUCTION** |
| `postgres` | `postgres` | 8,014 kB | -1 (Unlimited) | PostgreSQL default maintenance/admin database | **SYSTEM / MAINTENANCE** |
| `template0` | `postgres` | 7,724 kB | -1 (Unlimited) | PostgreSQL clean system template | **SYSTEM TEMPLATE** |
| `template1` | `postgres` | 7,724 kB | -1 (Unlimited) | PostgreSQL default template for new databases | **SYSTEM TEMPLATE** |
| `pocketkirana_test` | — | — | — | Target isolated integration test database | **DOES NOT EXIST** |

---

## 4. Role/Privilege Audit

Queried via `pg_roles` and `has_schema_privilege()`:

| Role | LOGIN | SUPERUSER | CREATEDB | CREATEROLE | Relevant DB Privileges |
|---|---|---|---|---|---|
| `postgres` | `true` | `true` | `true` | `true` | Full superuser privileges across all databases |
| `pk_app_user` | `true` | `false` | `false` | `false` | DML on `public` tables; `can_create_schema=false`; cannot create databases |
| `pk_migrator` | `true` | `false` | `false` | `false` | DDL on `public` schema (`create=true`); `can_create_schema=false`; cannot create databases |

### Security Check Verification
- Verified that `pk_app_user` does **NOT** possess `SUPERUSER`, `CREATEDB`, `CREATEROLE`, or `CREATE SCHEMA` privileges.
- Verified that `pk_app_user` cannot create a separate database directly via SQL.
- This is consistent with previous audit findings and adheres to strict least-privilege security.

---

## 5. Migration Architecture

| Property | Details |
|---|---|
| **Migration Directory** | `scripts/` and `scripts/migrations/` |
| **Migration Runner** | Node.js scripts using the `pg` client (`scripts/init_client_postgres_tables.js`, `scripts/migrations/002_add_phase2_store_operational_settings.js`) |
| **Migration Command** | `npm run migrate` (`node scripts/init_client_postgres_tables.js`) |
| **Ordering** | Numerical prefix for migration patches (`001`, `002`); baseline schema initialized via `init_client_postgres_tables.js` |
| **Dependencies / Extensions** | Requires PostgreSQL extension `uuid-ossp` (`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`) |
| **Idempotency** | Initial script uses `CREATE TABLE IF NOT EXISTS` for all 38 tables; indexes created with `IF NOT EXISTS` |
| **Seed / Demo Data** | **ZERO seed data**. The migration scripts contain strictly DDL (`CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`) with no sample orders or mock inventory |
| **Privilege Requirements** | Creating extensions requires superuser privileges or extension ownership; table creation in `public` requires `pk_migrator` or test database owner |
| **Target Database Assumption** | Driven dynamically by `DATABASE_URL` environment variable; does not hardcode `pocketkirana_db` |

---

## 6. Test Database Feasibility

| Question | Assessment & Evidence |
|---|---|
| **1. Can an admin create the database?** | **YES.** Role `postgres` has `SUPERUSER` and `CREATEDB`. Admin connection to `192.168.0.105:5433` can execute `CREATE DATABASE pocketkirana_test OWNER pk_app_user;`. |
| **2. Can `pk_app_user` own the test database?** | **YES.** Assigning ownership of `pocketkirana_test` to `pk_app_user` gives the test runner full schema privileges inside the test database while leaving `pocketkirana_db` completely inaccessible to DDL. |
| **3. Can migrations run against it?** | **YES.** With `DATABASE_URL=postgresql://pk_app_user:...@192.168.0.105:5433/pocketkirana_test`, the table initialization script can apply all 38 tables. (Note: `CREATE EXTENSION "uuid-ossp"` must be run once during admin DB provisioning). |
| **4. Does the app require extra DB privileges?** | **NO.** For payment reconciliation integration testing, normal DML (`SELECT`, `INSERT`, `UPDATE`) on `orders`, `payments`, `payment_logs`, `audit_logs`, `outbox_events` is sufficient. |
| **5. Are extensions required?** | **YES.** `uuid-ossp` is required for `uuid_generate_v4()` defaults in tables. |
| **6. PostgreSQL version requirements?** | Server is `PostgreSQL 18.6`, which is fully compatible with all repository schemas and constraints. |
| **7. Can test DB remain isolated from production?** | **YES, 100%.** PostgreSQL enforces strict database boundary isolation. Queries to `pocketkirana_test` cannot read, lock, or mutate `pocketkirana_db`. |

---

## 7. Environment Isolation

| Component | Current State | Isolation Requirement for Testing |
|---|---|---|
| **`DATABASE_URL`** | Set in `.env.local` pointing to `pocketkirana_db` | Must NOT be modified in `.env.local`. Test runner must use `process.env.DATABASE_URL_TEST` or programmatic override. |
| **`DATABASE_URL_TEST`** | Does NOT currently exist in `.env.local` or environment | Recommended to define `DATABASE_URL_TEST=postgresql://pk_app_user:***@192.168.0.105:5433/pocketkirana_test` for test scripts. |
| **Vitest Configuration** | Vitest loads root configuration; standard suites mock DB queries | Integration test harness must explicitly connect only to `DATABASE_URL_TEST` and abort if target is `pocketkirana_db`. |
| **PM2 Configuration** | `ecosystem.config.js` runs `pocketkirana-web` and `pocketkirana-outbox-worker` | PM2 processes run on the host; they must remain bound exclusively to production `DATABASE_URL` and NEVER be pointed to the test database. |
| **Cloudflare / Production** | Cloudflare tunnels ingress to local port 3000 | Tunnels and public traffic have zero knowledge of or interaction with `pocketkirana_test`. |

---

## 8. Outbox / External Side-Effect Risk

### High-Risk External Adapters Audited:
1. **Outbox Worker (`scripts/run_outbox_worker.js` / `lib/services/outboxWorker.ts`):**
   - Polls `outbox_events` for rows where `status = 'pending'`.
   - On `payment.confirmed` or `order.created`, triggers real external adapters:
     - **Firebase Cloud Messaging (FCM):** Push notifications to customer and store partner devices.
     - **MSG91:** Real SMS OTP/order alerts to customer mobile numbers.
     - **WhatsApp Business API:** Order confirmation messages.
2. **PhonePe Payment Gateway:**
   - Production routes call PhonePe API endpoints. In integration tests, network requests to PhonePe must be mocked or directed to sandbox simulators, never real phonepe.com endpoints.

### Safety Guards Required:
- Integration tests running against `pocketkirana_test` must write to the test DB's `outbox_events`.
- **CRITICAL:** The live PM2 `pocketkirana-outbox-worker` connects to `pocketkirana_db`, so it will NOT see events in `pocketkirana_test`.
- No outbox worker should be started against `pocketkirana_test` during integration tests unless external messaging adapters (FCM, MSG91, WhatsApp) are explicitly mocked or replaced with no-op loggers.

---

## 9. Backup & Rollback Assessment

- **Existing Production Backup:** `scripts/backup_database.js` provides automated `pg_dump` targeting `pocketkirana_db` with a 7-day retention cycle.
- **Rollback Strategy:**
  - Because `pocketkirana_test` is a separate database, tests running within it have **zero blast radius** on `pocketkirana_db`.
  - Rollback of the entire test environment requires only:
    `DROP DATABASE pocketkirana_test;`
  - No restore, migration rollback, or table repair on `pocketkirana_db` will ever be necessary.

---

## 10. Proposed Provisioning Plan (Phase 2.9B.5-B Preparation)

*(DO NOT EXECUTE UNTIL EXPLICITLY APPROVED AND ADMIN CREDENTIALS PROVIDED)*

1. **Admin Provisioning Step (PostgreSQL Admin):**
   ```sql
   CREATE DATABASE pocketkirana_test OWNER pk_app_user;
   \c pocketkirana_test
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   GRANT ALL PRIVILEGES ON DATABASE pocketkirana_test TO pk_app_user;
   GRANT ALL ON SCHEMA public TO pk_app_user;
   ```
2. **Test Environment Configuration:**
   - Export `DATABASE_URL_TEST=postgresql://pk_app_user:<password>@192.168.0.105:5433/pocketkirana_test`.
   - Ensure test suite includes an explicit safety assert:
     ```ts
     const dbName = new URL(testDbUrl).pathname.replace(/^\//, '');
     if (dbName === 'pocketkirana_db') {
       throw new Error('FATAL: Attempted to run integration tests against production pocketkirana_db!');
     }
     ```
3. **Schema Initialization:**
   - Run `node scripts/init_client_postgres_tables.js` with `DATABASE_URL=$DATABASE_URL_TEST`.
   - Run incremental migration `002_add_phase2_store_operational_settings.js` on test database.
4. **Integration Test Execution:**
   - Run `vitest run test/real-postgres-phonepe-integration.test.ts`.
   - Validate OrderService state transition, webhook idempotency, and status recovery against real PostgreSQL rows.
5. **Post-Test Verification & Teardown:**
   - Verify `pocketkirana_db` order count remains exactly 53.
   - Clean up synthetic test records or drop `pocketkirana_test` upon completion.

---

## 11. Production Safety Verification

A complete read-only safety inspection was executed at the conclusion of this audit:

| Verification Item | Result | Evidence |
|---|---|---|
| `pocketkirana_db` status | **UNTOUCHED** | Database exists and operates normally |
| Production orders count | **53 (EXACT)** | `SELECT count(*) FROM orders;` = 53 |
| Production mutations executed | **0 (ZERO)** | Strict read-only inspection; no DML or DDL executed |
| Role privileges modified | **0 (ZERO)** | `pg_roles` unchanged |
| Working tree modification | **0 (ZERO)** | `git status --short` confirms no application code or configs touched |
| Outbox worker / Daemons | **UNTOUCHED** | No workers started or stopped |
| Test database created | **NO** | `pocketkirana_test` was NOT created during this phase |

---

## 12. Final Verdict

### **🟡 ADMIN ACCESS REQUIRED**

### Blocking Conditions:
1. `pk_app_user` lacks `CREATEDB` privileges on PostgreSQL server `192.168.0.105:5433`.
2. Administrative credentials for role `postgres` are required to execute `CREATE DATABASE pocketkirana_test;` and `CREATE EXTENSION "uuid-ossp";`.
3. Once an administrator provisions `pocketkirana_test` and provides the test connection string, the system will immediately achieve `🟢 READY FOR PROVISIONING` status for Phase 2.9B.5 integration testing.
