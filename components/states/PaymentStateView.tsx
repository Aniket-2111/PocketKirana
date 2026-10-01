'use client';

import React from 'react';
import {
  CreditCard,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

export type PaymentLifecycleStatus =
  | 'INITIATED'
  | 'PROCESSING'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'PENDING'
  | 'REFUND_INITIATED'
  | 'REFUNDED';

export interface PaymentStateViewProps {
  status: PaymentLifecycleStatus;
  amount?: number;
  transactionId?: string;
  errorMessage?: string;
  onRetry?: () => void;
  onChangePaymentMethod?: () => void;
  onCheckStatus?: () => void;
  onContinue?: () => void;
  className?: string;
}

export const PaymentStateView: React.FC<PaymentStateViewProps> = ({
  status,
  amount,
  transactionId,
  errorMessage,
  onRetry,
  onChangePaymentMethod,
  onCheckStatus,
  onContinue,
  className = '',
}) => {
  const formattedAmount = amount !== undefined ? `₹${amount.toFixed(2)}` : null;

  switch (status) {
    case 'PROCESSING':
    case 'INITIATED':
      return (
        <div
          role="status"
          aria-live="polite"
          className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl max-w-md mx-auto animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Processing Payment {formattedAmount && `(${formattedAmount})`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Please do not close this screen or press back while we securely connect with PhonePe / UPI gateway.
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50/60 dark:bg-emerald-950/30 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
            <ShieldCheck className="w-4 h-4" />
            <span>256-Bit Encrypted Payment Vault</span>
          </div>
        </div>
      );

    case 'VERIFYING':
      return (
        <div
          role="status"
          aria-live="polite"
          className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl max-w-md mx-auto animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Verifying Payment with Bank
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Confirming transaction webhook signature and reserving order items...
            </p>
          </div>
          {transactionId && (
            <p className="text-[11px] font-mono text-slate-400">Txn: {transactionId}</p>
          )}
        </div>
      );

    case 'SUCCESS':
      return (
        <div
          role="status"
          aria-live="polite"
          className={`p-6 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 rounded-3xl text-center space-y-4 shadow-xl max-w-md mx-auto animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Payment Confirmed!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formattedAmount ? `Amount of ${formattedAmount} received.` : 'Payment received successfully.'}
            </p>
          </div>
          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center justify-center gap-2 bg-[#006E2F] hover:bg-[#004B1E] text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer w-full"
            >
              <span>View Order Status</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      );

    case 'FAILED':
    case 'CANCELLED':
      return (
        <div
          role="alert"
          aria-live="assertive"
          className={`p-6 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/60 rounded-3xl text-center space-y-4 shadow-xl max-w-md mx-auto animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {status === 'CANCELLED' ? 'Payment Cancelled' : 'Payment Failed'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              {errorMessage || 'The bank or UPI provider could not complete the payment. No money was deducted.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center justify-center gap-1.5 bg-[#006E2F] hover:bg-[#004B1E] text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Payment</span>
              </button>
            )}
            {onChangePaymentMethod && (
              <button
                type="button"
                onClick={onChangePaymentMethod}
                className="inline-flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <span>Change Method</span>
              </button>
            )}
          </div>
        </div>
      );

    case 'TIMEOUT':
    case 'PENDING':
      return (
        <div
          role="status"
          aria-live="polite"
          className={`p-6 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-3xl text-center space-y-4 shadow-xl max-w-md mx-auto animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Payment Verification Pending
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Your bank is taking slightly longer than usual to confirm the payment. If money was deducted, it will be automatically confirmed or refunded within 24 hours.
            </p>
          </div>
          {onCheckStatus && (
            <button
              type="button"
              onClick={onCheckStatus}
              className="inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm active:scale-95 cursor-pointer w-full"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Check Status Again</span>
            </button>
          )}
        </div>
      );

    case 'REFUND_INITIATED':
    case 'REFUNDED':
      return (
        <div
          role="status"
          aria-live="polite"
          className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xl max-w-md mx-auto animate-fadeSlideUp ${className}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
            <CreditCard className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {status === 'REFUNDED' ? 'Refund Processed' : 'Refund Initiated'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              {formattedAmount ? `Amount of ${formattedAmount} ` : 'Amount '}
              {status === 'REFUNDED'
                ? 'has been refunded to your original payment method.'
                : 'is being processed. Funds typically settle in 2–4 business hours.'}
            </p>
          </div>
        </div>
      );

    default:
      return null;
  }
};
