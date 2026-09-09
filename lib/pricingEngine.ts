/**
 * PocketKirana — Authoritative Dynamic Pricing & Promotions Engine (v1.1.0)
 *
 * Core Principle: "Never trust the frontend price."
 * Evaluates base prices, active promotions, tiered cart coupons, and customer segmentation
 * to calculate the single authoritative price breakdown for cart, checkout, and invoicing.
 */

export type PromotionType = 'PERCENTAGE' | 'FLAT' | 'BUY_X_GET_Y' | 'TIERED_CART' | 'CATEGORY_DISCOUNT';
export type CustomerSegment = 'ALL' | 'NEW_CUSTOMER' | 'RETURNING' | 'VIP';

export interface PromotionRule {
  id: string;
  name: string;
  type: PromotionType;
  value: number; // e.g. 15 for 15% or 50 for ₹50
  appliesTo: 'ENTIRE_STORE' | 'CATEGORY' | 'PRODUCT' | 'COLLECTION';
  targetId?: string; // categoryId or productId
  minCartValue?: number;
  maxDiscountAmount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  customerSegment?: CustomerSegment;
}

export interface CouponRule {
  id: string;
  code: string;
  type: 'FLAT' | 'PERCENTAGE' | 'TIERED';
  value: number;
  minCartValue: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  customerSegment?: CustomerSegment;
  // Tiered thresholds: e.g. [{ minCart: 299, discount: 20 }, { minCart: 499, discount: 50 }, { minCart: 799, discount: 100 }]
  tiers?: Array<{ minCart: number; discount: number }>;
}

export interface CartInputItem {
  productId: string;
  quantity: number;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  mrp: number;
  sellingPrice: number;
  categoryId?: string;
  stock?: number;
}

export interface AuthoritativePriceBreakdown {
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    basePrice: number;
    mrp: number;
    itemSubtotal: number;
    discountAmount: number;
    finalLineTotal: number;
    appliedPromo?: string;
  }>;
  subtotal: number;
  productDiscountTotal: number;
  appliedCoupon?: {
    code: string;
    discountAmount: number;
    description: string;
  };
  couponDiscountTotal: number;
  deliveryCharge: number;
  taxAmount: number;
  grandTotal: number;
  nextTierPrompt?: {
    amountNeeded: number;
    rewardDescription: string;
  };
}

// Built-in Tiered Coupons Configuration
export const DEFAULT_TIERED_COUPONS: CouponRule[] = [
  {
    id: 'tier_save',
    code: 'POCKETSAVER',
    type: 'TIERED',
    value: 0,
    minCartValue: 299,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    tiers: [
      { minCart: 299, discount: 20 },
      { minCart: 499, discount: 50 },
      { minCart: 799, discount: 100 },
      { minCart: 1199, discount: 180 },
    ],
  },
  {
    id: 'welcome100',
    code: 'WELCOME100',
    type: 'FLAT',
    value: 100,
    minCartValue: 399,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    customerSegment: 'NEW_CUSTOMER',
  },
];

/**
 * Calculates authoritative cart and checkout pricing server-side.
 */
