/**
 * PocketKirana — Transactional Outbox Engine
 *
 * Implements the Transactional Outbox pattern over PostgreSQL.
 * Guarantees that business mutations (orders, inventory reservations, payments)
 * and their corresponding domain events are committed atomically inside the same ACID transaction.
 *
 * Remote side-effects (Firestore projection, FCM push notifications, WhatsApp/SMS)
 * are published asynchronously by the Outbox Worker.
 */

import { PoolClient, Pool } from 'pg';

export interface OutboxEventInput {
  aggregateType: 'order' | 'payment' | 'inventory' | 'delivery' | 'user' | 'catalog';
  aggregateId: string;
  eventType:
    | 'order.placed'
    | 'order.confirmed'
    | 'order.cancelled'
    | 'order.status_changed'
    | 'payment.initiated'
    | 'payment.confirmed'
    | 'payment.failed'
    | 'payment.unknown'
    | 'inventory.reserved'
    | 'inventory.released'
    | 'inventory.adjusted'
    | 'delivery.assigned'
    | 'delivery.picked_up'
    | 'delivery.out_for_delivery'
    | 'delivery.delivered'
    | 'catalog.product_created'
    | 'catalog.product_updated'
    | 'catalog.product_published'
    | 'catalog.product_unpublished'
    | 'catalog.product_deleted'
    | 'catalog.variant_updated'
    | 'catalog.price_updated'
    | 'catalog.version_bumped';
  payload: Record<string, any>;
  id?: string;
  maxRetries?: number;
}

export interface OutboxEventRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'LEASED' | 'PUBLISHED' | 'RETRY_SCHEDULED' | 'DEAD_LETTERED';
  retry_count: number;
  max_retries: number;
  lease_token: string | null;
  leased_until: Date | null;
  last_error: string | null;
  created_at: Date;
  published_at: Date | null;
}

/**
 * SQL DDL statement to initialize the outbox_events table and indexes.
 */
export const OUTBOX_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS outbox_events (
  id VARCHAR(64) PRIMARY KEY,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 5,
  lease_token VARCHAR(128),
  leased_until TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending 
ON outbox_events(status, leased_until) 
WHERE status IN ('PENDING', 'RETRY_SCHEDULED');

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate 
ON outbox_events(aggregate_type, aggregate_id);
`;

/**
 * Ensures the outbox_events table and required indexes exist.
 */
export async function ensureOutboxTable(poolOrClient: Pool | PoolClient): Promise<void> {
  await poolOrClient.query(OUTBOX_SCHEMA_SQL);
}

/**
 * Appends an event to the outbox_events table within the caller's active PostgreSQL transaction.
 *
 * @param client - The active transaction PoolClient
 * @param event - The event metadata and payload
 * @returns The generated event ID
 */
export async function appendOutboxEvent(
  client: PoolClient,
  event: OutboxEventInput
): Promise<string> {
  const eventId = event.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const maxRetries = event.maxRetries ?? 5;

  await client.query(
    `INSERT INTO outbox_events (
      id,
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      status,
      max_retries,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, CURRENT_TIMESTAMP)`,
    [
      eventId,
      event.aggregateType,
      event.aggregateId,
      event.eventType,
      JSON.stringify(event.payload),
      maxRetries,
    ]
  );

  return eventId;
}
