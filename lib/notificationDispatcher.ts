/**
 * PocketKirana — Centralized Notification Dispatcher
 *
 * The ONLY place in the backend that sends FCM push notifications.
 * Called server-side (from API route handlers) AFTER every PostgreSQL write
 * succeeds. Never called directly by any client app.
 *
 * Flow:
 *   API Route Handler
 *     → PostgreSQL write (transaction committed)
 *     → dispatchOrderNotification(event, orderId, recipientUid)
 *       → fetch FCM token from Firestore notificationTokens/{uid}
 *       → send via Firebase Admin SDK
 *       → write notification record to Firestore notifications/{uid}
 *
 * Architecture rule: Notifications are a side-effect, never the primary write.
 *   If FCM fails, we log it but DO NOT fail the order operation.
 *
 * SETUP:
 *   firebase-admin must be added to the main app:
 *   npm install firebase-admin
 *   Set env var: FIREBASE_SERVICE_ACCOUNT_JSON (JSON string of service account key)
 *   or GOOGLE_APPLICATION_CREDENTIALS (path to service account key file)
 */

import { COLLECTIONS } from './firestoreSchema';

// ── Lazy firebase-admin initialization ───────────────────────────────────────
// firebase-admin is a server-only package. We lazy-load it to avoid
// bundling it into client-side code.

let _adminApp: any = null;