export function calculateAuthoritativeCartPrice(
  cartItems: CartInputItem[],
  catalog: Record<string, ProductCatalogItem>,
  couponCode?: string,
  customerSegment: CustomerSegment = 'ALL',
  activePromotions: PromotionRule[] = []
): AuthoritativePriceBreakdown {
  const now = new Date().toISOString();
  let subtotal = 0;
  let productDiscountTotal = 0;

  // 1. Calculate each item's base price and direct product promotion
  const items = cartItems.map((cartItem) => {
    const product = catalog[cartItem.productId] || {
      id: cartItem.productId,
      name: 'Product',
      mrp: 50,
      sellingPrice: 50,
      stock: 99,
    };

    const basePrice = Math.max(0, product.sellingPrice);
    const mrp = Math.max(basePrice, product.mrp || basePrice);
    const qty = Math.max(1, cartItem.quantity);
    const rawLineTotal = basePrice * qty;

    // Check applicable product promotions
    let itemDiscount = 0;
    let appliedPromo: string | undefined;

    for (const promo of activePromotions) {
      if (!promo.isActive) continue;
      if (promo.startDate > now || promo.endDate < now) continue;
      if (promo.customerSegment && promo.customerSegment !== 'ALL' && promo.customerSegment !== customerSegment) continue;

      let matches = false;
      if (promo.appliesTo === 'ENTIRE_STORE') matches = true;
      else if (promo.appliesTo === 'PRODUCT' && promo.targetId === product.id) matches = true;
      else if (promo.appliesTo === 'CATEGORY' && promo.targetId === product.categoryId) matches = true;

      if (matches) {
        if (promo.type === 'PERCENTAGE') {
          const disc = (rawLineTotal * promo.value) / 100;
          const capped = promo.maxDiscountAmount ? Math.min(disc, promo.maxDiscountAmount) : disc;
          if (capped > itemDiscount) {
            itemDiscount = capped;
            appliedPromo = promo.name;
          }
        } else if (promo.type === 'FLAT') {
          const disc = Math.min(rawLineTotal, promo.value * qty);
          if (disc > itemDiscount) {
            itemDiscount = disc;
            appliedPromo = promo.name;
          }
        }
      }
    }

    const finalLineTotal = Math.max(0, rawLineTotal - itemDiscount);
    subtotal += rawLineTotal;
    productDiscountTotal += itemDiscount;

    return {
      productId: product.id,
      name: product.name,
      quantity: qty,
      basePrice,
      mrp,
      itemSubtotal: rawLineTotal,
      discountAmount: itemDiscount,
      finalLineTotal,
      appliedPromo,
    };
  });

  const cartValueAfterProductDiscount = Math.max(0, subtotal - productDiscountTotal);

  // 2. Evaluate Coupon and Tiered Discounts
  let couponDiscountTotal = 0;
  let appliedCouponData: AuthoritativePriceBreakdown['appliedCoupon'];
  let nextTierPrompt: AuthoritativePriceBreakdown['nextTierPrompt'];

  if (couponCode) {
    const cleanCode = couponCode.trim().toUpperCase();
    const coupon = DEFAULT_TIERED_COUPONS.find((c) => c.code === cleanCode && c.isActive);

    if (coupon) {
      // Validate dates
      const isDateValid = coupon.startDate <= now && coupon.endDate >= now;
      // Validate customer segment
      const isSegmentValid = !coupon.customerSegment || coupon.customerSegment === 'ALL' || coupon.customerSegment === customerSegment;

      if (isDateValid && isSegmentValid) {
        if (coupon.type === 'TIERED' && coupon.tiers && coupon.tiers.length > 0) {
          // Sort tiers ascending
          const sortedTiers = [...coupon.tiers].sort((a, b) => a.minCart - b.minCart);
          let matchedTier: { minCart: number; discount: number } | null = null;
          let nextTier: { minCart: number; discount: number } | null = null;

          for (let i = 0; i < sortedTiers.length; i++) {
            if (cartValueAfterProductDiscount >= sortedTiers[i].minCart) {
              matchedTier = sortedTiers[i];
            } else if (!nextTier) {
              nextTier = sortedTiers[i];
            }
          }

          if (matchedTier) {
            couponDiscountTotal = matchedTier.discount;
            appliedCouponData = {
              code: coupon.code,
              discountAmount: matchedTier.discount,
              description: `Tier unlocked: ₹${matchedTier.discount} OFF on cart > ₹${matchedTier.minCart}`,
            };
          }

          if (nextTier) {
            const amountNeeded = nextTier.minCart - cartValueAfterProductDiscount;
            nextTierPrompt = {
              amountNeeded,
              rewardDescription: `Add ₹${amountNeeded} more to unlock ₹${nextTier.discount} OFF with ${coupon.code}!`,
            };
          }
        } else if (cartValueAfterProductDiscount >= coupon.minCartValue) {
          if (coupon.type === 'FLAT') {
            couponDiscountTotal = Math.min(coupon.value, cartValueAfterProductDiscount);
          } else if (coupon.type === 'PERCENTAGE') {
            const percDisc = (cartValueAfterProductDiscount * coupon.value) / 100;
            couponDiscountTotal = coupon.maxDiscount ? Math.min(percDisc, coupon.maxDiscount) : percDisc;
          }
          appliedCouponData = {
            code: coupon.code,
            discountAmount: couponDiscountTotal,
            description: `Promo Code ${coupon.code} Applied`,
          };
        }
      }
    }
  }

  // 3. Delivery Charge Rules (Free delivery over ₹499)
  const taxableAmount = Math.max(0, cartValueAfterProductDiscount - couponDiscountTotal);
  const deliveryCharge = taxableAmount >= 499 || cartItems.length === 0 ? 0 : 29;
  const taxAmount = Math.round(taxableAmount * 0.05); // 5% GST
  const grandTotal = Math.max(0, taxableAmount + deliveryCharge + taxAmount);

  return {
    items,
    subtotal,
    productDiscountTotal,
    appliedCoupon: appliedCouponData,
    couponDiscountTotal,
    deliveryCharge,
    taxAmount,
    grandTotal,
    nextTierPrompt,
  };
}
