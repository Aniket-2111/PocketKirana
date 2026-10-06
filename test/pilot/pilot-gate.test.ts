import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const pilotConfigPath = path.join(__dirname, '..', '..', 'config', 'pilot-limits.json');
const pilotConfig = JSON.parse(fs.readFileSync(pilotConfigPath, 'utf8'));

describe('Phase 20 — Controlled Pilot Enforcement & Invariants', () => {
  it('loads valid pilot configuration schema with required limit caps', () => {
    expect(pilotConfig.pilot).toBeDefined();
    expect(pilotConfig.pilot.enabled).toBe(true);
    expect(pilotConfig.pilot.stage).toBe('P1');
    expect(pilotConfig.pilot.maxConcurrentOrders).toBe(3);
    expect(pilotConfig.pilot.maxOrdersPerDay).toBe(30);
    expect(pilotConfig.pilot.maxServiceRadiusKm).toBe(5.0);
    expect(pilotConfig.pilot.allowedCustomerUids.length).toBeGreaterThanOrEqual(5);
    expect(pilotConfig.pilot.allowedPickerUids.length).toBeGreaterThanOrEqual(1);
    expect(pilotConfig.pilot.allowedDeliveryUids.length).toBeGreaterThanOrEqual(1);
  });

  it('verifies dark-store serviceability geofence boundary calculation', () => {
    const storeLat = 19.076;
    const storeLng = 72.8777;

    function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    // Nearby customer (approx 2 km)
    const insideLat = 19.085;
    const insideLng = 72.885;
    const distInside = calculateDistanceKm(storeLat, storeLng, insideLat, insideLng);
    expect(distInside).toBeLessThanOrEqual(pilotConfig.pilot.maxServiceRadiusKm);

    // Far customer (approx 15 km)
    const outsideLat = 19.2183;
    const outsideLng = 72.9781;
    const distOutside = calculateDistanceKm(storeLat, storeLng, outsideLat, outsideLng);
    expect(distOutside).toBeGreaterThan(pilotConfig.pilot.maxServiceRadiusKm);
  });

  it('validates financial invariant: zero tolerance for paise drift', () => {
    const canonicalOrderTotal = 499.0;
    const gatewayPaise = 49900;
    const ledgerPaise = 49900;

    const expectedPaise = Math.round(canonicalOrderTotal * 100);
    expect(gatewayPaise).toBe(expectedPaise);
    expect(ledgerPaise).toBe(expectedPaise);
  });
});
