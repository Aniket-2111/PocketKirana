'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Notification } from '@/types';
import {
  Bell,
  CheckCircle2,
  Truck,
  MapPin,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCheck,
  Navigation,
  DollarSign,
  X
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface PartnerNotificationCenterProps {
  isOpen?: boolean;
  onClose?: () => void;
  partnerId?: string;
  hideTriggerButton?: boolean;
}

export const PartnerNotificationCenter: React.FC<PartnerNotificationCenterProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  partnerId,
  hideTriggerButton = false,
}) => {
  const {
    getFilteredNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    activePartnerId
  } = useAppStore();

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (val: boolean) => {
    if (controlledOnClose && !val) {
      controlledOnClose();
    }
    setInternalIsOpen(val);
  };

  const notifications = getFilteredNotifications('delivery_partner');
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleAcceptDelivery = (notif: Notification) => {
    markNotificationRead(notif.id);
    showToast('Delivery order accepted! Navigation route updated.', 'success');
    setIsOpen(false);
  };

  return (
    <>
      {/* Bell Button (if not hidden) */}
      {!hideTriggerButton && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors flex items-center gap-1.5 focus:outline-hidden cursor-pointer"
          title="Delivery Notifications"
        >
          <Bell className="w-4 h-4 text-emerald-400" />
          {unreadCount > 0 && (
            <span className="min-w-4.5 h-4.5 px-1 bg-emerald-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center animate-bounce shadow-xs">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Slide-over Drawer / Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 h-full flex flex-col border-l border-slate-800 shadow-2xl text-white">
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Delivery Dispatches</h3>
                  <span className="text-[10px] text-slate-400">Live Partner Activity Feed</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllNotificationsRead('delivery_partner')}
                    className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Truck className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p className="font-bold text-sm text-slate-300">No active dispatches</p>
                  <p className="text-xs mt-1">You will receive delivery tasks and alerts here.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => markNotificationRead(notif.id)}
                    className={`p-4 rounded-2xl border transition-all ${
                      !notif.isRead
                        ? 'bg-slate-800/90 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                        : 'bg-slate-800/40 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {notif.type === 'PARTNER_NEW_DELIVERY' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                            New Dispatch
                          </span>
                        )}
                        {notif.type === 'PARTNER_PICKUP_READY' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
                            Ready at Store
                          </span>
                        )}
                        {notif.type === 'PARTNER_EARNINGS_CREDITED' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                            Wallet +₹
                          </span>
                        )}
                        <h4 className="font-extrabold text-sm text-white">{notif.title}</h4>
                      </div>

                      <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-3">{notif.message}</p>

                    {/* Metadata details if available */}
                    {notif.meta && (
                      <div className="bg-slate-950/60 rounded-xl p-2.5 mb-3 grid grid-cols-2 gap-2 text-xs">
                        {notif.meta.distance && (
                          <div className="flex items-center gap-1 text-slate-300">
                            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Distance: <strong>{notif.meta.distance}</strong></span>
                          </div>
                        )}
                        {notif.meta.amount && (
                          <div className="flex items-center gap-1 text-slate-300">
                            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                            <span>Order: <strong>₹{notif.meta.amount}</strong></span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    {notif.type === 'PARTNER_NEW_DELIVERY' && !notif.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptDelivery(notif);
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-extrabold text-xs text-white shadow-md flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept Delivery Task</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
