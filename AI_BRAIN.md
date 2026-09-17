# AI BRAIN — PRIMARY MEMORY

> This is the first file the AI must read before doing any task.
> Do NOT scan the full project unless this file explicitly says more context is needed.

## 1. Project Identity

- **Project Name**: PocketKirana
- **Project Type**: Full-stack Quick-Commerce (10-minute grocery delivery) with Web and Mobile (Capacitor Android) apps.
- **Primary Goal**: Deliver local groceries in under 10 minutes with DarkStore picking, driver live routing, online (PhonePe) & cash payments, and multi-role operations.

## 2. Current Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide React, Zustand (`lib/store.ts`).
- **Mobile Apps**: Capacitor 8 (`@capacitor/android`, `@capacitor/geolocation`), Android SDK 36.
- **Backend / APIs**: Next.js Route Handlers (`app/api/*`), Firebase Cloud Functions (`functions/`), PhonePe Payment Gateway (`pg-sandbox` / production).
- **Database & Sync**: Firebase Firestore (real-time collections: `orders`, `inventory`, `pickingTasks`, `users`, `drivers`, `payments`), PostgreSQL / Neon for transactional schemas.
- **Geocoding & Routing**: `@capacitor/geolocation` (native device GPS), OpenStreetMap Nominatim, OSRM routing.

## 3. Project Structure Summary

```text
pocketkirana/
├── app/                  -> Admin & customer web storefront (Next.js 15)
│   ├── api/              -> API routes (PhonePe payments, checkout, orders, inventory)
│   ├── admin/            -> Admin management dashboard
│   ├── product/          -> Product details & gallery
│   └── checkout/         -> Checkout & PhonePe redirect flows
├── components/           -> Reusable UI (admin, customer, layout, ui)
│   ├── admin/            -> ProductEditorModal, PaymentsAndSettlementView, etc.
│   └── customer/         -> HeroBanner, CategoryGrid, CartDrawer, etc.
├── customer-app/         -> Dedicated Customer Android Capacitor App (ports 3002)
│   ├── app/              -> /home, /categories, /cart, /checkout, /setup-address, /orders
│   ├── components/       -> CustomerShell, LocationPermissionGuard, ProductCard
│   └── lib/              -> deviceLocation.ts (Capacitor Geolocation)
├── delivery-app/         -> Dedicated Delivery Partner Android App (port 3003)
├── lib/                  -> Shared logic (store.ts, mockData.ts, firebase.ts, phonepeClient.ts, locationServices.ts)
└── PocketKirana-Customer.apk -> Single verified customer Android APK
```

## 4. Important Architecture Decisions

1. **Single Master APK Output**: Keep only one Customer APK at root (`PocketKirana-Customer.apk`). No duplicate subfolders.
2. **Native Geolocation Guard**: Use `@capacitor/geolocation` for native Android location dialogs and persist grant state in `localStorage` (`pk_location_granted`).
3. **Store-First State Sync**: Zustand store (`lib/store.ts`) manages optimistic updates with background Firestore synchronization.
4. **PhonePe Gateway**: Payment initiation via `/api/payments/phonepe/create` with fallback to mock sandbox or external UPI intent triggers.
5. **Admin Split Screen & Multi-Photo**: `ProductEditorModal.tsx` provides 2-column split editing with multi-image gallery upload and `maxDisplayImages` constraint.

## 5. Existing Features

### Completed
- Customer storefront: Categorized catalog, instant search, product detail multi-image gallery, 10-minute delivery badges.
- Location setup: Auto-GPS detection with `@capacitor/geolocation`, manual area search, service zone validation.
- Cart & Checkout: 1-tap floating checkout pill, dynamic coupons, COD and PhonePe payment integration, animated order confirmation.
- Order Lifecycle: DarkStore stock reservation, picking tasks, driver dispatch, live order tracking (`/orders/[id]`).
- Delivery app: Driver authentication, active order delivery flow, cash settlement & wallet reconciliation.
- Admin dashboard: Real-time orders, driver settlements, two-column split product catalog editor.

## 6. Important APIs / Routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/payments/phonepe/create` | Initiates PhonePe gateway transaction / UPI intent |
| POST | `/api/payments/phonepe/verify` | Verifies PhonePe payment checksum & status |
| POST | `/api/checkout/calculate-price` | Computes item subtotal, discounts, and delivery fees |
| GET | `/api/orders/[id]` | Fetches detailed order and items status |

## 7. Important File Map

| Area | Primary Files |
|---|---|
| State Management | `lib/store.ts` |
| Customer Mobile UI | `customer-app/components/CustomerShell.tsx`, `customer-app/app/home/page.tsx` |
| Location Permissions | `customer-app/lib/deviceLocation.ts`, `customer-app/components/LocationPermissionGuard.tsx`, `customer-app/app/setup-address/page.tsx` |
| Cart & Checkout | `customer-app/app/cart/page.tsx`, `customer-app/app/checkout/page.tsx`, `lib/phonepeClient.ts` |
| Admin Console | `components/admin/ProductEditorModal.tsx`, `components/admin/PaymentsAndSettlementView.tsx` |
| Firebase & Cloud Sync | `lib/firebase.ts`, `functions/src/orders/placeOrder.ts` |

## 8. Recent Changes

- **Sep 15, 2026**: Integrated `@capacitor/geolocation` in `customer-app/lib/deviceLocation.ts` and `setup-address/page.tsx` for native Android location prompts.
- **Sep 15, 2026**: Fixed order placement item extraction in `lib/store.ts` with safe property chaining and default address fallbacks.
- **Sep 15, 2026**: Added floating cart & checkout action bar in `CustomerShell.tsx`.
- **Sep 15, 2026**: Built single unified `PocketKirana-Customer.apk` (9.59 MB).

## 9. Current Task Context

- **Current Status**: All initial Customer APK, location permissions, and checkout flows are working and verified.
- **Mode**: Token-Efficient Project Memory Mode active.
