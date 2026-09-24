'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { LocationPickerModal } from '@/components/customer/LocationPickerModal';
import {
  Search,
  ShoppingBag,
  MapPin,
  ChevronDown,
  X,
  User as UserIcon,
  Zap,
} from 'lucide-react';
import { NotificationBell } from '@/components/customer/NotificationBell';

interface HeaderProps {
  onOpenCart: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCart, onOpenAuth }) => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    cart,
    searchQuery,
    setSearchQuery,
    products,
    categories,
    currentUser,
    isLoggedIn,
    addresses,
  } = useAppStore();

  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cart.reduce((total, item) => {
    const price = item.selectedVariant?.sellingPrice ?? item.product.sellingPrice;
    return total + price * item.quantity;
  }, 0);

  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];

  const searchResults = localQuery.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(localQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(localQuery.toLowerCase())
        )
        .slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchQuery(localQuery);
      setShowSearchDrop(false);
      router.push(`/search?q=${encodeURIComponent(localQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#111827] shadow-xs font-sans transition-colors duration-200">
      {/* ── MAIN HEADER (Logo, Location, Search, Actions) ── */}
      <div className="border-b border-slate-100 dark:border-[#263241] bg-white dark:bg-[#111827]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
          <div className="flex items-center justify-between gap-2.5 sm:gap-6">
            
            {/* Left: Brand Logo & Desktop Location Picker */}
            <div className="flex items-center gap-2.5 sm:gap-5 shrink-0">
              {/* PocketKirana Logo */}
              <Link href="/" className="flex items-center gap-2 group shrink-0" aria-label="Pocket Kirana Home">
                <img
                  src="/logo-icon.png"
                  alt="Pocket Kirana Logo"
                  className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-2xl bg-white p-1 border border-emerald-100 dark:border-emerald-900/40 shadow-xs group-hover:scale-105 transition-transform shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-base sm:text-2xl font-black tracking-tight text-[#075C3C] dark:text-emerald-400 leading-none">
                    Pocket<span className="text-[#0B8F5A] dark:text-emerald-500">Kirana</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-400 tracking-wide mt-0.5">
                    30 Min Groceries
                  </span>
                </div>
              </Link>

              {/* Desktop Location Picker Pill */}
              <button
                suppressHydrationWarning
                onClick={() => setShowLocationModal(true)}
                type="button"
                className="hidden lg:flex items-center gap-2.5 bg-slate-50 dark:bg-[#151B23] hover:bg-slate-100 dark:hover:bg-[#1B2430] border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#075C3C]"
                aria-label={`Delivering to ${defaultAddr ? defaultAddr.addressLine1 : 'Select Location'}`}
              >
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#075C3C] dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-none">
                    Delivering To
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[140px] mt-0.5">
                    <span className="truncate">
                      {defaultAddr ? defaultAddr.addressLine1 : 'Select Location'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                  </div>
                </div>
              </button>
            </div>

            {/* Desktop Inline Search Bar (Hidden on mobile header top row, shown below) */}
            <div className="hidden md:block relative flex-1 max-w-2xl min-w-0" ref={searchRef}>
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    suppressHydrationWarning
                    placeholder='Search for "milk", "vegetables", "Fortune atta", "chips"...'
                    value={localQuery}
                    onChange={(e) => {
                      setLocalQuery(e.target.value);
                      setShowSearchDrop(true);
                    }}
                    onFocus={() => setShowSearchDrop(true)}
                    className="w-full bg-[#FBFBF7] dark:bg-[#151B23] border-2 border-slate-200 dark:border-[#263241] focus:border-[#0B8F5A] dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-[#151B23] text-slate-900 dark:text-[#F9FAFB] placeholder-slate-400 dark:placeholder-[#9CA3AF] rounded-l-2xl py-2.5 pl-10 pr-8 text-xs sm:text-sm font-medium focus:outline-none transition-all"
                  />
                  <Search className="w-4 h-4 text-slate-400 dark:text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  {localQuery && (
                    <button
                      type="button"
                      suppressHydrationWarning
                      onClick={() => {
                        setLocalQuery('');
                        setShowSearchDrop(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-[#9CA3AF] dark:hover:text-white p-1"
                      aria-label="Clear search text"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Search Button (Utility CTA aligned with secondary/brand styling) */}
                <button
                  type="submit"
                  suppressHydrationWarning
                  className="bg-[#075C3C] hover:bg-[#0B8F5A] text-white font-bold text-xs px-5 py-3 rounded-r-2xl flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#075C3C]"
                  aria-label="Search products"
                >
                  <Search className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Search</span>
                </button>
              </form>

              {/* Autocomplete Dropdown (Desktop) */}
              {showSearchDrop && localQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#263241] rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-[#263241]">
                      {searchResults.map((prod) => (
                        <Link
                          key={prod.id}
                          href={`/product/${prod.slug}`}
                          onClick={() => setShowSearchDrop(false)}
                          className="flex items-center gap-3 p-3 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 transition-colors"
                        >
                          <img
                            src={prod.thumbnail}
                            alt={prod.name}
                            className="w-10 h-10 object-contain rounded-xl border border-slate-100 dark:border-[#263241] bg-white p-1"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-[#F9FAFB] truncate">{prod.name}</h4>
                            <span className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">{prod.unit}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-[#0B8F5A] dark:text-emerald-400">
                              ₹{prod.sellingPrice}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-5 text-center text-xs text-slate-500 dark:text-[#9CA3AF]">
                      No products matching &quot;{localQuery}&quot;
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Action Icons (Notifications, Login/Account, Cart Widget) */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Account / Login Button */}
              {isLoggedIn ? (
                <Link
                  href="/profile"
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#151B23] border border-transparent hover:border-slate-200 dark:hover:border-[#263241] transition-all text-slate-800 dark:text-[#F9FAFB] font-bold text-xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-[#075C3C] dark:text-emerald-300 flex items-center justify-center font-black text-xs">
                    {currentUser?.firstName?.[0] || 'A'}
                  </div>
                  <span className="hidden lg:inline text-slate-700 dark:text-[#D1D5DB]">My Account</span>
                </Link>
              ) : (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={onOpenAuth}
                  className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#151B23] border border-transparent hover:border-slate-200 dark:hover:border-[#263241] transition-all text-slate-800 dark:text-[#F9FAFB] font-bold text-xs cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#151B23] text-slate-700 dark:text-[#D1D5DB] flex items-center justify-center">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <span className="hidden sm:inline text-slate-700 dark:text-[#D1D5DB]">Login</span>
                </button>
              )}

              {/* Green "My Cart" Button */}
              <button
                id="header-cart-btn"
                type="button"
                suppressHydrationWarning
                onClick={onOpenCart}
                className="bg-[#0B8F5A] hover:bg-[#075C3C] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                aria-label={`Open shopping cart with ${cartItemsCount} items`}
              >
                <div className="relative flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#E65100] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                      {cartItemsCount > 99 ? '99+' : cartItemsCount}
                    </span>
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-none">
                  <span className="text-[10px] text-emerald-200 font-bold uppercase">My Cart</span>
                  <span className="text-xs font-black mt-0.5">₹{cartSubtotal}</span>
                </div>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── MOBILE FULL-WIDTH SEARCH BAR (Visible below md) ── */}
      <div className="block md:hidden px-3 py-2 bg-white dark:bg-[#111827] border-b border-slate-100 dark:border-[#263241]" ref={searchRef}>
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <div className="relative flex-1">
            <input
              type="text"
              suppressHydrationWarning
              placeholder='Search "milk", "vegetables", "atta"...'
              value={localQuery}
              onChange={(e) => {
                setLocalQuery(e.target.value);
                setShowSearchDrop(true);
              }}
              onFocus={() => setShowSearchDrop(true)}
              className="w-full bg-[#FBFBF7] dark:bg-[#151B23] border border-slate-200 dark:border-[#263241] focus:border-[#0B8F5A] dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-[#151B23] text-slate-900 dark:text-[#F9FAFB] placeholder-slate-400 dark:placeholder-[#9CA3AF] rounded-l-2xl py-2 pl-9 pr-7 text-xs font-medium focus:outline-none transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            {localQuery && (
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setLocalQuery('');
                  setShowSearchDrop(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-[#9CA3AF] dark:hover:text-white p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            suppressHydrationWarning
            className="bg-[#075C3C] hover:bg-[#0B8F5A] text-white font-bold text-xs px-3.5 py-2.5 rounded-r-2xl flex items-center justify-center transition-colors shadow-2xs shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#075C3C]"
            aria-label="Submit search"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </form>

        {/* Autocomplete Dropdown (Mobile) */}
        {showSearchDrop && localQuery.trim().length > 0 && (
          <div className="absolute top-full left-3 right-3 mt-1 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#263241] rounded-2xl shadow-xl z-50 max-h-[55vh] overflow-y-auto">
            {searchResults.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-[#263241]">
                {searchResults.map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/product/${prod.slug}`}
                    onClick={() => setShowSearchDrop(false)}
                    className="flex items-center gap-2.5 p-2.5 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 transition-colors active:bg-emerald-50"
                  >
                    <img
                      src={prod.thumbnail}
                      alt={prod.name}
                      className="w-9 h-9 object-contain rounded-lg border border-slate-100 dark:border-[#263241] bg-white p-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-[#F9FAFB] truncate">{prod.name}</h4>
                      <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">{prod.unit}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-[#0B8F5A] dark:text-emerald-400">
                        ₹{prod.sellingPrice}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 dark:text-[#9CA3AF]">
                No products matching &quot;{localQuery}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MOBILE DELIVERY LOCATION STRIP ── */}
      <div className="block lg:hidden bg-[#FFF8E7] dark:bg-[#151B23] border-b border-amber-200/60 dark:border-[#263241] px-3.5 py-1.5">
        <button
          suppressHydrationWarning
          onClick={() => setShowLocationModal(true)}
          type="button"
          className="w-full flex items-center justify-between text-xs text-amber-950 dark:text-amber-400 font-bold cursor-pointer"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-600 dark:fill-amber-400 shrink-0" />
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 shrink-0">Delivering to:</span>
            <span className="truncate font-black text-slate-900 dark:text-[#F9FAFB] text-xs">
              {defaultAddr ? defaultAddr.addressLine1 : 'Select Delivery Location'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400 shrink-0 ml-1" />
        </button>
      </div>

      {/* Address Selection Modal */}
      <LocationPickerModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
      />
    </header>
  );
};
