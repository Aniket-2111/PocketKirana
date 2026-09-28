'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { 
  Home, 
  Grid, 
  Search, 
  User, 
  ShoppingCart, 
  MapPin, 
  ChevronDown,
  ArrowLeft,
} from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { CustomerLocationPermissionGuard } from './LocationPermissionGuard';
import { initThemeListener } from '../lib/themeUtils';
import FreeDeliveryProgressBar from './customer/FreeDeliveryProgressBar';
import { locationFlowService, LocationFlowState } from '@/lib/locationFlowService';
import PostLoginNotificationDialog from './customer/PostLoginNotificationDialog';

interface CustomerShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backUrl?: string;
  hideBottomNav?: boolean;
  noPadding?: boolean;
  fixedViewport?: boolean;
  hideFooter?: boolean;
}

export default function CustomerShell({
  children,
  title,
  showBack = false,
  backUrl,
  hideBottomNav = false,
  noPadding = false,
  fixedViewport = false,
  hideFooter = false,
}: CustomerShellProps) {
  // Ref to the single MobileBottomStack container
  const bottomStackRef = useRef<HTMLDivElement>(null);
  const rawPathname = usePathname();
  const pathname = rawPathname || '/';
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const isCartOrCheckout = cleanPath === '/cart' || cleanPath === '/checkout' || cleanPath.startsWith('/checkout/');
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
  const [locFlowState, setLocFlowState] = useState<LocationFlowState>(() => locationFlowService.getState());

  useEffect(() => {
    const unsub = locationFlowService.subscribe(setLocFlowState);
    return () => unsub();
  }, []);

  // ── MobileBottomStack height tracking ──────────────────────────────────────
  // Whenever the stack resizes (cart appears/disappears, free-delivery bar
  // transitions) write the real pixel height to a CSS custom property on <html>
  // so that main content can always reserve exactly the right amount of space.
  const updateBottomStackHeight = useCallback(() => {
    if (hideBottomNav || !bottomStackRef.current) {
      document.documentElement.style.setProperty('--bottom-stack-height', '0px');
      return;
    }
    const h = Math.ceil(bottomStackRef.current.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--bottom-stack-height', `${h}px`);
  }, [hideBottomNav]);

  useEffect(() => {
    updateBottomStackHeight();
    if (!bottomStackRef.current) return;
    const ro = new ResizeObserver(updateBottomStackHeight);
    ro.observe(bottomStackRef.current);
    return () => ro.disconnect();
  }, [updateBottomStackHeight]);

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

  const selectedAddressLabel = locFlowState.selectedLocation
    ? `${locFlowState.selectedLocation.addressLine}${locFlowState.selectedLocation.city ? ', ' + locFlowState.selectedLocation.city : ''}`
    : `${defaultAddress.addressLine1}, ${defaultAddress.city}`;

  const isUnserviceable = locFlowState.status === 'UNSERVICEABLE';
  const isStoreClosed = locFlowState.status === 'STORE_CLOSED';

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
    <PostLoginNotificationDialog />
    <div className={`${fixedViewport ? 'h-[100dvh] overflow-hidden' : 'min-h-screen overflow-x-hidden'} bg-[#FFFFFF] dark:bg-[#0B0F14] text-[#111827] dark:text-[#F9FAFB] flex flex-col font-sans selection:bg-emerald-600 selection:text-white transition-colors duration-200 w-full`}>
      
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
                  {isUnserviceable ? (
                    <span className="bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase border border-red-200 dark:border-red-800/40">
                      Unserviceable
                    </span>
                  ) : isStoreClosed ? (
                    <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase border border-amber-200 dark:border-amber-800/40">
                      Store Closed
                    </span>
                  ) : (
                    <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase border border-emerald-200 dark:border-emerald-800/40">
                      30 Mins
                    </span>
                  )}
                </div>
                {/* Delivery Location Pill */}
                <button
                  onClick={() => locationFlowService.openManualPicker()}
                  className="flex items-center gap-1 text-[11px] text-[#374151] dark:text-[#D1D5DB] font-bold truncate text-left hover:text-[#008F5A] dark:hover:text-[#45C483] transition-colors cursor-pointer"
                >
                  <MapPin className={`w-3 h-3 ${isUnserviceable ? 'text-red-500' : 'text-emerald-600'} shrink-0`} />
                  <span className="truncate max-w-[140px] sm:max-w-[180px]">{selectedAddressLabel}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 underline font-medium ml-0.5">change</span>
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

      {/* ── ACTUAL PAGE SCROLL CONTAINER ──────────────────────────────────────
          Single scroll root holding page content and customer footer.
          Clearance for MobileBottomStack is applied dynamically at the bottom
          of the scroll container so that all content (products, recommendations,
          categories, and all footer links) can scroll 100% clear of the bottom stack.
      ──────────────────────────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col w-full min-h-0 ${fixedViewport ? 'overflow-hidden' : ''}`}>
        <main
          className={`flex-1 min-h-0 w-full ${
            fixedViewport || noPadding
              ? 'p-0 flex flex-col overflow-hidden'
              : 'px-3 sm:px-4 py-3 sm:py-4 space-y-4'
          }`}
        >
          {children}
        </main>

        {/* ── CUSTOMER FOOTER ── */}
        {!fixedViewport && !hideFooter && <Footer />}

        {/* ── DYNAMIC CLEARANCE SPACER ──
            Reserves exact measured MobileBottomStack height + safe-area bottom inset.
            Ensures page content & footer scroll 100% clear of all fixed bottom layers. ── */}
        {!fixedViewport && !hideBottomNav && (
          <div
            style={{
              height: 'calc(var(--bottom-stack-height, 64px) + env(safe-area-inset-bottom, 0px))',
            }}
            aria-hidden="true"
            className="shrink-0 w-full pointer-events-none"
          />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE BOTTOM STACK — single layout owner for all three fixed layers.

          Stacking order from bottom of screen upward:
            1. Bottom Navigation Bar   (always visible when !hideBottomNav)
            2. Floating Cart Pill      (visible when cart has items & not on cart/checkout page)
            3. Free Delivery Progress  (visible same condition as cart pill)

          Z-Index: z-30 (keeps it below Top Header z-40 and all Modals z-50/z-[60]).
          ResizeObserver on this container measures the real rendered height and
          publishes it as --bottom-stack-height so main content pads correctly.
      ════════════════════════════════════════════════════════════════════════ */}
      {!hideBottomNav && (
        <div
          ref={bottomStackRef}
          className="fixed bottom-0 left-0 right-0 z-30 flex flex-col pointer-events-auto"
        >
          {/* ── Layer 3 (topmost): Floating Cart Pill + Free Delivery Bar ── */}
          {!isCartOrCheckout && mounted && totalCartCount > 0 && (
            <div className="px-3 pb-1.5 pt-1 space-y-1.5 max-w-lg w-full mx-auto">

              {/* Free Delivery Progress Widget */}
              <div className="animate-in slide-in-from-bottom-2 duration-200">
                <FreeDeliveryProgressBar variant="floating" />
              </div>

              {/* Cart Pill */}
              <div
                onClick={() => router.push('/cart')}
                className="animate-in slide-in-from-bottom-2 duration-200 bg-[#006E2F] hover:bg-[#005a26] text-white px-3 py-1.5 rounded-xl shadow-md flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all border border-emerald-400/30"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center font-black text-[10px]">
                    {totalCartCount}
                  </div>
                  <div>
                    <div className="text-[11px] font-black tracking-tight leading-tight">
                      {totalCartCount} {totalCartCount === 1 ? 'ITEM' : 'ITEMS'} • ₹{cartSubtotal}
                    </div>
                    <div className="text-[9px] text-emerald-100 font-medium leading-tight">
                      View cart
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-white text-[#006E2F] font-black text-[10px] px-2.5 py-1 rounded-lg shadow-2xs">
                  <span>Cart</span>
                  <span className="text-xs leading-none">→</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Layer 1 (bottom): Navigation Bar ── */}
          <nav className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#263241] shadow-xl w-full shrink-0">
            <div className="w-full grid grid-cols-4 h-16">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href === '/home' && pathname === '/') ||
                  (item.href !== '/home' && item.href !== '/' && pathname.startsWith(item.href));
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
                    <span className={`text-[10px] ${isActive ? 'text-[#008F5A] dark:text-[#22C55E]' : 'text-[#6B7280] dark:text-[#9CA3AF]'}`}>
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      )}

    </div>
    </CustomerLocationPermissionGuard>
  );
}
