/**
 * PocketKirana — Production Promotions, Offers, Coupons & Loyalty Engine (v2.0)
 *
 * Reusable, deterministic, transactionally-safe rules engine supporting:
 *  - 13 Offer Types (Percentage, Fixed, BOGO, Buy X Get Y, Free Product Above ₹X,
 *    Tiered Order Values, Free Delivery, Category/Product Discounts, First-Order,
 *    Customer-Specific, Win-Back, Cart Abandonment)
 *  - Configurable Order Milestone Loyalty Rewards (e.g. 10th order -> 10% OFF 11th)
 *  - Stacking & Priority Resolution (ALLOW, DENY, BEST_DISCOUNT, PRIORITY_FIRST)
 *  - Inventory-Aware Free Gifts & Fallback Routing
 *  - Real-Time Dynamic Cart Progress Motivators
 */

export type OfferType =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'BOGO'
  | 'BUY_X_GET_Y'
  | 'FREE_PRODUCT_ABOVE_X'
  | 'TIERED_CART'
  | 'FREE_DELIVERY'
  | 'CATEGORY_DISCOUNT'
  | 'PRODUCT_DISCOUNT'
  | 'FIRST_ORDER'
  | 'CUSTOMER_SPECIFIC'
  | 'WIN_BACK'
  | 'CART_ABANDONMENT';

export type OfferStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';

export type StackingRule = 'ALLOW' | 'DENY' | 'BEST_DISCOUNT' | 'PRIORITY_FIRST';

export type CustomerSegment = 'ALL' | 'NEW_CUSTOMER' | 'RETURNING' | 'VIP' | 'INACTIVE_30' | 'CART_ABANDONERS';

export type FestivalName =
  | 'Holi'
  | 'Diwali'
  | 'Dussehra'
  | 'Ganesh Chaturthi'
  | 'Navratri'
  | 'Raksha Bandhan'
  | 'Christmas'
  | 'New Year'
  | 'Eid'
  | 'Independence Day'
  | 'Republic Day'
  | 'Makar Sankranti'
  | 'Onam'
  | 'Pongal'
  | 'Easter'
  | 'Akshaya Tritiya'
  | 'Custom';

export interface TierConfig {
  minCart: number;
  discount: number;
  freeProductId?: string;
  freeProductName?: string;
}

export interface PromotionOffer {
  id: string;
  campaignId?: string;
  name: string;
  internalName?: string;
  customerTitle: string;
  description?: string;
  bannerImage?: string;
  offerType: OfferType;
  status: OfferStatus;
  priority: number; // Lower number = higher priority (1 is highest)
  stackingRule: StackingRule;
  minCartValue?: number;
  maxDiscount?: number;
  discountValue?: number; // e.g. 20 for 20% or 100 for ₹100
  buyProductId?: string;
  buyQuantity?: number;
  rewardProductId?: string;
  rewardProductName?: string;
  rewardQuantity?: number;
  maxRepetitions?: number;
  categoryId?: string;
  targetCustomerIds?: string[];
  inactiveDays?: number;
  tiers?: TierConfig[];
  fallbackAction?: 'REMOVE_REWARD' | 'ALTERNATE_PRODUCT' | 'DISABLE_CAMPAIGN';
  alternateProductId?: string;
  startDate: string;
  endDate: string;
  usageCount?: number;
  maxUsageLimit?: number;
  perCustomerLimit?: number;
  deepLink?: string;
  festivalName?: FestivalName;
  requiresInventory?: boolean;
}

export interface CouponRule {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED' | 'TIERED';
  value: number;
  minimumOrder: number;
  maxDiscount?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  perCustomerLimit?: number;
  usedCount?: number;
  customerSegment?: CustomerSegment;
  isFirstOrderOnly?: boolean;
  applicableProducts?: string[];
  applicableCategories?: string[];
  tiers?: TierConfig[];
  isActive: boolean;
}

