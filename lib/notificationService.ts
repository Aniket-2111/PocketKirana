import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  Notification,
  NotificationCategory,
  NotificationEventType,
  RecipientType,
  NotificationPreferences,
  NotificationCampaign,
  FCMDeviceToken,
  Order,
  OrderStatus
} from '@/types';
import { soundAlerts } from './audioAlerts';

const NOTIFICATIONS_COLLECTION = 'notifications';
const CAMPAIGNS_COLLECTION = 'notificationCampaigns';
const DEVICES_COLLECTION = 'userDevices';

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  orderUpdates: true,
  deliveryUpdates: true,
  offersDiscounts: true,
  newProducts: true,
  festivalOffers: true,
  promotionalMessages: false,
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  soundEnabled: true,
};

/**
 * Maps NotificationEventType to its default Category and default RecipientType.
 */
export function getNotificationMeta(type: NotificationEventType): {
  category: NotificationCategory;
  defaultRecipient: RecipientType;
  iconName: string;
} {
  switch (type) {
    // Customer Order updates
    case 'ORDER_PLACED':
    case 'ORDER_CONFIRMED':
    case 'ORDER_ACCEPTED':
    case 'ORDER_PACKED':
    case 'DELIVERY_ASSIGNED':
    case 'OUT_FOR_DELIVERY':
    case 'DELIVERY_NEARBY':
    case 'ORDER_DELIVERED':
    case 'ORDER_CANCELLED':
    case 'REFUND_INITIATED':
    case 'REFUND_COMPLETED':
      return { category: 'order', defaultRecipient: 'customer', iconName: 'ShoppingBag' };

    // Customer Offers
    case 'OFFER_DISCOUNT':
    case 'COUPON_AVAILABLE':
    case 'FLASH_SALE':
    case 'FESTIVAL_OFFER':
    case 'NEW_PRODUCT':
    case 'CATEGORY_OFFER':
    case 'FREE_DELIVERY':
    case 'WALLET_CASHBACK':
      return { category: 'offer', defaultRecipient: 'customer', iconName: 'Tag' };

    // Admin alerts
    case 'ADMIN_NEW_ORDER':
    case 'ADMIN_ORDER_CANCELLED':
    case 'ADMIN_PAYMENT_FAILED':
    case 'ADMIN_PAYMENT_RECEIVED':
    case 'ADMIN_REFUND_REQUESTED':
    case 'ADMIN_REFUND_COMPLETED':
    case 'ADMIN_LOW_STOCK':
    case 'ADMIN_OUT_OF_STOCK':
    case 'ADMIN_NEW_CUSTOMER':
    case 'ADMIN_PARTNER_OFFLINE':
    case 'ADMIN_DELIVERY_DELAYED':
    case 'ADMIN_CUSTOMER_COMPLAINT':
    case 'ADMIN_NEW_REVIEW':
    case 'ADMIN_SYSTEM_ALERT':
      return { category: 'system', defaultRecipient: 'admin', iconName: 'ShieldAlert' };

    // Delivery partner alerts
    case 'PARTNER_NEW_DELIVERY':
    case 'PARTNER_ASSIGNMENT_CANCELLED':
    case 'PARTNER_PICKUP_READY':
    case 'PARTNER_PICKUP_REMINDER':
    case 'PARTNER_CUSTOMER_NEARBY':
    case 'PARTNER_DELIVERY_COMPLETED':
    case 'PARTNER_EARNINGS_CREDITED':
    case 'PARTNER_NEW_SHIFT':
    case 'PARTNER_ADMIN_MESSAGE':
      return { category: 'delivery', defaultRecipient: 'delivery_partner', iconName: 'Truck' };

    default:
      return { category: 'system', defaultRecipient: 'customer', iconName: 'Bell' };
  }
}

/**
 * Checks if a user's notification preferences allow this notification to be delivered.
 * Critical order notifications can never be disabled completely.
 */
