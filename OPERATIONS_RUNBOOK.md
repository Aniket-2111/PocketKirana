# PocketKirana — Production Operations & Deployment Runbook
**Version:** 1.1.0-STABLE  

---

## 1. System Startup & PM2 Cluster Management

### Start All Services:
```bash
# Start Main Next.js App (Port 3000) and Picker App (Port 3001)
pm2 start ecosystem.config.js

# Verify Cluster Status
pm2 status

# Stream Unified Production Logs
pm2 logs
```

### Zero-Downtime Reload:
```bash
pm2 reload all
```

---

## 2. Daily Darkstore Operations Checklist

### Morning Shift (06:00 AM):
1. **Health Diagnostic:** Run `curl http://localhost:3000/api/health` to verify PostgreSQL pool latency.
2. **Inbound Receiving:** Open `picker-app` -> Navigate to `/putaway` -> Scan arriving supplier boxes and assign to Aisle/Rack/Shelf/Bin.
3. **Expiry Check:** Open Admin Portal -> `ExpiryCenterView` -> Review batches expiring in < 7 days and verify automated clearance discount tiers.

### Active Shift (07:00 AM - 10:00 PM):
1. **Dispatch Monitoring:** Darkstore supervisor keeps `DispatchControlCenterView` open to monitor SLA timers (< 10 min order-to-dispatch target).
2. **Rider Fleet Balance:** Verify at least 2 riders are active in `app/delivery` per 25 active orders.

### Night Close (10:30 PM):
1. **Physical Cycle Count:** Conduct shelf stock count on top 20 velocity SKUs via `StockCountModal`.
2. **Automated Database Backup:** Execute `node scripts/backup_database.js`.
3. **Cash Reconciliation:** Reconcile cash collected by delivery partners against completed COD orders.

---

## 3. Deployment Runbook

1. **Step 1: Pull Baseline:** `git checkout main && git pull origin main`
2. **Step 2: Install Clean Dependencies:** `npm ci --prefer-offline`
3. **Step 3: Verify PostgreSQL Schema:** `node scripts/audit_postgres_schema.js`
4. **Step 4: Build Next.js Production Bundle:** `npm run build`
5. **Step 5: Restart PM2 Workers:** `pm2 reload ecosystem.config.js`
6. **Step 6: Smoke Test Order:** Run `node scripts/e2e_order_to_delivery_test.js`
