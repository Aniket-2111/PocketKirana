'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Register PWA / Push Service Worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/',
        });

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version available. Refresh to update.');
              }
            });
          }
        });
      } catch (err) {
        console.warn('[PWA] Service Worker registration note:', err);
      }
    };

    registerSW();

    // Setup foreground message listener if notifications are active
    let unsubFCM: (() => void) | undefined;
    import('@/lib/fcmClient')
      .then(({ setupFCMForegroundListener }) => {
        unsubFCM = setupFCMForegroundListener((payload) => {
          console.log('[PWA] Foreground Push Message received:', payload);
        });
      })
      .catch(() => {});

    return () => {
      if (unsubFCM) unsubFCM();
    };
  }, []);

  return null;
}
