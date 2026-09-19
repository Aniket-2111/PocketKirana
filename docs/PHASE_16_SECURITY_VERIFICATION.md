# Phase 16 — Security Verification & Penetration Testing

## Executive Summary
This document establishes the security baseline, threat model, authorization boundaries, cryptographic invariants, and automated penetration testing criteria for PocketKirana prior to end-to-end route verification (Phase 17) and production go-live (Phase 21).

Testing is performed in a **controlled staging environment** using synthetic user identities, non-production sandbox payment gateways, and isolated test databases.

---

## 16A — Security Baseline Inventory

| Property | Configuration / Specification |
| :--- | :--- |
| **Branch** | `phase-16-security-verification` |
| **Node.js Runtime** | `v20.x` LTS (Next.js 15.3.x App Router) |
| **Database Authority** | PostgreSQL 16 (GCP Cloud SQL `asia-south1` with TLS 1.3 enforced) |
| **Authentication Engine** | Firebase Auth (RS256 ID Token JWT verification against Google JWKS) |
| **Edge Gateway** | Edge Middleware with header stripping, CSRF defenses, and RBAC gating |
| **Outbox & State Machine** | Strict transactional fencing (`lease_token`), immutable order state transition graph |
| **Payment Gateways** | PhonePe (X-VERIFY SHA256 checksum) & Razorpay (HMAC-SHA256 signature verification) |
| **Audit Scope** | Staging / Synthetic Identity Space (`test-customer-1`, `test-picker-1`, `test-delivery-1`, `test-admin-1`) |

---

## 16B & 16C — Role-Based Access Control (RBAC) Matrix

| Resource / Route Surface | Anonymous | Customer | Picker | Delivery Partner | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Public Catalog & Health (`/api/products`, `/api/health`)** | Read | Read | Read | Read | Read |
| **Order Placement (`POST /api/checkout`)** | ❌ (401) | Create | ❌ (403) | ❌ (403) | Create |
| **Own Order Details (`/api/orders/[id]`)** | ❌ (401) | Read Own | Read Assigned | Read Assigned | Read All |
| **Other Customer's Order** | ❌ (401) | ❌ Blocked (IDOR) | ❌ Blocked | ❌ Blocked | Read / Audit |
| **Picking Tasks (`/api/picking/*`, `/api/picker/*`)** | ❌ (401) | ❌ (403) | Claim & Pack | ❌ (403) | Manage |
| **Delivery Lifecycle (`/api/delivery/*`)** | ❌ (401) | ❌ (403) | ❌ (403) | Assigned Route | Manage All |
| **Admin Operations (`/admin/*`, `/api/admin/*`)** | ❌ (401) | ❌ (403) | ❌ (403) | ❌ (403) | Full Access |
| **Payment Webhooks (`/api/payments/*/webhook`)** | HMAC Gated | HMAC Gated | HMAC Gated | HMAC Gated | HMAC Gated |

---

## 16D — Insecure Direct Object Reference (IDOR) Defense
- **Order Isolation:** `GET /api/orders/[id]` and `GET /api/orders/[id]/invoice` verify that `order.customerId === auth.uid` or the actor holds an authorized role (`admin`, or assigned `picker`/`delivery_partner`).
- **Delivery Action Isolation:** Delivery actions (`pickup`, `location`, `verify-otp`) require `order.partnerId === auth.uid`.
- **Address & Payment Isolation:** Customers cannot read or modify addresses or payment methods linked to other customer UIDs.

---

## 16E & 16F — Injection Immunity (SQL & NoSQL)
- **SQL Parameterization:** All queries to PostgreSQL are executed via parameterized queries `$1, $2, ...` through `pg.Pool`. String interpolation of raw user inputs into SQL clauses is strictly prohibited and flagged in static analysis.
- **Firestore Authorization:** Client writes directly to sensitive Firestore collections (`payments`, `orders`, `outbox_events`) are disallowed in security rules. All mutations route through server API with PostgreSQL as the canonical command source.

---

## 16G & 16H — Header Forgery & Token Cryptographic Security
- **Edge Header Sanitization:** Middleware strips any incoming client headers matching `x-pk-*` (`x-pk-uid`, `x-pk-role`, `x-pk-admin`) before request processing. Trusted `x-pk-*` headers are injected downstream **only** after cryptographic signature verification.
- **RS256 JWT Verification:** ID Tokens are verified against official Google JWKS with mandatory checks for:
  1. `alg === "RS256"` (prohibits `alg: "none"` and HMAC confusion).
  2. `iss === "https://securetoken.google.com/<PROJECT_ID>"`.
  3. `aud === "<PROJECT_ID>"`.
  4. Token expiry (`exp > now`).

---

## 16N & 16O — Payment Webhook Cryptography & Amount Tampering Protection
- **PhonePe X-VERIFY:** Requires `SHA256(base64Payload + saltKey) + "###" + saltIndex`. Any tampered payload or forged header is rejected.
- **Razorpay HMAC-SHA256:** Requires `HMAC-SHA256(order_id + "|" + payment_id, secret)`.
- **Authoritative Amount Reconciliation:** Order totals are computed server-side in PostgreSQL using locked item prices. Webhooks verifying payments compare received amount against canonical `order.total * 100` paise. Mismatched amounts transition payment to `failed` and trigger security alerts.

---

## 16M — OTP Security & Brute-Force Lockout
- **Delivery OTP:** 4-digit code generated per order.
- **Attempt Limit:** Maximum 5 failed attempts per order.
- **Lockout Mechanism:** 5th failed attempt permanently locks the OTP verification on that order (`deliveryOtpLocked = true`), requiring admin intervention.
- **Redaction:** Delivery OTPs and Customer OTPs are stripped from all logs and sanitized from customer-facing API representations.

---

## 16Q — Order State Machine Integrity
Allowed State Graph:
$$\text{CREATED} \longrightarrow \text{CONFIRMED} \longrightarrow \text{PICKING} \longrightarrow \text{PACKED} \longrightarrow \text{OUT\_FOR\_DELIVERY} \longrightarrow \text{DELIVERED}$$
Illegal shortcuts (e.g., $\text{CREATED} \to \text{DELIVERED}$) or backward transitions ($\text{DELIVERED} \to \text{CREATED}$) are rejected at the database and business logic layer.