function getAdminApp(): any {
  if (_adminApp) return _adminApp;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');

    if (admin.apps?.length > 0) {
      _adminApp = admin.apps[0];
      return _adminApp;
    }

    // Initialize from environment variable (JSON string of service account)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      _adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // ADC (Application Default Credentials)
      _adminApp = admin.initializeApp({ projectId });
    } else {
      console.warn('[NotificationDispatcher] No firebase-admin credentials configured. Notifications disabled.');
      return null;
    }

    return _adminApp;
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn(
        '[NotificationDispatcher] firebase-admin not installed. ' +
        'Run: npm install firebase-admin in the main app directory. Notifications disabled.'
      );
    } else {
      console.error('[NotificationDispatcher] firebase-admin init error:', err.message);
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export type OrderNotificationEvent =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'PAYMENT_CONFIRMED'
  | 'ORDER_ACCEPTED'
  | 'PICKING_STARTED'
  | 'PICKING_COMPLETED'
  | 'ORDER_PACKED'
  | 'DELIVERY_ASSIGNED'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'DELIVERY_ARRIVING'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'REFUND_INITIATED'
  | 'REFUND_COMPLETED'
  | 'NEW_PICKER_ORDER'
  | 'PICKER_ALERT'
  | 'NEW_DELIVERY_ASSIGNMENT'
  | 'DELIVERY_ALERT'
  | 'ADMIN_OFFER'
  | 'ADMIN_ANNOUNCEMENT'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SYSTEM_ALERT'
  // Legacy aliases
  | 'PACKED'
  | 'READY_FOR_PICKUP'
  | 'PARTNER_ASSIGNED'
  | 'PARTNER_ACCEPTED'
  | 'OUT_FOR_DELIVERY'
  | 'ARRIVING_SOON'
  | 'DELIVERED'
  | 'NEW_ORDER_ADMIN'
  | 'NEW_PICKING_TASK';

export interface NotificationPayload {
  title: string;
  body: string;
  deepLink?: string;
  sound?: string;
  priority?: 'high' | 'normal';
  channelId?: string;
  data?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TEMPLATES & BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildPayload(
  event: OrderNotificationEvent,
  context: {
    orderNumber: string;
    customerName?: string;
    totalAmount?: string;
    itemCount?: number;
    partnerName?: string;
    storeName?: string;
    distanceKm?: string;
    estimatedDeliveryTime?: string;
    offerTitle?: string;
    offerMessage?: string;
    deepLink?: string;
    customMessage?: string;
  }
): NotificationPayload {
  const {
    orderNumber,
    customerName = 'Customer',
    totalAmount = '0',
    itemCount = 1,
    partnerName = 'Express Agent',
    storeName = 'PocketKirana Hub (Neral)',
    distanceKm = '1.5',
    estimatedDeliveryTime = '15-20 mins',
    offerTitle,
    offerMessage,
    deepLink,
    customMessage,
  } = context;

  const defaultOrderLink = orderNumber ? `/orders/${orderNumber}/track` : '/orders';

  const TEMPLATES: Record<string, NotificationPayload> = {
    ORDER_PLACED: {
      title: 'Order Placed 🎉',
      body: `Your PocketKirana order #${orderNumber} has been received and is being verified.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    ORDER_CONFIRMED: {
      title: 'Order Confirmed 🎉',
      body: `Your PocketKirana order #${orderNumber} has been confirmed. Stock reserved at ${storeName}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    PAYMENT_CONFIRMED: {
      title: 'Payment Confirmed 🎉',
      body: `Your PocketKirana order #${orderNumber} has been confirmed. Stock reserved at ${storeName}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    ORDER_ACCEPTED: {
      title: 'Order Accepted 📋',
      body: `Your order #${orderNumber} has been accepted and store preparation has started.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'normal',
      sound: 'default',
    },
    PICKING_STARTED: {
      title: 'Order in Preparation 🧺',
      body: `Your order #${orderNumber} is being hand-picked with care by our store staff.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'normal',
      sound: 'default',
    },
    PICKING_COMPLETED: {
      title: 'Order Picked 📦',
      body: `All items for order #${orderNumber} have been picked and moved to the packing station.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'normal',
      sound: 'default',
    },
    ORDER_PACKED: {
      title: 'Order Packed 📦',
      body: `Your order #${orderNumber} is packed and ready for delivery.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    PACKED: {
      title: 'Order Packed 📦',
      body: `Your order #${orderNumber} is packed and ready for delivery.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    READY_FOR_PICKUP: {
      title: 'Order Ready for Pickup 📦',
      body: `Order #${orderNumber} is sealed and waiting for express rider pickup at hub.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'normal',
      sound: 'default',
    },
    DELIVERY_ASSIGNED: {
      title: 'Delivery Partner Assigned 🛵',
      body: `${partnerName} has been assigned to deliver your order #${orderNumber}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'partner_dispatch',
    },
    PARTNER_ASSIGNED: {
      title: 'Delivery Partner Assigned 🛵',
      body: `${partnerName} has been assigned to deliver your order #${orderNumber}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'partner_dispatch',
    },
    PARTNER_ACCEPTED: {
      title: 'Rider Heading to Store 🛵',
      body: `${partnerName} is heading to Store Hub to collect order #${orderNumber}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'normal',
      sound: 'default',
    },
    ORDER_OUT_FOR_DELIVERY: {
      title: 'Out for Delivery 🛵',
      body: `Your PocketKirana order #${orderNumber} is on the way. Expected in ${estimatedDeliveryTime}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    OUT_FOR_DELIVERY: {
      title: 'Out for Delivery 🛵',
      body: `Your PocketKirana order #${orderNumber} is on the way. Expected in ${estimatedDeliveryTime}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    DELIVERY_ARRIVING: {
      title: 'Delivery Arriving Soon 📍',
      body: `Your delivery partner ${partnerName} is arriving at your doorstep for order #${orderNumber}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    ARRIVING_SOON: {
      title: 'Delivery Arriving Soon 📍',
      body: `Your delivery partner ${partnerName} is arriving at your doorstep for order #${orderNumber}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    ORDER_DELIVERED: {
      title: 'Order Delivered ✅',
      body: `Your PocketKirana order #${orderNumber} has been delivered successfully. Thank you!`,
      deepLink: `/orders/${orderNumber}`,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    DELIVERED: {
      title: 'Order Delivered ✅',
      body: `Your PocketKirana order #${orderNumber} has been delivered successfully. Thank you!`,
      deepLink: `/orders/${orderNumber}`,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    ORDER_CANCELLED: {
      title: 'Order Cancelled ❌',
      body: customMessage || `Your order #${orderNumber} has been cancelled. Refund will be processed if applicable.`,
      deepLink: `/orders/${orderNumber}`,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'default',
    },
    REFUND_INITIATED: {
      title: 'Refund Initiated 💚',
      body: `Your refund of ₹${totalAmount} for order #${orderNumber} has been initiated.`,
      deepLink: `/orders/${orderNumber}`,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'default',
    },
    REFUND_COMPLETED: {
      title: 'Refund Completed ✅',
      body: `Your refund of ₹${totalAmount} for order #${orderNumber} has been successfully credited.`,
      deepLink: `/orders/${orderNumber}`,
      channelId: 'pocketkirana_orders',
      priority: 'normal',
      sound: 'default',
    },
    PAYMENT_SUCCESS: {
      title: 'Payment Successful 💳',
      body: `Payment of ₹${totalAmount} received for order #${orderNumber}.`,
      deepLink: defaultOrderLink,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'order_chime',
    },
    PAYMENT_FAILED: {
      title: 'Payment Failed ⚠',
      body: `Payment attempt for order #${orderNumber} failed. Tap to retry payment.`,
      deepLink: `/checkout?orderId=${orderNumber}`,
      channelId: 'pocketkirana_orders',
      priority: 'high',
      sound: 'default',
    },

    // ── Picker Operations ──
    NEW_PICKER_ORDER: {
      title: '🔔 New Order Received',
      body: `New order #${orderNumber} is ready for picking (${itemCount} items).`,
      deepLink: `/picking?id=${orderNumber}`,
      channelId: 'pocketkirana_picker',
      priority: 'high',
      sound: 'picker_new_order',
    },
    NEW_PICKING_TASK: {
      title: '🔔 New Picking Task',
      body: `Order #${orderNumber} — ${itemCount} items to pick.`,
      deepLink: `/picking?id=${orderNumber}`,
      channelId: 'pocketkirana_picker',
      priority: 'high',
      sound: 'picker_new_order',
    },
    PICKER_ALERT: {
      title: '⚠ Picker Alert',
      body: customMessage || `Order #${orderNumber} status changed. Please check task dashboard.`,
      deepLink: `/tasks`,
      channelId: 'pocketkirana_picker',
      priority: 'high',
      sound: 'default',
    },

    // ── Delivery Partner Operations ──
    NEW_DELIVERY_ASSIGNMENT: {
      title: '🛵 New Order to Deliver',
      body: `Order #${orderNumber} is ready for delivery (₹${totalAmount}, ~${distanceKm} km).`,
      deepLink: `/active?orderId=${orderNumber}`,
      channelId: 'pocketkirana_delivery',
      priority: 'high',
      sound: 'partner_dispatch',
    },
    DELIVERY_ALERT: {
      title: '🛵 Delivery Task Alert',
      body: customMessage || `Order #${orderNumber} task update. Please check delivery app.`,
      deepLink: `/active`,
      channelId: 'pocketkirana_delivery',
      priority: 'high',
      sound: 'partner_dispatch',
    },

    // ── Admin Offers & Announcements ──
    ADMIN_OFFER: {
      title: offerTitle || '🔥 Special Offer',
      body: offerMessage || 'Get ₹100 OFF on your next PocketKirana order!',
      deepLink: deepLink || '/home',
      channelId: 'pocketkirana_offers',
      priority: 'normal',
      sound: 'default',
    },
    ADMIN_ANNOUNCEMENT: {
      title: offerTitle || '📢 PocketKirana Announcement',
      body: offerMessage || 'Exciting new groceries and faster delivery available in Neral.',
      deepLink: deepLink || '/home',
      channelId: 'pocketkirana_offers',
      priority: 'normal',
      sound: 'default',
    },
    SYSTEM_ALERT: {
      title: offerTitle || 'PocketKirana System Alert',
      body: customMessage || offerMessage || 'Operational system update.',
      deepLink: deepLink || '/',
      channelId: 'pocketkirana_system',
      priority: 'normal',
      sound: 'default',
    },
  };

  const payload = TEMPLATES[event] || {
    title: 'PocketKirana Update',
    body: customMessage || `Update for order #${orderNumber}`,
    deepLink: defaultOrderLink,
    channelId: 'pocketkirana_orders',
    priority: 'normal',
    sound: 'default',
  };

  if (deepLink) payload.deepLink = deepLink;
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

async function getFCMTokens(firebaseUid: string): Promise<string[]> {
  try {
    const app = getAdminApp();
    if (!app) return [];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    const db  = admin.firestore(app);

    const tokenDoc = await db
      .collection(COLLECTIONS.NOTIFICATION_TOKENS)
      .doc(firebaseUid)
      .get();

    if (!tokenDoc.exists) return [];

    const data   = tokenDoc.data() ?? {};
    const tokens = data.tokens as string[] | undefined;

    if (!Array.isArray(tokens) || tokens.length === 0) return [];

    return tokens.filter(Boolean);
  } catch (err: any) {
    console.error(`[NotificationDispatcher] Failed to get FCM tokens for ${firebaseUid}:`, err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE NOTIFICATION RECORD (customer inbox)
// ─────────────────────────────────────────────────────────────────────────────

async function writeNotificationRecord(
  firebaseUid: string,
  payload: NotificationPayload,
  orderId: string,
  event: OrderNotificationEvent
): Promise<void> {
  try {
    const app = getAdminApp();
    if (!app) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    const db  = admin.firestore(app);

    await db.collection(COLLECTIONS.NOTIFICATIONS).add({
      uid: firebaseUid,
      title: payload.title,
      body: payload.body,
      event,
      orderId,
      isRead: false,
      createdAt: (require('firebase-admin').firestore as any).FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    // Non-fatal: FCM still delivered, only inbox record failed
    console.warn(`[NotificationDispatcher] Failed to write notification record:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DISPATCH FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export interface DispatchOptions {
  /** firebase_uid of the recipient */
  recipientUid: string;
  /** The business event that triggered this notification */
  event: OrderNotificationEvent;
  /** PostgreSQL order ID (for record-keeping) */
  orderId: string;
  /** Human-readable order number e.g. PK-20260829-00125 */
  orderNumber: string;
  /** Optional context for template interpolation */
  context?: {
    totalAmount?: string;
    itemCount?: number;
    partnerName?: string;
    storeName?: string;
    distanceKm?: string;
    estimatedDeliveryTime?: string;
    offerTitle?: string;
    offerMessage?: string;
    deepLink?: string;
    customMessage?: string;
    [key: string]: any;
  };
}

// In-memory idempotency deduplication set (expires after 15 seconds)
const _dispatchedEventsCache = new Map<string, number>();

function isDuplicateDispatch(dedupKey: string): boolean {
  const now = Date.now();
  const lastTime = _dispatchedEventsCache.get(dedupKey);
  if (lastTime && now - lastTime < 15000) {
    return true;
  }
  _dispatchedEventsCache.set(dedupKey, now);
  // Periodic cleanup
  if (_dispatchedEventsCache.size > 500) {
    for (const [key, time] of _dispatchedEventsCache.entries()) {
      if (now - time > 30000) _dispatchedEventsCache.delete(key);
    }
  }
  return false;
}

/**
 * Dispatch a push notification to a specific user.
 * ALWAYS call this AFTER the PostgreSQL transaction has committed.
 * Failures are logged but never thrown — notifications are best-effort.
 */
export async function dispatchNotification(opts: DispatchOptions): Promise<void> {
  const { recipientUid, event, orderId, orderNumber, context = {} } = opts;

  // Deduplication check
  const dedupKey = `${recipientUid}:${event}:${orderId}`;
  if (isDuplicateDispatch(dedupKey)) {
    console.log(`[NotificationDispatcher] Skipping duplicate event ${dedupKey}`);
    return;
  }

  try {
    const payload = buildPayload(event, { orderNumber, ...context });
    const tokens  = await getFCMTokens(recipientUid);

    if (tokens.length === 0) {
      console.log(`[NotificationDispatcher] No FCM tokens for ${recipientUid} — skipping push.`);
      // Still write inbox record if it's a customer-visible event
      await writeNotificationRecord(recipientUid, payload, orderId, event);
      return;
    }

    // ── Send FCM multicast ────────────────────────────────────────────────────
    const adminApp = getAdminApp();
    if (!adminApp) {
      console.warn('[NotificationDispatcher] Admin SDK unavailable — cannot send FCM push.');
      await writeNotificationRecord(recipientUid, payload, orderId, event);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    const messaging = admin.messaging(adminApp);

    const multicastMsg: Record<string, any> = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        orderId,
        orderNumber,
        event,
        ...Object.fromEntries(
          Object.entries(context).map(([k, v]) => [k, String(v ?? '')])
        ),
      },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#16A34A',
          priority: 'high',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const result = await messaging.sendEachForMulticast(multicastMsg);

    const succeeded = result.responses.filter((r: any) => r.success).length;
    const failed    = result.responses.filter((r: any) => !r.success).length;

    console.log(
      `[NotificationDispatcher] ${event} → ${recipientUid}: ` +
      `${succeeded}/${tokens.length} sent, ${failed} failed`
    );

    // Clean up stale tokens
    const staleTokens: string[] = [];
    result.responses.forEach((response: any, idx: number) => {
      if (!response.success) {
        const errCode = response.error?.code;
        if (errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-registration-token') {
          staleTokens.push(tokens[idx]);
        }
      }
    });

    if (staleTokens.length > 0) {
      // Remove stale tokens asynchronously — don't await
      removeStaleTokens(recipientUid, staleTokens).catch(console.warn);
    }

    // Write to notification inbox
    await writeNotificationRecord(recipientUid, payload, orderId, event);

  } catch (err: any) {
    // Notifications MUST NOT fail the business operation
    console.error(`[NotificationDispatcher] Error dispatching ${event} to ${recipientUid}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STALE TOKEN CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

async function removeStaleTokens(uid: string, staleTokens: string[]): Promise<void> {
  try {
    const app = getAdminApp();
    if (!app) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    const db  = admin.firestore(app);

    const tokenRef = db.collection(COLLECTIONS.NOTIFICATION_TOKENS).doc(uid);
    await tokenRef.update({
      tokens: admin.firestore.FieldValue.arrayRemove(...staleTokens),
    });

    console.log(`[NotificationDispatcher] Removed ${staleTokens.length} stale token(s) for ${uid}`);
  } catch (err: any) {
    console.warn(`[NotificationDispatcher] Failed to remove stale tokens:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE: ORDER STATUS → EVENT MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convenience helper: map an order status string to the appropriate
 * customer-facing notification event.
 */
export function orderStatusToEvent(status: string): OrderNotificationEvent | null {
  const MAP: Record<string, OrderNotificationEvent> = {
    CONFIRMED:          'PAYMENT_CONFIRMED',
    PICKING:            'PICKING_STARTED',
    PACKING:            'PICKING_STARTED', // customer doesn't need a separate packing event
    READY_FOR_PICKUP:   'READY_FOR_PICKUP',
    ASSIGNED:           'PARTNER_ASSIGNED',
    ACCEPTED:           'PARTNER_ACCEPTED',
    OUT_FOR_DELIVERY:   'OUT_FOR_DELIVERY',
    ARRIVED_AT_CUSTOMER:'ARRIVING_SOON',
    DELIVERED:          'DELIVERED',
    CANCELLED:          'ORDER_CANCELLED',
    REFUNDED:           'REFUND_INITIATED',
  };

  return MAP[status] ?? null;
}