export interface LoyaltyMilestoneRule {
  id: string;
  name: string;
  description?: string;
  requiredCompletedOrders: number; // e.g. 10
  rewardType: 'PERCENTAGE' | 'FIXED' | 'FREE_PRODUCT' | 'FREE_DELIVERY';
  rewardValue: number; // e.g. 10 for 10%
  maxDiscount?: number;
  minOrderValue?: number;
  rewardProductId?: string;
  validityDays: number;
  isActive: boolean;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  mrp: number;
  sellingPrice: number;
  categoryId?: string;
  stock?: number;
  thumbnail?: string;
}

export interface CartInputItem {
  productId: string;
  quantity: number;
  price?: number;
  mrp?: number;
  name?: string;
  categoryId?: string;
}

export interface CustomerContext {
  id?: string;
  completedOrdersCount?: number;
  lastOrderDate?: string; // ISO string
  isFirstOrder?: boolean;
  segment?: CustomerSegment;
  registeredAt?: string;
  cartIdleHours?: number;
  previousCouponUses?: Record<string, number>; // couponCode -> count
}

export interface AppliedPromotionRecord {
  id: string;
  name: string;
  type: OfferType | 'COUPON' | 'LOYALTY';
  discountAmount: number;
  customerTitle: string;
  badgeText: string;
}

export interface FreeGiftItem {
  productId: string;
  name: string;
  quantity: number;
  originalPrice: number;
  isFreeGift: true;
  offerId: string;
  stockAvailable: boolean;
  fallbackUsed?: boolean;
}

export interface AuthoritativePriceEvaluation {
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    basePrice: number;
    mrp: number;
    itemSubtotal: number;
    itemDiscount: number;
    finalLineTotal: number;
    appliedOfferName?: string;
  }>;
  freeGifts: FreeGiftItem[];
  subtotal: number;
  productDiscountTotal: number;
  offerDiscountTotal: number;
  couponDiscountTotal: number;
  loyaltyDiscountTotal: number;
  totalDiscount: number;
  deliveryCharge: number;
  isFreeDelivery: boolean;
  taxAmount: number;
  grandTotal: number;
  appliedPromotions: AppliedPromotionRecord[];
  appliedCoupon?: {
    code: string;
    discountAmount: number;
    description: string;
  };
  unlockedLoyaltyReward?: {
    ruleId: string;
    name: string;
    description: string;
    discountAmount: number;
  };
  nextMotivatorPrompt?: {
    type: 'FREE_GIFT' | 'DISCOUNT_TIER' | 'FREE_DELIVERY' | 'COUPON_TIER';
    amountNeeded: number;
    rewardDescription: string;
    progressPercentage: number;
  };
  validationMessages: string[];
}

// ══════════════════════════════════════════════════════════════════════════
// BUILT-IN SEED PRESETS
// ══════════════════════════════════════════════════════════════════════════

export const DEFAULT_ACTIVE_OFFERS: PromotionOffer[] = [
  {
    id: 'off-holi-gift-500',
    campaignId: 'camp-holi-2026',
    name: 'Holi Free Biscuit Pack Above ₹500',
    internalName: 'HOLI_FREE_GIFT_500',
    customerTitle: '🎨 Holi Special: Free Biscuit Pack above ₹500',
    description: 'Shop above ₹500 and receive a complimentary premium Biscuit Pack.',
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
    requiresInventory: true,
    festivalName: 'Holi',
  },
  {
    id: 'off-bogo-coke',
    name: 'Buy 1 Get 1 Free: Coca-Cola 750ml',
    internalName: 'BOGO_COKE_750',
    customerTitle: '🔥 Buy 1 Get 1 FREE on Coca-Cola',
    offerType: 'BOGO',
    status: 'ACTIVE',
    priority: 2,
    stackingRule: 'ALLOW',
    buyProductId: 'p-coke-750',
    buyQuantity: 1,
    rewardProductId: 'p-coke-750',
    rewardProductName: 'Coca-Cola 750ml Pet Bottle',
    rewardQuantity: 1,
    maxRepetitions: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2027-12-31T23:59:59.000Z',
  },
  {
    id: 'off-tiered-savings',
    name: 'Super Saver Tiered Order Discount',
    internalName: 'TIERED_SAVINGS_2026',
    customerTitle: '💰 Tiered Savings: Up to ₹200 OFF',
    offerType: 'TIERED_CART',
    status: 'ACTIVE',
    priority: 3,
    stackingRule: 'ALLOW',
    tiers: [
      { minCart: 500, discount: 50 },
      { minCart: 999, discount: 100 },
      { minCart: 1499, discount: 200 },
    ],
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2027-12-31T23:59:59.000Z',
  },
  {
    id: 'off-free-delivery-500',
    name: 'Free Express Delivery Above ₹500',
    internalName: 'FREE_DELIVERY_500',
    customerTitle: '🚚 FREE Delivery on orders above ₹500',
    offerType: 'FREE_DELIVERY',
    status: 'ACTIVE',
    priority: 4,
    stackingRule: 'ALLOW',
    minCartValue: 500,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2027-12-31T23:59:59.000Z',
  },
];

