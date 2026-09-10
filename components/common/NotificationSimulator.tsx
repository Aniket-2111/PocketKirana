'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Bell,
  Play,
  Sparkles,
  ShoppingBag,
  Truck,
  ShieldCheck,
  Tag,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Send,
  CheckCircle2
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export const NotificationSimulator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    dispatchNotification,
    notificationPreferences,
    updateNotificationPreferences,
    activeRole
  } = useAppStore();

  const handleSimulate = (
    title: string,
    message: string,
    type: string,
    recipientType: 'customer' | 'admin' | 'delivery_partner',
    extra: any = {}
  ) => {
    dispatchNotification({
      recipientId: recipientType === 'customer' ? 'usr-cust-1' : recipientType === 'admin' ? 'admin' : 'partner-1',
      recipientType,
      type: type as any,
      title,
      message,
      createdAt: new Date().toISOString(),
      ...extra,
    });

    showToast(`Simulated ${recipientType.toUpperCase()} notification: "${title}"`, 'success');
  };

  // Dev/demo tool: never render for production users.
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 font-sans">
      {/* Floating Pill Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/95 text-white border border-slate-700 shadow-2xl backdrop-blur-md hover:bg-slate-800 transition-all font-bold text-xs group"
        suppressHydrationWarning
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <Bell className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
        <span>Notification Simulator</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {/* Simulator Control Drawer */}
      {isOpen && (
        <div className="mt-2 w-80 sm:w-96 bg-slate-900/95 text-white rounded-2xl border border-slate-700 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h4 className="font-extrabold text-xs text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Live Notification Engine Simulator
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Test role-based notification delivery in real time.
              </p>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() =>
                updateNotificationPreferences({
                  soundEnabled: !notificationPreferences.soundEnabled,
                })
              }
              className={`p-1.5 rounded-lg border text-xs transition-all ${
                notificationPreferences.soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={notificationPreferences.soundEnabled ? 'Mute Alert Chimes' : 'Unmute Alert Chimes'}
            >
              {notificationPreferences.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Role-Specific Quick Triggers */}
          <div className="mt-3 space-y-3 text-xs">
            {/* 1. Customer Scenarios */}
            <div>
              <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase block mb-1.5">
                🛒 Customer Triggers
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    handleSimulate(
                      '🛒 Order Confirmed',
                      'Your PocketKirana order #PK10245 has been confirmed and packed.',
                      'ORDER_CONFIRMED',
                      'customer',
                      { orderId: 'PK10245', deepLink: '/profile?tab=my_orders' }
                    )
                  }
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors text-[11px] font-bold text-slate-200"
                >
                  Order Confirmed
                </button>
                <button
                  onClick={() =>
                    handleSimulate(
                      '🚴 Out for Delivery',
                      'Your order #PK10245 is on the way with Sunil Kumar.',
                      'OUT_FOR_DELIVERY',
                      'customer',
                      { orderId: 'PK10245', deepLink: '/profile?tab=my_orders' }
                    )
                  }
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors text-[11px] font-bold text-slate-200"
                >
                  Out for Delivery
                </button>
                <button
                  onClick={() =>
                    handleSimulate(
                      '🎉 20% OFF Groceries',
                      'Get 20% OFF on groceries above ₹499. Use code GROCERY20.',
                      'OFFER_DISCOUNT',
                      'customer',
                      {
                        couponCode: 'GROCERY20',
                        deepLink: '/offers',
                        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
                      }
                    )
                  }
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors text-[11px] font-bold text-amber-300 col-span-2 flex items-center justify-between"
                >
                  <span>🎉 20% OFF Promo Code</span>
                  <Tag className="w-3 h-3 text-amber-400" />
                </button>
              </div>
            </div>

            {/* 2. Admin Scenarios */}
            <div>
              <span className="text-[10px] font-black tracking-wider text-rose-400 uppercase block mb-1.5">
                🔔 Admin Triggers
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    handleSimulate(
                      '🔔 New Order #PK10245',
                      'Customer: Rahul • Amount: ₹684 • 3 items • Delivery: 2.4 km',
                      'ADMIN_NEW_ORDER',
                      'admin',
                      { orderId: 'PK10245', deepLink: '/admin?tab=orders' }
                    )
                  }
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors text-[11px] font-bold text-slate-200"
                >
                  New Order (₹684)
                </button>
                <button
                  onClick={() =>
                    handleSimulate(
                      '⚠️ Low Stock Alert',
                      'Tata Salt 1kg only 4 units left in inventory.',
                      'ADMIN_LOW_STOCK',
                      'admin',
                      { deepLink: '/admin?tab=inventory' }
                    )
                  }
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors text-[11px] font-bold text-rose-300"
                >
                  Low Stock Warning
                </button>
              </div>
            </div>

            {/* 3. Delivery Partner Scenarios */}
            <div>
              <span className="text-[10px] font-black tracking-wider text-sky-400 uppercase block mb-1.5">
                🚴 Delivery Partner Triggers
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    handleSimulate(
                      '🚴 New Delivery Assigned',
                      'Order #PK10245 • Pickup: Hub • Drop: Flat 402 • 2.4 km',
                      'PARTNER_NEW_DELIVERY',
                      'delivery_partner',
                      {
                        orderId: 'PK10245',
                        deepLink: '/delivery',
                        meta: { distance: '2.4 km', amount: 684 },
                      }
                    )
                  }
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors text-[11px] font-bold text-slate-200"
                >
                  New Dispatch
                </button>
                <button
                  onClick={() =>
                    handleSimulate(
                      '📍 Customer Nearby',
                      'You are approximately 200m from delivery location.',
                      'PARTNER_CUSTOMER_NEARBY',
                      'delivery_partner',
                      { deepLink: '/delivery' }
                    )
                  }
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors text-[11px] font-bold text-sky-300"
                >
                  Nearby ~200m
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
