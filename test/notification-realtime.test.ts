import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapCanonicalEvent, dispatchNotification } from '../lib/notificationDispatcher';
import { OutboxWorker } from '../lib/services/outboxWorker';
import { soundAlerts } from '../lib/audioAlerts';

// Mock dependencies
vi.mock('../lib/postgres', () => {
  const executedQueries: any[] = [];
  return {
    queryPostgres: vi.fn(async (sql: string, params?: any[]) => {
      executedQueries.push({ sql, params });
      if (sql.includes('SELECT') && sql.includes('notification_preferences')) {
        return {
          rowCount: 1,
          rows: [
            {
              order_updates: true,
              promotional_offers: true,
              delivery_alerts: true,
              sound_enabled: true,
              vibration_enabled: true,
            },
          ],
        };
      }
      if (sql.includes('SELECT') && sql.includes('notifications')) {
        return {
          rowCount: 2,
          rows: [
            {
              id: 'notif_1',
              event_id: 'evt_1',
              order_id: 'ord_1',
              firebase_uid: 'cust_1',
              recipient_type: 'customer',
              notification_type: 'ORDER_PLACED',
              title: 'Order Placed 🎉',
              message: 'Your order #PK-001 has been received',
              is_read: false,
              created_at: new Date().toISOString(),
            },
            {
              id: 'notif_2',
              event_id: 'evt_2',
              order_id: 'ord_1',
              firebase_uid: 'cust_1',
              recipient_type: 'customer',
              notification_type: 'ORDER_CONFIRMED',
              title: 'Order Confirmed 🎉',
              message: 'Your order #PK-001 has been confirmed',
              is_read: true,
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rowCount: 1, rows: [{ id: 'mock_id', unread_count: '1' }] };
    }),
    getPostgresPool: vi.fn(() => ({
      query: vi.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('UPDATE outbox_events') && sql.includes('LEASED')) {
          return {
            rows: [
              {
                id: 'evt_test_1',
                aggregate_type: 'order',
                aggregate_id: 'order_test_1',
                event_type: 'order.placed',
                payload: {
                  id: 'order_test_1',
                  orderNumber: 'PK-20260829-001',
                  customerId: 'cust_123',
                  total: 450,
                  items: [{ id: 'item_1', name: 'Tata Tea', qty: 2 }],
                },
                status: 'LEASED',
                retry_count: 0,
                max_retries: 5,
              },
            ],
          };
        }
        return { rowCount: 1, rows: [] };
      }),
    })),
  };
});

