'use client';

import React from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Lock, ShieldCheck, Eye, AlertTriangle, Phone, Mail } from 'lucide-react';

const tips = [
  { icon: Eye, title: 'Never share your OTP', desc: 'PocketKirana agents will NEVER ask for your OTP, PIN, or card CVV. Anyone who asks is a fraudster.' },
  { icon: Lock, title: 'Secure passwords', desc: 'Use a unique, strong password for your email. We use OTP-based login, so your mobile number is your identity.' },
  { icon: ShieldCheck, title: 'Verify communications', desc: 'All official emails come from @pocketkirana.com. Check the sender address before clicking any links.' },
  { icon: AlertTriangle, title: 'Beware of fake apps', desc: 'Download PocketKirana only from the official App Store or Google Play. Report suspicious apps immediately.' },
];

export default function SecurityPage() {
  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <Breadcrumb items={[{ label: 'Security' }]} />

          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-blue-600" />
            </div>
            <h1 className="text-3xl font-black text-gray-900">Your Security Matters</h1>
            <p className="text-sm text-gray-500 mt-2">
              PocketKirana takes your security seriously. Here's what we do to protect you.
            </p>
          </div>

          {/* What we do */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-base font-black text-gray-900 mb-4">How We Protect You</h2>
            <ul className="space-y-3 text-sm text-gray-600">
              {[
                '🔒 All data encrypted in transit with TLS 1.3',
                '💳 PCI-DSS compliant payment processing — we never store full card numbers',
                '📱 OTP-based authentication — no password to steal',
                '🕵️ Fraud detection on all transactions',
                '🔐 Two-factor authentication on admin accounts',
                '📋 Regular security audits by third-party firms',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5">{item.slice(0, 2)}</span>
                  <span>{item.slice(3)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tips Grid */}
          <div>
            <h2 className="text-base font-black text-gray-900 mb-4">Tips to Stay Safe</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {tips.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                    <Icon className="w-4.5 h-4.5 text-blue-600 w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 mb-1">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Report */}
          <div className="bg-red-50 border border-red-200 rounded-3xl p-6">
            <h2 className="text-base font-black text-red-800 mb-3">Report a Security Issue</h2>
            <p className="text-sm text-red-700 mb-4">
              If you suspect unauthorized access to your account, a fraudulent transaction, or a security vulnerability, contact us immediately:
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="mailto:security@pocketkirana.com"
                className="flex items-center gap-2 bg-red-600 text-white text-xs font-black px-4 py-2.5 rounded-xl hover:bg-red-700 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                security@pocketkirana.com
              </a>
              <a
                href="tel:+919876543210"
                className="flex items-center gap-2 bg-white text-red-700 border border-red-300 text-xs font-black px-4 py-2.5 rounded-xl hover:bg-red-50 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                +91 98765 43210
              </a>
            </div>
          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
