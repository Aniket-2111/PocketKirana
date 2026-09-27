'use client';

import React, { useState, useEffect } from 'react';
import { PWARegister } from './PWARegister';
import { NetworkStatusBanner } from '@/components/states/NetworkStatusBanner';
import { RealtimeNotificationToast } from '@/components/customer/RealtimeNotificationToast';
import { NotificationPermissionPrompt } from '@/components/customer/NotificationPermissionPrompt';

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

