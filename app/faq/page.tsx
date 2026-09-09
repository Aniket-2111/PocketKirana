'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Search, ChevronDown, ChevronUp, MessageSquare, PhoneCall, HelpCircle } from 'lucide-react';

export default function HelpSupportPage() {
  const [openTopic, setOpenTopic] = useState<number | null>(0);
  const [searchTopic, setSearchTopic] = useState('');

  const topics = [
    { title: 'Track my order', desc: 'Check live status and driver location for your active grocery order #PK102938.' },
    { title: 'Order not delivered', desc: 'If your delivery is delayed past 30 minutes, our live support agent will prioritize your order.' },
    { title: 'Cancel order', desc: 'You can cancel your order within 2 minutes of placing it before the store packs your items.' },
    { title: 'Refund status', desc: 'Refunds for cancelled or returned orders are credited back within 1-3 business days.' },
    { title: 'Payment issues', desc: 'Failed payment or debited amount without order confirmation? We auto-refund within 24 hours.' },
    { title: 'Return damaged items', desc: 'Damaged or missing items? Upload a photo in your order details for an instant replacement.' },
  ];

  const filteredTopics = topics.filter((t) =>
    t.title.toLowerCase().includes(searchTopic.toLowerCase()) ||
    t.desc.toLowerCase().includes(searchTopic.toLowerCase())
  );

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
          <Breadcrumb items={[{ label: 'Help & Support' }]} />

          {/* Header & Search Bar (Matching Screen 16) */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">How can we help you?</h1>
            
            <div className="max-w-lg mx-auto relative">
              <input
                type="text"
                placeholder="Search for help topics..."
                value={searchTopic}
                onChange={(e) => setSearchTopic(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-semibold text-gray-900 shadow-xs focus:outline-none focus:border-[#0F532B]"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Popular Topics List (Matching Screen 16) */}
          <div className="space-y-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs">
            <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider mb-2">Popular Topics</h2>

            <div className="space-y-3">
              {filteredTopics.map((topic, idx) => {
                const isOpen = openTopic === idx;
                return (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/50 transition-all"
                  >
                    <button
                      onClick={() => setOpenTopic(isOpen ? null : idx)}
                      className="w-full p-4 text-left font-bold text-xs sm:text-sm text-gray-900 flex items-center justify-between gap-3"
                    >
                      <span>{topic.title}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#0F532B] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-2 font-medium">
                        {topic.desc}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Contact Cards (Matching Screen 16 bottom cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#0F532B] flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-gray-900">Chat with us</h4>
                  <span className="text-[11px] text-emerald-600 font-bold">We're online</span>
                </div>
              </div>
              <button
                onClick={() => alert('Live chat agent connecting...')}
                className="bg-[#0F532B] text-white font-extrabold text-xs px-4 py-2 rounded-xl"
              >
                Start Chat
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-gray-900">Call Support</h4>
                  <span className="text-[11px] text-gray-500 font-medium">9AM - 9PM (Daily)</span>
                </div>
              </div>
              <a
                href="tel:+919112009988"
                className="bg-amber-400 text-gray-950 font-extrabold text-xs px-4 py-2 rounded-xl"
              >
                Call Now
              </a>
            </div>
          </div>

        </div>
      </CustomerLayout>
    </>
  );
}
