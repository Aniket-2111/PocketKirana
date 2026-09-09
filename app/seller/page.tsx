'use client';

import React, { useState } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { showToast } from '@/components/ui/Toast';
import { CheckCircle2, Package, TrendingUp, Headphones, Zap, IndianRupee } from 'lucide-react';

const benefits = [
  { icon: TrendingUp, title: '50,000+ customers', desc: 'Reach an active local customer base looking to buy now.' },
  { icon: IndianRupee, title: 'Same-day payouts', desc: 'Get paid within 24 hours of every successful delivery.' },
  { icon: Headphones, title: 'Seller support', desc: 'Dedicated account manager to help grow your sales.' },
  { icon: Zap, title: 'Zero listing fee', desc: 'List all your products at absolutely no upfront cost.' },
  { icon: Package, title: 'Logistics handled', desc: 'We manage the last-mile delivery so you can focus on quality.' },
];

const steps = [
  { step: '01', title: 'Apply Online', desc: 'Fill the form below with your business details.' },
  { step: '02', title: 'Document Verification', desc: 'Submit GSTIN, FSSAI (if applicable), and bank details.' },
  { step: '03', title: 'List Products', desc: 'Add your products to the PocketKirana catalog.' },
  { step: '04', title: 'Start Selling!', desc: 'Go live and start receiving orders immediately.' },
];

export default function SellerPage() {
  const [form, setForm] = useState({ businessName: '', name: '', phone: '', city: '', category: '', gst: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.phone) {
      showToast('Please fill in required fields.', 'error');
      return;
    }
    setSubmitted(true);
    showToast('Application received! Our seller team will contact you within 48 hours.', 'success');
  };

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-10 space-y-16">
          <Breadcrumb items={[{ label: 'Partner with Us', href: '/partner' }, { label: 'Sell on PocketKirana' }]} />

          {/* Hero */}
          <div className="text-center">
            <h1 className="text-4xl font-black text-gray-900">
              Sell on <span className="text-emerald-600">PocketKirana</span>
            </h1>
            <p className="text-gray-500 mt-3 text-base max-w-2xl mx-auto">
              Grow your brand by listing on PocketKirana. Reach thousands of local shoppers and get paid fast — with zero listing fees.
            </p>
          </div>

          {/* Benefits */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-black text-gray-900 text-sm">{title}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div>
            <h2 className="text-2xl font-black text-gray-900 text-center mb-8">How to Get Started</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {steps.map((s) => (
                <div key={s.step} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-sm mx-auto mb-3">
                    {s.step}
                  </div>
                  <h3 className="font-black text-gray-900 text-sm">{s.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Application Form */}
          <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-black text-gray-900 mb-1">Apply to Become a Seller</h2>
            <p className="text-sm text-gray-500 mb-6">Fill in your details and we'll get back to you within 48 hours.</p>

            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="font-black text-gray-900">Application Submitted!</h3>
                <p className="text-sm text-gray-500 mt-2">Our seller team will contact you at <strong>{form.phone}</strong> within 48 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Business Name *</label>
                  <input type="text" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Your company or brand name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Contact Name</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Phone *</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">City</label>
                    <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bengaluru" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Product Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-white">
                      <option value="">Select...</option>
                      <option>Dairy & Eggs</option>
                      <option>Fruits & Vegetables</option>
                      <option>Snacks & Beverages</option>
                      <option>Staples & Spices</option>
                      <option>Health & Wellness</option>
                      <option>Home & Personal Care</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">GSTIN (optional)</label>
                  <input type="text" value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} placeholder="29ABCDE1234F1Z5" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-sm transition-colors">
                  Submit Application
                </button>
              </form>
            )}
          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
