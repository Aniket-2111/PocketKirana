# Phase 20 — Controlled Operational Pilot Specification

## 1. Executive Summary
Phase 20 governs the live execution of a tightly controlled, geofenced operational pilot on the production infrastructure verified in Phase 19. The objective is to validate real customer orders, physical inventory decrements, live payment callbacks, dark store picker picking, and motorcycle rider delivery handovers under strict volume caps and emergency kill-switch controls.

---

## 2. Pilot Governance & Population Limits

| Role | Initial Cap (Stage P1) | Expanded Cap (Stage P2) | Access Mode |
| :--- | :---: | :---: | :--- |
| **Customers** | 5 – 10 | 10 – 25 | Whitelisted UID Allowlist |
| **Pickers** | 1 – 2 | 2 – 4 | Designated Store Personnel (`store-001`) |
| **Delivery Partners** | 1 – 2 | 2 – 4 | Active Dedicated Riders |
| **Dark Store Area** | 1 Store (`store-001`) | 1 Store (`store-001`) | Geofence Radius $\le 5.0\text{ km}$ |
| **Max Concurrent Orders** | 3 | 8 | Server-Side Rate Gate |
| **Daily Order Limit** | 30 | 75 | Server-Side Quota |

---

## 3. Staged Expansion Lifecycle

```text
Stage P1: Micro Pilot (1–3 days)
  - 5–10 whitelisted customers
  - 1 dark store, 1–2 pickers, 1–2 riders
  - Max 10 orders/hour, 30 orders/day
  - Exit Gate: 100% financial reconciliation, 0 overselling, 0 lease loss
        │
        ▼
Stage P2: Controlled Expansion (3–5 days)
  - 10–25 customers
  - Max 25 orders/hour, 75 orders/day
  - Exit Gate: SLA < 30m average delivery duration, 0 payment drift
        │
        ▼
Stage P3: Multi-Zone Pilot (5–7 days)
  - 25–50 customers
  - Expanded operating window (08:00 – 22:00)
  - Exit Gate: Zero P1/P2 operational incidents
        │
        ▼
Phase 21: Production Go-Live
```

---

## 4. Operational Invariants & SLA Benchmarks

### 4.1 Financial Invariant
$$\text{Gateway Credited Amount} = \text{Canonical PostgreSQL } \texttt{orders.total\_amount} = \text{Payment Ledger } \texttt{amount}$$
Zero allowable drift. Discrepancies immediately pause the pilot.

### 4.2 Inventory Invariant
$$\texttt{available\_stock} = \texttt{physical\_quantity} - \texttt{reserved\_quantity} \ge 0$$
Zero negative stock and zero overselling.

### 4.3 SLA Benchmarks
- **Payment Webhook Confirmation:** $\le 5\text{s}$ ($<30\text{s}$ SLA)
- **Picker Order Claim & Pick:** $\le 8\text{m}$ ($<10\text{m}$ SLA)
- **Rider Store Arrival & Pickup:** $\le 5\text{m}$ ($<8\text{m}$ SLA)
- **Transit & Delivery OTP Verification:** $\le 12\text{m}$ ($<20\text{m}$ SLA)
- **Total Order Duration (Click-to-Door):** $\le 25\text{m}$ ($<30\text{m}$ SLA)
