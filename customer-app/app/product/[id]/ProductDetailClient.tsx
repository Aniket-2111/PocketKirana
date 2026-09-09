'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
import { Plus, Minus, Star, ShieldCheck, Clock, ShoppingCart, Tag, Sparkles } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import type { Product, ProductVariant } from '@/types';

export default function ProductDetailClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const idOrSlug = (params?.id as string) || '';

  const { products, cart, addToCart, updateCartQuantity } = useAppStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Combine products with fallback mock data
  const allProducts = useMemo(() => {
    const map = new Map<string, Product>();
    INITIAL_PRODUCTS.forEach((p) => map.set(p.id, p));
    (products || []).forEach((p) => {
      const existing = map.get(p.id);
      map.set(p.id, { ...existing, ...p });
    });
    return Array.from(map.values()).filter((p) => p.status !== 'discontinued');
  }, [products]);

  const product = useMemo(() => {
    return allProducts.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || allProducts[0];
  }, [allProducts, idOrSlug]);

  const variants = product?.variants || [];
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);

  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      setSelectedVariant(variants[0]);
    }
  }, [variants, selectedVariant]);

  if (!mounted || !product) {
    return (
      <CustomerShell title="Product Details" showBack backUrl="/home">
        <div className="p-4 space-y-4 animate-pulse">
          <div className="h-64 bg-slate-200 rounded-3xl" />
          <div className="h-24 bg-slate-200 rounded-3xl" />
        </div>
      </CustomerShell>
    );
  }

  const effectivePrice = selectedVariant ? selectedVariant.sellingPrice : product.sellingPrice;
  const effectiveMrp = selectedVariant ? selectedVariant.mrp : product.mrp;
  const discountPercent = effectiveMrp > effectivePrice ? Math.round(((effectiveMrp - effectivePrice) / effectiveMrp) * 100) : 0;

  const itemKey = `${product.id}::${selectedVariant?.id || 'default'}`;
  const cartItem = cart.find((i) => i.id === itemKey || i.productId === product.id);
  const qtyInCart = cartItem ? cartItem.quantity : 0;

  const handleAddToCart = () => {
    addToCart(product, 1, selectedVariant);
    showToast(`Added ${product.name} to cart`, 'success');
  };

  const handleUpdateQty = (newQty: number) => {
    updateCartQuantity(itemKey, newQty);
  };

  return (
    <CustomerShell title={product.name} showBack backUrl="/">
      <div className="space-y-5 animate-in fade-in duration-200 pb-16">
        
        {/* Product Image Showcase */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex items-center justify-center relative shadow-xs overflow-hidden min-h-[220px]">
          {discountPercent > 0 && (
            <span className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-2xs">
              {discountPercent}% OFF
            </span>
          )}

          <img
            src={product.thumbnail || (product as any).image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'}
            alt={product.name}
            className="max-h-48 max-w-full object-contain drop-shadow-xs"
          />
        </div>

        {/* Product Info Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
          
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase text-emerald-700 tracking-wider">
              {product.brandName || 'Pocket Kirana'}
            </span>
            <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              {product.name}
            </h1>
            <span className="text-xs text-slate-500 font-mono font-bold block">
              Unit: {selectedVariant ? selectedVariant.variantName : product.unit}
            </span>
          </div>

          {/* Pricing Row */}
          <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
            <span className="text-2xl font-black text-slate-900 font-mono">
              ₹{effectivePrice}
            </span>
            {effectiveMrp > effectivePrice && (
              <span className="text-sm text-slate-400 line-through font-mono font-bold">
                ₹{effectiveMrp}
              </span>
            )}
            {discountPercent > 0 && (
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2 py-0.5 rounded-md">
                Save ₹{effectiveMrp - effectivePrice}
              </span>
            )}
          </div>

          {/* Variants Selection (if available) */}
          {variants.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-black text-slate-700 block">Select Variant / Pack Size:</span>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selectedVariant?.id === v.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-black ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {v.variantName} - ₹{v.sellingPrice}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add to Cart CTA */}
          <div className="pt-2">
            {qtyInCart === 0 ? (
              <button
                onClick={handleAddToCart}
                className="w-full py-3.5 bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-black text-sm rounded-2xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>ADD TO CART</span>
              </button>
            ) : (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-2xl p-2 px-4">
                <span className="text-xs font-black text-emerald-800">In Cart</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleUpdateQty(qtyInCart - 1)}
                    className="w-8 h-8 rounded-xl bg-white border border-emerald-300 text-emerald-800 flex items-center justify-center font-black hover:bg-emerald-100 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-mono font-black text-emerald-900 text-sm">{qtyInCart}</span>
                  <button
                    onClick={() => handleUpdateQty(qtyInCart + 1)}
                    className="w-8 h-8 rounded-xl bg-[#0B8F5A] text-white flex items-center justify-center font-black hover:bg-[#075C3C] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Product Description */}
        {product.description && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-2 shadow-xs">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Product Details</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Service Guarantees */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center gap-2.5 shadow-2xs">
            <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <strong className="block text-[11px] font-black text-slate-900">15-20 Mins</strong>
              <span className="text-[10px] text-slate-400">Superfast Delivery</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center gap-2.5 shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <strong className="block text-[11px] font-black text-slate-900">100% Quality</strong>
              <span className="text-[10px] text-slate-400">Fresh & Authentic</span>
            </div>
          </div>
        </div>

      </div>
    </CustomerShell>
  );
}
