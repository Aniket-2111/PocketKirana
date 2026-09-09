# PocketKirana — Master File Classification & Safety Catalog
**Version:** 1.1.0-STABLE  
**Policy:** Strict Inspection & Verification before Deletion / Modification  

---

## 1. 🔴 CRITICAL (Must Never Be Removed or Blindly Modified)
These files constitute the core transactional, state, security, and algorithmic foundation of PocketKirana. Removing any of these causes immediate system-wide failure.

| File Path | Functional Responsibility | Primary Consumers |
| :--- | :--- | :--- |
| `lib/postgres.ts` | Connection pool, dead-lock retry, `withTransaction` isolation | All `/api/*` handlers, `lib/fefo.ts`, `lib/orderRoutingEngine.ts` |
| `lib/store.ts` | Master Zustand client state store (v4) & Firestore subscriptions | All storefront, admin, picker, and rider components |
| `lib/pricingEngine.ts` | Authoritative server-side pricing, tiered coupons & tax math | Checkout, Order placement, Cart drawer |
| `lib/fefo.ts` | First-Expiry-First-Out batch allocation & inventory audit ledger | Picking task completion, Batch inventory API |
| `middleware.ts` | Edge security, RBAC route gating (`/admin`, `/picker`, `/delivery`), CSRF | All incoming HTTP web and API traffic |
| `types/index.ts` | 805 lines of strict TypeScript data models and enums | Entire full-stack codebase |
| `next.config.ts` | Next.js bundler, image optimization, and HTTP security headers | Next.js build runtime |
| `ecosystem.config.js` | PM2 production clustering process manager | Production server runtime (ports 3000 & 3001) |
| `app/api/payments/phonepe/create/route.ts` | PhonePe PG v1 payload creation and SHA-256 signing | Checkout payment initiation |
| `app/api/payments/phonepe/webhook/route.ts` | PhonePe Server-to-Server IPN verification callback | PhonePe Gateway callback servers |
| `functions/src/orders/placeOrder.ts` | Serverless atomic order creation and stock reservation | Mobile PWA & Web storefront |
| `scripts/init_client_postgres_tables.js` | DDL schema initialization for all 38 PostgreSQL tables | Database deployment & staging |

---

## 2. 🟠 HIGH IMPORTANCE (Core Operational & Business Workflows)
| File Path | Functional Responsibility |
| :--- | :--- |
| `lib/orderRoutingEngine.ts` | SLA priority urgency scoring, picker efficiency allocation & rider routing |
| `lib/orderStateMachine.ts` | 19-stage order state machine validation rules |
| `lib/expiryScoringEngine.ts` | Expiry decay scoring & automated clearance sale discount engine |
| `lib/firebaseServices.ts` | Firestore collection CRUD operations & real-time sync listeners |
| `lib/firebaseAuth.ts` | Phone OTP authentication driver & fallback handling |
| `app/checkout/page.tsx` | Multi-step checkout & payment gateway selector |
| `app/orders/[id]/track/page.tsx` | Real-time Leaflet GPS customer tracking screen |
| `app/delivery/page.tsx` | Delivery partner portal PWA & active dispatch dashboard |
| `app/store/page.tsx` | Darkstore admin operations & inventory command center |
| `picker-app/app/picking/[id]/PickingClient.tsx` | Warehouse picker barcode scanner walk interface |
| `components/customer/CartDrawer.tsx` | Interactive slide-out cart & tiered promo selector |
| `components/admin/DispatchControlCenterView.tsx` | Live order routing & manual reassignment console |
| `components/partner/ActiveDeliveryWorkflow.tsx` | Stage-by-stage delivery execution stepper |

---

## 3. 🟡 MEDIUM IMPORTANCE (Auxiliary Services & UI Components)
| File Path | Functional Responsibility |
| :--- | :--- |
| `lib/audioAlerts.ts` | Web Audio API procedural sound synthesizer |
| `lib/locationServices.ts` | Geocoding & OpenStreetMap distance math |
| `lib/recipes.ts` | Cook-at-home recipe & 1-click ingredient bundle mapper |
| `lib/rateLimit.ts` | In-memory sliding window rate limiter |
| `lib/idempotency.ts` | Request deduplication guard |
| `components/admin/Product360Modal.tsx` | Multi-barcode identifier & SKU editor |
| `components/admin/AnalyticsDashboardView.tsx` | GMV, AOV & category sales analytics charts |
| `components/common/RoleSwitcher.tsx` | Multi-portal role switcher (Customer/Admin/Picker/Rider) |

---

## 4. 🔵 DATABASE MIGRATION & REPAIR SCRIPTS (`scripts/`)
*These must remain in the repository for historical schema reproducibility and database auditing.*
* `scripts/cleanup_legacy_user_table.js`
* `scripts/migrate_to_clean_architecture.js`
* `scripts/migrate_v1_1_promotions.js`
* `scripts/audit_postgres_schema.js`
* `scripts/backup_database.js`
* `scripts/test_backup_restore.js`
* `scripts/e2e_order_to_delivery_test.js`
* `scripts/performance_load_test.js`

---

## 5. 📦 DESIGN ARCHIVE CANDIDATES (`_archive/`)
*Safe to move to `_archive/` when cleaning production repositories.*
* `stitch_downloads/` (Static HTML & PNG design prototypes)
* `stitch_pocketkirana_grocery_platform/` (Initial UI screen mockups)
* `download_stitch.ps1` (Scraping utility script)

---

## 6. ⚠️ VERIFIED LEGACY FILES
* `components/partner/NewRequestModal.tsx` — Superseded by embedded `nextAvailableOrder` flow in `app/delivery/page.tsx`. Safe for archival.
