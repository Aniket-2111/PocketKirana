'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, RotateCcw, X } from 'lucide-react';
import { useNetworkStatus } from '@/lib/useNetworkStatus';

export const NetworkStatusBanner: React.FC = () => {
  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus();
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [dismissedOffline, setDismissedOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setDismissedOffline(false);
    } else if (wasOffline) {
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
        clearWasOffline();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, clearWasOffline]);

  // If online and not showing the restored notice, render nothing
  if (isOnline && !showRestoredNotice) {
    return null;
  }

  // If user dismissed the offline banner in this session, keep it minimal or hide
  if (!isOnline && dismissedOffline) {
    return (
      <div className="fixed bottom-4 left-4 z-50 animate-fadeSlideUp">
        <button
          type="button"
          onClick={() => setDismissedOffline(false)}
          className="flex items-center gap-2 bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg hover:bg-amber-700 transition-all"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-live="polite"
      aria-atomic="true"
      role="status"
      className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300 animate-fadeSlideUp"
    >
      {!isOnline ? (
        <div className="bg-amber-600 dark:bg-amber-700 text-white px-4 py-2 text-xs md:text-sm font-semibold shadow-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 max-w-2xl mx-auto flex-1 justify-center text-center">
            <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" aria-hidden="true" />
            <span>You’re currently offline. Changes will sync once connection is restored.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setDismissedOffline(true)}
              aria-label="Dismiss offline banner"
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-600 dark:bg-emerald-700 text-white px-4 py-2 text-xs md:text-sm font-semibold shadow-md flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4 flex-shrink-0 animate-bounce" aria-hidden="true" />
          <span>Back online! Reconnected to PocketKirana.</span>
        </div>
      )}
    </aside>
  );
};
