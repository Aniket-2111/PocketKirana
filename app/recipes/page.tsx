'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { RECIPES } from '@/lib/recipes';
import { Clock, Users, ChefHat, Search } from 'lucide-react';

const CATEGORIES = ['All', ...Array.from(new Set(RECIPES.map((r) => r.category)))];
const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];

export default function RecipesPage() {
  const [query, setQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const [selectedDiff, setSelectedDiff] = useState('All');

  const filtered = RECIPES.filter((r) => {
    const inQuery =
      !query.trim() ||
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.tags.some((t) => t.includes(query.toLowerCase()));
    const inCat = selectedCat === 'All' || r.category === selectedCat;
    const inDiff = selectedDiff === 'All' || r.difficulty === selectedDiff;
    return inQuery && inCat && inDiff;
  });

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 space-y-8">
          <Breadcrumb items={[{ label: 'Recipes' }]} />

          {/* Hero */}
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-3xl font-black text-gray-900">Recipes & Inspiration</h1>
            <p className="text-sm text-gray-500 mt-2">
              Discover delicious recipes using ingredients from PocketKirana — delivered fresh to your door.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes..."
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500 bg-gray-50"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCat(c)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    selectedCat === c
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {c}
                </button>
              ))}
              <div className="w-px bg-gray-200 mx-1 self-stretch" />
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDiff(d)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    selectedDiff === d
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Recipe Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              No recipes found for your filters. Try different keywords.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((recipe) => (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.slug}`}
                  className="group bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={recipe.image}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        recipe.difficulty === 'Easy'
                          ? 'bg-emerald-100 text-emerald-700'
                          : recipe.difficulty === 'Medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {recipe.difficulty}
                      </span>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase">
                        {recipe.category}
                      </span>
                    </div>
                    <div>
                      <h2 className="font-black text-gray-900 text-base leading-snug group-hover:text-emerald-700 transition-colors">
                        {recipe.title}
                      </h2>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{recipe.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {recipe.prepTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {recipe.cookTime} cook
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Serves {recipe.servings}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CustomerLayout>
    </>
  );
}
