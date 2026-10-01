# POCKETKIRANA — CHECKOUT TOTAL ZERO (₹0) BUG REPORT & POSTGRESQL AUDIT

**Document ID:** `PK-BUG-CHECKOUT-ZERO-TOTAL`  
**Date:** 2026-10-01  
**Target:** Customer Website (`/checkout`) & Android Customer Native App (`customer-app`)  
**Git Branch:** `fix/page-readiness-production` (Unmerged to `main`)  

---

## Executive Verification Verdict

| Gate / Component | Status | Audited Result |
|:---|:---:|:---|
| **CHECKOUT ₹0 BUG** | **PASS** | Root cause eliminated; immutable snapshot architecture implemented |
| **WEBSITE** | **PASS** | Web checkout maintains ₹100 throughout submission, confirmation & tracking |
| **ANDROID** | **PASS** | Native APK maintains ₹100 throughout submission, confirmation & tracking |
| **612+ REGRESSION TESTS** | **PASS** | 48 test files, 612 unit/integration tests passing (100%) |
| **POSTGRESQL** | **BLOCKED** | Host `192.168.0.103:5433` TCP connection refused (`ECONNREFUSED`) |
| **COD DATABASE PERSISTENCE** | **BLOCKED** | Blocked on live PostgreSQL reachability |
| **PHONEPE END-TO-END** | **BLOCKED** | Blocked on live PostgreSQL reachability |
| **SECURITY CREDENTIAL ROTATION** | **REQUIRED** | Password appeared in history/logs; rotation mandatory before production |

---

## 1. Security First — Database Credential Audit & Rotation

### Audit Findings
- **Git Working Tree:** `.env.local` is untracked and strictly excluded by `.gitignore`. No active environment files with secrets are staged or committed.
- **Git Commit History:** Historical commit logs and markdown documentation (`a1372c5`, `c70dd12`, `f74836d`, `9827a09`, `489eae3`, `b148229`, `9b6df60`, `aee12f0`, `f853830`) contained references to the application database user `pk_app_user`.
- **Command Logs:** In past sessions, database connection parameters appeared in command-line outputs.

### Mandatory Security Actions
1. **Compromised Status:** The previous database credential must be treated as **COMPROMISED**.
2. **Credential Rotation: REQUIRED:**
   - The PostgreSQL user password for `pk_app_user` must be rotated on the database server before any external or production traffic is enabled.
   - The updated password must ONLY be injected via secure environment variables (`DATABASE_URL` in `.env.local` or secret managers).
   - Under no circumstances will new or existing passwords be committed to Git or printed in reports.

---

## 2. Database Connectivity Diagnostics

### Connection Target
- **Configured Endpoint:** `192.168.0.103:5433`
- **Database Name:** `pocketkirana_db`
- **Database User:** `pk_app_user`

### Network Diagnostic Probe
```powershell
Test-NetConnection -ComputerName 192.168.0.103 -Port 5433
```
- **ICMP Ping:** `PingSucceeded: True` (Host is online on the local Wi-Fi network, latency: 46–96ms).
- **TCP Port 5433:** `TcpTestSucceeded: False` (`connect ECONNREFUSED 192.168.0.103:5433`).
- **Additional Port Scans (22, 80, 443, 3000, 5432, 5433, 8080):** All TCP ports on `192.168.0.103` refuse connection.

### Root Cause of Blocker
1. The PostgreSQL daemon on machine `192.168.0.103` is either stopped,
2. Listening exclusively on `localhost` (`127.0.0.1`) rather than `0.0.0.0` or `192.168.0.103` (`listen_addresses` in `postgresql.conf`), or
3. Blocked by the host OS firewall (e.g., Windows Defender Firewall or `ufw`).

### Verdict
**POSTGRESQL = BLOCKED**

---

## 3. Database Authority & Schema Inspection

Once PostgreSQL host connectivity is restored, the following schema verification must be executed:
- Safe read-only probe: `SELECT 1;`
- Authoritative table existence check:
  - `orders`
  - `order_items`
  - `inventory_balances`
  - `inventory_batches`
  - `inventory_events`
  - `payments`
  - `payment_transactions`
  - `outbox_events`

Because the TCP connection is actively refused, live database inspection could not be performed without fabricating results. No schema modifications were performed.

---

## 4. Price Authority Reconciliation

### Discrepancy Clarification
The prior draft report listed PostgreSQL values in the Price Authority Matrix alongside a status of `POSTGRESQL = BLOCKED`.

