'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Notification, NotificationEventType } from '@/types';
import {
  Bell,
  CheckCheck,
  ShoppingBag,
  Truck,
  Tag,
  Sparkles,
  ChevronRight,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  X
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export const NotificationBell: React.FC = () => {
  const router = useRouter();
  const {
    getFilteredNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    activeRole
  } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'order' | 'offer'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get notifications filtered for Customer
  const notifications = getFilteredNotifications('customer');
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'order') return n.category === 'order' || n.category === 'delivery';
    if (filter === 'offer') return n.category === 'offer' || n.category === 'campaign';
    return true;
  });

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      markNotificationRead(notif.id);
    }
    setIsOpen(false);
    if (notif.deepLink) {
      router.push(notif.deepLink);
    }
  };

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    showToast(`Coupon code ${code} copied!`, 'success');
  };

  const getNotificationIcon = (type: NotificationEventType, category?: string) => {
    if (type.includes('DELIVERY') || category === 'delivery') {
      return <Truck className="w-4 h-4 text-emerald-600" />;
    }
    if (type.includes('OFFER') || type.includes('COUPON') || category === 'offer') {
      return <Tag className="w-4 h-4 text-amber-600" />;
    }
    if (type.includes('DELIVERED')) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    }
    if (type.includes('CANCELLED')) {
      return <AlertCircle className="w-4 h-4 text-rose-500" />;
    }
    return <ShoppingBag className="w-4 h-4 text-emerald-700" />;
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors focus:outline-hidden"
        title="Notifications"
        aria-label="Notifications"
        suppressHydrationWarning
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4.5 h-4.5 px-1 bg-rose-500 text-white font-extrabold text-[10px] rounded-full flex items-center justify-center animate-pulse shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllNotificationsRead('customer')}
                  className="text-xs text-slate-300 hover:text-white flex items-center gap-1 font-medium hover:underline transition-all"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Read all</span>
                </button>
              )}
              <Link
                href="/profile?tab=notification_settings"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                title="Notification Settings"
              >
                <Sliders className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/70 p-1 gap-1 text-xs font-bold text-slate-600">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${filter === 'all' ? 'bg-white shadow-xs text-emerald-700' : 'hover:bg-slate-200/50'
                }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('order')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${filter === 'order' ? 'bg-white shadow-xs text-emerald-700' : 'hover:bg-slate-200/50'
                }`}
            >
              Orders
            </button>
            <button
              onClick={() => setFilter('offer')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${filter === 'offer' ? 'bg-white shadow-xs text-amber-700' : 'hover:bg-slate-200/50'
                }`}
            >
              Offers
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {filteredNotifs.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-700">No notifications yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  You&apos;ll receive updates on your orders and exclusive offers here.
                </p>
              </div>
            ) : (
              filteredNotifs.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer relative group flex gap-3 ${!notif.isRead ? 'bg-emerald-50/30' : ''
                    }`}
                >
                  {/* Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${notif.category === 'offer'
                        ? 'bg-amber-100'
                        : notif.category === 'delivery'
                          ? 'bg-emerald-100'
                          : 'bg-emerald-100/70'
                      }`}
                  >
                    {getNotificationIcon(notif.type, notif.category)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs leading-tight truncate ${!notif.isRead ? 'font-black text-slate-900' : 'font-bold text-slate-700'
                          }`}
                      >
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-snug line-clamp-2">{notif.message}</p>

                    {/* Promotional Coupon Tag */}
                    {notif.couponCode && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={(e) => handleCopyCode(e, notif.couponCode!)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-800 border border-amber-300/60 rounded-md font-mono text-[11px] font-black hover:bg-amber-500/20 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{notif.couponCode}</span>
                        </button>
                        <span className="text-[10px] font-semibold text-amber-700">Tap to copy code</span>
                      </div>
                    )}

                    {/* Image Banner if available */}
                    {notif.imageUrl && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                        <img
                          src={notif.imageUrl}
                          alt="Offer"
                          className="w-full h-24 object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                  </div>

                  {/* Unread indicator dot */}
                  {!notif.isRead && (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5 shadow-xs" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/profile?tab=notification_settings"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 hover:underline"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Preferences</span>
            </Link>

            <Link
              href="/profile?tab=my_orders"
              onClick={() => setIsOpen(false)}
              className="text-emerald-700 font-extrabold hover:text-emerald-800 flex items-center gap-0.5"
            >
              <span>Track Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
