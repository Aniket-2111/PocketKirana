'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { ShoppingCart, Plus, Minus, Trash2, ArrowRight, Tag } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function CartPage() {
  const router = useRouter();
  const { 
    cart, 
    updateCartQuantity, 
    removeFromCart, 
    clearCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon
  } = useAppStore();

  const [couponCode, setCouponCode] = React.useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'fixed') {
      discount = appliedCoupon.value;
    } else {
      discount = Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.maxDiscount);
    }
  }
  const deliveryCharge = subtotal > 499 || subtotal === 0 ? 0 : 29;
  const tax = Math.round((subtotal - discount) * 0.05);
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

  if (cart.length === 0) {
    return (
      <CustomerShell title="My Cart" showBack backUrl="/">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs mt-6">
          <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Your cart is empty</h3>
            <p className="text-xs text-slate-500 mt-1">Explore our wide selection of fresh grocery essentials!</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-600/30 cursor-pointer uppercase tracking-wider"
          >
            Start Shopping
          </button>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title="My Cart" showBack backUrl="/">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        {/* Cart Items List */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
              Cart Items ({cart.length})
            </h3>
            <button
              onClick={() => clearCart()}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {cart.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {item.product?.thumbnail ? (
                    <img src={item.product.thumbnail} alt={item.product.name} className="w-12 h-12 rounded-xl object-cover bg-slate-50 border border-slate-100 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-emerald-700 font-black flex items-center justify-center shrink-0 text-sm">
                      {item.product?.name?.slice(0, 2).toUpperCase() || 'PK'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <strong className="block text-xs font-bold text-slate-900 truncate">
                      {item.product?.name}
                    </strong>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {item.variantName || item.product?.unit || '1 unit'}
                    </span>
                    <span className="text-xs font-mono font-black text-slate-900 block mt-0.5">
                      ₹{item.price}
                    </span>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-2 py-1 shrink-0">
                  <button
                    onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                    className="w-5 h-5 flex items-center justify-center text-slate-700 hover:text-rose-600 cursor-pointer active:scale-90"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono font-black text-xs min-w-[14px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                    className="w-5 h-5 flex items-center justify-center text-slate-700 hover:text-emerald-700 cursor-pointer active:scale-90"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coupon Section */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-emerald-600" />
            <span>Apply Coupon</span>
          </h4>

          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs">
              <div>
                <strong className="text-emerald-900 font-black font-mono">{appliedCoupon.code}</strong>
                <span className="text-emerald-700 block text-[11px]">Applied! You saved ₹{discount}</span>
              </div>
              <button
                onClick={() => removeCoupon()}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter promo code (e.g. PKFIRST)..."
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl cursor-pointer"
              >
                APPLY
              </button>
            </form>
          )}
        </div>

        {/* Bill Details */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-2.5 shadow-xs text-xs font-bold text-slate-600">
          <h4 className="font-black text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
            Bill Summary
          </h4>
          <div className="flex items-center justify-between">
            <span>Item Subtotal</span>
            <span className="font-mono text-slate-900">₹{subtotal}</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Coupon Discount</span>
              <span className="font-mono font-black">-₹{discount}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Delivery Fee</span>
            <span className="font-mono text-slate-900">{deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Govt. Taxes &amp; GST</span>
            <span className="font-mono text-slate-900">₹{tax}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-sm font-black text-slate-900">
            <span>Total Payable</span>
            <span className="font-mono text-emerald-800 text-base">₹{total}</span>
          </div>
        </div>

        {/* Proceed to Checkout Action */}
        <button
          onClick={() => router.push('/checkout')}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform cursor-pointer uppercase tracking-wider"
        >
          <span>PROCEED TO CHECKOUT (₹{total})</span>
          <ArrowRight className="w-5 h-5" />
        </button>

      </div>
    </CustomerShell>
  );
}
