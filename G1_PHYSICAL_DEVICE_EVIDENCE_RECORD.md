# POCKETKIRANA — GATE G1: PHYSICAL DEVICE & OS LIFECYCLE EVIDENCE RECORD

```text
===================================================================================
  GATE G1 STATUS: 🟡 ACTIVE — PHYSICAL EXECUTION IN PROGRESS
===================================================================================
  Candidate ID:       PK-PROD-RC1
  Git Branch:         main
  Regression Suite:   268 / 268 Tests Passed (100%)
  TypeScript Build:   0 Errors (npx tsc --noEmit)
  Target Builds:      PocketKirana-Customer.apk / PocketKirana-Picker.apk / PocketKirana-Delivery.apk
  Total Scenarios:    31 Physical Tests (Customer: 9 | Picker: 11 | Delivery: 11)
  Live Traffic:       🔴 NOT ENABLED
===================================================================================
```

---

## 1. Non-Negotiable G1 Protocols

### A. Evidence Authenticity Standard
- Automated test runs and static code presence **DO NOT** constitute G1 evidence.
- Every test requires physical device observations: hardware model, OS version, measured timings (e.g. `<300ms` barcode decode, `10s` telemetry cycles), network state, and log/media references.

### B. Defect Halting & Re-Tagging Rule
```text
ANY TEST FAILS
      ↓
HALT G1 IMMEDIATELY
      ↓
Log Defect & Root Cause
      ↓
Apply Code Fix
      ↓
Create New Candidate Tag (e.g. PK-PROD-RC2)
      ↓
Run 268-test Automated Regression Baseline (Must Pass 100%)
      ↓
Run TypeScript Verification (0 Errors)
      ↓
Restart Affected Physical G1 Tests
```

---

## 2. Customer App Physical Evidence (9 Scenarios)

### Test ID: C-01 — Cold Boot Performance
```text
Test ID:      C-01
App:          Customer App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G / WiFi (Latency < 50ms)
Precondition: Device powered on, app terminated / cold start.

Expected:     App launches from cold state, splash screen dismisses cleanly, home catalogue renders with categories in < 2.5s without blank white screen.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: C-02 — Login & OTP Verification
```text
Test ID:      C-02
App:          Customer App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G / WiFi
Precondition: Fresh install or logged out state.

Expected:     Phone number entered -> SMS OTP received -> Auto-read/manually entered -> Session token securely persisted in Capacitor preferences -> User profile loaded.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: C-03 — Cart Restoration Across App Restarts
```text
Test ID:      C-03
App:          Customer App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G / WiFi
Precondition: 3 distinct items added to cart with custom quantities.

Expected:     App killed from OS app switcher -> Reopened -> Cart drawer displays all 3 items, quantities, and price calculations identically without item loss.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: C-04 — Background to Foreground Transition
```text
Test ID:      C-04
App:          Customer App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G / WiFi
Precondition: Browsing category page at scroll position Y=800px.

Expected:     Device home button pressed (backgrounded 5 minutes) -> App brought back to foreground -> Active category and scroll position preserved without layout jarring.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: C-05 — Force-Kill & Reopen During Checkout
```text
Test ID:      C-05
App:          Customer App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G / WiFi
Precondition: User on Checkout screen with selected address and delivery slot.

Expected:     App force-killed via OS task manager -> Reopened -> User session active, cart preserved, navigating to checkout restores selected address without data loss.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: C-06 — Airplane-Mode / Network Offline Transition
```text
Test ID:      C-06
App:          Customer App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Airplane Mode (OFFLINE) -> 4G (ONLINE)
Precondition: Active browsing session.

Expected:     Airplane mode toggled -> `OfflineState` banner appears gracefully, cached products remain readable -> Airplane mode disabled -> `NetworkStatusBanner` shows 'Back Online' and auto-refreshes.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: C-07 — Location Permission Lifecycle (Grant / Deny)
```text
Test ID:      C-07
App:          Customer App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G / WiFi
Precondition: Fresh install with no location permissions granted.

Expected:     Location prompt displayed. If Granted: GPS coordinates resolve serviceability to nearest darkstore. If Denied: `PermissionDeniedState` renders with manual pin-code fallback.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: C-08 — Push Notification Deep-Link Navigation
```text
Test ID:      C-08
App:          Customer App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G / WiFi
Precondition: App backgrounded or killed; active order #123 in progress.

