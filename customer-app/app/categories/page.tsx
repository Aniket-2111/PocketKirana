'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { INITIAL_CATEGORIES } from '@/lib/mockData';
import { Search } from 'lucide-react';

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

export default function CategoriesPage() {
  const { categories } = useAppStore();
  const [search, setSearch] = useState('');

  const allCategories = useMemo(() => {
    const list = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
    return list
      .filter((c) => c && !c.parentId && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return allCategories;
    const q = search.toLowerCase();
    return allCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCategories, search]);

  return (
    <CustomerShell title="All Categories" showBack backUrl="/">
      <div className="space-y-4 animate-in fade-in duration-200">
        
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search Categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-100 border border-transparent focus:border-[#53B175] focus:bg-white text-slate-900 placeholder-slate-400 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold focus:outline-none transition-all shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        </div>

        {/* 2-Column Vibrant Pastel Cards Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {filteredCategories.map((cat, idx) => {
            const theme = CATEGORY_COLORS[cat.slug] || {
              bg: idx % 2 === 0 ? 'bg-[#EEF7F1]' : 'bg-[#FFF9E5]',
              border: 'border-slate-200',
            };

            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug || cat.id}`}
                className={`${theme.bg} ${theme.border} border rounded-3xl p-4 flex flex-col items-center justify-between text-center min-h-[170px] hover:scale-[1.02] hover:shadow-md transition-all group cursor-pointer`}
              >
                <div className="w-20 h-20 flex items-center justify-center p-1 group-hover:scale-105 transition-transform duration-200">
                  <img
                    src={cat.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80'}
                    alt={cat.name}
                    loading="lazy"
                    decoding="async"
                    className="max-w-full max-h-full object-contain rounded-xl drop-shadow-2xs"
                  />
                </div>

                <h3 className="font-black text-xs sm:text-sm text-slate-900 leading-tight tracking-tight mt-2 line-clamp-2">
                  {cat.name}
                </h3>
              </Link>
            );
          })}
        </div>
      </div>
    </CustomerShell>
  );
}
