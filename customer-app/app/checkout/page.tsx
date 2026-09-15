'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { 
  MapPin, 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight,
  Plus,
  Smartphone,
  Check,
  Loader2
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { OrderConfirmationAnimation } from '@/components/customer/OrderConfirmationAnimation';
import { initiatePhonePePayment } from '@/lib/phonepeClient';
import type { PaymentMethod, Order } from '@/types';

export default function CheckoutPage() {
  const router = useRouter();
  const { 
    cart, 
    addresses, 
    appliedCoupon, 
    placeOrder, 
    isLoggedIn,
    currentUser
  } = useAppStore();

  // ── Hydration guard — Zustand persist doesn't rehydrate until after mount ──
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [selectedAddressId, setSelectedAddressId] = useState<string>(() => {
    const def = addresses.find((a) => a.isDefault);
    return def ? def.id : addresses[0]?.id || 'addr-1';
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  
  // ── Button & Animation Flow States ──
  const [btnState, setBtnState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [showAnimationModal, setShowAnimationModal] = useState(false);
  const isSubmittingRef = useRef(false);

  // ── Totals — only compute after hydration so cart is populated from localStorage ──
  const subtotal = useMemo(
    () => (mounted ? cart.reduce((sum, item) => sum + item.price * item.quantity, 0) : 0),
    [mounted, cart]
  );
  const discount = useMemo(() => {
    if (!mounted || !appliedCoupon) return 0;
    if (appliedCoupon.type === 'fixed') return appliedCoupon.value;
    return Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.maxDiscount);
  }, [mounted, appliedCoupon, subtotal]);
  const deliveryCharge = mounted && subtotal > 499 ? 0 : mounted && subtotal > 0 ? 29 : 0;
  const tax = mounted ? Math.round((subtotal - discount) * 0.05) : 0;
  const total = mounted ? Math.max(0, subtotal - discount + deliveryCharge + tax) : 0;
  const cartCount = mounted ? cart.length : 0;

  const handlePlaceOrder = async () => {
    // Prevent duplicate orders
    if (isSubmittingRef.current || btnState !== 'idle') return;

    if (cart.length === 0) {
      showToast('Your cart is empty', 'error');
      router.push('/');
      return;
    }

    isSubmittingRef.current = true;
    setBtnState('loading');

    try {
      // 1. Create order in Backend / Store
      const createdOrder = placeOrder(
        selectedAddressId, 
        'Express Delivery', 
        paymentMethod
      );

      // Verify valid Order ID returned
      if (!createdOrder || !createdOrder.id) {
        throw new Error('Order creation returned invalid ID');
      }

      // If PhonePe payment selected, initiate PhonePe gateway redirect
      if (paymentMethod === 'phonepe') {
        const addr = addresses.find((a) => a.id === selectedAddressId) || addresses[0];
        const res = await initiatePhonePePayment({
          orderId: createdOrder.id,
          amount: total,
          mobileNumber: addr?.phone || '8698893348',
          customerId: currentUser?.id || 'customer',
          redirectPath: '/checkout/success/',
        });

        if (res.success && res.redirectUrl) {
          window.location.href = res.redirectUrl;
          return;
        } else {
          showToast(res.error || 'Failed to connect to PhonePe gateway', 'error');
          setBtnState('idle');
          isSubmittingRef.current = false;
          return;
        }
      }

      // 2. Step 1: Button Success Animation (~0.8s)
      setBtnState('success');
      setConfirmedOrder(createdOrder);

      // 3. Step 2: Transition to Grocery Packing & Confirmed Animation
      setTimeout(() => {
        setShowAnimationModal(true);
      }, 750);

    } catch (err: any) {
      showToast('Failed to place order. Please try again.', 'error');
      setBtnState('idle');
      isSubmittingRef.current = false;
    }
  };

  const handleAnimationComplete = () => {
    if (confirmedOrder) {
      router.replace(`/orders/${confirmedOrder.id}`);
    }
  };

  // Show a loading skeleton while the store is hydrating
  if (!mounted) {
    return (
      <CustomerShell title="Checkout" showBack backUrl="/cart">
        <div className="p-4 space-y-4 animate-pulse">
          <div className="h-32 bg-slate-200 rounded-3xl" />
          <div className="h-24 bg-slate-200 rounded-3xl" />
          <div className="h-28 bg-slate-200 rounded-3xl" />
        </div>
      </CustomerShell>
    );
  }

  // If cart is empty after hydration, redirect to cart page
  if (mounted && cart.length === 0) {
    return (
      <CustomerShell title="Checkout" showBack backUrl="/cart">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs mt-6">
          <h3 className="text-base font-black text-slate-900">Your cart is empty</h3>
          <p className="text-xs text-slate-500">Add items to your cart before checking out.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl transition-all"
          >
            Shop Now
          </button>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title="Checkout" showBack backUrl="/cart">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        {/* ── 1. DELIVERY ADDRESS SELECTOR ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Delivery Address</span>
            </h3>
            <button
              onClick={() => router.push('/saved-addresses')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manage</span>
            </button>
          </div>

          <div className="space-y-2">
            {addresses.length > 0 ? (
              addresses.map((addr) => {
                const isSelected = selectedAddressId === addr.id;
                return (
                  <label
                    key={addr.id}
                    onClick={() => setSelectedAddressId(addr.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryAddress"
                      checked={isSelected}
                      onChange={() => setSelectedAddressId(addr.id)}
                      className="mt-1 w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                    <div className="min-w-0 text-xs">
                      <div className="flex items-center gap-2">
                        <strong className="font-black text-slate-900">{addr.addressType || 'Home'}</strong>
                        {addr.isDefault && (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 font-medium mt-0.5 leading-snug">
                        {addr.addressLine1} {addr.houseNumber ? `, House: ${addr.houseNumber}` : ''}, {addr.city} - {addr.postalCode}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        Phone: {addr.phone || '+91 8698893348'}
                      </span>
                    </div>
                  </label>
                );
              })
            ) : (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
                <p>Default delivery to DarkStore Express Area (Neral Hub - 410101)</p>
              </div>
            )}
          </div>
        </div>

        {/* ── 2. PAYMENT METHOD SELECTOR ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Select Payment Method</span>
          </h3>

          <div className="space-y-2.5">
            {[
              { 
                id: 'cod', 
                label: 'Cash on Delivery (COD)', 
                desc: 'Pay with cash or UPI on doorstep', 
                tag: null,
                icon: Banknote 
              },
              { 
                id: 'phonepe', 
                label: 'PhonePe (UPI, Cards, Wallet)', 
                desc: 'Pay securely via PhonePe Business Gateway', 
                tag: 'RECOMMENDED',
                icon: Smartphone 
              },
            ].map((method) => {
              const isSelected = paymentMethod === method.id;
              const isPhonePe = method.id === 'phonepe';
              const Icon = method.icon;
              return (
                <label
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? isPhonePe
                        ? 'bg-purple-50/70 border-purple-600 ring-2 ring-purple-500/20 shadow-xs'
                        : 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={isSelected}
                      onChange={() => setPaymentMethod(method.id as PaymentMethod)}
                      className={`w-4 h-4 cursor-pointer ${isPhonePe ? 'accent-purple-600' : 'accent-emerald-600'}`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="block text-xs font-bold text-slate-900">{method.label}</strong>
                        {method.tag && (
                          <span className="text-[9px] font-black text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            {method.tag}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium block">{method.desc}</span>
                    </div>
                  </div>
                  {isPhonePe ? (
                    <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs shrink-0">
                      <span className="font-black text-xs font-sans">पे</span>
                    </div>
                  ) : (
                    <Icon className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* ── 4. ORDER SUMMARY ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-2.5 shadow-xs text-xs font-bold text-slate-600">
          <h4 className="font-black text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
            Total Amount ({cartCount} Products)
          </h4>
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-mono text-slate-900">₹{subtotal}</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Coupon Savings</span>
              <span className="font-mono font-black">-₹{discount}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Delivery Fee</span>
            <span className="font-mono text-slate-900">{deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Taxes</span>
            <span className="font-mono text-slate-900">₹{tax}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-sm font-black text-slate-900">
            <span>Grand Total</span>
            <span className="font-mono text-emerald-800 text-base">₹{total}</span>
          </div>
        </div>

        {/* ── 5. CONFIRM & PLACE ORDER BUTTON WITH MICRO-INTERACTIONS ── */}
        <div className="relative">
          {/* Subtle Expanding Ripple Effect on Success */}
          {btnState === 'success' && (
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/30 animate-pulse-ring-1 pointer-events-none" />
          )}

          <button
            onClick={handlePlaceOrder}
            disabled={btnState !== 'idle'}
            className={`w-full py-4 rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider transition-all duration-300 relative overflow-hidden ${
              btnState === 'idle'
                ? paymentMethod === 'phonepe'
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30 active:scale-95 cursor-pointer'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-95 cursor-pointer'
                : btnState === 'loading'
                ? 'bg-emerald-700 text-emerald-100 cursor-not-allowed shadow-emerald-700/20'
                : 'bg-emerald-500 text-white shadow-emerald-500/50 scale-[1.02]'
            }`}
          >
            {btnState === 'idle' && (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>{paymentMethod === 'phonepe' ? `PAY WITH PHONEPE (₹${total})` : `CONFIRM ORDER (₹${total})`}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}

            {btnState === 'loading' && (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>VERIFYING & PLACING ORDER...</span>
              </>
            )}

            {btnState === 'success' && (
              <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                <div className="w-6 h-6 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <span>✓ ORDER CONFIRMED</span>
              </div>
            )}
          </button>
        </div>

      </div>

      {/* ── 6. FULLSCREEN SMOOTH GROCERY PACKING & CONFIRMATION ANIMATION OVERLAY ── */}
      {showAnimationModal && confirmedOrder && (
        <OrderConfirmationAnimation
          order={confirmedOrder}
          onComplete={handleAnimationComplete}
          autoRedirectMs={3000}
        />
      )}

    </CustomerShell>
  );
}
