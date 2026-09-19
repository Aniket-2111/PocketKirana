'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { ProductCard } from '@/components/customer/ProductCard';
import { Search as SearchIcon, X } from 'lucide-react';
import { Product } from '@/types';

export default function SearchPage() {
  const router = useRouter();
  const { products } = useAppStore();
  const [query, setQuery] = useState('');

  // Authoritative store products
  const allProducts = useMemo(() => {
    return (products || []).filter((p) => p.status !== 'discontinued');
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
          <SearchIcon className="w-5 h-5 text-[#008F5A] dark:text-emerald-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search milk, atta, vegetables, snacks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-11 pr-10 py-3 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] rounded-2xl text-[#111827] dark:text-[#F9FAFB] text-xs font-bold placeholder-[#6B7280] dark:placeholder-[#9CA3AF] focus:outline-none focus:border-[#008F5A] dark:focus:border-emerald-500 shadow-2xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#1B2430] flex items-center justify-center text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] absolute right-3 top-3 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results */}
        {query.trim() ? (
          <div className="space-y-3">
            <span className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] block font-mono">
              Found {searchResults.length} items for "{query}"
            </span>

            {searchResults.length === 0 ? (
              <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-8 text-center space-y-2 shadow-xs">
                <p className="text-xs font-bold text-[#374151] dark:text-[#D1D5DB]">No matching products found.</p>
                <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">Try searching for "Milk", "Atta", "Ghee", "Bread", or "Biscuits"</span>
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
            <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] block">Popular Searches:</span>
            <div className="flex flex-wrap gap-2">
              {['Milk', 'Aashirvaad Atta', 'Paneer', 'Fortune Oil', 'Eggs', 'Amul Butter', 'Biscuits', 'Maggi'].map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="px-3 py-1.5 bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] hover:border-[#008F5A] dark:hover:border-[#008F5A] rounded-xl text-xs font-bold text-[#374151] dark:text-[#D1D5DB] hover:text-[#008F5A] dark:hover:text-emerald-400 shadow-2xs transition-all cursor-pointer"
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
