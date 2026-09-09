'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { 
  Bike, 
  Package, 
  MapPin, 
  User, 
  Clock, 
  LogOut, 
  CheckCircle2, 
  Navigation,
  ShieldCheck,
  Bell,
  Power
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface DeliveryShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backUrl?: string;
}

export default function DeliveryShell({
  children,
  title,
  showBack = false,
  backUrl,
}: DeliveryShellProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname || '/home';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { 
    deliveryPartners, 
    activePartnerId, 
    authenticatedPartnerId, 
    togglePartnerStatus,
    logoutDeliveryPartner,
    initializeFirebaseSync 
  } = useAppStore();

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    // Set active role to delivery_partner and initialize real-time synchronization
    const state = useAppStore.getState();
    if (state.activeRole !== 'delivery_partner') {
      useAppStore.setState({ activeRole: 'delivery_partner', hasSyncedFirebase: false } as any);
    }
    initializeFirebaseSync();
  }, [initializeFirebaseSync]);

  const partner = deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) || deliveryPartners[0] || {
    id: 'partner-1',
    name: 'Rahul Sharma',
    phone: '+91 8698893348',
    partnerCode: 'DP001',
    vehicleType: 'EV Scooter',
    vehicleNumber: 'MH 14 EV 2026',
    currentStatus: 'online',
    rating: 4.9,
  };

  const isPartnerOnline = partner.currentStatus === 'online' || partner.currentStatus === 'busy';

  const handleToggleDuty = () => {
    togglePartnerStatus(partner.id);
    const next = isPartnerOnline ? 'OFF DUTY' : 'ON DUTY';
    showToast(`Shift status updated to ${next}`, 'success');
  };

  const navItems = [
    { name: 'Queue', href: '/home', icon: Package },
    { name: 'Active', href: '/active', icon: Bike },
    { name: 'History', href: '/history', icon: CheckCircle2 },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-600 selection:text-white pb-20">
      
      {/* ── TOP HEADER BAR ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-2xs">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-600/20 shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-slate-900 tracking-tight">Pocket Kirana</span>
                <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                  Delivery
                </span>
              </div>
              <span className="text-[11px] text-slate-600 font-bold truncate block">
                {partner.name} ({partner.partnerCode || 'DP001'})
              </span>
            </div>
          </div>

          {/* Duty Status Toggle Pill */}
          <button
            onClick={handleToggleDuty}
            className={`py-1.5 px-3.5 rounded-full border flex items-center gap-1.5 text-[11px] font-black font-mono transition-all cursor-pointer active:scale-95 ${
              isPartnerOnline
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isPartnerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>{isPartnerOnline ? 'ON DUTY' : 'OFF DUTY'}</span>
          </button>

        </div>
      </header>

      {/* ── OFFLINE STATUS NOTICE ── */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>Device is currently offline. Status changes cached locally.</span>
        </div>
      )}

      {/* ── MAIN CONTENT CANVAS ── */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 space-y-4">
        {children}
      </main>

      {/* ── BOTTOM NAVIGATION BAR ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/home' && pathname.startsWith(item.href));
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
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
