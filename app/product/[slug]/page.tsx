'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { showToast } from '@/components/ui/Toast';
import { Product, ProductVariant, ProductSection } from '@/types';
import { EmptyState, ProductImageWithFallback } from '@/components/states';
import {
  Star,
  ShoppingBag,
  Heart,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Package,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { normalizeProductSections, sanitizeVisibleSectionsForCustomer } from '@/lib/productSectionUtils';
import { ProductCarouselSection } from '@/components/customer/ProductCarouselSection';
import { getProductDetailRecommendations } from '@/lib/recommendationsEngine';

// ── Helper to retrieve configured product variants or empty array if single product ──
function getInitialProductVariants(product: Product): ProductVariant[] {
  if (product.variants && product.variants.length > 0) {
    const active = product.variants.filter((v) => v.isActive);
    return active.length > 0 ? active : product.variants;
  }

  // If explicitly declared as single product without variants, do not invent variants
  if (product.hasVariants === false) {
    return [];
  }

  // Legacy fallback: if product has no explicit variant config, return single default variant
  return [];
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [mounted, setMounted] = useState(false);
  const { products, categories, brands, cart, addToCart, updateQuantity, removeFromCart, wishlist, toggleWishlist } = useAppStore();

  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find product from store or fetched
  const storeProduct = products.find((p) => p.slug === slug || p.id === slug);
  const product = storeProduct || fetchedProduct || (products.length > 0 ? products[0] : null);

  // If not found in store on direct navigation, fetch from versioned API
  useEffect(() => {
    if (!storeProduct && slug) {
      fetch(`/api/v1/products/${slug}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setFetchedProduct(data.data);
          }
        })
        .catch(() => {});
    }
  }, [storeProduct, slug]);

  const category = categories.find((c) => c.id === product?.categoryId) || categories[0];
  const brandObj = product ? brands.find((b) => b.id === product.brandId) : null;
  const isWishlisted = product ? wishlist.includes(product.id) : false;

  // ── Dynamic Variants State (immediately available on open) ──
  const [variants, setVariants] = useState<ProductVariant[]>(() =>
    product ? getInitialProductVariants(product) : []
  );
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(() => {
    if (!product) return null;
    const initialVars = getInitialProductVariants(product);
    return initialVars.find((v) => v.isDefault) || initialVars[0] || null;
  });

  // Gallery / UI state
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [localQty, setLocalQty] = useState(1);
  const [activeTab, setActiveTab] = useState<'specifications' | 'description'>('specifications');

  // Sync variants whenever product changes
  useEffect(() => {
    if (!product) return;
    const initialVars = getInitialProductVariants(product);
    setVariants(initialVars);
    setSelectedVariant(initialVars.find((v) => v.isDefault) || initialVars[0] || null);
  }, [product?.id, product?.unit, product?.variants]);

  // Product Gallery — Dynamic multi-photo with deduplication & display limit support (must be before early returns)
  const productGallery = React.useMemo(() => {
    if (!product) return ['https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'];
    const list: string[] = [];
    if (product.thumbnail) list.push(product.thumbnail);
    if (product.image && !list.includes(product.image)) list.push(product.image);
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      product.images.forEach((img) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    if (list.length === 0) {
      list.push('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80');
    }
    // Respect admin display limit if set
    if (product.maxDisplayImages && product.maxDisplayImages > 0) {
      return list.slice(0, product.maxDisplayImages);
    }
    return list;
  }, [product]);

  // ── 3-Tier Recommendations State (declared unconditionally before early returns) ──
  const [recommendations, setRecommendations] = useState(() =>
    getProductDetailRecommendations(product, products)
  );

  useEffect(() => {
    if (!product) return;
    const localRecs = getProductDetailRecommendations(product, products);
    setRecommendations(localRecs);

    let isCancelled = false;
    fetch(`/api/products/${product.id}/recommendations`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.success) {
          setRecommendations({
            sameCategory: data.sameCategory || [],
            sameBrand: data.sameBrand || [],
            random: data.random || [],
          });
        }
      })
      .catch(() => {
        // Maintain instant local store recommendations on network error
      });

    return () => {
      isCancelled = true;
    };
  }, [product?.id, product?.slug, product?.categoryId, product?.brandId, products]);

  if (!mounted) {
    return (
      <>
        <RoleSwitcher />
        <CustomerLayout>
          <div className="bg-[#F8FAF9] min-h-screen pb-20 md:pb-16 font-sans text-gray-900">
            <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-12 text-center">
              <div className="animate-pulse space-y-4 max-w-md mx-auto">
                <div className="h-8 bg-slate-200 rounded-xl w-3/4 mx-auto" />
                <div className="h-4 bg-slate-200 rounded-lg w-1/2 mx-auto" />
              </div>
            </div>
          </div>
        </CustomerLayout>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <RoleSwitcher />
        <CustomerLayout>
          <div className="max-w-7xl mx-auto px-4 py-16 text-center" suppressHydrationWarning>
            <EmptyState
              type="products"
              title="Product Not Found"
              description="The product you are looking for is currently unavailable, out of stock, or has been moved."
              primaryAction={{
                label: "Back to Home",
                onClick: () => router.push('/'),
              }}
            />
          </div>
        </CustomerLayout>
      </>
    );
  }

  // Effective price/stock from selected variant
  const effectivePrice = selectedVariant ? selectedVariant.sellingPrice : product.sellingPrice;
  const effectiveMrp = selectedVariant ? selectedVariant.mrp : (product.mrp || product.sellingPrice);
  const effectiveStock = selectedVariant
    ? (selectedVariant.stockQuantity !== undefined ? selectedVariant.stockQuantity : selectedVariant.stock ?? 0)
    : (product.stock ?? 100);
  const effectiveLowStockThreshold = selectedVariant?.lowStockThreshold || 5;
  const discountPct = effectiveMrp > effectivePrice
    ? Math.round(((effectiveMrp - effectivePrice) / effectiveMrp) * 100)
    : 0;

  const isOutOfStock = effectiveStock === 0;
  const isLowStock = effectiveStock > 0 && effectiveStock <= effectiveLowStockThreshold;
  const subtotal = effectivePrice * localQty;

  // Cart item ID for this variant
  const cartItemId = selectedVariant
    ? `${product.id}::${selectedVariant.id}`
    : `${product.id}::default`;
  const cartItem = cart.find((item) => item.id === cartItemId);

  const handleAddToCart = () => {
    if (isOutOfStock) {
      showToast('This variant is out of stock', 'error');
      return;
    }
    addToCart(product, localQty, selectedVariant || undefined);
    const variantLabel = selectedVariant ? ` (${selectedVariant.variantName})` : '';
    showToast(`${localQty}× ${product.name}${variantLabel} added to cart!`, 'success');
  };

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="bg-[#F8FAF9] min-h-screen pb-20 md:pb-16 font-sans text-gray-900" suppressHydrationWarning>
          <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6">

            {/* ── BREADCRUMB & BACK ── */}
            <div className="space-y-2">
              <button
                onClick={() => router.back()}
                suppressHydrationWarning
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-gray-900 transition-colors bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-gray-500 overflow-x-auto whitespace-nowrap">
                <Link href="/" className="hover:text-emerald-700">Home</Link>
                <span>›</span>
                <Link href={`/category/${category?.slug || ''}`} className="hover:text-emerald-700">Categories</Link>
                <span>›</span>
                <span className="font-bold text-gray-900 truncate max-w-[150px]">{category?.name}</span>
              </div>
            </div>

            {/* ── MAIN PRODUCT SECTION ── */}
            <div className="grid md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200/80 shadow-2xs">

              {/* Left: Image Gallery */}
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-[#EEF2F0] rounded-xl sm:rounded-2xl overflow-hidden h-64 sm:h-80 md:h-[380px] flex items-center justify-center p-4 sm:p-8 relative border border-gray-200/60 shadow-inner group">
                  <ProductImageWithFallback
                    src={productGallery[selectedImgIndex]}
                    alt={product.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center">
                      <span className="bg-rose-600 text-white font-black text-xs px-4 py-2 rounded-full shadow-lg">
                        OUT OF STOCK
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {productGallery.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImgIndex(idx)}
                      suppressHydrationWarning
                      className={`bg-[#EEF2F0] rounded-xl h-16 sm:h-24 p-1.5 border-2 overflow-hidden transition-all flex items-center justify-center cursor-pointer ${
                        selectedImgIndex === idx
                          ? 'border-[#0B8F5A] shadow-xs ring-2 ring-emerald-600/20'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <ProductImageWithFallback src={imgUrl} alt="Thumbnail" className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Product Info & Purchase Panel */}
              <div className="space-y-4 sm:space-y-5 flex flex-col justify-between">
                <div className="space-y-3.5 sm:space-y-4">
                  {/* Category Tag + Brand Badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block bg-[#0B8F5A] text-white font-bold text-[10px] sm:text-[11px] px-3 py-1 rounded-full uppercase tracking-wider">
                      {category?.name || 'Organic'}
                    </span>
                    {brandObj && (
                      <Link
                        href={`/brand/${brandObj.slug}`}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-bold text-[10px] sm:text-[11px] px-2.5 py-1 rounded-full transition-colors shadow-2xs"
                      >
                        {(brandObj.logoUrl || brandObj.logo) && (
                          <img
                            src={brandObj.logoUrl || brandObj.logo}
                            alt={brandObj.name}
                            className="w-4 h-4 object-contain rounded"
                          />
                        )}
                        <span>{brandObj.name}</span>
                      </Link>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-snug">
                    {product.name}
                  </h1>

                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400" />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-gray-900">4.8</span>
                    <span className="text-xs text-gray-400 font-medium">Rating</span>
                  </div>

                  {/* Price + Discount */}
                  <div className="flex items-baseline gap-2.5 pt-1">
                    <span className="text-2xl sm:text-3xl font-black text-gray-900">₹{effectivePrice}</span>
                    {effectiveMrp > effectivePrice && (
                      <>
                        <span className="text-sm font-semibold text-gray-400 line-through">₹{effectiveMrp}</span>
                        <span className="bg-emerald-100 text-emerald-800 font-black text-xs px-2 py-0.5 rounded-full border border-emerald-200">
                          {discountPct}% OFF
                        </span>
                      </>
                    )}
                  </div>

                  {/* ── DYNAMIC VARIANT SIZE BUTTONS (Instant on Page Open) ── */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Select Size / Weight
                      </span>
                    </div>

                    {variants.length > 0 && (
                      <div className={`grid gap-2 ${variants.length <= 2 ? 'grid-cols-2' : variants.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                        {variants.map((v) => {
                          const vStock = v.stockQuantity !== undefined ? v.stockQuantity : v.stock ?? 0;
                          const vIsOut = vStock === 0;
                          const isSelected = selectedVariant?.id === v.id;

                          return (
                            <button
                              key={v.id}
                              disabled={vIsOut}
                              type="button"
                              suppressHydrationWarning
                              onClick={() => {
                                setSelectedVariant(v);
                                setLocalQty(1);
                              }}
                              className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all text-center relative cursor-pointer ${
                                isSelected
                                  ? 'border-[#0B8F5A] bg-emerald-50/80 text-emerald-950 shadow-xs font-black ring-2 ring-emerald-600/30'
                                  : vIsOut
                                  ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed line-through'
                                  : 'border-gray-200 text-gray-700 bg-white hover:border-emerald-400 hover:bg-emerald-50/30'
                              }`}
                            >
                              <span className="block font-extrabold text-xs">{v.variantName}</span>
                              <span className="block text-[11px] font-black text-emerald-800 mt-0.5">₹{v.sellingPrice}</span>
                              {vIsOut && (
                                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[7px] font-black px-1 py-0.5 rounded-full">
                                  OUT
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quantity Selector */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity:</span>
                      <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                        <button
                          onClick={() => setLocalQty(Math.max(1, localQty - 1))}
                          suppressHydrationWarning
                          className="px-3.5 py-2 text-gray-600 hover:bg-gray-200 transition-colors font-bold text-sm cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-3 text-xs font-black text-gray-900">{localQty}</span>
                        <button
                          onClick={() => setLocalQty(localQty + 1)}
                          suppressHydrationWarning
                          className="px-3.5 py-2 text-gray-600 hover:bg-gray-200 transition-colors font-bold text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-900 pt-1">
                      Subtotal <span className="font-black text-base text-gray-900">₹{subtotal}</span>
                    </div>
                  </div>

                  {/* Stock Badge */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-600 pt-1">
                    <span className="text-gray-900">
                      Delivered: <strong className="font-black">Today, in 30 mins</strong>
                    </span>
                    {isOutOfStock ? (
                      <span className="flex items-center gap-1 text-rose-700 font-black bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-[10px]">
                        <XCircle className="w-3 h-3" />
                        Out of Stock
                      </span>
                    ) : isLowStock ? (
                      <span className="flex items-center gap-1 text-amber-800 font-black bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px]">
                        <AlertTriangle className="w-3 h-3" />
                        Only {effectiveStock} left!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        In Stock
                      </span>
                    )}
                  </div>

                  {/* Add to Cart + Wishlist */}
                  <div className="flex items-center gap-2.5 pt-3">
                    {/* Stepper when already in cart, else Add to Cart button */}
                    {cartItem ? (
                      <div className="flex-1 flex items-center justify-between bg-[#0B8F5A] text-white rounded-2xl shadow-md overflow-hidden">
                        <button
                          suppressHydrationWarning
                          onClick={() => {
                            if (cartItem.quantity <= 1) {
                              removeFromCart(cartItemId);
                              showToast(`${product.name} removed from cart`, 'info');
                            } else {
                              updateQuantity(cartItemId, cartItem.quantity - 1);
                            }
                          }}
                          className="w-12 h-12 flex items-center justify-center hover:bg-black/15 transition-colors cursor-pointer"
                          title="Decrease quantity"
                        >
                          <Minus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <span className="font-black text-sm">{cartItem.quantity} in cart</span>
                        <button
                          suppressHydrationWarning
                          onClick={() => updateQuantity(cartItemId, cartItem.quantity + 1)}
                          disabled={isOutOfStock}
                          className="w-12 h-12 flex items-center justify-center hover:bg-black/15 transition-colors disabled:opacity-40 cursor-pointer"
                          title="Increase quantity"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleAddToCart}
                        disabled={isOutOfStock}
                        suppressHydrationWarning
                        className={`flex-1 font-black py-4 px-5 rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer ${
                          isOutOfStock
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-[#0B8F5A] hover:bg-[#075C3C] text-white'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>{isOutOfStock ? 'Out of Stock' : 'Add to cart'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => toggleWishlist(product.id)}
                      suppressHydrationWarning
                      className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                        isWishlisted
                          ? 'border-rose-400 bg-rose-50 text-rose-500'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-rose-500' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-2 pt-5 border-t border-gray-100 text-[10px] sm:text-xs text-gray-600 font-semibold text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-1">
                    <span className="text-emerald-600 font-bold">🌱</span>
                    <span>Direct from farm</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-1">
                    <span className="text-emerald-600 font-bold">🚚</span>
                    <span>24H Delivery</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-1">
                    <span className="text-emerald-600 font-bold">🛡️</span>
                    <span>100% Fresh</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── PRODUCT DETAILS & SPECIFICATIONS (Collapsible with 'View Details' Button) ── */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/80 p-4 sm:p-6 md:p-8 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>Product Specifications &amp; Details</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Nutritional information, shelf life, storage &amp; verified farm specs
                  </p>
                </div>

                {/* Primary "View Details" / "Hide Details" Button */}
                <button
                  type="button"
                  onClick={() => setShowDetails((prev) => !prev)}
                  suppressHydrationWarning
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#075C3C] font-bold text-xs sm:text-sm border border-emerald-200/80 transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95 shrink-0"
                >
                  <span>{showDetails ? 'Hide Details' : 'View Details'}</span>
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expandable Details Container */}
              {showDetails && (
                <div className="space-y-4 pt-3 border-t border-gray-100 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    {(['specifications', 'description'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        suppressHydrationWarning
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all capitalize cursor-pointer ${
                          activeTab === tab
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {tab === 'specifications' ? 'Specifications & Specs' : 'Description & Benefits'}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'specifications' && (
                    <div className="space-y-3 max-w-3xl">
                      {sanitizeVisibleSectionsForCustomer(normalizeProductSections(product)).map((sec) => {
                        const isSecOpen = openSections[sec.id] ?? sec.defaultExpanded;
                        return (
                          <div
                            key={sec.id}
                            className="bg-slate-50/80 border border-gray-200 rounded-2xl overflow-hidden transition-all shadow-2xs"
                          >
                            <button
                              type="button"
                              onClick={() => setOpenSections((prev) => ({ ...prev, [sec.id]: !isSecOpen }))}
                              className="w-full px-4 py-3 flex items-center justify-between text-left font-black text-gray-900 text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                {sec.title}
                              </span>
                              {isSecOpen ? (
                                <ChevronUp className="w-4 h-4 text-gray-600" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </button>

                            {isSecOpen && (
                              <div className="px-4 pb-4 pt-2 border-t border-gray-200/60 bg-white divide-y divide-gray-100">
                                {(sec.attributes || []).map((attr) => (
                                  <div
                                    key={attr.id}
                                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1"
                                  >
                                    <span className="font-bold text-gray-600 sm:w-1/2">{attr.label}</span>
                                    <span className="font-semibold text-gray-900 sm:w-1/2 sm:text-right font-mono">
                                      {attr.value} {attr.unit ? <span className="text-gray-500 font-normal">{attr.unit}</span> : null}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === 'description' && (
                    <div className="space-y-3 text-xs text-gray-600 leading-relaxed max-w-3xl">
                      <p className="text-xs sm:text-sm font-medium text-gray-700">
                        {product.description || 'Crisp, nutrient-rich produce harvested fresh from our partner farms and delivered directly to your door. Packed with essential vitamins, minerals, and natural fiber, it is the perfect choice for healthy daily meals.'}
                      </p>
                      <ul className="space-y-2 pt-1">
                        <li className="flex items-center gap-2 font-medium text-gray-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                          <span>100% Fresh & Directly Sourced</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-gray-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                          <span>Harvested within 24 hours of delivery</span>
                        </li>
                        <li className="flex items-center gap-2 font-medium text-gray-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                          <span>Great for boosting immunity &amp; overall wellness</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 1. MORE FROM SAME CATEGORY (Hides if < 2 products) ── */}
            {recommendations.sameCategory && recommendations.sameCategory.length >= 2 && (
              <ProductCarouselSection
                title={`More from ${category?.name || 'This Category'}`}
                badge="CATEGORY"
                viewAllHref={`/categories?categoryId=${product.categoryId || ''}`}
                products={recommendations.sameCategory}
                onOpenDetail={(p) => router.push(`/product/${p.slug || p.id}`)}
              />
            )}

            {/* ── 2. MORE FROM SAME BRAND (Hides if no brand or 0 items) ── */}
            {recommendations.sameBrand && recommendations.sameBrand.length > 0 && (
              <ProductCarouselSection
                title={`More from ${brandObj?.name || 'Brand'}`}
                badge="BRAND"
                viewAllHref={brandObj?.slug ? `/brand/${brandObj.slug}` : `/categories`}
                products={recommendations.sameBrand}
                onOpenDetail={(p) => router.push(`/product/${p.slug || p.id}`)}
              />
            )}

            {/* ── 3. RANDOM / DISCOVERY PRODUCTS (YOU MAY ALSO LIKE) ── */}
            {recommendations.random && recommendations.random.length > 0 && (
              <ProductCarouselSection
                title="You may also like"
                badge="DISCOVER"
                viewAllHref="/categories"
                products={recommendations.random}
                onOpenDetail={(p) => router.push(`/product/${p.slug || p.id}`)}
              />
            )}

          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