Expected:     FCM push notification received ("Order Out for Delivery") -> Tapped -> App launches directly into Order Tracking screen for #123 (not root home screen).
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: C-09 — Checkout State Restoration Under System Memory Pressure
```text
Test ID:      C-09
App:          Customer App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G / WiFi
Precondition: Checkout form partially filled with notes and delivery instructions.

Expected:     Heavy third-party application opened causing OS memory reclaim -> Customer app re-entered -> Form fields and cart totals remain intact.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

---

## 3. Picker App Physical Evidence (11 Scenarios)

### Test ID: P-01 — Cold Boot & Darkstore Hub Queue
```text
Test ID:      P-01
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: Device cold boot on darkstore picking terminal.

Expected:     Picker credentials verified, darkstore hub selected, active picklist queue loaded in < 2.0s without white flash.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-02 — Login & Session Restoration
```text
Test ID:      P-02
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: Picker logged in -> App backgrounded for 10 minutes.

Expected:     App re-opened -> Session remains valid without re-prompting credentials; active picking batch restored.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-03 — Camera Permission & Preview Initialization
```text
Test ID:      P-03
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: Camera permission prompt triggered on first pick.

Expected:     Camera permission granted -> Native camera viewfinder mounts instantly without preview distortion or freeze.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-04 — Physical Barcode Scan Performance (< 300ms)
```text
Test ID:      P-04
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: Physical grocery product with printed EAN-13/UPC barcode under darkstore lighting.

Expected:     Camera pointed at barcode -> Decodes in < 300ms -> Audio beep / haptic pulse emitted -> Item marked picked on UI list.
Actual:       

Evidence:     
- Measured:   
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-05 — Wrong Barcode Scan Rejection
```text
Test ID:      P-05
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: Picklist expects SKU 'A' (e.g. Milk 500ml); physical SKU 'B' (e.g. Milk 1L) scanned.

Expected:     Scanner rejects scan with distinct error buzzer and red visual warning ("Barcode Mismatch"); item count in picklist remains unchanged.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-06 — FEFO Batch Selection Enforcement
```text
Test ID:      P-06
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: Inventory has Batch #1 (Exp: 2 days) and Batch #2 (Exp: 10 days).

Expected:     App forces picking of Batch #1 (earliest expiry); scanning Batch #2 warns picker to retrieve earlier expiring batch first.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-07 — Packing Workflow & Bag QR Association
```text
Test ID:      P-07
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: All items in picklist marked picked.

Expected:     Prompt to scan delivery tote/bag QR code -> Bag QR scanned -> Order transitions to `PACKED` -> Handed off to dispatch queue.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-08 — Screen Wake-Lock During Active Picking
```text
Test ID:      P-08
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: Active pick session with 6 items; phone left untouched for 3 minutes.

Expected:     Display remains active (Capacitor KeepAwake engaged); screen does not dim or lock while picker navigates aisles.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-09 — Background to Foreground Transition During Pick
```text
Test ID:      P-09
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: Picker partially picked 3 of 5 items -> Incoming phone call switches app to background.

Expected:     Call ended / Picker app returned to foreground -> Camera stream and picklist status restore instantly with 3/5 items intact.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-10 — Force-Kill & Reopen During Active Lease Lock
```text
Test ID:      P-10
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Darkstore WiFi
Precondition: Picker actively holding lease lock on Order #123; app killed from OS switcher.

Expected:     App relaunched -> Picker automatically resumes lease on Order #123; completed items 1..3 remain checked; picker can immediately pick item 4.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: P-11 — Darkstore Wi-Fi Dead-Zone Recovery
```text
Test ID:      P-11
App:          Picker App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      WiFi Dead-Zone (No Signal) -> WiFi Reconnected
Precondition: Picker moves into shielded freezer zone with no network signal.

Expected:     Scanned items queue locally in offline buffer; returning to WiFi coverage automatically flushes scan events to server with zero duplication.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

---

## 4. Delivery Partner App Physical Evidence (11 Scenarios)