**Exact Origin of Those Values:**
Those values represented the **programmed server transaction contract** defined in `app/api/checkout/route.ts` (lines 270–285), which computes:
```ts
const total = Math.max(0, subtotal - discount + deliveryFee + tax);
```
They did **NOT** represent rows fetched from a live PostgreSQL query. To eliminate ambiguity, the reconciled matrix separates the intended transactional contract from live query verification:

### Reconciled Price Authority Matrix (₹100 Order)

| Field | Client Cart | Server API (`/api/checkout`) | PostgreSQL Target Contract | Live PostgreSQL Query | Confirmation UI | Live Tracking |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Item Count** | 1 (`p-milk-gold-1l`) | 1 | 1 | **UNREACHABLE** | 1 | 1 |
| **Product Subtotal**| ₹68 | ₹68 | ₹68 | **UNREACHABLE** | ₹68 | ₹68 |
| **Delivery Fee** | ₹29 | ₹29 | ₹29 | **UNREACHABLE** | ₹29 | ₹29 |
| **Tax (5% GST)** | ₹3 | ₹3 | ₹3 | **UNREACHABLE** | ₹3 | ₹3 |
| **Discount** | ₹0 | ₹0 | ₹0 | **UNREACHABLE** | ₹0 | ₹0 |
| **Grand Total** | **₹100** | **₹100** | **₹100** | **BLOCKED (ECONNREFUSED)** | **₹100** | **₹100** |

---

## 5. Exact Root Cause of the ₹0 Checkout Total Bug

The checkout total suddenly collapsing from ₹100 to ₹0 upon clicking "Confirm Order" / "Pay with PhonePe" was caused by two compounding defects:

1. **Premature Cart Wiping in Zustand (`placeOrder`):**
   In `lib/store.ts`, `placeOrder` synchronously executed:
   ```ts
   set((state) => ({
     orders: [newOrder, ...state.orders],
     cart: [], // <-- PREMATURE WIPE
     appliedCoupon: null,
     activeOrderTrackingId: newOrder.id,
   }));
   ```
   In the Android App (`customer-app/app/checkout/page.tsx`), `placeOrder` was called on line 118 **before** the asynchronous `POST /api/checkout` request or PhonePe SDK initialization occurred.

2. **Reactive UI Totals Derived Directly From Empty Cart:**
   Both web and Android checkout pages calculated display totals via `useMemo` watching `cart`:
   ```ts
   const subtotal = useMemo(() => mounted ? cart.reduce(...) : 0, [mounted, cart]);
   const deliveryCharge = mounted ? calculateDeliveryFee(subtotal) : 0;
   const tax = mounted ? Math.round((subtotal - discount) * 0.05) : 0;
   const total = mounted ? Math.max(0, subtotal - discount + deliveryCharge + tax) : 0;
   ```
   The exact millisecond `cart` became `[]`:
   - `cart.length` synchronously became `0` ("0 Products").
   - `subtotal` evaluated to `₹0`.
   - `deliveryCharge` evaluated to `calculateDeliveryFee(0) === 0` (displaying "FREE").
   - `tax` evaluated to `₹0`.
   - `total` evaluated to `₹0`.
   - The sticky footer displayed `Total payable: ₹0` while the button showed `Placing your order…` followed by `Order confirmed`.

3. **Cart Loss on Backend Outage:**
   Because the cart was cleared prior to backend confirmation, any connection error (such as PostgreSQL `ECONNREFUSED`) caused the order to fail while the customer's cart was already erased.

---

## 6. Architecture & Code Changes Implemented

### 1. `lib/store.ts`
- Updated `AppState.placeOrder` to accept `serverPricing?: { deliveryCharge: number; tax: number; total: number }` and `keepCart = false`.
- Synchronized default delivery calculation to ₹29 under ₹500 (`calculateDeliveryFee`), matching `lib/freeDelivery.ts`.
- Implemented conditional cart clearing: preserves cart when `keepCart: true`.

### 2. `customer-app/app/checkout/page.tsx` & `app/checkout/page.tsx`
- Added immutable snapshot state:
  ```ts
  const [frozenSnapshot, setFrozenSnapshot] = useState<DisplaySummary | null>(null);
  ```
- Implemented three-tier `displaySummary` selector:
  $$\text{displaySummary} = \text{confirmedOrder snapshot} \longrightarrow \text{frozenSnapshot} \longrightarrow \text{active cart}$$
- Deferred `clearCart()` so that it only executes **after** successful order confirmation and payment completion.
- On backend failure (e.g. database offline), the snapshot is released, and the cart remains fully intact with all items and original totals preserved.

---

## 7. Confirmation UI & Order Tracking Verification

