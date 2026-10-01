# PocketKirana — Delivery Partner & Dispatch Architecture

## 1. Dispatch Engine & Authoritative Assignments

PostgreSQL `delivery_assignments` is the authoritative source of truth for all delivery operations.

```
READY_FOR_PICKUP
       │
       ▼ (Dispatch Engine locates available nearby driver)
ASSIGNED (with server-side expires_at = NOW() + 60s)
       │
       ├───► If accepted before expires_at ──► ACCEPTED
       │
       └───► If expires_at passes ──────────► REASSIGNED to next driver
```

### Invariants:
1. **Single Assignment Concurrency**: A delivery partner can have at most one active in-flight assignment unless operating in multi-order batching mode.
2. **Acceptance Expiry**: Assignments carry a strict 60-second `expires_at` timer. Acceptance attempts submitted after expiry return HTTP 410 Gone.
3. **Cryptographically Secure OTPs**:
   - **Pickup OTP**: Verified when partner collects the bag from store staff.
   - **Delivery OTP**: Verified when partner delivers to the customer.
   - Generated using `crypto.randomInt` (Math.random is strictly forbidden).
   - Evaluated with constant-time string comparison (`crypto.timingSafeEqual`) to prevent timing side-channels.
   - Guarded by maximum attempt rate limiting (max 3 failed attempts before lock).
4. **COD Cash Gate**: If an order is Cash on Delivery, the delivery partner cannot mark the order as delivered without explicitly recording the cash collection.
5. **Idempotent Delivery Completion**: Once an order reaches `DELIVERED`, repeated requests return success idempotently without duplicate notifications or invoice generations.

---

## 2. Driver GPS Telemetry Architecture & Throttling

To balance real-time tracking fidelity on customer maps with PostgreSQL database stability, GPS location pings are partitioned strictly by channel:

```text
[Driver Mobile APK]
         │
         ├───► (High Frequency: Every 3-5 seconds)
         │       ▼
         │   Firebase Realtime Database (`/driver_locations/{driverId}`)
         │       │
         │       ▼
         │   [Customer App Live Map View]
         │
         └───► (Throttled Milestones / Batched: 2-3 mins or state events)
                 ▼
             Next.js Delivery API (`/api/delivery/location/flush`)
                 │
                 ▼
             PostgreSQL `driver_location_logs` (Sampled History Only)
```

### Invariants for Location Storage:
1. **Never Write Every GPS Ping to PostgreSQL**: Streaming high-frequency pings (3s intervals across dozens of drivers) directly to PostgreSQL exhausts connection pools and saturates transaction logs with ephemeral data.
2. **Authoritative Milestones Only in PostgreSQL**: PostgreSQL records only milestone coordinates:
   - Order pickup at store (`PICKED_UP`)
   - Proximity entry into 500m geofence (`ARRIVED_AT_CUSTOMER`)
   - Final handover point (`DELIVERED`)
   - Periodic 2-minute heartbeat checkpoint (for dispute resolution)
3. **Ephemeral Epilogue**: Firebase Realtime DB driver location keys expire or clear when the driver goes offline or finishes their active shift.
