'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import {
  User,
  ShoppingBag,
  MessageSquare,
  Moon,
  Sun,
  MapPin,
  Bell,
  LogOut,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Phone,
  HelpCircle,
  Share2,
  Info,
  Store,
  Lock,
  X,
  CheckCircle2,
  SlidersHorizontal,
  ShieldCheck,
  FileText,
  RotateCcw
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

import { getStoredTheme, setAppTheme, initThemeListener, ThemeMode } from '../../lib/themeUtils';

export default function CustomerProfile() {
  const router = useRouter();
  const { currentUser, logout } = useAppStore();

  const [theme, setTheme] = useState<ThemeMode>('system');
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifOrderUpdates, setNotifOrderUpdates] = useState(true);
  const [notifOffers, setNotifOffers] = useState(true);
  const [notifDeliveryPings, setNotifDeliveryPings] = useState(true);

  // Initialize theme from storage and listen for OS system preference changes
  useEffect(() => {
    setTheme(getStoredTheme());
    const cleanup = initThemeListener((currentMode) => {
      setTheme(currentMode);
    });
    return cleanup;
  }, []);

  const handleSelectTheme = (selectedTheme: ThemeMode) => {
    setTheme(selectedTheme);
    setAppTheme(selectedTheme);
    showToast(`Theme set to ${selectedTheme.toUpperCase()}`, 'success');
  };

  const handleShareApp = async () => {
    const shareData = {
      title: 'Pocket Kirana - 10-Min Grocery Delivery',
      text: 'Order groceries and daily essentials in 10 minutes with Pocket Kirana!',
      url: window.location.origin || 'https://pocketkirana.in'
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        showToast('Shared successfully!', 'success');
      } catch (err) {
        // User cancelled or share failed
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url);
      showToast('App link copied to clipboard! Share it with friends & family', 'success');
    } else {
      showToast('Pocket Kirana App link: https://pocketkirana.in', 'info');
    }
  };

  const handleLogout = () => {
    logout();
    showToast('Logged out successfully', 'info');
    router.replace('/login');
  };

  const userMobile = currentUser?.mobile || '8698893348';
  const userName = currentUser?.firstName 
    ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() 
    : 'Your account';

  return (
    <CustomerShell title="Profile" showBack={false}>
      <div className="space-y-4 animate-in fade-in duration-200 pb-20 max-w-md mx-auto">
        
        {/* ══ HERO PROFILE HEADER (Cream & Green Brand Theme) ══ */}
        <div className="relative pt-6 pb-7 px-4 rounded-3xl overflow-hidden text-center bg-gradient-to-b from-[#0B8F5A] via-[#075C3C] to-[#043d27] dark:from-[#0f2e22] dark:via-[#0b2118] dark:to-[#071610] border border-emerald-400/30 dark:border-emerald-700/30 shadow-md text-white">
          {/* Ambient Cream/Emerald Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-200/20 dark:bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

          {/* Large Cream & Green Circular Avatar */}
          <div className="relative mx-auto mb-3.5 w-24 h-24 rounded-full bg-[#FEFCE8] dark:bg-[#133829] border-3 border-emerald-200 dark:border-emerald-500/50 flex items-center justify-center shadow-lg shadow-emerald-950/40">
            <User className="w-12 h-12 text-[#0B8F5A] dark:text-emerald-300" strokeWidth={2.2} />
          </div>

          {/* Account Name & Mobile Number */}
          <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-xs">
            {userName}
          </h1>
          <p className="text-sm font-semibold text-emerald-100 dark:text-emerald-200/80 mt-1 font-mono">
            {userMobile}
          </p>

          <div className="mt-2.5">
            <span className="inline-block bg-emerald-900/40 dark:bg-emerald-950/80 text-emerald-100 dark:text-emerald-300 text-[10px] font-black px-3 py-0.5 rounded-full border border-emerald-300/30">
              Verified Member
            </span>
          </div>
        </div>

        {/* ══ TOP ACTION TILES (Orders, Addresses & Help) ══ */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Tile 1: Your Orders */}
          <button
            onClick={() => router.push('/orders')}
            className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer hover:border-[#008F5A]/40 dark:hover:border-[#008F5A]/60 active:scale-95 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-[#1B2430] flex items-center justify-center text-[#008F5A] dark:text-emerald-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] leading-tight">
              Your orders
            </span>
          </button>

          {/* Tile 2: Address Book */}
          <button
            onClick={() => router.push('/saved-addresses')}
            className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer hover:border-[#008F5A]/40 dark:hover:border-[#008F5A]/60 active:scale-95 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#1B2430] flex items-center justify-center text-blue-600 dark:text-blue-400">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] leading-tight">
              Addresses
            </span>
          </button>

          {/* Tile 3: Need Help */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer hover:border-[#008F5A]/40 dark:hover:border-[#008F5A]/60 active:scale-95 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-[#1B2430] flex items-center justify-center text-purple-600 dark:text-purple-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] leading-tight">
              Need help?
            </span>
          </button>
        </div>

        {/* ══ APPEARANCE ACCORDION CARD ══ */}
        <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl overflow-hidden shadow-xs">
          
          {/* Header Bar */}
          <button
            onClick={() => setAppearanceOpen(!appearanceOpen)}
            className="w-full p-4 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-[#111827] dark:text-[#F9FAFB]" />
              <span className="text-sm font-black text-[#111827] dark:text-[#F9FAFB]">
                Appearance
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!appearanceOpen && (
                <span className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">
                  {theme}
                </span>
              )}
              {appearanceOpen ? (
                <ChevronUp className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
              )}
            </div>
          </button>

          {/* Radio Options Body */}
          {appearanceOpen && (
            <div className="border-t border-[#E5E7EB] dark:border-[#263241] divide-y divide-[#E5E7EB] dark:divide-[#263241]">
              
              {/* Option 1: Light Theme */}
              <button
                onClick={() => handleSelectTheme('light')}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#1B2430] transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Sun className="w-4.5 h-4.5 text-amber-500" />
                  <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">
                    Light Theme
                  </span>
                </div>
                {/* Radio Button */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  theme === 'light' 
                    ? 'border-[#008F5A] bg-[#008F5A]' 
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {theme === 'light' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </button>

              {/* Option 2: Dark Theme */}
              <button
                onClick={() => handleSelectTheme('dark')}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#1B2430] transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Moon className="w-4.5 h-4.5 text-indigo-400" />
                  <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">
                    Dark Theme
                  </span>
                </div>
                {/* Radio Button */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  theme === 'dark' 
                    ? 'border-[#008F5A] bg-[#008F5A]' 
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {theme === 'dark' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </button>

              {/* Option 3: System Theme */}
              <button
                onClick={() => handleSelectTheme('system')}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#1B2430] transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#9CA3AF]" />
                  <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">
                    System Theme
                  </span>
                </div>
                {/* Radio Button */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  theme === 'system' 
                    ? 'border-[#008F5A] bg-[#008F5A]' 
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {theme === 'system' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </button>

            </div>
          )}

        </div>

        {/* ══ OTHER INFORMATION SECTION ══ */}
        <div className="space-y-2 pt-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] px-1">
            Other Information
          </h2>

          <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl divide-y divide-[#E5E7EB] dark:divide-[#263241] shadow-xs text-xs font-bold text-[#374151] dark:text-[#D1D5DB] overflow-hidden">
            
            {/* 1. Share the App */}
            <button
              onClick={handleShareApp}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-[#1B2430] flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Share2 className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#D1D5DB]" />
                <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">Share the app</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>

            {/* 2. About Us */}
            <button
              onClick={() => router.push('/about')}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-[#1B2430] flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Info className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#D1D5DB]" />
                <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">About us</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>

            {/* 3. Legal & Compliance Center */}
            <button
              onClick={() => router.push('/legal')}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-[#1B2430] flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <ShieldCheck className="w-4.5 h-4.5 text-[#008F5A] dark:text-emerald-400" />
                <div>
                  <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] block">
                    Legal &amp; Compliance Center
                  </span>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-medium">
                    FSSAI, DPDP, Terms, Refunds &amp; Disclosures
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>

            {/* 4. Terms & Conditions */}
            <button
              onClick={() => router.push('/terms')}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-[#1B2430] flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <FileText className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#D1D5DB]" />
                <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">Terms &amp; conditions</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>

            {/* 5. Account Privacy & DPDP */}
            <button
              onClick={() => router.push('/privacy')}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-[#1B2430] flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Lock className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#D1D5DB]" />
                <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">Account privacy &amp; DPDP</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>

            {/* 6. Refunds & Cancellations */}
            <button
              onClick={() => router.push('/refund-policy')}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-[#1B2430] flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <RotateCcw className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#D1D5DB]" />
                <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">Refund &amp; cancellation policy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>

            {/* 7. Grievance Redressal */}
            <button
              onClick={() => router.push('/grievance-redressal')}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-[#1B2430] flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <HelpCircle className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#D1D5DB]" />
                <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">Grievance officer &amp; redressal</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>

            {/* 8. Notification Preferences */}
            <button
              onClick={() => setShowNotifModal(true)}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-[#1B2430] flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Bell className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#D1D5DB]" />
                <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">Notification preferences</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>

            {/* 9. Log Out */}
            <button
              onClick={handleLogout}
              className="w-full p-4 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 flex items-center justify-between transition-colors text-left cursor-pointer text-rose-600 dark:text-rose-400"
            >
              <div className="flex items-center gap-3.5">
                <LogOut className="w-4.5 h-4.5 text-rose-500" />
                <span className="text-xs font-black">Log out</span>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-400/60" />
            </button>

          </div>
        </div>

        {/* ══ FOOTER LOGO & VERSION ══ */}
        <div className="text-center pt-6 pb-4 space-y-1">
          <div className="text-xl font-black tracking-tight text-[#6B7280] dark:text-slate-500 font-sans">
            pocketkirana
          </div>
          <div className="text-xs text-[#9CA3AF] dark:text-slate-600 font-mono font-bold">
            v1.0.0
          </div>
        </div>

      </div>

      {/* ══ NOTIFICATION PREFERENCES MODAL ══ */}
      {showNotifModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Notification Settings
                  </h3>
                  <span className="text-[10px] text-slate-400">Order milestones &amp; alerts</span>
                </div>
              </div>
              <button
                onClick={() => setShowNotifModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl">
                <div>
                  <strong className="block text-[#111827] dark:text-[#F9FAFB]">Live Order Updates</strong>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Order packed, dispatched &amp; delivered</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifOrderUpdates}
                  onChange={(e) => setNotifOrderUpdates(e.target.checked)}
                  className="w-4 h-4 accent-[#008F5A] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl">
                <div>
                  <strong className="block text-[#111827] dark:text-[#F9FAFB]">Exclusive Offers &amp; Promo</strong>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Daily flash discounts &amp; coupons</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifOffers}
                  onChange={(e) => setNotifOffers(e.target.checked)}
                  className="w-4 h-4 accent-[#008F5A] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl">
                <div>
                  <strong className="block text-[#111827] dark:text-[#F9FAFB]">Rider Proximity Alerts</strong>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">When rider is 200m away</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifDeliveryPings}
                  onChange={(e) => setNotifDeliveryPings(e.target.checked)}
                  className="w-4 h-4 accent-[#008F5A] cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setShowNotifModal(false);
                showToast('Notification preferences saved!', 'success');
              }}
              className="w-full py-3 bg-[#008F5A] hover:bg-[#007044] text-white font-black text-xs rounded-xl shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* ══ NEED HELP / SUPPORT MODAL ══ */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-[#008F5A] dark:text-emerald-400 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#111827] dark:text-[#F9FAFB]">
                    Need Help?
                  </h3>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">10-Min Fast Support</span>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1B2430] text-[#6B7280] dark:text-[#9CA3AF] flex items-center justify-center hover:text-[#111827] dark:hover:text-[#F9FAFB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <a
                href="tel:18002081010"
                className="p-3.5 bg-slate-50 dark:bg-[#1B2430] hover:bg-slate-100 dark:hover:bg-[#263241] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl flex items-center gap-3 font-bold text-[#111827] dark:text-[#F9FAFB] transition-colors"
              >
                <Phone className="w-4 h-4 text-[#008F5A] dark:text-emerald-400" />
                <div>
                  <span className="block text-xs font-black">Call Support Helpline</span>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-mono">1800-208-1010 (Toll Free)</span>
                </div>
              </a>

              <a
                href="https://wa.me/918698893348?text=Hi%20PocketKirana%20Support,%20I%20need%20help%20with%20my%20order"
                target="_blank"
                rel="noreferrer"
                className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center gap-3 font-bold text-[#008F5A] dark:text-emerald-300 transition-colors"
              >
                <span className="text-base">💬</span>
                <div>
                  <span className="block text-xs font-black">Chat on WhatsApp</span>
                  <span className="text-[10px] text-[#008F5A] dark:text-emerald-400">Instant agent replies</span>
                </div>
              </a>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-3 bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#263241] text-[#374151] dark:text-[#D1D5DB] font-black text-xs rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </CustomerShell>
  );
}
