# PocketKirana — Production Baseline Report

**Date:** September 19, 2026  
**Git Commit / Tag:** `pre-production-audit-2026-09-19`  
**Active Work Branch:** `production-readiness`  

---

## 1. Environment Baseline

- **Node.js Version:** `v20.18.0`
- **npm Version:** `10.8.2`
- **OS Platform:** Windows (win32)

---

## 2. Build & Compilation Matrix

| Target | Build Command | Status | Notes |
|---|---|---|---|
| **Root Web Application** (74 routes) | `npm run build` | 🟢 PASS (Exit 0) | Fixed Next.js 15 SSR wrapper for `RealtimeNotificationToast` |
| **Customer Mobile PWA** | `cd customer-app && npm run build` | 🟢 PASS (Exit 0) | `ignoreBuildErrors: true` currently active |
| **Delivery Mobile PWA** | `cd delivery-app && npm run build` | 🟢 PASS (Exit 0) | `ignoreBuildErrors: true` currently active |
| **Picker Mobile PWA** | `cd picker-app && npm run build` | 🟢 PASS (Exit 0) | `ignoreBuildErrors: true` currently active |
| **Firebase Cloud Functions** (19 exports) | `cd functions && npm run build` | 🔴 FAIL (TS2307) | Blocked by relative import `../../lib/postgres` and missing `pg` dependency |

---

## 3. Automated Test Suites

- **Command:** `npm test`
- **Result:** 🟢 41/41 Passed (14 test suites, 0 failed)
- **Suites Verified:**
  - Route handlers & security guards
  - PhonePe signature & webhook validation
  - Cart calculation & pricing engine
  - State machine transitions (19-stage workflow)
  - RBAC permission guards

---

## 4. Connectivity & Service Integrations

| Service | Target Host / Project | Connection Status | Notes |
|---|---|---|---|
| **PostgreSQL Database** | `192.168.0.106:5433` (Client Laptop) | 🔴 Disconnected / Timeout | LAN host unreachable; needs managed DB configuration for staging/production |
| **Firebase Admin / Firestore** | `pocketkirana-app` | 🟢 Configured | Project credentials verified in environment |
| **PhonePe PG Sandbox** | `api-preprod.phonepe.com` | 🟢 Configured | Sandbox key & index present |

---

## 5. Architectural Remediation Priorities (Action Plan)

1. **Phase 3:** Fix Cloud Functions Architecture Boundary (Resolve TS2307, bundle-safe DB layer).
2. **Phase 4:** PostgreSQL Canonical Authority for Checkout & Order Placement.
3. **Phase 5:** Transactional Outbox Pattern (`outbox_events` table + projection worker to Firestore).
4. **Phase 6:** End-to-End Idempotent Checkout Cutover.
5. **Phase 7:** Authoritative FEFO Inventory Reservation in PostgreSQL.
6. **Phase 8-10:** Picker, Delivery & Payment State Machine synchronization.
7. **Phase 12:** Remove `ignoreBuildErrors: true` across all mobile apps and eliminate TypeScript errors.
