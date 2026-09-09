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
  SlidersHorizontal
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function CustomerProfilePage() {
  const router = useRouter();
  const { currentUser, logout } = useAppStore();

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifOrderUpdates, setNotifOrderUpdates] = useState(true);
  const [notifOffers, setNotifOffers] = useState(true);
  const [notifDeliveryPings, setNotifDeliveryPings] = useState(true);

  // Initialize theme from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = (localStorage.getItem('pk_theme') as 'light' | 'dark' | 'system') || 'dark';
      setTheme(storedTheme);
      applyTheme(storedTheme);
    }
  }, []);

  const applyTheme = (targetTheme: 'light' | 'dark' | 'system') => {
    if (typeof window === 'undefined') return;
    
    let isDark = targetTheme === 'dark';
    if (targetTheme === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSelectTheme = (selectedTheme: 'light' | 'dark' | 'system') => {
    setTheme(selectedTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pk_theme', selectedTheme);
    }
    applyTheme(selectedTheme);
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
            className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer hover:border-emerald-500/40 dark:hover:border-slate-700 active:scale-95 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-[#252d3d] flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">
              Your orders
            </span>
          </button>

          {/* Tile 2: Address Book */}
          <button
            onClick={() => router.push('/saved-addresses')}
            className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer hover:border-emerald-500/40 dark:hover:border-slate-700 active:scale-95 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#252d3d] flex items-center justify-center text-blue-600 dark:text-blue-400">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">
              Addresses
            </span>
          </button>

          {/* Tile 3: Need Help */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer hover:border-emerald-500/40 dark:hover:border-slate-700 active:scale-95 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-[#252d3d] flex items-center justify-center text-purple-600 dark:text-purple-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">
              Need help?
            </span>
          </button>
        </div>

        {/* ══ APPEARANCE ACCORDION CARD (Exact Match to First Screenshot) ══ */}
        <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          
          {/* Header Bar */}
          <button
            onClick={() => setAppearanceOpen(!appearanceOpen)}
            className="w-full p-4 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-slate-800 dark:text-slate-200" />
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                Appearance
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!appearanceOpen && (
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {theme}
                </span>
              )}
              {appearanceOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {/* Radio Options Body (When Open) */}
          {appearanceOpen && (
            <div className="border-t border-slate-100 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/80">
              
              {/* Option 1: Light Theme */}
              <button
                onClick={() => handleSelectTheme('light')}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Sun className="w-4.5 h-4.5 text-amber-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Light Theme
                  </span>
                </div>
                {/* Radio Button */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  theme === 'light' 
                    ? 'border-emerald-500 bg-emerald-500' 
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
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Moon className="w-4.5 h-4.5 text-indigo-400" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Dark Theme
                  </span>
                </div>
                {/* Radio Button with Green Dot */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  theme === 'dark' 
                    ? 'border-emerald-500 bg-emerald-500' 
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
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="w-4.5 h-4.5 text-slate-400" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    System Theme
                  </span>
                </div>
                {/* Radio Button */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  theme === 'system' 
                    ? 'border-emerald-500 bg-emerald-500' 
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

        {/* ══ OTHER INFORMATION SECTION (Exact Match to Second Screenshot) ══ */}
        <div className="space-y-2 pt-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Other Information
          </h2>

          <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs text-xs font-bold text-slate-800 dark:text-slate-200 overflow-hidden">
            
            {/* 1. Share the App */}
            <button
              onClick={handleShareApp}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Share2 className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">Share the app</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* 2. About Us */}
            <button
              onClick={() => router.push('/about')}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Info className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">About us</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* 3. Account Privacy */}
            <button
              onClick={() => router.push('/privacy')}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Lock className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">Account privacy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* 5. Notification Preferences */}
            <button
              onClick={() => setShowNotifModal(true)}
              className="w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Bell className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">Notification preferences</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* 6. Log Out */}
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

        {/* ══ FOOTER LOGO & VERSION (Matching Second Screenshot) ══ */}
        <div className="text-center pt-6 pb-4 space-y-1">
          <div className="text-xl font-black tracking-tight text-slate-400 dark:text-slate-500 font-sans">
            pocketkirana
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-600 font-mono font-bold">
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
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#252d3d] rounded-2xl">
                <div>
                  <strong className="block text-slate-900 dark:text-white">Live Order Updates</strong>
                  <span className="text-[10px] text-slate-400">Order packed, dispatched &amp; delivered</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifOrderUpdates}
                  onChange={(e) => setNotifOrderUpdates(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#252d3d] rounded-2xl">
                <div>
                  <strong className="block text-slate-900 dark:text-white">Exclusive Offers &amp; Promo</strong>
                  <span className="text-[10px] text-slate-400">Daily flash discounts &amp; coupons</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifOffers}
                  onChange={(e) => setNotifOffers(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#252d3d] rounded-2xl">
                <div>
                  <strong className="block text-slate-900 dark:text-white">Rider Proximity Alerts</strong>
                  <span className="text-[10px] text-slate-400">When rider is 200m away</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifDeliveryPings}
                  onChange={(e) => setNotifDeliveryPings(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setShowNotifModal(false);
                showToast('Notification preferences saved!', 'success');
              }}
              className="w-full py-3 bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-black text-xs rounded-xl shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* ══ NEED HELP / SUPPORT MODAL ══ */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Need Help?
                  </h3>
                  <span className="text-[10px] text-slate-400">10-Min Fast Support</span>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <a
                href="tel:18002081010"
                className="p-3.5 bg-slate-50 dark:bg-[#252d3d] hover:bg-slate-100 dark:hover:bg-[#2d374a] border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-3 font-bold text-slate-900 dark:text-white transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <span className="block text-xs font-black">Call Support Helpline</span>
                  <span className="text-[10px] text-slate-400 font-mono">1800-208-1010 (Toll Free)</span>
                </div>
              </a>

              <a
                href="https://wa.me/918698893348?text=Hi%20PocketKirana%20Support,%20I%20need%20help%20with%20my%20order"
                target="_blank"
                rel="noreferrer"
                className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center gap-3 font-bold text-emerald-900 dark:text-emerald-300 transition-colors"
              >
                <span className="text-base">💬</span>
                <div>
                  <span className="block text-xs font-black">Chat on WhatsApp</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Instant agent replies</span>
                </div>
              </a>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </CustomerShell>
  );
}