describe('Phase 11 — Notifications & Realtime Projection Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('11.1 & 11.2 Canonical Event Mapping', () => {
    it('maps order.placed to Customer, Picker, and Admin', () => {
      const mapped = mapCanonicalEvent('order.placed', { orderNumber: 'PK-101' });
      expect(mapped.customerEvent).toBe('ORDER_PLACED');
      expect(mapped.pickerEvent).toBe('NEW_PICKER_ORDER');
      expect(mapped.adminEvent).toBe('ORDER_PLACED');
      expect(mapped.deliveryEvent).toBeUndefined();
    });

    it('maps order.confirmed to Customer, Picker, and Admin', () => {
      const mapped = mapCanonicalEvent('order.confirmed', { orderNumber: 'PK-102' });
      expect(mapped.customerEvent).toBe('ORDER_CONFIRMED');
      expect(mapped.pickerEvent).toBe('NEW_PICKER_ORDER');
      expect(mapped.adminEvent).toBe('ORDER_CONFIRMED');
    });

    it('maps order.picking_started to Customer and Picker', () => {
      const mapped = mapCanonicalEvent('order.picking_started', {});
      expect(mapped.customerEvent).toBe('PICKING_STARTED');
      expect(mapped.pickerEvent).toBe('PICKER_ALERT');
    });

    it('maps order.packed to Customer and Delivery Partner', () => {
      const mapped = mapCanonicalEvent('order.packed', {});
      expect(mapped.customerEvent).toBe('ORDER_PACKED');
      expect(mapped.deliveryEvent).toBe('NEW_DELIVERY_ASSIGNMENT');
      expect(mapped.pickerEvent).toBeUndefined();
    });

    it('maps delivery.assigned to Customer and Delivery Partner', () => {
      const mapped = mapCanonicalEvent('delivery.assigned', {});
      expect(mapped.customerEvent).toBe('DELIVERY_ASSIGNED');
      expect(mapped.deliveryEvent).toBe('NEW_DELIVERY_ASSIGNMENT');
    });

    it('maps delivery.picked_up and order.out_for_delivery to Customer and Admin', () => {
      const mapped = mapCanonicalEvent('order.out_for_delivery', {});
      expect(mapped.customerEvent).toBe('ORDER_OUT_FOR_DELIVERY');
      expect(mapped.adminEvent).toBe('ORDER_OUT_FOR_DELIVERY');
      expect(mapped.deliveryEvent).toBeUndefined();
    });

    it('maps order.delivered to Customer and Admin', () => {
      const mapped = mapCanonicalEvent('order.delivered', {});
      expect(mapped.customerEvent).toBe('ORDER_DELIVERED');
      expect(mapped.adminEvent).toBe('ORDER_DELIVERED');
    });

    it('maps payment.confirmed and payment.failed', () => {
      const successMap = mapCanonicalEvent('payment.confirmed', {});
      expect(successMap.customerEvent).toBe('PAYMENT_SUCCESS');
      expect(successMap.adminEvent).toBe('PAYMENT_SUCCESS');

      const failMap = mapCanonicalEvent('payment.failed', {});
      expect(failMap.customerEvent).toBe('PAYMENT_FAILED');
      expect(failMap.adminEvent).toBe('PAYMENT_FAILED');
    });

    it('maps status_changed transitions accurately', () => {
      expect(mapCanonicalEvent('order.status_changed', { targetStatus: 'CONFIRMED' }).customerEvent).toBe('ORDER_CONFIRMED');
      expect(mapCanonicalEvent('order.status_changed', { targetStatus: 'PICKING' }).customerEvent).toBe('PICKING_STARTED');
      expect(mapCanonicalEvent('order.status_changed', { targetStatus: 'PACKED' }).deliveryEvent).toBe('NEW_DELIVERY_ASSIGNMENT');
      expect(mapCanonicalEvent('order.status_changed', { targetStatus: 'DELIVERED' }).customerEvent).toBe('ORDER_DELIVERED');
    });
  });

  describe('11.3 & 11.4 Notification Idempotency', () => {
    it('dispatches notification on first attempt', async () => {
      const res = await dispatchNotification({
        recipientUid: 'cust_unique_1',
        recipientType: 'customer',
        event: 'ORDER_PLACED',
        eventId: 'evt_idempotency_1',
        orderId: 'ord_idem_1',
        orderNumber: 'PK-IDEM-001',
      });
      expect(res.sent).toBe(true);
      expect(res.deduped).toBeFalsy();
    });

    it('skips duplicate dispatch on retry for the same event and recipient', async () => {
      const eventId = `evt_dedup_${Date.now()}`;
      const first = await dispatchNotification({
        recipientUid: 'cust_dedup_test',
        recipientType: 'customer',
        event: 'ORDER_CONFIRMED',
        eventId,
        orderId: 'ord_dedup_1',
        orderNumber: 'PK-DEDUP-001',
      });
      expect(first.sent).toBe(true);

      // Immediate retry of identical event
      const second = await dispatchNotification({
        recipientUid: 'cust_dedup_test',
        recipientType: 'customer',
        event: 'ORDER_CONFIRMED',
        eventId,
        orderId: 'ord_dedup_1',
        orderNumber: 'PK-DEDUP-001',
      });
      expect(second.sent).toBe(false);
      expect(second.deduped).toBe(true);
    });
  });

  describe('11.5–11.7 Role-specific Routing (Customer, Picker, Delivery, Admin)', () => {
    it('sends order notification with custom context', async () => {
      const res = await dispatchNotification({
        recipientUid: 'picker_user_1',
        recipientType: 'picker',
        event: 'NEW_PICKER_ORDER',
        orderId: 'ord_pick_1',
        orderNumber: 'PK-PICK-001',
        context: {
          itemCount: 4,
          storeName: 'Neral Main Hub',
        },
      });
      expect(res.sent).toBe(true);
    });

    it('sends delivery partner dispatch notification with distance and fee', async () => {
      const res = await dispatchNotification({
        recipientUid: 'rider_user_1',
        recipientType: 'delivery',
        event: 'NEW_DELIVERY_ASSIGNMENT',
        orderId: 'ord_deliv_1',
        orderNumber: 'PK-DELIV-001',
        context: {
          totalAmount: '350',
          distanceKm: '2.1',
          partnerName: 'Ramesh Rider',
        },
      });
      expect(res.sent).toBe(true);
    });
  });

  describe('11.10 Audio Alerts Engine', () => {
    it('exposes audio synthesized tones for customer, picker, partner, admin', () => {
      expect(typeof soundAlerts.playOrderChime).toBe('function');
      expect(typeof soundAlerts.playPromoChime).toBe('function');
      expect(typeof soundAlerts.playAdminAlert).toBe('function');
      expect(typeof soundAlerts.playPartnerDispatch).toBe('function');
      expect(typeof soundAlerts.playByNotification).toBe('function');
    });

    it('routes sounds safely without throwing in server/test environments', () => {
      expect(() => soundAlerts.playByNotification('ORDER_PLACED', 'customer')).not.toThrow();
      expect(() => soundAlerts.playByNotification('NEW_PICKER_ORDER', 'picker')).not.toThrow();
      expect(() => soundAlerts.playByNotification('NEW_DELIVERY_ASSIGNMENT', 'delivery_partner')).not.toThrow();
      expect(() => soundAlerts.playByNotification('ALERT', 'admin')).not.toThrow();
    });
  });

  describe('11.13 Notification Failure Isolation', () => {
    it('notification failure does not throw or crash caller', async () => {
      // Intentionally pass invalid recipient parameters
      const result = await dispatchNotification({
        recipientUid: '',
        event: 'SYSTEM_ALERT',
        orderId: 'ord_none',
        orderNumber: 'PK-NONE',
      });
      expect(result).toBeDefined();
    });

    it('OutboxWorker processes events and updates status without failing on missing FCM config', async () => {
      const worker = new OutboxWorker({ batchSize: 5 });
      const leased = await worker.leaseEvents();
      expect(leased.length).toBeGreaterThan(0);

      // Dispatching event must complete without crashing
      await expect(worker.dispatchEvent(leased[0])).resolves.not.toThrow();
    });
  });
});
