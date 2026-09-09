'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { ProductCard } from '@/components/customer/ProductCard';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
import { Search as SearchIcon, X } from 'lucide-react';
import { Product } from '@/types';

export default function SearchPage() {
  const router = useRouter();
  const { products } = useAppStore();
  const [query, setQuery] = useState('');

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

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allProducts.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brandName || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        ((p as any).category || '').toLowerCase().includes(q)
      );
    });
  }, [allProducts, query]);

  const handleOpenDetail = (product: Product) => {
    router.push(`/product/${product.id || product.slug}`);
  };

  return (
    <CustomerShell title="Search Products" showBack backUrl="/">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        {/* Search Input */}
        <div className="relative">
          <SearchIcon className="w-5 h-5 text-[#0B8F5A] absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search milk, atta, vegetables, snacks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 text-xs font-bold placeholder-slate-400 focus:outline-none focus:border-[#0B8F5A] shadow-2xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 absolute right-3 top-3 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results */}
        {query.trim() ? (
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 block font-mono">
              Found {searchResults.length} items for "{query}"
            </span>

            {searchResults.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-2 shadow-xs">
                <p className="text-xs font-bold text-slate-600">No matching products found.</p>
                <span className="text-[11px] text-slate-400">Try searching for "Milk", "Atta", "Ghee", "Bread", or "Biscuits"</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {searchResults.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpenDetail={handleOpenDetail}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-black text-slate-700 block">Popular Searches:</span>
            <div className="flex flex-wrap gap-2">
              {['Milk', 'Aashirvaad Atta', 'Paneer', 'Fortune Oil', 'Eggs', 'Amul Butter', 'Biscuits', 'Maggi'].map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#0B8F5A] rounded-xl text-xs font-bold text-slate-700 hover:text-[#0B8F5A] shadow-2xs transition-all cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </CustomerShell>
  );
}
