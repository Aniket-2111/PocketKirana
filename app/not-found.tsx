'use client';

import React from 'react';
import Link from 'next/link';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { ShoppingBasket, Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="min-h-[70vh] flex items-center justify-center py-16 px-4">
          <div className="max-w-md w-full text-center space-y-6 bg-white p-8 md:p-12 rounded-3xl border border-gray-200 shadow-sm">
            {/* Basket Graphic Illustration (Screen 17) */}
            <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center shadow-inner">
                <ShoppingBasket className="w-16 h-16 text-[#0F532B]" />
              </div>
              <span className="absolute bottom-2 right-2 bg-amber-400 text-gray-950 font-black text-xs px-2.5 py-1 rounded-full shadow">
                404
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-3xl font-black text-gray-900 tracking-tight block">Oops!</span>
              <h1 className="text-xl font-black text-gray-900">This page is out of stock.</h1>
              <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-[#0F532B] hover:bg-[#0B3E20] text-white font-black text-xs px-8 py-3.5 rounded-full shadow-md transition-all active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>GO TO HOME</span>
              </Link>
            </div>
          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
