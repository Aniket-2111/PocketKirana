'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ProductCard } from '@/components/customer/ProductCard';
import { Tag, Zap, CreditCard, Sparkles, ShoppingBag } from 'lucide-react';

export default function OffersPage() {
  const router = useRouter();
  const { products, addToCart } = useAppStore();

  const discountedProducts = products
    .filter((p) => p.mrp > p.sellingPrice)
    .sort((a, b) => (b.mrp - b.sellingPrice) - (a.mrp - a.sellingPrice));

  const comboDeals = [
    {
      id: 'combo-1',
      name: 'Breakfast Super Saver Combo',
      desc: 'Amul Taaza Milk 500ml + Britannia Bread 400g + Farm Eggs 6pcs',
      price: 135,
      mrp: 170,
      image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'combo-2',
      name: 'Tea Time Munchies Combo',
      desc: 'Lays Classic Chips + Britannia Good Day Cookies + Real Orange Juice',
      price: 199,
      mrp: 260,
      image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'combo-3',
      name: 'Home Care Cleaning Bundle',
      desc: 'Surf Excel Detergent 1kg + Vim Dishwash Liquid + Lizol Floor Cleaner',
      price: 299,
      mrp: 410,
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
    },
  ];

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
          <Breadcrumb items={[{ label: 'Offers & Deals' }]} />

          {/* ── HERO BANNER (Matching Screen 6) ── */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-amber-500 via-orange-600 to-amber-700 text-white p-8 md:p-12 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 max-w-lg z-10">
              <span className="bg-white text-amber-900 font-black text-xs px-3.5 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-4 h-4 text-amber-500 fill-current" /> EXCLUSIVE DEALS
              </span>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none">
                50% OFF <span className="text-amber-200">On Daily Essentials</span>
              </h1>
              <p className="text-xs md:text-sm font-medium text-amber-100">
                Unlock huge savings on fresh vegetables, milk, cooking oils, snacks, and household essentials today.
              </p>
              <button
                onClick={() => {
                  const el = document.getElementById('todays-deals');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-[#0F532B] hover:bg-[#0B3E20] text-white font-black text-xs md:text-sm px-7 py-3 rounded-full shadow-md transition-all active:scale-95 inline-flex items-center gap-2"
              >
                Shop Now <Tag className="w-4 h-4" />
              </button>
            </div>

            <div className="w-72 h-44 shrink-0 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
              <img
                src="https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80"
                alt="Offers Banner"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* ── SECTION 1: TODAY'S DEALS (Screen 6) ── */}
          <div id="todays-deals" className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                Today's Best Deals
              </h2>
              <span className="text-xs text-gray-500 font-bold">{discountedProducts.length} Offers Available</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {discountedProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onOpenDetail={(p) => router.push(`/product/${p.slug}`)}
                />
              ))}
            </div>
          </div>

          {/* ── SECTION 2: COMBO DEALS (Screen 6) ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#0F532B]" />
                Super Saver Combo Deals
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {comboDeals.map((c) => (
                <div key={c.id} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                  <div className="flex items-center gap-4">
                    <img src={c.image} alt={c.name} className="w-20 h-20 object-cover rounded-2xl border p-1" />
                    <div>
                      <span className="bg-emerald-100 text-[#0F532B] font-bold text-[10px] uppercase px-2 py-0.5 rounded-full">Save ₹{c.mrp - c.price}</span>
                      <h3 className="font-extrabold text-sm text-gray-900 mt-1">{c.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{c.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <div>
                      <span className="text-base font-black text-gray-900">₹{c.price}</span>
                      <span className="text-xs text-gray-400 line-through ml-2">₹{c.mrp}</span>
                    </div>

                    <button
                      onClick={() => {
                        addToCart(products[0], 1);
                      }}
                      className="bg-[#0F532B] hover:bg-[#0B3E20] text-white font-bold text-xs px-4 py-2 rounded-xl"
                    >
                      ADD COMBO
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 3: BANK & PAYMENT OFFERS (Screen 6) ── */}
          <div className="space-y-4">
            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Bank & Payment Offers
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-4 text-xs">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                  SBI
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-sm">10% Instant Discount on SBI Cards</h4>
                  <p className="text-gray-600 mt-0.5">Use code <strong>SBISAVER</strong> on orders above ₹799.</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-4 text-xs">
                <div className="w-12 h-12 rounded-xl bg-[#0F532B] text-white font-black text-sm flex items-center justify-center shrink-0">
                  UPI
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-sm">Flat ₹50 Cashback on UPI Transactions</h4>
                  <p className="text-gray-600 mt-0.5">Pay via Google Pay, PhonePe or Paytm on orders above ₹399.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </CustomerLayout>
    </>
  );
}
