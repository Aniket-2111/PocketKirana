'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { ProductCard } from '@/components/customer/ProductCard';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES } from '@/lib/mockData';
import { Product, Category } from '@/types';
import { Filter, Layers, ArrowLeft } from 'lucide-react';

export default function CategoryClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const slug = (params?.slug as string) || '';

  const { categories, products } = useAppStore();
  const [activeSubTab, setActiveSubTab] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'price-low' | 'price-high' | 'rating'>('relevance');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Merged Categories
  const allCategories = useMemo(() => {
    return categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
  }, [categories]);

  // Current category
  const currentCategory: Category = useMemo(() => {
    const found = allCategories.find((c) => c.slug === slug || c.id === slug);
    return found || allCategories[0] || {
      id: 'cat-default',
      name: 'Groceries',
      slug: 'groceries',
      image: '',
      sortOrder: 0,
      isActive: true,
    };
  }, [allCategories, slug]);

  // Subcategories
  const subcategories: Category[] = useMemo(() => {
    return allCategories
      .filter((c) => c.parentId === currentCategory.id && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [allCategories, currentCategory.id]);

  // Merged Products
  const allProducts = useMemo(() => {
    const map = new Map<string, Product>();
    INITIAL_PRODUCTS.forEach((p) => map.set(p.id, p));
    (products || []).forEach((p) => {
      const existing = map.get(p.id);
      map.set(p.id, { ...existing, ...p });
    });
    return Array.from(map.values()).filter((p) => p.status !== 'discontinued');
  }, [products]);

  // Filtered products for this category
  const catProducts = useMemo(() => {
    let list = allProducts.filter((p) => {
      if (p.categoryId === currentCategory.id || p.categoryId === currentCategory.slug) {
        if (activeSubTab === 'all') return true;
        if (p.subcategoryId === activeSubTab) return true;
        return true;
      }
      // Also match if subcategory id matches
      if (activeSubTab !== 'all' && p.subcategoryId === activeSubTab) return true;
      // Match category name
      if ((p as any).category && currentCategory.name && (p as any).category.toLowerCase() === currentCategory.name.toLowerCase()) {
        return true;
      }
      return false;
    });

    if (sortBy === 'price-low') {
      list.sort((a, b) => a.sellingPrice - b.sellingPrice);
    } else if (sortBy === 'price-high') {
      list.sort((a, b) => b.sellingPrice - a.sellingPrice);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return list;
  }, [allProducts, currentCategory, activeSubTab, sortBy]);

  const handleOpenDetail = (product: Product) => {
    router.push(`/product/${product.id || product.slug}`);
  };

  return (
    <CustomerShell title={currentCategory?.name || 'Category'} showBack backUrl="/categories">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        {/* Category Header Banner */}
        <div className="bg-gradient-to-r from-[#075C3C] to-[#0F764D] text-white rounded-3xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
              Category
            </span>
            <h1 className="text-lg sm:text-xl font-black">{currentCategory?.name || 'Category'}</h1>
            <span className="text-xs text-emerald-100 font-bold block">{catProducts.length} Products Available</span>
          </div>
          {currentCategory?.image && (
            <div className="w-16 h-16 rounded-2xl bg-white/10 p-2 flex items-center justify-center backdrop-blur-xs">
              <img src={currentCategory.image} alt={currentCategory.name} className="max-w-full max-h-full object-contain drop-shadow-xs" />
            </div>
          )}
        </div>

        {/* Subcategories Horizontal Filter Tabs */}
        {subcategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveSubTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                activeSubTab === 'all'
                  ? 'bg-[#0B8F5A] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
            >
              All Items
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setActiveSubTab(sub.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                  activeSubTab === sub.id
                    ? 'bg-[#0B8F5A] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}

        {/* Sort & Filter Bar */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-2.5 px-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 font-mono">
            Showing {catProducts.length} items
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-1 focus:outline-none focus:border-emerald-500"
            >
              <option value="relevance">Relevance</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>

        {/* Product Cards Grid */}
        {catProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 shadow-xs">
            <p className="text-xs font-bold text-slate-500">No products found in this category.</p>
            <button
              onClick={() => setActiveSubTab('all')}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl"
            >
              View All Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {catProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetail={handleOpenDetail}
              />
            ))}
          </div>
        )}

      </div>
    </CustomerShell>
  );
}
