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
    <footer className="bg-white border-t border-slate-200 text-slate-600 pt-12 pb-28 md:pb-12 mt-12 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── MAIN FOOTER GRID (Brand, 2-Column Categories, About & Help) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-12 border-b border-slate-200">
          
          {/* Column 1: Brand Info & Contact */}
          <div className="lg:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0B8F5A] to-[#075C3C] text-white flex items-center justify-center font-black text-xl shadow-xs">
                PK
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-[#075C3C] leading-none">
                  Pocket<span className="text-[#0B8F5A]">Kirana</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">
                  Fresh Grocery Hub
                </span>
              </div>
            </Link>

            <p className="text-xs text-slate-500 leading-relaxed">
              Your trusted 10-15 minute neighborhood grocery darkstore. Farm-fresh vegetables, dairy, atta, snacks, and daily essentials.
            </p>

            <div className="space-y-2 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#0B8F5A] shrink-0" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#0B8F5A] shrink-0" />
                <span className="truncate">support@pocketkirana.com</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#0B8F5A] shrink-0" />
                <span>Neral DarkStore Hub, Maharashtra</span>
              </div>
            </div>
          </div>

          {/* Column 2 & 3: Expanded Dynamic Categories on Two Columns/Lines */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-black uppercase text-[#075C3C] tracking-wider mb-4">
              Categories
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs font-semibold text-slate-600">
              {availableCategories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="hover:text-[#0B8F5A] transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li className="sm:col-span-2 pt-1">
                <Link href="/categories" className="text-[#0B8F5A] font-bold hover:underline inline-flex items-center gap-1">
                  View All Categories &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: About & Help */}
          <div className="lg:col-span-1">
            <h4 className="text-xs font-black uppercase text-[#075C3C] tracking-wider mb-4">
              About &amp; Help
            </h4>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-600">
              <li><Link href="/about" className="hover:text-[#0B8F5A] transition-colors">About Us</Link></li>
              <li><Link href="/faq" className="hover:text-[#0B8F5A] transition-colors">Frequently Asked Questions</Link></li>
              <li><Link href="/terms" className="hover:text-[#0B8F5A] transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-[#0B8F5A] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/refund-policy" className="hover:text-[#0B8F5A] transition-colors">Shipping &amp; Returns</Link></li>
              <li><Link href="/contact" className="hover:text-[#0B8F5A] transition-colors">Partner with Us</Link></li>
            </ul>
          </div>

        </div>

        {/* ── BOTTOM COPYRIGHT & PAYMENT METHODS ── */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} PocketKirana DarkStore Technologies. All rights reserved.
          </p>

          {/* Payment Method Badges (Matching Reference Bottom Bar) */}
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-black text-slate-600">
            <span className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">UPI</span>
            <span className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">VISA</span>
            <span className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">MASTERCARD</span>
            <span className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">RUPAY</span>
            <span className="bg-[#E6F4EA] text-[#0B8F5A] border border-[#0B8F5A]/20 px-2 py-1 rounded-md">
              CASH ON DELIVERY
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
