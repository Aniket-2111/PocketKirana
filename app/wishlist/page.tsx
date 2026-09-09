'use client';

import React from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { showToast } from '@/components/ui/Toast';
import { ChevronRight, Trash2 } from 'lucide-react';

export default function WishlistPage() {
  const { wishlist, products, addToCart, toggleWishlist } = useAppStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const wishlistedProducts = (products || []).filter((p) => p && (wishlist || []).includes(p.id));

  const handleAddAllToCart = () => {
    wishlistedProducts.forEach((prod) => addToCart(prod, 1));
    showToast(`${wishlistedProducts.length} items added to cart!`, 'success');
  };

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
          
          {/* Title Header (Matching Mockup 2) */}
          <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Favourite</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">{wishlistedProducts.length} saved items</p>
            </div>
          </div>

          {/* List Items Layout (Matching Mockup 2) */}
          {wishlistedProducts.length === 0 ? (
            <EmptyState
              variant="wishlist"
              title="Your Favourite list is empty"
              description="Explore items and save your favorites to order later."
              ctaLabel="Browse Products"
              ctaHref="/"
            />
          ) : (
            <div className="divide-y divide-gray-100 bg-white rounded-3xl border border-gray-200/80 shadow-2xs overflow-hidden">
              {wishlistedProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors group"
                >
                  <Link href={`/product/${product.slug}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-gray-50 border border-gray-200/80 p-1.5 flex items-center justify-center">
                      <img
                        src={product.thumbnail}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="max-w-full max-h-full object-contain rounded-lg"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-sm text-gray-900 group-hover:text-[#53B175] transition-colors truncate">
                        {product.name}
                      </h3>
                      <span className="text-xs text-gray-400 font-semibold block mt-0.5">
                        {product.unit}
                      </span>
                    </div>
                  </Link>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-black text-gray-900">
                      ₹{product.sellingPrice}
                    </span>

                    <button
                      onClick={() => toggleWishlist(product.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <Link href={`/product/${product.slug}`} className="text-gray-400 hover:text-gray-900">
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sticky Bottom Green Action Button (Matching Mockup 2) */}
          {wishlistedProducts.length > 0 && (
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200/80 md:relative md:bottom-0 md:bg-transparent md:p-0 md:border-0 z-40">
              <div className="max-w-3xl mx-auto">
                <button
                  onClick={handleAddAllToCart}
                  className="w-full bg-[#53B175] hover:bg-[#469e67] text-white font-black text-sm py-4 rounded-2xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Add All To Cart
                </button>
              </div>
            </div>
          )}

        </div>
      </CustomerLayout>
    </>
  );
}
