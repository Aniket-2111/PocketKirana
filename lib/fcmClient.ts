'use client';

import { getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { isFirebaseConfigured } from './firebase';
import { FCMDeviceToken, UserRole } from '@/types';
import { soundAlerts } from './audioAlerts';

// FCM VAPID Key (Public Web Push Key) - Can be set via env NEXT_PUBLIC_FIREBASE_VAPID_KEY
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BElgL8V_qf-98_Pk_YourDefaultMockVapidKeyHereIfConfigured';

let messagingInstance: Messaging | null = null;

export function getClientMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('Push notifications or Service Workers not supported in this browser.');
    return null;
  }
  if (!isFirebaseConfigured()) return null;

  try {
    if (!messagingInstance && getApps().length > 0) {
      messagingInstance = getMessaging();
    }
    return messagingInstance;
  } catch (error) {
    console.warn('FCM Messaging client init error:', error);
    return null;
  }
}

export interface RequestFCMResult {
  token: string | null;
  permission: NotificationPermission;
  error?: string;
}

/**
 * Requests browser notification permission and retrieves an FCM registration token.
 */
export async function requestFCMNotificationPermission(
  userId: string,
  userRole: UserRole = 'customer'
): Promise<RequestFCMResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { token: null, permission: 'denied', error: 'Notifications not supported' };
  }

  try {
    // Check or request browser permission
    let permission: NotificationPermission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return { token: null, permission, error: 'User dismissed or blocked notifications' };
    }

    // Register service worker if available
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch (swErr) {
        console.warn('SW registration warning:', swErr);
      }
    }

    const messaging = getClientMessaging();
    let token: string | null = null;

    if (messaging && isFirebaseConfigured()) {
      try {
        token = await getToken(messaging, {
          vapidKey: VAPID_KEY.startsWith('BElgL8V') ? undefined : VAPID_KEY,
          serviceWorkerRegistration: swRegistration,
        });
      } catch (tokenErr: any) {
        console.warn('Real FCM token fetch note (using generated device token):', tokenErr?.message);
      }
    }

    // Fallback/Synthetic device token for local testing & simulated push
    if (!token) {
      token = `pk_fcm_${userRole}_${userId.slice(0, 8)}_${Math.random().toString(36).substring(2, 10)}`;
    }

    // Store in LocalStorage for fast rehydration
    localStorage.setItem(`fcm_token_${userId}`, token);
    localStorage.setItem('pk_notifications_enabled', 'true');

    // Persist to Firestore so Cloud Functions can send push to this device
    if (userId && !token.startsWith('pk_fcm_')) {
      // Real FCM token — save to Firestore
      import('./userService').then(({ saveFcmToken }) => {
        saveFcmToken(userId, token!, 'web').catch(console.warn);
      });
    }

    return { token, permission: 'granted' };
  } catch (err: any) {
    console.error('Error requesting FCM permission:', err);
    return { token: null, permission: 'denied', error: err?.message };
  }
}

/**
 * Listen for foreground push notifications from FCM.
 */
export function setupFCMForegroundListener(
  onReceive: (payload: { title: string; body: string; data?: any }) => void
): () => void {
  const messaging = getClientMessaging();
  if (!messaging) return () => {};

  try {
    const unsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'PocketKirana Update';
      const body = payload.notification?.body || payload.data?.message || 'New order update';

      // Play synthesized audio
      soundAlerts.playOrderChime();

      // Show native browser notification if in foreground and tab is hidden
      if (document.hidden && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          data: payload.data,
        });
      }

      onReceive({ title, body, data: payload.data });
    });

    return unsubscribe;
  } catch (err) {
    console.warn('Foreground message listener error:', err);
    return () => {};
  }
}
