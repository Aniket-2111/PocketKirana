'use client';

import React from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <Breadcrumb items={[{ label: 'Privacy Policy' }]} />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Privacy Policy</h1>
              <p className="text-xs text-gray-500">Last updated: January 1, 2026</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            This document is for informational purposes only and must be reviewed by a qualified legal professional before going live.
          </div>

          <div className="prose prose-sm max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">
            {[
              {
                title: '1. Information We Collect',
                body: 'We collect information you provide directly to us, such as your name, mobile number, email address, delivery addresses, and payment method details. We also collect usage data including pages viewed, products searched, and purchase history to improve your experience.',
              },
              {
                title: '2. How We Use Your Information',
                body: 'Your information is used to process and deliver your orders, send delivery notifications via SMS and WhatsApp, personalize your shopping experience, prevent fraud and enforce our terms, and communicate promotional offers (only with your consent).',
              },
              {
                title: '3. Information Sharing',
                body: 'We do not sell your personal data to third parties. We share information only with: delivery partners to complete your order, payment processors for transaction security, and service providers who assist in operating our platform (under strict confidentiality agreements).',
              },
              {
                title: '4. Data Retention',
                body: 'We retain personal data for as long as your account is active or as needed to provide services. You may request deletion of your data by contacting support@pocketkirana.com. Certain data may be retained to comply with legal obligations.',
              },
              {
                title: '5. Cookies',
                body: 'We use cookies and similar tracking technologies to remember your preferences, analyze traffic, and improve our services. You can control cookie settings through your browser, although this may affect site functionality.',
              },
              {
                title: '6. Security',
                body: 'We implement industry-standard security measures including SSL/TLS encryption, PCI-DSS compliance for payments, and access controls. However, no internet transmission is 100% secure. Please protect your account credentials.',
              },
              {
                title: '7. Children\'s Privacy',
                body: 'Our services are not directed to individuals under 18 years of age. We do not knowingly collect personal information from minors.',
              },
              {
                title: '8. Contact',
                body: 'For privacy-related queries, contact our Data Protection Officer at privacy@pocketkirana.com or write to: PocketKirana Pvt. Ltd., 100 Feet Road, Indiranagar, Bengaluru – 560038.',
              },
            ].map((s) => (
              <div key={s.title} className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="text-sm font-black text-gray-900 mb-2">{s.title}</h2>
                <p className="text-sm text-gray-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
