# PocketKirana — Production Disaster Recovery Runbook

**Runbook Code:** PK-SOP-DR-001  
**Classification:** Internal Confidential / Production Operations  
**Target Architecture:** GCP Cloud SQL PostgreSQL 16 + Firebase + Next.js Platform  

---

## Complete 18-Step Disaster Recovery Procedure

```text
  [1. INCIDENT DECLARATION]
              │
              ▼
  [2. FAILURE TRIAGE] ──────► [3. FREEZE WRITES (MAINTENANCE MODE)]
                                          │
                                          ▼
                             [4. SELECT RECOVERY TIMESTAMP]
                                          │
                                          ▼
                             [5. RESTORE POSTGRESQL (PITR)]
                                          │
                                          ▼
                             [6. RUN SCHEMA VERIFICATION]
                                          │
                                          ▼
                             [7. DATA INTEGRITY AUDIT]
                                          │
                                          ▼
                             [8. RECONNECT FIREBASE SERVICES]
                                          │
                                          ▼
                             [9. DEPLOY VERIFIED APP TAG]
                                          │
                                          ▼
                            [10. INJECT SECRETS FROM VAULT]
                                          │
                                          ▼
                            [11. VERIFY 19 CLOUD FUNCTIONS]
                                          │
                                          ▼
                            [12. START OUTBOX WORKER DAEMON]
                                          │
                                          ▼
                            [13. AUDIT PAYMENT GATEWAYS]
                                          │
                                          ▼
                            [14. TEST NOTIFICATION CHANNELS]
                                          │
                                          ▼
                            [15. RUN INFRASTRUCTURE SMOKE TEST]
                                          │
                                          ▼
                            [16. UNFREEZE / RE-ENABLE TRAFFIC]
                                          │
                                          ▼
                            [17. POST-INCIDENT MONITORING]
                                          │
                                          ▼
                            [18. FORMAL INCIDENT CLOSURE]
```

---

### Step 1: Declare Incident
- **Trigger:** Production outage, database data corruption, regional cloud failure, or ransomware incident.
- **Action:** Incident Commander broadcasts status on emergency channel and establishes war room.

### Step 2: Identify Failure & Triage
- Classify outage tier:
  - **Tier 1:** Full database loss or data corruption (Requires Cloud SQL PITR clone).
  - **Tier 2:** Application / Outbox worker crash (Requires process reload).
  - **Tier 3:** External service degradation (PhonePe / FCM / Cloudflare).

### Step 3: Freeze Writes (Maintenance Mode)
- Enable Cloudflare "Under Maintenance" page to prevent client applications from sending non-idempotent checkout requests:
  ```bash
  # Route all incoming customer traffic to static maintenance page
  npm run cf:maintenance-on
  ```

### Step 4: Select Recovery Point
- Identify the exact timestamp ($T_{\text{target}}$) immediately preceding corruption or outage.

### Step 5: Restore PostgreSQL (Point-in-Time Recovery)
- Execute Point-in-Time Recovery to a target clone instance in GCP:
  ```bash
  gcloud sql instances clone pocketkirana-db-prod pocketkirana-db-recovered \
    --point-in-time="2026-09-19T05:25:00.000Z" \
    --project="pocketkirana-prod"
  ```

### Step 6: Verify Schema
- Run the schema validator against the recovered database:
  ```bash
  node scripts/verify_production_schema.js
  ```
- Must confirm all 62 tables, 79 FKs, 147 indexes, and `pk_order_seq`.

### Step 7: Data Integrity Audit
- Verify the latest consistent order, stock balance, and payment transaction IDs:
  ```sql
  SELECT MAX(id) FROM orders;
  SELECT MAX(id) FROM payments;
  SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING';
  ```

### Step 8: Restore & Reconnect Firebase
- Deploy Firestore security rules and storage rules:
  ```bash
  firebase deploy --only firestore:rules,storage:rules --project pocketkirana-prod
  ```

### Step 9: Deploy Application Version
- Deploy the verified stable Git tag (e.g. `phase-12-complete`):
  ```bash
  git checkout tags/phase-12-complete
  npm run build
  ```

### Step 10: Configure Secrets
- Rehydrate `.env.production` from Google Secret Manager / Cloud Vault. Ensure `pk_app_user` credentials point to the recovered database.

### Step 11: Verify 19 Cloud Functions
- Verify that all 19 Cloud Functions compile and respond to health probes:
  ```bash
  curl -I https://asia-south1-pocketkirana-prod.cloudfunctions.net/healthCheck
  ```

### Step 12: Start Outbox Worker Daemon
- Start the background Outbox Worker process with lease-token fencing enabled:
  ```bash
  pm2 start ecosystem.config.js
  ```
- Observe `logs/main-out.log` to confirm worker starts leasing and projecting backlog events to Firestore.

### Step 13: Audit Payment Gateways
- Validate PhonePe and Razorpay webhook callback endpoints and verification keys.

### Step 14: Test Notification Channels
- Verify that FCM push dispatch and browser audio alerts are functioning.

### Step 15: Run Infrastructure Smoke Tests
- Run automated validation suite against the staging/recovered endpoint:
  ```bash
  npm test
  ```

### Step 16: Re-Enable Traffic
- Disable Cloudflare maintenance mode and allow live customer traffic:
  ```bash
  npm run cf:maintenance-off
  ```

### Step 17: Post-Incident Monitoring
- Monitor error rates, database CPU, connection pool headroom, and outbox throughput for at least 60 minutes.

### Step 18: Close Incident & Post-Mortem Report
- Archive logs, record incident timeline, document root cause, and log RCA in `docs/PILOT_INCIDENT_LOG.md`.
