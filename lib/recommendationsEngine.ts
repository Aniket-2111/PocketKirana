/**
 * PocketKirana — Algorithmic Personalization & Recommendation Engine
 *
 * Implements multi-signal recommendation algorithms, fast 1-tap reordering ("Buy Again"),
 * complementary cross-sells ("Because You Bought This"), bundle discovery ("Frequently Bought Together"),
 * and inventory-aware real-time filtering.
 */

import { Product, Order, CartItem, User } from '@/types';
import {
  HomepageSectionConfig,
  CustomerPersona,
  RecommendationScoreResult,
  BundleOffer,
  SmartCartOfferState,
} from '@/types/homepageCms';

// Curated Merchandising Knowledge Graph (Complementary grocery relations)
export const COMPLEMENTARY_PAIRS: Record<string, string[]> = {
  // Bakery / Breakfast
  'p-bread-1': ['p-butter-1', 'p-jam-1', 'p-milk-1', 'p-egg-1'],
  'p-bread-white': ['p-butter-1', 'p-jam-1', 'p-milk-1', 'p-egg-1'],
  'p-bread-brown': ['p-peanut-butter-1', 'p-honey-1', 'p-green-tea-1'],
  'p-maggi-1': ['p-ketchup-1', 'p-cheese-1', 'p-coke-1', 'p-chips-1'],
  'p-maggi-masala': ['p-ketchup-1', 'p-cheese-1', 'p-coke-1', 'p-chips-1'],
  'p-tea-1': ['p-sugar-1', 'p-milk-1', 'p-biscuit-1', 'p-rusk-1'],
  'p-coffee-1': ['p-milk-1', 'p-sugar-1', 'p-cookies-1'],
  // Cooking Staples
  'p-atta-1': ['p-oil-1', 'p-ghee-1', 'p-salt-1', 'p-turmeric-1'],
  'p-rice-1': ['p-dal-1', 'p-ghee-1', 'p-papad-1', 'p-pickle-1'],
  'p-dal-1': ['p-rice-1', 'p-ghee-1', 'p-cumin-1', 'p-mustard-1'],
  'p-oil-1': ['p-atta-1', 'p-spices-1', 'p-onion-1', 'p-potato-1'],
  // Fresh Produce
  'p-onion-1': ['p-potato-1', 'p-tomato-1', 'p-ginger-1', 'p-chilli-1'],
  'p-potato-1': ['p-onion-1', 'p-tomato-1', 'p-oil-1', 'p-peas-1'],
  'p-tomato-1': ['p-onion-1', 'p-coriander-1', 'p-garlic-1'],
  // Dairy / Snacks
  'p-milk-1': ['p-cornflakes-1', 'p-cookies-1', 'p-bread-1', 'p-tea-1'],
  'p-paneer-1': ['p-butter-1', 'p-peas-1', 'p-kasuri-methi-1', 'p-spices-1'],
  'p-chips-1': ['p-coke-1', 'p-dip-1', 'p-juice-1'],
};

/**
 * Filter out out-of-stock, inactive or discontinued products
 */
export function filterPurchasableProducts(products: Product[]): Product[] {
  return (products || []).filter((p) => {
    if (!p || p.status === 'discontinued') return false;
    if (p.status === 'out_of_stock') return false;
    if (p.stock !== undefined && p.stock <= 0) return false;
    return true;
  });
}

/**
 * 1. BUY AGAIN — Fast 1-tap reorder recommendations
 * Extracts items previously purchased in completed/delivered orders, ranked by frequency and recency.
 */
