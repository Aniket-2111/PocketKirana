'use client';

import React from 'react';
import Link from 'next/link';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { ProductCard } from '@/components/customer/ProductCard';
import { useAppStore } from '@/lib/store';
import { Zap, Clock, ShieldCheck, ArrowRight, Flame } from 'lucide-react';

export default function ExpressPage() {
  const { products } = useAppStore();

  const expressProducts = products.filter((p) => p.status === 'active').slice(0, 8);

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
          
          {/* Top Banner: 8-Min Express Guarantee */}
          <div className="bg-gradient-to-r from-[#006E2F] via-emerald-600 to-[#416900] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl z-10">
              <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-900 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                <Zap className="w-4 h-4 text-gray-900 fill-current" />
                <span>PocketKirana Express ⚡</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                Superfast 8-Minute Grocery Delivery
              </h1>
              <p className="text-emerald-100 text-xs sm:text-sm font-medium leading-relaxed">
                Need groceries immediately? Order from our instant express hub. Fresh vegetables, dairy, bread, and snacks delivered in 8 minutes guaranteed.
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs font-extrabold">
                <span className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                  <Clock className="w-4 h-4 text-amber-300" /> Average: 7.4 Mins
                </span>
                <span className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                  <ShieldCheck className="w-4 h-4 text-emerald-300" /> Free Shipping &gt; ₹99
                </span>
              </div>
            </div>

            <div className="shrink-0 z-10 flex flex-col items-center justify-center bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 text-center w-full md:w-56">
              <span className="text-4xl font-black text-amber-400">8 MIN</span>
              <span className="text-xs font-bold text-white uppercase tracking-wider mt-1">Delivery Time</span>
              <div className="mt-3 w-full bg-amber-400 text-gray-900 font-extrabold text-xs py-2 rounded-xl text-center shadow-md">
                Hub Active
              </div>
            </div>

            {/* Background Decorative Blur */}
            <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl" />
          </div>

          {/* Flash Deals Row */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">
                <Flame className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">Express Deals in 8 Mins</h2>
                <p className="text-xs text-gray-500 font-medium">Items packed and dispatched instantly</p>
              </div>
            </div>
            <Link
              href="/categories"
              className="text-xs font-black text-[#006E2F] hover:underline flex items-center gap-1"
            >
              <span>View All Categories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {expressProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

        </div>
      </CustomerLayout>
    </>
  );
}
