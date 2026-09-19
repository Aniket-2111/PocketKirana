/**
 * PocketKirana — Outbox Projection Worker Service
 *
 * Pulls pending events from the PostgreSQL outbox_events table using
 * concurrency-safe row-level leases (FOR UPDATE SKIP LOCKED), projects the state
 * changes into Firestore read collections, and triggers notifications.
 *
 * Implements exponential backoff and dead-letter queueing for poison pills.
 */

import { Pool, PoolClient } from 'pg';
import { getPostgresPool } from '../postgres';
import { OutboxEventRow } from '../db/outbox';
import { mapCanonicalEvent, dispatchNotification } from '../notificationDispatcher';

// Lazy-load Firebase Admin to avoid cold start issues
let _adminDb: any = null;
function getFirestoreDb(): any {
  if (_adminDb) return _adminDb;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    if (admin.apps?.length > 0) {
      _adminDb = admin.firestore();
      return _adminDb;
    }
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      _adminDb = app.firestore();
    } else {
      const app = admin.initializeApp({ projectId });
      _adminDb = app.firestore();
    }
    return _adminDb;
  } catch (err: any) {
    console.warn('[OutboxWorker] Firebase Admin not initialized:', err.message);
    return null;
  }
}

export interface OutboxWorkerOptions {
  batchSize?: number;
  leaseSeconds?: number;
  workerId?: string;
  pollIntervalMs?: number;
}

export class OutboxWorker {
  private pool: Pool;
  private workerId: string;
  private batchSize: number;
  private leaseSeconds: number;
  private pollIntervalMs: number;
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(options?: OutboxWorkerOptions) {
    this.pool = getPostgresPool();
    this.workerId = options?.workerId || `worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
    this.batchSize = options?.batchSize || 25;
    this.leaseSeconds = options?.leaseSeconds || 30;
    this.pollIntervalMs = options?.pollIntervalMs || 2000;
  }

  /**
   * Leases up to `batchSize` pending/retryable events from PostgreSQL atomically.
   */
  public async leaseEvents(client?: PoolClient): Promise<OutboxEventRow[]> {
    const db = client || this.pool;
    const query = `
      UPDATE outbox_events
      SET status = 'LEASED',
          lease_token = $1,
          leased_until = NOW() + ($2 || ' seconds')::INTERVAL
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE status IN ('PENDING', 'RETRY_SCHEDULED')
          AND (leased_until IS NULL OR leased_until < NOW())
        ORDER BY created_at ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    const result = await db.query(query, [this.workerId, this.leaseSeconds, this.batchSize]);
    return result.rows as OutboxEventRow[];
  }

  /**
   * Dispatches an individual outbox event to external handlers (Firestore, FCM, etc.).
   */
  public async dispatchEvent(event: OutboxEventRow): Promise<void> {
    const { aggregate_type, aggregate_id, event_type, payload } = event;

    // 1. PROJECT TO FIRESTORE
    await this.projectToFirestore(aggregate_type, aggregate_id, event_type, payload, event.id);

    // 2. DISPATCH NOTIFICATIONS / SIDE-EFFECTS
    await this.dispatchNotifications(event_type, payload, event.id);
  }

