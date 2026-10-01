'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Package,
  Tag,
  ShieldAlert,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { requestFCMNotificationPermission } from '@/lib/fcmClient';
import { showToast } from '@/components/ui/Toast';

const STORAGE_KEY_NOTIF_ONBOARDED = 'pk_notification_onboarding_shown';

export default function PostLoginNotificationDialog() {
  const { isLoggedIn, currentUser } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    // Only show if user is authenticated and hasn't seen the post-login notification prompt
    if (typeof window === 'undefined') return;

    if (isLoggedIn && currentUser?.id) {
      const alreadyShown = localStorage.getItem(STORAGE_KEY_NOTIF_ONBOARDED);
      if (!alreadyShown) {
        // Small delay so page transition has settled cleanly
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoggedIn, currentUser?.id]);

  if (!isOpen || !isLoggedIn) return null;

  const handleEnableNotifications = async () => {
    setRequesting(true);
    try {
      if (currentUser?.id) {
        const result = await requestFCMNotificationPermission(currentUser.id, 'customer');
        if (result.permission === 'granted' || result.token) {
          showToast('Notifications enabled! You will receive live order updates 🎉', 'success');
        } else {
          showToast('Notifications are off. You can enable them anytime from Profile.', 'info');
        }
      }
    } catch (err) {
      console.warn('[PostLoginNotificationDialog] Enable notifications notice:', err);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_NOTIF_ONBOARDED, 'true');
      }
      setRequesting(false);
      setIsOpen(false);
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_NOTIF_ONBOARDED, 'true');
    }
    setIsOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-[#181d27] rounded-t-[28px] sm:rounded-3xl shadow-2xl p-6 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 border-t sm:border border-slate-200 dark:border-slate-800">
        
        {/* Dismiss Icon */}
        <div className="flex justify-end">
          <button
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#006E2F] dark:text-emerald-400 shadow-md">
            <Bell className="w-8 h-8 stroke-[2.2]" />
          </div>
        </div>

        {/* Title & Copy */}
        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Never miss your order
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
            Get real-time updates about your orders, delivery status, offers and important account updates.
          </p>
        </div>

        {/* Value Highlights */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[#006E2F] dark:text-emerald-400 shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                Live Order &amp; Delivery Tracking
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Real-time pack, dispatch &amp; arrival alerts
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
              <Tag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                Exclusive Offers &amp; Discounts
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Get flash deals on your daily groceries
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleEnableNotifications}
            disabled={requesting}
            className="w-full py-3.5 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#006E2F]/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70"
          >
            {requesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enabling Notifications…
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                Enable notifications
              </>
            )}
          </button>

          <button
            onClick={handleDismiss}
            className="w-full py-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            No, thanks
          </button>
        </div>

      </div>
    </div>
  );
}
