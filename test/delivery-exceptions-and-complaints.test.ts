import { describe, it, expect } from 'vitest';
import {
  canTransitionOrder,
  assertOrderTransition,
  isAllowedTransition,
  VALID_ORDER_TRANSITIONS
} from '../lib/orderStateMachine';
import {
  calculateComplaintSlaStatus,
  DEFAULT_COMPLAINT_WINDOW_HOURS
} from '../lib/customerComplaintService';
import {
  isGroceryItemRestockable,
  categorizeReturnDisposition
} from '../lib/returnService';
import type { OrderStatus, ItemInspectionDisposition } from '../types';

describe('PocketKirana Delivery Exceptions, Complaints & Returns Engine', () => {

  describe('1. State Machine Validations & Transitions', () => {
    it('allows OUT_FOR_DELIVERY to transition to ARRIVED_AT_CUSTOMER, DELIVERY_ATTEMPTED, and DELIVERY_FAILED', () => {
      expect(isAllowedTransition('OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER')).toBe(true);
      expect(isAllowedTransition('OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED')).toBe(true);
      expect(isAllowedTransition('OUT_FOR_DELIVERY', 'DELIVERY_FAILED')).toBe(true);
      expect(isAllowedTransition('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
    });

    it('allows ARRIVED_AT_CUSTOMER to transition to DELIVERY_FAILED, DELIVERY_ATTEMPTED, and DELIVERED', () => {
      expect(isAllowedTransition('ARRIVED_AT_CUSTOMER', 'DELIVERY_FAILED')).toBe(true);
      expect(isAllowedTransition('ARRIVED_AT_CUSTOMER', 'DELIVERY_ATTEMPTED')).toBe(true);
      expect(isAllowedTransition('ARRIVED_AT_CUSTOMER', 'DELIVERED')).toBe(true);
    });

    it('allows DELIVERY_FAILED to transition to RETURN_PENDING, RETURN_IN_TRANSIT, and CANCELLED', () => {
      expect(isAllowedTransition('DELIVERY_FAILED', 'RETURN_PENDING')).toBe(true);
      expect(isAllowedTransition('DELIVERY_FAILED', 'RETURN_IN_TRANSIT')).toBe(true);
      expect(isAllowedTransition('DELIVERY_FAILED', 'CANCELLED')).toBe(true);
    });

    it('allows DELIVERED to transition to RETURN_REQUESTED and COMPLETED', () => {
      expect(isAllowedTransition('DELIVERED', 'RETURN_REQUESTED')).toBe(true);
      expect(isAllowedTransition('DELIVERED', 'COMPLETED')).toBe(true);
    });

    it('allows RETURN_REQUESTED to transition to RETURN_APPROVED, RETURN_PENDING, or CANCELLED', () => {
      expect(isAllowedTransition('RETURN_REQUESTED', 'RETURN_APPROVED')).toBe(true);
      expect(isAllowedTransition('RETURN_REQUESTED', 'CANCELLED')).toBe(true);
    });

    it('blocks illegal direct jumps like CREATED -> DELIVERED or PICKING -> RETURNED', () => {
      expect(isAllowedTransition('CREATED', 'DELIVERED')).toBe(false);
      expect(isAllowedTransition('PICKING', 'RETURNED')).toBe(false);
      expect(isAllowedTransition('DELIVERED', 'PICKING')).toBe(false);
    });

    it('assertOrderTransition throws explicit error on invalid status jump', () => {
      expect(() => {
        assertOrderTransition('CREATED', 'RETURNED', 'order-101');
      }).toThrow(/Illegal order transition/);
    });
  });

  describe('2. Customer Complaints SLA & Time Window Policies', () => {
    it('calculates complaint window policy to 48 hours for FMCG & Grocery', () => {
      expect(DEFAULT_COMPLAINT_WINDOW_HOURS).toBe(48);
    });

    it('returns OPEN SLA status for recent complaints (< 2 hours)', () => {
      const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 mins ago
      const sla = calculateComplaintSlaStatus(recentTime, 'OPEN');
      expect(sla.isBreached).toBe(false);
      expect(sla.hoursRemaining).toBeGreaterThan(0);
    });

    it('detects SLA breach for tickets exceeding 4-hour review threshold without resolution', () => {
      const oldTime = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(); // 5 hours ago
      const sla = calculateComplaintSlaStatus(oldTime, 'OPEN');
      expect(sla.isBreached).toBe(true);
      expect(sla.hoursRemaining).toBe(0);
    });

    it('marks resolved/closed tickets as not breached regardless of age', () => {
      const ancientTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const sla = calculateComplaintSlaStatus(ancientTime, 'RESOLVED');
      expect(sla.isBreached).toBe(false);
    });
  });

  describe('3. Grocery & DarkStore Inventory Safety Rules', () => {
    it('strictly isolates damaged or expired returned grocery products from restockable inventory', () => {
      const restockableItem = isGroceryItemRestockable('RESTOCKABLE', '2027-12-31');
      expect(restockableItem).toBe(true);

      const damagedItem = isGroceryItemRestockable('DAMAGED', '2027-12-31');
      expect(damagedItem).toBe(false);

      const expiredItem = isGroceryItemRestockable('EXPIRED', '2027-12-31');
      expect(expiredItem).toBe(false);

      const disposedItem = isGroceryItemRestockable('DISPOSED', '2027-12-31');
      expect(disposedItem).toBe(false);
    });

    it('prevents restock even if marked RESTOCKABLE when expiryDate is in the past', () => {
      const pastDate = '2020-01-01';
      const result = isGroceryItemRestockable('RESTOCKABLE', pastDate);
      expect(result).toBe(false);
    });

    it('correctly maps disposition category to stock update actions', () => {
      expect(categorizeReturnDisposition('RESTOCKABLE')).toBe('RESTOCK');
      expect(categorizeReturnDisposition('DAMAGED')).toBe('WRITE_OFF_DAMAGED');
      expect(categorizeReturnDisposition('EXPIRED')).toBe('WRITE_OFF_EXPIRED');
      expect(categorizeReturnDisposition('DISPOSED')).toBe('DISPOSE');
    });
  });
});
