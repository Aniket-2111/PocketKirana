# Phase 20 — Go / No-Go Decision Criteria Matrix

| Domain | Strict Requirement | Evaluation Method | Go/No-Go Standard | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Infrastructure** | All production services operational | `/api/health?deep=true` | HTTP 200, status "ok" | **GO** |
| **Database** | PostgreSQL 16 schema & connection pool | `scripts/verify_g1_postgres.js` | 0 table/FK errors, latency $< 50\text{ms}$ | **GO** |
| **Payments** | Financial reconciliation & paise match | Gateway ledger comparison | ₹0.00 drift between PG & gateway | **GO** |
| **Inventory** | FEFO batch balance & stock locking | `SELECT WHERE available < 0` | 0 rows with negative quantity | **GO** |
| **Order Flow** | Canonical state machine transitions | Audit logs & orders table | 0 skipped or backward states | **GO** |
| **Picker** | Single-winner order claiming | `picking_tasks` unique index | 0 duplicate active claims | **GO** |
| **Delivery** | Single-rider dispatch & OTP lockout | Delivery logs & OTP attempts | 0 duplicate active dispatches | **GO** |
| **Notifications** | FCM push & realtime projection | Outbox worker published rate | $> 99.5\%$ on-time dispatch | **GO** |
| **Security** | Zero IDOR or auth bypass | `test/security-verification.test.ts` | 0 open Critical/High findings | **GO** |
| **Observability** | Alert matrix & error logging | Structured JSON log stream | 0 unhandled exception crashes | **GO** |
| **Rollback** | Emergency pause kill-switch | `config/pilot-limits.json` | Rehearsed & validated $< 1\text{s}$ | **GO** |
| **Support** | On-call escalation & hotline active | Operations communication channel | Staffed and ready | **GO** |
