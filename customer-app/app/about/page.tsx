'use client';

import React from 'react';
import CustomerShell from '../../components/CustomerShell';
import { 
  Zap, 
  ShieldCheck, 
  HeartHandshake, 
  Truck, 
  Store, 
  Award,
  Sparkles,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

export default function AboutPage() {
  return (
    <CustomerShell title="About Us" showBack backUrl="/profile">
      <div className="space-y-5 animate-in fade-in duration-200 pb-20 max-w-md mx-auto">
        
        {/* Brand Hero Card */}
        <div className="bg-gradient-to-b from-[#0B8F5A] via-[#075C3C] to-[#043d27] dark:from-[#0f2e22] dark:via-[#0b2118] dark:to-[#071610] rounded-3xl p-6 text-white text-center shadow-lg relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-[#FEFCE8] text-[#0B8F5A] flex items-center justify-center font-black text-2xl mx-auto mb-3 shadow-md">
            PK
          </div>
          <h1 className="text-2xl font-black tracking-tight">Pocket Kirana</h1>
          <p className="text-xs text-emerald-100 dark:text-emerald-200/80 mt-1 font-medium">
            India&apos;s Fastest 10-Minute Grocery Delivery Service
          </p>
          <span className="inline-block mt-3 bg-emerald-900/50 text-emerald-200 text-[10px] font-black px-3 py-1 rounded-full border border-emerald-400/30">
            Serving Neral &amp; Neighboring Hubs
          </span>
        </div>

        {/* Our Mission */}
        <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-xs">
          <h2 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            Our Mission
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            At Pocket Kirana, we are transforming everyday grocery shopping. We connect certified local farm producers, daily dairy stations, and trusted FMCG brands directly to your doorstep in 10 minutes flat through hyper-local micro-warehouses (Dark Stores).
          </p>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-2xs">
            <Zap className="w-6 h-6 text-amber-500" />
            <h3 className="text-xs font-black text-slate-900 dark:text-white">10-Min Delivery</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Rapid picking from localized dark stores.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-2xs">
            <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-black text-slate-900 dark:text-white">100% Fresh</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Daily sourced fresh vegetables &amp; milk.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-2xs">
            <Award className="w-6 h-6 text-blue-500" />
            <h3 className="text-xs font-black text-slate-900 dark:text-white">Best Prices</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Direct manufacturer discounts &amp; MRP savings.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5 shadow-2xs">
            <HeartHandshake className="w-6 h-6 text-rose-500" />
            <h3 className="text-xs font-black text-slate-900 dark:text-white">Customer First</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Instant returns and 24x7 support desk.
            </p>
          </div>
        </div>

        {/* Dark Store Network */}
        <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Dark Store Network
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Our climate-controlled Dark Store Hubs are strategically located every 2–3 kilometers, ensuring your milk, ice cream, fresh greens, and staples never degrade during transit.
          </p>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 pt-1">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Neral Station Road Hub #1, Maharashtra - 410101</span>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Official Contact
          </h2>
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>+91 8698893348 / 1800-208-1010</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" />
              <span>support@pocketkirana.in</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-400 dark:text-slate-600 font-mono">
          © 2026 Pocket Kirana Technologies Pvt. Ltd. All rights reserved.
        </div>

      </div>
    </CustomerShell>
  );
}
