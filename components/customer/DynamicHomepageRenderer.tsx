'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Product, Order, CartItem } from '@/types';
import {
  HomepageLayoutConfig,
  HomepageSectionConfig,
  CustomerPersona,
  BundleOffer,
} from '@/types/homepageCms';
import {
  getBuyAgainProducts,
  getBecauseYouBought,
  getFrequentlyBoughtTogether,
  getPersonalizedRecommendations,
  getSmartCartOffers,
  evaluateSectionVisibilityForPersona,
  filterPurchasableProducts,
} from '@/lib/recommendationsEngine';
import { ProductCard } from '@/components/customer/ProductCard';
import { ProductCarouselSection } from '@/components/customer/ProductCarouselSection';
import { ExploreMoreProducts } from '@/components/customer/ExploreMoreProducts';
import { CategoryGrid } from '@/components/customer/CategoryGrid';
import { ProductImageWithFallback } from '@/components/states/ProductImageWithFallback';
import { showToast } from '@/components/ui/Toast';
import {
  Sparkles,
  ShoppingBag,
  Plus,
  Check,
  ArrowRight,
  Gift,
  Truck,
  Flame,
  Clock,
  Tag,
  Star,
  ShieldCheck,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface DynamicHomepageRendererProps {
  layout?: HomepageLayoutConfig;
  previewPersona?: CustomerPersona;
  onOpenProductDetail?: (product: Product) => void;
}

export const DynamicHomepageRenderer: React.FC<DynamicHomepageRendererProps> = ({
  layout,
  previewPersona,
  onOpenProductDetail,
}) => {
  const router = useRouter();
  const {
    products,
    categories,
    brands,
    cart,
    orders,
    wishlist,
    currentUser,
    addToCart,
    applyCoupon,
    activeHomepageLayout,
  } = useAppStore();

  const [addedBundleId, setAddedBundleId] = useState<string | null>(null);

  // Use layout prop, or fallback to store's active layout
  const currentLayout = layout || activeHomepageLayout;

  const validProducts = useMemo(() => filterPurchasableProducts(products || []), [products]);

  // Customer subtotal for smart progress bars
  const cartSubtotal = useMemo(
    () => (cart || []).reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const smartOffers = useMemo(
    () => getSmartCartOffers(cartSubtotal, validProducts),
    [cartSubtotal, validProducts]
  );

  // Active persona resolution
  const activePersona: CustomerPersona = useMemo(() => {
    if (previewPersona) return previewPersona;
    const completedOrders = (orders || []).filter(
      (o) =>
        o.orderStatus === 'DELIVERED' ||
        o.orderStatus === 'CONFIRMED' ||
        (o as any).status === 'delivered' ||
        (o as any).status === 'confirmed'
    );
    if (!currentUser && completedOrders.length === 0) return 'NEW_CUSTOMER';
    if (completedOrders.length >= 10) return 'LOYALTY_VIP';
    if (completedOrders.length >= 5) return 'FREQUENT_BUYER';
    if (cart.length > 0) return 'CART_ABANDONER';
    return 'RETURNING_CUSTOMER';
  }, [previewPersona, orders, currentUser, cart]);

  const handleProductClick = (product: Product) => {
    if (onOpenProductDetail) {
      onOpenProductDetail(product);
    } else {
      router.push(`/product/${product.slug}`);
    }
  };

  // Filter sections by persona & active state, sorted by displayOrder
  const visibleSections = useMemo(() => {
    if (!currentLayout || !currentLayout.sections) return [];
    return [...currentLayout.sections]
      .filter((section) =>
        evaluateSectionVisibilityForPersona(section, activePersona, {
          orderCount: (orders || []).length,
          hasCart: (cart || []).length > 0,
        })
      )
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [currentLayout, activePersona, orders, cart]);

  // Collect all curated product IDs rendered in carousels above for discovery deduplication
  const curatedProductIds = useMemo(() => {
    const ids = new Set<string>();

    // Buy Again IDs
    getBuyAgainProducts(orders || [], validProducts, 8).forEach((p) => ids.add(p.id));

    // Personalized Recommendations IDs
    getPersonalizedRecommendations(
      currentUser,
      { orders: orders || [], cart: cart || [] },
      validProducts,
      8
    ).forEach((r) => ids.add(r.product.id));

    // Flash Deals IDs
    validProducts
      .filter((p) => p.mrp > p.sellingPrice)
      .slice(0, 8)
      .forEach((p) => ids.add(p.id));

    // Popular / Daily Essentials IDs
    validProducts.slice(0, 8).forEach((p) => ids.add(p.id));

    return Array.from(ids);
  }, [orders, cart, validProducts, currentUser]);

  const hasExplicitExploreMore = useMemo(() => {
    return visibleSections.some(
      (s) => s.type === 'ExploreMore' || s.type === 'ExploreMoreProducts'
    );
  }, [visibleSections]);

  // ── 1. RENDER HERO SECTION ──
  const renderHero = (section: HomepageSectionConfig) => {
    return (
      <div
        key={section.id}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-[#075C3C] text-white p-6 sm:p-10 shadow-xl border border-emerald-800/30"
      >
        <div className="relative z-10 max-w-xl space-y-3">
          {section.badge && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black tracking-wider uppercase">
              <Zap className="w-3.5 h-3.5" />
              <span>{section.badge}</span>
            </span>
          )}
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            {section.title}
          </h1>
          {section.subtitle && (
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              {section.subtitle}
            </p>
          )}
          {section.ctaText && (
            <div className="pt-2">
              <Link
                href={section.ctaLink || '/categories'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-900/50 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <span>{section.ctaText}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {section.image && (
          <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-30 sm:opacity-90 pointer-events-none hidden sm:block">
            <img
              src={section.image}
              alt={section.title}
              className="w-full h-full object-cover object-center mix-blend-screen"
            />
          </div>
        )}
      </div>
    );
  };

  // ── 2. RENDER BUY AGAIN (Personalized Fast Reorder) ──
  const renderBuyAgain = (section: HomepageSectionConfig) => {
    const buyAgainProducts = getBuyAgainProducts(orders, validProducts, section.maxItems || 8);
    if (buyAgainProducts.length === 0) return null;

    return (
      <div key={section.id} className="space-y-3 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 sm:p-5 rounded-3xl border border-emerald-100 dark:border-emerald-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{section.title}</span>
                {section.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white uppercase">
                    {section.badge}
                  </span>
                )}
              </h3>
              {section.subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{section.subtitle}</p>
              )}
            </div>
          </div>
          <Link
            href="/orders"
            className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Past Orders</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {buyAgainProducts.slice(0, 4).map((product) => {
            const inCartItem = cart.find((i) => i.productId === product.id);
            return (
              <div
                key={product.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2.5 hover:shadow-md transition-all"
              >
                <div
                  onClick={() => handleProductClick(product)}
                  className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 p-1 shrink-0 flex items-center justify-center cursor-pointer"
                >
                  <ProductImageWithFallback
                    src={product.thumbnail}
                    alt={product.name}
                    containerClassName="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0" onClick={() => handleProductClick(product)}>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate cursor-pointer">
                    {product.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-black text-[#0B8F5A]">₹{product.sellingPrice}</span>
                    {product.mrp > product.sellingPrice && (
                      <span className="text-[10px] text-slate-400 line-through">₹{product.mrp}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    addToCart(product, 1);
                    showToast(`Added ${product.name} to cart`, 'success');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shrink-0 shadow-2xs active:scale-90 transition-all cursor-pointer"
                  title="Add to cart"
                >
                  {inCartItem ? `+${inCartItem.quantity}` : 'ADD'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 3. RENDER FREQUENTLY BOUGHT TOGETHER (Bundle Discovery with 1-Tap Combined Add) ──
  const renderFrequentlyBoughtTogether = (section: HomepageSectionConfig) => {
    const triggerId = (section.targetProductIds && section.targetProductIds[0]) || 'p-bread-1';
    const bundle = getFrequentlyBoughtTogether(triggerId, validProducts, orders);
    if (!bundle) return null;

    const mainProd = validProducts.find((p) => p.id === bundle.mainProductId);
    const companionProds = bundle.bundledProductIds
      .map((id) => validProducts.find((p) => p.id === id))
      .filter(Boolean) as Product[];

    if (!mainProd || companionProds.length === 0) return null;

    const allBundleItems = [mainProd, ...companionProds];

    const handleAddBundleToCart = () => {
      allBundleItems.forEach((p) => {
        addToCart(p, 1);
      });
      setAddedBundleId(bundle.id);
      showToast(`Added ${allBundleItems.length} items bundle to cart! Saved ₹${bundle.savings}`, 'success');
      setTimeout(() => setAddedBundleId(null), 2500);
    };

    return (
      <div
        key={section.id}
        className="p-4 sm:p-6 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-emerald-500/10 rounded-3xl border border-amber-200/80 dark:border-amber-900/40 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {section.title}
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-wider">
                BUNDLE SAVER
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{section.subtitle}</p>
          </div>
        </div>

        {/* Bundle Items Flow with "+" badges */}
        <div className="flex flex-wrap items-center justify-start sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2.5">
            {allBundleItems.map((item, idx) => (
              <React.Fragment key={item.id}>
                <div
                  onClick={() => handleProductClick(item)}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer hover:border-emerald-500 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 p-1 flex items-center justify-center shrink-0">
                    <ProductImageWithFallback
                      src={item.thumbnail}
                      alt={item.name}
                      containerClassName="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0 max-w-[110px]">
                    <h5 className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                      {item.name}
                    </h5>
                    <span className="text-[10px] font-extrabold text-[#0B8F5A]">
                      ₹{item.sellingPrice}
                    </span>
                  </div>
                </div>
                {idx < allBundleItems.length - 1 && (
                  <span className="text-sm font-black text-slate-400 shrink-0">+</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Pricing & 1-Tap Bundle Add */}
          <div className="flex items-center gap-3 shrink-0 ml-auto pt-2 sm:pt-0">
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  ₹{bundle.bundlePrice}
                </span>
                <span className="text-xs text-slate-400 line-through">₹{bundle.totalMrp}</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                Save ₹{bundle.savings} (10% OFF)
              </span>
            </div>

            <button
              onClick={handleAddBundleToCart}
              disabled={addedBundleId === bundle.id}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                addedBundleId === bundle.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0B8F5A] hover:bg-[#075C3C] text-white'
              }`}
            >
              {addedBundleId === bundle.id ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add All {allBundleItems.length} to Cart</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── 4. RENDER SMART CART / FREE GIFT PROGRESS ──
  const renderSmartOfferProgress = (section: HomepageSectionConfig) => {
    return (
      <div
        key={section.id}
        className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/20 border border-emerald-200 dark:border-emerald-800/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B8F5A] text-white flex items-center justify-center shrink-0 shadow-md">
            <Gift className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {smartOffers.freeGiftUnlocked
                ? '🎉 Congratulations! Free Gift Unlocked on your order!'
                : `🎁 Add ₹${smartOffers.freeGiftAmountNeeded} more to unlock FREE Gift!`}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {smartOffers.freeDeliveryUnlocked
                ? 'Plus FREE 10-minute lightning delivery is unlocked!'
                : `Add ₹${smartOffers.freeDeliveryAmountNeeded} more for FREE delivery.`}
            </p>
          </div>
        </div>

        {/* Progress meter */}
        <div className="w-full sm:w-64 space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <span>Cart: ₹{smartOffers.subtotal}</span>
            <span>Target: ₹{smartOffers.freeGiftThreshold}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (smartOffers.subtotal / smartOffers.freeGiftThreshold) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  // ── 5. RENDER BECAUSE YOU BOUGHT THIS (Cross-Sell) ──
  const renderBecauseYouBought = (section: HomepageSectionConfig) => {
    const crossSells = getBecauseYouBought(orders, validProducts, section.maxItems || 6);
    if (crossSells.length === 0) return null;

    const firstCross = crossSells[0];

    return (
      <ProductCarouselSection
        key={section.id}
        title={`Because you bought ${firstCross.triggerProduct.name}`}
        badge="CURATED FOR YOU"
        viewAllHref="/categories"
        products={firstCross.recommendations}
        onOpenDetail={handleProductClick}
      />
    );
  };

  // ── 6. RENDER RECOMMENDED FOR YOU (Personalized Multi-Signal) ──
  const renderRecommendedForYou = (section: HomepageSectionConfig) => {
    const scored = getPersonalizedRecommendations(
      currentUser,
      { orders, cart, wishlist },
      validProducts,
      section.maxItems || 8
    );
    const recProducts = scored.map((s) => s.product);

    return (
      <ProductCarouselSection
        key={section.id}
        title={section.title}
        badge={section.badge || 'FOR YOU'}
        viewAllHref="/categories"
        products={recProducts.length > 0 ? recProducts : validProducts.slice(0, 8)}
        onOpenDetail={handleProductClick}
      />
    );
  };

  // ── 7. RENDER FLASH SALE WITH COUNTDOWN TIMER ──
  const renderFlashSale = (section: HomepageSectionConfig) => {
    const flashProducts = validProducts
      .filter((p) => p.mrp > p.sellingPrice)
      .sort((a, b) => (b.mrp - b.sellingPrice) / b.mrp - (a.mrp - a.sellingPrice) / a.mrp)
      .slice(0, section.maxItems || 8);

    return (
      <div key={section.id} className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center">
              <Flame className="w-4 h-4 fill-rose-500" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{section.title}</span>
                {section.badge && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase">
                    {section.badge}
                  </span>
                )}
              </h3>
              {section.subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{section.subtitle}</p>
              )}
            </div>
          </div>
          {section.showTimer && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black">
              <Clock className="w-3.5 h-3.5" />
              <span>Ending Soon</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4">
          {flashProducts.slice(0, 4).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onOpenDetail={() => handleProductClick(p)}
            />
          ))}
        </div>
      </div>
    );
  };

  // ── 8. RENDER LOYALTY PROGRESS MILESTONE ──
  const renderLoyaltyProgress = (section: HomepageSectionConfig) => {
    const completedOrderCount = (orders || []).filter(
      (o) =>
        o.orderStatus === 'DELIVERED' ||
        o.orderStatus === 'CONFIRMED' ||
        (o as any).status === 'delivered' ||
        (o as any).status === 'confirmed'
    ).length;
    const targetOrders = 5;
    const isMilestoneReached = completedOrderCount >= targetOrders;
    const remaining = Math.max(0, targetOrders - (completedOrderCount % targetOrders));

    return (
      <div
        key={section.id}
        className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <Star className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h4 className="font-black text-sm sm:text-base">
                {isMilestoneReached
                  ? '🎉 Reward Ready: ₹50 OFF + Free Delivery!'
                  : `⭐ ${remaining} more order${remaining === 1 ? '' : 's'} to unlock ₹50 OFF reward!`}
              </h4>
              <p className="text-xs text-white/90">
                You have completed {completedOrderCount} order{completedOrderCount === 1 ? '' : 's'} with PocketKirana
              </p>
            </div>
          </div>
          <span className="text-xs font-black px-3 py-1 rounded-full bg-white text-amber-700 uppercase shadow-2xs">
            CLUB REWARD
          </span>
        </div>
      </div>
    );
  };

  // ── 9. RENDER BRAND COLLECTIONS ──
  const renderBrandCollections = (section: HomepageSectionConfig) => {
    const activeBrands = (brands || []).filter((b) => b.isActive !== false).slice(0, 6);
    if (activeBrands.length === 0) return null;

    return (
      <div key={section.id} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {section.title}
          </h3>
          <span className="text-xs text-slate-500">100% Authentic Direct From Brands</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {activeBrands.map((b) => (
            <Link
              key={b.id}
              href={`/brand/${b.slug}`}
              className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center gap-1 shadow-2xs hover:border-emerald-500 hover:shadow-emerald-100 dark:hover:shadow-emerald-900/20 hover:scale-[1.03] transition-all cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 p-1 flex items-center justify-center">
                {b.logo ? (
                  <img src={b.logo} alt={b.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="font-black text-xs text-emerald-700">{b.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full">
                {b.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  // ── SECTION DISPATCHER ──
  return (
    <div className="space-y-6 sm:space-y-8">
      {visibleSections.map((section) => {
        switch (section.type) {
          case 'Hero':
          case 'FestivalHero':
            return renderHero(section);

          case 'ShopByCategory':
            return (
              <div key={section.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0B8F5A]" />
                    <h2 className="text-base sm:text-xl font-black text-[#075C3C] dark:text-emerald-400 tracking-tight">
                      {section.title}
                    </h2>
                  </div>
                  <Link
                    href="/categories"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-[#075C3C] dark:bg-emerald-950/40 dark:text-emerald-400 font-bold text-xs sm:text-sm transition-all border border-emerald-200/60"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <CategoryGrid />
              </div>
            );

          case 'BuyAgain':
            return renderBuyAgain(section);

          case 'FlashSale':
            return renderFlashSale(section);

          case 'FrequentlyBoughtTogether':
          case 'ComboOffers':
            return renderFrequentlyBoughtTogether(section);

          case 'FreeGift':
          case 'FreeDeliveryBanner':
          case 'DiscountAboveThreshold':
            return renderSmartOfferProgress(section);

          case 'BecauseYouBought':
            return renderBecauseYouBought(section);

          case 'RecommendedForYou':
          case 'PersonalizedProducts':
            return renderRecommendedForYou(section);

          case 'LoyaltyProgress':
          case 'CustomerRewards':
            return renderLoyaltyProgress(section);

          case 'BrandCollections':
            return renderBrandCollections(section);

          case 'ExploreMore':
          case 'ExploreMoreProducts':
            return (
              <ExploreMoreProducts
                key={section.id}
                title={section.title || 'Explore More Products'}
                subtitle={section.subtitle || 'Continuous discovery from our full catalog'}
                badge={section.badge || 'Catalog'}
                excludedProductIds={curatedProductIds}
                onOpenDetail={handleProductClick}
              />
            );

          case 'PopularProducts':
          case 'TrendingProducts':
          case 'BestSellers':
          case 'NewArrivals':
          case 'TopDeals':
          case 'DailyEssentials':
          case 'FreshArrivals':
          default:
            return (
              <ProductCarouselSection
                key={section.id}
                title={section.title}
                badge={section.badge}
                viewAllHref="/categories"
                products={validProducts.slice(0, section.maxItems || 8)}
                onOpenDetail={handleProductClick}
              />
            );
        }
      })}

      {!hasExplicitExploreMore && (
        <ExploreMoreProducts
          excludedProductIds={curatedProductIds}
          onOpenDetail={handleProductClick}
        />
      )}
    </div>
  );
};
