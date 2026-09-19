# Phase 21 — Production Go-Live Specification & Architecture

## 1. Executive Summary
Phase 21 marks the final production release gate for **PocketKirana**. Following the verified execution of Phases 0 through 20—including strict PostgreSQL canonical authority, transactional outbox with lease-token fencing, realtime projections, 100% TypeScript compilation across 19 Cloud Functions, comprehensive security audits, and a 30-order controlled operational pilot—public traffic is authorized under canary control.

---

## 2. Release Freeze & Artifact Metadata

| Metadata Field | Value |
| :--- | :--- |
| **Release Version** | `v1.0.0-production` |
| **Release Tag** | `v1.0.0-production` |
| **Branch** | `phase-21-production-go-live` |
| **Canonical API Surface** | `https://pocketkirana.com/api` (Cloudflare TLS 1.3 reverse proxy) |
| **Primary Database Authority** | GCP Cloud SQL PostgreSQL 16 (`pocketkirana-db-prod`, `asia-south1`) |
| **Realtime Projection Layer** | Firebase Production (`pocketkirana-prod`) |
| **Active Payment Gateways** | PhonePe Production PG & Razorpay Production |
| **Automated Test Baseline** | **140+ Tests Passing** across 21 Suites (100% Pass) |
| **Build Status** | Next.js Root Build PASS (0 errors), 19/19 Cloud Functions PASS |

---

## 3. Public Traffic Canary Rollout Strategy

```text
Stage 1: 10% Canary Traffic (Day 1, 09:00 – 13:00)
  - 10% of incoming Dark Store traffic routed to checkout
  - 1-minute real-time telemetry monitoring (5xx rate < 0.1%, P95 < 800ms)
        │
        ▼
Stage 2: 50% Expanded Canary (Day 1, 13:00 – 18:00)
  - 50% public Dark Store order intake
  - Continuous payment reconciliation & inventory stock audits
        │
        ▼
Stage 3: 100% Full Public Access (Day 1, 18:00+)
  - Full Dark Store public ordering enabled
  - Transition to steady-state 24/7 SRE on-call rotation
```