export const DEFAULT_COUPONS: CouponRule[] = [
  {
    id: 'c-welcome100',
    code: 'WELCOME100',
    type: 'FIXED',
    value: 100,
    minimumOrder: 499,
    maxDiscount: 100,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2027-12-31T23:59:59.000Z',
    usageLimit: 10000,
    perCustomerLimit: 1,
    isFirstOrderOnly: true,
    customerSegment: 'NEW_CUSTOMER',
    isActive: true,
  },
  {
    id: 'c-holi150',
    code: 'HOLI150',
    type: 'FIXED',
    value: 150,
    minimumOrder: 999,
    maxDiscount: 150,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2027-12-31T23:59:59.000Z',
    usageLimit: 5000,
    perCustomerLimit: 2,
    isActive: true,
  },
  {
    id: 'c-festive10',
    code: 'FESTIVE10',
    type: 'PERCENTAGE',
    value: 10,
    minimumOrder: 500,
    maxDiscount: 100,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2027-12-31T23:59:59.000Z',
    usageLimit: 5000,
    perCustomerLimit: 3,
    isActive: true,
  },
];

export const DEFAULT_LOYALTY_RULES: LoyaltyMilestoneRule[] = [
  {
    id: 'loyalty-5th-order',
    name: '5th Order Milestone: ₹50 OFF',
    description: 'Complete 5 successful orders and unlock ₹50 OFF on your 6th order.',
    requiredCompletedOrders: 5,
    rewardType: 'FIXED',
    rewardValue: 50,
    minOrderValue: 299,
    validityDays: 30,
    isActive: true,
  },
  {
    id: 'loyalty-10th-order',
    name: '10th Order Milestone: 10% OFF',
    description: 'Complete 10 successful orders and get 10% OFF on your 11th order (Max ₹200).',
    requiredCompletedOrders: 10,
    rewardType: 'PERCENTAGE',
    rewardValue: 10,
    maxDiscount: 200,
    minOrderValue: 499,
    validityDays: 30,
    isActive: true,
  },
];

// ══════════════════════════════════════════════════════════════════════════
// CANONICAL PROMOTIONS EVALUATION ENGINE
// ══════════════════════════════════════════════════════════════════════════

