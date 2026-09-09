'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Notification } from '@/types';
import {
  Bell,
  CheckCheck,
  ShieldAlert,
  ShoppingBag,
  PackageX,
  CreditCard,
  Truck,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  Clock,
  Radio
} from 'lucide-react';

export const AdminNotificationBell: React.FC = () => {
  const router = useRouter();
  const {
    getFilteredNotifications,
    markNotificationRead,
    markAllNotificationsRead
  } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notifications = getFilteredNotifications('admin');
  const unreadCount = notifications.filter((n) => !n.isRead).length;

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

  const getAdminIcon = (type: string) => {
    if (type.includes('LOW_STOCK') || type.includes('OUT_OF_STOCK')) {
      return (
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    }
    if (type.includes('PAYMENT')) {
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
          <CreditCard className="w-4 h-4" />
        </div>
      );
    }
    if (type.includes('PARTNER')) {
      return (
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
          <Truck className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
        <ShoppingBag className="w-4 h-4" />
      </div>
    );
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
      {/* Admin Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-2 focus:outline-hidden shadow-xs"
        title="Admin Operations Feed"
      >
        <Bell className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold hidden sm:inline text-slate-200">Alerts</span>
        {unreadCount > 0 && (
          <span className="min-w-4.5 h-4.5 px-1.5 bg-rose-500 text-white font-black text-[10px] rounded-full flex items-center justify-center shadow-xs animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Admin Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-extrabold text-sm text-white">Live Operations Feed</span>
              {unreadCount > 0 && (
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {unreadCount} pending
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead('admin')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-300">All systems normal</p>
                <p className="text-xs text-slate-500 mt-0.5">No critical alerts or pending orders.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 hover:bg-slate-800/70 transition-colors cursor-pointer relative group flex gap-3 ${
                    !notif.isRead ? 'bg-slate-800/40 border-l-2 border-amber-500' : ''
                  }`}
                >
                  {getAdminIcon(notif.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="text-xs font-bold text-slate-100 truncate">{notif.title}</h4>
                      <span className="text-[10px] text-slate-500 shrink-0 font-medium">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{notif.message}</p>

                    {/* Action button in card */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 group-hover:text-amber-300">
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">Real-time operational sync</span>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/admin?tab=notifications');
              }}
              className="text-amber-400 hover:text-amber-300 font-extrabold flex items-center gap-1 hover:underline"
            >
              <span>Broadcast & Campaigns</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
