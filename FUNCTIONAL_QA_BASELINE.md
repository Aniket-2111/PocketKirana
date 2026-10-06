# PocketKirana — Functional QA Baseline & Verification Gate

**Date:** 2026-09-29  
**Status:** 🔒 **FROZEN FOR OPERATIONAL VERIFICATION**  
**Review Decision:** UI/UX & Code Integration frozen; functional verification sequence active.

---

## 1. Official Release Position

```text
🟢 CUSTOMER UI/UX — FROZEN (Realme RMX5000 physical device QA passed)
🟢 CORE CHECKOUT INTEGRATION — RESOLVED IN CODE
🟢 DELIVERY OTP STORAGE — RESOLVED IN CODE
🟡 AUTHENTICATION — DEVICE E2E PENDING
🔴 VPS/DATABASE — SERVER VERIFICATION REQUIRED
🔴 PHONEPE — SANDBOX E2E REQUIRED (Public HTTPS tunnel pending)
🟡 FULFILLMENT — REAL ORDER TEST REQUIRED
🟡 ORDER TRACKING — DEVICE E2E REQUIRED
🔴 LIVE CUSTOMER TRAFFIC — NOT APPROVED
```

---

## 2. Code Integrations Resolved in Baseline

| Subsystem | File Reference | Architectural Mechanism | Status |
|---|---|---|---|
| **Firestore Order Mirror** | [`app/api/checkout/route.ts`](file:///D:/pocketkirana/app/api/checkout/route.ts) | Post-PostgreSQL-COMMIT mirror write to `Firestore/orders/{orderId}` ensures `POST /api/payments/phonepe/create` immediately finds the document. | 🟢 RESOLVED |
| **COD Picker Queue Trigger** | [`app/api/checkout/route.ts`](file:///D:/pocketkirana/app/api/checkout/route.ts) | Calls `ensurePickingTaskForOrder()` immediately upon order confirmation and Firestore mirror for COD orders. | 🟢 RESOLVED |
| **Canonical Checkout Path** | [`customer-app/app/checkout/page.tsx`](file:///D:/pocketkirana/customer-app/app/checkout/page.tsx) | `handlePlaceOrder` calls canonical `POST /api/checkout` API first; server-generated `orderId` and sequential `orderNumber` sync to client state. | 🟢 RESOLVED |
| **Delivery OTP Storage** | [`app/api/checkout/route.ts`](file:///D:/pocketkirana/app/api/checkout/route.ts)<br>[`customer-app/app/checkout/page.tsx`](file:///D:/pocketkirana/customer-app/app/checkout/page.tsx) | Generated OTP saved directly to PostgreSQL `orders.delivery_otp`, Firestore `orders/{orderId}.deliveryOtp`, and synced into customer app for live tracking. | 🟢 RESOLVED |

---

## 3. Order Lifecycle Architecture

```text
CUSTOMER APP (Realme RMX5000)
     │
     │ Login / Cart / Checkout
     ▼
POST /api/checkout
     │
     ├── PostgreSQL Transaction
     │      ├── Order Record (orders)
     │      ├── Order Items (order_items)
     │      ├── Address (order_addresses)
     │      ├── Stock Lock & FEFO (inventory_balances)
     │      ├── Delivery OTP (orders.delivery_otp)
     │      └── Transactional Outbox (order.placed)
     │
     └── COMMIT
           │
           ├── Firestore Order Mirror (orders/{orderId})
           │
           └── COD → Picker Queue (ensurePickingTaskForOrder)
```

### Payment Flow (PhonePe):
```text
Checkout ──► PostgreSQL ──► Firestore Mirror ──► PhonePe Create ──► Sandbox Pay Page ──► Webhook/Verify ──► CONFIRMED ──► Picker Queue
```

### Delivery Flow:
```text
Picker Accepts ──► Barcode / FEFO Scan ──► Packing ──► Rider Assignment ──► OUT_FOR_DELIVERY ──► Live GPS ──► Customer OTP ──► DELIVERED
```

---

## 4. Verification Sequences (Execution Checklist)

### Phase 1 — VPS & Infrastructure Verification (Remote)
- [ ] SSH to Oracle VPS
- [ ] Verify PostgreSQL service active: `psql -U pk_app_user -d pocketkirana_db -c "SELECT COUNT(*) FROM orders;"`
- [ ] Verify PM2 status:
  - `pm2 status` shows `web`, `api`, `outbox-worker` all `online`
- [ ] Verify sequential order number sequence: `SELECT last_value FROM pk_order_seq;`
- [ ] Verify outbox event processor table: `SELECT COUNT(*) FROM outbox_events;`

### Phase 2 — Real Device Acceptance (Realme RMX5000)
- [ ] Launch `com.pocketkirana.customer` on Realme RMX5000
- [ ] Log in with real phone number via MSG91 OTP widget
- [ ] Verify session cookie creation (`pk_session`) and profile hydration
- [ ] Add product items to cart from Category / PLP
- [ ] Select delivery address and choose COD payment
- [ ] Place order via `POST /api/checkout`
- [ ] Verify order in:
  - PostgreSQL `orders` table (status: `CONFIRMED`, `order_number: PK-...`)
  - Firestore `orders/{orderId}` mirror doc
  - Picker App task queue (`com.pocketkirana.picker`)

### Phase 3 — Fulfillment Lifecycle
- [ ] Picker accepts task in picker app
- [ ] Barcode scanning and FEFO batch verification
- [ ] Order packing completion
- [ ] Rider assignment via order routing engine

### Phase 4 — Order Tracking & Delivery
- [ ] Customer tracking screen loads live GPS stream
- [ ] Customer 4-digit delivery OTP matches `orders.delivery_otp`
- [ ] Delivery partner enters OTP in `com.pocketkirana.delivery`
- [ ] Order transitions to `DELIVERED` status across PostgreSQL and Firestore

### Phase 5 — PhonePe Sandbox E2E
- [ ] Expose application port to public HTTPS via Cloudflare Tunnel / ngrok
- [ ] Set `NEXT_PUBLIC_SITE_URL` to public HTTPS endpoint
- [ ] Initiate PhonePe Sandbox payment (₹1 test transaction)
- [ ] Verify redirect to PhonePe Pay Page
- [ ] Verify Webhook callback signature verification & idempotent acknowledgment
- [ ] Verify payment transition from `pending` to `paid`
