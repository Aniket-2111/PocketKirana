'use client';

import React, { useState } from 'react';
import { DeliveryPartner } from '@/types';
import {
  Home,
  Package,
  IndianRupee,
  User,
  Power,
  Bell,
  Sparkles,
  ShieldCheck,
  Phone,
  HelpCircle,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Bike
} from 'lucide-react';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { PartnerNotificationCenter } from './PartnerNotificationCenter';

interface PartnerAppShellProps {
  partner: DeliveryPartner;
  activeTab: 'home' | 'orders' | 'profile' | 'support';
  onTabChange: (tab: 'home' | 'orders' | 'profile' | 'support') => void;
  onToggleOnline: () => void;
  unreadNotifsCount?: number;
  children: React.ReactNode;
}

export const PartnerAppShell: React.FC<PartnerAppShellProps> = ({
  partner,
  activeTab,
  onTabChange,
  onToggleOnline,
  unreadNotifsCount = 0,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);

  const isOnline = partner.currentStatus === 'online' || partner.currentStatus === 'busy';

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#121c2a] flex flex-col font-sans selection:bg-[#22c55e] selection:text-white">
      {/* Dev / Demo Role Switcher */}
      <RoleSwitcher />

      {/* ── TOP APP BAR (Header) ── */}
      <header className="sticky top-0 z-40 bg-[#f8f9ff]/90 backdrop-blur-md border-b border-gray-200/80 px-4 h-14 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1 rounded-lg text-[#3d4a3d] hover:bg-gray-200/60 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>

          <h1 className="text-lg font-bold text-[#006e2f] tracking-tight flex items-center gap-1.5">
            PocketKirana <span className="text-xs bg-[#22c55e]/15 text-[#006e2f] px-2 py-0.5 rounded-full font-semibold">Delivery</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Online/Offline Quick Switch */}
          <button
            onClick={onToggleOnline}
            className="flex items-center bg-[#dee9fc] rounded-full px-3 py-1 cursor-pointer border border-[#bccbb9]/40 hover:bg-[#d9e3f6] transition-all active:scale-95"
          >
            <span className="text-xs font-semibold text-[#121c2a] mr-2">
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <div
              className={`w-9 h-5 rounded-full relative shadow-inner transition-colors ${
                isOnline ? 'bg-[#22c55e]' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                  isOnline ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </div>
          </button>

          {/* Notifications Bell */}
          <button
            onClick={() => setNotifsOpen(true)}
            className="relative p-1.5 rounded-full text-[#3d4a3d] hover:bg-gray-200/60 transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-2xl">notifications_active</span>
            {unreadNotifsCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#006e2f] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {unreadNotifsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT CANVAS ── */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 pb-24 space-y-5">
        {children}
      </main>

      {/* ── BOTTOM APP NAVIGATION BAR (3 Tabs: Deliveries, Profile, Support) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#ffffff] border-t border-gray-200/80 shadow-[0px_-4px_20px_rgba(0,0,0,0.08)] rounded-t-2xl py-2 px-4">
        <div className="max-w-md mx-auto flex justify-around items-center">
          
          {/* Deliveries / Home */}
          <button
            onClick={() => onTabChange('home')}
            className={`flex flex-col items-center justify-center px-6 py-1 rounded-full transition-all active:scale-95 cursor-pointer ${
              activeTab === 'home' || activeTab === 'orders'
                ? 'bg-[#acf847] text-[#102000] font-bold shadow-xs'
                : 'text-[#3d4a3d] hover:text-[#121c2a]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">local_shipping</span>
            <span className="text-[11px] font-medium mt-0.5">Deliveries</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => onTabChange('profile')}
            className={`flex flex-col items-center justify-center px-6 py-1 rounded-full transition-all active:scale-95 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#acf847] text-[#102000] font-bold shadow-xs'
                : 'text-[#3d4a3d] hover:text-[#121c2a]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">person</span>
            <span className="text-[11px] font-medium mt-0.5">Profile</span>
          </button>

          {/* Support */}
          <button
            onClick={() => onTabChange('support')}
            className={`flex flex-col items-center justify-center px-6 py-1 rounded-full transition-all active:scale-95 cursor-pointer ${
              activeTab === 'support'
                ? 'bg-[#acf847] text-[#102000] font-bold shadow-xs'
                : 'text-[#3d4a3d] hover:text-[#121c2a]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">contact_support</span>
            <span className="text-[11px] font-medium mt-0.5">Support</span>
          </button>

        </div>
      </nav>

      {/* ── SIDE DRAWER ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex">
          <div className="w-72 bg-slate-900 border-r border-slate-800 h-full p-5 flex flex-col justify-between animate-in slide-in-from-left duration-200 text-white">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <img
                    src="/logo-icon.png"
                    alt="Pocket Kirana"
                    className="w-12 h-12 object-contain rounded-2xl bg-white p-1.5 shadow-lg border border-slate-700"
                  />
                  <div>
                    <h3 className="font-black text-sm">PocketKirana</h3>
                    <span className="text-[11px] text-emerald-400 font-bold uppercase">Rider Portal</span>
                  </div>
                </div>

                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Rider Summary Card in Drawer */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <strong className="text-white block font-bold text-sm">{partner.name}</strong>
                <span className="text-xs text-slate-400 block font-mono">{partner.phone}</span>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">Wallet:</span>
                  <strong className="text-emerald-400 font-mono font-black">₹{partner.walletBalance}</strong>
                </div>
              </div>

              {/* Drawer Links */}
              <div className="space-y-1 text-xs font-bold text-slate-300">
                <button
                  onClick={() => {
                    onTabChange('home');
                    setDrawerOpen(false);
                  }}
                  className="w-full p-3 rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Home className="w-4 h-4 text-emerald-400" />
                    <span>Home Dashboard</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => {
                    onTabChange('profile');
                    setDrawerOpen(false);
                  }}
                  className="w-full p-3 rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>KYC &amp; Documents</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <a
                  href="tel:+918698893348"
                  className="w-full p-3 rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <span>Rider Support Hotline</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </a>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500 font-mono">
              PocketKirana Rider App v2.4 • Connected to Firebase
            </div>
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      <PartnerNotificationCenter
        isOpen={notifsOpen}
        onClose={() => setNotifsOpen(false)}
        partnerId={partner.id}
      />
    </div>
  );
};
