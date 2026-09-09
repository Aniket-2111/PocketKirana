# PocketKirana — Master Project Status & System Baseline
**Current Release Baseline:** `v1.1.0-STABLE`  
**Overall System Health:** `94/100` (Production Ready for Pilot)  
**Architecture:** Hybrid PostgreSQL 16 (Transactional) + Google Cloud Firestore (Real-Time) + Next.js 15 App Router  

---

## 1. System Capability Summary

| Capability | Module / Component | Health & Status |
| :--- | :--- | :---: |
| **Customer Storefront** | Next.js 15 App Router (`app/page.tsx`, `components/customer/*`) | 🟢 Operational |
| **Dynamic Pricing Engine** | `lib/pricingEngine.ts` (Authoritative Server Pricing, Coupons & Taxes) | 🟢 Operational |
| **Payment Gateways** | PhonePe PG v1 (`app/api/payments/phonepe/*`), Razorpay & COD | 🟢 Operational |
| **Darkstore Warehouse WMS** | Smart Picking (`SmartPickingWorkflow.tsx`), Packing, Putaway | 🟢 Operational |
| **Batch Inventory & FEFO** | `lib/fefo.ts` & `inventory_events` immutable ledger | 🟢 Operational |
| **Order Routing & SLA** | `lib/orderRoutingEngine.ts` (SLA urgency scoring, picker/rider matching) | 🟢 Operational |
| **Live Delivery Tracking** | Leaflet Map (`LiveTrackingMap.tsx`) + Firestore Realtime GPS | 🟢 Operational |
| **Edge Security & RBAC** | `middleware.ts` (HttpOnly session cookies, CSRF, Route gating) | 🟢 Operational |
| **Process Supervision** | PM2 Clustering (`ecosystem.config.js` on Ports 3000 & 3001) | 🟢 Operational |
| **Disaster Recovery** | Database snapshot & restore (`scripts/test_backup_restore.js`) | 🟢 Operational |

---

## 2. Release & Codebase Safety Rule
* **DO NOT** delete files automatically.
* **DO NOT** rewrite working architecture.
* Follow the phased stabilization protocol: **STABILIZE -> VERIFY -> PILOT -> MONITOR -> SCALE**.
