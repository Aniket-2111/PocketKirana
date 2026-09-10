'use client';

import React from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Check, AlertCircle } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { OrderConfirmationAnimation } from '@/components/customer/OrderConfirmationAnimation';

export default function OrderSuccessPage() {
  const { activeOrderTrackingId, orders, initializeFirebaseSync, setActiveOrderTrackingId } = useAppStore();
  
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const merchantTransactionId = searchParams?.get('merchantTransactionId');
  const orderId = searchParams?.get('orderId');
  const isMockFailure = searchParams?.get('isMockFailure') === 'true' || searchParams?.get('isMockSuccess') === 'false';

  const [verifying, setVerifying] = React.useState(!!merchantTransactionId && !isMockFailure);
  const [error, setError] = React.useState<string | null>(isMockFailure ? 'Payment failed on simulated gateway' : null);
  const [showAnimation, setShowAnimation] = React.useState(false);

  React.useEffect(() => {
    if (!merchantTransactionId || !orderId || isMockFailure) return;

    let active = true;

    async function verifyPayment() {
      try {
        setVerifying(true);
        const res = await fetch('/api/payments/phonepe/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchantTransactionId, orderId }),
        });
        const json = await res.json();
        
        if (active) {
          if (json.success && json.data.verified) {
            initializeFirebaseSync();
            setActiveOrderTrackingId(orderId || null);
            setShowAnimation(true);
            showToast('Payment verified successfully! 🎉', 'success');
          } else {
            setError(json.error || 'PhonePe payment verification failed');
            showToast('Payment verification failed.', 'error');
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Payment status check failed');
        }
      } finally {
        if (active) {
          setVerifying(false);
        }
      }
    }

    verifyPayment();

    return () => {
      active = false;
    };
  }, [merchantTransactionId, orderId, isMockFailure, initializeFirebaseSync, setActiveOrderTrackingId]);

  const currentOrder = orders.find((o) => o.id === (orderId || activeOrderTrackingId)) || orders[0];

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        {verifying ? (
          /* Verifying / Loading State */
          <div className="min-h-[75vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center space-y-6 border border-gray-100 shadow-xl flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-[#53B175] border-t-transparent rounded-full animate-spin" />
              <h2 className="text-xl font-extrabold text-gray-900 mt-4">Verifying Payment...</h2>
              <p className="text-xs text-gray-500 font-bold max-w-xs leading-relaxed">
                We are securely validating your transaction status with PhonePe. Please do not close or refresh this page.
              </p>
            </div>
          </div>
        ) : error ? (
          /* Error / Failure State */
          <div className="min-h-[75vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center space-y-6 border border-gray-100 shadow-xl relative overflow-hidden">
              <div className="relative w-28 h-28 rounded-full bg-rose-500 text-white flex items-center justify-center mx-auto shadow-lg ring-8 ring-rose-50">
                <AlertCircle className="w-14 h-14" />
              </div>

              <div className="space-y-2 pt-2">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-snug">
                  Payment Failed
                </h1>
                <p className="text-xs text-rose-500 font-bold max-w-xs mx-auto leading-relaxed">
                  {error}
                </p>
              </div>

              <div className="space-y-2 pt-4 max-w-xs mx-auto">
                <Link
                  href="/checkout"
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black text-sm py-4 rounded-2xl shadow-md transition-all active:scale-[0.98] block text-center"
                >
                  Retry Payment
                </Link>
                <Link
                  href="/"
                  className="w-full bg-transparent text-gray-900 font-black text-sm py-3 block text-center hover:opacity-80 transition-opacity"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Success State */
          <div className="min-h-[75vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center space-y-6 border border-gray-100 shadow-xl relative overflow-hidden">
              
              {/* Confetti Background Shapes */}
              <div className="absolute top-6 left-8 w-3 h-3 rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <div className="absolute top-12 right-10 w-2.5 h-2.5 rounded-full bg-amber-400 opacity-60" />
              <div className="absolute bottom-16 left-12 w-2 h-2 rounded-full bg-sky-400 opacity-60" />
              <div className="absolute bottom-10 right-8 w-3 h-3 rounded-full bg-purple-400 opacity-60" />

              {/* Circular Green Checkmark Icon */}
              <div className="relative w-28 h-28 rounded-full bg-[#53B175] text-white flex items-center justify-center mx-auto shadow-lg ring-8 ring-emerald-50">
                <Check className="w-14 h-14 stroke-[3]" />
              </div>

              {/* Titles */}
              <div className="space-y-2 pt-2">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-snug">
                  Your Order has been<br />accepted
                </h1>
                <p className="text-xs text-gray-400 font-bold max-w-xs mx-auto leading-relaxed">
                  Your items have been placed and are on their way to being processed
                </p>
              </div>

              {/* Order Details Badge */}
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 text-xs font-bold text-gray-600 max-w-xs mx-auto">
                <span>Order ID: </span>
                <span className="font-black text-[#53B175]">{currentOrder?.orderNumber || 'PK102938'}</span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 max-w-xs mx-auto">
                <Link
                  href={`/orders/${currentOrder?.id || 'PK102938'}/track`}
                  className="w-full bg-[#53B175] hover:bg-[#469e67] text-white font-black text-sm py-4 rounded-2xl shadow-md transition-all active:scale-[0.98] block text-center"
                >
                  Track Order
                </Link>

                <Link
                  href="/"
                  className="w-full bg-transparent text-gray-900 font-black text-sm py-3 block text-center hover:opacity-80 transition-opacity"
                >
                  Back to home
                </Link>
              </div>

            </div>
          </div>
        )}
        {showAnimation && currentOrder && (
          <OrderConfirmationAnimation
            order={currentOrder}
            onComplete={() => {
              setShowAnimation(false);
            }}
            autoRedirectMs={3500}
          />
        )}
      </CustomerLayout>
    </>
  );
}