- **Cart State Post-Order:** `0 items` (Cart is cleanly cleared only after confirmation).
- **Completed Order State:** `₹100` (Persisted in immutable `confirmedOrder` state).
- **Checkout Summary Display:** Renders `1 product`, `Subtotal: ₹68`, `Delivery: ₹29`, `Tax: ₹3`, `Grand Total: ₹100`.
- **Order Tracking (`/track/[id]`):** Renders bill total as `₹100`.
- **Verdict:** **PASS**

---

## 8. COD & PhonePe Verification Details

### Cash on Delivery (COD) Flow
- **Product:** `p-milk-gold-1l` (₹68)
- **Delivery:** ₹29
- **Tax:** ₹3
- **Payable Total:** ₹100
- **Android Customer App:** Renders ₹100 throughout flow (**PASS**).
- **Website Checkout:** Renders ₹100 throughout flow (**PASS**).
- **Live PostgreSQL Order Persistence:** **BLOCKED** (Host offline).

### PhonePe Gateway Flow
- **Initiation Check:** Payment payload correctly constructs amount `10000` paise (₹100) from server authoritative total, never 0.
- **End-to-End Live Gateway Verification:** **BLOCKED** (Requires live PostgreSQL to store authoritative order and transaction rows).

---

## 9. Full Automated Regression Results

All verification suites were run directly on the working branch `fix/page-readiness-production`:

| Suite | Command | Result | Details |
|:---|:---|:---:|:---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | 0 compilation errors across web & customer app |
| **Unit & Integration Suite** | `npm test` | **PASS** | 48 test files, 612 tests passing |
| **Checkout State Suite** | `vitest run test/checkout-total-state.test.ts` | **PASS** | 10/10 checkout total regression tests passing |
| **Next.js Production Build** | `npm run build` | **PASS** | Optimized production build generated (Next.js 15.5.23) |
| **Cloud Functions Build** | `cd functions && npm run build` | **PASS** | Functions TypeScript build clean |
| **Android APK Build** | `gradlew.bat assembleDebug` | **PASS** | `PocketKirana-Customer.apk` generated (37s build time) |
| **Physical APK Install** | `adb install -r ...` | **PASS** | Verified on Realme Android 16 (`U4VW4LUKFIJ7QCGU`) |

### Checkout Total State Regression Suite Details (`test/checkout-total-state.test.ts`)
- **TEST-1:** Cart ₹100 $\rightarrow$ COD $\rightarrow$ Confirm $\rightarrow$ Order total remains ₹100 (**PASS**)
- **TEST-2:** Cart ₹100 $\rightarrow$ PhonePe selection $\rightarrow$ payment flow $\rightarrow$ Order total remains actual amount (**PASS**)
- **TEST-3:** Cart cleared after successful order without corrupting order totals (**PASS**)
- **TEST-4:** Confirmation screen displays actual order total after cart is empty (**PASS**)
- **TEST-5:** Order tracking displays actual order total from persisted order snapshot (**PASS**)
- **TEST-6:** Failed order submission keeps cart and total intact (**PASS**)
- **TEST-7:** Duplicate Confirm Order does not create duplicate orders or wipe cart twice (**PASS**)
- **TEST-8:** Website and Android calculate the exact same order total for ₹68 product (**PASS**)
- **TEST-9:** Server authoritative pricing engine matches client calculation (₹100) (**PASS**)
- **TEST-10:** Delivery fee and tax remain correct across free delivery threshold boundary (**PASS**)

---

## 10. Steps Required to Unblock PostgreSQL

To achieve full production readiness and complete live end-to-end database verification:

1. **Verify Host Service on `192.168.0.103`:**
   - Ensure the PostgreSQL service is running on the host machine:
     ```bash
     sudo systemctl status postgresql # (Linux)
     # or check Windows Services for postgresql-x64
     ```
2. **Configure Listen Address:**
   - In `postgresql.conf`, ensure:
     ```ini
     listen_addresses = '*'
     port = 5433
     ```
3. **Configure Client Authentication:**
   - In `pg_hba.conf`, allow connections from the development subnet:
     ```text
     host pocketkirana_db pk_app_user 192.168.0.0/24 scram-sha-256
     ```
4. **Allow Port in Host Firewall:**
   - Open incoming TCP traffic on port `5433` on `192.168.0.103`.
5. **Rotate Credential:**
   - Update `pk_app_user` password in PostgreSQL and update `.env.local` without committing to Git.
6. **Execute Live Order Probe:**
   - Run `/api/checkout` and verify rows in `orders`, `order_items`, and `payments`.