export function getBuyAgainProducts(
  orders: Order[] = [],
  allProducts: Product[] = [],
  limit: number = 8
): Product[] {
  const validProducts = filterPurchasableProducts(allProducts);
  const productMap = new Map(validProducts.map((p) => [p.id, p]));

  // Count purchase frequencies & track most recent purchase timestamp
  const purchaseStats: Record<string, { count: number; lastPurchased: number }> = {};

  const completedOrders = (orders || []).filter((o) => {
    const s = (o.orderStatus || o.status || '').toLowerCase();
    return s === 'delivered' || s === 'confirmed' || s === 'shipped' || s === 'packed' || s === 'completed';
  });

  completedOrders.forEach((order) => {
    const orderTime = new Date(order.placedAt || order.createdAt || 0).getTime();
    (order.items || []).forEach((item) => {
      const pId = item.productId || (item as any).id;
      if (!purchaseStats[pId]) {
        purchaseStats[pId] = { count: 0, lastPurchased: orderTime };
      }
      purchaseStats[pId].count += item.quantity || 1;
      if (orderTime > purchaseStats[pId].lastPurchased) {
        purchaseStats[pId].lastPurchased = orderTime;
      }
    });
  });

  const rankedIds = Object.keys(purchaseStats).sort((a, b) => {
    const statA = purchaseStats[a];
    const statB = purchaseStats[b];
    // Frequency primary, recency secondary
    if (statB.count !== statA.count) {
      return statB.count - statA.count;
    }
    return statB.lastPurchased - statA.lastPurchased;
  });

  const buyAgainList: Product[] = [];
  for (const id of rankedIds) {
    const p = productMap.get(id);
    if (p) {
      buyAgainList.push(p);
      if (buyAgainList.length >= limit) break;
    }
  }

  // If customer has no completed orders or fewer than 4 items, fall back to high-frequency staples
  if (buyAgainList.length < 4) {
    const staples = validProducts.filter((p) => {
      const name = (p.name || '').toLowerCase();
      return (
        name.includes('milk') ||
        name.includes('bread') ||
        name.includes('egg') ||
        name.includes('curd') ||
        name.includes('atta') ||
        name.includes('onion') ||
        name.includes('tomato')
      );
    });

    for (const staple of staples) {
      if (!buyAgainList.some((p) => p.id === staple.id)) {
        buyAgainList.push(staple);
        if (buyAgainList.length >= limit) break;
      }
    }
  }

  return buyAgainList;
}

/**
 * 2. BECAUSE YOU BOUGHT THIS — Complementary item cross-sells
 */
export function getBecauseYouBought(
  pastPurchases: (string | Order)[] = [],
  allProducts: Product[] = [],
  limit: number = 6
): { triggerProduct: Product; recommendations: Product[] }[] {
  const validProducts = filterPurchasableProducts(allProducts);
  const productMap = new Map(validProducts.map((p) => [p.id, p]));

  // Extract purchased product IDs
  const purchasedIds = new Set<string>();
  pastPurchases.forEach((entry) => {
    if (typeof entry === 'string') {
      purchasedIds.add(entry);
    } else if (entry && (entry as Order).items) {
      (entry as Order).items.forEach((item) => {
        if (item.productId) purchasedIds.add(item.productId);
      });
    }
  });

  // If no past purchases, pick a popular trigger product (e.g. Bread or Maggi or Milk)
  if (purchasedIds.size === 0) {
    const defaultTrigger = validProducts.find(
      (p) => p.id === 'p-bread-1' || p.name.toLowerCase().includes('bread') || p.name.toLowerCase().includes('milk')
    ) || validProducts[0];

    if (!defaultTrigger) return [];

    const relatedIds = COMPLEMENTARY_PAIRS[defaultTrigger.id] || [];
    const relatedProducts = validProducts
      .filter((p) => p.id !== defaultTrigger.id && (relatedIds.includes(p.id) || p.categoryId === defaultTrigger.categoryId))
      .slice(0, limit);

    return [{ triggerProduct: defaultTrigger, recommendations: relatedProducts }];
  }

  const results: { triggerProduct: Product; recommendations: Product[] }[] = [];

  for (const triggerId of purchasedIds) {
    const triggerProduct = productMap.get(triggerId);
    if (!triggerProduct) continue;

    // 1. Check knowledge graph
    const pairIds = COMPLEMENTARY_PAIRS[triggerId] || [];
    let recs = validProducts.filter((p) => pairIds.includes(p.id) && p.id !== triggerId);

    // 2. Supplement with same/adjacent category items
    if (recs.length < limit) {
      const sameCat = validProducts.filter(
        (p) => p.categoryId === triggerProduct.categoryId && p.id !== triggerId && !recs.some((r) => r.id === p.id)
      );
      recs = [...recs, ...sameCat].slice(0, limit);
    }

    if (recs.length > 0) {
      results.push({ triggerProduct, recommendations: recs });
      if (results.length >= 2) break; // Keep top 2 triggers
    }
  }

  return results;
}

