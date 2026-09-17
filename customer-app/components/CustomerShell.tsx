'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { 
  Home, 
  Grid, 
  Search, 
  Package, 
  User, 
  ShoppingCart, 
  MapPin, 
  ChevronDown,
  Bell,
  ArrowLeft,
  Sparkles,
  Phone
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { Footer } from '@/components/layout/Footer';
import { CustomerLocationPermissionGuard } from './LocationPermissionGuard';
import { initThemeListener } from '../lib/themeUtils';

interface CustomerShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backUrl?: string;
  hideBottomNav?: boolean;
  noPadding?: boolean;
  fixedViewport?: boolean;
}

export default function CustomerShell({
  children,
  title,
  showBack = false,
  backUrl,
  hideBottomNav = false,
  noPadding = false,
  fixedViewport = false,
}: CustomerShellProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname || '/';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { 
    cart, 
    addresses, 
    isLoggedIn, 
    currentUser, 
    initializeFirebaseSync,
    activeRole
  } = useAppStore();

  const [isOnline, setIsOnline] = useState(true);
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
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
          event.preventDefault();
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

  useEffect(() => {
    // Ensure customer role in store and initialize real-time synchronization
    const state = useAppStore.getState();
    if (state.activeRole !== 'customer') {
      useAppStore.setState({ activeRole: 'customer', hasSyncedFirebase: false } as any);
    }
    initializeFirebaseSync();
  }, [initializeFirebaseSync]);

  useEffect(() => {
    // Initialize and listen for real-time OS preference changes
    const cleanup = initThemeListener();
    return cleanup;
  }, []);

  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0] || {
    addressLine1: 'Express DarkStore Hub',
    city: 'Neral',
    postalCode: '410101',
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const navItems = [
    { name: 'Home', href: '/home', icon: Home },
    { name: 'Categories', href: '/categories', icon: Grid },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <CustomerLocationPermissionGuard>
    <div className={`${fixedViewport ? 'h-[100dvh] h-screen overflow-hidden' : 'min-h-screen pb-20 overflow-x-hidden'} bg-[#FFFFFF] dark:bg-[#0B0F14] text-[#111827] dark:text-[#F9FAFB] flex flex-col font-sans selection:bg-emerald-600 selection:text-white transition-colors duration-200 w-full`}>
      
      {/* ── TOP HEADER BAR ── */}
      <header className="shrink-0 z-40 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#263241] px-3 sm:px-4 py-2.5 sm:py-3 shadow-2xs w-full">
        <div className="w-full flex items-center justify-between gap-3">
          
          {showBack ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => (backUrl ? router.push(backUrl) : router.back())}
                className="w-10 h-10 rounded-2xl bg-[#F9FAFB] dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] flex items-center justify-center text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#263241] transition-colors cursor-pointer active:scale-95 shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-base font-black text-[#111827] dark:text-[#F9FAFB] truncate">
                {title || 'Pocket Kirana'}
              </h1>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo-icon.png"
                alt="Pocket Kirana"
                className="w-10 h-10 object-contain rounded-2xl bg-white p-1 border border-emerald-200 dark:border-emerald-800 shadow-md shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-[#111827] dark:text-[#F9FAFB] tracking-tight">Pocket Kirana</span>
                  <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase border border-emerald-200 dark:border-emerald-800/40">
                    30 Mins
                  </span>
                </div>
                {/* Delivery Location Pill */}
                <button
                  onClick={() => router.push('/saved-addresses')}
                  className="flex items-center gap-1 text-[11px] text-[#374151] dark:text-[#D1D5DB] font-bold truncate text-left hover:text-[#008F5A] dark:hover:text-[#45C483] transition-colors cursor-pointer"
                >
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[170px]">{defaultAddress.addressLine1}, {defaultAddress.city}</span>
                  <ChevronDown className="w-3 h-3 text-[#6B7280] dark:text-[#9CA3AF] shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* Right Header Actions: Search shortcut & Cart button */}
          <div className="flex items-center gap-2 shrink-0">
            {!showBack && pathname !== '/search' && (
              <button
                onClick={() => router.push('/search')}
                className="w-10 h-10 rounded-2xl bg-[#F9FAFB] dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] flex items-center justify-center text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#263241] transition-colors cursor-pointer active:scale-95"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
            )}

            <button
              id="header-cart-btn"
              data-cart-target="true"
              onClick={() => router.push('/cart')}
              className="relative py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center gap-2 shadow-md shadow-emerald-600/20 font-black text-xs transition-transform active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartCount > 0 ? (
                <span>₹{cartSubtotal}</span>
              ) : (
                <span>Cart</span>
              )}
              {totalCartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* ── OFFLINE STATUS NOTICE ── */}
      {!isOnline && (
        <div className="bg-amber-50 dark:bg-[#1B2430] border-b border-amber-200 dark:border-amber-700/40 text-amber-800 dark:text-amber-300 px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>You are currently offline. Product catalog from local cache.</span>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <main className={`flex-1 min-h-0 w-full ${fixedViewport || noPadding ? 'p-0 flex flex-col overflow-hidden' : 'px-3 sm:px-4 py-3 sm:py-4 space-y-4'}`}>
        {children}
      </main>

      {/* ── CUSTOMER FOOTER ── */}
      {!fixedViewport && <Footer />}

      {/* ── STICKY FLOATING CART & CHECKOUT BAR ── */}
      {mounted && totalCartCount > 0 && pathname !== '/cart' && pathname !== '/checkout' && !pathname.startsWith('/checkout/') && (
        <div className={`fixed ${hideBottomNav ? 'bottom-4' : 'bottom-20'} left-3 right-3 z-50 max-w-lg mx-auto animate-in slide-in-from-bottom-4 duration-200`}>
          <div
            onClick={() => router.push('/checkout')}
            className="bg-[#006E2F] hover:bg-[#005a26] text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all border border-emerald-400/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-xs">
                {totalCartCount}
              </div>
              <div>
                <div className="text-xs font-black tracking-wide">
                  {totalCartCount} {totalCartCount === 1 ? 'ITEM' : 'ITEMS'} • ₹{cartSubtotal}
                </div>
                <div className="text-[10px] text-emerald-100 font-medium">
                  Extra items saved in cart
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white text-[#006E2F] font-black text-xs px-3.5 py-2 rounded-xl shadow-xs">
              <span>Checkout</span>
              <span className="text-sm leading-none">→</span>
            </div>
          </div>
        </div>
      )}

      {/* ── STICKY BOTTOM NAVIGATION BAR ── */}
      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#263241] shadow-xl w-full">
          <div className="w-full grid grid-cols-4 h-16">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === '/home' && pathname === '/') || (item.href !== '/home' && item.href !== '/' && pathname.startsWith(item.href));
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    isActive
                      ? 'text-[#008F5A] dark:text-[#22C55E] font-black scale-105'
                      : 'text-[#6B7280] dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-[#F9FAFB] font-bold'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className={`text-[10px] ${isActive ? 'text-[#008F5A] dark:text-[#22C55E]' : 'text-[#6B7280] dark:text-[#9CA3AF]'}`}>{item.name}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

    </div>
    </CustomerLocationPermissionGuard>
  );
}
