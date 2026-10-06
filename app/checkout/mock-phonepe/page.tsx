'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function PhonePeMockSimulator() {
  // Hard security lock: Never render simulator in production builds
  if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
    notFound();
  }

  const router = useRouter();
  
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const transactionId = searchParams?.get('transactionId') || 'TXN_PK_MOCK_123456';
  const orderId = searchParams?.get('orderId') || 'ord-mock-123';
  const amount = searchParams?.get('amount') || '0';

  const [processing, setProcessing] = useState(false);

  const handleSimulate = async (success: boolean) => {
    setProcessing(true);
    try {
      // Direct client check verification test
      const response = await fetch('/api/payments/phonepe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantTransactionId: transactionId,
          orderId,
          isMockSuccess: success
        }),
      });

      const json = await response.json();
      if (json.success) {
        if (success) {
          showToast('Payment Simulator: Simulated SUCCESS', 'success');
          router.push(`/checkout/success?merchantTransactionId=${transactionId}&orderId=${orderId}`);
        } else {
          showToast('Payment Simulator: Simulated FAILURE', 'error');
          router.push(`/checkout/success?merchantTransactionId=${transactionId}&orderId=${orderId}&isMockSuccess=false`);
        }
      } else {
        showToast(json.error || 'Failed to update simulator state', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error updating simulation', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
        
        {/* PhonePe Branding Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 justify-center">
          <Smartphone className="w-8 h-8 text-purple-500" />
          <span className="text-xl font-black tracking-tight text-white">
            PhonePe <span className="text-purple-500">Simulator</span>
          </span>
        </div>

        <div className="space-y-4 text-sm text-slate-300">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Order ID:</span>
              <span className="font-bold text-white">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction ID:</span>
              <span className="font-mono text-xs text-purple-400">{transactionId}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2 mt-2">
              <span className="text-slate-500 font-bold">Amount to Pay:</span>
              <span className="font-extrabold text-lg text-emerald-400">₹{amount}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center leading-relaxed">
            This is a secure local developer simulator. Selecting an action below will mock-notify the backend API route.
          </p>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleSimulate(true)}
            disabled={processing}
            className="flex flex-col items-center justify-center p-4 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.98] border border-emerald-500/30 rounded-2xl text-emerald-400 transition-all font-bold disabled:opacity-50"
          >
            <CheckCircle2 className="w-8 h-8 mb-2" />
            <span>Success</span>
          </button>

          <button
            onClick={() => handleSimulate(false)}
            disabled={processing}
            className="flex flex-col items-center justify-center p-4 bg-rose-500/10 hover:bg-rose-500/20 active:scale-[0.98] border border-rose-500/30 rounded-2xl text-rose-400 transition-all font-bold disabled:opacity-50"
          >
            <XCircle className="w-8 h-8 mb-2" />
            <span>Failure</span>
          </button>
        </div>
      </div>
    </div>
  );
}
