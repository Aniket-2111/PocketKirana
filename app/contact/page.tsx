'use client';

import React, { useState } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { showToast } from '@/components/ui/Toast';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
  Twitter,
  Instagram,
  Send,
  CheckCircle2,
} from 'lucide-react';

const channels = [
  {
    icon: Phone,
    label: 'Call Us',
    value: '+91 98765 43210',
    sub: 'Mon–Sat, 8 AM – 10 PM',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    href: 'tel:+919876543210',
  },
  {
    icon: Mail,
    label: 'Email Support',
    value: 'support@pocketkirana.com',
    sub: 'Replies within 24 hours',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    href: 'mailto:support@pocketkirana.com',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: '+91 98765 43210',
    sub: 'Mon–Sat, 9 AM – 9 PM',
    color: 'bg-green-50 border-green-200 text-green-700',
    href: 'https://wa.me/919876543210',
  },
  {
    icon: Twitter,
    label: 'Twitter/X',
    value: '@PocketKirana',
    sub: 'For quick queries & updates',
    color: 'bg-sky-50 border-sky-200 text-sky-700',
    href: 'https://twitter.com/pocketkirana',
  },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    setSubmitted(true);
    showToast('Message sent! We\'ll reply within 24 hours.', 'success');
  };

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
          <Breadcrumb items={[{ label: 'Contact Us' }]} />

          <div className="text-center">
            <h1 className="text-3xl font-black text-gray-900">Get in Touch</h1>
            <p className="text-sm text-gray-500 mt-2">
              We'd love to hear from you. Reach us through any of the channels below.
            </p>
          </div>

          {/* Contact Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {channels.map(({ icon: Icon, label, value, sub, color, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className={`block p-4 rounded-2xl border-2 hover:shadow-md transition-shadow ${color}`}
              >
                <Icon className="w-6 h-6 mb-3" />
                <p className="text-xs font-black uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
                <p className="text-xs opacity-70 mt-1">{sub}</p>
              </a>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Form */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-lg font-black text-gray-900 mb-5">Send a Message</h2>

              {submitted ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                  <h3 className="font-bold text-gray-900 mb-1">Message Sent!</h3>
                  <p className="text-sm text-gray-500">We'll get back to you within 24 hours.</p>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                    className="mt-5 text-xs text-emerald-600 font-semibold hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Your name"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Email *</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="you@email.com"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Subject</label>
                    <select
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-white"
                    >
                      <option value="">Select a topic</option>
                      <option>Order Issue</option>
                      <option>Payment Problem</option>
                      <option>Refund Request</option>
                      <option>Product Quality</option>
                      <option>Partnership</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Message *</label>
                    <textarea
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Tell us how we can help..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Message
                  </button>
                </form>
              )}
            </div>

            {/* Store Address & Hours */}
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-900 mb-4">Our Store</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">PocketKirana Central Store</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Plot 42, 100 Feet Road, Indiranagar<br />
                        Bengaluru, Karnataka – 560038
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Store Hours</p>
                      <p className="text-xs text-gray-500 mt-0.5">Monday – Sunday: 6:00 AM – 11:00 PM</p>
                      <p className="text-xs text-gray-500">Delivery: 6:00 AM – 10:30 PM</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <h3 className="text-sm font-black text-amber-800 mb-2">⚠️ Security Notice</h3>
                <p className="text-xs text-amber-700 leading-relaxed">
                  PocketKirana will never ask for your OTP, PIN, or full card details via phone, email, or chat. If anyone asks for these, please report it immediately to{' '}
                  <strong>security@pocketkirana.com</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
