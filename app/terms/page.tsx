'use client';

import React from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FileText } from 'lucide-react';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using PocketKirana (pocketkirana.com) and its mobile applications, you agree to be bound by these Terms of Use. If you do not agree, please do not use our services.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 18 years old and capable of entering into a legally binding contract to use our services. By using PocketKirana, you represent that you meet this requirement.',
  },
  {
    title: '3. Account Registration',
    body: 'You may need to register with your mobile number to access certain features. You are responsible for maintaining the confidentiality of your account and for all activities that occur under it. Notify us immediately at security@pocketkirana.com if you suspect unauthorized access.',
  },
  {
    title: '4. Product Availability & Pricing',
    body: 'All product listings are subject to availability. Prices are displayed in Indian Rupees (INR) inclusive of applicable GST. PocketKirana reserves the right to modify prices, discontinue products, or cancel orders without prior notice if pricing errors occur.',
  },
  {
    title: '5. Orders & Cancellations',
    body: 'Once an order is placed and confirmed, it can be cancelled within 60 seconds. After the store begins preparing your order, cancellations may not be possible. Please refer to our Cancellation Policy for full details.',
  },
  {
    title: '6. Prohibited Use',
    body: 'You agree not to: use our platform for unlawful purposes, attempt to gain unauthorized access to any systems, submit false or misleading information, scrape or crawl our website without written permission, or engage in any activity that disrupts or interferes with our services.',
  },
  {
    title: '7. Intellectual Property',
    body: 'All content on PocketKirana, including logos, text, images, and software, is owned by PocketKirana Pvt. Ltd. and is protected by Indian copyright and trademark laws. Unauthorized reproduction or use is strictly prohibited.',
  },
  {
    title: '8. Limitation of Liability',
    body: 'To the maximum extent permitted by law, PocketKirana shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services. Our total liability in any case shall not exceed the amount paid by you for the specific order in question.',
  },
  {
    title: '9. Governing Law',
    body: 'These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka, India.',
  },
  {
    title: '10. Contact',
    body: 'For questions regarding these terms, contact: legal@pocketkirana.com | PocketKirana Pvt. Ltd., 100 Feet Road, Indiranagar, Bengaluru – 560038.',
  },
];

export default function TermsPage() {
  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <Breadcrumb items={[{ label: 'Terms of Use' }]} />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Terms of Use</h1>
              <p className="text-xs text-gray-500">Last updated: January 1, 2026</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            This document is for informational purposes only and must be reviewed by a qualified legal professional before going live.
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
