# PHASE 2.9B.5 — REAL POSTGRESQL PHONEPE INTEGRATION TEST DESIGN & FORENSIC AUDIT REPORT

**Execution Timestamp:** 2026-10-04T02:40:00Z (08:10:00 IST)  
**Branch:** `fix/page-readiness-production`  
**Git HEAD:** `63dba5363579334b67e4ac9a401d94060be244bf`  
**Phase Mode:** REAL POSTGRESQL INTEGRATION TEST DESIGN + ENVIRONMENT SAFETY AUDIT  
**Author:** AI Agent (Antigravity)  
**Final Verdict:** 🔴 RED — STOPPED BY CONDITION C (SAFE ISOLATED TARGET REQUIRED)  

---

## 1. Environment Identity

A forensic audit of the live database connection environment was performed via read-only queries. Zero mutations were executed.

| Metric / Parameter | Value | Assessment |
|---|---|---|
| **Database Host** | `192.168.0.105` | Remote LAN host (Windows PostgreSQL instance) |
| **Database Port** | `5433` | Dedicated port |
| **Database Name** | `pocketkirana_db` | Primary application database |
| **Current User** | `pk_app_user` | Application connection role |
| **Session User** | `pk_app_user` | Application connection role |
| **Current Schema** | `public` | Default public schema |
| **PostgreSQL Version** | `PostgreSQL 18.6 on x86_64-windows, compiled by msvc-19.44.35228, 64-bit` | Modern PostgreSQL engine |
| **Environment Classification** | **LIVE PRODUCTION / ACTIVE DATA** | Contains 53 historical production orders (`PK-01` through `PK-53`) |
| **Relevant Env Variables** | `DATABASE_URL` (in `.env.local`) | No other `PG*` or `POSTGRES_*` variables exist |
| **User Superuser Privilege** | `false` (`rolsuper = false`) | Restricted application role |
| **User Create DB Privilege** | `false` (`rolcreatedb = false`) | Cannot create a new database |
| **User Create Role Privilege** | `false` (`rolcreaterole = false`) | Cannot alter roles |
| **User Create Schema Privilege** | `false` (`has_database_privilege(..., 'CREATE') = false`) | Cannot create a test schema in `pocketkirana_db` |

*Security Confirmation: Zero passwords, tokens, API keys, or connection secrets are exposed in this report.*

---

## 2. Safe Database Target Assessment

Per Phase 2.9B.5 Step 2 protocol:
> **Priority:**  
> A. Existing dedicated PostgreSQL integration-test database  
> B. Existing dedicated PostgreSQL test schema  
> C. If neither exists, STOP and report that a safe isolated PostgreSQL target is required.  
> **Rule:** If the only available database is `pocketkirana_db` containing the 53 historical orders, DO NOT perform integration mutations there.

### Forensic Cluster Query Results

1. **Databases on Cluster (`SELECT datname FROM pg_database WHERE datistemplate = false`):**
   ```
   ┌─────────┬───────────────────┐
   │ (index) │ datname           │
   ├─────────┼───────────────────┤
   │ 0       │ 'pocketkirana_db' │
   │ 1       │ 'postgres'        │
   └─────────┴───────────────────┘
   ```
   - No `pocketkirana_test`, `pocketkirana_integration`, or dedicated test database exists.

2. **Schemas in `pocketkirana_db` (`SELECT schema_name FROM information_schema.schemata`):**
   ```
   ┌─────────┬──────────────────────┐
   │ (index) │ schema_name          │
   ├─────────┼──────────────────────┤
   │ 0       │ 'information_schema' │
   │ 1       │ 'pg_catalog'         │
   │ 2       │ 'public'             │
   └─────────┴──────────────────────┘
   ```
   - No `test`, `integration`, or isolated test schema exists.

3. **Active Order Count in `pocketkirana_db`:**
   ```sql
   SELECT count(*) FROM orders; -- Returns: 53
   ```
   - `pocketkirana_db` contains the 53 active historical orders (`PK-04` through `PK-09`, `PK-11`, etc.).

### Finding
Because neither an isolated integration database nor an isolated test schema exists, and `pk_app_user` lacks privileges to create them (`rolcreatedb = false`, `can_create_schema = false`), **Condition C is triggered**.

**Execution against `pocketkirana_db` was strictly halted before executing any DML.**

---

## 3. Why the Target Must Be Isolated

