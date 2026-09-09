'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { ProductCard } from '@/components/customer/ProductCard';
import { Product, Category } from '@/types';
import {
  ChevronRight,
  Filter,
  Sparkles,
  Layers,
  SlidersHorizontal,
  FolderOpen,
  ArrowLeft,
} from 'lucide-react';

type SortKey = 'relevance' | 'price-low' | 'price-high' | 'rating' | 'discount';

export default function DedicatedSubcategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slugParam = (params?.slug as string) || 'fruits-vegetables';
  const subSlugParam = (params?.subSlug as string) || '';

  const { categories, products } = useAppStore();
  const [sortBy, setSortBy] = useState<SortKey>('relevance');

  // Top-level active categories
  const activeTopCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parentId && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [categories]);

  // Current category from database
  const currentCategory: Category = useMemo(() => {
    const found = activeTopCategories.find(
      (c) => c.slug === slugParam || c.id === slugParam
    );
    return (
      found ||
      activeTopCategories[0] || {
        id: 'cat-default',
        name: 'All Groceries',
        slug: 'all-groceries',
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80',
        sortOrder: 1,
        displayOrder: 1,
        isActive: true,
      }
    );
  }, [activeTopCategories, slugParam]);

  // Dynamic subcategories under this parent category
  const dynamicSubcategories: Category[] = useMemo(() => {
    return categories
      .filter((c) => c.parentId === currentCategory.id && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [categories, currentCategory.id]);

  // Current subcategory
  const currentSubcategory = useMemo(() => {
    return dynamicSubcategories.find((s) => s.slug === subSlugParam || s.id === subSlugParam) || dynamicSubcategories[0];
  }, [dynamicSubcategories, subSlugParam]);

  // Dynamically filter products for this subcategory
  const filteredProducts = useMemo(() => {
    if (!currentSubcategory) return [];

    let list = products.filter((p) => {
      if (p.subcategoryId === currentSubcategory.id || p.subcategoryId === currentSubcategory.slug) {
        return true;
      }
      if (p.categoryId === currentCategory.id) {
        const sName = currentSubcategory.name.toLowerCase();
        const pName = p.name.toLowerCase();
        const pDesc = (p.description || '').toLowerCase();
        return pName.includes(sName) || pDesc.includes(sName);
      }
      return false;
    });

    // Apply Sorting
    switch (sortBy) {
      case 'price-low':
        return [...list].sort((a, b) => a.sellingPrice - b.sellingPrice);
      case 'price-high':
        return [...list].sort((a, b) => b.sellingPrice - a.sellingPrice);
      case 'rating':
        return [...list].sort((a, b) => b.rating - a.rating);
      case 'discount':
        return [...list].sort((a, b) => {
          const discA = a.mrp > a.sellingPrice ? (a.mrp - a.sellingPrice) / a.mrp : 0;
          const discB = b.mrp > b.sellingPrice ? (b.mrp - b.sellingPrice) / b.mrp : 0;
          return discB - discA;
        });
      default:
        return [...list].sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));
    }
  }, [products, currentCategory, currentSubcategory, sortBy]);

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-5">
          {/* ── BREADCRUMB PATH ── */}
          <nav className="flex items-center gap-2 text-xs font-bold text-slate-500 overflow-x-auto no-scrollbar scrollbar-none">
            <Link href="/" className="hover:text-emerald-700 transition-colors shrink-0">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <Link href={`/category/${currentCategory.slug}`} className="hover:text-emerald-700 transition-colors shrink-0">
              {currentCategory.name}
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-emerald-700 font-black shrink-0">
              {currentSubcategory?.name || 'Subcategory'}
            </span>
          </nav>

          {/* ── SIBLING SUBCATEGORIES PILLS ── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-2.5 shadow-2xs">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 px-0.5">
              <Link
                href={`/category/${currentCategory.slug}`}
                className="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 border bg-slate-50 text-slate-700 hover:bg-white border-slate-200"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All {currentCategory.name}</span>
              </Link>

              {dynamicSubcategories.map((sub) => {
                const isSelected = sub.id === currentSubcategory?.id || sub.slug === subSlugParam;
                return (
                  <Link
                    key={sub.id}
                    href={`/category/${currentCategory.slug}/${sub.slug}`}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    {sub.image && (
                      <img src={sub.image} alt={sub.name} className="w-3.5 h-3.5 object-contain rounded-xs" />
                    )}
                    <span>{sub.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── HEADER ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {currentSubcategory?.name || currentCategory.name}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} in{' '}
                {currentCategory.name} / {currentSubcategory?.name}
              </p>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-600">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="bg-white border border-slate-200 rounded-xl text-xs font-bold px-3 py-1.5 text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs"
              >
                <option value="relevance">Popularity</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="discount">Highest Savings</option>
              </select>
            </div>
          </div>

          {/* ── PRODUCT GRID ── */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-2xs">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900">No products found in this subcategory</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No products are currently assigned to &ldquo;{currentSubcategory?.name}&rdquo;.
              </p>
              <Link
                href={`/category/${currentCategory.slug}`}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-2xs inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to {currentCategory.name}</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpenDetail={(p) => router.push(`/product/${p.slug}`)}
                />
              ))}
            </div>
          )}
        </div>
      </CustomerLayout>
    </>
  );
}
