'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { showToast } from '@/components/ui/Toast';
import { Store, Truck, Warehouse, Users, ChevronRight, CheckCircle2, IndianRupee, Clock, Star } from 'lucide-react';

const partnerTypes = [
  {
    icon: Store,
    title: 'Store Partner',
    subtitle: 'Kirana Store Owner',
    desc: 'List your store on PocketKirana and reach thousands of local customers instantly. We handle delivery & payments.',
    benefits: ['10,000+ customers reach', 'Same-day payouts', 'Zero upfront cost', 'Dedicated store dashboard'],
    color: 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200',
    iconBg: 'bg-emerald-600',
    href: '/store',
  },
  {
    icon: Truck,
    title: 'Delivery Partner',
    subtitle: 'Earn on your schedule',
    desc: 'Join our fleet of delivery executives. Work flexible hours, earn weekly, and get full training support.',
    benefits: ['₹25,000–40,000/month', 'Flexible hours', 'Weekly payments', 'Health & accident cover'],
    color: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200',
    iconBg: 'bg-amber-500',
    href: '/delivery',
  },
  {
    icon: Warehouse,
    title: 'Warehouse Partner',
    subtitle: 'Fulfillment Center',
    desc: 'Have storage space? Partner with us as a dark store or fulfillment center and earn steady monthly revenue.',
    benefits: ['Long-term contracts', 'Guaranteed revenue', 'Operational support', 'Tech & infra provided'],
    color: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200',
    iconBg: 'bg-blue-600',
    href: '#apply',
  },
  {
    icon: Users,
    title: 'Brand / Seller',
    subtitle: 'List your products',
    desc: 'Are you a brand or manufacturer? Get your products listed on PocketKirana and reach lakhs of customers.',
    benefits: ['Brand storefront', 'Direct customer access', 'Analytics dashboard', 'Co-marketing support'],
    color: 'bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200',
    iconBg: 'bg-purple-600',
    href: '/seller',
  },
];

const stats = [
  { icon: Users, value: '50,000+', label: 'Happy customers' },
  { icon: Store, value: '200+', label: 'Partner stores' },
  { icon: Truck, value: '500+', label: 'Delivery partners' },
  { icon: IndianRupee, value: '₹2Cr+', label: 'Partner earnings' },
];

export default function PartnerPage() {
  const [form, setForm] = useState({ name: '', phone: '', city: '', type: 'Store Partner', notes: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      showToast('Please fill in name and phone number.', 'error');
      return;
    }
    setSubmitted(true);
    showToast('Application submitted! Our team will call you within 24 hours.', 'success');
  };

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-16 py-8">
          <Breadcrumb items={[{ label: 'Partner with Us' }]} />

          {/* Hero */}
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-black px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              Join PocketKirana
            </span>
            <h1 className="text-4xl font-black text-gray-900 leading-tight">
              Grow Your Business<br />
              <span className="text-emerald-600">With PocketKirana</span>
            </h1>
            <p className="text-gray-500 mt-4 text-base">
              Whether you run a store, have a vehicle, own a warehouse, or want to sell your brand — we have a partnership model for you.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(({ icon: Icon, value, label }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm">
                <Icon className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                <p className="text-2xl font-black text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Partner Type Cards */}
          <div>
            <h2 className="text-2xl font-black text-gray-900 text-center mb-8">
              Choose Your Partnership
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {partnerTypes.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.title}
                    className={`group rounded-3xl border-2 p-6 ${p.color} hover:shadow-lg transition-all`}
                  >
                    <div className={`w-11 h-11 rounded-2xl ${p.iconBg} flex items-center justify-center mb-4`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900">{p.title}</h3>
                    <p className="text-xs font-semibold text-gray-500 mt-0.5">{p.subtitle}</p>
                    <p className="text-sm text-gray-600 mt-3 leading-relaxed">{p.desc}</p>
                    <ul className="mt-4 space-y-1.5">
                      {p.benefits.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-xs text-gray-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={p.href}
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-gray-800 hover:text-emerald-700 transition-colors"
                    >
                      Learn more <ChevronRight className="w-4 h-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Apply Form */}
          <div id="apply" className="max-w-xl mx-auto bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-black text-gray-900 mb-1">Apply Now</h2>
            <p className="text-sm text-gray-500 mb-6">Our team will reach out within 24 hours.</p>

            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="font-black text-gray-900">Application Submitted!</h3>
                <p className="text-sm text-gray-500 mt-2">
                  We'll call you at <strong>{form.phone}</strong> within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Full Name *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Phone Number *</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">City</label>
                    <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bengaluru" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Partnership Type</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-white">
                      <option>Store Partner</option>
                      <option>Delivery Partner</option>
                      <option>Warehouse Partner</option>
                      <option>Brand / Seller</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Additional Notes</label>
                  <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Tell us more about your business..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 resize-none transition-all" />
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