/**
 * 3. FREQUENTLY BOUGHT TOGETHER — Bundle generation & combined discount
 */
export function getFrequentlyBoughtTogether(
  targetProductId: string,
  allProducts: Product[] = [],
  orders: Order[] = []
): BundleOffer | null {
  const validProducts = filterPurchasableProducts(allProducts);
  const mainProduct = validProducts.find((p) => p.id === targetProductId);
  if (!mainProduct) return null;

  // Find co-purchased items from orders
  const coOccurrences: Record<string, number> = {};
  orders.forEach((o) => {
    const itemIds = (o.items || []).map((i) => i.productId);
    if (itemIds.includes(targetProductId)) {
      itemIds.forEach((id) => {
        if (id && id !== targetProductId) {
          coOccurrences[id] = (coOccurrences[id] || 0) + 1;
        }
      });
    }
  });

  // Pick top 2 companion products
  let companionIds = Object.keys(coOccurrences)
    .sort((a, b) => coOccurrences[b] - coOccurrences[a])
    .filter((id) => validProducts.some((p) => p.id === id))
    .slice(0, 2);

  // Fallback to complementary knowledge graph if orders lack co-purchases
  if (companionIds.length < 2) {
    const graphCompanions = (COMPLEMENTARY_PAIRS[targetProductId] || []).filter(
      (id) => validProducts.some((p) => p.id === id) && !companionIds.includes(id)
    );
    companionIds = [...companionIds, ...graphCompanions].slice(0, 2);
  }

  // Fallback to same-category top-rated products
  if (companionIds.length < 2) {
    const sameCat = validProducts
      .filter((p) => p.id !== targetProductId && p.categoryId === mainProduct.categoryId && !companionIds.includes(p.id))
      .slice(0, 2 - companionIds.length)
      .map((p) => p.id);
    companionIds = [...companionIds, ...sameCat];
  }

  if (companionIds.length === 0) return null;

  const bundleItems = [mainProduct, ...companionIds.map((id) => validProducts.find((p) => p.id === id)!).filter(Boolean)];

  const totalMrp = bundleItems.reduce((sum, item) => sum + (item.mrp || item.sellingPrice), 0);
  const rawSellingTotal = bundleItems.reduce((sum, item) => sum + item.sellingPrice, 0);

  // 10% bundle combo discount
  const discountPercentage = 10;
  const bundlePrice = Math.round(rawSellingTotal * 0.9);
  const savings = totalMrp - bundlePrice;

  return {
    id: `bundle-${targetProductId}`,
    title: `Frequently Bought with ${mainProduct.name}`,
    mainProductId: targetProductId,
    bundledProductIds: companionIds,
    discountPercentage,
    totalMrp,
    bundlePrice,
    savings,
  };
}

/**
 * 4. MULTI-SIGNAL PERSONALIZED RECOMMENDATIONS
 * Combines category affinity, recency, reorder probability, popularity, and promotions.
 */
