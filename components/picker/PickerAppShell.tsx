'use client';

import React, { useState } from 'react';
import { Picker } from '@/types';
import {
  Home,
  Package,
  Scan,
  Archive,
  User,
  Bell,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  Store,
  HelpCircle,
  Clock,
  ClipboardCheck
} from 'lucide-react';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';

interface PickerAppShellProps {
  picker: Picker;
  activeTab: 'home' | 'tasks' | 'scan' | 'putaway' | 'profile';
  onTabChange: (tab: 'home' | 'tasks' | 'scan' | 'putaway' | 'profile') => void;
  onOpenStockCountModal?: () => void;
  onOpenNewProductModal?: () => void;
  unreadAlertsCount?: number;
  children: React.ReactNode;
}

export const PickerAppShell: React.FC<PickerAppShellProps> = ({
  picker,
  activeTab,
  onTabChange,
  onOpenStockCountModal,
  onOpenNewProductModal,
  unreadAlertsCount = 0,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <RoleSwitcher />

      {/* ── TOP MOBILE HEADER ── */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          
          {/* Brand & Store Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer active:scale-95"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-white tracking-tight">PocketKirana</span>
                <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                  Picker
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-bold block truncate max-w-[140px]">
                {picker.storeName}
              </span>
            </div>
          </div>

          {/* Right Status Badge */}
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>ON DUTY</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER (Mobile-First Canvas) ── */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-4 pb-24 space-y-4">
        {children}
      </main>

      {/* ── BOTTOM APP NAVIGATION (5 Core Tabs) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl">
        <div className="max-w-md mx-auto grid grid-cols-5 h-16">
          <button
            onClick={() => onTabChange('home')}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'text-emerald-400 font-black scale-105'
                : 'text-slate-400 hover:text-slate-200 font-bold'
            }`}
          >
            <Home className="w-4 h-4" />
            <span className="text-[10px]">Home</span>
          </button>

          <button
            onClick={() => onTabChange('tasks')}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'text-emerald-400 font-black scale-105'
                : 'text-slate-400 hover:text-slate-200 font-bold'
            }`}
          >
            <Package className="w-4 h-4" />
            <span className="text-[10px]">Tasks</span>
          </button>

          <button
            onClick={() => onTabChange('scan')}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'text-emerald-400 font-black scale-105'
                : 'text-slate-400 hover:text-slate-200 font-bold'
            }`}
          >
            <Scan className="w-4 h-4" />
            <span className="text-[10px]">Scan</span>
          </button>

          <button
            onClick={() => onTabChange('putaway')}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'putaway'
                ? 'text-emerald-400 font-black scale-105'
                : 'text-slate-400 hover:text-slate-200 font-bold'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span className="text-[10px]">Putaway</span>
          </button>

          <button
            onClick={() => onTabChange('profile')}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'text-emerald-400 font-black scale-105'
                : 'text-slate-400 hover:text-slate-200 font-bold'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="text-[10px]">Profile</span>
          </button>
        </div>
      </nav>

      {/* ── SIDE DRAWER ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex">
          <div className="w-72 bg-slate-900 border-r border-slate-800 h-full p-5 flex flex-col justify-between animate-in slide-in-from-left duration-200 text-white">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                    PK
                  </div>
                  <div>
                    <h3 className="font-black text-sm">PocketKirana</h3>
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">Picker Hub</span>
                  </div>
                </div>

                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Picker Card */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <strong className="text-white block font-bold text-sm">{picker.name}</strong>
                <span className="text-xs text-slate-400 font-mono block">ID: {picker.employeeId}</span>
                <span className="text-[11px] text-emerald-400 block font-bold">{picker.storeName}</span>
              </div>

              {/* Tools & Actions */}
              <div className="space-y-1 text-xs font-bold text-slate-300">
                <button
                  onClick={() => {
                    if (onOpenStockCountModal) onOpenStockCountModal();
                    setDrawerOpen(false);
                  }}
                  className="w-full p-3 rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                    <span>Shelf Stock Count Audit</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => {
                    if (onOpenNewProductModal) onOpenNewProductModal();
                    setDrawerOpen(false);
                  }}
                  className="w-full p-3 rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Report Unknown Barcode</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500 font-mono">
              PocketKirana Picker App v2.4 • Store Connected
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
