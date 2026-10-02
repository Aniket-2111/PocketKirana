import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  evaluateServerServiceability,
  getStoreOperationalSettings,
  clearStoreCache,
  calculateDistanceKm,
} from '../lib/serverServiceability';
import { POST as checkoutHandler } from '../app/api/checkout/route';

// Mock DB pool
const mockQuery = vi.fn();
const mockClient = {
  query: vi.fn((sql, params) => mockQuery(sql, params)),
  release: vi.fn(),
};

vi.mock('../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn((sql, params) => mockQuery(sql, params)),
  })),
  categorizeDbError: vi.fn(() => ({ category: 'UNKNOWN', message: 'DB Error' })),
}));

// Mock Firebase & pricing
vi.mock('../lib/firebase', () => ({
  db: {},
  isFirebaseConfigured: vi.fn(() => false),
}));

vi.mock('../lib/catalogSync', () => ({
  validateServerPricing: vi.fn(async (items: any[]) => ({
    recalculatedSubtotal: items.reduce((sum: number, it: any) => sum + (it.unitPrice || 100) * (it.quantity || 1), 0),
    inactiveItems: [],
    outOfStockItems: [],
    priceChanges: [],
    items: items.map((it: any) => ({
      ...it,
      authoritativeUnitPrice: it.unitPrice || 100,
    })),
  })),
}));

// Standard mock store row matching PostgreSQL pocketkirana_db reality
const createMockStoreRow = (overrides: Record<string, any> = {}) => ({
  id: 'store_primary',
  name: 'PocketKirana Central Darkstore',
  code: 'STORE-001',
  latitude: '19.02245360',
  longitude: '73.32100180',
  is_active: true,
  delivery_radius_km: '3.00',
  max_road_distance_km: '4.50',
  road_distance_multiplier: '1.35',
  opening_time: '06:00',
  closing_time: '23:00',
  delivery_fee: 29,
  free_delivery_threshold: 499,
  minimum_order_value: 199,
  ...overrides,
});

