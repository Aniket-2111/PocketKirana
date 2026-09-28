/**
 * PocketKirana — Centralized Operational Audit Logger
 *
 * Records sensitive administrative, inventory, order, and auth operations
 * into the PostgreSQL `audit_logs` table asynchronously.
 * Audit logging is a best-effort side effect and will never crash the request.
 */

import { getPostgresPool } from './postgres';
import { randomUUID } from 'crypto';
import { PostHogEvents } from './analytics';
import { trackServerEvent } from './analytics/serverAnalytics';

export interface AuditLogEntry {
  userId?: string;
  userRole?: string;
  action: string;
  entityType: 'ORDER' | 'PRODUCT' | 'INVENTORY' | 'AUTH' | 'PAYMENT' | 'DELIVERY' | 'SYSTEM' | 'BANNER' | 'BRAND' | 'CATEGORY' | 'OFFER' | 'COUPON';
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const pool = getPostgresPool();
    const id = randomUUID();

    await pool.query(
      `INSERT INTO audit_logs 
         (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        id,
        entry.userId || 'system',
        entry.action,
        entry.entityType,
        entry.entityId || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress || null,
      ]
    );

    // Map to PostHog admin event
    const actionLower = (entry.action || '').toLowerCase();
    let postHogEvent: string | null = null;

    if (entry.entityType === 'PRODUCT') {
      if (actionLower.includes('create') || actionLower.includes('add')) postHogEvent = PostHogEvents.PRODUCT_CREATED;
      else if (actionLower.includes('delete') || actionLower.includes('remove')) postHogEvent = PostHogEvents.PRODUCT_DELETED;
      else postHogEvent = PostHogEvents.PRODUCT_UPDATED;
    } else if (entry.entityType === 'CATEGORY') {
      if (actionLower.includes('create') || actionLower.includes('add')) postHogEvent = PostHogEvents.CATEGORY_CREATED;
      else postHogEvent = PostHogEvents.CATEGORY_UPDATED;
    } else if (entry.entityType === 'BANNER') {
      if (actionLower.includes('create') || actionLower.includes('add')) postHogEvent = PostHogEvents.BANNER_CREATED;
      else postHogEvent = PostHogEvents.BANNER_UPDATED;
    } else if (entry.entityType === 'OFFER' || entry.entityType === 'COUPON') {
      if (actionLower.includes('create') || actionLower.includes('add')) postHogEvent = PostHogEvents.OFFER_CREATED;
      else postHogEvent = PostHogEvents.OFFER_UPDATED;
    } else if (entry.entityType === 'INVENTORY') {
      postHogEvent = PostHogEvents.INVENTORY_UPDATED;
    } else if (entry.entityType === 'ORDER' && actionLower.includes('status')) {
      postHogEvent = PostHogEvents.ORDER_STATUS_UPDATED;
    } else if (entry.entityType === 'AUTH' && actionLower.includes('login') && entry.userRole === 'admin') {
      postHogEvent = PostHogEvents.ADMIN_LOGIN;
    }

    if (postHogEvent) {
      trackServerEvent(entry.userId || 'admin', postHogEvent, {
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        user_role: entry.userRole || 'admin',
        ...entry.details,
      }).catch(() => {});
    }
  } catch (err: any) {
    // Non-fatal logging failure
    console.warn(`[AuditLogger] Failed to write audit event '${entry.action}':`, err.message);
  }
}