  /**
   * Projects authoritative PostgreSQL business data into Firestore read collections.
   */
  private async projectToFirestore(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, any>,
    eventId: string
  ): Promise<void> {
    try {
      const firestore = getFirestoreDb();
      if (!firestore) return;

      if (aggregateType === 'order') {
        const orderDocRef = firestore.collection('orders').doc(aggregateId);
        
        // Unidirectional idempotent projection update
        await orderDocRef.set(
          {
            ...payload,
            _last_applied_event_id: eventId,
            _last_event_type: eventType,
            _projected_at: new Date().toISOString(),
          },
          { merge: true }
        );

        // Also mirror stock reservation if present in payload
        if (payload.reservationItems && Array.isArray(payload.reservationItems)) {
          const resDocRef = firestore.collection('stockReservations').doc(aggregateId);
          await resDocRef.set(
            {
              orderId: aggregateId,
              items: payload.reservationItems,
              status: payload.orderStatus === 'CANCELLED' ? 'released' : 'reserved',
              updatedAt: new Date().toISOString(),
              _last_applied_event_id: eventId,
            },
            { merge: true }
          );
        }
      } else if (aggregateType === 'payment') {
        const paymentDocRef = firestore.collection('payments').doc(aggregateId);
        await paymentDocRef.set(
          {
            ...payload,
            _last_applied_event_id: eventId,
            _projected_at: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch (err: any) {
      console.warn(`[OutboxWorker] Firestore projection warning for ${aggregateId}:`, err.message);
      // Re-throw so worker handles retries
      throw err;
    }
  }

  /**
   * Dispatches push notifications / alerts to Customer, Picker, Delivery, and Admin.
   */
  private async dispatchNotifications(
    eventType: string,
    payload: Record<string, any>,
    eventId?: string
  ): Promise<void> {
    try {
      const mappedEvents = mapCanonicalEvent(eventType, payload);
      const orderId = payload.id || payload.orderId || '';
      const orderNumber = payload.orderNumber || orderId;
      const customerId = payload.customerId || payload.userId;
      const pickerId = payload.pickerId || payload.assignedPickerId;
      const deliveryPartnerId = payload.deliveryPartnerId || payload.partnerId || payload.riderId;
      const adminId = payload.adminId || 'admin_user';

      const context = {
        totalAmount: payload.total != null ? String(payload.total) : undefined,
        itemCount: Array.isArray(payload.items) ? payload.items.length : undefined,
        partnerName: payload.partnerName || payload.riderName || 'Express Partner',
        storeName: payload.storeName || 'PocketKirana Hub',
        distanceKm: payload.distanceKm != null ? String(payload.distanceKm) : undefined,
        estimatedDeliveryTime: payload.estimatedDeliveryTime || '15-20 mins',
        deepLink: payload.deepLink,
        customMessage: payload.customMessage,
      };

      // 1. Customer Notification
      if (mappedEvents.customerEvent && customerId) {
        await dispatchNotification({
          recipientUid: customerId,
          recipientType: 'customer',
          event: mappedEvents.customerEvent,
          eventId,
          orderId,
          orderNumber,
          context,
        });
      }

      // 2. Picker Notification
      if (mappedEvents.pickerEvent) {
        const pickerRecipient = pickerId || 'picker_pool';
        await dispatchNotification({
          recipientUid: pickerRecipient,
          recipientType: 'picker',
          event: mappedEvents.pickerEvent,
          eventId,
          orderId,
          orderNumber,
          context,
        });
      }

      // 3. Delivery Notification
      if (mappedEvents.deliveryEvent) {
        const deliveryRecipient = deliveryPartnerId || 'delivery_pool';
        await dispatchNotification({
          recipientUid: deliveryRecipient,
          recipientType: 'delivery',
          event: mappedEvents.deliveryEvent,
          eventId,
          orderId,
          orderNumber,
          context,
        });
      }

      // 4. Admin Notification
      if (mappedEvents.adminEvent) {
        await dispatchNotification({
          recipientUid: adminId,
          recipientType: 'admin',
          event: mappedEvents.adminEvent,
          eventId,
          orderId,
          orderNumber,
          context,
        });
      }
    } catch (err: any) {
      console.warn('[OutboxWorker] Notification dispatch notice:', err.message);
      // Non-fatal for core outbox progression
    }
  }

  /**
   * Marks an event as successfully published with lease-token fencing.
   * Throws LEASE_LOST if another worker claimed the event after lease expiry.
   */
  public async markPublished(eventId: string, leaseToken?: string, client?: PoolClient): Promise<boolean> {
    const db = client || this.pool;
    const token = leaseToken || this.workerId;

    const res = await db.query(
      `UPDATE outbox_events
       SET status = 'PUBLISHED',
           published_at = CURRENT_TIMESTAMP,
           lease_token = NULL,
           leased_until = NULL,
           last_error = NULL
       WHERE id = $1
         AND lease_token = $2
         AND status = 'LEASED'`,
      [eventId, token]
    );

    if (res.rowCount === 0) {
      console.warn(`⚠️ [OutboxWorker] Lease lost for event ${eventId} (worker: ${token}). Abandoning state update.`);
      return false;
    }
    return true;
  }

  /**
   * Handles retry scheduling or dead-lettering on failure with lease-token fencing.
   */
  public async handleFailure(
    event: OutboxEventRow,
    error: Error,
    leaseToken?: string,
    client?: PoolClient
  ): Promise<boolean> {
    const db = client || this.pool;
    const token = leaseToken || event.lease_token || this.workerId;
    const nextRetry = event.retry_count + 1;
    const isDeadLetter = nextRetry >= event.max_retries;
    const backoffSeconds = Math.min(300, Math.pow(nextRetry, 2) * 5); // 5s, 20s, 45s, 80s, max 300s

    const res = await db.query(
      `UPDATE outbox_events
       SET status = $1,
           retry_count = $2,
           leased_until = CURRENT_TIMESTAMP + ($3 || ' seconds')::INTERVAL,
           lease_token = NULL,
           last_error = $4
       WHERE id = $5
         AND lease_token = $6
         AND status = 'LEASED'`,
      [
        isDeadLetter ? 'DEAD_LETTERED' : 'RETRY_SCHEDULED',
        nextRetry,
        backoffSeconds,
        error.message.substring(0, 1000),
        event.id,
        token,
      ]
    );

    if (res.rowCount === 0) {
      console.warn(`⚠️ [OutboxWorker] Lease lost during failure handling for event ${event.id}.`);
      return false;
    }

    if (isDeadLetter) {
      console.error(`🚨 [OutboxWorker] Event ${event.id} DEAD_LETTERED after ${event.max_retries} attempts:`, error.message);
    }
    return true;
  }

  /**
   * Runs a single polling cycle.
   */
  public async runOnce(): Promise<number> {
    try {
      const events = await this.leaseEvents();
      if (events.length === 0) return 0;

      for (const event of events) {
        try {
          await this.dispatchEvent(event);
          await this.markPublished(event.id, this.workerId);
        } catch (err: any) {
          await this.handleFailure(event, err, this.workerId);
        }
      }

      return events.length;
    } catch (err: any) {
      // PostgreSQL might be disconnected or unreachable
      return 0;
    }
  }

  /**
   * Starts the background processing loop.
   */
  public start(pollIntervalMs: number = this.pollIntervalMs): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = async () => {
      if (!this.isRunning) return;
      await this.runOnce();
      if (this.isRunning) {
        this.intervalTimer = setTimeout(poll, pollIntervalMs);
      }
    };

    poll();
  }

  /**
   * Stops the background worker loop cleanly.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.intervalTimer) {
      clearTimeout(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
