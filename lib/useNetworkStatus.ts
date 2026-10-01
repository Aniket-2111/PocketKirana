'use client';

import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  rtt?: number; // Round trip time in ms
  downlink?: number; // Estimated bandwidth in Mbps
  saveData?: boolean;
  isSlowConnection: boolean;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    const isOnline = typeof window !== 'undefined' ? navigator.onLine : true;
    return {
      isOnline,
      wasOffline: false,
      isSlowConnection: false,
      lastOnlineAt: isOnline ? new Date() : null,
      lastOfflineAt: isOnline ? null : new Date(),
    };
  });

  const updateConnectionInfo = useCallback(() => {
    if (typeof window === 'undefined') return;

    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    const isOnline = navigator.onLine;
    const effectiveType = connection?.effectiveType;
    const rtt = connection?.rtt;
    const downlink = connection?.downlink;
    const saveData = connection?.saveData;

    // A connection is considered slow if effectiveType is 2g/slow-2g or RTT > 1500ms
    const isSlowConnection =
      isOnline &&
      (effectiveType === 'slow-2g' ||
        effectiveType === '2g' ||
        (typeof rtt === 'number' && rtt > 1500) ||
        (typeof downlink === 'number' && downlink < 0.25));

    setStatus((prev) => ({
      ...prev,
      isOnline,
      effectiveType,
      rtt,
      downlink,
      saveData,
      isSlowConnection,
      lastOnlineAt: isOnline ? new Date() : prev.lastOnlineAt,
      lastOfflineAt: !isOnline ? new Date() : prev.lastOfflineAt,
    }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        wasOffline: true,
        lastOnlineAt: new Date(),
      }));
      updateConnectionInfo();

      // Trigger custom window event for any decoupled observers
      window.dispatchEvent(new CustomEvent('pk_network_restored'));
    };

    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        wasOffline: true,
        lastOfflineAt: new Date(),
      }));
      window.dispatchEvent(new CustomEvent('pk_network_lost'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (connection && connection.addEventListener) {
      connection.addEventListener('change', updateConnectionInfo);
    }

    updateConnectionInfo();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection && connection.removeEventListener) {
        connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, [updateConnectionInfo]);

  const clearWasOffline = useCallback(() => {
    setStatus((prev) => ({ ...prev, wasOffline: false }));
  }, []);

  return {
    ...status,
    clearWasOffline,
    checkNow: updateConnectionInfo,
  };
}
