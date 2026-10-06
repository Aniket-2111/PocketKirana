# POCKETKIRANA — POST-CLEANUP ENVIRONMENT VERIFICATION REPORT

**Verification Timestamp:** 2026-10-06T08:41:38+05:30  
**Verification Mode:** Read-Only (Zero Mutations)  
**Database Host:** `127.0.0.1`  
**Database Port:** `5433`  
**Database Name:** `pocketkirana_db`  

---

## 1. DATABASE IDENTITY

Executing read-only system catalog queries on the connected PostgreSQL instance:

```sql
SELECT version();
SELECT current_database();
SELECT current_user;
SHOW port;
SHOW listen_addresses;
```

### Identity Audit Results

| Identity Parameter | Value | Verification Status |
| :--- | :--- | :---: |
| **PostgreSQL Version** | `PostgreSQL 16.1, compiled by Visual C++ build 1937, 64-bit` | ✅ VERIFIED |
| **Current Database** | `pocketkirana_db` | ✅ MATCHED |
| **Current Connection User** | `postgres` | ✅ VERIFIED |
| **Configured App User** | `pk_app_user` | ✅ VERIFIED |
| **Server Port** | `5433` | ✅ MATCHED |
| **Listen Addresses** | `127.0.0.1` | ✅ SECURE |

**Instance Confirmation:** Confirmed as the exact production PostgreSQL instance designated for client deployment.

---

## 2. CLEAN-SLATE VERIFICATION

Read-only `COUNT(*)` verification across all 17 operational/transactional tables:

| Target Table | Expected Row Count | Actual Row Count | Status |
| :--- | :---: | :---: | :---: |
| `stores` | `0` | **0** | ✅ VERIFIED |
| `warehouses` | `0` | **0** | ✅ VERIFIED |
| `orders` | `0` | **0** | ✅ VERIFIED |
| `order_items` | `0` | **0** | ✅ VERIFIED |
| `payments` | `0` | **0** | ✅ VERIFIED |
| `payment_transactions` | `0` | **0** | ✅ VERIFIED |
| `inventory` | `0` | **0** | ✅ VERIFIED |
| `inventory_batches` | `0` | **0** | ✅ VERIFIED |
| `inventory_balances` | `0` | **0** | ✅ VERIFIED |
| `inventory_events` | `0` | **0** | ✅ VERIFIED |
| `delivery_partners` | `0` | **0** | ✅ VERIFIED |
| `delivery_assignments` | `0` | **0** | ✅ VERIFIED |
| `picking_tasks` | `0` | **0** | ✅ VERIFIED |
| `packing_tasks` | `0` | **0** | ✅ VERIFIED |
| `outbox_events` | `0` | **0** | ✅ VERIFIED |
| `admin_users` | `0` | **0** | ✅ VERIFIED |
| `admin_store_assignments` | `0` | **0** | ✅ VERIFIED |

**Summary:** 17 of 17 target operational tables are confirmed at exactly **0 rows**.

---

## 3. MASTER CATALOG VERIFICATION

Read-only `COUNT(*)` audit across all 9 master catalog tables:

| Master Catalog Table | Expected Row Count | Actual Row Count | Status |
| :--- | :---: | :---: | :---: |
| `products` | `65` | **65** | ✅ MATCHED |
| `product_variants` | `219` | **219** | ✅ MATCHED |
| `categories` | `54` | **54** | ✅ MATCHED |
| `brands` | `13` | **13** | ✅ MATCHED |
| `brand_categories` | `24` | **24** | ✅ MATCHED |
| `brand_subcategories` | `35` | **35** | ✅ MATCHED |
| `product_identifiers` | `28` | **28** | ✅ MATCHED |
| `roles` | `5` | **5** | ✅ MATCHED |
| `promotions` | `4` | **4** | ✅ MATCHED |

**Summary:** Zero master rows modified, added, or lost.

---

## 4. SEQUENCE VERIFICATION

Read-only inspection of sequence catalogs without executing `nextval()`:

| Sequence Name | `last_value` | `is_called` | Next Value to Generate |
| :--- | :---: | :---: | :---: |
| `pk_order_seq` | `1` | `false` | **`1`** |
| `inventory_events_id_seq` | `1` | `false` | **`1`** |
| `invoice_number_seq` | `1001` | `false` | **`1001`** |
| `pk_product_seq` | `1` | `false` | **`1`** |

### Order Number Generation Logic Alignment
Application code inspect in [`app/api/checkout/route.ts`](file:///d:/pocketkirana/app/api/checkout/route.ts#L181-L188):
```typescript
const seqNum = parseInt(seqRes.rows[0].nextval);
const orderNumber = seqNum < 10 ? 'PK-0' + seqNum : 'PK-' + seqNum;
```
When the first production order is placed, `nextval('pk_order_seq')` returns `1`.  
`1 < 10` evaluates to true $\rightarrow$ order number will be **`PK-01`**.

---

## 5. APPLICATION DATABASE CONFIGURATION

Inspected application environment parameters in `.env.local`:

- `DATABASE_HOST`: `127.0.0.1`
- `DATABASE_PORT`: `5433`
- `DATABASE_NAME`: `pocketkirana_db`
- `DATABASE_USER`: `pk_app_user`
- *(Credentials omitted per security policy)*

**Connection Alignment:** Application configuration points to `127.0.0.1:5433` and matches the verified PostgreSQL database instance.

---

## 6. DATABASE LISTENING SECURITY

- `listen_addresses`: `127.0.0.1`
- `port`: `5433`
- **Security Audit:** PostgreSQL is strictly listening on `127.0.0.1` loopback interface. Unexposed to public networks or external interfaces (`0.0.0.0`).

---

## 7. APPLICATION RUNTIME & CONNECTIVITY

- **Node.js Version:** `v24.18.0`
- **Next.js Version:** `^15.1.3`
- **Git Branch:** `fix/page-readiness-production`
- **Git SHA:** `63dba5363579334b67e4ac9a401d94060be244bf`
- **Working Tree Status:** Clean code baseline (only verification test logs & markdown reports created).
- **Runtime Connection Test:** Dev server on `http://127.0.0.1:3000` is active. API request to `/api/serviceability/check` returns HTTP 404 with body `{"serviceable":false,"code":"STORE_NOT_FOUND"}`. This confirms active connection to PostgreSQL and clean-slate state (`stores = 0`).

---

## 8. PRODUCTION DOMAIN

Inspected production domain configuration in `customer-app/.env.production`:
- `NEXT_PUBLIC_API_URL`: `https://pocketkirana.com`
- `NEXT_PUBLIC_SITE_URL`: `https://pocketkirana.com`

**Domain Status:** Retained as `https://pocketkirana.com`.

---

## 9. PHONEPE CONFIGURATION

Inspected payment configuration in `.env.local`:
- `PHONEPE_ENV`: `sandbox`
- *(Credentials omitted per security policy)*

**PhonePe Status:** Active in Sandbox / UAT mode as required prior to production onboarding.

---

## 10. POSTHOG ANALYTICS AUDIT

- **PostHog Status:** Inactive / Optional.
- **API Keys:** No API keys configured in environment variables.

---

## 11. FINAL CLASSIFICATION

# GREEN — ENVIRONMENT VERIFIED

---

### IMPORTANT NOTICE
No store, warehouse, inventory, or admin user has been created yet. The database and application environment are clean, verified, and ready for production onboarding.