export function isAllowedByPreferences(
  type: NotificationEventType,
  prefs: NotificationPreferences = DEFAULT_PREFERENCES
): boolean {
  // Critical order milestones are always allowed
  const criticalTypes: NotificationEventType[] = [
    'ORDER_PLACED',
    'ORDER_CONFIRMED',
    'OUT_FOR_DELIVERY',
    'ORDER_DELIVERED',
    'ORDER_CANCELLED',
    'REFUND_INITIATED',
    'REFUND_COMPLETED',
  ];
  if (criticalTypes.includes(type)) return true;

  if (type === 'DELIVERY_ASSIGNED' || type === 'DELIVERY_NEARBY') {
    return prefs.deliveryUpdates;
  }
  if (type === 'OFFER_DISCOUNT' || type === 'COUPON_AVAILABLE' || type === 'WALLET_CASHBACK') {
    return prefs.offersDiscounts;
  }
  if (type === 'NEW_PRODUCT' || type === 'CATEGORY_OFFER') {
    return prefs.newProducts;
  }
  if (type === 'FESTIVAL_OFFER' || type === 'FLASH_SALE') {
    return prefs.festivalOffers;
  }

  return true;
}

// ==========================================
// FIRESTORE OPERATIONS
// ==========================================

export async function saveNotificationFS(
  notification: Omit<Notification, 'id'> & { id?: string }
): Promise<Notification | null> {
  const meta = getNotificationMeta(notification.type);
  const newId = notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const notifObj: Notification = {
    ...notification,
    id: newId,
    category: notification.category || meta.category,
    recipientType: notification.recipientType || meta.defaultRecipient,
    isRead: false,
    createdAt: notification.createdAt || new Date().toISOString(),
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, newId);
      await setDoc(docRef, notifObj);
    } catch (err) {
      console.warn('Could not save notification to Firestore (fallback to local):', err);
    }
  }

  return notifObj;
}

export async function fetchNotificationsFS(
  recipientType: RecipientType,
  recipientId?: string
): Promise<Notification[]> {
  if (!isFirebaseConfigured() || !db) return [];

  try {
    const notifsRef = collection(db, NOTIFICATIONS_COLLECTION);
    let q;

    if (recipientType === 'admin') {
      q = query(
        notifsRef,
        where('recipientType', '==', 'admin'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    } else if (recipientId) {
      q = query(
        notifsRef,
        where('recipientId', 'in', [recipientId, 'all']),
        where('recipientType', '==', recipientType),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    } else {
      q = query(
        notifsRef,
        where('recipientType', '==', recipientType),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }

    const snap = await getDocs(q);
    const results: Notification[] = [];
    snap.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as unknown as Notification);
    });
    return results;
  } catch (err) {
    console.warn('Error fetching Firestore notifications:', err);
    return [];
  }
}

export async function markNotificationReadFS(id: string): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
    await updateDoc(docRef, { isRead: true });
  } catch (err) {
    console.warn('Error marking notification read in Firestore:', err);
  }
}

export async function markAllNotificationsReadFS(notificationIds: string[]): Promise<void> {
  const firestore = db;
  if (!isFirebaseConfigured() || !firestore || notificationIds.length === 0) return;
  try {
    const batch = writeBatch(firestore);
    notificationIds.forEach((id) => {
      const docRef = doc(firestore, NOTIFICATIONS_COLLECTION, id);
      batch.update(docRef, { isRead: true });
    });
    await batch.commit();
  } catch (err) {
    console.warn('Error bulk marking notifications read:', err);
  }
}

export async function deleteNotificationFS(id: string): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Error deleting notification from Firestore:', err);
  }
}

// ==========================================
// CAMPAIGNS & MARKETING
// ==========================================

