'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Search } from 'lucide-react';

const BRANDS = [
  {
    slug: 'amul',
    name: 'Amul',
    tagline: 'The Taste of India',
    description: 'India\'s largest dairy cooperative, delivering fresh milk, butter, cheese, curd and ice cream.',
    logo: '🥛',
    color: 'from-red-50 to-orange-50 border-red-200',
    textColor: 'text-red-700',
    productCount: 6,
    categories: ['Dairy'],
  },
  {
    slug: 'aashirvaad',
    name: 'Aashirvaad',
    tagline: 'Nature\'s Finest',
    description: 'Premium quality atta, spices, and staples for your daily kitchen needs.',
    logo: '🌾',
    color: 'from-amber-50 to-yellow-50 border-amber-200',
    textColor: 'text-amber-700',
    productCount: 2,
    categories: ['Atta, Rice & Dal'],
  },
  {
    slug: 'britannia',
    name: 'Britannia',
    tagline: 'Eat Healthy, Think Better',
    description: 'Loved for biscuits, breads, cakes and dairy products across generations.',
    logo: '🍞',
    color: 'from-blue-50 to-indigo-50 border-blue-200',
    textColor: 'text-blue-700',
    productCount: 1,
    categories: ['Dairy, Bread & Eggs'],
  },
  {
    slug: 'coca-cola',
    name: 'Coca-Cola',
    tagline: 'Refreshing the World',
    description: 'The world\'s most loved beverages — Coca-Cola, Sprite, Fanta, Thums Up and more.',
    logo: '🥤',
    color: 'from-red-50 to-pink-50 border-red-200',
    textColor: 'text-red-700',
    productCount: 2,
    categories: ['Cold Drinks & Juices'],
  },
  {
    slug: 'lays',
    name: 'Lay\'s',
    tagline: 'Betcha Can\'t Eat Just One',
    description: 'India\'s favourite crispy potato chips in irresistible flavours.',
    logo: '🥔',
    color: 'from-yellow-50 to-lime-50 border-yellow-200',
    textColor: 'text-yellow-700',
    productCount: 1,
    categories: ['Snacks & Munchies'],
  },
  {
    slug: 'haldiram',
    name: 'Haldiram',
    tagline: 'Traditional Indian Taste',
    description: 'Iconic Indian namkeen, sweets and ready-to-eat snacks loved across India.',
    logo: '🌶️',
    color: 'from-orange-50 to-red-50 border-orange-200',
    textColor: 'text-orange-700',
    productCount: 1,
    categories: ['Snacks & Munchies'],
  },
  {
    slug: 'tropicana',
    name: 'Tropicana',
    tagline: 'Straight from Nature',
    description: 'Premium 100% fruit juices with no added sugar or preservatives.',
    logo: '🍊',
    color: 'from-orange-50 to-amber-50 border-orange-200',
    textColor: 'text-orange-700',
    productCount: 1,
    categories: ['Cold Drinks & Juices'],
  },
  {
    slug: 'cadbury',
    name: 'Cadbury',
    tagline: 'Generosity Tastes Good',
    description: 'Premium chocolates, biscuits and sweet treats for every occasion.',
    logo: '🍫',
    color: 'from-purple-50 to-violet-50 border-purple-200',
    textColor: 'text-purple-700',
    productCount: 1,
    categories: ['Sweet Tooth & Bakery'],
  },
];

export default function BrandsPage() {
  const [query, setQuery] = useState('');

  const filtered = BRANDS.filter(
    (b) =>
      b.name.toLowerCase().includes(query.toLowerCase()) ||
      b.categories.some((c) => c.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
          <Breadcrumb items={[{ label: 'All Brands' }]} />

          <div className="text-center">
            <h1 className="text-3xl font-black text-gray-900">Our Brand Partners</h1>
            <p className="text-sm text-gray-500 mt-2">
              Shop your favourite trusted brands — all delivered in 8 minutes
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brands..."
              className="w-full border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500 bg-white shadow-sm"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Brands Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((brand) => (
              <Link
                key={brand.slug}
                href={`/brand/${brand.slug}`}
                className={`group block bg-gradient-to-br ${brand.color} border rounded-3xl p-5 hover:shadow-lg transition-all hover:-translate-y-0.5`}
              >
                <div className="text-4xl mb-3">{brand.logo}</div>
                <h2 className={`text-lg font-black ${brand.textColor}`}>{brand.name}</h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{brand.tagline}</p>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-2">{brand.description}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-gray-500">{brand.productCount} products</span>
                  <span className={`text-xs font-black ${brand.textColor} group-hover:underline`}>
                    Shop →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No brands found for &quot;{query}&quot;
            </div>
          )}
        </div>
      </CustomerLayout>
    </>
  );
}
