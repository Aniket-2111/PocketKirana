'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Tag,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  Truck,
  Sparkles
} from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { cart, updateQuantity, removeFromCart, appliedCoupon, applyCoupon, removeCoupon } = useAppStore();
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ success?: boolean; text?: string }>({});

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
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-modal flex flex-col">
          {/* Header */}
          <div className="p-4 bg-gray-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-base">Your Shopping Basket ({cart.length})</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Bar */}
          {cart.length > 0 && (
            <div className="bg-emerald-50 p-3 border-b border-emerald-100 flex items-center gap-2.5 text-xs text-emerald-900">
              <Truck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              {isFreeDelivery ? (
                <span className="font-bold text-emerald-700">
                  🎉 You unlocked FREE Delivery!
                </span>
              ) : (
                <span>
                  Add <strong className="text-emerald-700">₹{freeDeliveryDiff}</strong> more for{' '}
                  <strong className="text-emerald-700">FREE Delivery!</strong>
                </span>
              )}
            </div>
          )}

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Your cart is empty</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Looks like you haven&apos;t added any fresh groceries yet. Explore top deals now!
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-btn shadow-md transition-colors"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex gap-3 items-center"
                >
                  <img
                    src={item.product.thumbnail}
                    alt={item.product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-gray-900 truncate">
                      {item.product.name}
                    </h4>
                    {item.variantName && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md inline-block">
                        {item.variantName}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500 block">{!item.variantName ? (item.product.unit || '') : ''}</span>
                    
                    {/* Stock Alert Warning inside Cart */}
                    {(item.product.stock !== undefined && item.product.stock <= 0) || item.product.status === 'out_of_stock' ? (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                        ⚠️ Out of Stock
                      </span>
                    ) : item.product.stock !== undefined && item.product.stock <= 5 ? (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                        ⚡ Only {item.product.stock} left
                      </span>
                    ) : null}

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs font-extrabold text-gray-900">
                        ₹{item.price * item.quantity}
                      </span>
                      {item.product.mrp > item.price && (
                        <span className="text-[10px] text-gray-400 line-through">
                          ₹{item.product.mrp * item.quantity}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center bg-white border border-gray-300 rounded-btn font-bold text-xs text-gray-800 shadow-sm">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={(item.product.stock !== undefined && item.product.stock <= item.quantity) || item.product.status === 'out_of_stock'}
                      className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer - Coupons & Summary */}
          {cart.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
              {/* Out of Stock Warning Banner */}
              {cart.some(item => (item.product.stock !== undefined && item.product.stock <= 0) || item.product.status === 'out_of_stock') && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                  <span>⚠️ Some items in your cart are currently out of stock. Please remove them to proceed.</span>
                </div>
              )}

              {/* Coupon Section */}
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{appliedCoupon.code} Applied</span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-red-600 hover:underline text-[11px] font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Promo Code (e.g. POCKET100)"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value)}
                      className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 uppercase tracking-wider focus:outline-emerald-500"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {couponMsg.text && (
                  <span
                    className={`block text-[11px] mt-1.5 font-medium ${
                      couponMsg.success ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {couponMsg.text}
                  </span>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-900">₹{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery Charge</span>
                  <span>
                    {deliveryCharge === 0 ? (
                      <span className="text-emerald-600 font-bold">FREE</span>
                    ) : (
                      `₹${deliveryCharge}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GST & Taxes</span>
                  <span>₹{tax}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-gray-900 border-t border-gray-200 pt-2">
                  <span>Grand Total</span>
                  <span className="text-emerald-700">₹{grandTotal}</span>
                </div>
              </div>

              {/* Checkout Button */}
              {cart.some(item => (item.product.stock !== undefined && item.product.stock <= 0) || item.product.status === 'out_of_stock') ? (
                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm cursor-not-allowed shadow-none"
                >
                  Remove Out-of-Stock Items to Checkout
                </button>
              ) : (
                <Link
                  href="/checkout"
                  onClick={onClose}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-between text-sm transition-all shadow-md active:scale-[0.99]"
                >
                  <span>Proceed to Checkout</span>
                  <div className="flex items-center gap-1.5 font-extrabold">
                    <span>₹{grandTotal}</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
