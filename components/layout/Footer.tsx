'use client';

import React from 'react';
import Link from 'next/link';
import {
  Phone,
  Mail,
  MapPin,
  Send,
  CreditCard,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

export const Footer: React.FC = () => {
  const { categories } = useAppStore();
  const topCategories = (categories || [])
    .filter((c) => !c.parentId && c.isActive !== false)
    .slice(0, 6);

  return (
    <footer className="bg-white border-t border-slate-200 text-slate-600 pt-12 pb-8 mt-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── MAIN 5-COLUMN FOOTER GRID (Matching Reference Style) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-12 border-b border-slate-200">
          
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

          {/* Column 2: Top Service Hubs (Matching Reference "TOP CITIES") */}
          <div>
            <h4 className="text-xs font-black uppercase text-[#075C3C] tracking-wider mb-4">
              Service Hubs
            </h4>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-600">
              <li className="hover:text-[#0B8F5A] transition-colors cursor-pointer">Neral Central</li>
              <li className="hover:text-[#0B8F5A] transition-colors cursor-pointer">Karjat Station</li>
              <li className="hover:text-[#0B8F5A] transition-colors cursor-pointer">Badlapur West</li>
              <li className="hover:text-[#0B8F5A] transition-colors cursor-pointer">Ambernath Hub</li>
              <li className="hover:text-[#0B8F5A] transition-colors cursor-pointer">Kalyan East Express</li>
              <li className="hover:text-[#0B8F5A] transition-colors cursor-pointer">Matheran Foothills</li>
            </ul>
          </div>

          {/* Column 3: Dynamic Categories (Matching Reference "CATEGORIES") */}
          <div>
            <h4 className="text-xs font-black uppercase text-[#075C3C] tracking-wider mb-4">
              Categories
            </h4>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-600">
              {topCategories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="hover:text-[#0B8F5A] transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/categories" className="text-[#0B8F5A] font-bold hover:underline">
                  View All Categories &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: About & Information (Matching Reference "ABOUT US") */}
          <div>
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

          {/* Column 5: Download App & Newsletter (Matching Reference "Download App") */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase text-[#075C3C] tracking-wider">
              Download App
            </h4>
            
            <div className="flex flex-col gap-2">
              {/* Google Play Button */}
              <button
                type="button"
                className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-left transition-colors cursor-pointer w-full max-w-[170px]"
              >
                <div className="w-5 h-5 flex items-center justify-center font-bold text-emerald-400">
                  ▶
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase leading-none">Get it on</span>
                  <span className="text-xs font-black text-white leading-tight">Google Play</span>
                </div>
              </button>

              {/* App Store Button */}
              <button
                type="button"
                className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-left transition-colors cursor-pointer w-full max-w-[170px]"
              >
                <div className="w-5 h-5 flex items-center justify-center font-bold text-white">
                  
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase leading-none">Download on</span>
                  <span className="text-xs font-black text-white leading-tight">App Store</span>
                </div>
              </button>
            </div>

            {/* Newsletter Subscription */}
            <div className="pt-2">
              <p className="text-[11px] font-bold text-slate-700 mb-1.5">
                Get Weekly Deals &amp; Discounts
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="email"
                  suppressHydrationWarning
                  placeholder="Enter email address"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0B8F5A]"
                />
                <button
                  type="button"
                  className="bg-[#0B8F5A] hover:bg-[#075C3C] text-white p-2.5 rounded-xl transition-colors shrink-0 cursor-pointer shadow-2xs"
                  title="Subscribe"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
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
