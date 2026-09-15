'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import DeliveryShell from '../../components/DeliveryShell';
import { 
  Phone, 
  ShieldCheck, 
  LogOut, 
  Star, 
  Power,
  ChevronRight,
  Bike,
  MapPin,
  Award,
  Clock,
  IndianRupee,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Send,
  X,
  Receipt
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function DeliveryPartnerProfilePage() {
  const router = useRouter();
  const { 
    deliveryPartners, 
    orders,
    codCollections,
    activePartnerId, 
    authenticatedPartnerId, 
    togglePartnerStatus, 
    logoutDeliveryPartner,
    requestCashVerification
  } = useAppStore();

  const partner = deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) || deliveryPartners[0] || {
    id: 'partner-1',
    name: 'Sunil Kumar',
    phone: '+91 8698893348',
    partnerCode: 'DP001',
    vehicleType: 'EV Scooter',
    vehicleNumber: 'MH 14 EV 2026',
    currentStatus: 'online',
    rating: 4.9,
    completedDeliveries: 18,
    cashInHand: 0,
    cashSettlementStatus: 'SETTLED',
  };

  const isOnline = partner.currentStatus === 'online' || partner.currentStatus === 'busy';
  const cashInHand = Number(partner.cashInHand || 0);

  // Get COD orders collected by this partner
  const partnerCodOrders = codCollections.filter((c) => c.partnerId === partner.id);
  const unverifiedCodOrders = partnerCodOrders.filter((c) => c.status === 'COLLECTED');

  // Modals state
  const [showCashLockModal, setShowCashLockModal] = useState(false);
  const [showHandoverListModal, setShowHandoverListModal] = useState(false);
  const [isRequestingVerification, setIsRequestingVerification] = useState(false);

  const handleToggle = () => {
    if (isOnline && cashInHand > 0) {
      showToast(`Note: You hold ₹${cashInHand} pending cash handover to Admin.`, 'info');
    }
    togglePartnerStatus(partner.id);
    const next = isOnline ? 'Offline' : 'Online';
    showToast(`Status changed to ${next}`, 'success');
  };

  const handleLogoutAttempt = () => {
    const res = logoutDeliveryPartner(partner.id);
    if (!res.success) {
      setShowCashLockModal(true);
      return;
    }
    showToast('Signed out successfully', 'info');
    router.replace('/login');
  };

  const handleSendVerificationRequest = () => {
    setIsRequestingVerification(true);
    const res = requestCashVerification(partner.id);
    setIsRequestingVerification(false);
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const initials = partner.name ? partner.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'SK';

  return (
    <DeliveryShell title="Profile">
      <div className="space-y-4 animate-in fade-in duration-200 pb-6">

        {/* ── PROFILE HERO CARD ── */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-5 flex items-center gap-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0F532B] to-[#0A381D] text-white flex items-center justify-center text-xl font-black shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900 truncate">{partner.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span className="text-[11px] text-slate-500 font-medium">{partner.phone}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-emerald-50 text-[#0F532B] text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Verified Rider
              </span>
              <span className="text-amber-600 font-black text-xs flex items-center gap-0.5">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                {partner.rating || '4.9'}
              </span>
              <span className="text-slate-400 text-[10px] font-mono font-bold">{partner.partnerCode || 'DP001'}</span>
            </div>
          </div>
        </div>

        {/* ── 💵 CASH COLLECTION & HANDOVER SUMMARY CARD (Core Business Requirement) ── */}
        <div className={`rounded-3xl p-5 border transition-all ${
          cashInHand > 0 
            ? 'bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-300 shadow-sm' 
            : 'bg-white border-slate-200/70 shadow-xs'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                cashInHand > 0 ? 'bg-amber-500 text-white shadow-xs' : 'bg-emerald-100 text-[#0F532B]'
              }`}>
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                  Cash in Hand (COD)
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    ₹{cashInHand}
                  </span>
                  {cashInHand > 0 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md border border-amber-200">
                      Pending Handover
                    </span>
                  )}
                </div>
              </div>
            </div>

            {cashInHand > 0 ? (
              <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase flex items-center gap-1 border border-rose-200 shrink-0">
                <Lock className="w-3 h-3 text-rose-600" /> Logout Locked
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase flex items-center gap-1 border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Settled &amp; Clear
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            {cashInHand > 0 ? (
              <span>
                You have collected <strong>₹{cashInHand}</strong> in Cash on Delivery orders. You must hand over this cash to the DarkStore Admin for verification before you can sign out.
              </span>
            ) : (
              <span>All cash collected has been verified by the DarkStore Admin. No pending deposits.</span>
            )}
          </p>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/70">
            {cashInHand > 0 ? (
              <button
                type="button"
                onClick={handleSendVerificationRequest}
                disabled={isRequestingVerification}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isRequestingVerification ? 'Notifying Admin...' : 'Request Cash Verification'}</span>
              </button>
            ) : null}

            {unverifiedCodOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHandoverListModal(true)}
                className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-slate-500" />
                <span>View Orders ({unverifiedCodOrders.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-[#0F532B]/10 flex items-center justify-center">
              <Bike className="w-5 h-5 text-[#0F532B]" />
            </div>
            <div>
              <span className="text-lg font-black text-slate-900 block">{partner.completedDeliveries || 0}</span>
              <span className="text-[10px] text-slate-500 font-medium">Total Completed Trips</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <span className="text-lg font-black text-slate-900 flex items-center gap-0.5">
                {partner.rating || '4.9'}
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 ml-0.5" />
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Customer Rating</span>
            </div>
          </div>
        </div>

        {/* ── DUTY STATUS CARD ── */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs font-black text-slate-900 block">Duty Shift Status</span>
            <span className="text-[11px] text-slate-500 font-medium">
              {isOnline ? 'Active — Accepting deliveries' : 'Inactive — Not accepting deliveries'}
            </span>
          </div>
          <button
            onClick={handleToggle}
            className={`py-2 px-4 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              isOnline
                ? 'bg-[#0F532B] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 border border-slate-300'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {isOnline ? 'Online' : 'Offline'}
          </button>
        </div>

        {/* ── VEHICLE DETAILS ── */}
        <div className="bg-white rounded-2xl border border-slate-200/70 divide-y divide-slate-100 shadow-2xs">
          <div className="px-4 py-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vehicle & Assignment</span>
          </div>
          {[
            { label: 'Vehicle Type', value: partner.vehicleType || 'EV Electric Scooter' },
            { label: 'Number Plate', value: partner.vehicleNumber || 'MH 14 EV 2026', mono: true },
            { label: 'Assigned DarkStore Hub', value: 'PocketKirana DarkStore (Neral)' },
            { label: 'Settlement Status', value: cashInHand > 0 ? `₹${cashInHand} Pending Verification` : 'All Settled', highlight: cashInHand > 0 },
          ].map((item) => (
            <div key={item.label} className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">{item.label}</span>
              <span className={`text-xs font-bold ${
                item.highlight ? 'text-amber-700' : 'text-slate-900'
              } ${item.mono ? 'font-mono' : ''}`}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* ── SIGN OUT BUTTON (WITH CASH VALIDATION LOCK) ── */}
        <button
          onClick={handleLogoutAttempt}
          className="w-full py-4 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Shift</span>
        </button>

        <div className="text-center text-[10px] text-slate-400 font-mono">
          PocketKirana Delivery App • DarkStore Operations
        </div>

      </div>

      {/* ── MODAL: CASH LOCKOUT NOTIFICATION (RIDER CANNOT LOGOUT) ── */}
      {showCashLockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 border border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Cash Handover Required
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You cannot sign out while holding unverified Cash on Delivery funds.
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center space-y-1">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
                Cash in Hand to Deposit
              </span>
              <span className="text-3xl font-black text-rose-900 font-mono block">
                ₹{cashInHand}
              </span>
              <span className="text-[10px] text-rose-600 font-medium block">
                Hand over this cash to DarkStore Manager for verification
              </span>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleSendVerificationRequest();
                  setShowCashLockModal(false);
                }}
                className="w-full py-3.5 bg-[#0F532B] hover:bg-[#0A381D] text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Notify Admin for Verification</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCashLockModal(false)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                I Will Hand Over Cash Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: UNVERIFIED COD ORDERS LIST ── */}
      {showHandoverListModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#0F532B]" />
                <h3 className="font-black text-slate-900 text-base">COD Collections Breakdown</h3>
              </div>
              <button
                onClick={() => setShowHandoverListModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {unverifiedCodOrders.map((rec) => (
                <div key={rec.id} className="pt-2 pb-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block font-mono">#{rec.orderNumber}</span>
                    <span className="text-[10px] text-slate-400">
                      {rec.collectedAt ? new Date(rec.collectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Collected'} • {rec.method}
                    </span>
                  </div>
                  <span className="font-mono font-black text-sm text-slate-900">
                    ₹{rec.collectedAmount}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Total Cash to Hand Over:</span>
              <span className="text-base font-black text-amber-800 font-mono">₹{cashInHand}</span>
            </div>

            <button
              onClick={() => setShowHandoverListModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </DeliveryShell>
  );
}

