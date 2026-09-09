// PocketKirana — Firebase Messaging Service Worker
// This file must be at the root of the public directory: /firebase-messaging-sw.js
// It handles background push notifications when the app tab is not in focus.

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Firebase configuration — must match the app config
const firebaseConfig = {
  apiKey: 'AIzaSyBMMfUjpISU3zOEGt0mvekBb9PL9znOSGc',
  authDomain: 'pocketkirana.firebaseapp.com',
  projectId: 'pocketkirana',
  storageBucket: 'pocketkirana.firebasestorage.app',
  messagingSenderId: '370391453253',
  appId: '1:370391453253:web:271f7b7724f545dc1edd2c',
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background FCM message received:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'PocketKirana';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have an update.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: payload.data,
    tag: payload.data?.orderId || 'pocketkirana-notif',
    requireInteraction: payload.data?.requireInteraction === 'true',
    actions: payload.data?.orderId ? [
      { action: 'view_order', title: '📦 View Order' },
      { action: 'dismiss', title: 'Dismiss' },
    ] : [],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  if (event.action === 'view_order' && data?.orderId) {
    url = `/orders/${data.orderId}`;
  } else if (data?.deepLink) {
    url = data.deepLink;
  } else if (data?.orderId) {
    url = `/orders/${data.orderId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Service Worker lifecycle
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
