# Phase 19 — Gate G2: Firebase Production Environment Verification

## 1. Specification & Criteria
Gate G2 establishes the production configuration, security rules, projection boundaries, and isolation guarantees for Firebase (`pocketkirana-prod`).

### 1.1 Project Isolation
- Production Project ID: `pocketkirana-prod`
- Storage Bucket: `pocketkirana-prod.appspot.com`
- Isolation Guard: Explicit rejection of development project credentials (`pocketkirana-dev`) in production mode (`NODE_ENV === 'production'`).

### 1.2 Firestore Security Rules & Read Model
- Server-side PostgreSQL is the sole transactional command authority.
- Direct client writes to `orders`, `payments`, `stock_reservations`, and `outbox_events` are blocked in `firestore.rules`.
- Projections from Outbox Worker include `_last_applied_event_id`, `_last_event_type`, and `_projected_at` for monotonic ordering.

### 1.3 Firebase Cloud Messaging (FCM) & Storage
- VAPID key pairs configured for PWA push notifications.
- Role-based dispatch targets (Customer, Picker pool, Delivery pool, Admin).
- Cloud Storage bucket for invoice PDFs and product assets with public-read / admin-write rules.
