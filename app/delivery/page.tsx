'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Bike,
  Store,
  MapPin,
  CheckCircle2,
  Phone,
  MessageSquare,
  Clock,
  ChevronRight,
  Package,
  AlertCircle,
  LogOut,
  Navigation,
  ArrowRight,
  QrCode,
  Camera,
  XCircle,
  Ban,
  RefreshCw,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { PartnerAppShell } from '@/components/partner/PartnerAppShell';
import { ActiveDeliveryWorkflow } from '@/components/partner/ActiveDeliveryWorkflow';
import { showToast } from '@/components/ui/Toast';

export default function DeliveryPartnerPage() {
  const {
    deliveryPartners,
    activePartnerId,
    authenticatedPartnerId,
    validateAndLoginPartnerQR,
    logoutDeliveryPartner,
    togglePartnerStatus,
    acceptDeliveryAssignment,
    advanceDeliveryStage,
    verifyStorePickup,
    verifyCustomerDelivery,
    orders,
    notifications,
    partnerAuthTokens,
    initializeFirebaseSync
  } = useAppStore();

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'profile' | 'support'>('home');
  const [showLoginQRScanner, setShowLoginQRScanner] = useState(false);
  const [loginInputToken, setLoginInputToken] = useState('');
  const [loginErrorState, setLoginErrorState] = useState<{ title: string; message: string; type: string } | null>(null);
  const [loginSuccessPartnerName, setLoginSuccessPartnerName] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    initializeFirebaseSync();
  }, [initializeFirebaseSync]);

  // Active Authenticated Delivery Partner
  const partner = deliveryPartners.find(
    (p) => p.id === authenticatedPartnerId || p.id === activePartnerId
  ) || deliveryPartners[0] || {
    id: 'partner-placeholder',
    name: 'Delivery Rider',
    phone: '',
    accountStatus: 'active',
    currentStatus: 'offline',
    completedDeliveries: 0,
    activeOrderId: null,
    activeDeliveryStage: null,
  };

  const isAuthenticated = Boolean(authenticatedPartnerId);
  const isDeactivated = partner.accountStatus === 'inactive' || partner.accountStatus === 'suspended';
  const isOnline = partner.currentStatus === 'online' || partner.currentStatus === 'busy';

  // Active delivery order for logged in rider
  const activeOrder = orders.find(
    (o) =>
      o.id === partner.activeOrderId ||
      (o.partnerId === partner.id && o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'COMPLETED')
  );

  // Centralized Delivery Queue: Waiting packed orders
  const deliveryQueue = orders.filter((o) => {
    const st = (o.orderStatus || '').toUpperCase();
    return (
      st === 'PACKED' ||
      st === 'WAITING_FOR_DELIVERY' ||
      st === 'READY_FOR_PICKUP' ||
      (st === 'ASSIGNED' && (!o.partnerId || o.partnerId === partner.id))
    );
  });

  // Next available order to offer to this partner (FIFO)
  const nextAvailableOrder = !activeOrder && isOnline ? deliveryQueue[0] : null;

  const availableDeliveriesCount = deliveryQueue.length;
  const activeDeliveriesCount = activeOrder ? 1 : 0;
  const completedDeliveriesCount = partner.completedDeliveries || 0;

  // Handle QR Scan Submission for Admin Login
  const handleProcessLoginQR = (scannedCode: string) => {
    setLoginErrorState(null);
    setLoginSuccessPartnerName(null);

    const res = validateAndLoginPartnerQR(scannedCode);

    if (res.success && res.partner) {
      setLoginSuccessPartnerName(res.partner.name);
      showToast(`✓ LOGIN SUCCESSFUL! Welcome, ${res.partner.name}`, 'success');
      setTimeout(() => {
        setShowLoginQRScanner(false);
        setLoginSuccessPartnerName(null);
      }, 1500);
    } else {
      let title = '⚠ INVALID LOGIN QR';
      if (res.errorType === 'EXPIRED') title = 'QR EXPIRED';
      else if (res.errorType === 'REVOKED') title = 'ACCESS REVOKED';
      else if (res.errorType === 'ORDER_QR') title = '⚠ ORDER HANDOVER QR';

      setLoginErrorState({
        title,
        message: res.message,
        type: res.errorType || 'INVALID'
      });
      showToast(res.message, 'error');
    }
  };

  const handleAcceptDelivery = (orderId: string) => {
    if (activeOrder) {
      showToast('You already have an active delivery in progress.', 'error');
      return;
    }
    acceptDeliveryAssignment(orderId, partner.id);
    showToast(`Order #${orderId} accepted! Navigation starting...`, 'success');
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center p-6 font-sans">
        <div className="text-center space-y-3">
          <Bike className="w-10 h-10 text-emerald-400 animate-bounce mx-auto" />
          <p className="text-xs font-bold text-slate-400">Loading PocketKirana Delivery Portal...</p>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 1. FIRST LAUNCH & UNAUTHENTICATED ID + PASSWORD LOGIN SCREEN
  // ═════════════════════════════════════════════════════════════════
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col justify-between p-6 font-sans selection:bg-emerald-500">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center items-center text-center space-y-6 my-auto py-12">
          
          <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <Bike className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">
              PocketKirana Delivery Partner
            </span>
            <h1 className="text-3xl font-black tracking-tight">PARTNER SIGN IN</h1>
            <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed font-medium">
              Enter your Login ID and Password provided by your Store Admin.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const loginId = (form.elements.namedItem('loginId') as HTMLInputElement).value;
              const loginPassword = (form.elements.namedItem('password') as HTMLInputElement).value;
              const res = useAppStore.getState().loginPartnerByCredentials(loginId, loginPassword);
              if (res.success) {
                showToast(res.message, 'success');
              } else {
                showToast(res.message, 'error');
              }
            }}
            className="w-full max-w-xs space-y-3 text-left"
          >
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                Login ID / Mobile Number
              </label>
              <input
                type="text"
                name="loginId"
                placeholder="e.g. DP001 or 9112009988"
                defaultValue="DP001"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="Enter password"
                defaultValue="pk1234"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider mt-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>SIGN IN TO SHIFT</span>
            </button>
          </form>

          <p className="text-[10px] text-slate-500 font-bold">
            Demo ID: <span className="text-slate-300 font-mono">DP001</span> | Password: <span className="text-slate-300 font-mono">pk1234</span>
          </p>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 2. DEACTIVATED PARTNER REVOKED ACCESS SCREEN
  // ═════════════════════════════════════════════════════════════════
  if (isDeactivated) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6 text-center space-y-6 font-sans">
        <div className="w-20 h-20 bg-rose-500/20 border-2 border-rose-500 text-rose-400 rounded-3xl flex items-center justify-center shadow-xl">
          <Ban className="w-10 h-10" />
        </div>
        <div className="space-y-2 max-w-xs">
          <span className="text-xs font-black text-rose-400 uppercase tracking-widest block">ACCESS REVOKED</span>
          <h2 className="text-2xl font-black">Account Deactivated</h2>
          <p className="text-slate-400 text-xs leading-relaxed font-medium">
            Your Delivery Partner account has been deactivated by Admin. Please contact Admin to reactivate access.
          </p>
        </div>
        <button
          onClick={() => logoutDeliveryPartner()}
          className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-300 cursor-pointer flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Return to Login
        </button>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 3. AUTHENTICATED DELIVERY HOME (NO FINANCIAL CLUTTER / NO QR HANDOVER)
  // ═════════════════════════════════════════════════════════════════
  const currentStage = partner.activeDeliveryStage || (activeOrder ? 'ACCEPTED' : undefined);

  return (
    <PartnerAppShell
      partner={partner}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onToggleOnline={() => togglePartnerStatus(partner.id)}
      unreadNotifsCount={notifications.filter(n => n.recipientType === 'delivery_partner' && !n.isRead).length}
    >
      {/* ── HOME DASHBOARD TAB ── */}
      {activeTab === 'home' && (
        <div className="space-y-5 animate-in fade-in duration-200 text-slate-900 font-sans">
          
          {/* Status Toggle Header */}
          <section
            onClick={() => togglePartnerStatus(partner.id)}
            className={`rounded-3xl p-5 relative overflow-hidden shadow-sm transition-all cursor-pointer border ${
              isOnline
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${isOnline ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {isOnline ? 'You are Online' : 'You are Offline'}
                  </h3>
                  <p className={`text-xs font-bold ${isOnline ? 'text-white/90' : 'text-slate-500'}`}>
                    {isOnline ? 'Ready for automatic delivery dispatch' : 'Tap to go online for delivery orders'}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${isOnline ? 'bg-white text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                {isOnline ? 'ON DUTY' : 'OFF DUTY'}
              </span>
            </div>
          </section>

          {/* Operational Metrics */}
          <section className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200">
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Queue Waiting</span>
              <div className="text-xl font-black text-emerald-700 font-mono">{availableDeliveriesCount}</div>
              <span className="text-[9px] text-slate-400 font-bold block">Packed Orders</span>
            </div>

            <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200">
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Active</span>
              <div className="text-xl font-black text-amber-600 font-mono">{activeDeliveriesCount}</div>
              <span className="text-[9px] text-slate-400 font-bold block">In Transit</span>
            </div>

            <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200">
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Completed</span>
              <div className="text-xl font-black text-slate-900 font-mono">{completedDeliveriesCount}</div>
              <span className="text-[9px] text-slate-400 font-bold block">Shift Total</span>
            </div>
          </section>

          {/* ── ACTIVE DELIVERY IN PROGRESS (If partner is currently delivering) ── */}
          {activeOrder && currentStage ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  ACTIVE DELIVERY IN PROGRESS
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">Order #{activeOrder.orderNumber}</span>
              </div>

              <ActiveDeliveryWorkflow
                order={activeOrder}
                currentStage={currentStage}
                onAdvanceStage={advanceDeliveryStage}
                onVerifyPickup={verifyStorePickup}
                onVerifyDelivery={verifyCustomerDelivery}
              />
            </div>
          ) : (
            /* ── NEXT AVAILABLE ORDER CARD (If partner is AVAILABLE) ── */
            nextAvailableOrder ? (
              <div className="bg-gradient-to-br from-white to-emerald-50 border-2 border-emerald-500 rounded-3xl p-6 space-y-4 shadow-lg animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-widest bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                    🔔 NEXT DELIVERY AVAILABLE
                  </span>
                  <span className="text-xs font-mono font-black text-slate-900">
                    Order #{nextAvailableOrder.orderNumber}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-black text-lg text-slate-900">
                    {nextAvailableOrder.items?.length || 3} Products • {nextAvailableOrder.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 4} Total Items
                  </h4>
                  <p className="text-xs text-slate-600 font-bold flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-emerald-600" />
                    Pickup: <strong className="text-slate-900">{nextAvailableOrder.storeName || 'PocketKirana Neral Hub'}</strong>
                  </p>
                  <p className="text-xs text-slate-600 font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    Drop: <strong className="text-slate-900">{nextAvailableOrder.address?.addressLine1 || 'Matoshree Nagar, Neral'}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAcceptDelivery(nextAvailableOrder.id)}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>ACCEPT DELIVERY</span>
                </button>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-2 shadow-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="font-black text-sm text-slate-900">No Orders Currently Waiting</h4>
                <p className="text-xs text-slate-500 font-bold max-w-xs mx-auto">
                  {isOnline ? 'You are online! New packed orders will appear here automatically in real time.' : 'Go online to receive incoming delivery offers.'}
                </p>
              </div>
            )
          )}

          {/* ── CENTRALIZED DELIVERY QUEUE LIST ── */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Centralized Delivery Queue ({deliveryQueue.length} Orders Waiting)
              </h4>
            </div>

            {deliveryQueue.length > 0 ? (
              <div className="space-y-2">
                {deliveryQueue.map((ord, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={ord.id}
                      className={`flex items-center justify-between text-xs p-3 rounded-2xl border transition-all ${
                        isFirst
                          ? 'bg-emerald-50/80 border-emerald-300 font-bold'
                          : 'bg-slate-50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-200 font-mono font-black text-[11px] text-slate-700 flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <strong className="block font-black text-slate-900 text-xs">
                            Order #{ord.orderNumber}
                          </strong>
                          <span className="text-[10px] text-slate-500 block font-bold">
                            {(ord.items || []).length} Products • {ord.address?.area || 'Neral Hub'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 block">
                          {isFirst ? 'Next Available' : 'Waiting in Queue'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400 py-3 font-bold">
                Delivery queue is currently empty.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── ORDERS HISTORY TAB ── */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-in fade-in duration-200 text-xs text-slate-900 font-sans">
          <h3 className="font-black text-lg text-slate-900">Order Delivery History</h3>
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white border border-slate-200 p-4 rounded-2xl space-y-2 shadow-xs">
                <div className="flex items-center justify-between font-bold">
                  <strong className="text-slate-900">Order #{order.orderNumber}</strong>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full uppercase font-black">
                    {order.orderStatus}
                  </span>
                </div>
                <p className="text-slate-600 truncate font-bold">📍 {order.address?.addressLine1 || 'Matoshree Nagar, Neral'}</p>
                <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500 font-bold">
                  <span>{order.items?.length || 3} items</span>
                  <span>Payment: {order.paymentMethod.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && (
        <div className="space-y-4 animate-in fade-in duration-200 text-slate-900 font-sans">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-center space-y-3">
            <img
              src={partner.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
              alt={partner.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-emerald-600 mx-auto shadow-md"
            />
            <div>
              <h3 className="font-black text-lg text-slate-900">{partner.name}</h3>
              <span className="text-xs text-slate-500 font-mono block mt-0.5">{partner.phone}</span>
              <span className="inline-block mt-2 bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
                ID: {partner.partnerCode || partner.id} • {partner.vehicleType || 'Bike'}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-4 divide-y divide-slate-100 shadow-xs text-xs font-bold">
            <button
              onClick={() => logoutDeliveryPartner()}
              className="w-full py-3.5 px-2 flex items-center justify-between text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-rose-600" />
                <span>Log Out of Delivery App</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* ── SUPPORT TAB ── */}
      {activeTab === 'support' && (
        <div className="space-y-4 animate-in fade-in duration-200 text-slate-900 font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-center space-y-3">
            <h3 className="font-black text-lg text-slate-900">Delivery Support Hotline</h3>
            <p className="text-xs text-slate-500 font-bold">Need help with order dispatch or customer address?</p>
            <a
              href="tel:+918698893348"
              className="py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 cursor-pointer"
            >
              <Phone className="w-4 h-4" /> Call Admin Supervisor
            </a>
          </div>
        </div>
      )}
    </PartnerAppShell>
  );
}
