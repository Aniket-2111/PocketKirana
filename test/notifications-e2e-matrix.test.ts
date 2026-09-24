import { describe, it, expect } from 'vitest';
import {
  generateOrderLifecycleNotifications,
  isAllowedByPreferences,
  DEFAULT_PREFERENCES,
  getNotificationMeta,
} from '@/lib/notificationService';
import {
  dispatchNotification,
  mapCanonicalEvent,
  orderStatusToEvent,
} from '@/lib/notificationDispatcher';
import { Order, OrderStatus } from '@/types';

describe('PocketKirana Notification & Offer Campaign System — Comprehensive Acceptance Matrix', () => {
  const mockOrder: Order = {
    id: 'ord-test-999',
    orderNumber: 'PK-2026-999',
    customerId: 'cust-user-1',
    customerName: 'Aarav Sharma',
    customerPhone: '+919876543210',
    storeId: 'store-neral-main',
    storeName: 'PocketKirana Hub (Neral)',
    addressId: 'addr-1',
    address: {
      id: 'addr-1',
      userId: 'cust-user-1',
      addressType: 'Home',
      fullName: 'Aarav Sharma',
      phone: '+919876543210',
      addressLine1: 'Flat 402, Shivam Heights',
      area: 'Station Road',
      city: 'Neral',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '410101',
      latitude: 18.9,
      longitude: 73.3,
      isDefault: true,
    },
    items: [
      {
        id: 'item-1',
        orderId: 'ord-test-999',
        productId: 'prod-milk-1',
        product: {
          id: 'prod-milk-1',
          name: 'Amul Taaza Milk 500ml',
          sellingPrice: 32,
          mrp: 34,
          unit: '500ml',
          weight: 500,
          taxPercentage: 0,
          thumbnail: '',
          rating: 4.8,
          reviewsCount: 120,
          status: 'active',
          categoryId: 'cat-dairy',
          storeId: 'store-neral-main',
          sku: 'SKU-MILK-1',
          barcode: '8901262010053',
        } as any,
        quantity: 2,
        unitPrice: 32,
        totalPrice: 64,
        price: 32,
      },
    ],
    subtotal: 64,
    discount: 0,
    deliveryCharge: 15,
    deliveryFee: 15,
    tax: 0,
    total: 79,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    orderStatus: 'CREATED',
    placedAt: new Date().toISOString(),
    deliverySlot: '10-15 mins',
    deliveryOtp: '4829',
    partnerId: 'partner-rider-42',
    partnerName: 'Rohan (Express Rider)',
  };

  // ── A. CUSTOMER PUSH NOTIFICATIONS ──────────────────────────────────────────
  describe('A. Order Lifecycle Notification Dispatch', () => {
    it('generates customer and admin notifications when order is placed', () => {
      const notifs = generateOrderLifecycleNotifications({
        order: mockOrder,
        newStatus: 'CREATED',
      });

      expect(notifs.length).toBeGreaterThanOrEqual(2);
      const custNotif = notifs.find((n) => n.recipientType === 'customer');
      const adminNotif = notifs.find((n) => n.recipientType === 'admin');

      expect(custNotif).toBeDefined();
      expect(custNotif?.type).toBe('ORDER_PLACED');
      expect(custNotif?.message).toContain('PK-2026-999');
      expect(custNotif?.deepLink).toBeDefined();

      expect(adminNotif).toBeDefined();
      expect(adminNotif?.type).toBe('ADMIN_NEW_ORDER');
    });

    it('generates customer and rider alerts when order is packed and ready', () => {
      const notifs = generateOrderLifecycleNotifications({
        order: mockOrder,
        newStatus: 'READY_FOR_PICKUP',
        partnerName: 'Rohan',
      });

      const custNotif = notifs.find((n) => n.recipientType === 'customer');
      const partnerNotif = notifs.find((n) => n.recipientType === 'delivery_partner');

      expect(custNotif?.type).toBe('ORDER_PACKED');
      expect(partnerNotif?.type).toBe('PARTNER_PICKUP_READY');
    });

    it('generates out-for-delivery alert with rider name', () => {
      const notifs = generateOrderLifecycleNotifications({
        order: mockOrder,
        newStatus: 'OUT_FOR_DELIVERY',
        partnerName: 'Rohan',
      });

      const custNotif = notifs.find((n) => n.recipientType === 'customer');
      expect(custNotif?.type).toBe('OUT_FOR_DELIVERY');
      expect(custNotif?.message).toContain('Rohan');
    });

    it('generates delivered and settlement notification upon delivery completion', () => {
      const notifs = generateOrderLifecycleNotifications({
        order: mockOrder,
        newStatus: 'DELIVERED',
        partnerName: 'Rohan',
      });

      const custNotif = notifs.find((n) => n.recipientType === 'customer');
      const adminNotif = notifs.find((n) => n.recipientType === 'admin');
      const partnerNotif = notifs.find((n) => n.recipientType === 'delivery_partner');

      expect(custNotif?.type).toBe('ORDER_DELIVERED');
      expect(adminNotif?.type).toBe('ADMIN_PAYMENT_RECEIVED');
      expect(partnerNotif?.type).toBe('PARTNER_DELIVERY_COMPLETED');
    });
  });

  // ── B. DEEP LINKING & OFFER TO CART FLOW ────────────────────────────────────
  describe('B. Deep Linking & Canonical Event Mapping', () => {
    it('correctly maps order.placed to customer, picker, and admin events', () => {
      const mapped = mapCanonicalEvent('order.placed', { orderNumber: 'PK-101' });
      expect(mapped.customerEvent).toBe('ORDER_PLACED');
      expect(mapped.pickerEvent).toBe('NEW_PICKER_ORDER');
      expect(mapped.adminEvent).toBe('ORDER_PLACED');
    });

    it('maps order.status_changed to picker and delivery events', () => {
      const packedMap = mapCanonicalEvent('order.status_changed', { orderStatus: 'PACKED' });
      expect(packedMap.customerEvent).toBe('ORDER_PACKED');
      expect(packedMap.deliveryEvent).toBe('NEW_DELIVERY_ASSIGNMENT');

      const outMap = mapCanonicalEvent('order.status_changed', { orderStatus: 'OUT_FOR_DELIVERY' });
      expect(outMap.customerEvent).toBe('ORDER_OUT_FOR_DELIVERY');
    });

    it('maps status strings to customer notification events', () => {
      expect(orderStatusToEvent('CONFIRMED')).toBe('PAYMENT_CONFIRMED');
      expect(orderStatusToEvent('OUT_FOR_DELIVERY')).toBe('OUT_FOR_DELIVERY');
      expect(orderStatusToEvent('DELIVERED')).toBe('DELIVERED');
    });
  });

  // ── C. DEDUPLICATION & IDEMPOTENCY ──────────────────────────────────────────
  describe('C. Notification Idempotency & Deduplication', () => {
    it('skips duplicate dispatch with same eventId and recipient', async () => {
      const dispatch1 = await dispatchNotification({
        recipientUid: 'test-user-dedup-1',
        event: 'ORDER_PACKED',
        eventId: 'evt_pack_unique_123',
        orderId: 'ord-123',
        orderNumber: 'PK-123',
      });
      expect(dispatch1.sent).toBe(true);

      // Second dispatch with same eventId should be deduped
      const dispatch2 = await dispatchNotification({
        recipientUid: 'test-user-dedup-1',
        event: 'ORDER_PACKED',
        eventId: 'evt_pack_unique_123',
        orderId: 'ord-123',
        orderNumber: 'PK-123',
      });
      expect(dispatch2.sent).toBe(false);
      expect(dispatch2.deduped).toBe(true);
    });
  });

  // ── D. NOTIFICATION PREFERENCES ─────────────────────────────────────────────
  describe('D. Notification Preferences & Filtering', () => {
    it('always permits critical order milestone notifications regardless of preference', () => {
      const restrictedPrefs = {
        ...DEFAULT_PREFERENCES,
        offersDiscounts: false,
        promotionalMessages: false,
        deliveryUpdates: false,
      };

      expect(isAllowedByPreferences('ORDER_PLACED', restrictedPrefs)).toBe(true);
      expect(isAllowedByPreferences('OUT_FOR_DELIVERY', restrictedPrefs)).toBe(true);
      expect(isAllowedByPreferences('ORDER_DELIVERED', restrictedPrefs)).toBe(true);
      expect(isAllowedByPreferences('ORDER_CANCELLED', restrictedPrefs)).toBe(true);
    });

    it('suppresses marketing offers when user toggles off offersDiscounts', () => {
      const noOffersPrefs = {
        ...DEFAULT_PREFERENCES,
        offersDiscounts: false,
      };

      expect(isAllowedByPreferences('OFFER_DISCOUNT', noOffersPrefs)).toBe(false);
      expect(isAllowedByPreferences('COUPON_AVAILABLE', noOffersPrefs)).toBe(false);
      expect(isAllowedByPreferences('WALLET_CASHBACK', noOffersPrefs)).toBe(false);
    });

    it('resolves correct metadata icon and category for notification types', () => {
      const orderMeta = getNotificationMeta('ORDER_PACKED');
      expect(orderMeta.category).toBe('order');
      expect(orderMeta.defaultRecipient).toBe('customer');

      const offerMeta = getNotificationMeta('FLASH_SALE');
      expect(offerMeta.category).toBe('offer');

      const partnerMeta = getNotificationMeta('PARTNER_NEW_DELIVERY');
      expect(partnerMeta.category).toBe('delivery');
      expect(partnerMeta.defaultRecipient).toBe('delivery_partner');
    });
  });
});
