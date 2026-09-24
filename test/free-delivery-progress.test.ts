import { describe, it, expect } from 'vitest';
import { 
  FREE_DELIVERY_THRESHOLD, 
  calculateDeliveryFee, 
  calculateFreeDeliveryProgress 
} from '../lib/freeDelivery';

describe('Free Delivery Threshold & Progress Bar Specification', () => {
  it('has authoritative threshold of ₹500', () => {
    expect(FREE_DELIVERY_THRESHOLD).toBe(500);
  });

  // TEST 1: Empty cart
  it('TEST 1: Empty cart (₹0) shows ₹500 threshold with 0 progress', () => {
    const res = calculateFreeDeliveryProgress(0);
    expect(res.subtotal).toBe(0);
    expect(res.remainingAmount).toBe(500);
    expect(res.progress).toBe(0);
    expect(res.isUnlocked).toBe(false);
    expect(res.deliveryFee).toBe(0);
    expect(res.title).toBe('Get FREE delivery');
    expect(res.subtitle).toBe('on your order above ₹500');
  });

  // TEST 2: Cart ₹100
  it('TEST 2: Cart ₹100 shows Add products worth ₹400 more', () => {
    const res = calculateFreeDeliveryProgress(100);
    expect(res.subtotal).toBe(100);
    expect(res.remainingAmount).toBe(400);
    expect(res.progress).toBe(0.2);
    expect(res.isUnlocked).toBe(false);
    expect(res.deliveryFee).toBe(29);
    expect(res.title).toBe('Get FREE delivery');
    expect(res.subtitle).toBe('Add products worth ₹400 more');
  });

  // TEST 3: Cart ₹350
  it('TEST 3: Cart ₹350 shows Add products worth ₹150 more', () => {
    const res = calculateFreeDeliveryProgress(350);
    expect(res.subtotal).toBe(350);
    expect(res.remainingAmount).toBe(150);
    expect(res.progress).toBe(0.7);
    expect(res.isUnlocked).toBe(false);
    expect(res.deliveryFee).toBe(29);
    expect(res.subtitle).toBe('Add products worth ₹150 more');
  });

  // TEST 4: Cart ₹480
  it('TEST 4: Cart ₹480 shows Add products worth ₹20 more', () => {
    const res = calculateFreeDeliveryProgress(480);
    expect(res.subtotal).toBe(480);
    expect(res.remainingAmount).toBe(20);
    expect(res.progress).toBe(0.96);
    expect(res.isUnlocked).toBe(false);
    expect(res.deliveryFee).toBe(29);
    expect(res.subtitle).toBe('Add products worth ₹20 more');
  });

  // TEST 5: Cart ₹499
  it('TEST 5: Cart ₹499 shows Add products worth ₹1 more', () => {
    const res = calculateFreeDeliveryProgress(499);
    expect(res.subtotal).toBe(499);
    expect(res.remainingAmount).toBe(1);
    expect(res.progress).toBe(499 / 500);
    expect(res.isUnlocked).toBe(false);
    expect(res.deliveryFee).toBe(29);
    expect(res.subtitle).toBe('Add products worth ₹1 more');
  });

  // TEST 6: Cart ₹500 -> FREE DELIVERY UNLOCKED
  it('TEST 6: Cart ₹500 unlocks free delivery with ₹0 delivery fee', () => {
    const res = calculateFreeDeliveryProgress(500);
    expect(res.subtotal).toBe(500);
    expect(res.remainingAmount).toBe(0);
    expect(res.progress).toBe(1);
    expect(res.isUnlocked).toBe(true);
    expect(res.deliveryFee).toBe(0);
    expect(res.title).toBe('FREE delivery unlocked!');
    expect(res.subtitle).toBe('Your order qualifies for free delivery');
  });

  // TEST 7: Cart ₹501
  it('TEST 7: Cart ₹501 maintains free delivery unlocked', () => {
    const res = calculateFreeDeliveryProgress(501);
    expect(res.subtotal).toBe(501);
    expect(res.remainingAmount).toBe(0);
    expect(res.progress).toBe(1);
    expect(res.isUnlocked).toBe(true);
    expect(res.deliveryFee).toBe(0);
  });

  // TEST 8: Cart ₹750
  it('TEST 8: Cart ₹750 has 100% progress and free delivery', () => {
    const res = calculateFreeDeliveryProgress(750);
    expect(res.subtotal).toBe(750);
    expect(res.remainingAmount).toBe(0);
    expect(res.progress).toBe(1);
    expect(res.isUnlocked).toBe(true);
    expect(res.deliveryFee).toBe(0);
  });

  // TEST: calculateDeliveryFee helper
  it('correctly calculates delivery fees at critical boundaries', () => {
    expect(calculateDeliveryFee(0)).toBe(0);
    expect(calculateDeliveryFee(499)).toBe(29);
    expect(calculateDeliveryFee(500)).toBe(0);
    expect(calculateDeliveryFee(1000)).toBe(0);
  });
});
