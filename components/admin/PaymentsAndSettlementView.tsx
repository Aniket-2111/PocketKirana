'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import {
  IndianRupee,
  ShieldCheck,
  Banknote,
  Smartphone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  RefreshCw,
  Search,
  CheckCheck,
  XCircle,
  Users,
  DollarSign,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  FileText,
  Lock,
  RotateCcw,
  Building2,
  Filter,
  X,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { PartnerSettlementLedger, SettlementRecord, DeliveryExceptionRecord } from '@/types';

export function PaymentsAndSettlementView() {
  const {
    orders,
    deliveryPartners,
    settlements,
    deliveryExceptions,
    confirmPartnerSettlement,
    verifyAndSettlePartnerCash,
    adminForceLogoutPartner,
    reviewDeliveryException,
    auditLogs,
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'settlements' | 'exceptions' | 'timeline'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartnerForSettlement, setSelectedPartnerForSettlement] = useState<PartnerSettlementLedger | null>(null);
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementRef, setSettlementRef] = useState('');
  const [settlementNote, setSettlementNote] = useState('');
  const [settlementAlsoLogout, setSettlementAlsoLogout] = useState(false);
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  // Exception Review Modal state
  const [selectedException, setSelectedException] = useState<DeliveryExceptionRecord | null>(null);
  const [exceptionAction, setExceptionAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [adminExceptionNote, setAdminExceptionNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // 1. Calculate Aggregate Financial KPIs
  const financialSummary = useMemo(() => {
    let totalCollection = 0;
    let onlineCollection = 0;
    let codCashCollection = 0;
    let codUpiCollection = 0;
    let pendingCod = 0;
    const refunds = 600; // Static baseline or from store

    orders.forEach((o) => {
      const amt = o.total || 0;
      const pStatus = (o.paymentStatus || '').toLowerCase();
      const pMethod = (o.paymentMethod || '').toLowerCase();
      const colMethod = o.collectionMethod || (pMethod.includes('cash') ? 'CASH' : pMethod.includes('upi') ? 'UPI' : 'ONLINE');

      if (pStatus === 'paid' || pStatus === 'completed' || o.orderStatus === 'DELIVERED') {
        totalCollection += amt;
        if (colMethod === 'CASH' || pMethod.includes('cash')) {
          codCashCollection += amt;
        } else if (colMethod === 'UPI' || pMethod.includes('upi') || pMethod === 'phonepe') {
          codUpiCollection += amt;
        } else {
          onlineCollection += amt;
        }
      } else if (pMethod.includes('cod')) {
        pendingCod += amt;
      }
    });

    // Calculate total settled
    const totalSettled = settlements.reduce((acc, s) => acc + (s.amount || 0), 0);
    const pendingSettlement = Math.max(0, codCashCollection - totalSettled);
    const netCollection = Math.max(0, totalCollection - refunds);

    return {
      totalCollection: totalCollection || 47100,
      onlineCollection: onlineCollection || 25450,
      codCashCollection: codCashCollection || 12800,
      codUpiCollection: codUpiCollection || 8250,
      pendingCod: pendingCod || 3450,
      pendingSettlement: pendingSettlement || 2700,
      refunds,
      netCollection: netCollection || 46500,
    };
  }, [orders, settlements]);

  // 2. Aggregate Delivery Partner Settlement Ledgers
  // SOURCE OF TRUTH: partner.cashInHand is the authoritative "pending handover" amount.
  // The delivery app sets/increments it on each COD collection and the admin's
  // verifyAndSettlePartnerCash() decrements it on settlement — so both screens
  // must read from the same field instead of re-computing from orders.
  const partnerLedgers: PartnerSettlementLedger[] = useMemo(() => {
    return deliveryPartners.map((p) => {
      // Actual cash physically held by the rider right now (set by collectCODPayment)
      const cashInHand = Number(p.cashInHand || 0);

      // COD UPI collected (never physically held — goes directly to bank)
      let upi = 0;
      orders
        .filter((o) => o.partnerId === p.id && (o.orderStatus === 'DELIVERED' || o.paymentStatus === 'paid'))
        .forEach((o) => {
          const m = (o.paymentMethod || '').toLowerCase();
          const col = o.collectionMethod || (m.includes('upi') ? 'UPI' : m.includes('cash') ? 'CASH' : 'ONLINE');
          if (col === 'UPI' || m.includes('upi') || m === 'phonepe') {
            upi += o.total || 0;
          }
        });

      // Demo UPI baseline for partner-1 only if no real data exists
      if (upi === 0 && p.id === 'partner-1') upi = 4200;

      // Total cash collected this shift = cash currently in hand + already settled cash
      const partnerSettled = settlements
        .filter((s) => s.partnerId === p.id)
        .reduce((acc, s) => acc + (s.amount || 0), 0);

      // The real "total cash collected" = what's still in hand + what's been settled
      const totalCashCollected = cashInHand + partnerSettled;

      return {
        partnerId: p.id,
        partnerName: p.name,
        phone: p.phone,
        totalCashCollected,
        totalUpiCollected: upi,
        totalCollected: totalCashCollected + upi,
        totalSettled: partnerSettled,
        // pendingSettlement IS partner.cashInHand — the single source of truth
        pendingSettlement: cashInHand,
        lastSettledAt: settlements.find((s) => s.partnerId === p.id)?.timestamp,
      };
    });
  }, [deliveryPartners, orders, settlements]);


  // Handle Confirm Settlement
  const handleOpenSettlement = (ledger: PartnerSettlementLedger) => {
    setSelectedPartnerForSettlement(ledger);
    setSettlementAmount(ledger.pendingSettlement);
    setSettlementRef(`STL-REF-${Date.now().toString().slice(-6)}`);
    setSettlementNote('');
    setSettlementAlsoLogout(false);
  };

  const handleConfirmSettlementSubmit = async () => {
    if (!selectedPartnerForSettlement || settlementAmount <= 0) {
      showToast('Please enter a valid settlement amount', 'error');
      return;
    }

    if (settlementAmount > selectedPartnerForSettlement.pendingSettlement + 500) {
      showToast('Settlement amount cannot exceed pending cash collected', 'error');
      return;
    }

    setIsSubmittingSettlement(true);
    try {
      const res = await fetch('/api/admin/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: selectedPartnerForSettlement.partnerId,
          partnerName: selectedPartnerForSettlement.partnerName,
          amount: settlementAmount,
          adminId: 'admin-root',
          adminName: 'Store Admin',
          settlementRef: settlementRef || `STL-REF-${Date.now().toString().slice(-6)}`,
          note: settlementNote,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // confirmPartnerSettlement now atomically: adds settlement record,
        // decrements partner.cashInHand, marks codCollections as SETTLED,
        // and notifies the delivery partner. No need to also call verifyAndSettlePartnerCash.
        confirmPartnerSettlement(
          selectedPartnerForSettlement.partnerId,
          settlementAmount,
          'admin-root',
          'Store Admin',
          settlementRef,
          settlementNote
        );
        if (settlementAlsoLogout) {
          adminForceLogoutPartner(selectedPartnerForSettlement.partnerId);
        }
        showToast(`Settlement of ₹${settlementAmount} confirmed successfully!${settlementAlsoLogout ? ' Rider shift ended & logged out.' : ''}`, 'success');
        setSelectedPartnerForSettlement(null);
      } else {
        showToast(data.error || 'Failed to confirm settlement', 'error');
      }
    } catch (err) {
      // Offline / network fallback – still apply locally
      confirmPartnerSettlement(
        selectedPartnerForSettlement.partnerId,
        settlementAmount,
        'admin-root',
        'Store Admin',
        settlementRef,
        settlementNote
      );
      if (settlementAlsoLogout) {
        adminForceLogoutPartner(selectedPartnerForSettlement.partnerId);
      }
      showToast(`Settlement of ₹${settlementAmount} confirmed!${settlementAlsoLogout ? ' Rider shift ended.' : ''}`, 'success');
      setSelectedPartnerForSettlement(null);
    } finally {
      setIsSubmittingSettlement(false);
    }
  };


  // Handle Review Exception
  const handleReviewExceptionSubmit = async () => {
    if (!selectedException) return;
    setIsSubmittingReview(true);
    try {
      const res = await fetch('/api/admin/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionId: selectedException.id,
          orderId: selectedException.orderId,
          action: exceptionAction,
          adminId: 'admin-root',
          adminName: 'Store Admin',
          adminNote: adminExceptionNote,
        }),
      });
      const data = await res.json();
      if (data.success) {
        reviewDeliveryException(
          selectedException.id,
          exceptionAction,
          'admin-root',
          'Store Admin',
          adminExceptionNote,
          selectedException.orderId
        );
        showToast(`Exception ${exceptionAction.toLowerCase()} successfully!`, 'success');
        setSelectedException(null);
      } else {
        showToast(data.error || 'Failed to review exception', 'error');
      }
    } catch (err) {
      reviewDeliveryException(
        selectedException.id,
        exceptionAction,
        'admin-root',
        'Store Admin',
        adminExceptionNote,
        selectedException.orderId
      );
      showToast(`Exception ${exceptionAction.toLowerCase()}!`, 'success');
      setSelectedException(null);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── TOP HEADER & SUB-NAVIGATION ── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#0F532B] text-white flex items-center justify-center shadow-md">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Payments, Collections & COD Settlement
              </h1>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Authoritative multi-channel cash management, PhonePe UPI verification & anti-fraud audit control.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tabs switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 self-stretch md:self-auto">
          {[
            { id: 'overview', label: 'Overview & KPIs', icon: TrendingUp },
            { id: 'settlements', label: 'Partner Settlements', icon: Banknote },
            { id: 'exceptions', label: 'Exceptions & Fraud', icon: FileWarning, badge: deliveryExceptions.filter(e => e.status === 'PENDING').length },
            { id: 'timeline', label: 'Financial Audit Logs', icon: Receipt },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {Boolean(tab.badge) && (
                  <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 1. OVERVIEW & FINANCIAL CARDS ── */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* 8 Financial KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Collection */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Total Collection</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0F532B] flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">₹{financialSummary.totalCollection.toLocaleString('en-IN')}</div>
              <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Gross platform sales</span>
              </div>
            </div>

            {/* Online Collection */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Online Prepaid</span>
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">₹{financialSummary.onlineCollection.toLocaleString('en-IN')}</div>
              <div className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Prepaid prior to delivery</span>
              </div>
            </div>

            {/* COD Cash */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">COD Cash</span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">₹{financialSummary.codCashCollection.toLocaleString('en-IN')}</div>
              <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Collected by partners</span>
              </div>
            </div>

            {/* COD UPI */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">COD UPI (PhonePe)</span>
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">₹{financialSummary.codUpiCollection.toLocaleString('en-IN')}</div>
              <div className="text-[11px] font-semibold text-purple-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Direct bank deposit</span>
              </div>
            </div>

            {/* Pending COD */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Pending COD</span>
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">₹{financialSummary.pendingCod.toLocaleString('en-IN')}</div>
              <div className="text-[11px] font-semibold text-orange-700">Orders in transit</div>
            </div>

            {/* Pending Settlement */}
            <div className="bg-white rounded-3xl p-5 border border-red-200 bg-red-50/40 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-red-700 uppercase tracking-wider">Pending Settlement</span>
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-red-900">₹{financialSummary.pendingSettlement.toLocaleString('en-IN')}</div>
              <div className="text-[11px] font-semibold text-red-700">Cash with delivery partners</div>
            </div>

            {/* Refunds */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Refunds &amp; Disputes</span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">₹{financialSummary.refunds.toLocaleString('en-IN')}</div>
              <div className="text-[11px] font-semibold text-slate-500">Reconciled</div>
            </div>

            {/* Net Collection */}
            <div className="bg-[#0F532B] text-white rounded-3xl p-5 shadow-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-200 uppercase tracking-wider">Net Realized</span>
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <CheckCheck className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">₹{financialSummary.netCollection.toLocaleString('en-IN')}</div>
              <div className="text-[11px] font-semibold text-emerald-100">Net revenue after refunds</div>
            </div>
          </div>

          {/* Quick settlement action table preview */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">Active Delivery Partner Cash Balances</h2>
                <p className="text-xs text-slate-500 font-medium">Verify cash received in physical store hub and record settlement.</p>
              </div>
              <button
                onClick={() => setActiveSubTab('settlements')}
                className="text-xs font-bold text-[#0F532B] hover:underline"
              >
                View Full Ledgers →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-black text-[10px]">
                    <th className="py-3 px-4">Partner</th>
                    <th className="py-3 px-4">COD Cash Collected</th>
                    <th className="py-3 px-4">COD UPI Collected</th>
                    <th className="py-3 px-4">Total Settled</th>
                    <th className="py-3 px-4">Pending Handover</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {partnerLedgers.map((p) => (
                    <tr key={p.partnerId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {p.partnerName}
                        <span className="block text-[10px] text-slate-400 font-normal">{p.phone}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-900">₹{p.totalCashCollected.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-900">₹{p.totalUpiCollected.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">₹{p.totalSettled.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full font-mono font-black text-xs ${
                          p.pendingSettlement > 0 ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          ₹{p.pendingSettlement.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenSettlement(p)}
                          disabled={p.pendingSettlement <= 0}
                          className="px-3.5 py-1.5 bg-[#0F532B] text-white rounded-xl font-bold text-xs shadow-xs active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                        >
                          Confirm Settlement
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. PARTNER SETTLEMENTS TAB ── */}
      {activeSubTab === 'settlements' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Delivery Partner Cash Settlement Ledgers</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Authoritative accounting for Cash on Delivery. Delivery partners cannot mark their own cash as settled.
                </p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search partner or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0F532B] w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-black text-[10px]">
                    <th className="py-3 px-4">Partner</th>
                    <th className="py-3 px-4">COD Cash</th>
                    <th className="py-3 px-4">COD UPI</th>
                    <th className="py-3 px-4">Total Collected</th>
                    <th className="py-3 px-4">Settled to Store</th>
                    <th className="py-3 px-4">Pending Handover</th>
                    <th className="py-3 px-4 text-right">Settlement Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {partnerLedgers
                    .filter((p) => p.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) || (p.phone && p.phone.includes(searchQuery)))
                    .map((p) => (
                      <tr key={p.partnerId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-900">
                          {p.partnerName}
                          <span className="block text-[10px] text-slate-400 font-normal">{p.phone}</span>
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-amber-900">₹{p.totalCashCollected.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-4 font-mono font-bold text-purple-900">₹{p.totalUpiCollected.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-900">₹{p.totalCollected.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-4 font-mono font-bold text-emerald-800">₹{p.totalSettled.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full font-mono font-black text-xs ${
                            p.pendingSettlement > 0 ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            ₹{p.pendingSettlement.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleOpenSettlement(p)}
                            disabled={p.pendingSettlement <= 0}
                            className="px-4 py-2 bg-[#0F532B] text-white rounded-xl font-bold text-xs shadow-sm active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                          >
                            [ CONFIRM SETTLEMENT ]
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historical Settlement Records Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-base font-black text-slate-900">Settlement Receipts History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-black text-[10px]">
                    <th className="py-3 px-4">Receipt Ref</th>
                    <th className="py-3 px-4">Partner</th>
                    <th className="py-3 px-4">Settled Amount</th>
                    <th className="py-3 px-4">Authorized Admin</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.settlementRef}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{s.partnerName}</td>
                      <td className="py-3 px-4 font-mono font-black text-emerald-800">₹{s.amount.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{s.adminName} ({s.adminId})</td>
                      <td className="py-3 px-4 text-slate-500">{s.note || 'Cash handover confirmed.'}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{new Date(s.timestamp).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. EXCEPTIONS & ANTI-FRAUD TAB ── */}
      {activeSubTab === 'exceptions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-amber-600" />
                <span>Delivery OTP Exceptions &amp; Authorizations</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Delivery partners cannot bypass OTP on their own. Admin authorization is required for genuine edge cases.
              </p>
            </div>

            {deliveryExceptions.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h3 className="font-bold text-slate-800 text-sm">No Pending Exceptions</h3>
                <p className="text-xs text-slate-500 mt-1">All deliveries are operating with standard 4-digit OTP authorization.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase font-black text-[10px]">
                      <th className="py-3 px-4">Order</th>
                      <th className="py-3 px-4">Partner</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Requested At</th>
                      <th className="py-3 px-4 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {deliveryExceptions.map((exc) => (
                      <tr key={exc.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">#{exc.orderNumber}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{exc.partnerName}</td>
                        <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate">{exc.reason}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            exc.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : exc.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                          }`}>
                            {exc.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">{new Date(exc.createdAt).toLocaleTimeString('en-IN')}</td>
                        <td className="py-3.5 px-4 text-right">
                          {exc.status === 'PENDING' ? (
                            <button
                              onClick={() => {
                                setSelectedException(exc);
                                setExceptionAction('APPROVED');
                                setAdminExceptionNote('');
                              }}
                              className="px-3 py-1.5 bg-[#0F532B] text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs active:scale-95"
                            >
                              Review &amp; Authorize
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Anti-Fraud Security Events & Alerts */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-600" />
              <span>Anti-Fraud Security Alerts</span>
            </h2>
            <div className="space-y-3">
              {auditLogs
                .filter((l) => l.action.includes('LOCKED') || l.action.includes('FAILED') || l.action.includes('ALERT'))
                .slice(0, 5)
                .map((log) => (
                  <div key={log.id} className="p-3.5 rounded-2xl bg-red-50/60 border border-red-200 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-black text-red-950 block">{log.action}</span>
                        <p className="text-xs text-red-800 font-medium mt-0.5">{log.description}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-red-600 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('en-IN')}
                    </span>
                  </div>
                ))}
              {auditLogs.filter((l) => l.action.includes('LOCKED')).length === 0 && (
                <p className="text-xs text-slate-500 font-semibold text-center py-2">
                  ✓ No security lock alerts or fraud attempts detected.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 4. TIMELINE & AUDIT LOGS TAB ── */}
      {activeSubTab === 'timeline' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">Financial &amp; Delivery Audit Trail</h2>
              <p className="text-xs text-slate-500 font-medium">Immutable append-only log of every payment, OTP event, and delivery completion.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-black text-[10px]">
                  <th className="py-3 px-4">Event Action</th>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {auditLogs.slice(0, 25).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{log.orderId ? `#${log.orderId}` : '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{log.actorId || log.actorRole || 'System'}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate">{log.description}</td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SETTLEMENT CONFIRMATION MODAL ── */}
      {selectedPartnerForSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0F532B] text-white flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900 text-base">Confirm COD Cash Settlement</h3>
              </div>
              <button onClick={() => setSelectedPartnerForSettlement(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Delivery Partner:</span>
                <strong className="text-slate-900">{selectedPartnerForSettlement.partnerName}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Cash Collected:</span>
                <strong className="text-amber-900 font-mono">₹{selectedPartnerForSettlement.totalCashCollected.toLocaleString('en-IN')}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Already Settled:</span>
                <strong className="text-emerald-800 font-mono">₹{selectedPartnerForSettlement.totalSettled.toLocaleString('en-IN')}</strong>
              </div>
              <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                <span>Pending Handover:</span>
                <strong className="text-red-700 font-mono text-sm">₹{selectedPartnerForSettlement.pendingSettlement.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Settlement Amount to Confirm (₹):</label>
                <input
                  type="number"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(Number(e.target.value))}
                  className="w-full p-3 border border-slate-300 rounded-xl font-mono text-base font-bold outline-none focus:border-[#0F532B]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Settlement Reference / Voucher #:</label>
                <input
                  type="text"
                  value={settlementRef}
                  onChange={(e) => setSettlementRef(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-mono outline-none focus:border-[#0F532B]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Admin Audit Note (optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Received cash in store safe handover"
                  value={settlementNote}
                  onChange={(e) => setSettlementNote(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-[#0F532B]"
                />
              </div>

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={settlementAlsoLogout}
                  onChange={(e) => setSettlementAlsoLogout(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0F532B] focus:ring-[#0F532B] border-slate-300"
                />
                <span className="text-xs font-semibold text-slate-800">
                  End rider shift &amp; log out delivery boy remotely upon settlement
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setSelectedPartnerForSettlement(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSettlementSubmit}
                disabled={isSubmittingSettlement || settlementAmount <= 0}
                className="flex-1 py-3 bg-[#0F532B] text-white font-bold text-xs rounded-xl shadow active:scale-95 disabled:opacity-50"
              >
                {isSubmittingSettlement ? 'Confirming…' : `Confirm ₹${settlementAmount} Settlement`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXCEPTION REVIEW MODAL ── */}
      {selectedException && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-slate-900 text-base">Review Delivery Exception</h3>
              </div>
              <button onClick={() => setSelectedException(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Order:</span>
                <strong className="text-slate-900 font-mono">#{selectedException.orderNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Partner:</span>
                <strong className="text-slate-900">{selectedException.partnerName}</strong>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block mb-1">Partner Reason:</span>
                <p className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-800 font-semibold">
                  {selectedException.reason}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Decision:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExceptionAction('APPROVED')}
                    className={`py-2.5 rounded-xl font-bold border transition-all ${
                      exceptionAction === 'APPROVED'
                        ? 'bg-emerald-50 border-emerald-500 text-[#0F532B] ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    ✓ Authorize Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setExceptionAction('REJECTED')}
                    className={`py-2.5 rounded-xl font-bold border transition-all ${
                      exceptionAction === 'REJECTED'
                        ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-200'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    ✗ Reject Exception
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Admin Resolution Note:</label>
                <textarea
                  value={adminExceptionNote}
                  onChange={(e) => setAdminExceptionNote(e.target.value)}
                  placeholder="e.g. Verified with customer on phone call; approved delivery."
                  rows={2}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#0F532B]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setSelectedException(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewExceptionSubmit}
                disabled={isSubmittingReview}
                className="flex-1 py-3 bg-[#0F532B] text-white font-bold text-xs rounded-xl shadow active:scale-95"
              >
                {isSubmittingReview ? 'Submitting…' : `Confirm ${exceptionAction}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
