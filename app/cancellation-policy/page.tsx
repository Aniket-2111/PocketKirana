'use client';

import React from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { XCircle } from 'lucide-react';

const sections = [
  {
    title: '1. Order Cancellation by Customer',
    body: 'You can cancel an order within 60 seconds of placing it from the "My Orders" section. After 60 seconds, if the store has started preparing your order, cancellation may not be possible. For orders that cannot be cancelled, please contact our support team.',
  },
  {
    title: '2. When Cancellation is Not Possible',
    body: 'Cancellation is not possible once: (a) the store has confirmed and begun preparing the order, (b) the delivery partner has been assigned, or (c) the order is marked "Out for Delivery". In such cases, you may refuse delivery and we will process a refund per our Refund Policy.',
  },
  {
    title: '3. Auto-Cancellation by PocketKirana',
    body: 'Your order may be automatically cancelled if: (a) one or more items go out of stock and no substitute is available, (b) the delivery partner cannot reach your location, (c) payment verification fails, or (d) your delivery address is outside our serviceable area. You will be notified and refunded immediately.',
  },
  {
    title: '4. Refund on Cancellation',
    body: 'If you cancel before the store begins preparation: 100% refund within 3–5 business days for online payments, or instant PocketKirana wallet credit. For COD orders that were not delivered: no charge is applied.',
  },
  {
    title: '5. Partial Cancellation',
    body: 'If you wish to remove specific items from an order (not cancel the entire order), contact our support within 60 seconds of placing the order. We will do our best to accommodate the request before the store begins preparation.',
  },
  {
    title: '6. How to Cancel',
    body: 'Open the PocketKirana app or website → My Orders → Select the order → Tap "Cancel Order" → Select a reason → Confirm cancellation. You will receive a confirmation notification.',
  },
  {
    title: '7. Contact',
    body: 'For cancellation-related queries, contact support@pocketkirana.com or call +91 98765 43210. Our support team is available Monday to Saturday, 8 AM to 10 PM.',
  },
];

export default function CancellationPolicyPage() {
  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <Breadcrumb items={[{ label: 'Cancellation Policy' }]} />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Cancellation Policy</h1>
              <p className="text-xs text-gray-500">Last updated: January 1, 2026</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
            <strong>Quick tip:</strong> You can cancel any order within 60 seconds of placing it for a full refund.
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
