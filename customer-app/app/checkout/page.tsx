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
  Loader2,
  Clock3
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { OrderConfirmationAnimation } from '@/components/customer/OrderConfirmationAnimation';
import { initiatePhonePePayment } from '@/lib/phonepeClient';
import { calculateDeliveryFee } from '@/lib/freeDelivery';
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
    if (!isLoggedIn) {
      router.replace('/login?redirect=/checkout');
    }
  }, [isLoggedIn, router]);

  const [selectedAddressId, setSelectedAddressId] = useState<string>(() => {
    const def = addresses.find((a) => a.isDefault);
    return def ? def.id : addresses[0]?.id || 'addr-1';
  });

  useEffect(() => {
    if (addresses.length > 0) {
      if (!selectedAddressId || !addresses.some((a) => a.id === selectedAddressId)) {
        const def = addresses.find((a) => a.isDefault) || addresses[0];
        if (def) setSelectedAddressId(def.id);
      }
    }
  }, [addresses, selectedAddressId]);

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
  const deliveryCharge = mounted ? calculateDeliveryFee(subtotal) : 0;
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
      // 1. Create order in Backend / Store with safe address fallback
      const cartBackup = [...cart];
      const targetAddressId = selectedAddressId || addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || 'addr-default';
      const selectedAddr = addresses.find((a) => a.id === targetAddressId) || addresses[0];

      if (selectedAddr && typeof selectedAddr.latitude === 'number' && typeof selectedAddr.longitude === 'number') {
        const { calculateDistanceKm } = await import('@/lib/locationServices');
        const dist = calculateDistanceKm(19.0224536, 73.3210018, selectedAddr.latitude, selectedAddr.longitude);
        const isNeralPincode = selectedAddr.postalCode === '410101' || 
          (selectedAddr.city && selectedAddr.city.toLowerCase().includes('neral')) ||
          (selectedAddr.addressLine1 && selectedAddr.addressLine1.toLowerCase().includes('neral'));

        if (dist > 4.5 && !isNeralPincode) {
          showToast(`Outside delivery area: Selected address is ${dist.toFixed(1)} KM from Maule Kirana in Neral (Max radius: 4.5 KM)`, 'error');
          setBtnState('idle');
          isSubmittingRef.current = false;
          return;
        }
      }

      const createdOrder = placeOrder(
        targetAddressId, 
        'Express Delivery', 
        paymentMethod
      );

      // ── CANONICAL API CHECKOUT (PostgreSQL + Firestore mirror + picker trigger) ──
      // Calls POST /api/checkout which reserves stock, issues a sequential PK-XX
      // order number, mirrors to Firestore (needed by PhonePe /create), and
      // auto-triggers the picker queue for COD orders.
      let serverOrderId: string | null = null;
      let serverOrderNumber: string | null = null;

      try {
        const idempotencyKey = `checkout-${currentUser?.id || 'guest'}-${Date.now()}`;
        const selectedAddr2 = addresses.find((a) => a.id === targetAddressId) || addresses[0];
        const apiResponse = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': idempotencyKey,
          },
          body: JSON.stringify({
            cartItems: cart.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              productName: item.product?.name || (item as any).productName,
              unitPrice: item.price,
              imageUrl: item.product?.thumbnail || (item as any).imageUrl,
              sku: (item as any).selectedVariant?.sku || item.product?.sku,
            })),
            address: selectedAddr2 ? {
              fullName: (selectedAddr2 as any).fullName || (selectedAddr2 as any).name,
              phone: selectedAddr2.phone || currentUser?.mobile,
              addressLine1: selectedAddr2.addressLine1,
              addressLine2: selectedAddr2.addressLine2,
              landmark: selectedAddr2.landmark,
              city: selectedAddr2.city,
              state: selectedAddr2.state,
              pincode: selectedAddr2.postalCode || (selectedAddr2 as any).pincode,
              latitude: selectedAddr2.latitude,
              longitude: selectedAddr2.longitude,
            } : undefined,
            paymentMethod,
            couponCode: appliedCoupon?.code,
            storeId: 'store-001',
            idempotencyKey,
          }),
          credentials: 'include',
        });

        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          if (apiData?.success && apiData?.data?.orderId) {
            serverOrderId = apiData.data.orderId;
            serverOrderNumber = apiData.data.orderNumber;
            // Sync canonical IDs into the local Zustand order record
            (createdOrder as any).id = serverOrderId;
            (createdOrder as any).orderNumber = serverOrderNumber;
            if (apiData.data.deliveryOtp) {
              (createdOrder as any).deliveryOtp = apiData.data.deliveryOtp;
            }
          } else if (apiData?.error) {
            // Server rejected (out of stock, inactive item, serviceability) — surface to user
            showToast(apiData.error, 'error');
            setBtnState('idle');
            isSubmittingRef.current = false;
            return;
          }
        }
      } catch (apiErr) {
        // Network error — keep the locally-generated order and proceed (offline resilience)
        console.warn('[Checkout] Canonical API unreachable, using local order ID:', apiErr);
      }

      // Verify valid Order ID
      if (!createdOrder || !createdOrder.id) {
        throw new Error('Order creation returned invalid ID');
      }

      // If PhonePe payment selected, initiate PhonePe Android Native / Web checkout
      if (paymentMethod === 'phonepe') {
        const addr = addresses.find((a) => a.id === selectedAddressId) || addresses[0];

        // If the canonical API was unreachable, manually mirror to Firestore
        // so PhonePe /create can find the order.
        if (!serverOrderId) {
          try {
            const { saveOrderFS } = await import('@/lib/firebaseServices');
            await saveOrderFS(createdOrder);
          } catch (fsErr) {
            console.warn('[Checkout] Background saveOrderFS non-fatal error:', fsErr);
          }
        }

        const { startPhonePeCheckoutFlow } = await import('@/lib/phonepeClient');
        const res = await startPhonePeCheckoutFlow({
          orderId: createdOrder.id,
          amount: total,
          mobileNumber: addr?.phone || currentUser?.mobile || '8698893348',
          customerId: currentUser?.id || 'customer',
          redirectPath: '/checkout/success/',
        }, {
          onPending: () => {
            showToast('Opening PhonePe checkout...', 'info');
          }
        });

        if (res.status === 'REDIRECTED') {
          // Handled via redirect
          return;
        }

        if (res.verified || res.status === 'SUCCESS') {
          // Native payment confirmed and verified by server
          setBtnState('success');
          setConfirmedOrder(createdOrder);
          setTimeout(() => {
            setShowAnimationModal(true);
          }, 750);
          return;
        } else if (res.status === 'CANCELLED') {
          useAppStore.setState({ cart: cartBackup });
          showToast('Payment was cancelled.', 'info');
          setBtnState('idle');
          isSubmittingRef.current = false;
          return;
        } else {
          // Restore cart on payment error
          useAppStore.setState({ cart: cartBackup });
          showToast(res.error || 'Payment could not be verified. Please retry.', 'error');
          setBtnState('idle');
          isSubmittingRef.current = false;
          return;
        }
      }

      // COD / other: show success animation
      setBtnState('success');
      setConfirmedOrder(createdOrder);
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
      router.replace(`/orders/track?id=${confirmedOrder.id}`);
    } else {
      router.replace('/orders');
    }
  };

  // Show a loading skeleton while the store is hydrating
  if (!mounted) {
    return (
      <CustomerShell title="Checkout" showBack backUrl="/cart">
        <div className="p-4 space-y-4 animate-pulse">
          <div className="h-32 bg-slate-200 dark:bg-[#151B23] rounded-3xl" />
          <div className="h-24 bg-slate-200 dark:bg-[#151B23] rounded-3xl" />
          <div className="h-28 bg-slate-200 dark:bg-[#151B23] rounded-3xl" />
        </div>
      </CustomerShell>
    );
  }

  // If cart is empty after hydration and NO order is being placed / confirmed, show empty cart view
  if (mounted && cart.length === 0 && !confirmedOrder && !showAnimationModal && btnState === 'idle') {
    return (
      <CustomerShell title="Checkout" showBack backUrl="/cart">
        <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#263241] rounded-3xl p-8 text-center space-y-4 shadow-xs mt-6">
          <h3 className="text-base font-black text-slate-900 dark:text-[#F9FAFB]">Your cart is empty</h3>
          <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">Add items to your cart before checking out.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl transition-all cursor-pointer"
          >
            Shop Now
          </button>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title="Checkout" showBack backUrl="/cart" hideBottomNav hideFooter>
      <div className="mx-auto w-full max-w-4xl space-y-5 animate-in fade-in duration-200 pb-28">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Confirm where we’re delivering and how you’d like to pay.
        </p>
        <nav aria-label="Checkout sections" className="rounded-2xl border border-border bg-card p-2 shadow-sm">
          <ol className="grid grid-cols-3 gap-1">
            {[
              { id: 'checkout-address', label: 'Address' },
              { id: 'checkout-payment', label: 'Payment' },
              { id: 'checkout-total', label: 'Order total' },
            ].map((step, index) => (
              <li key={step.id}>
                <a href={`#${step.id}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-center text-xs font-bold text-secondary-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-4 focus-visible:ring-primary/20 sm:text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary" aria-hidden="true">{index + 1}</span>
                  {step.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        
        {/* ── 1. DELIVERY ADDRESS SELECTOR ── */}
        <div id="checkout-address" role="region" aria-label="Delivery address" className="scroll-mt-6 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#263241] rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#263241] pb-3">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-[#F9FAFB] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Delivery Address</span>
            </h3>
            <button
              onClick={() => router.push('/saved-addresses')}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manage</span>
            </button>
          </div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#9CA3AF]">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Express delivery, about 30 minutes
          </p>

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
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-[#111827] border-slate-200 dark:border-[#263241] hover:bg-slate-100 dark:hover:bg-[#1B2430]'
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
                        <strong className="font-black text-slate-900 dark:text-[#F9FAFB]">{addr.addressType || 'Home'}</strong>
                        {addr.isDefault && (
                          <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-[#D1D5DB] font-medium mt-0.5 leading-snug">
                        {addr.addressLine1} {addr.houseNumber ? `, House: ${addr.houseNumber}` : ''}, {addr.city} - {addr.postalCode}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-[#9CA3AF] font-mono block mt-0.5">
                        Phone: {addr.phone || currentUser?.mobile || ''}
                      </span>
                    </div>
                  </label>
                );
              })
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#263241] text-xs text-slate-600 dark:text-[#D1D5DB] space-y-2">
                <p>Default delivery to DarkStore Express Area (Neral Hub - 410101)</p>
              </div>
            )}
          </div>
        </div>

        {/* ── 2. PAYMENT METHOD SELECTOR ── */}
        <div id="checkout-payment" role="region" aria-label="Payment method" className="scroll-mt-6 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#263241] rounded-3xl p-5 space-y-3 shadow-xs">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-[#F9FAFB] flex items-center gap-1.5 border-b border-slate-100 dark:border-[#263241] pb-3">
            <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
                        ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-600 ring-2 ring-purple-500/20 shadow-xs'
                        : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-slate-50 dark:bg-[#111827] border-slate-200 dark:border-[#263241] hover:bg-slate-100 dark:hover:bg-[#1B2430]'
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
                        <strong className="block text-xs font-bold text-slate-900 dark:text-[#F9FAFB]">{method.label}</strong>
                        {method.tag && (
                          <span className="text-[9px] font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            {method.tag}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF] font-medium block">{method.desc}</span>
                    </div>
                  </div>
                  {isPhonePe ? (
                    <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs shrink-0">
                      <span className="font-black text-xs font-sans">पे</span>
                    </div>
                  ) : (
                    <Icon className="w-5 h-5 text-slate-400 dark:text-[#9CA3AF] shrink-0" />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* ── 4. ORDER SUMMARY ── */}
        <div id="checkout-total" role="region" aria-label="Order total" className="scroll-mt-6 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#263241] rounded-3xl p-5 space-y-2.5 shadow-xs text-sm font-semibold text-slate-600 dark:text-[#D1D5DB]">
          <h4 className="font-black text-slate-900 dark:text-[#F9FAFB] uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-[#263241]">
            Total Amount ({cartCount} Products)
          </h4>
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-mono text-slate-900 dark:text-[#F9FAFB]">₹{subtotal}</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
              <span>Coupon Savings</span>
              <span className="font-mono font-black">-₹{discount}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Delivery Fee</span>
            <span className="font-mono text-slate-900 dark:text-[#F9FAFB]">{deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Taxes</span>
            <span className="font-mono text-slate-900 dark:text-[#F9FAFB]">₹{tax}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#263241] text-sm font-black text-slate-900 dark:text-[#F9FAFB]">
            <span>Grand Total</span>
            <span className="font-mono text-emerald-800 dark:text-emerald-400 text-base">₹{total}</span>
          </div>
        </div>

      </div>

      <footer aria-label="Place order" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-nav-bg px-3 pt-3 shadow-2xl backdrop-blur-xl [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-muted-foreground">Total payable</p>
            <p className="text-lg font-black leading-tight text-foreground">₹{total}</p>
          </div>
          <div className="relative min-w-0 flex-[2]">
            {btnState === 'success' && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-emerald-500/30 animate-pulse-ring-1" />
            )}
            <button
              onClick={handlePlaceOrder}
              disabled={btnState !== 'idle'}
              aria-live="polite"
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-3 text-xs font-black uppercase tracking-wide shadow-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 sm:text-sm ${
                btnState === 'idle'
                  ? paymentMethod === 'phonepe'
                    ? 'bg-purple-600 text-white shadow-purple-600/30 hover:bg-purple-700 active:scale-[0.99]'
                    : 'bg-primary-700 text-white shadow-primary/30 hover:bg-primary-800 active:scale-[0.99]'
                  : btnState === 'loading'
                  ? 'cursor-not-allowed bg-primary-700 text-white opacity-80'
                  : 'scale-[1.01] bg-emerald-500 text-white shadow-emerald-500/50'
              }`}
            >
              {btnState === 'idle' && (
                <>
                  <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{paymentMethod === 'phonepe' ? 'Pay with PhonePe' : 'Confirm order'}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </>
              )}
              {btnState === 'loading' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span>Placing your order…</span>
                </>
              )}
              {btnState === 'success' && (
                <>
                  <Check className="h-5 w-5" aria-hidden="true" />
                  <span>Order confirmed</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>

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
