# PocketKirana — Transactional Outbox & Notification Worker

## 1. Outbox Pattern Implementation

To guarantee at-least-once message processing without dual-write inconsistencies, all domain events are committed to the PostgreSQL `outbox_events` table within the same transaction that updates business state.

### Outbox Schema
```sql
CREATE TABLE IF NOT EXISTS outbox_events (
  id VARCHAR(64) PRIMARY KEY,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(24) DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 5,
  lease_token VARCHAR(64),
  lease_expires_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE
);
```

---

## 2. Event Types & Payloads

The system emits standardized events across the business lifecycle:

- `order.placed`: Order record submitted and stock reserved in synchronous PostgreSQL transaction; outbox event emitted for asynchronous customer receipt, notifications, and analytics projections.
- `payment.confirmed`: PhonePe or online payment verified.
- `order.confirmed`: Order verified; picker task queued.
- `order.picking`: Picker started collecting items.
- `order.packed`: Packing completed; sealed package ready.
- `order.ready_for_pickup`: Dispatch engine triggers driver matching.
- `delivery.assigned`: Driver assigned with acceptance countdown.
- `delivery.accepted`: Driver claimed route and is en route to store.
- `delivery.out_for_delivery`: Order picked up from store; en route to customer.
- `delivery.arriving`: Driver within 500m geofence.
- `order.delivered`: Delivery confirmed with OTP; invoice finalized.
- `order.cancelled`: Order cancelled; stock released; refund queued.
- `payment.failed`: Payment failure alert to customer.
- `refund.created` & `refund.completed`: Financial refund progression.

---

## 3. Worker Concurrency & Fencing

1. **Claiming Batch**:
   ```sql
   UPDATE outbox_events
   SET status = 'processing',
       lease_token = $1,
       lease_expires_at = NOW() + INTERVAL '30 seconds'
   WHERE id IN (
     SELECT id FROM outbox_events
     WHERE status = 'pending' OR (status = 'processing' AND lease_expires_at < NOW())
     ORDER BY created_at ASC
     LIMIT 50
     FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
   ```
2. **Lease Fencing**: When completing or failing an event, the worker includes `WHERE id = $1 AND lease_token = $2`. If a slow worker had its lease expired and reclaimed by another worker, the stale worker's update is ignored safely.
3. **Exponential Backoff**: Failed events increment `retry_count` and schedule retry using `NOW() + INTERVAL '2 seconds' * POWER(2, retry_count)`.
4. **Notification Delivery Semantics**: 
   - **Delivery Model**: **At-least-once event processing + idempotent consumers**.
   - **FCM Deduplication & Collapse Keys**: While FCM collapse keys help suppress obsolete messages in device queues, FCM does **not** guarantee exactly-once delivery across all network conditions or device states.
   - **Consumer Idempotency**: Every emitted notification payload carries both `event_id` and a unique `notification_id`. Client applications (Customer, Picker, Delivery APKs) must track processed notification IDs in local storage (e.g. SQLite / Room / SharedPreferences) to drop duplicate deliveries gracefully.
   - **Worker Separation**: The outbox worker is strictly responsible for asynchronous notifications, live Firestore read mirrors, and downstream projections. It is **never** responsible for synchronous business invariants like inventory reservation.
