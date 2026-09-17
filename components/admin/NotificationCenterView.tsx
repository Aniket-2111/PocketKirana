'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  Bell,
  Sparkles,
  Users,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  History,
  Radio,
  RefreshCw,
  Clock,
  ExternalLink,
  ShieldCheck,
  Megaphone,
} from 'lucide-react';

interface Campaign {
  id: string;
  title: string;
  message: string;
  target_audience: string;
  deep_link: string;
  total_recipients: number;
  sent_count: number;
  status: string;
  created_at: string;
  sent_at: string;
}

export const NotificationCenterView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'composer' | 'campaigns' | 'system'>('composer');

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('ALL_CUSTOMERS');
  const [category, setCategory] = useState<'OFFER' | 'ANNOUNCEMENT' | 'OPERATIONAL'>('OFFER');
  const [deepLink, setDeepLink] = useState('/home');
  const [sound, setSound] = useState('order_chime');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Campaigns State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);

  // Load Campaigns
  const fetchCampaigns = async () => {
    setIsLoadingCampaigns(true);
    try {
      const res = await fetch('/api/admin/notifications/compose');
      const data = await res.json();
      if (data.campaigns) {
        setCampaigns(data.campaigns);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setSendError('Please enter both title and message.');
      return;
    }

    setIsSending(true);
    setSendSuccess(null);
    setSendError(null);

    try {
      const res = await fetch('/api/admin/notifications/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          targetAudience,
          category,
          deepLink,
          sound,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSendSuccess(data.message || 'Notification broadcast initiated successfully!');
        setTitle('');
        setMessage('');
        fetchCampaigns();
      } else {
        setSendError(data.error || 'Failed to dispatch notification.');
      }
    } catch (err: any) {
      setSendError(err.message || 'Network error dispatching notification.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Real-Time Broadcast Engine</span>
          </div>
          <h2 className="text-2xl font-black text-white">Push & Notification Center</h2>
          <p className="text-sm text-slate-400 mt-1">
            Dispatch real-time push alerts, offers, and operational notices across website, mobile apps, pickers, and riders.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('composer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'composer'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Composer</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('campaigns');
              fetchCampaigns();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'campaigns'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Campaigns ({campaigns.length})</span>
          </button>
        </div>
      </div>

      {/* Composer Tab */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4">
              <Megaphone className="w-5 h-5 text-emerald-400" />
              <span>Compose Broadcast Push</span>
            </h3>

            {sendSuccess && (
              <div className="mb-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{sendSuccess}</span>
              </div>
            )}

            {sendError && (
              <div className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            <form onSubmit={handleSendNotification} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Target Audience
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL_CUSTOMERS">👥 All Customers (App + Web)</option>
                    <option value="ALL_PICKERS">📦 All Store Pickers</option>
                    <option value="ALL_DELIVERY">🛵 All Delivery Partners</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Notification Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="OFFER">🔥 Promotional Offer / Flash Deal</option>
                    <option value="ANNOUNCEMENT">📢 General Announcement</option>
                    <option value="OPERATIONAL">⚠ Operational Alert</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 🔥 Flash Sale: 20% OFF on Fresh Fruits & Dairy!"
                  maxLength={70}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Notification Body / Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Order fresh milk, vegetables, and snacks now and get delivery in 10-15 mins in Neral."
                  rows={3}
                  maxLength={200}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Target Deep Link / Route
                  </label>
                  <input
                    type="text"
                    value={deepLink}
                    onChange={(e) => setDeepLink(e.target.value)}
                    placeholder="/home or /categories/fruits"
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Audio Chime
                  </label>
                  <select
                    value={sound}
                    onChange={(e) => setSound(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="order_chime">Harmonic Two-Tone Chime</option>
                    <option value="partner_dispatch">Energetic Dispatch Chime</option>
                    <option value="default">Default Alert</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSending || !title.trim() || !message.trim()}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-base transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Broadcasting to Devices...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Send Push Broadcast</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Live Mobile & Web Toast Preview */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Live Preview (In-App & Push)</span>
              </h3>

              {/* Mobile Push Preview Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-inner space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center text-[10px] text-slate-950 font-black">
                      PK
                    </div>
                    <span>PocketKirana</span>
                  </div>
                  <span>Just now</span>
                </div>

                <div className="text-sm font-bold text-white leading-snug">
                  {title || '🔥 Special Offer Title'}
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  {message || 'Order groceries online. Delivered to your doorstep in 30 minutes in Neral.'}
                </div>
              </div>

              {/* Bottom Toast Preview */}
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Customer Website Bottom-Left Toast Preview
                </div>
                <div className="bg-white/95 text-slate-900 p-3 rounded-2xl border border-emerald-500/30 shadow-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black uppercase text-emerald-700">PocketKirana Live</div>
                    <div className="text-xs font-bold truncate">{title || 'Offer Preview'}</div>
                    <div className="text-[11px] text-slate-600 line-clamp-1">{message || 'Message preview text'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Authoritative Backend Pipeline</span>
              </div>
              <p>
                Broadcasts are logged in the immutable PostgreSQL ledger and sent via Firebase Cloud Messaging multicast with automatic deduplication.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns History Tab */}
      {activeTab === 'campaigns' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              <span>Broadcast Campaign History</span>
            </h3>
            <button
              onClick={fetchCampaigns}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingCampaigns ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No broadcast campaigns sent yet. Use the composer to launch your first push broadcast.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-black tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Title & Message</th>
                    <th className="py-3 px-4">Target Audience</th>
                    <th className="py-3 px-4">Recipients</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{camp.title}</div>
                        <div className="text-slate-400 line-clamp-1 mt-0.5">{camp.message}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">
                        {camp.target_audience}
                      </td>
                      <td className="py-3 px-4">
                        {camp.sent_count || camp.total_recipients || 1} devices
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {camp.status || 'SENT'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {camp.sent_at || camp.created_at ? new Date(camp.sent_at || camp.created_at).toLocaleString() : 'Recent'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
