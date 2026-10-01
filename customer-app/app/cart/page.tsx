'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import FreeDeliveryProgressBar from '../../components/customer/FreeDeliveryProgressBar';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowRight, 
  Tag, 
  MapPin, 
  Home as HomeIcon, 
  Briefcase, 
  Check, 
  X,
  PlusCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { calculateDeliveryFee, FREE_DELIVERY_THRESHOLD } from '@/lib/freeDelivery';
import type { Address } from '@/types';

export default function CartPage() {
  const router = useRouter();
  const { 
    cart, 
    updateCartQuantity, 
    removeFromCart, 
    clearCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    coupons = [],
    addresses,
    setDefaultAddress,
    isLoggedIn,
  } = useAppStore();

  const [couponCode, setCouponCode] = useState('');
  const [isCouponDropdownOpen, setIsCouponDropdownOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  // Authoritative selected delivery address
  const selectedAddress = addresses.find((a) => a.isDefault) || addresses[0] || null;

  // Authoritative Cart Subtotal
  const subtotal = cart.reduce((sum, item) => sum + (typeof item.price === 'number' ? item.price : 0) * (typeof item.quantity === 'number' ? item.quantity : 1), 0);
  
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'fixed') {
      discount = appliedCoupon.value;
    } else {
      discount = Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.maxDiscount);
    }
  }

  // Authoritative Free Delivery calculation at ₹500
  const deliveryCharge = calculateDeliveryFee(subtotal);
  const tax = Math.round(Math.max(0, subtotal - discount) * 0.05);
  const total = Math.max(0, subtotal - discount + deliveryCharge + tax);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    const res = applyCoupon(couponCode);
    if (res.success) {
      showToast(res.message, 'success');
      setCouponCode('');
    } else {
      showToast(res.message, 'error');
    }
  };

  const getAddressIcon = (type?: string) => {
    const lower = (type || '').toLowerCase();
    if (lower === 'home') return <HomeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    if (lower === 'work' || lower === 'office') return <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    return <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
  };

  const formatAddressSummary = (addr: Address) => {
    const parts = [
      addr.houseNumber,
      addr.addressLine1,
      addr.landmark,
      addr.city,
      addr.postalCode
    ].filter(Boolean);
    return parts.join(', ');
  };

  if (cart.length === 0) {
    return (
      <CustomerShell title="My Cart" showBack backUrl="/">
        <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-8 text-center space-y-4 shadow-xs mt-6">
          <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] flex items-center justify-center mx-auto text-[#6B7280] dark:text-[#9CA3AF]">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#111827] dark:text-[#F9FAFB]">Your cart is empty</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">Explore our wide selection of fresh grocery essentials!</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-[#008F5A] hover:bg-[#007044] text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-600/30 cursor-pointer uppercase tracking-wider transition-transform active:scale-95"
          >
            Start Shopping
          </button>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title="My Cart" showBack backUrl="/" hideFooter>
      <div className="space-y-4 animate-in fade-in duration-200 pb-4">
        
        {/* ── 1. FREE DELIVERY PROGRESS WIDGET ── */}
        <FreeDeliveryProgressBar 
          variant="inline" 
          onClickDiscovery={() => router.push('/search')} 
        />

        {/* ── 2. CART ITEMS LIST ── */}
        <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#263241] pb-3">
            <h3 className="font-black text-xs uppercase tracking-wider text-[#111827] dark:text-[#F9FAFB]">
              Cart Items ({cart.length})
            </h3>
            <button
              onClick={() => clearCart()}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          <div className="divide-y divide-[#E5E7EB] dark:divide-[#263241]">
            {cart.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {item.product?.thumbnail ? (
                    <img src={item.product.thumbnail} alt={item.product.name} className="w-12 h-12 rounded-xl object-cover bg-slate-50 dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#1B2430] text-[#008F5A] dark:text-emerald-400 font-black flex items-center justify-center shrink-0 text-sm">
                      {item.product?.name?.slice(0, 2).toUpperCase() || 'PK'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <strong className="block text-xs font-bold text-[#111827] dark:text-[#F9FAFB] truncate">
                      {item.product?.name}
                    </strong>
                    <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-mono block">
                      {item.variantName || item.product?.unit || '1 unit'}
                    </span>
                    <span className="text-xs font-mono font-black text-[#008F5A] dark:text-[#22C55E] block mt-0.5">
                      ₹{item.price}
                    </span>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex min-h-12 items-center gap-1 rounded-xl border border-[#E5E7EB] bg-slate-100 px-1 dark:border-[#263241] dark:bg-[#1B2430] shrink-0">
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-[#374151] transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 dark:text-[#D1D5DB] dark:hover:bg-rose-950/30"
                    aria-label={`Remove one ${item.product?.name || 'item'} from cart`}
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span role="status" aria-label={`${item.quantity} ${item.product?.name || 'items'} in cart`} className="min-w-7 text-center font-mono text-xs font-black text-[#111827] dark:text-[#F9FAFB]">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                    aria-label={`Add one ${item.product?.name || 'item'} to cart`}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. COUPON SECTION (COLLAPSIBLE DROPDOWN & ADMIN-ONLY COUPONS) ── */}
        <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-4 sm:p-5 space-y-3 shadow-xs transition-all">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsCouponDropdownOpen((prev) => !prev)}
              aria-expanded={isCouponDropdownOpen}
              aria-controls="cart-coupon-content"
              className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#008F5A] dark:bg-emerald-950/50 dark:text-emerald-400">
                  <Tag className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#111827] dark:text-[#F9FAFB]">
                    <span>Apply Coupon</span>
                    {(coupons || []).filter((c) => c.active !== false).length > 0 && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        ({(coupons || []).filter((c) => c.active !== false).length} available)
                      </span>
                    )}
                  </span>
                  {appliedCoupon ? (
                    <span className="flex items-center gap-1 truncate text-[11px] font-bold text-[#008F5A] dark:text-emerald-400">
                      <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{appliedCoupon.code} active (Saved ₹{discount})</span>
                    </span>
                  ) : (
                    <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {(coupons || []).filter((c) => c.active !== false).length > 0
                        ? 'Tap to select or enter promo code'
                        : 'Tap to enter promo code'}
                    </span>
                  )}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                {!appliedCoupon && (
                  <span className="text-[11px] font-black text-[#008F5A] dark:text-emerald-400">
                    {isCouponDropdownOpen ? 'Hide' : 'Select'}
                  </span>
                )}
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-[#1E2633]">
                  {isCouponDropdownOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
              </span>
            </button>
          </div>

          {/* ── EXPANDED DROPDOWN BODY ── */}
            <div id="cart-coupon-content" hidden={!isCouponDropdownOpen} className="pt-3 border-t border-slate-100 dark:border-[#263241] space-y-3 animate-in fade-in duration-200">
              {/* Applied Active Coupon Card */}
              {appliedCoupon && (
                <div className="flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 p-3 rounded-2xl text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                      %
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-[#008F5A] dark:text-emerald-300 font-black font-mono tracking-wider">{appliedCoupon.code}</strong>
                        <span className="bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                          {appliedCoupon.type === 'fixed' ? `₹${appliedCoupon.value} OFF` : `${appliedCoupon.value}% OFF`}
                        </span>
                      </div>
                      <span className="text-emerald-700 dark:text-emerald-400 block text-[11px] font-medium mt-0.5">Applied! You save ₹{discount}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeCoupon();
                      showToast('Coupon removed', 'info');
                    }}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Promo Code Input Form */}
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter promo code..."
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-50 dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold uppercase text-[#111827] dark:text-[#F9FAFB] placeholder:text-slate-400 focus:outline-none focus:border-[#008F5A] focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-black rounded-xl cursor-pointer transition-colors shadow-xs active:scale-95 shrink-0"
                >
                  APPLY
                </button>
              </form>

              {/* Available Admin Coupons List */}
              {(() => {
                const adminCoupons = (coupons || []).filter((c) => c.active !== false);
                if (adminCoupons.length === 0) {
                  return (
                    <div className="py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-[#111827] border border-dashed border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        No public coupons available at the moment. Enter a promo code above if you have one.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] block">
                      Admin Created Coupons
                    </span>
                    <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-0.5">
                      {adminCoupons.map((c) => {
                        const isCurrentApplied = appliedCoupon?.code?.toUpperCase() === c.code.toUpperCase();
                        const minOrder = c.minimumOrder || 0;
                        const isEligible = subtotal >= minOrder;
                        const neededAmount = Math.max(0, minOrder - subtotal);
                        const discountText = c.type === 'fixed' ? `₹${c.value} OFF` : `${c.value}% OFF`;

                        return (
                          <div
                            key={c.id || c.code}
                            className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                              isCurrentApplied
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600/50'
                                : isEligible
                                ? 'bg-slate-50/80 dark:bg-[#111827] border-slate-200 dark:border-[#263241] hover:border-emerald-300 dark:hover:border-emerald-700'
                                : 'bg-slate-50/40 dark:bg-[#111827]/40 border-slate-100 dark:border-[#1E2633] opacity-75'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-black text-xs text-slate-900 dark:text-[#F9FAFB] bg-white dark:bg-[#1E2633] border border-dashed border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded-lg">
                                  {c.code}
                                </span>
                                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/70 px-1.5 py-0.5 rounded-md">
                                  {discountText}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-[#9CA3AF] font-medium mt-1 leading-tight">
                                {c.type === 'fixed'
                                  ? `Flat ₹${c.value} OFF on orders above ₹${minOrder}`
                                  : `${c.value}% OFF (up to ₹${c.maxDiscount || c.value}) on orders above ₹${minOrder}`}
                              </p>
                              {!isEligible && !isCurrentApplied && minOrder > 0 && (
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block mt-0.5">
                                  Add ₹{neededAmount} more to unlock
                                </span>
                              )}
                            </div>

                            <div className="shrink-0">
                              {isCurrentApplied ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    removeCoupon();
                                    showToast('Coupon removed', 'info');
                                  }}
                                  className="px-3 py-1.5 rounded-xl text-[11px] font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                >
                                  REMOVE
                                </button>
                              ) : isEligible ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = applyCoupon(c.code);
                                    if (res.success) {
                                      showToast(res.message, 'success');
                                    } else {
                                      showToast(res.message, 'error');
                                    }
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-[#008F5A] hover:bg-[#007044] text-white text-[11px] font-black transition-transform active:scale-95 shadow-xs cursor-pointer"
                                >
                                  APPLY
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCouponCode(c.code);
                                    showToast(`Add ₹${neededAmount} more to cart to apply ${c.code}`, 'error');
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-[#263241] cursor-pointer hover:text-slate-600"
                                >
                                  VIEW
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
        </div>

        {/* ── 4. DELIVERY ADDRESS SECTION ── */}
        <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-4 sm:p-5 shadow-xs">
          {selectedAddress ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center shrink-0 mt-0.5">
                  {getAddressIcon(selectedAddress.addressType)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] uppercase tracking-wide">
                      Delivering to {selectedAddress.addressType || 'Home'}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      30 MINS
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] font-medium truncate mt-0.5">
                    {formatAddressSummary(selectedAddress)}
                  </p>
                </div>
              </div>

              {/* Change Button */}
              <button
                onClick={() => setAddressModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1B2430] dark:hover:bg-[#263241] text-[#008F5A] dark:text-emerald-400 text-xs font-black cursor-pointer transition-colors shrink-0 active:scale-95"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <strong className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] block">
                    No delivery address selected
                  </strong>
                  <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] block truncate">
                    Add an address to continue checkout
                  </span>
                </div>
              </div>

              <button
                onClick={() => router.push('/saved-addresses?redirect=/cart')}
                className="px-3.5 py-1.5 rounded-xl bg-[#008F5A] hover:bg-[#007044] text-white text-xs font-black cursor-pointer transition-transform active:scale-95 shrink-0"
              >
                Add Address
              </button>
            </div>
          )}
        </div>

        {/* ── 5. BILL SUMMARY ── */}
        <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-5 space-y-2.5 shadow-xs text-xs font-bold text-[#374151] dark:text-[#D1D5DB]">
          <h4 className="font-black text-[#111827] dark:text-[#F9FAFB] uppercase tracking-wider pb-1 border-b border-[#E5E7EB] dark:border-[#263241]">
            Bill Summary
          </h4>
          <div className="flex items-center justify-between">
            <span>Item Subtotal</span>
            <span className="font-mono text-[#111827] dark:text-[#F9FAFB]">₹{subtotal}</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-[#008F5A] dark:text-emerald-400">
              <span>Coupon Discount</span>
              <span className="font-mono font-black">-₹{discount}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Delivery Fee</span>
            <span className="font-mono text-[#111827] dark:text-[#F9FAFB]">
              {deliveryCharge === 0 ? (
                <span className="text-[#008F5A] dark:text-emerald-400 font-black">FREE</span>
              ) : (
                `₹${deliveryCharge}`
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Govt. Taxes &amp; GST</span>
            <span className="font-mono text-[#111827] dark:text-[#F9FAFB]">₹{tax}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB] dark:border-[#263241] text-sm font-black text-[#111827] dark:text-[#F9FAFB]">
            <span>Total Payable</span>
            <span className="font-mono text-[#008F5A] dark:text-[#22C55E] text-base">₹{total}</span>
          </div>
        </div>

        {/* ── 6. PROCEED TO CHECKOUT ACTION ── */}
        <button
          onClick={() => {
            if (!isLoggedIn) {
              showToast('Please verify your mobile number to checkout', 'info');
              router.push('/login?redirect=/checkout');
              return;
            }
            if (!selectedAddress) {
              showToast('Please add or select a delivery address', 'error');
              router.push('/saved-addresses?redirect=/cart');
              return;
            }
            router.push('/checkout');
          }}
          className="w-full py-4 rounded-2xl bg-[#008F5A] hover:bg-[#007044] active:scale-95 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform cursor-pointer uppercase tracking-wider"
        >
          <span>PROCEED TO CHECKOUT (₹{total})</span>
          <ArrowRight className="w-5 h-5" />
        </button>

      </div>

      {/* ── ADDRESS SELECTOR MODAL ── */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151B23] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#E5E7EB] dark:border-[#263241] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-[#E5E7EB] dark:border-[#263241] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-black text-sm text-[#111827] dark:text-[#F9FAFB]">Select Delivery Address</h3>
              </div>
              <button
                onClick={() => setAddressModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1B2430] flex items-center justify-center text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Address List */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {addresses.map((addr) => {
                const isSelected = selectedAddress?.id === addr.id;
                return (
                  <div
                    key={addr.id}
                    onClick={() => {
                      setDefaultAddress(addr.id);
                      setAddressModalOpen(false);
                      showToast(`Delivery address set to ${addr.addressType || 'Home'}`, 'success');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50/70 dark:bg-[#111827] border-slate-200 dark:border-[#263241] hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#1B2430] border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        {getAddressIcon(addr.addressType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-black text-[#111827] dark:text-[#F9FAFB]">
                            {addr.addressType || 'Home'}
                          </strong>
                          {addr.isDefault && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-[#9CA3AF] font-medium mt-1 leading-snug">
                          {formatAddressSummary(addr)}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 mt-1">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add New Address Button */}
              <button
                onClick={() => {
                  setAddressModalOpen(false);
                  router.push('/saved-addresses?redirect=/cart');
                }}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-emerald-400/60 hover:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-[#008F5A] dark:text-emerald-400 text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add New Delivery Address</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </CustomerShell>
  );
}
