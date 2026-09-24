import { describe, it, expect } from 'vitest';
import {
  evaluatePromotionsEngine,
  PromotionOffer,
  CouponRule,
  LoyaltyMilestoneRule,
  ProductCatalogItem,
} from '@/lib/promotionsEngine';

describe('PocketKirana Promotions, Offers, Coupons & Loyalty Engine — Comprehensive Acceptance Matrix', () => {
  
  const mockCatalog: Record<string, ProductCatalogItem> = {
    'p-coke-750': {
      id: 'p-coke-750',
      name: 'Coca-Cola 750ml',
      mrp: 45,
      sellingPrice: 40,
      categoryId: 'cat-beverages',
      stock: 50,
    },
    'p-maggi-2': {
      id: 'p-maggi-2',
      name: 'Maggi 2-Minute Noodles',
      mrp: 14,
      sellingPrice: 12,
      categoryId: 'cat-instant',
      stock: 100,
    },
    'p-milk-1': {
      id: 'p-milk-1',
      name: 'Amul Taaza Milk 500ml',
      mrp: 34,
      sellingPrice: 32,
      categoryId: 'cat-dairy',
      stock: 30,
    },
    'p-biscuit-1': {
      id: 'p-biscuit-1',
      name: 'Parle Hide & Seek Fab Biscuits (120g)',
      mrp: 35,
      sellingPrice: 30,
      categoryId: 'cat-snacks',
      stock: 25,
    },
    'p-chips-1': {
      id: 'p-chips-1',
      name: 'Lay\'s India\'s Magic Masala (50g)',
      mrp: 20,
      sellingPrice: 18,
      categoryId: 'cat-snacks',
      stock: 80,
    },
    'p-atta-1': {
      id: 'p-atta-1',
      name: 'Aashirvaad Shudh Chakki Atta (5kg)',
      mrp: 320,
      sellingPrice: 280,
      categoryId: 'cat-staples',
      stock: 15,
    },
  };

  // ── 1. PERCENTAGE & FIXED DISCOUNT OFFERS ──────────────────────────────────────
  describe('1. Percentage & Fixed Cart Discounts', () => {
    it('applies percentage discount capped at maxDiscount when min cart threshold is met', () => {
      const percentageOffer: PromotionOffer = {
        id: 'off-perc-10',
        name: '10% OFF Above ₹500',
        customerTitle: '10% OFF on ₹500+',
        offerType: 'PERCENTAGE',
        status: 'ACTIVE',
        priority: 1,
        stackingRule: 'ALLOW',
        discountValue: 10,
        minCartValue: 500,
        maxDiscount: 100,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2027-12-31T23:59:59.000Z',
      };

      // Cart = 2x Atta = ₹560 (qualifies >= ₹500). 10% of 560 = ₹56.
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }],
        catalog: mockCatalog,
        activeOffers: [percentageOffer],
      });

      expect(result.subtotal).toBe(560);
      expect(result.offerDiscountTotal).toBe(56);
      expect(result.grandTotal).toBeLessThan(560);
    });

    it('applies flat fixed discount when min cart value is reached', () => {
      const fixedOffer: PromotionOffer = {
        id: 'off-flat-100',
        name: '₹100 OFF on ₹999+',
        customerTitle: '₹100 Instant Discount',
        offerType: 'FIXED',
        status: 'ACTIVE',
        priority: 1,
        stackingRule: 'ALLOW',
        discountValue: 100,
        minCartValue: 999,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2027-12-31T23:59:59.000Z',
      };

      // Cart = 4x Atta = ₹1120 (qualifies >= ₹999)
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 4 }],
        catalog: mockCatalog,
        activeOffers: [fixedOffer],
      });

      expect(result.subtotal).toBe(1120);
      expect(result.offerDiscountTotal).toBe(100);
    });
  });

  // ── 2. BOGO & BUY X GET Y OFFERS ─────────────────────────────────────────────
  describe('2. Buy One Get One (BOGO) & Buy X Get Y Bundles', () => {
    it('applies Buy 1 Get 1 Free on same product with repetitions', () => {
      const bogoOffer: PromotionOffer = {
        id: 'off-bogo-coke',
        name: 'Buy 1 Get 1 Free Coke 750ml',
        customerTitle: 'Buy 1 Get 1 Free Coke',
        offerType: 'BOGO',
        status: 'ACTIVE',
        priority: 1,
        stackingRule: 'ALLOW',
        buyProductId: 'p-coke-750',
        buyQuantity: 1,
        rewardProductId: 'p-coke-750',
        rewardQuantity: 1,
        maxRepetitions: 2,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2027-12-31T23:59:59.000Z',
      };

      // Customer buys 2 Cokes -> gets 2 Free Cokes (capped at maxRepetitions 2)
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-coke-750', quantity: 2 }],
        catalog: mockCatalog,
        activeOffers: [bogoOffer],
      });

      expect(result.freeGifts.length).toBe(1);
      expect(result.freeGifts[0].productId).toBe('p-coke-750');
      expect(result.freeGifts[0].quantity).toBe(2);
      expect(result.freeGifts[0].isFreeGift).toBe(true);
    });

    it('applies Buy X Get Y on different cross-products (Buy 2 Maggi Get 1 Free Milk)', () => {
      const crossOffer: PromotionOffer = {
        id: 'off-maggi-milk',
        name: 'Buy 2 Maggi Get 1 Free Milk',
        customerTitle: 'Buy 2 Maggi Get 1 Free Milk',
        offerType: 'BUY_X_GET_Y',
        status: 'ACTIVE',
        priority: 1,
        stackingRule: 'ALLOW',
        buyProductId: 'p-maggi-2',
        buyQuantity: 2,
        rewardProductId: 'p-milk-1',
        rewardQuantity: 1,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2027-12-31T23:59:59.000Z',
      };

      // Customer buys 4 Maggi (2 sets) -> gets 2 Free Milk
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-maggi-2', quantity: 4 }],
        catalog: mockCatalog,
        activeOffers: [crossOffer],
      });

      expect(result.freeGifts.length).toBe(1);
      expect(result.freeGifts[0].productId).toBe('p-milk-1');
      expect(result.freeGifts[0].quantity).toBe(2);
    });
  });

  // ── 3. FREE PRODUCT ABOVE ORDER VALUE & REAL-TIME MOTIVATOR ──────────────────
  describe('3. Free Product Above Order Value & Dynamic Progress Motivator', () => {
    const freeGiftOffer: PromotionOffer = {
      id: 'off-free-biscuit-500',
      name: 'Free Biscuit Above ₹500',
      customerTitle: 'Free Biscuit Pack on ₹500+',
      offerType: 'FREE_PRODUCT_ABOVE_X',
      status: 'ACTIVE',
      priority: 1,
      stackingRule: 'ALLOW',
      minCartValue: 500,
      rewardProductId: 'p-biscuit-1',
      rewardProductName: 'Parle Hide & Seek Fab Biscuits (120g)',
      rewardQuantity: 1,
      fallbackAction: 'REMOVE_REWARD',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-12-31T23:59:59.000Z',
    };

    it('automatically unlocks free gift when cart reaches or exceeds ₹500', () => {
      // Cart = 2x Atta = ₹560 (>= ₹500)
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }],
        catalog: mockCatalog,
        activeOffers: [freeGiftOffer],
      });

      expect(result.freeGifts.length).toBe(1);
      expect(result.freeGifts[0].productId).toBe('p-biscuit-1');
      expect(result.freeGifts[0].isFreeGift).toBe(true);
      expect(result.appliedPromotions.some((p) => p.badgeText === 'FREE GIFT UNLOCKED')).toBe(true);
    });

    it('shows real-time motivator ("Add ₹20 more to unlock free gift") when below threshold', () => {
      // Cart = 1x Atta (₹280) + 5x Coke (₹200) = ₹480 (Needs ₹20 to reach ₹500)
      const result = evaluatePromotionsEngine({
        cartItems: [
          { productId: 'p-atta-1', quantity: 1 },
          { productId: 'p-coke-750', quantity: 5 },
        ],
        catalog: mockCatalog,
        activeOffers: [freeGiftOffer],
      });

      expect(result.freeGifts.length).toBe(0);
      expect(result.nextMotivatorPrompt).toBeDefined();
      expect(result.nextMotivatorPrompt?.amountNeeded).toBe(20);
      expect(result.nextMotivatorPrompt?.rewardDescription).toContain('Add ₹20 more to unlock your FREE GIFT 🎁');
    });

    it('gracefully handles out-of-stock free item and does not allow negative inventory', () => {
      const outOfStockCatalog = {
        ...mockCatalog,
        'p-biscuit-1': { ...mockCatalog['p-biscuit-1'], stock: 0 },
      };

      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }],
        catalog: outOfStockCatalog,
        activeOffers: [freeGiftOffer],
      });

      // Stock is 0 -> Free gift not injected to prevent stock distortion
      expect(result.freeGifts.length).toBe(0);
      expect(result.validationMessages.some((m) => m.includes('out of stock'))).toBe(true);
    });
  });

  // ── 4. TIERED ORDER VALUE OFFERS ─────────────────────────────────────────────
  describe('4. Tiered Order Value Offers', () => {
    const tieredOffer: PromotionOffer = {
      id: 'off-tiered',
      name: 'Tiered Grocery Savings',
      customerTitle: 'Up to ₹200 OFF',
      offerType: 'TIERED_CART',
      status: 'ACTIVE',
      priority: 1,
      stackingRule: 'ALLOW',
      tiers: [
        { minCart: 500, discount: 50 },
        { minCart: 999, discount: 100 },
        { minCart: 1499, discount: 200 },
      ],
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-12-31T23:59:59.000Z',
    };

    it('unlocks ₹50 for cart >= ₹500, ₹100 for >= ₹999, and ₹200 for >= ₹1499', () => {
      // Test Tier 1 (₹560)
      const res1 = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }], // ₹560
        catalog: mockCatalog,
        activeOffers: [tieredOffer],
      });
      expect(res1.offerDiscountTotal).toBe(50);

      // Test Tier 2 (₹1120)
      const res2 = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 4 }], // ₹1120
        catalog: mockCatalog,
        activeOffers: [tieredOffer],
      });
      expect(res2.offerDiscountTotal).toBe(100);

      // Test Tier 3 (₹1680)
      const res3 = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 6 }], // ₹1680
        catalog: mockCatalog,
        activeOffers: [tieredOffer],
      });
      expect(res3.offerDiscountTotal).toBe(200);
    });
  });

  // ── 5. LOYALTY & ORDER MILESTONE REWARDS ──────────────────────────────────────
  describe('5. Customer Loyalty & Order Milestone Rewards', () => {
    const loyaltyRule10: LoyaltyMilestoneRule = {
      id: 'loyalty-10th',
      name: '10th Order Milestone: 10% OFF',
      description: '10% OFF on your 11th order',
      requiredCompletedOrders: 10,
      rewardType: 'PERCENTAGE',
      rewardValue: 10,
      maxDiscount: 200,
      minOrderValue: 499,
      validityDays: 30,
      isActive: true,
    };

    it('unlocks 10% OFF for customer with 10 completed orders', () => {
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }], // ₹560
        catalog: mockCatalog,
        loyaltyRules: [loyaltyRule10],
        customer: { completedOrdersCount: 10 },
      });

      expect(result.loyaltyDiscountTotal).toBe(56);
      expect(result.unlockedLoyaltyReward).toBeDefined();
      expect(result.unlockedLoyaltyReward?.ruleId).toBe('loyalty-10th');
    });

    it('does not unlock loyalty reward if customer has fewer completed orders (e.g. 9)', () => {
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }],
        catalog: mockCatalog,
        loyaltyRules: [loyaltyRule10],
        customer: { completedOrdersCount: 9 },
      });

      expect(result.loyaltyDiscountTotal).toBe(0);
      expect(result.unlockedLoyaltyReward).toBeUndefined();
    });
  });

  // ── 6. COUPON SYSTEM & USAGE RESTRICTIONS ────────────────────────────────────
  describe('6. Coupon System & Redemptions', () => {
    const testCoupon: CouponRule = {
      id: 'c-welcome100',
      code: 'WELCOME100',
      type: 'FIXED',
      value: 100,
      minimumOrder: 499,
      maxDiscount: 100,
      usageLimit: 1000,
      perCustomerLimit: 1,
      isFirstOrderOnly: true,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-12-31T23:59:59.000Z',
      isActive: true,
    };

    it('applies coupon WELCOME100 on first order', () => {
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }], // ₹560
        catalog: mockCatalog,
        couponCode: 'welcome100', // Test case-normalization
        coupons: [testCoupon],
        customer: { isFirstOrder: true, completedOrdersCount: 0 },
      });

      expect(result.couponDiscountTotal).toBe(100);
      expect(result.appliedCoupon?.code).toBe('WELCOME100');
    });

    it('rejects first-order coupon for returning customer who already placed orders', () => {
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }],
        catalog: mockCatalog,
        couponCode: 'WELCOME100',
        coupons: [testCoupon],
        customer: { isFirstOrder: false, completedOrdersCount: 3 },
      });

      expect(result.couponDiscountTotal).toBe(0);
      expect(result.validationMessages.some((m) => m.includes('first order'))).toBe(true);
    });

    it('rejects coupon if per-customer redemption limit reached', () => {
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }],
        catalog: mockCatalog,
        couponCode: 'WELCOME100',
        coupons: [testCoupon],
        customer: {
          isFirstOrder: true,
          previousCouponUses: { WELCOME100: 1 }, // Already used 1 time
        },
      });

      expect(result.couponDiscountTotal).toBe(0);
      expect(result.validationMessages.some((m) => m.includes('maximum allowed times'))).toBe(true);
    });
  });

  // ── 7. OFFER STACKING RULES ──────────────────────────────────────────────────
  describe('7. Offer Stacking & Collision Resolution', () => {
    const allowOffer: PromotionOffer = {
      id: 'off-allow',
      name: 'Stackable ₹50 OFF',
      customerTitle: '₹50 OFF',
      offerType: 'FIXED',
      status: 'ACTIVE',
      priority: 1,
      stackingRule: 'ALLOW',
      discountValue: 50,
      minCartValue: 400,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-12-31T23:59:59.000Z',
    };

    const denyOffer: PromotionOffer = {
      id: 'off-deny',
      name: 'Exclusive ₹150 OFF',
      customerTitle: 'Exclusive ₹150 OFF',
      offerType: 'FIXED',
      status: 'ACTIVE',
      priority: 1,
      stackingRule: 'DENY',
      discountValue: 150,
      minCartValue: 400,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-12-31T23:59:59.000Z',
    };

    const regularCoupon: CouponRule = {
      id: 'c-save50',
      code: 'SAVE50',
      type: 'FIXED',
      value: 50,
      minimumOrder: 400,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-12-31T23:59:59.000Z',
      isActive: true,
    };

    it('allows combining stackable offer with coupon (ALLOW)', () => {
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }], // ₹560
        catalog: mockCatalog,
        activeOffers: [allowOffer],
        couponCode: 'SAVE50',
        coupons: [regularCoupon],
      });

      // ₹50 (offer) + ₹50 (coupon) = ₹100 total discount
      expect(result.offerDiscountTotal).toBe(50);
      expect(result.couponDiscountTotal).toBe(50);
      expect(result.totalDiscount).toBe(100);
    });

    it('enforces exclusive single discount when stacking is DENY', () => {
      const result = evaluatePromotionsEngine({
        cartItems: [{ productId: 'p-atta-1', quantity: 2 }], // ₹560
        catalog: mockCatalog,
        activeOffers: [denyOffer], // ₹150
        couponCode: 'SAVE50',     // ₹50
        coupons: [regularCoupon],
      });

      // Exclusive offer selects the single highest discount (₹150 offer > ₹50 coupon)
      expect(result.offerDiscountTotal).toBe(150);
      expect(result.couponDiscountTotal).toBe(0);
      expect(result.totalDiscount).toBe(150);
    });
  });

});
