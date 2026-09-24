'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const PWARegister = dynamic(
  () => import('./PWARegister').then((m) => m.PWARegister),
  { ssr: false }
);
const NetworkStatusBanner = dynamic(
  () => import('@/components/states/NetworkStatusBanner').then((m) => m.NetworkStatusBanner),
  { ssr: false }
);
const RealtimeNotificationToast = dynamic(
  () => import('@/components/customer/RealtimeNotificationToast').then((m) => m.RealtimeNotificationToast),
  { ssr: false }
);
const NotificationPermissionPrompt = dynamic(
  () => import('@/components/customer/NotificationPermissionPrompt').then((m) => m.NotificationPermissionPrompt),
  { ssr: false }
);

/**
 * NotificationWrapper — Client Component shell for browser-only runtime features.
 * Mounts PWA listeners, network status banner, toast notifications,
 * and permission prompts only after client-side hydration.
 */
export function NotificationWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <PWARegister />
      <NetworkStatusBanner />
      <RealtimeNotificationToast />
      <NotificationPermissionPrompt />
    </>
  );
}

