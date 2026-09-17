'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { verifyPhonePeStatus } from '@/lib/phonepeClient';
import { OrderConfirmationAnimation } from '@/components/customer/OrderConfirmationAnimation';
import type { Order, Address } from '@/types';
import { 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShoppingBag, 
  ShieldCheck, 
  Loader2,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const { orders, initializeFirebaseSync, setActiveOrderTrackingId } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showAnimationModal, setShowAnimationModal] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [txnId, setTxnId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const orderIdParam = params.get('orderId') || '';
    const merchantTxnId = params.get('merchantTransactionId') || params.get('transactionId') || '';

    setOrderId(orderIdParam);
    setTxnId(merchantTxnId);

    async function checkStatus() {
      if (!merchantTxnId) {
        if (orderIdParam) {
          // Check if order is already marked paid in store
          const found = orders.find(o => o.id === orderIdParam);
          if (found && (found.paymentStatus === 'paid' || found.paymentMethod === 'cod')) {
            setIsSuccess(true);
            setShowAnimationModal(true);
          } else {
            setIsSuccess(false);
            setErrorMessage('Transaction reference missing.');
          }
        } else {
          setIsSuccess(false);
          setErrorMessage('No transaction details found.');
        }
        setLoading(false);
        return;
      }

      try {
        const verifyRes = await verifyPhonePeStatus(merchantTxnId, orderIdParam);
        
        if (verifyRes.verified || verifyRes.status === 'SUCCESS' || verifyRes.status === 'PAYMENT_SUCCESS') {
          setIsSuccess(true);
          setShowAnimationModal(true);
          try {
            await initializeFirebaseSync(true);
            if (orderIdParam) {
              setActiveOrderTrackingId(orderIdParam);
            }
          } catch {}
          showToast('Payment confirmed via PhonePe! 🎉', 'success');
        } else {
          setIsSuccess(false);
          setErrorMessage(verifyRes.error || (verifyRes.status === 'PAYMENT_ERROR' ? 'Payment was declined or cancelled.' : 'Payment is pending or was not completed.'));
        }
      } catch (err: any) {
        setIsSuccess(false);
        setErrorMessage('Unable to verify payment status. Please check your order history.');
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, [initializeFirebaseSync, setActiveOrderTrackingId]);

  const matchingOrder = orders.find((o) => o.id === orderId);

  const fallbackAddress: Address = {
    id: 'addr-1',
    userId: 'cust-1',
    fullName: 'Customer',
    phone: '+91 8698893348',
    addressLine1: 'Neral Hub',
    city: 'Neral',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '410101',
    latitude: 18.9833,
    longitude: 73.3167,
    isDefault: true,
    addressType: 'Home'
  };

  const fallbackOrder: Order = {
    id: orderId || 'PK-ORDER',
    orderNumber: orderId || 'PK-ORDER',
    customerId: 'cust-1',
    customerName: 'Customer',
    customerPhone: '+91 8698893348',
    storeId: 'store-1',
    storeName: 'PocketKirana Darkstore',
    addressId: 'addr-1',
    address: fallbackAddress,
    deliveryAddress: fallbackAddress,
    items: [],
    subtotal: 101,
    deliveryCharge: 0,
    deliveryFee: 0,
    tax: 0,
    discount: 0,
    total: 101,
    paymentMethod: 'phonepe',
    paymentStatus: isSuccess ? 'paid' : 'pending',
    orderStatus: isSuccess ? 'CONFIRMED' : 'PAYMENT_PENDING',
    placedAt: new Date().toISOString(),
    deliverySlot: 'Instant (30 mins)',
    deliveryOtp: '1234',
    estimatedDeliveryTime: '30 mins'
  };

  const currentOrder = matchingOrder || fallbackOrder;

  const handleAnimationComplete = () => {
    setShowAnimationModal(false);
    router.replace(orderId ? `/orders/track?id=${orderId}` : '/orders/');
  };

  return (
    <CustomerShell title="Payment Status" hideBottomNav>
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-300">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-sm w-full shadow-lg space-y-4 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-black text-slate-900">Verifying PhonePe Payment...</h2>
              <p className="text-xs text-slate-500 font-medium">Contacting gateway to confirm your transaction</p>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="bg-white border border-emerald-100 rounded-3xl p-8 max-w-md w-full shadow-xl space-y-6">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Payment Verified
              </span>
              <h2 className="text-2xl font-black text-slate-900">Order Confirmed!</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Your PhonePe payment was successful. We have received your order and darkstore packing has begun.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Order Number</span>
                <span className="font-bold text-slate-900">#{currentOrder.orderNumber || orderId}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Payment Mode</span>
                <span className="font-bold text-purple-700">PhonePe (UPI / Gateway)</span>
              </div>
              {txnId && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Txn ID</span>
                  <span className="font-mono text-[10px] text-slate-600 truncate max-w-[180px]">{txnId}</span>
                </div>
              )}
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                onClick={() => router.replace(orderId ? `/orders/track?id=${orderId}` : '/orders/')}
                className="w-full bg-[#075C3C] hover:bg-[#0B8F5A] text-white font-black text-xs py-3.5 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Track Live Delivery</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => router.replace('/home')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-2xl transition-all cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-rose-100 rounded-3xl p-8 max-w-md w-full shadow-xl space-y-6">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
              <XCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                Payment Failed / Cancelled
              </span>
              <h2 className="text-2xl font-black text-slate-900">Payment Unsuccessful</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {errorMessage || 'Your transaction was not completed. Your items remain in your cart, and your order has not been placed.'}
              </p>
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                onClick={() => router.replace('/checkout')}
                className="w-full bg-[#E65100] hover:bg-[#D84315] text-white font-black text-xs py-3.5 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Payment</span>
              </button>

              <button
                onClick={() => router.replace('/cart')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-2xl transition-all cursor-pointer"
              >
                Return to Cart
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── IMMERSIVE ORDER CONFIRMED PACKING ANIMATION MODAL ── */}
      {showAnimationModal && (
        <OrderConfirmationAnimation
          order={currentOrder}
          onComplete={handleAnimationComplete}
        />
      )}
    </CustomerShell>
  );
}
