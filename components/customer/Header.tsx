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
  Sparkles,
  PhoneCall,
  Flame,
  Building2,
  Tag,
  ArrowRight,
  CheckCircle2,
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
    brands,
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
        .slice(0, 6)
    : [];

  // Top level active categories for the subnav
  const topCategories = (categories || [])
    .filter((c) => !c.parentId && c.isActive !== false)
    .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));

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
    <header className="sticky top-0 z-40 bg-white shadow-xs font-sans transition-all">
      {/* ── MAIN HEADER (Logo, Location, Search, Actions) ── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between gap-4 sm:gap-6">
            
            {/* Logo & Delivering Location */}
            <div className="flex items-center gap-4 lg:gap-6 shrink-0">
              {/* PocketKirana Logo */}
              <Link href="/" className="flex items-center gap-2.5 group shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0B8F5A] to-[#075C3C] flex items-center justify-center text-white font-black text-xl shadow-xs group-hover:scale-105 transition-transform">
                  PK
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-black tracking-tight text-[#075C3C] leading-none">
                    Pocket<span className="text-[#0B8F5A]">Kirana</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">
                    10-15 Min Groceries
                  </span>
                </div>
              </Link>

              {/* Location Picker Pill */}
              <button
                suppressHydrationWarning
                onClick={() => setShowLocationModal(true)}
                type="button"
                className="hidden xl:flex items-center gap-2 bg-[#FFF8E7] hover:bg-[#FFF3D6] border border-amber-200/80 px-3 py-1.5 rounded-2xl text-left transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider leading-none">
                    Delivering To
                  </span>
                  <div className="flex items-center gap-1 text-xs font-black text-slate-800 leading-tight truncate max-w-[140px] mt-0.5">
                    <span className="truncate">
                      {defaultAddr ? defaultAddr.addressLine1 : 'Select Location'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </div>
                </div>
              </button>
            </div>

            {/* Centered Wide Search Input (Matching Reference Search Bar) */}
            <div className="flex-1 max-w-2xl relative" ref={searchRef}>
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    suppressHydrationWarning
                    placeholder='Search for "Face Wash", "milk", "vegetables", "Fortune"...'
                    value={localQuery}
                    onChange={(e) => {
                      setLocalQuery(e.target.value);
                      setShowSearchDrop(true);
                    }}
                    onFocus={() => setShowSearchDrop(true)}
                    className="w-full bg-[#FBFBF7] border-2 border-slate-200 focus:border-[#0B8F5A] focus:bg-white text-slate-900 placeholder-slate-400 rounded-l-2xl py-2.5 pl-10 pr-8 text-xs sm:text-sm font-medium focus:outline-none transition-all"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  {localQuery && (
                    <button
                      type="button"
                      suppressHydrationWarning
                      onClick={() => {
                        setLocalQuery('');
                        setShowSearchDrop(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Orange/Coral Search Button (Matching Reference) */}
                <button
                  type="submit"
                  suppressHydrationWarning
                  className="bg-[#E65100] hover:bg-[#D84315] text-white font-black text-xs uppercase px-5 py-3 rounded-r-2xl flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              </form>

              {/* Instant Search Dropdown */}
              {showSearchDrop && localQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {searchResults.map((prod) => (
                        <Link
                          key={prod.id}
                          href={`/product/${prod.slug}`}
                          onClick={() => setShowSearchDrop(false)}
                          className="flex items-center gap-3 p-3 hover:bg-emerald-50/70 transition-colors"
                        >
                          <img
                            src={prod.thumbnail}
                            alt={prod.name}
                            className="w-10 h-10 object-contain rounded-xl border border-slate-100 bg-white p-1"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{prod.name}</h4>
                            <span className="text-[11px] text-slate-500">{prod.unit}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-[#0B8F5A]">
                              ₹{prod.sellingPrice}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-5 text-center text-xs text-slate-500">
                      No products matching &quot;{localQuery}&quot;
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Action Icons (Alerts, Account, My Cart) */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Account Profile Button */}
              {isLoggedIn ? (
                <Link
                  href="/profile"
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-slate-800 font-bold text-xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#075C3C] flex items-center justify-center font-black text-xs">
                    {currentUser?.firstName?.[0] || 'A'}
                  </div>
                  <span className="hidden lg:inline text-slate-700">My Account</span>
                </Link>
              ) : (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={onOpenAuth}
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-slate-800 font-bold text-xs cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <span className="hidden lg:inline text-slate-700">Login</span>
                </button>
              )}

              {/* Green "My Cart" Button (Matching Reference) */}
              <button
                type="button"
                suppressHydrationWarning
                onClick={onOpenCart}
                className="bg-[#0B8F5A] hover:bg-[#075C3C] text-white px-3.5 sm:px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2.5 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
              >
                <div className="relative">
                  <ShoppingBag className="w-4 h-4" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#E65100] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                      {cartItemsCount}
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

      {/* ── MOBILE DELIVERY LOCATION STRIP ── */}
      <div className="block xl:hidden bg-[#FFF8E7] border-b border-amber-200/60 px-4 py-2">
        <button
          suppressHydrationWarning
          onClick={() => setShowLocationModal(true)}
          className="w-full flex items-center justify-between text-xs text-amber-950 font-bold"
        >
          <div className="flex items-center gap-2 truncate">
            <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-600 shrink-0" />
            <span className="text-[11px] font-bold text-amber-800">Delivering to:</span>
            <span className="truncate font-black text-slate-900">
              {defaultAddr ? defaultAddr.addressLine1 : 'Select Delivery Location'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-amber-800 shrink-0" />
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
