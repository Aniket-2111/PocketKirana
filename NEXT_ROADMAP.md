# PocketKirana — Production Engineering Roadmap (Prioritized)

---

## 🔴 P0 — Immediate Production Stabilization & Pilot Readiness (Current Focus)
- [x] Freeze PocketKirana v1.1.0 codebase baseline.
- [x] Complete file-by-file audit and lock critical infrastructure (`lib/postgres.ts`, `lib/store.ts`, `lib/pricingEngine.ts`, `lib/fefo.ts`, `middleware.ts`).
- [x] Verify 38-table PostgreSQL schema integrity (`scripts/audit_postgres_schema.js`).
- [x] Verify 19-stage order fulfillment lifecycle (`scripts/e2e_order_to_delivery_test.js`).
- [x] Verify backup creation and disaster recovery restore procedure (`scripts/test_backup_restore.js`).
- [x] Create comprehensive operational runbooks and reconciliation standards.

---

## 🟠 P1 — Pilot Reliability & Operational Tooling (Next Phase)
- [ ] Connect automated daily database backup to offsite Google Cloud Storage bucket (`gs://pocketkirana-db-backups/`).
- [ ] Deploy Sentry or lightweight error tracking on frontend storefront and picker app.
- [ ] Implement Admin Payment Reconciliation Dashboard view for instant gateway-to-order mismatch detection.
- [ ] Add Daily Physical Stock Count variance adjustment interface for darkstore managers.

---

## 🟡 P2 — Business Growth & Procurement Enhancements (Post-Pilot)
- [ ] Supplier & Purchase Order (PO) Management module (`suppliers`, `purchase_orders`, `goods_receipts`) integrated with FEFO putaway.
- [ ] Customer SMS / WhatsApp transactional delivery alerts via Gupshup or Twilio.
- [ ] Contribution margin & unit economics reporting (Revenue - COGS - Delivery Cost - PG Fee - Wastage).
- [ ] Customer cohort 7-day and 30-day retention analytics.

---

## 🟢 P3 — Scale & Advanced AI Optimization (Future Horizon)
- [ ] Machine-learning powered predictive inventory reordering based on local buying patterns.
- [ ] Multi-darkstore routing and cross-hub load balancing.
- [ ] Route optimization engine for multi-order batch delivery routes.
