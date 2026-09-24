'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Search } from 'lucide-react';
import { NoSearchResults, EmptyState, ProductImageWithFallback } from '@/components/states';

const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  'fruits-vegetables': { bg: 'bg-[#EEF7F1]', border: 'border-[#53B175]/40' },
  'staples': { bg: 'bg-[#FDF6EA]', border: 'border-[#F7A593]/40' },
  'meat-fish': { bg: 'bg-[#FDE8E4]', border: 'border-[#F7A593]/60' },
  'bakery-biscuits': { bg: 'bg-[#F4EBF7]', border: 'border-[#D3B0E0]/60' },
  'dairy-breakfast': { bg: 'bg-[#FFF9E5]', border: 'border-[#FDE598]/80' },
  'beverages': { bg: 'bg-[#EDF7FC]', border: 'border-[#B7DFF5]/80' },
  'snacks-munchies': { bg: 'bg-[#FDF6EA]', border: 'border-[#F7A593]/40' },
  'personal-care': { bg: 'bg-[#F4EBF7]', border: 'border-[#D3B0E0]/60' },
  'household': { bg: 'bg-[#EEF7F1]', border: 'border-[#53B175]/40' },
};

export default function FindProductsPage() {
  const { categories } = useAppStore();
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const filteredCategories = (categories || [])
    .filter(
      (c) => c && !c.parentId && c.isActive !== false && c.name && c.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          
          {/* Header Title (Matching Mockup 3) */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Find Products
            </h1>
          </div>

          {/* Search Store Bar */}
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              placeholder="Search Store"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-100/90 border border-transparent focus:border-[#53B175] focus:bg-white text-gray-900 placeholder-gray-400 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold focus:outline-none transition-all shadow-2xs"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          </div>

          {/* 2-Column Vibrant Pastel Cards Grid (Matching Mockup 3) */}
          {filteredCategories.length === 0 ? (
            search.trim() ? (
              <NoSearchResults
                query={search}
                onClearSearch={() => setSearch('')}
                onSelectSuggestion={(kw: string) => setSearch(kw)}
              />
            ) : (
              <EmptyState
                type="custom"
                title="No Categories Available"
                description="Categories are currently being updated. Please check back shortly."
                primaryAction={{
                  label: "Return Home",
                  onClick: () => window.location.assign('/'),
                }}
              />
            )
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 pt-2">
              {filteredCategories.map((cat, idx) => {
                const theme = CATEGORY_COLORS[cat.slug] || {
                  bg: idx % 2 === 0 ? 'bg-[#EEF7F1]' : 'bg-[#FFF9E5]',
                  border: 'border-gray-200',
                };

                return (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className={`${theme.bg} ${theme.border} border rounded-3xl p-5 flex flex-col items-center justify-between text-center min-h-[190px] sm:min-h-[210px] hover:scale-[1.02] hover:shadow-md transition-all group cursor-pointer`}
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-200">
                      <ProductImageWithFallback
                        src={cat.image}
                        alt={cat.name}
                        className="max-w-full max-h-full object-contain rounded-xl drop-shadow-xs"
                      />
                    </div>

                    <h3 className="font-black text-sm sm:text-base text-gray-900 leading-tight tracking-tight mt-2 line-clamp-2">
                      {cat.name}
                    </h3>
                  </Link>
                );
              })}
            </div>
          )}

        </div>
      </CustomerLayout>
    </>
  );
}
