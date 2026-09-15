'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

import {
  X,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowRight,
  ShoppingBag,
  Truck,
  LogIn,
  AlertCircle,
} from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, onOpenAuth }) => {
  const router = useRouter();
  const { cart, updateQuantity, removeFromCart, appliedCoupon, applyCoupon, removeCoupon, isLoggedIn } = useAppStore();
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ success?: boolean; text?: string }>({});
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'fixed') {
      discount = appliedCoupon.value;
    } else {
      discount = Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.maxDiscount);
    }
  }

  const freeDeliveryThreshold = 499;
  const isFreeDelivery = subtotal >= freeDeliveryThreshold;
  const deliveryCharge = isFreeDelivery || cart.length === 0 ? 0 : 29;
  const freeDeliveryDiff = Math.max(0, freeDeliveryThreshold - subtotal);
  const tax = Math.round((subtotal - discount) * 0.05);
  const grandTotal = Math.max(0, subtotal - discount + deliveryCharge + tax);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;
    const res = applyCoupon(couponCodeInput.trim());
    setCouponMsg({ success: res.success, text: res.message });
    if (res.success) {
      setCouponCodeInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-white">Your Shopping Basket</h2>
                <span className="text-[11px] text-slate-400">{cart.length} {cart.length === 1 ? 'item' : 'items'} in cart</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close cart drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Progress Bar */}
          {cart.length > 0 && (
            <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-100 flex items-center gap-2 text-xs text-emerald-950 shrink-0">
              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
              {isFreeDelivery ? (
                <span className="font-bold text-emerald-800">
                  🎉 You unlocked <strong>FREE Delivery!</strong>
                </span>
              ) : (
                <span className="text-slate-700 text-[11px]">
                  Add <strong className="text-emerald-800 font-bold">₹{freeDeliveryDiff}</strong> more for{' '}
                  <strong className="text-emerald-800 font-bold">FREE Delivery!</strong>
                </span>
              )}
            </div>
          )}

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                  <ShoppingBag className="w-9 h-9" />
                </div>
                <h3 className="font-black text-slate-900 text-lg">Your cart is empty</h3>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Looks like you haven&apos;t added any groceries yet. Explore top deals on fresh produce and daily essentials!
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex gap-3 items-center"
                >
                  <img
                    src={item.product.thumbnail || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80'}
                    alt={item.product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-14 h-14 object-contain rounded-xl border border-slate-200 bg-white p-1 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 truncate">
                      {item.product.name}
                    </h4>
                    {item.variantName ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                        {item.variantName}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 block">{item.product.unit || ''}</span>
                    )}
                    
                    {/* Stock Alert Warning inside Cart */}
                    {(item.product.stock !== undefined && item.product.stock <= 0) || item.product.status === 'out_of_stock' ? (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                        ⚠️ Out of Stock
                      </span>
                    ) : item.product.stock !== undefined && item.product.stock <= 5 ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                        ⚡ Only {item.product.stock} left
                      </span>
                    ) : null}

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs font-black text-slate-900">
                        ₹{item.price * item.quantity}
                      </span>
                      {item.product.mrp > item.price && (
                        <span className="text-[10px] text-slate-400 line-through">
                          ₹{item.product.mrp * item.quantity}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 shadow-2xs shrink-0">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                    <span className="px-2 font-black text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={(item.product.stock !== undefined && item.product.stock <= item.quantity) || item.product.status === 'out_of_stock'}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer shrink-0"
                    title="Remove item"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer - Coupons, Summary & Checkout Button */}
          {cart.length > 0 && (
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0 pb-safe">
              {/* Out of Stock Warning Banner */}
              {cart.some(item => (item.product.stock !== undefined && item.product.stock <= 0) || item.product.status === 'out_of_stock') && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <span>⚠️ Some items in your cart are currently out of stock. Please remove them to proceed.</span>
                </div>
              )}

              {/* Coupon Section */}
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{appliedCoupon.code} Applied</span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-rose-600 hover:underline text-[11px] font-bold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Promo code (e.g. POCKET100)"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value)}
                      className="flex-1 text-xs border border-slate-300 rounded-xl px-3 py-2 uppercase tracking-wider focus:outline-none focus:border-[#0B8F5A] focus:ring-1 focus:ring-emerald-500/20"
                    />
                    <button
                      type="submit"
                      className="bg-[#0B8F5A] text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-[#075C3C] transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {couponMsg.text && (
                  <span
                    className={`block text-[11px] mt-1.5 font-medium ${
                      couponMsg.success ? 'text-emerald-700 font-bold' : 'text-rose-600'
                    }`}
                  >
                    {couponMsg.text}
                  </span>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">₹{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Coupon Discount</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span>
                    {deliveryCharge === 0 ? (
                      <span className="text-emerald-700 font-bold">FREE</span>
                    ) : (
                      `₹${deliveryCharge}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GST &amp; Handling</span>
                  <span>₹{tax}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>Grand Total</span>
                  <span className="text-[#075C3C]">₹{grandTotal}</span>
                </div>
              </div>

              {/* Checkout Button */}
              {cart.some(item => (item.product.stock !== undefined && item.product.stock <= 0) || item.product.status === 'out_of_stock') ? (
                <button
                  disabled
                  className="w-full bg-slate-200 text-slate-400 font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs cursor-not-allowed shadow-none"
                >
                  Remove Out-of-Stock Items to Checkout
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (!isLoggedIn) {
                        setShowLoginPrompt(true);
                        return;
                      }
                      onClose();
                      router.push('/checkout');
                    }}
                    className="w-full bg-[#0B8F5A] hover:bg-[#075C3C] active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm transition-all shadow-md cursor-pointer"
                  >
                    <span>Proceed to Checkout</span>
                    <div className="flex items-center gap-1.5 font-extrabold">
                      <span>₹{grandTotal}</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Login Prompt Banner */}
                  {showLoginPrompt && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs font-semibold text-amber-900 leading-snug">
                          Please log in to continue to checkout.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowLoginPrompt(false);
                            onClose();
                            onOpenAuth();
                          }}
                          className="flex-1 bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Login / Sign Up</span>
                        </button>
                        <button
                          onClick={() => setShowLoginPrompt(false)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1.5 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