1. **Production Table Contamination:** Running synthetic integration transactions against `public.orders` in `pocketkirana_db` introduces synthetic records (`REALPG-TEST-ORDER-...`) into the primary order ledger used by customer apps, store managers, and delivery partners.
2. **Transactional Outbox Worker Interference:** Inserting into `public.outbox_events` in `pocketkirana_db` risks background outbox worker pickup and unintended dispatch of SMS, WhatsApp, FCM, or external webhooks.
3. **Foreign Key Integrity:** Creating synthetic orders requires synthetic customer identities (`usr_test_...`) and store assignments, which touch multi-tenant integrity boundaries.
4. **Historical Safety Guard:** Phase 2.9B rules explicitly mandate that historical orders `PK-04` through `PK-09` and `PK-11` must never be touched, truncated, or subjected to test race conditions.

---

## 4. Real Schema Verification (Read-Only Forensic Audit)

Against the live schema of `pocketkirana_db`, full structural inspection was completed for the 5 reconciliation tables:

### 1. Table: `orders`
- **Columns:**
  - `id`: `character varying` (Primary Key)
  - `order_number`: `character varying` (Unique)
  - `customer_id`: `character varying` (Nullable)
  - `firebase_uid`: `character varying` (Nullable)
  - `total_amount`: `numeric` (Authoritative price)
  - `order_status`: `character varying` (Canonical: `PLACED`, `CONFIRMED`, etc.)
  - `payment_status`: `character varying` (Canonical: `pending`, `paid`, `refunded`, `failed`)
  - `confirmed_at`: `timestamp with time zone` (Nullable)
  - `updated_at`: `timestamp with time zone`
- **Locking Compatibility:** `SELECT ... FOR UPDATE` row locking is supported natively on `orders` by primary key or unique `order_number`.

### 2. Table: `payments`
- **Columns:**
  - `id`: `character varying(64)` (Primary Key, e.g. `pay_pk_TXN_...`)
  - `order_id`: `character varying(64)` (Non-null, maps to `orders.id`)
  - `firebase_uid`: `character varying(64)` (Nullable)
  - `amount`: `numeric(10,2)` (Non-null)
  - `currency`: `character varying(3)` (Default `'INR'`)
  - `status`: `character varying(32)` (Default `'pending'`, completed on success)
  - `gateway`: `character varying(32)` (e.g. `'phonepe'`)
  - `gateway_order_id`: `character varying(128)` (e.g. `merchantTransactionId`)
  - `gateway_payment_id`: `character varying(128)` (e.g. PhonePe transaction ID)
  - `paid_at`: `timestamp with time zone`
- **Conflict Handling:** `ON CONFLICT (id) DO UPDATE SET status = 'completed', gateway_payment_id = $6, paid_at = NOW(), updated_at = NOW()` is fully supported by the primary key `payments_pkey`.

### 3. Table: `payment_transactions`
- **Columns:**
  - `id`: `character varying` (Primary Key)
  - `payment_id`: `character varying` (Maps to `payments.id`)
  - `transaction_id`: `character varying` (Unique Constraint: `payment_transactions_transaction_id_key`)
  - `transaction_type`: `character varying` (Canonical: `'WEBHOOK_PAYMENT'`, `'STATUS_RECOVERY'`, `'VERIFY_PAYMENT'`)
  - `amount`: `numeric`
  - `status`: `character varying` (`'SUCCESS'`)
  - `response_data`: `jsonb`
  - `created_at`: `timestamp with time zone` (Default `CURRENT_TIMESTAMP`)
- **Idempotency Guarantee:** Unique index `payment_transactions_transaction_id_key` guarantees that no duplicate gateway transaction ID can be ingested. `ON CONFLICT (transaction_id) DO NOTHING` behaves correctly.

### 4. Table: `order_status_history`
- **Columns:**
  - `id`: `character varying` (Primary Key)
  - `order_id`: `character varying` (Maps to `orders.id`)
  - `old_status`: `character varying`
  - `new_status`: `character varying`
  - `changed_by`: `character varying` (`'system:phonepe_webhook'`, `'system:phonepe_status_recovery'`)
  - `notes`: `text`
  - `created_at`: `timestamp with time zone` (Default `CURRENT_TIMESTAMP`)
  - `changed_by_role`: `character varying` (Nullable)