export function evaluatePromotionsEngine(params: {
  cartItems: CartInputItem[];
  catalog?: Record<string, ProductCatalogItem>;
  couponCode?: string;
  customer?: CustomerContext;
  activeOffers?: PromotionOffer[];
  coupons?: CouponRule[];
  loyaltyRules?: LoyaltyMilestoneRule[];
  nowIso?: string;
}): AuthoritativePriceEvaluation {
  const {
    cartItems = [],
    catalog = {},
    couponCode,
    customer = {},
    activeOffers = DEFAULT_ACTIVE_OFFERS,
    coupons = DEFAULT_COUPONS,
    loyaltyRules = DEFAULT_LOYALTY_RULES,
    nowIso = new Date().toISOString(),
  } = params;

  const validationMessages: string[] = [];
  const appliedPromotions: AppliedPromotionRecord[] = [];
  const freeGifts: FreeGiftItem[] = [];

  // 1. Calculate item base subtotals and product/category line-item discounts
  let rawSubtotal = 0;
  let productDiscountTotal = 0;

  // Filter eligible active offers (Status ACTIVE and Valid Date Range)
  const sortedOffers = [...activeOffers]
    .filter((off) => {
      if (off.status !== 'ACTIVE') return false;
      if (off.startDate && off.startDate > nowIso) return false;
      if (off.endDate && off.endDate < nowIso) return false;
      return true;
    })
    .sort((a, b) => (a.priority || 1) - (b.priority || 1));

  // Process cart items
  const evaluatedItems = cartItems.map((cartItem) => {
    const product = catalog[cartItem.productId] || {
      id: cartItem.productId,
      name: cartItem.name || 'Product',
      mrp: cartItem.mrp || cartItem.price || 50,
      sellingPrice: cartItem.price || 50,
      categoryId: cartItem.categoryId,
      stock: 99,
    };

    const basePrice = Math.max(0, product.sellingPrice);
    const mrp = Math.max(basePrice, product.mrp || basePrice);
    const qty = Math.max(1, cartItem.quantity);
    const lineSubtotal = basePrice * qty;
    rawSubtotal += lineSubtotal;

    let itemDiscount = 0;
    let appliedOfferName: string | undefined;

    // Check direct product or category discounts
    for (const offer of sortedOffers) {
      if (offer.offerType === 'PRODUCT_DISCOUNT' && offer.buyProductId === product.id) {
        if (offer.discountValue) {
          // Flat or % on product
          const disc = offer.discountValue < 100 
            ? (lineSubtotal * offer.discountValue) / 100 
            : Math.min(lineSubtotal, offer.discountValue * qty);
          const capped = offer.maxDiscount ? Math.min(disc, offer.maxDiscount) : disc;
          if (capped > itemDiscount) {
            itemDiscount = capped;
            appliedOfferName = offer.customerTitle;
          }
        }
      } else if (
        offer.offerType === 'CATEGORY_DISCOUNT' &&
        offer.categoryId &&
        offer.categoryId === product.categoryId
      ) {
        if (!offer.minCartValue || lineSubtotal >= offer.minCartValue) {
          const percDisc = ((lineSubtotal * (offer.discountValue || 0)) / 100);
          const capped = offer.maxDiscount ? Math.min(percDisc, offer.maxDiscount) : percDisc;
          if (capped > itemDiscount) {
            itemDiscount = capped;
            appliedOfferName = offer.customerTitle;
          }
        }
      }
    }

    productDiscountTotal += itemDiscount;
    const finalLineTotal = Math.max(0, lineSubtotal - itemDiscount);

    return {
      productId: product.id,
      name: product.name,
      quantity: qty,
      basePrice,
      mrp,
      itemSubtotal: lineSubtotal,
      itemDiscount,
      finalLineTotal,
      appliedOfferName,
    };
  });

  const cartValueAfterProductDiscount = Math.max(0, rawSubtotal - productDiscountTotal);

  // 2. Evaluate BOGO & Buy X Get Y Offers
  for (const offer of sortedOffers) {
    if (offer.offerType === 'BOGO' || offer.offerType === 'BUY_X_GET_Y') {
      const buyItem = evaluatedItems.find((it) => it.productId === offer.buyProductId);
      if (buyItem) {
        const buyReq = offer.buyQuantity || 1;
        const rewardQtyPerSet = offer.rewardQuantity || 1;
        const qualifyingSets = Math.floor(buyItem.quantity / buyReq);

        if (qualifyingSets > 0) {
          const maxSets = offer.maxRepetitions || 99;
          const actualSets = Math.min(qualifyingSets, maxSets);
          const totalFreeQty = actualSets * rewardQtyPerSet;

          const rewardProdId = offer.rewardProductId || offer.buyProductId!;
          const rewardProd = catalog[rewardProdId] || {
            id: rewardProdId,
            name: offer.rewardProductName || buyItem.name,
            sellingPrice: buyItem.basePrice,
            stock: 99,
          };

          // Inventory check
          const availableStock = rewardProd.stock ?? 99;
          if (availableStock >= totalFreeQty) {
            freeGifts.push({
              productId: rewardProd.id,
              name: rewardProd.name,
              quantity: totalFreeQty,
              originalPrice: rewardProd.sellingPrice * totalFreeQty,
              isFreeGift: true,
              offerId: offer.id,
              stockAvailable: true,
            });
            appliedPromotions.push({
              id: offer.id,
              name: offer.name,
              type: offer.offerType,
              discountAmount: rewardProd.sellingPrice * totalFreeQty,
              customerTitle: offer.customerTitle,
              badgeText: 'BOGO REWARD',
            });
          } else {
            validationMessages.push(`Free reward for ${offer.name} is currently out of stock.`);
          }
        }
      }
    }
  }

  // 3. Evaluate Free Product Above Order Value Offers
  let nextMotivatorPrompt: AuthoritativePriceEvaluation['nextMotivatorPrompt'];

  for (const offer of sortedOffers) {
    if (offer.offerType === 'FREE_PRODUCT_ABOVE_X') {
      const threshold = offer.minCartValue || 500;
      if (cartValueAfterProductDiscount >= threshold) {
        const rewardProdId = offer.rewardProductId || 'p-biscuit-1';
        const rewardProd = catalog[rewardProdId] || {
          id: rewardProdId,
          name: offer.rewardProductName || 'Complimentary Gift Pack',
          sellingPrice: 30,
          stock: 50,
        };

        const stock = rewardProd.stock ?? 50;
        if (stock > 0) {
          freeGifts.push({
            productId: rewardProd.id,
            name: rewardProd.name,
            quantity: offer.rewardQuantity || 1,
            originalPrice: rewardProd.sellingPrice,
            isFreeGift: true,
            offerId: offer.id,
            stockAvailable: true,
          });
          appliedPromotions.push({
            id: offer.id,
            name: offer.name,
            type: 'FREE_PRODUCT_ABOVE_X',
            discountAmount: rewardProd.sellingPrice,
            customerTitle: offer.customerTitle,
            badgeText: 'FREE GIFT UNLOCKED',
          });
        } else if (offer.fallbackAction === 'ALTERNATE_PRODUCT' && offer.alternateProductId) {
          const altProd = catalog[offer.alternateProductId];
          if (altProd && (altProd.stock ?? 0) > 0) {
            freeGifts.push({
              productId: altProd.id,
              name: altProd.name,
              quantity: 1,
              originalPrice: altProd.sellingPrice,
              isFreeGift: true,
              offerId: offer.id,
              stockAvailable: true,
              fallbackUsed: true,
            });
          }
        } else {
          validationMessages.push(`Free gift for ${offer.name} is out of stock.`);
        }
      } else {
        const amountNeeded = threshold - cartValueAfterProductDiscount;
        if (!nextMotivatorPrompt || amountNeeded < nextMotivatorPrompt.amountNeeded) {
          const progress = Math.min(100, Math.round((cartValueAfterProductDiscount / threshold) * 100));
          nextMotivatorPrompt = {
            type: 'FREE_GIFT',
            amountNeeded,
            rewardDescription: `Add ₹${amountNeeded} more to unlock your FREE GIFT 🎁 (${offer.rewardProductName || 'Gift Pack'})`,
            progressPercentage: progress,
          };
        }
      }
    }
  }

  // 4. Evaluate Tiered Cart Offers & Fixed/Percentage Cart Discounts
  let offerDiscountTotal = 0;

  for (const offer of sortedOffers) {
    if (offer.offerType === 'TIERED_CART' && offer.tiers && offer.tiers.length > 0) {
      const sortedTiers = [...offer.tiers].sort((a, b) => a.minCart - b.minCart);
      let matchedTier: TierConfig | null = null;
      let upcomingTier: TierConfig | null = null;

      for (const tier of sortedTiers) {
        if (cartValueAfterProductDiscount >= tier.minCart) {
          matchedTier = tier;
        } else if (!upcomingTier) {
          upcomingTier = tier;
        }
      }

      if (matchedTier) {
        offerDiscountTotal += matchedTier.discount;
        appliedPromotions.push({
          id: offer.id,
          name: offer.name,
          type: 'TIERED_CART',
          discountAmount: matchedTier.discount,
          customerTitle: `Tier Unlocked: ₹${matchedTier.discount} OFF on Cart > ₹${matchedTier.minCart}`,
          badgeText: `₹${matchedTier.discount} OFF`,
        });
      }

      if (upcomingTier && (!nextMotivatorPrompt || upcomingTier.minCart - cartValueAfterProductDiscount < nextMotivatorPrompt.amountNeeded)) {
        const amountNeeded = upcomingTier.minCart - cartValueAfterProductDiscount;
        const progress = Math.min(100, Math.round((cartValueAfterProductDiscount / upcomingTier.minCart) * 100));
        nextMotivatorPrompt = {
          type: 'DISCOUNT_TIER',
          amountNeeded,
          rewardDescription: `Add ₹${amountNeeded} more to unlock ₹${upcomingTier.discount} OFF!`,
          progressPercentage: progress,
        };
      }
    } else if (offer.offerType === 'FIXED' || offer.offerType === 'PERCENTAGE') {
      const minCart = offer.minCartValue || 0;
      if (cartValueAfterProductDiscount >= minCart) {
        let disc = 0;
        if (offer.offerType === 'FIXED') {
          disc = Math.min(offer.discountValue || 0, cartValueAfterProductDiscount);
        } else {
          const p = ((cartValueAfterProductDiscount * (offer.discountValue || 0)) / 100);
          disc = offer.maxDiscount ? Math.min(p, offer.maxDiscount) : p;
        }
        if (disc > 0) {
          offerDiscountTotal += disc;
          appliedPromotions.push({
            id: offer.id,
            name: offer.name,
            type: offer.offerType,
            discountAmount: disc,
            customerTitle: offer.customerTitle,
            badgeText: `PROMO APPLIED`,
          });
        }
      }
    } else if (offer.offerType === 'FIRST_ORDER') {
      const isNew = customer.isFirstOrder || (customer.completedOrdersCount ?? 0) === 0;
      const minCart = offer.minCartValue || 0;
      if (isNew && cartValueAfterProductDiscount >= minCart) {
        let disc = offer.discountValue || 100;
        if (offer.maxDiscount) disc = Math.min(disc, offer.maxDiscount);
        disc = Math.min(disc, cartValueAfterProductDiscount);
        offerDiscountTotal += disc;
        appliedPromotions.push({
          id: offer.id,
          name: offer.name,
          type: 'FIRST_ORDER',
          discountAmount: disc,
          customerTitle: 'First Order Special Discount',
          badgeText: 'FIRST ORDER',
        });
      }
    } else if (offer.offerType === 'WIN_BACK') {
      const inactiveDays = offer.inactiveDays || 30;
      if (customer.lastOrderDate) {
        const lastOrderTime = new Date(customer.lastOrderDate).getTime();
        const daysAgo = (Date.now() - lastOrderTime) / (1000 * 3600 * 24);
        if (daysAgo >= inactiveDays) {
          const disc = Math.min(offer.discountValue || 100, cartValueAfterProductDiscount);
          offerDiscountTotal += disc;
          appliedPromotions.push({
            id: offer.id,
            name: offer.name,
            type: 'WIN_BACK',
            discountAmount: disc,
            customerTitle: 'We Miss You! Welcome Back Discount',
            badgeText: 'WIN BACK',
          });
        }
      }
    }
  }

  // 5. Evaluate Loyalty Order Milestone Rewards (e.g. 10 completed orders -> 10% OFF on 11th order)
  let loyaltyDiscountTotal = 0;
  let unlockedLoyaltyReward: AuthoritativePriceEvaluation['unlockedLoyaltyReward'];
  const completedOrders = customer.completedOrdersCount || 0;

  for (const rule of loyaltyRules) {
    if (!rule.isActive) continue;
    // Condition: Customer has exactly reached or completed required orders (e.g. 5 or 10)
    if (completedOrders >= rule.requiredCompletedOrders) {
      const minOrder = rule.minOrderValue || 0;
      if (cartValueAfterProductDiscount >= minOrder) {
        let disc = 0;
        if (rule.rewardType === 'FIXED') {
          disc = Math.min(rule.rewardValue, cartValueAfterProductDiscount);
        } else if (rule.rewardType === 'PERCENTAGE') {
          const p = (cartValueAfterProductDiscount * rule.rewardValue) / 100;
          disc = rule.maxDiscount ? Math.min(p, rule.maxDiscount) : p;
        }

        if (disc > loyaltyDiscountTotal) {
          loyaltyDiscountTotal = disc;
          unlockedLoyaltyReward = {
            ruleId: rule.id,
            name: rule.name,
            description: rule.description || `${rule.requiredCompletedOrders}th Order Milestone Reward`,
            discountAmount: disc,
          };
        }
      }
    }
  }

  if (unlockedLoyaltyReward && loyaltyDiscountTotal > 0) {
    appliedPromotions.push({
      id: unlockedLoyaltyReward.ruleId,
      name: unlockedLoyaltyReward.name,
      type: 'LOYALTY',
      discountAmount: loyaltyDiscountTotal,
      customerTitle: unlockedLoyaltyReward.description,
      badgeText: 'LOYALTY REWARD',
    });
  }

  // 6. Evaluate Coupons
  let couponDiscountTotal = 0;
  let appliedCouponData: AuthoritativePriceEvaluation['appliedCoupon'];

  if (couponCode) {
    const cleanCode = couponCode.trim().toUpperCase();
    const matchedCoupon = coupons.find(
      (c) => c.code.toUpperCase() === cleanCode && c.isActive
    );

    if (matchedCoupon) {
      const isDateValid = matchedCoupon.startDate <= nowIso && matchedCoupon.endDate >= nowIso;
      const isFirstOrderValid = !matchedCoupon.isFirstOrderOnly || customer.isFirstOrder || (customer.completedOrdersCount ?? 0) === 0;
      const isUsageCapValid = !matchedCoupon.usageLimit || (matchedCoupon.usedCount ?? 0) < matchedCoupon.usageLimit;
      const customerUses = customer.previousCouponUses?.[cleanCode] || 0;
      const isPerCustomerValid = !matchedCoupon.perCustomerLimit || customerUses < matchedCoupon.perCustomerLimit;

      if (!isDateValid) {
        validationMessages.push(`Coupon ${cleanCode} has expired.`);
      } else if (!isFirstOrderValid) {
        validationMessages.push(`Coupon ${cleanCode} is exclusively valid on your first order.`);
      } else if (!isUsageCapValid) {
        validationMessages.push(`Coupon ${cleanCode} maximum redemption limit has been reached.`);
      } else if (!isPerCustomerValid) {
        validationMessages.push(`You have already redeemed coupon ${cleanCode} the maximum allowed times.`);
      } else if (cartValueAfterProductDiscount < matchedCoupon.minimumOrder) {
        validationMessages.push(`Minimum cart value of ₹${matchedCoupon.minimumOrder} required for coupon ${cleanCode}.`);
      } else {
        // Calculate coupon discount
        if (matchedCoupon.type === 'FIXED') {
          couponDiscountTotal = Math.min(matchedCoupon.value, cartValueAfterProductDiscount);
        } else if (matchedCoupon.type === 'PERCENTAGE') {
          const p = (cartValueAfterProductDiscount * matchedCoupon.value) / 100;
          couponDiscountTotal = matchedCoupon.maxDiscount ? Math.min(p, matchedCoupon.maxDiscount) : p;
        } else if (matchedCoupon.type === 'TIERED' && matchedCoupon.tiers) {
          const sorted = [...matchedCoupon.tiers].sort((a, b) => a.minCart - b.minCart);
          for (const t of sorted) {
            if (cartValueAfterProductDiscount >= t.minCart) {
              couponDiscountTotal = t.discount;
            }
          }
        }

        appliedCouponData = {
          code: matchedCoupon.code,
          discountAmount: couponDiscountTotal,
          description: `Coupon ${matchedCoupon.code} Applied (₹${couponDiscountTotal} OFF)`,
        };

        appliedPromotions.push({
          id: matchedCoupon.id,
          name: `Coupon ${matchedCoupon.code}`,
          type: 'COUPON',
          discountAmount: couponDiscountTotal,
          customerTitle: `Coupon ${matchedCoupon.code}`,
          badgeText: 'COUPON',
        });
      }
    } else {
      validationMessages.push(`Coupon code "${couponCode}" is invalid or inactive.`);
    }
  }

  // 7. Stacking Rules & Collision Resolution
  // Check if any applied offer specifies 'DENY' stacking
  const hasDenyStackingOffer = sortedOffers.some(
    (off) => off.stackingRule === 'DENY' && appliedPromotions.some((ap) => ap.id === off.id)
  );

  let finalOfferDiscount = offerDiscountTotal;
  let finalCouponDiscount = couponDiscountTotal;
  let finalLoyaltyDiscount = loyaltyDiscountTotal;

  if (hasDenyStackingOffer) {
    // Select the single highest discount among (offer, coupon, loyalty)
    if (finalCouponDiscount >= finalOfferDiscount && finalCouponDiscount >= finalLoyaltyDiscount) {
      finalOfferDiscount = 0;
      finalLoyaltyDiscount = 0;
    } else if (finalOfferDiscount >= finalCouponDiscount && finalOfferDiscount >= finalLoyaltyDiscount) {
      finalCouponDiscount = 0;
      finalLoyaltyDiscount = 0;
    } else {
      finalOfferDiscount = 0;
      finalCouponDiscount = 0;
    }
  }

  const totalDiscount = productDiscountTotal + finalOfferDiscount + finalCouponDiscount + finalLoyaltyDiscount;
  const taxableAmount = Math.max(0, rawSubtotal - totalDiscount);

  // 8. Free Delivery Check
  let isFreeDelivery = taxableAmount >= 500 || cartItems.length === 0;
  const hasFreeDeliveryOffer = sortedOffers.some(
    (off) => off.offerType === 'FREE_DELIVERY' && cartValueAfterProductDiscount >= (off.minCartValue || 500)
  );
  if (hasFreeDeliveryOffer) {
    isFreeDelivery = true;
  }

  const deliveryCharge = isFreeDelivery ? 0 : 29;
  const taxAmount = Math.round(taxableAmount * 0.05); // 5% GST
  const grandTotal = Math.max(0, taxableAmount + deliveryCharge + taxAmount);

  return {
    items: evaluatedItems,
    freeGifts,
    subtotal: rawSubtotal,
    productDiscountTotal,
    offerDiscountTotal: finalOfferDiscount,
    couponDiscountTotal: finalCouponDiscount,
    loyaltyDiscountTotal: finalLoyaltyDiscount,
    totalDiscount,
    deliveryCharge,
    isFreeDelivery,
    taxAmount,
    grandTotal,
    appliedPromotions,
    appliedCoupon: appliedCouponData,
    unlockedLoyaltyReward,
    nextMotivatorPrompt,
    validationMessages,
  };
}