describe('Phase 1B — Canonical Server-Side Serviceability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    clearStoreCache();
  });

  describe('Direct Serviceability Evaluator Unit Tests', () => {
    it('rejects missing coordinates with INVALID_COORDINATES', async () => {
      const res = await evaluateServerServiceability('store_primary', undefined, undefined, 300);
      expect(res.serviceable).toBe(false);
      expect(res.code).toBe('INVALID_COORDINATES');
      expect(res.error).toContain('required');
    });

    it('rejects invalid/out-of-bounds coordinates with INVALID_COORDINATES', async () => {
      const res1 = await evaluateServerServiceability('store_primary', 'not-a-number', 73.32, 300);
      expect(res1.serviceable).toBe(false);
      expect(res1.code).toBe('INVALID_COORDINATES');

      const res2 = await evaluateServerServiceability('store_primary', 195.0, 73.32, 300);
      expect(res2.serviceable).toBe(false);
      expect(res2.code).toBe('INVALID_COORDINATES');
    });

    it('rejects unknown store IDs with STORE_NOT_FOUND without defaulting to store_primary', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No matching store found

      const res = await evaluateServerServiceability('unknown_store_xyz', 19.0224, 73.3210, 300);
      expect(res.serviceable).toBe(false);
      expect(res.code).toBe('STORE_NOT_FOUND');
      expect(res.error).toContain('not found');
    });

    it('resolves legacy store-001 identifier explicitly to store_primary via code STORE-001', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [createMockStoreRow()] });

      const store = await getStoreOperationalSettings('store-001');
      expect(store).not.toBeNull();
      expect(store?.id).toBe('store_primary');
      expect(store?.code).toBe('STORE-001');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 OR UPPER(code) = UPPER($1)'),
        ['store-001']
      );
    });

    it('rejects inactive store with STORE_OFFLINE', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [createMockStoreRow({ is_active: false })] });

      const res = await evaluateServerServiceability('store_primary', 19.0224, 73.3210, 300);
      expect(res.serviceable).toBe(false);
      expect(res.code).toBe('STORE_OFFLINE');
      expect(res.error).toContain('offline');
    });

    it('rejects closed store outside operating hours with STORE_CLOSED', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [createMockStoreRow({ opening_time: '10:00', closing_time: '20:00' })],
      });

      // 03:00 AM (store closed)
      const nighttime = new Date(2026, 9, 2, 3, 0, 0);
      const res = await evaluateServerServiceability('store_primary', 19.0224, 73.3210, 300, {
        currentTime: nighttime,
      });

      expect(res.serviceable).toBe(false);
      expect(res.code).toBe('STORE_CLOSED');
      expect(res.error).toContain('closed');
    });

    it('rejects subtotal below minimum order value with MINIMUM_ORDER_VALUE_NOT_MET', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [createMockStoreRow({ minimum_order_value: 199 })] });

      const daytime = new Date(2026, 9, 2, 14, 0, 0); // 2 PM
      const res = await evaluateServerServiceability('store_primary', 19.0224, 73.3210, 150, {
        currentTime: daytime,
      });

      expect(res.serviceable).toBe(false);
      expect(res.code).toBe('MINIMUM_ORDER_VALUE_NOT_MET');
      expect(res.error).toContain('Minimum order value');
    });

    it('rejects address outside Haversine delivery radius with OUT_OF_SERVICE_AREA', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [createMockStoreRow({ delivery_radius_km: 3.0 })] });

      // Badlapur / Karjat area (approx 15 km away from Neral darkstore)
      const remoteLat = 19.1500;
      const remoteLng = 73.2500;
      const daytime = new Date(2026, 9, 2, 14, 0, 0);

      const res = await evaluateServerServiceability('store_primary', remoteLat, remoteLng, 300, {
        currentTime: daytime,
      });

      expect(res.serviceable).toBe(false);
      expect(res.code).toBe('OUT_OF_SERVICE_AREA');
      expect(res.error).toContain('exceeds the maximum delivery radius');
    });

    it('rejects address where estimated road distance exceeds max_road_distance_km with ROAD_LIMIT_EXCEEDED', async () => {
      // Configure a store where straight radius is 3.0 km, but max road distance is tightly capped at 3.2 km
      // With multiplier 1.35x, a 2.6 km straight line = 3.5 km road -> should trigger ROAD_LIMIT_EXCEEDED
      mockQuery.mockResolvedValueOnce({
        rows: [
          createMockStoreRow({
            delivery_radius_km: 3.5,
            max_road_distance_km: 3.2,
            road_distance_multiplier: 1.35,
          }),
        ],
      });

      // 2.7 km away straight line (within 3.5 km radius, but 2.7 * 1.35 = 3.6 km road > 3.2 km limit)
      const lat = 19.0465;
      const lng = 73.3210;
      const daytime = new Date(2026, 9, 2, 14, 0, 0);

      const res = await evaluateServerServiceability('store_primary', lat, lng, 300, {
        currentTime: daytime,
      });

      expect(res.serviceable).toBe(false);
      expect(res.code).toBe('ROAD_LIMIT_EXCEEDED');
      expect(res.error).toContain('maximum allowed road limit');
    });

    it('accepts valid Neral coordinates and calculates PostgreSQL store delivery fee', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [createMockStoreRow()] });

      // Neral Station (approx 0.5 km from Maule Kirana Darkstore)
      const neralLat = 19.0224536;
      const neralLng = 73.3210018;
      const daytime = new Date(2026, 9, 2, 14, 0, 0);

      const res = await evaluateServerServiceability('store_primary', neralLat, neralLng, 250, {
        currentTime: daytime,
      });

      expect(res.serviceable).toBe(true);
      expect(res.store?.id).toBe('store_primary');
      expect(res.straightLineDistanceKm).toBeLessThanOrEqual(0.1);
      expect(res.deliveryFee).toBe(29); // subtotal 250 < 499 threshold
    });

    it('waives delivery fee when subtotal meets freeDeliveryThreshold from store config', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [createMockStoreRow()] });

      const neralLat = 19.0224536;
      const neralLng = 73.3210018;
      const daytime = new Date(2026, 9, 2, 14, 0, 0);

      const res = await evaluateServerServiceability('store_primary', neralLat, neralLng, 550, {
        currentTime: daytime,
      });

      expect(res.serviceable).toBe(true);
      expect(res.deliveryFee).toBe(0); // subtotal 550 >= 499 threshold
    });
  });

  describe('Checkout Route Serviceability Gate Integration', () => {
    it('blocks checkout on missing coordinates BEFORE database transaction or inventory lock', async () => {
      const checkoutReq = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartItems: [{ productId: 'prod_1', quantity: 2, unitPrice: 150 }],
          address: {
            fullName: 'Mumbai User',
            addressLine1: 'South Mumbai Road',
            city: 'Mumbai',
            pincode: '400001',
            // No latitude or longitude
          },
          paymentMethod: 'cod',
          storeId: 'store-001',
        }),
      });

      const res = await checkoutHandler(checkoutReq);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.code).toBe('INVALID_COORDINATES');
      // Verify NO database transaction was begun
      expect(mockQuery).not.toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), expect.anything());
    });

    it('blocks checkout on unserviceable remote address BEFORE database transaction', async () => {
      // Mock store query returning Neral Darkstore settings
      mockQuery.mockResolvedValueOnce({ rows: [createMockStoreRow()] });

      const checkoutReq = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartItems: [{ productId: 'prod_1', quantity: 2, unitPrice: 150 }],
          address: {
            fullName: 'Remote User',
            addressLine1: 'Colaba, Mumbai',
            city: 'Mumbai',
            pincode: '400005',
            latitude: 18.9067, // Colaba, ~65 km away
            longitude: 72.8147,
          },
          paymentMethod: 'cod',
          storeId: 'store-001',
        }),
      });

      const res = await checkoutHandler(checkoutReq);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.code).toBe('OUT_OF_SERVICE_AREA');
      // Verify NO database transaction or inventory lock occurred
      expect(mockQuery).not.toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), expect.anything());
    });
  });
});
