'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { 
  Home, 
  Package, 
  Scan, 
  Archive, 
  User, 
  Menu, 
  X, 
  LogOut, 
  Bell, 
  Store,
  Sliders,
  ChevronRight,
  ClipboardCheck,
  Sparkles
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface PickerShellProps {
  children: React.ReactNode;
}

export default function PickerShell({ children }: PickerShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { 
    pickers, 
    activePickerId, 
    isLoggedIn, 
    currentUser, 
    logout,
    togglePickerStatus,
    initializeFirebaseSync 
  } = useAppStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      const isFirebaseAbortError = (err: any) => {
        if (!err) return false;
        const msg = String(err.message || err.reason?.message || err || '').toLowerCase();
        const name = String(err.name || err.reason?.name || '').toLowerCase();
        
        return (
          name === 'aborterror' ||
          msg.includes('signal is aborted') ||
          msg.includes('aborted without reason') ||
          msg.includes('aborted') ||
          msg.includes('failed to fetch') ||
          msg.includes('firestore.googleapis.com') ||
          msg.includes('webchannel') ||
          msg.includes('networkerror') ||
          (name === 'typeerror' && msg.includes('fetch'))
        );
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        if (isFirebaseAbortError(event.reason) || isFirebaseAbortError(event)) {
          event.preventDefault(); // Suppress runtime popup for non-fatal network aborts
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
      };

      const handleError = (event: ErrorEvent) => {
        if (isFirebaseAbortError(event.error) || isFirebaseAbortError(event.message) || isFirebaseAbortError(event)) {
          event.preventDefault();
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
      window.addEventListener('error', handleError, true);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
        window.removeEventListener('error', handleError, true);
      };
    }
  }, []);

  // Authenticated Role Guard (Client-side redirect if not authenticated/authorized)
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, router]);

  useEffect(() => {
    // Always force picker role in picker workspace so Firebase sync fetches all orders
    const state = useAppStore.getState();
    if (state.activeRole !== 'picker') {
      useAppStore.setState({ activeRole: 'picker', hasSyncedFirebase: false } as any);
    }
    initializeFirebaseSync();
  }, [initializeFirebaseSync]);

  const picker = pickers.find((p) => p.id === activePickerId) || pickers[0] || {
    id: 'picker-1',
    name: currentUser?.firstName || 'Rahul',
    employeeId: 'PK-PICK-001',
    storeId: 'store-001',
    storeName: 'MG Road Store',
    status: 'online',
    activeTaskId: undefined,
    statistics: {
      ordersPickedToday: 15,
      pickingTimeAvgMinutes: 8.5,
      itemsPerMinute: 12,
      accuracyRate: 98.4,
    },
  };

  const navItems = [
    { name: 'Home', href: '/home', icon: Home },
    { name: 'Orders', href: '/tasks', icon: Package },
    { name: 'Putaway', href: '/putaway', icon: Archive },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const handleLogout = () => {
    logout();
    showToast('Logged out successfully', 'info');
    router.replace('/login');
  };

  const handleToggleDuty = () => {
    togglePickerStatus(picker.id);
    const nextStatus = picker.status === 'active' || picker.status === 'busy' ? 'OFF DUTY' : 'ON DUTY';
    showToast(`Status changed to ${nextStatus}`, 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans selection:bg-emerald-600 selection:text-white">
      
      {/* ── DESKTOP SIDEBAR NAVIGATION ── */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 h-screen sticky top-0 p-5 justify-between shadow-xs">
        <div className="space-y-6">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-600/20">
              PK
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight text-slate-900 uppercase">PocketKirana</h3>
              <span className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider block">
                Picker Workspace
              </span>
            </div>
          </div>

          {/* Assigned Store */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-2.5">
            <Store className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wider">Assigned Store</span>
              <strong className="text-slate-900 text-xs font-bold block truncate">{picker.storeName || 'MG Road Store'}</strong>
            </div>
          </div>

          {/* Duty Status Pill */}
          <button 
            onClick={handleToggleDuty}
            className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
              picker.status === 'active' || picker.status === 'busy'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${picker.status === 'active' || picker.status === 'busy' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{picker.status === 'active' || picker.status === 'busy' ? 'ON DUTY' : 'OFF DUTY'}</span>
            </div>
            <span className="text-[9px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-wider">Toggle</span>
          </button>

          {/* Nav Links */}
          <nav className="space-y-1.5 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5 shrink-0" />
            <span>Sign Out Shift</span>
          </button>
          <div className="text-[10px] text-slate-400 font-mono text-center">
            PK Picker v2.4 • Active
          </div>
        </div>
      </aside>

      {/* ── MOBILE TOP HEADER ── */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shrink-0 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-colors cursor-pointer active:scale-95"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-slate-900 tracking-tight">PocketKirana</span>
                <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                  Picker
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold block truncate max-w-[140px]">
                {picker.storeName || 'MG Road Store'}
              </span>
            </div>
          </div>

          {/* Duty toggle on mobile */}
          <button 
            onClick={handleToggleDuty}
            className={`px-3 py-1 rounded-full border flex items-center gap-1.5 text-[10px] font-black font-mono transition-all cursor-pointer ${
              picker.status === 'active' || picker.status === 'busy'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${picker.status === 'active' || picker.status === 'busy' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>{picker.status === 'active' || picker.status === 'busy' ? 'ON DUTY' : 'OFF DUTY'}</span>
          </button>
        </div>
      </header>

      {/* ── CONTENT CANVAS ── */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 max-w-md md:max-w-4xl mx-auto w-full pb-24 md:pb-8">
        {!isOnline && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>Offline Mode • Picking progress saved locally</span>
            </div>
            <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-black">
              Sync Pending
            </span>
          </div>
        )}
        {children}
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION BAR ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl">
        <div className="grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isActive
                    ? 'text-emerald-700 font-black scale-105'
                    : 'text-slate-400 hover:text-slate-700 font-bold'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span className="text-[10px]">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── MOBILE SLIDE-OUT MENU DRAWER ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex">
          <div className="w-72 bg-white border-r border-slate-200 h-full p-5 flex flex-col justify-between animate-in slide-in-from-left duration-200 text-slate-900 shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">
                    PK
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">PocketKirana</h3>
                    <span className="text-[10px] text-emerald-700 uppercase font-bold">Picker Hub</span>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer User Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <strong className="text-slate-900 block font-bold text-sm">{picker.name}</strong>
                <span className="text-xs text-slate-500 font-mono block">ID: {picker.employeeId}</span>
                <span className="text-[11px] text-emerald-700 block font-bold">{picker.storeName}</span>
              </div>

              {/* Actions & Links */}
              <div className="space-y-1 text-xs font-bold text-slate-700">
                <button
                  onClick={() => {
                    router.push('/profile');
                    setDrawerOpen(false);
                  }}
                  className="w-full p-3 rounded-xl hover:bg-slate-100 flex items-center justify-between transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                    <span>Audit Stock Count</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full p-3 rounded-xl hover:bg-rose-50 flex items-center justify-between transition-colors text-left text-rose-600 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-4.5 h-4.5" />
                    <span>Sign Out Shift</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 font-mono">
              PocketKirana Picker App v2.4
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
