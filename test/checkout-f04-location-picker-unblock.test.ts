/**
 * Phase 2.7C.7.3 — Finding F-04 Regression Tests
 * LocationPickerModal: Saved Address Click Guard Removal
 *
 * Verifies:
 * 1. `checkZoneServiceability` is NOT called in the saved-address render path
 * 2. `fetchShopsFS` / `setStoresState` Firestore sync is NOT imported
 * 3. The click handler is unconditional (no `addrServiceable &&` guard)
 * 4. The canonical API `/api/serviceability/check` is used for map-pin geocoding
 * 5. Per-address zone badges are loaded asynchronously from the canonical API
 */

import { describe, test, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const MODAL_PATH = path.join(
  __dirname,
  '../components/customer/LocationPickerModal.tsx'
);

let source: string;

beforeAll(() => {
  source = fs.readFileSync(MODAL_PATH, 'utf-8');
});

// ─── F-04.1: Legacy imports removed ─────────────────────────────────────────

test('F-04.1a: checkZoneServiceability is NOT imported from locationServices', () => {
  expect(source).not.toMatch(/import[^}]*checkZoneServiceability[^}]*from/);
});

test('F-04.1b: setStoresState is NOT imported from locationServices', () => {
  expect(source).not.toMatch(/import[^}]*setStoresState[^}]*from/);
});

test('F-04.1c: ZoneServiceability type is NOT imported from locationServices', () => {
  expect(source).not.toMatch(/import[^}]*ZoneServiceability[^}]*from/);
});

test('F-04.1d: fetchShopsFS is NOT imported from firebaseServices', () => {
  expect(source).not.toMatch(/import[^;]*fetchShopsFS/);
});

// ─── F-04.2: Legacy runtime calls removed ────────────────────────────────────

test('F-04.2a: checkZoneServiceability is NOT called anywhere in the file', () => {
  expect(source).not.toMatch(/checkZoneServiceability\s*\(/);
});

test('F-04.2b: fetchShopsFS is NOT called anywhere in the file', () => {
  expect(source).not.toMatch(/fetchShopsFS\s*\(/);
});

test('F-04.2c: setStoresState is NOT called anywhere in the file', () => {
  expect(source).not.toMatch(/setStoresState\s*\(/);
});

// ─── F-04.3: Click guard removed from saved address handler ──────────────────

test('F-04.3: Saved address onClick does NOT contain addrServiceable guard', () => {
  // The old guard was: onClick={() => addrServiceable && handleSelectSaved(addr)}
  expect(source).not.toMatch(/onClick[^}]*addrServiceable\s*&&\s*handleSelectSaved/);
});

test('F-04.4: handleSelectSaved is called unconditionally in saved address onClick', () => {
  // The new form is: onClick={() => handleSelectSaved(addr)}
  expect(source).toMatch(/onClick=\{[^}]*handleSelectSaved\(addr\)[^}]*\}/);
});

// ─── F-04.4: Canonical API used for map-pin serviceability ───────────────────

test('F-04.5: /api/serviceability/check is fetched for map-pin geocoding', () => {
  expect(source).toMatch(/\/api\/serviceability\/check\?lat=\$\{lat\}/);
});

test('F-04.6: /api/serviceability/check is fetched per saved address', () => {
  expect(source).toMatch(/\/api\/serviceability\/check\?lat=\$\{addr\.latitude\}/);
});

// ─── F-04.5: savedAddrZones state replaces per-render checkZoneServiceability ─

test('F-04.7: savedAddrZones state is declared', () => {
  expect(source).toMatch(/savedAddrZones/);
  expect(source).toMatch(/setSavedAddrZones/);
});

test('F-04.8: "Deliver here" button is always rendered (not conditionally on serviceability)', () => {
  // Old: addrServiceable ? <button>Deliver here</button> : <button>Change Pin</button>
  // New: always a single "Deliver here" button
  expect(source).toMatch(/Deliver here/);
  // "Change Pin" button (the blocked fallback) must be gone
  expect(source).not.toMatch(/Change Pin/);
});

// ─── F-04.6: Hardcoded "3 KM" strings replaced with dynamic values ───────────

test('F-04.9: Hardcoded "3 KM Neral Delivery Zone" badge string is removed', () => {
  expect(source).not.toMatch(/Within 3 KM Neral Delivery Zone/);
});

test('F-04.10: Hardcoded "3 KM delivery zone" error badge is removed from saved addresses', () => {
  expect(source).not.toMatch(/Outside 3 KM delivery zone/);
});
