# POCKETKIRANA — PRODUCTION CANDIDATE & VERIFICATION GATE RECORD

```text
===================================================================================
  CANDIDATE METADATA & BASELINE STATUS
===================================================================================
  Candidate ID:       PK-PROD-RC1
  Git Branch:         main
  Regression Suite:   268 / 268 Tests Passed (100%)
  TypeScript Build:   0 Errors (npx tsc --noEmit)
  Dev Overlays:       Removed & Disabled (NotificationSimulator purge verified)
  Live Traffic Gate:  🔴 NOT ENABLED (Gated behind G0–G9 Verification)
===================================================================================
```

---

## 1. Gated Production Verification Sequence

```text
G0 — Code & Build Freeze
        ↓
G1 — Physical Device & OS Lifecycle
        ↓
G2 — Payment Sandbox & Webhook Authority
        ↓
G3 — FCM Push Notification Engine
        ↓
G4 — GPS Hardware & Authoritative Darkstore Range
        ↓
G5 — Controlled Network & Offline State Resilience
        ↓
G6 — PostgreSQL Concurrency & Outbox Worker Fencing
        ↓
G7 — Offline Customer PII Security & Auto-Purge
        ↓
G8 — Production Infrastructure & Disaster Recovery
        ↓
G9 — Controlled Single-Darkstore Pilot
        ↓
🟢 AUTHORIZATION FOR LIVE CUSTOMER TRAFFIC
```

---

## 2. Gate Definitions & Evidence Requirements

### G0 — Code & Build Freeze
- **Objective**: Freeze candidate code, verify regression test baseline, and validate clean production build.
- **Criteria**:
  - Regression baseline locked at **268 passing automated tests**.
  - `npx tsc --noEmit` exits with `0` errors.
  - No debug/simulator UI panels present in bundle.
  - Zero hard-coded credentials or secrets in source files.

### G1 — Physical Device & OS Lifecycle
- **Objective**: Verify Capacitor mobile bridges on real Android & iOS hardware.
- **Coverage**:
  - **Customer App**: Cold boot, OTP auto-read, cart restoration, app backgrounding, kill & resume.
  - **Picker App**: Real camera focus, physical barcode/UPC scanning, FEFO batch selection, screen wake-lock.
  - **Delivery Partner App**: Background location access, real-time GPS telemetry, external Google Maps handoff, OTP doorstep proof.

### G2 — Payment Sandbox & Webhook Authority
- **Objective**: Verify that orders and earnings transitions are driven authoritatively by server-side webhooks.
- **Coverage**:
  - PhonePe / Razorpay S2S webhook signature verification (`X-VERIFY`).
  - Full lifecycle states: `INITIATED` $\rightarrow$ `PROCESSING` $\rightarrow$ `VERIFYING` $\rightarrow$ `SUCCESS` / `FAILED` / `REFUNDED`.
  - **Critical Failure Mode**: Client disconnects after payment $\rightarrow$ Webhook reconciles `PAID` $\rightarrow$ Client retries $\rightarrow$ Existing transaction detected, preventing double charge or secondary order creation.

### G3 — FCM Push Notification Engine
- **Objective**: Ensure role-based notifications reach users reliably across all app lifecycles.
- **Coverage**:
  - Notification arrival in foreground, background, and killed application states.
  - Deep-link handling (tapping notification opens specific order tracking or picking task).
  - Token rotation, permission revocations, and in-app database fallback when FCM is offline.

### G4 — GPS Hardware & Authoritative Darkstore Range
- **Objective**: Guarantee delivery serviceability is enforced by the authoritative backend configuration.
- **Coverage**:
  - Accurate vs inaccurate GPS horizontal drift ($> 100\text{m}$).
  - Hardware GPS disabled vs software permission denied distinction.
  - Strict darkstore boundary calculation ($5\text{km}$ radius) driven by server configuration.

### G5 — Controlled Network & Offline State Resilience
- **Objective**: Exercise all UI state transitions under simulated network impairments.
- **Coverage**:
  - Online $\rightarrow$ Offline $\rightarrow$ Online transitions.
  - Request timeouts and slow 2G/3G connections.
  - Stale search request protection (newer search tokens discard delayed responses).

### G6 — PostgreSQL Concurrency & Outbox Worker Fencing
- **Objective**: Guarantee data integrity and exactly-once execution across concurrent backend workers.
- **Coverage**:
  - Concurrent picker claiming on Order #123 (lease fencing ensures only 1 picker packs).
  - Concurrent delivery completion workers (idempotency key ensures exactly 1 ledger entry).
  - Concurrent admin inventory updates (optimistic concurrency versioning prevents lost updates).

### G7 — Offline Customer PII Security & Auto-Purge
- **Objective**: Protect customer personal data on delivery devices.
- **Coverage**:
  - Only actively assigned order data is readable offline.
  - Customer name, phone number, and address are immediately purged upon order delivery, cancellation, or driver logout.
  - No customer PII remains in permanent unencrypted browser storage.

### G8 — Production Infrastructure & Disaster Recovery
- **Objective**: Validate production cloud infrastructure and failover resilience.
- **Coverage**:
  - PostgreSQL managed backups and point-in-time recovery testing.
  - TLS / SSL termination and Cloudflare CDN caching headers.
  - Isolated outbox worker processes with lease-token expiration guards.

### G9 — Controlled Single-Darkstore Pilot
- **Objective**: Execute real grocery deliveries under tightly monitored operational constraints.
- **Coverage**:
  - Single darkstore hub (e.g. Neral Hub).
  - Real ₹1 transactions and live driver dispatches.
  - SLA tracking: Picking $\le 3\text{ min}$, Delivery $\le 8\text{ min}$.

---

## 3. Immutable Candidate Gate Tracker

```text
===================================================================================
  CANDIDATE GATE EXECUTION CHECKLIST
===================================================================================

  [X] G0 — Code & Build Freeze               PASSED (268/268 Tests, 0 TS Errors)
  [ ] G1 — Physical Device & OS Lifecycle     READY FOR EXECUTION
  [ ] G2 — Payment Sandbox & Webhooks        READY FOR EXECUTION
  [ ] G3 — FCM / Push Notifications          READY FOR EXECUTION
  [ ] G4 — GPS & Darkstore Range Checks       READY FOR EXECUTION
  [ ] G5 — Production Network Resilience     READY FOR EXECUTION
  [ ] G6 — DB & Outbox Worker Concurrency    READY FOR EXECUTION
  [ ] G7 — Offline PII Security & Purge      READY FOR EXECUTION
  [ ] G8 — Production Infrastructure Check   READY FOR EXECUTION
  [ ] G9 — Controlled Single-Hub Pilot       PENDING G1–G8 COMPLETION

===================================================================================
  FINAL LAUNCH AUTHORIZATION: 🔴 NOT ENABLED
===================================================================================
```
