'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { showToast } from '@/components/ui/Toast';
import { PaymentMethod, Address, Store } from '@/types';
import { LocationPickerModal } from '@/components/customer/LocationPickerModal';
import { checkZoneServiceability, setStoresState, getStores } from '@/lib/locationServices';
import { fetchShopsFS } from '@/lib/firebaseServices';
import { callPlaceOrder } from '@/lib/functionsClient';
import { OrderConfirmationAnimation } from '@/components/customer/OrderConfirmationAnimation';
import type { Order } from '@/types';
import {
  MapPin,
  Clock,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Plus,
  ArrowLeft,
  Truck,
  BellOff,
  PhoneCall,
  DoorOpen,
  AlertTriangle,
  BellRing,
  Loader2,
  Check
} from 'lucide-react';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const {
    cart,
    addresses,
    addAddress,
    placeOrder,
    appliedCoupon,
    currentUser
  } = useAppStore();

  const [mounted, setMounted] = useState(false);
  const [storeLoaded, setStoreLoaded] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
  const [selectedAddrId, setSelectedAddrId] = useState(defaultAddr?.id || '');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cod');
  const [deliveryInstruction, setDeliveryInstruction] = useState<'door' | 'call' | 'bell'>('door');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Success Confirmation Animation State
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Notify Me state for checkout
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  // Sync store settings from Firestore on mount
  React.useEffect(() => {
    setMounted(true);
    async function loadStore() {
      try {
        const shops = await fetchShopsFS();
        if (shops && shops.length > 0) {
          setStoresState(shops);
        }
      } catch (e) {
        console.warn('Could not sync store settings from Firestore:', e);
      } finally {
        setStoreLoaded(true);
      }
    }
    loadStore();
  }, []);

  const selectedAddr = addresses.find((a) => a.id === selectedAddrId) || defaultAddr;

  // Real-time Serviceability validation for selected address
  const selectedZone = selectedAddr
    ? checkZoneServiceability(selectedAddr.latitude, selectedAddr.longitude)
    : null;
  const isSelectedServiceable = selectedZone ? selectedZone.isServiceable : true;

  const subtotal = useMemo(
    () => (mounted ? cart.reduce((sum, item) => sum + item.price * item.quantity, 0) : 0),
    [mounted, cart]
  );

  let discount = 20;
  if (mounted && appliedCoupon) {
    if (appliedCoupon.type === 'fixed') {
      discount = appliedCoupon.value;
    } else {
      discount = Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.maxDiscount);
    }
  }

  const deliveryCharge = 20;
  const grandTotal = mounted ? Math.max(0, subtotal - discount + deliveryCharge) : 0;

  // Auto-select newly added address
  const prevAddrCount = React.useRef(addresses.length);
  React.useEffect(() => {
    if (addresses.length > prevAddrCount.current) {
      const newest = addresses[0];
      if (newest) setSelectedAddrId(newest.id);
    }
    prevAddrCount.current = addresses.length;
  }, [addresses]);

  const handleNotifyMe = async () => {
    if (!selectedAddr) return;
    setNotifying(true);
    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || 'guest',
          name: selectedAddr.fullName,
          phone: selectedAddr.phone,
          address: `${selectedAddr.addressLine1}, ${selectedAddr.city}`,
          latitude: selectedAddr.latitude,
          longitude: selectedAddr.longitude,
          pincode: selectedAddr.postalCode,
          shopId: selectedZone?.storeId || 'store-1',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotified(true);
        showToast('Request recorded! We will notify you when delivery expands to this area.', 'success');
      } else {
        showToast(data.error || 'Failed to submit request', 'error');
      }
    } catch (e) {
      setNotified(true);
      showToast('Request recorded!', 'success');
    } finally {
      setNotifying(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddr) {
      showToast('Please select a delivery address', 'error');
      return;
    }

    if (cart.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }

    // Quick client-side zone pre-check (authoritative check is server-side)
    const zone = checkZoneServiceability(selectedAddr.latitude, selectedAddr.longitude);
    if (!zone.isServiceable) {
      showToast(
        `Delivery unavailable: ${zone.message || 'This address is outside our delivery area.'}`,
        'error'
      );
      setStep(1);
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Post to Canonical PostgreSQL Checkout API
      const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let result: any = null;

      try {
        const checkoutRes = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': idempotencyKey,
          },
          body: JSON.stringify({
            cartItems: cart.map((item) => ({
              productId: item.productId || item.product?.id || item.id,
              productName: item.product?.name || (item as any).name || '',
              unitPrice: item.price,
              imageUrl: item.product?.thumbnail || item.product?.image || (item as any).imageUrl || '',
              sku: item.product?.sku || (item as any).sku || '',
              quantity: item.quantity,
            })),
            address: selectedAddr,
            addressId: selectedAddr.id,
            paymentMethod: selectedPayment as 'cod' | 'razorpay' | 'phonepe' | 'upi' | 'card',
            couponCode: appliedCoupon?.code,
            storeId: 'store-001',
            idempotencyKey,
          }),
        });

        const checkoutData = await checkoutRes.json();
        if (checkoutRes.ok && checkoutData.success) {
          result = {
            success: true,
            orderId: checkoutData.data.orderId,
            orderNumber: checkoutData.data.orderNumber,
            total: checkoutData.data.total,
            requiresPayment: checkoutData.data.requiresPayment,
          };
        }
      } catch (e) {
        console.warn('[Checkout] PostgreSQL API direct attempt, fallback to Cloud Function:', e);
      }

      // Fallback to Cloud Function if API was not reachable
      if (!result) {
        result = await callPlaceOrder({
          cartItems: cart.map((item) => ({
            productId: item.productId || item.product?.id || item.id,
            quantity: item.quantity,
          })),
          addressId: selectedAddr.id,
          paymentMethod: selectedPayment as 'cod' | 'razorpay' | 'phonepe' | 'upi' | 'card',
          couponCode: appliedCoupon?.code,
          storeId: 'store-001',
        });
      }

      if (result.success) {
        if (result.requiresPayment) {
          // ── PHONEPE PAYMENT FLOW ──
          if (selectedPayment === 'phonepe') {
            const orderResponse = await fetch('/api/payments/phonepe/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: result.orderId }),
            });
            const orderResData = await orderResponse.json();

            if (!orderResData.success) {
              throw new Error(orderResData.error || 'Failed to create PhonePe order');
            }

            const { redirectUrl } = orderResData.data;
            window.location.href = redirectUrl;
            return;
          }

          // ── ONLINE PAYMENT WORKFLOW (Razorpay) ──
          const scriptLoaded = await loadRazorpayScript();
          if (!scriptLoaded) {
            showToast('Failed to load payment gateway script. Please try again.', 'error');
            setIsProcessing(false);
            return;
          }

          // Create order on backend (simulated or real Razorpay instance)
          const orderResponse = await fetch('/api/payments/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: result.total }),
          });
          const orderResData = await orderResponse.json();
          if (!orderResData.success) {
            throw new Error(orderResData.error || 'Failed to create payment order');
          }

          const { razorpayOrderId, keyId } = orderResData.data;

          const options = {
            key: keyId,
            amount: Math.round(result.total * 100),
            currency: 'INR',
            name: 'PocketKirana',
            description: `Order #${result.orderNumber}`,
            order_id: razorpayOrderId,
            handler: async (response: any) => {
              setIsProcessing(true);
              try {
                // Verify payment on server
                const verifyResponse = await fetch('/api/payments/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    razorpayOrderId,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  }),
                });
                const verifyData = await verifyResponse.json();
                if (verifyData.success && verifyData.data.verified) {
                  const placed = placeOrder(
                    selectedAddr.id,
                    `${zone.estimatedDeliveryMinutes}–${zone.estimatedDeliveryMinutes + 5} mins`,
                    selectedPayment,
                    result.orderId,
                    result.orderNumber
                  );
                  setConfirmedOrder(placed);
                  setShowSuccessAnimation(true);
                } else {
                  showToast('Payment verification failed. Please contact support.', 'error');
                }
              } catch (err: any) {
                console.error('[Payment Verification Error]', err);
                showToast(err.message || 'Payment verification failed.', 'error');
              } finally {
                setIsProcessing(false);
              }
            },
            modal: {
              ondismiss: () => {
                showToast('Payment cancelled by user.', 'warning');
                setIsProcessing(false);
              }
            },
            prefill: {
              name: currentUser?.firstName || 'Customer',
              contact: currentUser?.mobile || '',
            },
            theme: {
              color: '#0F532B',
            },
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        } else {
          // ── COD WORKFLOW ──
          const placed = placeOrder(
            selectedAddr.id,
            `${zone.estimatedDeliveryMinutes}–${zone.estimatedDeliveryMinutes + 5} mins`,
            selectedPayment,
            result.orderId,
            result.orderNumber
          );
          setConfirmedOrder(placed);
          setShowSuccessAnimation(true);
        }
      } else {
        showToast('Failed to place order. Please try again.', 'error');
      }
    } catch (err: any) {
      console.error('[Checkout] placeOrder error:', err);
      showToast(err?.message || 'Failed to place order. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };


  if (!mounted) {
    return (
      <>
        <RoleSwitcher />
        <CustomerLayout>
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6">
            <div className="h-14 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 animate-pulse" />
            <div className="h-64 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 animate-pulse" />
          </div>
        </CustomerLayout>
      </>
    );
  }

  if (cart.length === 0 && !confirmedOrder) {
    return (
      <>
        <RoleSwitcher />
        <CustomerLayout>
          <div className="max-w-4xl mx-auto px-4 py-16">
            <EmptyState
              variant="cart"
              title="Your cart is empty"
              description="Add items from Maule Kirana darkstore to proceed with 30-min express checkout."
              primaryAction={{ label: 'Explore Groceries', href: '/' }}
            />
          </div>
        </CustomerLayout>
      </>
    );
  }

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div suppressHydrationWarning className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          <Breadcrumb items={[{ label: step === 1 ? 'Address Selection' : 'Checkout & Payment' }]} />

          {/* ── STEP PROGRESS BAR (Matching Screen 8 & 9) ── */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center justify-between sm:justify-center gap-2 sm:gap-10">
            {/* Step 1 */}
            <div
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                step === 1 ? 'text-[#075C3C] font-extrabold' : 'text-gray-400 font-bold'
              }`}
            >
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-black ${
                step === 1 ? 'bg-[#0B8F5A] text-white' : 'bg-emerald-100 text-[#075C3C]'
              }`}>
                1
              </div>
              <span className="text-[11px] sm:text-sm">Address</span>
            </div>

            <div className="flex-1 sm:flex-none sm:w-12 h-0.5 bg-gray-200 max-w-[40px] sm:max-w-none" />

            {/* Step 2 */}
            <div
              onClick={() => {
                if (addresses.length === 0) {
                  showToast('Please add an address first', 'error');
                  return;
                }
                if (!isSelectedServiceable) {
                  showToast('Selected address is outside the delivery area', 'error');
                  return;
                }
                setStep(2);
              }}
              className={`flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                step === 2 ? 'text-[#075C3C] font-extrabold' : 'text-gray-400 font-bold'
              }`}
            >
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-black ${
                step === 2 ? 'bg-[#0B8F5A] text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                2
              </div>
              <span className="text-[11px] sm:text-sm">Payment</span>
            </div>

            <div className="flex-1 sm:flex-none sm:w-12 h-0.5 bg-gray-200 max-w-[40px] sm:max-w-none" />

            {/* Step 3 */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 font-bold opacity-60">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-black">
                3
              </div>
              <span className="text-[11px] sm:text-sm">Confirm</span>
            </div>
          </div>

          {/* Location Picker Modal */}
          <LocationPickerModal
            isOpen={showLocationPicker}
            onClose={() => {
              setShowLocationPicker(false);
              setEditingAddress(null);
            }}
            editingAddress={editingAddress}
          />

          {/* ── STEP 1: ADDRESS SELECTION ── */}
          {step === 1 && (
            <div className="space-y-5 sm:space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">Select Delivery Address</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Where should we deliver your fresh order?</p>
                </div>
                {addresses.length > 0 && (
                  <button
                    onClick={() => {
                      setEditingAddress(null);
                      setShowLocationPicker(true);
                    }}
                    className="w-full sm:w-auto bg-emerald-50 text-[#075C3C] border border-emerald-300 font-extrabold text-xs px-3.5 py-2.5 rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add New Address
                  </button>
                )}
              </div>

              {/* Empty State — no saved addresses */}
              {addresses.length === 0 && (
                <div className="bg-white border-2 border-dashed border-emerald-200 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-[#0F532B]" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-base">No saved address</h3>
                    <p className="text-xs text-gray-500 mt-1">Add a delivery location on Google Maps to continue</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingAddress(null);
                      setShowLocationPicker(true);
                    }}
                    className="flex items-center gap-2 bg-[#0F532B] hover:bg-[#0B3E20] text-white font-black text-sm px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4" />
                    Add Delivery Location
                  </button>
                </div>
              )}

              {/* Address Cards Grid */}
              {addresses.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddrId === addr.id;
                    const zone = checkZoneServiceability(addr.latitude, addr.longitude);
                    const isServiceable = zone.isServiceable;

                    return (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddrId(addr.id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? isServiceable
                              ? 'border-[#0F532B] bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500'
                              : 'border-amber-500 bg-amber-50/40 shadow-sm ring-1 ring-amber-400'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between font-bold text-xs text-gray-900 mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name="addr"
                                checked={isSelected}
                                onChange={() => setSelectedAddrId(addr.id)}
                                className="accent-[#0F532B]"
                              />
                              {addr.addressType} {addr.isDefault && <span className="text-[#0F532B] text-[10px] font-black">(Default)</span>}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAddress(addr);
                                setShowLocationPicker(true);
                              }}
                              className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                            >Edit</button>
                          </div>
                          <h4 className="font-extrabold text-xs text-gray-900">{addr.fullName}</h4>
                          <p className="text-xs text-gray-600 mt-1 leading-snug">
                            {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}, {addr.city}, {addr.state} - {addr.postalCode}
                          </p>
                          <span className="text-[11px] text-gray-500 block mt-1">Mobile: {addr.phone}</span>

                          {/* Serviceability Badge */}
                          <div className="mt-2.5">
                            {isServiceable ? (
                              <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Delivery Available ({zone.estimatedDeliveryMinutes} min)
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" /> Outside {zone.radiusKm} KM Area ({zone.distanceKm} KM)
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <span className={`text-white font-bold text-[10px] text-center py-1 rounded-lg uppercase tracking-wider ${
                            isServiceable ? 'bg-[#0F532B]' : 'bg-amber-600'
                          }`}>
                            {isServiceable ? '✓ Selected Delivery Address' : 'Selected (Outside Delivery Area)'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Address Unserviceable Warning Banner */}
              {selectedAddr && !isSelectedServiceable && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-black text-amber-900">
                        📍 We&apos;re Coming Soon to this Area!
                      </h4>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        PocketKirana is not delivering to <strong>{selectedAddr.addressLine1}</strong> yet. This address is <strong>{selectedZone?.distanceKm} KM away</strong>, which exceeds our active store radius of <strong>{selectedZone?.radiusKm} KM</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {!notified ? (
                      <button
                        type="button"
                        onClick={handleNotifyMe}
                        disabled={notifying}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        {notifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
                        <span>Notify Me When Available in This Area</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Notification request recorded!
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowLocationPicker(true)}
                      className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
                    >
                      Pick a different address
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Link
                  href="/categories"
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 text-center sm:text-left py-2"
                >
                  ← Continue Browsing Products
                </Link>

                <button
                  onClick={() => {
                    if (addresses.length === 0) {
                      showToast('Please add a delivery address first', 'error');
                      setShowLocationPicker(true);
                      return;
                    }
                    if (!isSelectedServiceable) {
                      showToast('Selected address is outside the delivery area. Please select a serviceable location.', 'error');
                      return;
                    }
                    setStep(2);
                  }}
                  disabled={!isSelectedServiceable || addresses.length === 0}
                  className={`font-black text-xs sm:text-sm px-8 py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    isSelectedServiceable && addresses.length > 0
                      ? 'bg-[#0B8F5A] hover:bg-[#075C3C] text-white cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSelectedServiceable ? 'CONTINUE TO PAYMENT' : 'SERVICE COMING SOON'} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: CHECKOUT & PAYMENT (Screen 9) ── */}
          {step === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Main Area */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Delivery Address Summary Box */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Delivery Address</span>
                    <h4 className="font-extrabold text-xs text-gray-900 mt-0.5">{selectedAddr?.fullName}</h4>
                    <p className="text-xs text-gray-600 truncate max-w-md">
                      {selectedAddr?.addressLine1}, {selectedAddr?.city}, Maharashtra - {selectedAddr?.postalCode} | Mobile: {selectedAddr?.phone}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs font-extrabold text-emerald-600 hover:underline shrink-0"
                  >
                    Change
                  </button>
                </div>

                {/* Delivery Instructions (Matching Screen 9) */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
                  <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Delivery Instructions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label
                      onClick={() => setDeliveryInstruction('door')}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2 text-xs font-semibold transition-all ${
                        deliveryInstruction === 'door'
                          ? 'border-[#0F532B] bg-emerald-50/50 text-[#0F532B] font-bold'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <DoorOpen className="w-4 h-4 text-[#0F532B]" />
                      <span>Leave at door</span>
                    </label>

                    <label
                      onClick={() => setDeliveryInstruction('call')}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2 text-xs font-semibold transition-all ${
                        deliveryInstruction === 'call'
                          ? 'border-[#0F532B] bg-emerald-50/50 text-[#0F532B] font-bold'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <PhoneCall className="w-4 h-4 text-[#0F532B]" />
                      <span>Call before delivery</span>
                    </label>

                    <label
                      onClick={() => setDeliveryInstruction('bell')}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2 text-xs font-semibold transition-all ${
                        deliveryInstruction === 'bell'
                          ? 'border-[#0F532B] bg-emerald-50/50 text-[#0F532B] font-bold'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <BellOff className="w-4 h-4 text-[#0F532B]" />
                      <span>Don&apos;t ring bell</span>
                    </label>
                  </div>
                </div>

                {/* Payment Options */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                  <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Payment Options</h3>

                  <div className="space-y-2.5">
                    {/* COD */}
                    <div
                      onClick={() => setSelectedPayment('cod')}
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        selectedPayment === 'cod'
                          ? 'border-[#0F532B] bg-emerald-50/40 ring-1 ring-emerald-500'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={selectedPayment === 'cod'}
                          onChange={() => setSelectedPayment('cod')}
                          className="accent-[#0F532B]"
                        />
                        <div>
                          <p className="text-xs font-extrabold text-gray-900">Cash on Delivery (Cash / UPI at doorstep)</p>
                          <p className="text-[11px] text-gray-500">Pay cash or scan QR when delivery partner arrives</p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-[#0F532B] bg-emerald-100 px-2 py-0.5 rounded-md">
                        Recommended
                      </span>
                    </div>

                    {/* Online Payment (UPI / Cards / Netbanking) */}
                    <div
                      onClick={() => setSelectedPayment('upi')}
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        selectedPayment === 'upi'
                          ? 'border-[#0F532B] bg-emerald-50/40 ring-1 ring-emerald-500'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={selectedPayment === 'upi'}
                          onChange={() => setSelectedPayment('upi')}
                          className="accent-[#0F532B]"
                        />
                        <div>
                          <p className="text-xs font-extrabold text-gray-900">Online Payment (UPI, Cards, NetBanking)</p>
                          <p className="text-[11px] text-gray-500">Google Pay, PhonePe, Paytm, Debit/Credit Cards</p>
                        </div>
                      </div>
                      <Smartphone className="w-4 h-4 text-gray-400" />
                    </div>

                    {/* PhonePe Payment Gateway */}
                    <div
                      onClick={() => setSelectedPayment('phonepe')}
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        selectedPayment === 'phonepe'
                          ? 'border-[#0F532B] bg-emerald-50/40 ring-1 ring-emerald-500'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={selectedPayment === 'phonepe'}
                          onChange={() => setSelectedPayment('phonepe')}
                          className="accent-[#0F532B]"
                        />
                        <div>
                          <p className="text-xs font-extrabold text-gray-900">PhonePe (UPI, Cards, Wallet)</p>
                          <p className="text-[11px] text-gray-500">Pay securely via PhonePe payment page</p>
                        </div>
                      </div>
                      <Smartphone className="w-4 h-4 text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Order Summary Column */}
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                  <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Order Summary</h3>

                  {/* Cart items list preview */}
                  <div className="max-h-48 overflow-y-auto space-y-2 divide-y divide-gray-100 text-xs">
                    {cart.map((item) => (
                      <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                        <span className="truncate max-w-[170px] font-semibold text-gray-800">
                          {item.quantity}x {item.product?.name || 'Product'}
                        </span>
                        <span className="font-bold text-gray-900">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Item Total</span>
                      <span>₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Store Discount</span>
                      <span>-₹{discount}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery Partner Fee</span>
                      <span>₹{deliveryCharge}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-black text-sm text-gray-900">
                      <span>To Pay</span>
                      <span>₹{grandTotal}</span>
                    </div>
                  </div>

                  {/* Place Order Button */}
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isProcessing || !isSelectedServiceable}
                    className="w-full bg-[#0B8F5A] hover:bg-[#075C3C] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black text-sm py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying &amp; Placing Order...</span>
                      </>
                    ) : (
                      <>
                        <span>PLACE ORDER (₹{grandTotal})</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FULLSCREEN SMOOTH ORDER CONFIRMATION ANIMATION ── */}
        {showSuccessAnimation && confirmedOrder && (
          <OrderConfirmationAnimation
            order={confirmedOrder}
            onComplete={() => router.push(`/orders/${confirmedOrder.id}/track`)}
            autoRedirectMs={3000}
          />
        )}

      </CustomerLayout>
    </>
  );
}