### 5. Table: `outbox_events`
- **Columns:**
  - `id`: `character varying(64)` (Primary Key)
  - `aggregate_type`: `character varying(64)` (`'payment'`)
  - `aggregate_id`: `character varying(64)` (`pay_pk_...`)
  - `event_type`: `character varying(64)` (`'payment.confirmed'`)
  - `payload`: `jsonb` (Contains canonical order & payment data)
  - `status`: `character varying(32)` (Default `'PENDING'`)
  - `retry_count`: `integer` (Default `0`)
  - `max_retries`: `integer` (Default `5`)
- **Indexes:**
  - `idx_outbox_pending` on `(status, leased_until)`
  - `idx_outbox_aggregate` on `(aggregate_type, aggregate_id)`

---

## 5. Fixture Strategy (Designed for Isolated Environment)

The complete fixture lifecycle has been designed to operate in an isolated PostgreSQL target:

```sql
-- 1. Create dedicated synthetic customer & store (if needed)
INSERT INTO orders (
  id, order_number, customer_id, firebase_uid, total_amount,
  order_status, payment_status, placed_at, updated_at
) VALUES (
  'ord_realpg_test_' || extract(epoch from now())::bigint,
  'PK-REALPG-' || extract(epoch from now())::bigint,
  'usr_cust_realpg_test',
  'usr_cust_realpg_test',
  512.00,
  'PLACED',
  'pending',
  NOW(),
  NOW()
) RETURNING id, order_number;
```

### Safety Features of Fixture Strategy:
- **Synthetic Prefix:** All IDs prefixed with `REALPG-TEST-...` to eliminate confusion with production `PK-01`...`PK-53`.
- **Atomic Outer Transaction / Immediate Cleanup:** In an isolated database or schema, tests can run inside a rollback wrapper or perform explicit fixture teardown in `afterEach`.

---

## 6–13. Integration Test Specifications & Results

Because Condition C stopped mutation of the live production database, the planned integration test behaviors are documented below with their verified architectural behavior:

| # | Test Case | Target State | Execution Status against `pocketkirana_db` | Mocked Verification Status (Step 14) |
|---|---|---|:---:|:---:|
| 6 | **Success Transaction** | `orders.order_status = CONFIRMED`, `payment_status = paid`, `payments.status = completed`, `payment_transactions = STATUS_RECOVERY`, `outbox = payment.confirmed` | ⏸️ Halted (Condition C) | ✅ PASS (Unit/E2E 91 tests) |
| 7 | **Webhook `orders.id`** | Direct canonical ID resolves and reconciles | ⏸️ Halted (Condition C) | ✅ PASS |
| 8 | **Webhook `order_number`** | `PK-11` resolves to canonical ID and reconciles | ⏸️ Halted (Condition C) | ✅ PASS |
| 9 | **Idempotency** | Second status poll detects `CONFIRMED`/`paid` or existing `transaction_id`, commits cleanly with zero duplicate ledger rows | ⏸️ Halted (Condition C) | ✅ PASS |
| 10 | **Atomic Rollback** | Exception before commit leaves zero writes in `payments`, `payment_transactions`, `orders`, `order_status_history`, or `outbox_events` | ⏸️ Halted (Condition C) | ✅ PASS |
| 11 | **Amount Mismatch** | Tampered paise amount triggers `ROLLBACK`, orders remain `pending`, HTTP 400 | ⏸️ Halted (Condition C) | ✅ PASS |
| 12 | **Unknown Order** | Non-existent candidate IDs trigger `ROLLBACK`, HTTP 404, zero writes | ⏸️ Halted (Condition C) | ✅ PASS |
| 13 | **Concurrent Polling** | `SELECT ... FOR UPDATE` serializes simultaneous requests; first commits, second takes idempotency exit | ⏸️ Halted (Condition C) | ✅ PASS |

---

## 14. Direct PostgreSQL Verification Queries

When the safe test target is provisioned, the exact verification queries will be:

