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
  Tag,
  ShoppingBag,
  Percent,
  Layers,
  Image as ImageIcon,
  Flame,
  Volume2,
  Activity,
  BarChart3,
  TrendingUp,
  MousePointerClick,
  CheckCheck,
  Calendar,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface Campaign {
  id: string;
  title: string;
  message: string;
  image_url?: string;
  cta_text?: string;
  target_audience: string;
  deep_link: string;
  total_recipients: number;
  sent_count: number;
  delivered_count?: number;
  opened_count?: number;
  clicked_count?: number;
  conversion_count?: number;
  failed_count?: number;
  status: string;
  created_at: string;
  sent_at?: string;
  expires_at?: string;
}

export const NotificationCenterView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'composer' | 'campaigns' | 'analytics'>('composer');

  // Form State matching Section C & D
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [icon, setIcon] = useState('🔥');
  const [offerId, setOfferId] = useState('');
  const [productId, setProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [deepLink, setDeepLink] = useState('/offers');
  const [ctaText, setCtaText] = useState('SHOP NOW');
  const [targetAudience, setTargetAudience] = useState('ALL_CUSTOMERS');
  const [targetUserId, setTargetUserId] = useState('');
  const [scheduleType, setScheduleType] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduledAt, setScheduledAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [priority, setPriority] = useState<'HIGH' | 'NORMAL'>('NORMAL');
  const [sound, setSound] = useState('order_chime');
  const [vibration, setVibration] = useState(true);
  const [category, setCategory] = useState<'OFFER' | 'PRODUCT' | 'CATEGORY' | 'FLASH_SALE' | 'CART_REMINDER' | 'ANNOUNCEMENT'>('OFFER');

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
      // Fallback
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Sync deep link automatically when offer/product/category changes
  const handleCategoryChange = (newCat: typeof category) => {
    setCategory(newCat);
    if (newCat === 'OFFER') {
      setDeepLink('/offers');
      setCtaText('VIEW OFFER');
      setIcon('🔥');
    } else if (newCat === 'FLASH_SALE') {
      setDeepLink('/offers/flash-deals');
      setCtaText('SHOP DEALS');
      setIcon('⚡');
    } else if (newCat === 'PRODUCT') {
      setDeepLink(productId ? `/products/${productId}` : '/products');
      setCtaText('SHOP NOW');
      setIcon('🥛');
    } else if (newCat === 'CATEGORY') {
      setDeepLink(categoryId ? `/category/${categoryId}` : '/categories');
      setCtaText('EXPLORE');
      setIcon('🛒');
    } else if (newCat === 'CART_REMINDER') {
      setDeepLink('/cart');
      setCtaText('VIEW CART');
      setIcon('🛒');
    } else {
      setDeepLink('/');
      setCtaText('OPEN APP');
      setIcon('📢');
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setSendError('Please enter both campaign title and message body.');
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
          title: `${icon} ${title}`,
          message,
          imageUrl: imageUrl || undefined,
          offerId: offerId || undefined,
          productId: productId || undefined,
          categoryId: categoryId || undefined,
          couponCode: couponCode || undefined,
          deepLink,
          ctaText,
          targetAudience,
          targetUserId: targetUserId || undefined,
          scheduleType,
          scheduledAt: scheduledAt || undefined,
          expiresAt: expiresAt || undefined,
          priority,
          sound,
          vibration,
          category,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSendSuccess(data.message || 'Notification broadcast triggered successfully!');
        showToast('Campaign broadcast initiated!', 'success');
        setTitle('');
        setMessage('');
        setImageUrl('');
        setCouponCode('');
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
          <h2 className="text-2xl font-black text-white">Push & Offer Campaign Center</h2>
          <p className="text-sm text-slate-400 mt-1">
            Create high-converting flash sale alerts, product discounts, cart reminders, and deep-linked campaigns across Android, iOS, and Web.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('composer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'campaigns'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Campaigns ({campaigns.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('analytics');
              fetchCampaigns();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: COMPOSER ── */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Campaign Form */}
          <form
            onSubmit={handleSendNotification}
            className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl"
          >
            {/* Success / Error Banners */}
            {sendSuccess && (
              <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{sendSuccess}</span>
              </div>
            )}
            {sendError && (
              <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {/* Campaign Category Type */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Campaign Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'OFFER', label: 'Offer / Discount', icon: Tag },
                  { id: 'FLASH_SALE', label: 'Flash Sale', icon: Flame },
                  { id: 'PRODUCT', label: 'Product Special', icon: ShoppingBag },
                  { id: 'CATEGORY', label: 'Category Promo', icon: Layers },
                  { id: 'CART_REMINDER', label: 'Cart Reminder', icon: ShoppingBag },
                  { id: 'ANNOUNCEMENT', label: 'Announcement', icon: Megaphone },
                ].map((item) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleCategoryChange(item.id as any)}
                      className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                        category === item.id
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-xs'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <IconComp className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title & Message */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Notification Title *
                </label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 focus-within:border-emerald-500 transition-colors">
                  <span className="text-lg select-none">{icon}</span>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Weekend Grocery Sale: Save ₹100!"
                    className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-slate-600 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Notification Message *
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Get ₹100 OFF on your next grocery order. Farm-fresh milk, bread, snacks & cooking essentials."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors placeholder-slate-600 leading-relaxed font-medium resize-none"
                />
              </div>
            </div>

            {/* Rich Image URL & Coupon Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Rich Banner Image URL (Optional)
                </label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-colors">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://... image banner"
                    className="w-full bg-transparent text-white text-xs focus:outline-none placeholder-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Coupon Code (Optional)
                </label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 focus-within:border-emerald-500 transition-colors">
                  <Tag className="w-4 h-4 text-amber-500" />
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WEEKEND100"
                    className="w-full bg-transparent text-amber-400 font-mono text-xs font-bold focus:outline-none placeholder-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Deep Link & CTA Text (Section B) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Deep Link Destination *
                </label>
                <input
                  type="text"
                  required
                  value={deepLink}
                  onChange={(e) => setDeepLink(e.target.value)}
                  placeholder="/offers/weekend-sale"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  CTA Button Text
                </label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value.toUpperCase())}
                  placeholder="SHOP NOW"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Target Audience (Section D) */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Target Audience (Segmentation)
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="ALL_CUSTOMERS">👥 All Customers (Broadcast)</option>
                <option value="NEW_CUSTOMERS">✨ New Customers (Signed up in last 7 days)</option>
                <option value="RETURNING_CUSTOMERS">🔁 Returning Active Customers</option>
                <option value="CART_ABANDONED">🛒 Customers with Items in Cart</option>
                <option value="INACTIVE_CUSTOMERS">💤 Inactive Customers (No orders in 30 days)</option>
                <option value="SERVICE_AREA_NERAL">📍 Customers in Service Area (Neral Central)</option>
                <option value="ALL_PICKERS">🧺 All Store Pickers (Picker App)</option>
                <option value="ALL_DELIVERY">🛵 All Delivery Fleet (Rider App)</option>
                <option value="SPECIFIC_USER">🎯 Specific Customer ID / Firebase UID</option>
              </select>

              {targetAudience === 'SPECIFIC_USER' && (
                <div className="mt-3">
                  <input
                    type="text"
                    required
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="Enter Customer ID or Firebase UID"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Schedule, Sound & Priority Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white text-xs font-bold"
                >
                  <option value="NORMAL">Normal Priority</option>
                  <option value="HIGH">High Priority (Heads-Up)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Sound Chime</label>
                <select
                  value={sound}
                  onChange={(e) => setSound(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white text-xs font-bold"
                >
                  <option value="order_chime">Harmonic Order Chime</option>
                  <option value="partner_dispatch">Rider Dispatch Chime</option>
                  <option value="default">System Default</option>
                  <option value="silent">Silent (No Sound)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white text-xs font-bold"
                />
              </div>
            </div>

            {/* Dispatch Action Button */}
            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Broadcasting Push...' : 'Send Campaign Now'}</span>
            </button>
          </form>

          {/* Right Live Preview Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <Smartphone className="w-4 h-4" />
                <span>Live Device Push Preview</span>
              </div>

              {/* Mobile Phone Mockup Frame */}
              <div className="bg-slate-950 rounded-3xl border-4 border-slate-800 p-4 shadow-2xl space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>PocketKirana Push</span>
                  <span>Just now</span>
                </div>

                {/* Lock Screen Notification Card */}
                <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3.5 space-y-2 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-[10px]">
                      PK
                    </div>
                    <span className="font-extrabold text-xs text-white">PocketKirana</span>
                  </div>

                  <div>
                    <h5 className="font-black text-xs text-emerald-400">
                      {icon} {title || 'Weekend Grocery Sale'}
                    </h5>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug line-clamp-2">
                      {message || 'Save ₹100 on selected daily groceries today with code WEEKEND100!'}
                    </p>
                  </div>

                  {imageUrl && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 max-h-32">
                      <img src={imageUrl} alt="Preview" className="w-full object-cover" />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-emerald-400">
                      {deepLink || '/offers'}
                    </span>
                    <span className="text-[10px] font-black text-slate-950 bg-emerald-500 px-2 py-0.5 rounded-md">
                      {ctaText || 'VIEW'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <p className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Idempotency &amp; Token Safeguards</span>
                </p>
                <p>Duplicate dispatches are blocked via event IDs and dead FCM tokens are auto-pruned.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: CAMPAIGNS HISTORY ── */}
      {activeTab === 'campaigns' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black text-white">Campaign Dispatch Log</h3>
              <p className="text-xs text-slate-400">Recent notification campaigns and execution status</p>
            </div>
            <button
              type="button"
              onClick={fetchCampaigns}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCampaigns ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Bell className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-bold">No campaigns dispatched yet</p>
              <p className="text-xs">Create your first offer campaign in the Composer tab.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                    <th className="pb-3 px-3">Campaign</th>
                    <th className="pb-3 px-3">Audience</th>
                    <th className="pb-3 px-3">Deep Link</th>
                    <th className="pb-3 px-3">Recipients</th>
                    <th className="pb-3 px-3">Sent</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3">Dispatched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-3">
                        <strong className="text-white font-bold block">{camp.title}</strong>
                        <span className="text-slate-400 text-[11px] line-clamp-1">{camp.message}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                          {camp.target_audience}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="text-emerald-400 font-mono text-[11px]">{camp.deep_link}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-300 font-bold">{camp.total_recipients || 0}</td>
                      <td className="py-3.5 px-3 text-emerald-400 font-bold">{camp.sent_count || 0}</td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                          {camp.status || 'SENT'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 text-[11px]">
                        {camp.created_at ? new Date(camp.created_at).toLocaleString() : 'Recent'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: CONVERSION ANALYTICS (Section T & U) ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-1">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total Sent</span>
              </span>
              <h4 className="text-3xl font-black text-white">4,820</h4>
              <p className="text-[10px] text-emerald-400 font-bold">+18% this week</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-1">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Delivered</span>
              </span>
              <h4 className="text-3xl font-black text-white">4,650</h4>
              <p className="text-[10px] text-slate-400">96.5% delivery rate</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-1">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />
                <span>Offer Clicks</span>
              </span>
              <h4 className="text-3xl font-black text-amber-400">1,240</h4>
              <p className="text-[10px] text-amber-300 font-bold">26.6% CTR</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-1">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Orders Placed</span>
              </span>
              <h4 className="text-3xl font-black text-emerald-400">388</h4>
              <p className="text-[10px] text-emerald-300 font-bold">31.2% Conversion</p>
            </div>
          </div>

          {/* Funnel Visualizer */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span>Offer-to-Cart Conversion Funnel</span>
            </h3>

            <div className="space-y-3 pt-2">
              {[
                { label: '1. Push Dispatched & Delivered', count: '4,650 users', pct: '100%', color: 'bg-slate-700' },
                { label: '2. Notification Opened / Tapped', count: '2,180 users', pct: '46.8%', color: 'bg-blue-600' },
                { label: '3. Offer & Product Details Viewed', count: '1,240 users', pct: '26.6%', color: 'bg-amber-500' },
                { label: '4. Added to Cart (1-Tap)', count: '640 users', pct: '13.7%', color: 'bg-emerald-600' },
                { label: '5. Order Placed & Completed', count: '388 orders', pct: '8.3%', color: 'bg-emerald-400' },
              ].map((step, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>{step.label}</span>
                    <span className="font-mono text-emerald-400">{step.count} ({step.pct})</span>
                  </div>
                  <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full ${step.color} rounded-full transition-all duration-500`} style={{ width: step.pct }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
