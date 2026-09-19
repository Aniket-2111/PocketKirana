# PocketKirana — Phase 14: Backup & Disaster Recovery Architecture

**Document Version:** 1.0.0  
**Effective Date:** 2026-09-19  
**Branch:** `phase-13-production-infrastructure`  
**Production Target:** GCP Cloud SQL PostgreSQL 16 (`pocketkirana-db-prod`, `asia-south1`)  
**Secondary / Offsite Destination:** Google Cloud Storage (`gs://pocketkirana-db-backups-asia-south1-coldline`)  

---

## 1. Executive Summary & Recovery Objectives

PocketKirana's transactional backbone relies on PostgreSQL for canonical business state (orders, inventory, FEFO reservations, payments, and outbox logs), with Firestore and FCM acting as asynchronous read projections and notification delivery channels.

| Metric | Target Objective | Implementation Mechanism |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **$\le 5$ Minutes** | Continuous PostgreSQL Write-Ahead Logging (WAL) & Automated Daily Snapshots |
| **RTO (Recovery Time Objective)** | **$\le 30$ Minutes** | GCP Cloud SQL Point-in-Time Recovery (PITR) to a target clone instance |
| **Daily Snapshots Retention** | **7 Days** | Rolling daily snapshots retained automatically in primary region |
| **Offsite Archive Retention** | **30 Days** | Encrypted exports archived to GCS Coldline storage bucket |
| **Backup Encryption** | **AES-256 / CMEK** | Encrypted at rest and in transit (`TLS 1.3 / sslmode=require`) |

---

## 2. PostgreSQL Backup & Point-in-Time Recovery (PITR) Chain

```text
                  PostgreSQL Production (pocketkirana-db-prod)
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
      Automated Daily Snapshots                     Continuous WAL Archiving
        (02:00 IST / Retention: 7d)                    (Interval: Realtime / 5m)
                 │                                           │
                 └─────────────────────┬─────────────────────┘
                                       ▼
                       Cloud SQL Managed Backup Vault
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
       Primary PITR Engine                          Offsite GCS Archive
   (Restore to clone instance)              (gs://pocketkirana-db-backups-coldline)
                 │                                           │
                 ▼                                           ▼
      Restored Test Database                        Cold Storage Recovery
 (pocketkirana-dr-test-YYYYMMDD)               (Encrypted / Object Retention Lock)
```

---

## 3. Roles & Access Authorization Matrix

| Role | Permitted Actions | Authorized Identity |
| :--- | :--- | :--- |
| **Incident Commander** | Declare disaster scenario, authorize production rollback / restore point | CTO / Lead DevOps |
| **DBA / Infrastructure Operator** | Execute Cloud SQL PITR, run schema verification, configure connection pools | Platform Engineer (IAM Role: `roles/cloudsql.admin`) |
| **Application Runtime (`pk_app_user`)** | Read / write canonical business data; strictly prohibited from backup deletion | Next.js API & Outbox Worker Services |
| **Migration Role (`pk_migrator`)** | DDL migration execution during post-restore verification | Deployment Pipeline (GitHub Actions / Cloud Build) |

---

## 4. Disaster Recovery Drill & Verification Process

### Step 1: Create Recovery Target Instance
Restore the selected point in time to a standalone staging/drill instance (e.g. `pocketkirana-dr-test-2026-09-19`):
```bash
gcloud sql instances clone pocketkirana-db-prod pocketkirana-dr-test-2026-09-19 \
  --point-in-time="2026-09-19T05:00:00.000Z" \
  --project="pocketkirana-prod"
```

### Step 2: Automated Schema & Constraints Verification
Run the verification script against the restored instance to guarantee structural parity:
```bash
DATABASE_URL="postgresql://pk_migrator:SECRET@dr-instance-host:5432/pocketkirana_db?sslmode=require" \
node scripts/verify_production_schema.js
```
- Validates all **62 canonical tables**, **79 foreign keys**, **147 indexes**, and `pk_order_seq`.

### Step 3: Data Integrity & Read Validation
Verify business entity counts and recent timeline entries:
```sql
SELECT 'orders' AS table_name, COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'outbox_events', COUNT(*) FROM outbox_events;
```

### Step 4: Transaction & Fencing Smoke Test
Execute a non-destructive transaction drill (begins transaction, verifies row locking and outbox insertion, and issues `ROLLBACK`):
```sql
BEGIN;
SELECT * FROM inventory WHERE product_id = 'test_item' FOR UPDATE;
INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
VALUES ('dr_test_evt', 'order', 'dr_ord', 'dr.test', '{"test": true}');
ROLLBACK;
```

---

## 5. Firebase & Cloud Functions Disaster Recovery

| Component | Recovery Mechanism | Target Location |
| :--- | :--- | :--- |
| **Firebase Configuration** | Version-controlled in Git (`firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`) | GitHub `production-readiness` / Releases |
| **Firestore Projections** | Automatic resynchronization via Outbox Worker replay | Firestore `orders`, `payments`, `stockReservations` |
| **Cloud Functions (19 Functions)** | Automated redeployment from source directory | `npm run build && firebase deploy --only functions` |
| **Storage Assets** | Automated daily bucket synchronization to backup GCS location | GCS bucket versioning enabled |

---

## 6. Recovery Test Matrix

| Failure Scenario | Recovery Mechanism | Verification Test | Status |
| :--- | :--- | :--- | :---: |
| **PostgreSQL Database Instance Crash** | Cloud SQL High Availability Failover | Automatic replica promotion within 30s | ✅ Verified |
| **Accidental Corruption / Deletion** | Point-in-Time Recovery (PITR) | Clone to selected timestamp ($T - 5\text{m}$) | ✅ Verified |
| **Outbox Worker Process Crash** | PM2 auto-restart + Lease Fencing | Stalled lease expires; Worker B completes event | ✅ Verified |
| **Cloud Functions Outage / Deployment Error** | Immediate rollback to previous build tag | `git checkout <tag> && firebase deploy` | ✅ Verified |
| **Firestore Connectivity Loss** | Outbox transactional durability | Events remain `PENDING` in PostgreSQL; retried upon restore | ✅ Verified |
| **DNS / Edge Routing Outage** | Cloudflare DNS failover & Origin switch | Secondary origin health check | ✅ Verified |
