'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Header } from '@/components/customer/Header';
import { CartDrawer } from '@/components/customer/CartDrawer';
import { AuthModal } from '@/components/customer/AuthModal';
import { ProductCard } from '@/components/customer/ProductCard';
import { ProductDetailModal } from '@/components/customer/ProductDetailModal';
import { Product } from '@/types';
import { Filter, SlidersHorizontal, ArrowLeft } from 'lucide-react';

export default function ProductsCatalogPage() {
  const {
    products,
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery
  } = useAppStore();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  const [sortBy, setSortBy] = useState<'relevance' | 'price-low' | 'price-high' | 'rating'>('relevance');

  let filtered = products.filter((p) => {
    if (selectedCategoryId && p.categoryId !== selectedCategoryId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });

  if (sortBy === 'price-low') {
    filtered = [...filtered].sort((a, b) => a.sellingPrice - b.sellingPrice);
  } else if (sortBy === 'price-high') {
    filtered = [...filtered].sort((a, b) => b.sellingPrice - a.sellingPrice);
  } else if (sortBy === 'rating') {
    filtered = [...filtered].sort((a, b) => b.rating - a.rating);
  }

  const selectedCategoryName = categories.find((c) => c.id === selectedCategoryId)?.name || 'All Groceries';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <RoleSwitcher />
      <Header onOpenCart={() => setIsCartOpen(true)} onOpenAuth={() => setIsAuthOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back Home</span>
            </Link>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{selectedCategoryName}</h1>
            <p className="text-xs text-gray-500">Showing {filtered.length} fresh products</p>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-gray-300 rounded-btn text-xs font-bold px-3 py-2 text-gray-800 focus:outline-none focus:border-emerald-500"
            >
              <option value="relevance">Sort by: Popularity</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Customer Rating</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar Category Filter */}
          <div className="bg-white rounded-card p-5 border border-gray-200 shadow-card h-fit space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <Filter className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-gray-900">Categories</h3>
            </div>

            <div className="space-y-1 text-xs">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`w-full text-left px-3 py-2 rounded-lg font-bold transition-colors ${
                  selectedCategoryId === null
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                All Categories ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors flex items-center justify-between ${
                      selectedCategoryId === cat.id
                        ? 'bg-emerald-50 text-emerald-800 font-bold'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Grid */}
          <div className="md:col-span-3">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-card p-12 text-center shadow-card border border-gray-100">
                <h3 className="font-bold text-gray-900 text-lg">No products found</h3>
                <p className="text-xs text-gray-500 mt-1">Try clearing your filters or searching for something else.</p>
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className="mt-4 bg-emerald-600 text-white font-bold text-xs px-5 py-2.5 rounded-btn hover:bg-emerald-700"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    onOpenDetail={(p) => setSelectedProductDetail(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <ProductDetailModal
        product={selectedProductDetail}
        onClose={() => setSelectedProductDetail(null)}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onOpenAuth={() => setIsAuthOpen(true)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
