'use client';

import React from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { INITIAL_CATEGORIES } from '@/lib/mockData';

export const Footer: React.FC = () => {
  const { categories } = useAppStore();
  const rawCategories = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
  
  // Show only available / active root categories
  const availableCategories = rawCategories.filter(
    (c) => !c.parentId && c.isActive !== false
  );

  return (
    <footer className="bg-white dark:bg-[#111827] border-t border-slate-200 dark:border-[#263241] text-slate-600 dark:text-slate-300 pt-12 pb-28 md:pb-12 mt-12 font-sans transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── MAIN FOOTER GRID (Brand, 2-Column Categories, About & Help) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-12 border-b border-slate-200 dark:border-[#263241]">
          
          {/* Column 1: Brand Info & Contact */}
          <div className="lg:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0B8F5A] to-[#075C3C] text-white flex items-center justify-center font-black text-xl shadow-xs">
                PK
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-[#075C3C] dark:text-emerald-400 leading-none">
                  Pocket<span className="text-[#0B8F5A] dark:text-emerald-500">Kirana</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wide mt-0.5">
                  Fresh Grocery Hub
                </span>
              </div>
            </Link>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your trusted 30 minute neighborhood grocery darkstore. Farm-fresh vegetables, dairy, atta, snacks, and daily essentials.
            </p>

            <div className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#075C3C] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#075C3C] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span className="truncate">support@pocketkirana.com</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#075C3C] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Neral DarkStore Hub, Maharashtra</span>
              </div>
            </div>
          </div>

          {/* Column 2 & 3: Expanded Dynamic Categories on Two Columns/Lines */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-black uppercase text-[#075C3C] dark:text-emerald-400 tracking-wider mb-4">
              Categories
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {availableCategories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="hover:text-[#075C3C] dark:hover:text-emerald-400 transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li className="sm:col-span-2 pt-1">
                <Link href="/categories" className="text-[#075C3C] dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1">
                  View All Categories &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: About & Help */}
          <div className="lg:col-span-1">
            <h3 className="text-xs font-black uppercase text-[#075C3C] dark:text-emerald-400 tracking-wider mb-4">
              About &amp; Help
            </h3>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <li><Link href="/about" className="hover:text-[#075C3C] dark:hover:text-emerald-400 transition-colors">About Us</Link></li>
              <li><Link href="/faq" className="hover:text-[#075C3C] dark:hover:text-emerald-400 transition-colors">Frequently Asked Questions</Link></li>
              <li><Link href="/terms" className="hover:text-[#075C3C] dark:hover:text-emerald-400 transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-[#075C3C] dark:hover:text-emerald-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/refund-policy" className="hover:text-[#075C3C] dark:hover:text-emerald-400 transition-colors">Shipping &amp; Returns</Link></li>
              <li><Link href="/contact" className="hover:text-[#075C3C] dark:hover:text-emerald-400 transition-colors">Partner with Us</Link></li>
            </ul>
          </div>

        </div>

        {/* ── BOTTOM COPYRIGHT & PAYMENT METHODS ── */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:text-slate-500 font-medium">
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} PocketKirana DarkStore Technologies. All rights reserved.
          </p>

          {/* Payment Method Badges (Consistent neutral badge system) */}
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold text-slate-600 dark:text-slate-300">
            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">UPI</span>
            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">VISA</span>
            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">MASTERCARD</span>
            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">RUPAY</span>
            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">
              CASH ON DELIVERY
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
