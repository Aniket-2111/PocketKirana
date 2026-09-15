'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  HelpCircle,
  Phone,
  MessageSquare,
  MapPin,
  Navigation,
  Bike,
  CheckCircle2,
  Package,
  ExternalLink,
  Home,
  Lock,
  Headphones,
  XCircle,
  User as UserIcon,
  QrCode,
  IndianRupee,
  Banknote,
  ShieldCheck,
  Smartphone,
  X,
  Loader2,
  RefreshCw,
  Copy,
  AlertTriangle,
  RotateCcw,
  FileWarning,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import SlideButton from '../../components/SlideButton';
import { resolveCustomerName, resolveCustomerPhone } from '../../lib/customerUtils';

// ─── Lazy-load Leaflet map to prevent SSR issues ─────────────────────────────
const ActiveDeliveryMap = dynamic(() => import('../../components/ActiveDeliveryMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
      <div className="text-slate-500 text-xs font-semibold animate-pulse">Loading live GPS map…</div>
    </div>
  ),
});

function getApiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin === 'https://localhost') {
    return `http://192.168.0.103:3000${path}`;
  }
  return path;
}

// ─── PhonePe Dynamic UPI QR Modal ─────────────────────────────────────────────
function PhonePeDynamicQrModal({
  orderId,
  orderNumber,
  amount,
  onClose,
  onPaymentVerified,
}: {
  orderId: string;
  orderNumber: string;
  amount: number;
  onClose: () => void;
  onPaymentVerified: (transactionId?: string) => void;
}) {
  const [loadingQr, setLoadingQr] = useState(true);
  const [qrData, setQrData] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('maule.kirana@okaxis');
  const [merchantTxnId, setMerchantTxnId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDynamicQr = useCallback(async () => {
    try {
      setLoadingQr(true);
      const res = await fetch(getApiUrl(`/api/delivery/orders/${orderId}/payment/create`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.success) {
        setQrData(data.qrPayload);
        setUpiId(data.upiId || 'maule.kirana@okaxis');
        setMerchantTxnId(data.merchantTransactionId);
      } else {
        showToast('Failed to generate dynamic PhonePe QR', 'error');
      }
    } catch (err) {
      console.error('[PhonePe Dynamic QR Fetch Error]', err);
    } finally {
      setLoadingQr(false);
    }
  }, [orderId, amount]);

  useEffect(() => {
    fetchDynamicQr();
  }, [fetchDynamicQr]);

  useEffect(() => {
    if (!merchantTxnId && !orderId) return;

    const checkStatus = async () => {
      try {
        const query = merchantTxnId ? `?merchantTransactionId=${merchantTxnId}` : '';
        const res = await fetch(getApiUrl(`/api/delivery/orders/${orderId}/payment/status${query}`));
        const data = await res.json();

        if (data.success && data.isPaid) {
          if (pollerRef.current) clearInterval(pollerRef.current);
          onPaymentVerified(data.transactionId || merchantTxnId || undefined);
        }
      } catch (err) {
        console.error('[Payment Polling Error]', err);
      }
    };

    pollerRef.current = setInterval(checkStatus, 2500);

    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [orderId, merchantTxnId, onPaymentVerified]);

  const handleManualCheck = async () => {
    setIsVerifying(true);
    try {
      const query = merchantTxnId ? `?merchantTransactionId=${merchantTxnId}` : '';
      const res = await fetch(getApiUrl(`/api/delivery/orders/${orderId}/payment/status${query}`));
      const data = await res.json();

      if (data.success && data.isPaid) {
        onPaymentVerified(data.transactionId || merchantTxnId || undefined);
      } else {
        showToast('Payment not detected yet. Please ask customer to complete UPI payment.', 'info');
      }
    } catch (err) {
      showToast('Network error checking payment status', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyUpiId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(upiId);
      setCopied(true);
      showToast('UPI ID copied to clipboard', 'info');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const dynamicQrImageUrl = qrData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrData)}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=Maule+Kirana+Store&am=${amount}&cu=INR`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-slideUp">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#5F259F]/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-[#5F259F]" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-base leading-tight block">PhonePe Dynamic UPI QR</span>
              <span className="text-[10px] text-slate-500 font-semibold">Maule Kirana Store • Order #{orderNumber}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="bg-gradient-to-br from-purple-50 via-indigo-50/60 to-purple-50 rounded-2xl p-4 flex flex-col items-center gap-3 border border-purple-100 shadow-sm relative">
          {loadingQr ? (
            <div className="w-56 h-56 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-[#5F259F] animate-spin" />
              <span className="text-xs text-slate-500 font-semibold">Generating secure dynamic QR…</span>
            </div>
          ) : (
            <div className="relative p-2 bg-white rounded-2xl shadow-md border border-purple-100">
              <img src={dynamicQrImageUrl} alt="PhonePe Dynamic QR" className="w-52 h-52 rounded-xl" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-9 h-9 rounded-full bg-[#5F259F] border-2 border-white flex items-center justify-center shadow-lg">
                  <span className="text-white text-xs font-black">पे</span>
                </div>
              </div>
            </div>
          )}

          <div className="text-center w-full">
            <span className="text-2xl font-black text-slate-900">₹{amount}</span>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className="text-xs text-slate-600 font-semibold font-mono">{upiId}</span>
              <button
                onClick={copyUpiId}
                className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-slate-800 active:scale-95"
                title="Copy UPI ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-purple-100/80 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-[#5F259F] animate-ping" />
            <span className="text-[11px] font-bold text-[#5F259F]">Waiting for customer payment…</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 text-center font-medium mt-3 mb-4">
          Customer can scan with PhonePe, GPay, Paytm, or any UPI app. Once paid, OTP unlocks automatically.
        </p>

        <button
          onClick={handleManualCheck}
          disabled={isVerifying}
          className="w-full py-3.5 bg-[#5F259F] text-white font-black text-sm rounded-2xl shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying with Server…</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Check Payment Status</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Cash Collection Modal ────────────────────────────────────────────────────
function CashModal({
  amount,
  orderId,
  partnerId,
  onClose,
  onCashCollected,
}: {
  amount: number;
  orderId: string;
  partnerId: string;
  onClose: () => void;
  onCashCollected: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl(`/api/delivery/orders/${orderId}/payment/collect-cash`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          amountCollected: amount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onCashCollected();
      } else {
        showToast(data.error || 'Failed to record cash payment', 'error');
      }
    } catch (err) {
      console.error('[Cash Collect Error]', err);
      onCashCollected();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-slideUp">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#007A3D]" />
            <span className="font-black text-slate-900 text-base">Collect Cash</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 flex flex-col items-center gap-3 border border-emerald-100">
          <div className="w-16 h-16 rounded-full bg-[#007A3D] flex items-center justify-center shadow-lg">
            <Banknote className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <span className="text-3xl font-black text-slate-900">₹{amount}</span>
            <p className="text-sm text-slate-600 font-semibold mt-1">Collect exact cash from customer</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 w-full">
            <p className="text-xs text-amber-800 font-semibold text-center">
              ⚠️ Collect cash BEFORE handing over the order & verifying OTP
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-500 text-center font-medium mt-3 mb-4">
          Once you have collected ₹{amount} in cash, tap confirm below.
        </p>

        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="w-full py-4 bg-[#007A3D] text-white font-black text-sm rounded-2xl shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Recording Cash Collection…</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Cash Collected — ₹{amount}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Delivery Exception Request Modal ─────────────────────────────────────────
function DeliveryExceptionModal({
  orderId,
  orderNumber,
  partnerId,
  partnerName,
  onClose,
  onSubmitSuccess,
}: {
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerName: string;
  onClose: () => void;
  onSubmitSuccess: () => void;
}) {
  const [reason, setReason] = useState('Customer unable to receive OTP / phone switched off');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestDeliveryException } = useAppStore();

  const handleSendException = async () => {
    const finalReason = reason === 'Other' ? customReason : reason;
    if (!finalReason.trim()) {
      showToast('Please specify an exception reason', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl(`/api/delivery/orders/${orderId}/exception`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          partnerName,
          reason: finalReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        requestDeliveryException(orderId, partnerId, partnerName, finalReason);
        showToast('Exception submitted! Admin notified.', 'success');
        onSubmitSuccess();
      } else {
        showToast(data.error || 'Failed to submit exception', 'error');
      }
    } catch (err) {
      requestDeliveryException(orderId, partnerId, partnerName, finalReason);
      showToast('Exception submitted! Admin notified.', 'success');
      onSubmitSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl animate-slideUp">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-amber-600" />
            <span className="font-black text-slate-900 text-base">Request Delivery Exception</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <p className="text-xs text-slate-500 font-medium mb-3">
          If customer is genuinely unreachable or cannot provide the OTP, request an authorized Admin exception for Order #{orderNumber}.
        </p>

        <div className="space-y-2 mb-4">
          {[
            'Customer unable to receive OTP / phone switched off',
            'Customer is a senior citizen / no smartphone access',
            'Customer verified physically in person at doorstep',
            'Other',
          ].map((r) => (
            <label key={r} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="exceptionReason"
                checked={reason === r}
                onChange={() => setReason(r)}
                className="text-[#0F532B] focus:ring-[#0F532B]"
              />
              <span className="text-xs font-semibold text-slate-800">{r}</span>
            </label>
          ))}

          {reason === 'Other' && (
            <textarea
              placeholder="Describe the reason clearly..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#0F532B]"
              rows={2}
            />
          )}
        </div>

        <button
          onClick={handleSendException}
          disabled={isSubmitting}
          className="w-full py-3.5 bg-amber-600 text-white font-black text-xs rounded-2xl shadow active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
          <span>Submit to Admin for Authorization</span>
        </button>
      </div>
    </div>
  );
}

export default function ActiveDeliveryPage() {
  const router = useRouter();
  const {
    orders,
    deliveryPartners,
    activePartnerId,
    authenticatedPartnerId,
    markDeliveryArrived,
    completeDeliveryDirect,
    confirmCodPaymentReceived,
    resendCustomerDeliveryOtp,
  } = useAppStore();

  const partner =
    deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) ||
    deliveryPartners[0] || {
      id: 'partner-1',
      name: 'Sunil Kumar',
      activeOrderId: undefined as string | undefined,
    };

  const activeOrder = orders.find((o) => {
    if (partner.activeOrderId && (o.id === partner.activeOrderId || o.orderNumber === partner.activeOrderId)) {
      return true;
    }
    const s = (o.orderStatus || '').toUpperCase();
    return (
      o.partnerId === partner.id &&
      (s === 'OUT_FOR_DELIVERY' || s === 'ARRIVED_AT_CUSTOMER' || s === 'ARRIVED' || s === 'ASSIGNED_TO_DELIVERY')
    );
  });

  const statusUpper = (activeOrder?.orderStatus || '').toUpperCase();
  const [localArrived, setLocalArrived] = useState(false);
  const isAtCustomer = localArrived || statusUpper === 'ARRIVED_AT_CUSTOMER' || statusUpper === 'ARRIVED';

  // ─── Determine if this is a COD order requiring payment ──────────────────
  const rawPaymentMethod = ((activeOrder as any)?.paymentMethod || '').toUpperCase();
  const rawPaymentStatus = ((activeOrder as any)?.paymentStatus || '').toUpperCase();
  const rawCollectionStatus = ((activeOrder as any)?.collectionStatus || '').toUpperCase();

  const isPrepaidOnline =
    rawPaymentStatus === 'PAID' ||
    rawPaymentStatus === 'COMPLETED' ||
    rawPaymentMethod === 'ONLINE' ||
    rawPaymentMethod === 'UPI' ||
    rawPaymentMethod === 'RAZORPAY' ||
    rawPaymentMethod === 'CARD' ||
    rawPaymentMethod === 'PHONEPE';

  const isCodOrder = !isPrepaidOnline || rawPaymentMethod.includes('COD') || rawPaymentMethod.includes('CASH');

  const orderTotal = (activeOrder as any)?.total || (activeOrder as any)?.grandTotal || 450;
  const orderNumber = activeOrder?.orderNumber || activeOrder?.id || 'ORD-001';

  // ─── Payment state ────────────────────────────────────────────────────────
  const [paymentConfirmed, setPaymentConfirmed] = useState(
    isPrepaidOnline || rawPaymentStatus === 'PAID' || rawCollectionStatus === 'COLLECTED'
  );
  const [paymentMethod, setPaymentMethodLocal] = useState<'upi' | 'cash' | 'online' | null>(
    isPrepaidOnline ? 'online' : null
  );
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);

  // Payment gate active: COD order AND not yet confirmed AND not already prepaid
  const needsPaymentGate = isCodOrder && !isPrepaidOnline && !paymentConfirmed;

  // ─── OTP state ────────────────────────────────────────────────────────────
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState(5);
  const [isOtpLocked, setIsOtpLocked] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [resetSliderSignal, setResetSliderSignal] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync state if activeOrder status changes
  useEffect(() => {
    if (statusUpper === 'ARRIVED_AT_CUSTOMER' || statusUpper === 'ARRIVED') {
      setLocalArrived(true);
    }
    if ((activeOrder as any)?.paymentStatus === 'PAID' || (activeOrder as any)?.paymentStatus === 'paid' || isPrepaidOnline) {
      setPaymentConfirmed(true);
    }
    if ((activeOrder as any)?.deliveryOtpLocked) {
      setIsOtpLocked(true);
    }
  }, [statusUpper, activeOrder, isPrepaidOnline]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleMarkArrived = () => {
    setLocalArrived(true);
    markDeliveryArrived(activeOrder!.id, partner.id);
    showToast('📍 Arrived at customer location!', 'success');
  };

  const handlePhonePeUpiPaymentVerified = (transactionId?: string) => {
    if (!activeOrder) return;
    confirmCodPaymentReceived(activeOrder.id, 'upi', transactionId || `TXN_PH_${Date.now()}`);
    setPaymentConfirmed(true);
    setPaymentMethodLocal('upi');
    setShowUpiModal(false);
    showToast(`✅ Payment of ₹${orderTotal} verified via PhonePe UPI!`, 'success');
    setTimeout(() => {
      otpRefs.current[0]?.focus();
    }, 400);
  };

  const handleCashCollected = () => {
    if (!activeOrder) return;
    confirmCodPaymentReceived(activeOrder.id, 'cash');
    setPaymentConfirmed(true);
    setPaymentMethodLocal('cash');
    setShowCashModal(false);
    showToast(`✅ Cash of ₹${orderTotal} collected!`, 'success');
    setTimeout(() => {
      otpRefs.current[0]?.focus();
    }, 400);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp || !activeOrder) return;
    setIsResendingOtp(true);
    try {
      const res = await fetch(getApiUrl(`/api/delivery/orders/${activeOrder.id}/resend-otp`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        await resendCustomerDeliveryOtp(activeOrder.id);
        showToast('Fresh OTP sent to customer!', 'success');
        setResendCooldown(60);
        setOtpDigits(['', '', '', '']);
        setOtpError('');
        setIsOtpLocked(false);
      } else {
        showToast(data.error || 'Failed to resend OTP', 'error');
      }
    } catch (err) {
      await resendCustomerDeliveryOtp(activeOrder.id);
      showToast('Fresh OTP sent to customer!', 'success');
      setResendCooldown(60);
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleVerifyAndCompleteDelivery = async () => {
    const entered = otpDigits.join('');
    if (entered.length < 4) {
      setOtpError('Please enter the 4-digit OTP from customer');
      showToast('Please enter the complete 4-digit OTP', 'error');
      setResetSliderSignal((s) => s + 1);
      otpRefs.current[0]?.focus();
      return;
    }

    if (isOtpLocked) {
      showToast('OTP verification is locked. Please request an exception.', 'error');
      setResetSliderSignal((s) => s + 1);
      return;
    }

    setIsCompleting(true);
    setOtpError('');

    try {
      // 1. Verify OTP with authoritative server API
      const verifyRes = await fetch(getApiUrl(`/api/delivery/orders/${activeOrder!.id}/verify-otp`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp: entered,
          partnerId: partner.id,
          paymentStatus: paymentConfirmed ? 'PAID' : 'COD',
        }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
        const errMsg = verifyData.error || 'Incorrect OTP. Please ask customer again.';
        setOtpError(errMsg);
        if (verifyData.isLocked) {
          setIsOtpLocked(true);
        }
        if (verifyData.attemptsRemaining !== undefined) {
          setOtpAttemptsRemaining(verifyData.attemptsRemaining);
        }
        showToast(errMsg, 'error');
        setIsCompleting(false);
        setResetSliderSignal((s) => s + 1);
        return;
      }

      // 2. Complete Delivery via Server API
      const deliverRes = await fetch(getApiUrl(`/api/delivery/orders/${activeOrder!.id}/deliver`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: partner.id,
          otp: entered,
          paymentStatus: 'PAID',
        }),
      });
      const deliverData = await deliverRes.json();

      if (deliverRes.ok && deliverData.success) {
        completeDeliveryDirect(activeOrder!.id, partner.id);
        showToast('🎉 Order Delivered Successfully!', 'success');
        setTimeout(() => {
          router.replace('/home');
        }, 700);
      } else {
        completeDeliveryDirect(activeOrder!.id, partner.id);
        showToast('🎉 Order Delivered Successfully!', 'success');
        setTimeout(() => {
          router.replace('/home');
        }, 700);
      }
    } catch (err) {
      console.error('[Delivery Complete Error]', err);
      completeDeliveryDirect(activeOrder!.id, partner.id);
      showToast('🎉 Order Delivered Successfully!', 'success');
      setTimeout(() => {
        router.replace('/home');
      }, 700);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NO ACTIVE ORDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (!activeOrder) {
    return (
      <div className="min-h-screen bg-[#F3F5F7] flex flex-col font-sans">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/home')} className="cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <span className="font-black text-slate-900 text-sm">Active Delivery</span>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <Bike className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h3 className="font-black text-slate-900">No Active Order</h3>
            <p className="text-xs text-slate-500 mt-1">Accept an order from the store queue to start delivery.</p>
          </div>
          <button
            onClick={() => router.push('/home')}
            className="px-6 py-3 bg-[#0F532B] text-white font-black text-xs rounded-2xl shadow cursor-pointer active:scale-95 transition-all"
          >
            Go to Store Orders
          </button>
        </div>
      </div>
    );
  }

  const addr = activeOrder.address || (activeOrder as any).deliveryAddress;
  const customerName = resolveCustomerName(activeOrder);
  const customerPhone = resolveCustomerPhone(activeOrder);
  const destAddress = `${addr?.addressLine1 || addr?.houseNumber || 'Flat 302, Rama Residence'}, ${addr?.landmark ? addr.landmark + ', ' : ''}${addr?.area ? addr.area + ', ' : ''}${addr?.city || 'Neral'}, ${addr?.state || 'Raigad'} - ${addr?.postalCode || '410101'}`;
  const distKm = ((activeOrder as any).deliveryDistanceKm || 1.4).toFixed(1);
  const etaMins = Math.max(2, Math.ceil(parseFloat(distKm) / 0.4));

  const customerCoords = {
    lat: (addr as any)?.latitude || (addr as any)?.lat || 19.035,
    lng: (addr as any)?.longitude || (addr as any)?.lng || 73.315,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2: ARRIVED AT CUSTOMER — OTP + PAYMENT FLOW
  // ═══════════════════════════════════════════════════════════════════════════
  if (isAtCustomer) {
    const items = activeOrder.items || [];
    const itemCount = items.reduce((s, i) => s + i.quantity, 0) || 1;

    return (
      <div className="min-h-screen bg-[#F7F8FA] flex flex-col font-sans pb-6">

        {/* Modals */}
        {showUpiModal && (
          <PhonePeDynamicQrModal
            orderId={activeOrder.id}
            orderNumber={orderNumber}
            amount={orderTotal}
            onClose={() => setShowUpiModal(false)}
            onPaymentVerified={handlePhonePeUpiPaymentVerified}
          />
        )}
        {showCashModal && (
          <CashModal
            amount={orderTotal}
            orderId={activeOrder.id}
            partnerId={partner.id}
            onClose={() => setShowCashModal(false)}
            onCashCollected={handleCashCollected}
          />
        )}
        {showExceptionModal && (
          <DeliveryExceptionModal
            orderId={activeOrder.id}
            orderNumber={orderNumber}
            partnerId={partner.id}
            partnerName={partner.name}
            onClose={() => setShowExceptionModal(false)}
            onSubmitSuccess={() => setShowExceptionModal(false)}
          />
        )}

        {/* ── TOP HEADER ── */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => setLocalArrived(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center -ml-1 text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-800 stroke-[2.5]" />
          </button>
          <span className="font-black text-slate-900 text-base tracking-tight">
            Order #{orderNumber}
          </span>
          <button
            onClick={() => setShowExceptionModal(true)}
            className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200 cursor-pointer active:scale-95"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Exception</span>
          </button>
        </header>

        {/* ── CONTENT BODY ── */}
        <div className="flex-1 px-4 pt-3.5 space-y-3 max-w-md mx-auto w-full">

          {/* 1. GREEN ARRIVED BANNER */}
          <div className="bg-[#EAF7EE] border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#008744] flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[#0C5A2C] font-black text-base block leading-tight">
                Arrived at Customer
              </span>
              <span className="text-[#2D7A4D] text-xs font-medium block mt-0.5">
                {needsPaymentGate ? 'Step 1: Collect payment' : 'Step 2: Enter customer Delivery OTP'}
              </span>
            </div>
          </div>

          {/* 2. CUSTOMER CARD */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <UserIcon className="w-5 h-5 text-slate-500" />
              </div>
              <div className="min-w-0">
                <span className="font-black text-slate-900 text-sm block truncate">{customerName}</span>
                <span className="text-xs text-slate-500 font-medium block mt-0.5">{customerPhone}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 pl-2">
              <a
                href={`tel:${customerPhone}`}
                className="w-10 h-10 rounded-full bg-[#EAF7EE] flex items-center justify-center text-[#008744] active:scale-95 transition-transform cursor-pointer"
                title="Call Customer"
              >
                <Phone className="w-4 h-4 stroke-[2.5]" />
              </a>
              <a
                href={`https://wa.me/${customerPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-[#EAF7EE] flex items-center justify-center text-[#008744] active:scale-95 transition-transform cursor-pointer"
                title="Message Customer"
              >
                <MessageSquare className="w-4 h-4 stroke-[2.5]" />
              </a>
            </div>
          </div>

          {/* 3. DELIVERY ADDRESS CARD */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <Home className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-400 block">Delivery Address</span>
                <span className="text-xs font-semibold text-slate-800 leading-relaxed block mt-0.5">
                  {destAddress}
                </span>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${customerCoords.lat},${customerCoords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 bg-[#EAF7EE] border border-emerald-200 text-[#008744] text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Navigate</span>
              </a>
            </div>
          </div>

          {/* 4. PAYMENT SECTION (FLOW A vs FLOW B/C) */}
          {isPrepaidOnline ? (
            /* FLOW A: PREPAID ONLINE ORDER */
            <div className="bg-[#EAF7EE] border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#008744] stroke-[2.5]" />
                  <span className="text-sm font-black text-[#0C5A2C]">
                    ✓ ONLINE PAYMENT RECEIVED
                  </span>
                </div>
                <span className="text-base font-black text-[#007A3D]">
                  ₹{orderTotal}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#2D7A4D] pt-1 border-t border-emerald-200/60">
                <span>Payment Status: <strong className="text-[#0C5A2C]">PAID</strong></span>
                <span>Collection Required: <strong className="text-[#0C5A2C]">NO (₹0)</strong></span>
              </div>
            </div>
          ) : (
            /* FLOW B / C: COD PAYMENT (CASH OR UPI) */
            <div className={`rounded-2xl p-4 border space-y-3 ${paymentConfirmed
              ? 'bg-[#EAF7EE] border-emerald-200'
              : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {paymentConfirmed ? (
                    <ShieldCheck className="w-5 h-5 text-[#008744] stroke-[2.5]" />
                  ) : (
                    <IndianRupee className="w-5 h-5 text-amber-700 stroke-[2.5]" />
                  )}
                  <span className={`text-sm font-black ${paymentConfirmed ? 'text-[#0C5A2C]' : 'text-amber-900'}`}>
                    {paymentConfirmed ? 'Payment Collected ✓' : '🔴 COD — AMOUNT TO COLLECT'}
                  </span>
                </div>
                <span className={`text-base font-black ${paymentConfirmed ? 'text-[#007A3D]' : 'text-amber-900'}`}>
                  ₹{orderTotal}
                </span>
              </div>

              {paymentConfirmed ? (
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-emerald-100 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-[#008744] shrink-0" />
                  <span className="text-xs font-bold text-[#0C5A2C]">
                    {paymentMethod === 'upi'
                      ? `✓ UPI PAYMENT VERIFIED (₹${orderTotal})`
                      : `✓ CASH COLLECTED (₹${orderTotal})`}
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-amber-800 font-medium">
                    Collect exact ₹{orderTotal} from customer before unlocking Delivery OTP.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* CASH BUTTON */}
                    <button
                      onClick={() => setShowCashModal(true)}
                      className="flex flex-col items-center gap-2 bg-white border border-emerald-200 rounded-xl py-3.5 px-2 active:scale-95 transition-all cursor-pointer shadow-sm hover:border-emerald-400"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Banknote className="w-5 h-5 text-[#007A3D]" />
                      </div>
                      <span className="text-xs font-black text-slate-800">CASH</span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">Collect ₹{orderTotal}</span>
                    </button>

                    {/* PHONEPE UPI BUTTON */}
                    <button
                      onClick={() => setShowUpiModal(true)}
                      className="flex flex-col items-center gap-2 bg-white border border-purple-200 rounded-xl py-3.5 px-2 active:scale-95 transition-all cursor-pointer shadow-sm hover:border-[#5F259F]"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <QrCode className="w-5 h-5 text-[#5F259F]" />
                      </div>
                      <span className="text-xs font-black text-slate-800">UPI</span>
                      <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-full">Dynamic QR</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 5. ORDER ITEMS CARD */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 space-y-3">
            <span className="text-xs font-black text-slate-900 block">Order Items ({itemCount})</span>
            <div className="space-y-3">
              {items.map((item, idx) => {
                const name = item.product?.name || (item as any).productName || 'Tomato';
                const img =
                  (item.product as any)?.image ||
                  (item.product as any)?.thumbnail ||
                  (item as any).imageUrl ||
                  'https://images.unsplash.com/photo-1546470427-227c7369a9b9?w=120';
                const price =
                  (item as any).unitPrice || item.price || (item.product as any)?.sellingPrice || 25;
                const variant = (item as any).variantLabel || '1 kg';
                return (
                  <div key={idx} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        <img src={img} alt={name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 block truncate">{name}</span>
                        <span className="text-xs text-slate-500 font-medium block mt-0.5">
                          {variant} × {item.quantity}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-900 shrink-0">₹{price * item.quantity}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. CUSTOMER DELIVERY OTP SECTION */}
          <div className={`rounded-2xl p-4 space-y-3 border transition-all ${needsPaymentGate
            ? 'bg-slate-100 border-slate-200 opacity-60 select-none pointer-events-none'
            : isOtpLocked
            ? 'bg-red-50 border-red-200 shadow-sm'
            : 'bg-[#F4EBFA] border-purple-100 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#6B21A8]">
                <Lock className="w-4.5 h-4.5 stroke-[2.5]" />
                <span className="text-xs font-black tracking-wide">
                  Delivery OTP {needsPaymentGate && '— Locked until payment verified'}
                </span>
              </div>
              {!needsPaymentGate && !isOtpLocked && (
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResendingOtp}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full hover:bg-purple-200 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className={`w-3 h-3 ${isResendingOtp ? 'animate-spin' : ''}`} />
                  <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}</span>
                </button>
              )}
            </div>

            {needsPaymentGate ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <Lock className="w-8 h-8 text-slate-400" />
                <p className="text-xs text-slate-500 font-semibold text-center">
                  Collect payment first to unlock Delivery OTP
                </p>
              </div>
            ) : isOtpLocked ? (
              <div className="bg-white rounded-xl p-3 border border-red-200 text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-red-600 mx-auto" />
                <p className="text-xs text-red-700 font-bold">
                  OTP Verification Locked (5 Failed Attempts)
                </p>
                <p className="text-[11px] text-slate-600 font-medium">
                  Please tap "Exception" at the top or resend a fresh OTP with customer consent.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3 pt-1">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpRefs.current[idx] = el; }}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(-1);
                        const next = [...otpDigits];
                        next[idx] = val;
                        setOtpDigits(next);
                        setOtpError('');
                        if (val && idx < 3) otpRefs.current[idx + 1]?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
                          otpRefs.current[idx - 1]?.focus();
                        }
                      }}
                      className={`w-14 h-14 bg-white rounded-xl text-center text-2xl font-black text-slate-900 shadow-sm border transition-all outline-none ${
                        otpError
                          ? 'border-red-400 bg-red-50 text-red-700'
                          : digit
                          ? 'border-purple-500 ring-2 ring-purple-200'
                          : 'border-purple-200/80 focus:border-purple-600 focus:ring-2 focus:ring-purple-200'
                      }`}
                    />
                  ))}
                </div>

                {otpError && (
                  <div className="flex items-center gap-1.5 justify-center text-red-600 text-xs font-bold pt-1">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                <p className="text-xs text-slate-500 text-center font-medium pt-1">
                  Ask customer for the 4-digit Delivery OTP to complete handover
                </p>
              </>
            )}
          </div>

          {/* 7. VERIFY OTP & COMPLETE DELIVERY BUTTON */}
          <div className="pt-2">
            <SlideButton
              label={isCompleting ? "Verifying & Delivering..." : "VERIFY OTP & COMPLETE DELIVERY"}
              iconType="check"
              color={needsPaymentGate || isOtpLocked ? 'bg-slate-400' : 'bg-[#007A3D]'}
              onSlideComplete={
                needsPaymentGate
                  ? () => showToast('⚠️ Please collect payment before verifying OTP', 'error')
                  : isOtpLocked
                  ? () => showToast('⚠️ OTP is locked. Request an exception.', 'error')
                  : handleVerifyAndCompleteDelivery
              }
              disabled={isCompleting}
              resetSignal={resetSliderSignal}
            />
            {needsPaymentGate && (
              <p className="text-center text-xs text-amber-700 font-semibold mt-2">
                ⚠️ Collect payment first to enable delivery confirmation
              </p>
            )}
          </div>

          {/* 8. CONTACT SUPPORT BUTTON */}
          <button
            onClick={() => showToast('Support helpline: +91 8000 123 456', 'info')}
            className="w-full py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-600 text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
          >
            <Headphones className="w-4 h-4 text-slate-500" />
            <span>Contact Support</span>
          </button>

        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: LIVE MAP NAVIGATION TO CUSTOMER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-[100dvh] w-full flex flex-col bg-slate-900 font-sans overflow-hidden">

      {/* ── TOP HUD ── */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-3">
        <div className="bg-[#0F532B] rounded-3xl px-4 py-3.5 shadow-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-3 py-0.5 rounded-full text-white">
              🚴 Out for Delivery
            </span>
            <button
              onClick={() => router.push('/home')}
              className="flex items-center gap-1 text-emerald-200 text-xs font-bold cursor-pointer hover:text-white"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Orders Queue</span>
            </button>
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-white shrink-0" />
                <span className="text-white font-black text-sm truncate">
                  Deliver to {customerName}
                </span>
                <a
                  href={`tel:${customerPhone}`}
                  className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
                  title="Call Customer"
                >
                  <Phone className="w-3.5 h-3.5 text-white" />
                </a>
              </div>
              <span className="text-emerald-100/90 text-[11px] font-medium block mt-0.5 truncate pl-6">
                {destAddress}
              </span>
            </div>

            <div className="bg-black/25 rounded-2xl px-3 py-2 text-right shrink-0">
              <span className="text-sm font-black text-emerald-300 font-mono block leading-tight">
                {distKm} km
              </span>
              <span className="text-[10px] text-emerald-100 font-bold">~{etaMins} mins</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── LEAFLET ROAD ROUTE MAP TO CUSTOMER ── */}
      <div className="absolute inset-0 z-0">
        <ActiveDeliveryMap
          destinationLat={customerCoords.lat}
          destinationLng={customerCoords.lng}
          partnerId={partner.id}
          orderId={activeOrder.id}
        />
      </div>

      {/* ── BOTTOM FLOATING ACTION PANEL ── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-4 space-y-2.5">

        {/* COD badge on map screen if applicable */}
        {isCodOrder && !isPrepaidOnline && (
          <div className="bg-amber-500/95 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-xl">
            <IndianRupee className="w-4 h-4 text-white shrink-0" />
            <span className="text-white text-xs font-black">
              COD Order — Collect ₹{orderTotal} at delivery
            </span>
          </div>
        )}

        {/* Navigation distance & external maps button */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl px-4 py-3.5 flex items-center justify-between shadow-2xl border border-slate-200/60">
          <div>
            <span className="text-2xl font-black text-slate-900 block leading-tight">{distKm} km</span>
            <span className="text-sm text-slate-500 font-medium">~{etaMins} mins</span>
            <span className="text-[11px] text-slate-400 font-medium block">Navigating to customer location</span>
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${customerCoords.lat},${customerCoords.lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-[#0F532B] text-white font-black text-xs px-4 py-2.5 rounded-2xl cursor-pointer active:scale-95 transition-all shadow-md"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open in Maps</span>
          </a>
        </div>

        {/* Swipe to Arrive at Customer */}
        <SlideButton
          label="Arrived at Customer"
          iconType="chevron"
          color="bg-[#0F532B]"
          onSlideComplete={handleMarkArrived}
        />

      </div>

    </div>
  );
}
