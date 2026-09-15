/**
 * PocketKirana — Unified PWA & Push Messaging Service Worker
 * Handles:
 *  1. PWA Asset Caching & Offline App Shell
 *  2. FCM and Web Push Background Notifications
 *  3. Notification click routing & deep linking
 *  4. Safe caching policies (no sensitive API or payment data cached)
 */

// Cache Configuration
const CACHE_NAME = 'pk-pwa-cache-v1';
const STATIC_PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/badge-72x72.png',
];

// Import Firebase Scripts for FCM Web Push
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyBMMfUjpISU3zOEGt0mvekBb9PL9znOSGc',
  authDomain: 'pocketkirana.firebaseapp.com',
  projectId: 'pocketkirana',
  storageBucket: 'pocketkirana.firebasestorage.app',
  messagingSenderId: '370391453253',
  appId: '1:370391453253:web:271f7b7724f545dc1edd2c',
};

if (firebase && firebase.apps && !firebase.apps.length) {
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (err) {
    console.warn('[SW] Firebase init warning:', err);
  }
}

// ── 1. Service Worker Lifecycle ───────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[SW] Precache non-fatal error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ── 2. Fetch Strategy: Cache-First for static assets, Network-Only for APIs ───

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests except CDNs/Fonts
  if (url.origin !== self.location.origin) {
    return;
  }

  // Strictly NETWORK-ONLY for APIs, auth, orders, and sensitive state
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/picker') ||
    url.pathname.startsWith('/delivery') ||
    url.pathname.startsWith('/profile') ||
    url.pathname.startsWith('/checkout') ||
    url.pathname.startsWith('/orders')
  ) {
    return; // Pass through to network
  }

  // Cache-first for static immutable assets
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // Network-first for navigation HTML pages
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/');
        });
      })
    );
  }
});

// ── 3. Push Notifications Handling (FCM & Standard Web Push) ──────────────────

try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] FCM Background Push received:', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || 'PocketKirana Update';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || payload.data?.message || 'New order status update',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: payload.data || {},
      tag: payload.data?.orderId || `pk_${Date.now()}`,
      requireInteraction: payload.data?.requireInteraction === 'true',
      actions: payload.data?.orderId ? [
        { action: 'view_order', title: '📦 View Order' },
        { action: 'dismiss', title: 'Dismiss' },
      ] : [],
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[SW] Firebase messaging listener init note:', err);
}

// Fallback listener for standard Web Push payloads
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || data.notification?.title || 'PocketKirana';
    const body = data.body || data.notification?.body || 'You have a new update';
    const orderId = data.orderId || data.data?.orderId;
    const deepLink = data.deepLink || data.data?.deepLink;

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { orderId, deepLink, ...data.data },
        tag: orderId || 'pk_push_alert',
        actions: orderId ? [
          { action: 'view_order', title: '📦 View Order' },
          { action: 'dismiss', title: 'Dismiss' }
        ] : [],
      })
    );
  } catch (err) {
    // Text fallback
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('PocketKirana', {
        body: text,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
      })
    );
  }
});

// ── 4. Notification Click & Deep Link Navigation ──────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const data = event.notification.data || {};
  let targetUrl = '/';

  if (event.action === 'view_order' && data.orderId) {
    targetUrl = `/orders/${data.orderId}`;
  } else if (data.deepLink) {
    targetUrl = data.deepLink;
  } else if (data.orderId) {
    targetUrl = `/orders/${data.orderId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
