'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import {
  Bell,
  CheckCircle2,
  Package,
  Bike,
  AlertCircle,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export interface ToastNotification {
  id: string;
  title: string;
  body: string;
  deepLink?: string;
  orderId?: string;
  notificationType?: string;
  createdAt?: string;
}

// Pleasant harmonic two-tone audio chime using Web Audio API
function playHarmonicChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.1);
    gain2.gain.setValueAtTime(0.001, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.56);
  } catch {}
}

export function RealtimeNotificationToast() {
  const router = useRouter();
  const [currentToast, setCurrentToast] = useState<ToastNotification | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [progress, setProgress] = useState(100);
  const queueRef = useRef<ToastNotification[]>([]);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);

  const displayNextToast = useCallback(() => {
    if (queueRef.current.length === 0) {
      setCurrentToast(null);
      setIsClosing(false);
      return;
    }

    const next = queueRef.current.shift()!;
    setCurrentToast(next);
    setIsClosing(false);
    setProgress(100);

    playHarmonicChime();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    const startTime = Date.now();
    const duration = 6000;

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remainingPct);
      if (elapsed >= duration) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
    }, 50);

    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, duration);
  }, []);

  const handleDismiss = () => {
    setIsClosing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    setTimeout(() => {
      displayNextToast();
    }, 300);
  };

  const handleToastClick = () => {
    if (!currentToast) return;
    const link = currentToast.deepLink || (currentToast.orderId ? `/orders/${currentToast.orderId}/track` : null);
    handleDismiss();
    if (link) {
      router.push(link);
    }
  };

  const enqueueNotification = useCallback(
    (notif: ToastNotification) => {
      if (shownIdsRef.current.has(notif.id)) return;
      shownIdsRef.current.add(notif.id);

      if (shownIdsRef.current.size > 200) {
        const first = shownIdsRef.current.values().next().value;
        if (first) shownIdsRef.current.delete(first);
      }

      if (!currentToast) {
        queueRef.current.push(notif);
        displayNextToast();
      } else {
        queueRef.current.push(notif);
      }
    },
    [currentToast, displayNextToast]
  );

  useEffect(() => {
    const handleCustomNotification = (e: CustomEvent<ToastNotification>) => {
      if (e.detail) {
        enqueueNotification(e.detail);
      }
    };

    window.addEventListener('pk_notification' as any, handleCustomNotification);
    return () => {
      window.removeEventListener('pk_notification' as any, handleCustomNotification);
    };
  }, [enqueueNotification]);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    const auth = getFirebaseAuth();
    if (!auth) return;

    const unsubscribeAuth = onAuthStateChanged(auth, (user: User | null) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      const uid = user ? user.uid : localStorage.getItem('user_id') || 'guest';
      const db = getFirebaseDb();
      if (!db) return;

      try {
        const notifQuery = query(
          collection(db, 'notifications'),
          where('uid', '==', uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );

        unsubscribeFirestore = onSnapshot(
          notifQuery,
          (snapshot) => {
            if (initialLoadRef.current) {
              snapshot.docs.forEach((doc) => shownIdsRef.current.add(doc.id));
              initialLoadRef.current = false;
              return;
            }

            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const data = change.doc.data();
                enqueueNotification({
                  id: change.doc.id,
                  title: data.title || 'PocketKirana Update',
                  body: data.body || data.message || '',
                  deepLink: data.deepLink || (data.orderId ? `/orders/${data.orderId}/track` : undefined),
                  orderId: data.orderId,
                  notificationType: data.event || data.notificationType,
                });
              }
            });
          },
          (err) => {
            console.warn('[RealtimeNotificationToast] Listener notice:', err.message);
          }
        );
      } catch (err: any) {
        console.warn('[RealtimeNotificationToast] Setup notice:', err.message);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [enqueueNotification]);

  if (!currentToast) return null;

  const getBadgeIcon = () => {
    const type = currentToast.notificationType?.toUpperCase() || '';
    if (type.includes('PACK') || type.includes('READY')) {
      return <Package className="w-5 h-5 text-amber-500" />;
    }
    if (type.includes('DELIVERY') || type.includes('RIDER') || type.includes('OUT_FOR_DELIVERY')) {
      return <Bike className="w-5 h-5 text-emerald-500" />;
    }
    if (type.includes('CONFIRM') || type.includes('DELIVERED') || type.includes('SUCCESS')) {
      return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    }
    if (type.includes('OFFER') || type.includes('PROMOTION') || type.includes('DISCOUNT')) {
      return <Sparkles className="w-5 h-5 text-amber-500" />;
    }
    if (type.includes('CANCEL') || type.includes('FAIL') || type.includes('ALERT')) {
      return <AlertCircle className="w-5 h-5 text-rose-500" />;
    }
    return <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
  };

  return (
    <aside
      aria-label="Real-time notifications"
      className="fixed bottom-5 left-5 z-[9999] max-w-sm w-[calc(100vw-2.5rem)] sm:w-96 pointer-events-auto select-none"
    >
      <div
        role="alert"
        aria-live="assertive"
        className={`relative overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-emerald-500/20 dark:border-emerald-500/30 shadow-2xl shadow-emerald-950/15 p-4 transition-all duration-300 transform ${
          isClosing
            ? '-translate-x-12 opacity-0 scale-95'
            : 'translate-x-0 opacity-100 scale-100 animate-in slide-in-from-bottom-5'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-sm">
            {getBadgeIcon()}
          </div>

          <button
            type="button"
            className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer group"
            onClick={handleToastClick}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                PocketKirana Live
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {currentToast.title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5 line-clamp-2">
              {currentToast.body}
            </p>
            {currentToast.deepLink && (
              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-2">
                <span>View details</span>
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 -mr-1 -mt-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
