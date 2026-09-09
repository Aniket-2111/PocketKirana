'use client';

import React from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { RotateCcw } from 'lucide-react';

const sections = [
  {
    title: '1. Eligibility for Refund',
    body: 'You are eligible for a refund if: (a) you received a wrong item, (b) the item is damaged, expired, or of poor quality, (c) your order was not delivered within the promised time and you reported it within 2 hours, or (d) you were charged incorrectly.',
  },
  {
    title: '2. Timeframe to Report',
    body: 'Fresh produce (vegetables, fruits, dairy): Report within 2 hours of delivery. Packaged goods (snacks, beverages, staples): Report within 24 hours of delivery. Damaged/wrong items: Report within 24 hours with photo evidence via the app.',
  },
  {
    title: '3. How to Request a Refund',
    body: 'Open the PocketKirana app or website → My Orders → Select the order → "Report an Issue" → Choose the affected item and reason → Submit with a photo if required. Our team will review and respond within 2 hours.',
  },
  {
    title: '4. Refund Methods',
    body: 'UPI / Card payments: Refund credited to original payment method within 3–5 business days. COD orders: Refund credited as PocketKirana Wallet Credits instantly, usable on next order. Wallet credits: Instant credit to your PocketKirana wallet.',
  },
  {
    title: '5. Non-Refundable Items',
    body: 'Items that have been partially or fully consumed cannot be returned. Products from the Pharma & Wellness or Personal Care categories are non-returnable once opened due to hygiene reasons, unless received damaged or expired.',
  },
  {
    title: '6. Replacement vs. Refund',
    body: 'In most cases, we will first offer a free replacement delivered within 15 minutes. If a replacement is not available or if you prefer, a full refund will be issued.',
  },
  {
    title: '7. Contact',
    body: 'For refund queries, contact support@pocketkirana.com or call +91 98765 43210 (Mon–Sat, 8 AM–10 PM).',
  },
];

export default function RefundPolicyPage() {
  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <Breadcrumb items={[{ label: 'Refund Policy' }]} />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Refund Policy</h1>
              <p className="text-xs text-gray-500">Last updated: January 1, 2026</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 text-sm text-emerald-800">
            <span className="font-black">Our Promise:</span> If anything is wrong with your order, we'll make it right — fast. Your satisfaction is guaranteed.
          </div>

          <div className="space-y-4">
            {sections.map((s) => (
              <div key={s.title} className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="text-sm font-black text-gray-900 mb-2">{s.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
