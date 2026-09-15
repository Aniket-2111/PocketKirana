import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateDistanceKm,
  getRoadDistanceKm,
  getRoadRoute,
  minDistanceToRouteMeters,
  isDeviatedFromRoute,
  validateGpsUpdate,
  getAdaptiveIntervalMs,
  GpsFix,
} from '../lib/locationServices';

describe('Location & Delivery Tracking Services', () => {
  describe('calculateDistanceKm (Haversine)', () => {
    it('returns 0 for identical points', () => {
      const dist = calculateDistanceKm(19.033, 73.317, 19.033, 73.317);
      expect(dist).toBe(0);
    });

    it('calculates accurate distance between known coordinates (Neral to Karjat ~13-14km)', () => {
      // Neral: 19.0330, 73.3170
      // Karjat: 18.9100, 73.3280
      const dist = calculateDistanceKm(19.033, 73.317, 18.91, 73.328);
      expect(dist).toBeGreaterThan(12);
      expect(dist).toBeLessThan(16);
    });

    it('calculates short sub-kilometer distance correctly', () => {
      // ~200m difference in latitude
      const dist = calculateDistanceKm(19.033, 73.317, 19.035, 73.317);
      expect(dist).toBeGreaterThan(0.1);
      expect(dist).toBeLessThan(0.4);
    });
  });

  describe('getRoadRoute & getRoadDistanceKm', () => {
    it('returns full road navigation route with valid geometry and duration', async () => {
      const result = await getRoadRoute(19.033, 73.317, 18.91, 73.328);
      expect(result).toHaveProperty('distanceKm');
      expect(result).toHaveProperty('distanceMeters');
      expect(result).toHaveProperty('durationSeconds');
      expect(result).toHaveProperty('durationMin');
      expect(result).toHaveProperty('geometry');
      expect(result).toHaveProperty('source');
      expect(result.distanceKm).toBeGreaterThan(10);
      expect(result.durationMin).toBeGreaterThan(0);
      expect(Array.isArray(result.geometry)).toBe(true);
      if (result.source === 'osrm') {
        expect(result.geometry.length).toBeGreaterThan(2);
        // Verify coordinates are formatted as [lat, lng]
        const [lat, lng] = result.geometry[0];
        expect(lat).toBeGreaterThan(18.0);
        expect(lng).toBeGreaterThan(72.0);
      }
    });

    it('caches repeated coordinate requests', async () => {
      const res1 = await getRoadDistanceKm(19.033, 73.317, 18.91, 73.328);
      const res2 = await getRoadDistanceKm(19.033, 73.317, 18.91, 73.328);
      expect(res1.distanceKm).toBe(res2.distanceKm);
      expect(res1.durationMin).toBe(res2.durationMin);
    });
  });

  describe('Route Deviation Detection', () => {
    const routeGeometry: [number, number][] = [
      [19.0330, 73.3170],
      [19.0340, 73.3170],
      [19.0350, 73.3170],
      [19.0360, 73.3180],
    ];

    it('identifies points on the route as NOT deviated', () => {
      // Point directly on segment
      const onRoute = isDeviatedFromRoute(19.0340, 73.3170, routeGeometry, 100);
      expect(onRoute).toBe(false);

      // Point within 20 meters of route
      const nearRoute = isDeviatedFromRoute(19.0341, 73.3170, routeGeometry, 100);
      expect(nearRoute).toBe(false);
    });

    it('identifies points far away as deviated (> 100m)', () => {
      // Point ~1km to the east (approx 0.01 deg lng)
      const deviated = isDeviatedFromRoute(19.0340, 73.3270, routeGeometry, 100);
      expect(deviated).toBe(true);
    });
  });

  describe('validateGpsUpdate', () => {
    it('accepts accurate GPS fixes without prior history', () => {
      const fix: GpsFix = {
        latitude: 19.033,
        longitude: 73.317,
        accuracy: 15,
        timestamp: Date.now(),
      };
      const result = validateGpsUpdate(fix);
      expect(result.valid).toBe(true);
    });

    it('rejects fix with poor accuracy when recent good fix exists', () => {
      const prevFix: GpsFix = {
        latitude: 19.033,
        longitude: 73.317,
        accuracy: 10,
        timestamp: Date.now() - 5000, // 5s ago
      };
      const poorFix: GpsFix = {
        latitude: 19.033,
        longitude: 73.317,
        accuracy: 150, // worse than 100m
        timestamp: Date.now(),
      };
      const result = validateGpsUpdate(poorFix, prevFix);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds 100m threshold');
    });

    it('accepts fix with poor accuracy if no recent good fix exists (first lock/tunnel exit)', () => {
      const prevFix: GpsFix = {
        latitude: 19.033,
        longitude: 73.317,
        accuracy: 10,
        timestamp: Date.now() - 35000, // 35s ago (> 20s)
      };
      const fix: GpsFix = {
        latitude: 19.033,
        longitude: 73.317,
        accuracy: 120,
        timestamp: Date.now(),
      };
      const result = validateGpsUpdate(fix, prevFix);
      expect(result.valid).toBe(true);
    });

    it('rejects impossible movement speeds (>120 km/h teleportation)', () => {
      const prevFix: GpsFix = {
        latitude: 19.033,
        longitude: 73.317,
        accuracy: 15,
        timestamp: Date.now() - 5000, // 5 seconds ago
      };
      // Moving 20km in 5 seconds = 14,400 km/h
      const jumpFix: GpsFix = {
        latitude: 19.200,
        longitude: 73.317,
        accuracy: 15,
        timestamp: Date.now(),
      };
      const result = validateGpsUpdate(jumpFix, prevFix);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds 120 km/h limit');
      expect(result.impliedSpeedKmh).toBeGreaterThan(120);
    });

    it('accepts realistic vehicle speeds (<120 km/h)', () => {
      const prevFix: GpsFix = {
        latitude: 19.0330,
        longitude: 73.3170,
        accuracy: 10,
        timestamp: Date.now() - 5000, // 5 seconds ago
      };
      // Moving ~40 meters in 5 seconds = ~28.8 km/h
      const nextFix: GpsFix = {
        latitude: 19.0333,
        longitude: 73.3170,
        accuracy: 10,
        timestamp: Date.now(),
      };
      const result = validateGpsUpdate(nextFix, prevFix);
      expect(result.valid).toBe(true);
    });
  });

  describe('getAdaptiveIntervalMs', () => {
    it('returns fast interval (5s) for moving fast (>= 15 km/h)', () => {
      const interval = getAdaptiveIntervalMs(35, 10);
      expect(interval).toBe(5_000);
    });

    it('returns medium interval (10s) for slow moving (3-15 km/h)', () => {
      const interval = getAdaptiveIntervalMs(10, 10);
      expect(interval).toBe(10_000);
    });

    it('returns power-saver interval (20s) when stationary (< 3 km/h)', () => {
      const interval = getAdaptiveIntervalMs(1, 10);
      expect(interval).toBe(20_000);
    });

    it('applies +5s penalty when accuracy is poor (>50m)', () => {
      // 5s base + 5s penalty = 10s
      const fastPoor = getAdaptiveIntervalMs(35, 60);
      expect(fastPoor).toBe(10_000);

      // 20s base + 5s penalty = 25s
      const statPoor = getAdaptiveIntervalMs(1, 60);
      expect(statPoor).toBe(25_000);
    });
  });
});