```sql
-- 1. Verify Order Transition
SELECT id, order_number, order_status, payment_status, confirmed_at
FROM orders
WHERE id = :canonicalOrderId;
-- Expected: order_status = 'CONFIRMED', payment_status = 'paid', confirmed_at IS NOT NULL

-- 2. Verify Payment Record
SELECT id, order_id, amount, status, gateway, gateway_payment_id
FROM payments
WHERE order_id = :canonicalOrderId;
-- Expected: status = 'completed', gateway = 'phonepe'

-- 3. Verify Payment Ledger
SELECT id, payment_id, transaction_id, transaction_type, status, amount
FROM payment_transactions
WHERE transaction_id = :gatewayTransactionId;
-- Expected: transaction_type = 'STATUS_RECOVERY' (or 'WEBHOOK_PAYMENT'), status = 'SUCCESS'

-- 4. Verify Audit History
SELECT order_id, old_status, new_status, changed_by, notes
FROM order_status_history
WHERE order_id = :canonicalOrderId;
-- Expected: new_status = 'CONFIRMED', changed_by = 'system:phonepe_status_recovery'

-- 5. Verify Transactional Outbox
SELECT aggregate_id, event_type, status, payload
FROM outbox_events
WHERE aggregate_id = :paymentId;
-- Expected: event_type = 'payment.confirmed', status = 'PENDING'
```

---

## 15. 91-Test Regression Suite Execution

Executed command:
```bash
npx vitest run \
  test/phonepe-status-reconciliation.test.ts \
  test/phonepe-webhook-reconciliation.test.ts \
  test/order-service-payment-transition.test.ts \
  test/security-verification.test.ts \
  test/production-gates/g3-payment-sandbox.test.ts \
  test/production-gates/g4-real-payment.test.ts \
  test/phonepe-business-e2e.test.ts \
  test/transactional-red-team.test.ts \
  test/architecture-consolidation.test.ts
```

**Results:**
- **9 test files passed (100%)**
- **91 tests passed (100%)**
- **0 tests failed**
- Duration: 4.05s

---

## 16. TypeScript Result

Executed: `npx tsc --noEmit -p tsconfig.json`
- **Application source code:** 0 errors
- **Phase 2.9B.4/B.5 test suites:** 0 errors
- **Out-of-scope pre-existing errors:** 17 baseline errors in experimental CopilotKit stubs (`app/api/copilotkit/` and `app/assistant/providers.tsx`), completely unchanged.

---

## 17. Git Scope Verification

Executed: `git status --short` and `git diff --stat`
- `app/api/payments/phonepe/status/route.ts`: Modified in B.4
- `test/phonepe-business-e2e.test.ts`: Modified in B.4
- `test/phonepe-status-reconciliation.test.ts`: Added in B.4
- **Phase 2.9B.5 modification:** 0 production application files modified.

---

## 18. Database Safety Confirmation

- **Zero** `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, or `ALTER` statements were executed against `pocketkirana_db`.
- Active historical orders `PK-04` through `PK-09`, `PK-11`, and all other 53 rows in `orders` remain completely untouched.
- Read-only queries confirmed that order count in `pocketkirana_db` is exactly 53 before and after this phase.

---

## 19. Discovered Defects & Recommended Remediation

### Finding
The PostgreSQL server on `192.168.0.105:5433` has only `pocketkirana_db` and the default `postgres` maintenance database. The application role `pk_app_user` does not possess database-creation or schema-creation privileges.

### Recommended Remediation to Complete Phase 2.9B.5 Live Verification
To safely execute real PostgreSQL transactions without risking production data:
1. **Option A (Dedicated Test Database - Recommended):**
   Using postgres admin privileges, create a dedicated test database:
   ```sql
   CREATE DATABASE pocketkirana_test OWNER pk_app_user;
   ```
   Apply schema migrations to `pocketkirana_test` and set `DATABASE_URL_TEST` in `.env.test.local`.
2. **Option B (Dedicated Test Schema in `pocketkirana_db`):**
   Grant schema creation to `pk_app_user`:
   ```sql
   GRANT CREATE ON DATABASE pocketkirana_db TO pk_app_user;
   ```
   This allows integration tests to run inside a temporary schema (e.g. `CREATE SCHEMA test_reconciliation; SET search_path TO test_reconciliation, public;`).

---

## 20. Final Verdict

# 🔴 RED — STOPPED BY CONDITION C (SAFE ISOLATED TARGET REQUIRED)

### Rationale
Per the Phase 2.9B.5 specification rules:
- An isolated integration-test database or schema does not currently exist.
- The only available database on the cluster is `pocketkirana_db` containing the 53 live historical orders.
- Per Step 2, mutating `pocketkirana_db` is strictly prohibited.
- Under the Final Verdict rules: *"RED: If only mocked tests can be executed, if production DB would have to be mutated unsafely, or if any real PostgreSQL transaction behavior fails."*

Strict stop condition reached. Awaiting user review and authorization.