### Test ID: D-01 — Cold Boot & Shift Start
```text
Test ID:      D-01
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Device cold boot -> Driver toggles "Go Online".

Expected:     Shift status updates to `ONLINE`, background location foreground notification appears in Android/iOS notification shade, GPS fix obtained in < 3.0s.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-02 — Login & Session Restoration
```text
Test ID:      D-02
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Driver authenticated -> App closed and reopened after 15 minutes.

Expected:     Driver session restored securely without credentials prompt; active orders and earnings dashboard rendered.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-03 — Location Permission Lifecycle (Foreground & Background)
```text
Test ID:      D-03
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Permission prompt for "Allow all the time" background location.

Expected:     If granted: Foreground service initiates with persistent notification. If denied: Clear warning stating shift cannot start without background tracking.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-04 — Continuous 5-Minute Background Telemetry (10s Interval)
```text
Test ID:      D-04
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Active assigned delivery in transit; device screen locked and placed in pocket for 5 minutes.

Expected:     Device transmits GPS coordinates every 10 seconds (total >= 28 coordinate packets in 5 minutes) without OS battery-killer termination.
Actual:       

Evidence:     
- Packets:    
- Server Log: 

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-05 — Real-time GPS Telemetry & Heading Accuracy
```text
Test ID:      D-05
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Driver riding motorcycle at 25-35 km/h on urban transit route.

Expected:     Smooth coordinate telemetry; bearing/heading rotates accurately along route; telemetry payload includes valid timestamp, accuracy, and speed.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-06 — GPS Accuracy Degradation & Signal Loss (> 100m)
```text
Test ID:      D-06
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Driver enters underground parking or dense alley (horizontal accuracy degrades to > 100m).

Expected:     App displays "Weak GPS Signal" warning; avoids erratic pin teleportation; utilizes dead-reckoning / last high-confidence coordinate until lock recovered.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-07 — Native Google Maps / Apple Maps Handoff
```text
Test ID:      D-07
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Assigned delivery ready for dispatch.

Expected:     Driver taps "Navigate" -> Native Google Maps (Android) or Apple Maps (iOS) launches with target customer coordinates -> Delivery App continues background tracking.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-08 — Doorstep Delivery OTP Verification
```text
Test ID:      D-08
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Driver at customer location with packaged order.

Expected:     Customer provides 4-digit delivery OTP -> Driver inputs OTP -> Server verifies code -> Order marked `DELIVERED` -> Customer PII automatically purged from device storage.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-09 — Active Delivery to Background & Return
```text
Test ID:      D-09
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Driver receives incoming phone call while navigating active order.

Expected:     Phone call answered and finished -> Delivery App restored from background -> Customer address and action buttons render immediately with zero state loss.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-10 — Force-Kill & Reopen During Active Delivery
```text
Test ID:      D-10
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      4G LTE
Precondition: Active delivery in progress; app swiped away/killed by OS.

Expected:     Driver taps app icon -> App boots directly into active delivery screen for the in-progress order; telemetry service resumes transmitting coordinates.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

### Test ID: D-11 — Offline Doorstep Handover & Queued Sync
```text
Test ID:      D-11
App:          Delivery Partner App
Device:       
OS:           
Build:        PK-PROD-RC1 (Capacitor)
Network:      Mobile Data Lost at Doorstep (Basement/Elevator)
Precondition: Driver attempts OTP verification with no cellular connectivity.

Expected:     App provides clear offline status indication; cryptographically buffers delivery completion payload; syncs with backend the instant network connectivity is restored.
Actual:       

Evidence:     
- Video/Log:  

Result:       [PENDING / PASS / FAIL]
Notes:        
```

---

## 5. Gate G1 Final Execution Matrix

```text
===================================================================================
  G1 — PHYSICAL DEVICE & OS LIFECYCLE SUMMARY MATRIX
===================================================================================

  Customer App Scenarios:       [0] / [9] PASS
  Picker App Scenarios:         [0] / [11] PASS
  Delivery Partner App Scenarios: [0] / [11] PASS
  --------------------------------------------------
  Total Physical Scenarios:     [0] / [31] PASS

  Blocking Defects:             0
  Automated Regression:         268 / 268 Passed (100%)
  TypeScript Compilation:       0 Errors

===================================================================================
  GATE G1 STATUS: 🟡 INCOMPLETE (AWAITING PHYSICAL DEVICE TEST EVIDENCE)
===================================================================================
```
