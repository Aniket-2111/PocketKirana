'use client';

import React from 'react';
import { Truck, ShieldCheck, Tag, Lock, Sparkles, RefreshCw } from 'lucide-react';

export const ServiceBenefits: React.FC = () => {
  const benefits = [
    {
      icon: Truck,
      title: '30 Min Express Delivery',
      description: 'Lightning-fast delivery from your local PocketKirana darkstore.',
      bg: 'bg-emerald-50',
      iconColor: 'text-[#0B8F5A]',
      border: 'border-emerald-100',
    },
    {
      icon: ShieldCheck,
      title: '100% Quality Guaranteed',
      description: 'Handpicked fresh vegetables, authentic branded pantry staples.',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-700',
      border: 'border-amber-100',
    },
    {
      icon: Tag,
      title: 'Daily Best Market Deals',
      description: 'Wholesale mandi rates and exclusive cashback offers on everyday carts.',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      border: 'border-blue-100',
    },
    {
      icon: Lock,
      title: 'Safe OTP Handover',
      description: 'Secure, contactless payment and live real-time rider tracking.',
      bg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      border: 'border-purple-100',
    },
  ];

  return (
    <section className="my-10 bg-white dark:bg-[#151B23] border border-slate-200/80 dark:border-[#263241] rounded-3xl p-6 sm:p-8 shadow-xs transition-colors duration-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {benefits.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="flex items-start gap-4 text-left">
              <div
                className={`w-12 h-12 rounded-2xl ${item.bg} dark:bg-[#1B2430] ${item.iconColor} ${item.border} dark:border-[#263241] border flex items-center justify-center shrink-0 shadow-2xs`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-[#075C3C] dark:text-emerald-400 leading-snug">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
