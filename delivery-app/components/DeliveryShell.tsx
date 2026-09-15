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
  Power,
  ChevronDown,
  MessageSquare,
  ClipboardList
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { LocationPermissionGuard } from './LocationPermissionGuard';

interface DeliveryShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backUrl?: string;
  fixedScreen?: boolean;
}

export default function DeliveryShell({
  children,
  title,
  showBack = false,
  backUrl,
  fixedScreen = false,
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
    if (typeof window === 'undefined') return;
    const storedAuth = localStorage.getItem('pk_delivery_authenticated_partner');
    if (!authenticatedPartnerId && !storedAuth && pathname !== '/login') {
      router.replace('/login');
    }
  }, [authenticatedPartnerId, pathname, router]);

  // Reactive listener for Admin remote logout / shift termination
  useEffect(() => {
    const currentPartner = deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId);
    if (currentPartner && currentPartner.forceLoggedOutByAdmin && pathname !== '/login') {
      showToast('🔒 Your shift has been ended and logged out by Admin.', 'info');
      logoutDeliveryPartner(currentPartner.id, true);
      router.replace('/login');
    }
  }, [deliveryPartners, authenticatedPartnerId, activePartnerId, pathname, router, logoutDeliveryPartner]);

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
    currentStatus: 'online' as const,
    rating: 4.9,
    activeOrderId: undefined as string | undefined,
  };

  const isPartnerOnline = partner.currentStatus === 'online' || partner.currentStatus === 'busy';

  const handleToggleDuty = () => {
    togglePartnerStatus(partner.id);
    const next = isPartnerOnline ? 'OFF DUTY' : 'ON DUTY';
    showToast(`Shift status updated to ${next}`, 'success');
  };

  const hasActiveTrip = !!partner.activeOrderId;

  const navItems = [
    { name: 'Orders', href: '/home', icon: ClipboardList, badge: hasActiveTrip ? '1' : undefined },
    { name: 'Messages', href: '/messages', icon: MessageSquare },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <LocationPermissionGuard>
      <div className={`bg-[#F3F5F7] text-slate-900 flex flex-col font-sans selection:bg-emerald-600 selection:text-white ${
        fixedScreen 
          ? 'h-[100dvh] w-full overflow-hidden fixed inset-0 pb-16' 
          : 'min-h-screen pb-20'
      }`}>
      
      {/* ── TOP HEADER BAR — Reference Design ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/70 px-4 py-3 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          
          {/* Left: Avatar + Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-full bg-[#0F532B] text-white flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5" />
              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                isPartnerOnline ? 'bg-emerald-400' : 'bg-slate-400'
              }`} />
            </div>
            <div className="min-w-0">
              <span className="font-black text-sm text-slate-900 tracking-tight block">PocketKirana</span>
              <span className="text-[11px] text-slate-500 font-medium block">Delivery Partner</span>
            </div>
          </div>

          {/* Right: Online/Offline duty toggle */}
          <button
            onClick={handleToggleDuty}
            type="button"
            className={`py-1.5 px-3.5 rounded-full border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              isPartnerOnline
                ? 'bg-emerald-50 border-emerald-300 text-[#0F532B]'
                : 'bg-slate-100 border-slate-300 text-slate-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              isPartnerOnline ? 'bg-[#0F532B] animate-pulse' : 'bg-slate-400'
            }`} />
            <span>{isPartnerOnline ? 'Online' : 'Offline'}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

        </div>
      </header>

      {/* ── OFFLINE STATUS NOTICE ── */}
      {!isOnline && (
        <div className="bg-slate-900 text-white px-4 py-1.5 text-[11px] font-semibold text-center flex items-center justify-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>You are offline — go Online to receive new deliveries</span>
        </div>
      )}

      {/* ── MAIN CONTENT CANVAS ── */}
      <main className={fixedScreen ? 'flex-1 relative w-full h-full max-w-md mx-auto overflow-hidden' : 'flex-1 max-w-md mx-auto w-full px-4 py-4 space-y-4'}>
        {children}
      </main>

      {/* ── BOTTOM NAVIGATION BAR — Reference Design ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/80">
        <div className="max-w-md mx-auto grid grid-cols-3 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = 
              pathname === item.href || 
              (item.href === '/home' && (pathname === '/' || pathname === '/home')) ||
              (item.href !== '/home' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 pt-0.5 transition-colors cursor-pointer ${
                  isActive ? 'text-[#0F532B]' : 'text-slate-400'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#0F532B] rounded-b-full" />
                )}
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                  {(item as any).badge && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-[#0F532B] text-white text-[8px] font-black flex items-center justify-center border-[1.5px] border-white">
                      {(item as any).badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold ${isActive ? 'font-black' : ''}`}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      </div>
    </LocationPermissionGuard>
  );
}