export async function saveCampaignFS(
  campaign: Omit<NotificationCampaign, 'id'> & { id?: string }
): Promise<NotificationCampaign | null> {
  const newId = campaign.id || `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const campObj: NotificationCampaign = {
    ...campaign,
    id: newId,
    createdAt: campaign.createdAt || new Date().toISOString(),
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, CAMPAIGNS_COLLECTION, newId);
      await setDoc(docRef, campObj);
    } catch (err) {
      console.warn('Error saving campaign to Firestore:', err);
    }
  }

  return campObj;
}

export async function fetchCampaignsFS(): Promise<NotificationCampaign[]> {
  if (!isFirebaseConfigured() || !db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, CAMPAIGNS_COLLECTION), orderBy('createdAt', 'desc'), limit(30))
    );
    const campaigns: NotificationCampaign[] = [];
    snap.forEach((docSnap) => {
      campaigns.push({ id: docSnap.id, ...docSnap.data() } as NotificationCampaign);
    });
    return campaigns;
  } catch (err) {
    console.warn('Error fetching campaigns from Firestore:', err);
    return [];
  }
}

// ==========================================
// FCM DEVICE TOKEN PERSISTENCE
// ==========================================

export async function saveFCMDeviceTokenFS(device: FCMDeviceToken): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;
  try {
    const docRef = doc(db, DEVICES_COLLECTION, device.id);
    await setDoc(docRef, device);
  } catch (err) {
    console.warn('Error saving FCM device token to Firestore:', err);
  }
}

// ==========================================
// AUTOMATED ORDER NOTIFICATION DISPATCHER
// ==========================================

export interface TriggerOrderNotificationParams {
  order: Order;
  previousStatus?: OrderStatus;
  newStatus: OrderStatus;
  partnerName?: string;
  partnerPhone?: string;
}

/**
 * Handles the complete order notification flow described in Section 8 of the requirements:
 * Triggering tailored notifications for Customer, Admin, and Delivery Partner simultaneously.
 */
export function generateOrderLifecycleNotifications(
  params: TriggerOrderNotificationParams
): Notification[] {
  const { order, newStatus, partnerName } = params;
  const orderNum = order.orderNumber || order.id;
  const generated: Notification[] = [];
  const now = new Date().toISOString();

  const statusKey = newStatus.toLowerCase();
  const normalizedStatus = 
    statusKey === 'created' ? 'placed' :
    statusKey === 'confirmed' ? 'accepted' :
    statusKey === 'ready_for_pickup' ? 'packed' :
    statusKey === 'assigned' ? 'partner_assigned' :
    statusKey;

  switch (normalizedStatus) {
    case 'placed':
      // 1. Customer: Order Placed
      generated.push({
        id: `notif_cust_${Date.now()}_1`,
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'ORDER_PLACED',
        category: 'order',
        title: '🛒 Order Placed',
        message: `Your PocketKirana order #${orderNum} has been received and is awaiting confirmation.`,
        orderId: order.id,
        deepLink: `/profile?tab=my_orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
      });

      // 2. Admin: New Order Alert
      generated.push({
        id: `notif_admin_${Date.now()}_2`,
        recipientId: 'admin',
        recipientType: 'admin',
        type: 'ADMIN_NEW_ORDER',
        category: 'order',
        title: '🔔 New Order Received',
        message: `Order #${orderNum} placed by ${order.customerName || 'Customer'} (₹${order.total} • ${order.items?.length || 1} items).`,
        orderId: order.id,
        deepLink: `/admin?tab=orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
        meta: {
          customerName: order.customerName,
          amount: order.total,
          itemsCount: order.items?.length || 1,
        },
      });
      break;

    case 'accepted':
    case 'preparing':
      // 1. Customer: Order Confirmed
      generated.push({
        id: `notif_cust_${Date.now()}_1`,
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'ORDER_CONFIRMED',
        category: 'order',
        title: '🛒 Order Confirmed',
        message: `Your PocketKirana order #${orderNum} has been confirmed and is being packed.`,
        orderId: order.id,
        deepLink: `/profile?tab=my_orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
      });
      break;

    case 'packed':
    case 'ready':
      // 1. Customer: Order Packed
      generated.push({
        id: `notif_cust_${Date.now()}_1`,
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'ORDER_PACKED',
        category: 'order',
        title: '📦 Order Packed & Ready',
        message: `Your order #${orderNum} has been neatly packed and will be dispatched soon.`,
        orderId: order.id,
        deepLink: `/profile?tab=my_orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
      });

      // 2. Delivery Partner: Pickup Ready
      if (order.partnerId) {
        generated.push({
          id: `notif_dp_${Date.now()}_2`,
          recipientId: order.partnerId,
          recipientType: 'delivery_partner',
          type: 'PARTNER_PICKUP_READY',
          category: 'delivery',
          title: '📦 Pickup Ready',
          message: `Order #${orderNum} is packed and ready for pickup at store.`,
          orderId: order.id,
          deepLink: `/delivery?orderId=${order.id}`,
          isRead: false,
          createdAt: now,
        });
      }
      break;

    case 'partner_assigned':
      // 1. Customer: Partner Assigned
      generated.push({
        id: `notif_cust_${Date.now()}_1`,
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'DELIVERY_ASSIGNED',
        category: 'delivery',
        title: '🚴 Delivery Partner Assigned',
        message: `${partnerName || 'A delivery partner'} has been assigned to deliver order #${orderNum}.`,
        orderId: order.id,
        deepLink: `/profile?tab=my_orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
      });

      // 2. Delivery Partner: New Delivery Assigned
      if (order.partnerId) {
        generated.push({
          id: `notif_dp_${Date.now()}_2`,
          recipientId: order.partnerId,
          recipientType: 'delivery_partner',
          type: 'PARTNER_NEW_DELIVERY',
          category: 'delivery',
          title: '🚴 New Delivery Assigned',
          message: `Order #${orderNum} (₹${order.total}) • Pickup: ${order.storeName || 'PocketKirana Hub'} • Drop: ${order.address?.area || 'Customer Location'}`,
          orderId: order.id,
          deepLink: `/delivery?orderId=${order.id}`,
          isRead: false,
          createdAt: now,
          meta: {
            orderId: order.id,
            distance: '2.4 km',
            payout: 45,
          },
        });
      }
      break;

    case 'out_for_delivery':
      // 1. Customer: Out for Delivery
      generated.push({
        id: `notif_cust_${Date.now()}_1`,
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'OUT_FOR_DELIVERY',
        category: 'delivery',
        title: '🚴 Out for Delivery',
        message: `Your order #${orderNum} is on the way! Delivery Partner: ${partnerName || 'Partner'}.`,
        orderId: order.id,
        deepLink: `/profile?tab=my_orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
      });
      break;

    case 'delivered':
      // 1. Customer: Order Delivered
      generated.push({
        id: `notif_cust_${Date.now()}_1`,
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'ORDER_DELIVERED',
        category: 'order',
        title: '🎉 Order Delivered',
        message: `Your order #${orderNum} has been successfully delivered. Thank you for shopping with PocketKirana!`,
        orderId: order.id,
        deepLink: `/profile?tab=my_orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
      });

      // 2. Admin: Order Completed
      generated.push({
        id: `notif_admin_${Date.now()}_2`,
        recipientId: 'admin',
        recipientType: 'admin',
        type: 'ADMIN_PAYMENT_RECEIVED',
        category: 'payment',
        title: '✅ Order Delivered & Payment Settled',
        message: `Order #${orderNum} successfully delivered by ${partnerName || 'Partner'} (₹${order.total}).`,
        orderId: order.id,
        deepLink: `/admin?tab=orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
      });

      // 3. Delivery Partner: Delivery Completed & Earnings
      if (order.partnerId) {
        generated.push({
          id: `notif_dp_${Date.now()}_3`,
          recipientId: order.partnerId,
          recipientType: 'delivery_partner',
          type: 'PARTNER_DELIVERY_COMPLETED',
          category: 'delivery',
          title: '✅ Delivery Completed',
          message: `Order #${orderNum} completed! ₹42 delivery earnings credited to your wallet.`,
          orderId: order.id,
          deepLink: `/delivery?tab=earnings`,
          isRead: false,
          createdAt: now,
        });
      }
      break;

    case 'cancelled':
      // 1. Customer: Order Cancelled & Refund
      generated.push({
        id: `notif_cust_${Date.now()}_1`,
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'ORDER_CANCELLED',
        category: 'order',
        title: '❌ Order Cancelled',
        message: `Order #${orderNum} has been cancelled. Refund of ₹${order.total} initiated to your original payment method.`,
        orderId: order.id,
        deepLink: `/profile?tab=my_orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
      });

      // 2. Admin: Cancellation Alert
      generated.push({
        id: `notif_admin_${Date.now()}_2`,
        recipientId: 'admin',
        recipientType: 'admin',
        type: 'ADMIN_ORDER_CANCELLED',
        category: 'order',
        title: '⚠️ Order Cancelled',
        message: `Order #${orderNum} cancelled for customer ${order.customerName} (₹${order.total}).`,
        orderId: order.id,
        deepLink: `/admin?tab=orders&orderId=${order.id}`,
        isRead: false,
        createdAt: now,
      });

      // 3. Delivery Partner: Assignment Cancelled
      if (order.partnerId) {
        generated.push({
          id: `notif_dp_${Date.now()}_3`,
          recipientId: order.partnerId,
          recipientType: 'delivery_partner',
          type: 'PARTNER_ASSIGNMENT_CANCELLED',
          category: 'delivery',
          title: '🚫 Delivery Cancelled',
          message: `Order #${orderNum} was cancelled. Your route has been updated.`,
          orderId: order.id,
          deepLink: `/delivery`,
          isRead: false,
          createdAt: now,
        });
      }
      break;

    default:
      break;
  }

  return generated;
}