export function getPersonalizedRecommendations(
  customer: User | null,
  context: {
    orders?: Order[];
    cart?: CartItem[];
    wishlist?: string[];
    recentlyViewed?: string[];
  } = {},
  allProducts: Product[] = [],
  limit: number = 10
): RecommendationScoreResult[] {
  const validProducts = filterPurchasableProducts(allProducts);
  const orders = context.orders || [];
  const cart = context.cart || [];
  const wishlist = context.wishlist || [];
  const recentlyViewed = context.recentlyViewed || [];

  // 1. Calculate Category Affinity from orders & cart
  const categoryWeights: Record<string, number> = {};
  orders.forEach((o) => {
    (o.items || []).forEach((item) => {
      const prod = validProducts.find((p) => p.id === item.productId);
      if (prod?.categoryId) {
        categoryWeights[prod.categoryId] = (categoryWeights[prod.categoryId] || 0) + 5;
      }
    });
  });

  cart.forEach((item) => {
    if (item.product?.categoryId) {
      categoryWeights[item.product.categoryId] = (categoryWeights[item.product.categoryId] || 0) + 8;
    }
  });

  // 2. Score each product
  const scoredProducts: RecommendationScoreResult[] = validProducts.map((p) => {
    let score = 0;
    const reasons: string[] = [];
    let source: RecommendationScoreResult['source'] = 'POPULARITY';

    // A. Category Affinity (0 - 30 points)
    if (p.categoryId && categoryWeights[p.categoryId]) {
      const catBonus = Math.min(30, categoryWeights[p.categoryId]);
      score += catBonus;
      reasons.push('Based on your preferred categories');
      source = 'AFFINITY';
    }

    // B. Wishlist Boost (25 points)
    if (wishlist.includes(p.id)) {
      score += 25;
      reasons.push('In your wishlist');
      source = 'AFFINITY';
    }

    // C. Recently Viewed Boost (20 points)
    if (recentlyViewed.includes(p.id)) {
      score += 20;
      reasons.push('Recently viewed item');
      source = 'AFFINITY';
    }

    // D. Popularity / Rating (0 - 15 points)
    if (p.rating) {
      score += Math.round(p.rating * 3);
    }
    if (p.isPopular) {
      score += 10;
      reasons.push('Top popular favorite');
    }

    // E. Promotion / Discount Depth (0 - 15 points)
    if (p.mrp > p.sellingPrice) {
      const discountPercent = ((p.mrp - p.sellingPrice) / p.mrp) * 100;
      score += Math.min(15, Math.round(discountPercent / 2));
      if (discountPercent >= 15) {
        reasons.push(`${Math.round(discountPercent)}% OFF Deal`);
        source = 'PROMOTION';
      }
    }

    // F. Stock Urgency / High Availability
    if (p.stock !== undefined && p.stock > 0 && p.stock <= 5) {
      score += 5;
      reasons.push(`Only ${p.stock} left`);
    }

    return {
      product: p,
      score,
      reasons,
      source,
    };
  });

  // Sort descending by score
  return scoredProducts.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * 5. SMART CART OFFERS — Real-time progress toward Free Delivery and Free Gifts
 */
export function getSmartCartOffers(
  subtotal: number,
  allProducts: Product[] = [],
  freeDeliveryThreshold: number = 499,
  freeGiftThreshold: number = 500
): SmartCartOfferState {
  const validProducts = filterPurchasableProducts(allProducts);
  const freeDeliveryUnlocked = subtotal >= freeDeliveryThreshold;
  const freeDeliveryAmountNeeded = Math.max(0, freeDeliveryThreshold - subtotal);

  const freeGiftUnlocked = subtotal >= freeGiftThreshold;
  const freeGiftAmountNeeded = Math.max(0, freeGiftThreshold - subtotal);

  // Auto pick a suitable gift product (e.g. Snack, Juice, or Dairy product under ₹50)
  const freeGiftProduct =
    validProducts.find((p) => p.isFeatured || p.name.toLowerCase().includes('biscuit') || p.name.toLowerCase().includes('juice')) ||
    validProducts[0];

  return {
    subtotal,
    freeDeliveryThreshold,
    freeDeliveryUnlocked,
    freeDeliveryAmountNeeded,
    freeGiftThreshold,
    freeGiftUnlocked,
    freeGiftAmountNeeded,
    freeGiftProduct,
  };
}

/**
 * 6. PERSONA SECTION VISIBILITY
 * Evaluates whether a section should render based on the active user persona context.
 */
export function evaluateSectionVisibilityForPersona(
  section: HomepageSectionConfig,
  persona: CustomerPersona = 'ALL',
  context: { orderCount?: number; hasCart?: boolean } = {}
): boolean {
  if (!section.isActive) return false;
  if (section.targetPersona === 'ALL' || persona === 'ALL') return true;

  if (section.targetPersona === persona) return true;

  // Dynamic persona matching based on customer context
  const orderCount = context.orderCount || 0;
  if (section.targetPersona === 'NEW_CUSTOMER' && orderCount === 0) return true;
  if (section.targetPersona === 'RETURNING_CUSTOMER' && orderCount > 0) return true;
  if (section.targetPersona === 'FREQUENT_BUYER' && orderCount >= 5) return true;
  if (section.targetPersona === 'LOYALTY_VIP' && orderCount >= 10) return true;
  if (section.targetPersona === 'CART_ABANDONER' && context.hasCart) return true;

  return false;
}

/**
 * 7. PRODUCT DETAIL PAGE RECOMMENDATION ENGINE
 * Returns a 3-tier recommendation structure:
 * 1. sameCategory: Products in the same category/subcategory (hidden if < 2)
 * 2. sameBrand: Products with the same brandId (hidden if no brand or 0 items)
 * 3. random: Discovery products from the broader catalog (strictly deduplicated against 1 & 2 and target)
 */
export interface ProductDetailRecommendationsResult {
  sameCategory: Product[];
  sameBrand: Product[];
  random: Product[];
}

export function getProductDetailRecommendations(
  targetProduct: Product | null | undefined,
  allProducts: Product[] = [],
  options?: {
    categoryLimit?: number;
    brandLimit?: number;
    randomLimit?: number;
    seed?: number;
  }
): ProductDetailRecommendationsResult {
  if (!targetProduct) {
    return { sameCategory: [], sameBrand: [], random: [] };
  }

  const categoryLimit = options?.categoryLimit ?? 10;
  const brandLimit = options?.brandLimit ?? 10;
  const randomLimit = options?.randomLimit ?? 10;

  // Filter out discontinued or permanently unavailable products
  const pool = filterPurchasableProducts(allProducts).filter(
    (p) => p && p.id !== targetProduct.id && p.slug !== targetProduct.slug
  );

  const usedProductIds = new Set<string>([targetProduct.id]);
  if (targetProduct.slug) usedProductIds.add(targetProduct.slug);

  // ── 1. SAME CATEGORY ────────────────────────────────────────────────────────
  const categoryCandidates = pool.filter((p) => {
    const matchesCategory =
      (targetProduct.categoryId && p.categoryId === targetProduct.categoryId) ||
      (targetProduct.subcategoryId && p.subcategoryId === targetProduct.subcategoryId) ||
      (targetProduct.categoryId && p.subcategoryId === targetProduct.categoryId);
    return Boolean(matchesCategory && !usedProductIds.has(p.id));
  });

  categoryCandidates.sort((a, b) => {
    const stockA = (a.stock ?? 0) > 0 ? 1 : 0;
    const stockB = (b.stock ?? 0) > 0 ? 1 : 0;
    if (stockB !== stockA) return stockB - stockA;
    return (b.rating ?? 4.5) - (a.rating ?? 4.5);
  });

  let sameCategory: Product[] = [];
  if (categoryCandidates.length >= 2) {
    sameCategory = categoryCandidates.slice(0, categoryLimit);
    sameCategory.forEach((p) => {
      usedProductIds.add(p.id);
      if (p.slug) usedProductIds.add(p.slug);
    });
  }

  // ── 2. SAME BRAND ───────────────────────────────────────────────────────────
  let sameBrand: Product[] = [];
  if (targetProduct.brandId) {
    const brandCandidates = pool.filter(
      (p) => p.brandId === targetProduct.brandId && !usedProductIds.has(p.id)
    );

    brandCandidates.sort((a, b) => {
      const stockA = (a.stock ?? 0) > 0 ? 1 : 0;
      const stockB = (b.stock ?? 0) > 0 ? 1 : 0;
      if (stockB !== stockA) return stockB - stockA;
      return (b.rating ?? 4.5) - (a.rating ?? 4.5);
    });

    if (brandCandidates.length > 0) {
      sameBrand = brandCandidates.slice(0, brandLimit);
      sameBrand.forEach((p) => {
        usedProductIds.add(p.id);
        if (p.slug) usedProductIds.add(p.slug);
      });
    }
  }

  // ── 3. RANDOM / DISCOVERY ───────────────────────────────────────────────────
  const discoveryCandidates = pool.filter((p) => !usedProductIds.has(p.id));

  const seed =
    options?.seed ?? (typeof window !== 'undefined' ? 42 : Math.floor(Date.now() / (1000 * 60 * 60)));

  const rotatedCandidates = [...discoveryCandidates].sort((a, b) => {
    const stockA = (a.stock ?? 0) > 0 ? 1 : 0;
    const stockB = (b.stock ?? 0) > 0 ? 1 : 0;
    if (stockB !== stockA) return stockB - stockA;

    const hashA = (a.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + seed) % 97;
    const hashB = (b.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + seed) % 97;
    return hashA - hashB;
  });

  const random = rotatedCandidates.slice(0, randomLimit);

  return {
    sameCategory,
    sameBrand,
    random,
  };
}

