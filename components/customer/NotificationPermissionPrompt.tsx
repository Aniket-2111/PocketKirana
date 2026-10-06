'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, ShieldCheck, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { requestFCMNotificationPermission } from '@/lib/fcmClient';
import { showToast } from '@/components/ui/Toast';

export function NotificationPermissionPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if notifications are supported
    if (!('Notification' in window)) {
      setPermissionStatus('unsupported');
      return;
    }

    const currentPermission = Notification.permission;
    setPermissionStatus(currentPermission);

    // If already granted or previously denied, don't show prompt
    if (currentPermission === 'granted') {
      return;
    }

    // Check if user clicked "Not Now" in this session or in last 3 days
    const dismissedUntil = localStorage.getItem('pk_notif_prompt_dismissed_until');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // Wait 4 seconds after page load before showing soft-prompt (non-intrusive)
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const storedUid = typeof window !== 'undefined' ? (localStorage.getItem('user_id') || localStorage.getItem('pk_guest_uid')) : null;
      const targetUserId = storedUid || `guest_${Math.random().toString(36).substring(2, 9)}`;
      const result = await requestFCMNotificationPermission(targetUserId, 'customer');

      if (result.permission === 'granted') {
        setPermissionStatus('granted');
        setIsVisible(false);
        showToast('🎉 Push notifications enabled! You will get real-time offer and order updates.', 'success');
      } else if (result.permission === 'denied') {
        setPermissionStatus('denied');
        setIsVisible(false);
        showToast('Notifications are blocked in your browser settings. You can enable them anytime from site settings.', 'info');
      } else {
        setIsVisible(false);
      }
    } catch {
      setIsVisible(false);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Suppress for 3 days
    localStorage.setItem(
      'pk_notif_prompt_dismissed_until',
      String(Date.now() + 3 * 24 * 60 * 60 * 1000)
    );
  };

  if (!isVisible || permissionStatus === 'granted' || permissionStatus === 'unsupported') {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Push Notification Permission"
      className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] sm:w-auto bg-slate-900/95 backdrop-blur-md text-white p-5 rounded-3xl shadow-2xl border border-slate-700/80 animate-in slide-in-from-bottom-5 fade-in duration-300"
    >
      <div className="flex items-start gap-3.5">
        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl shrink-0 border border-emerald-500/30">
          <Bell className="w-5 h-5 animate-bounce" />
        </div>

        <div className="space-y-1.5 flex-1 pr-2">
          <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Stay Updated</span>
          </div>
          <h4 className="font-black text-sm text-white leading-snug">
            Get instant order & discount alerts
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Enable notifications to receive real-time delivery status, rider tracking, and exclusive ₹100 OFF flash coupons.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleEnable}
              disabled={isRequesting}
              className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isRequesting ? 'Enabling...' : 'Enable Notifications'}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all"
            >
              Not Now
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Close notification prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
