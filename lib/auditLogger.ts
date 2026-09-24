/**
 * PocketKirana — Centralized Operational Audit Logger
 *
 * Records sensitive administrative, inventory, order, and auth operations
 * into the PostgreSQL `audit_logs` table asynchronously.
 * Audit logging is a best-effort side effect and will never crash the request.
 */

import { getPostgresPool } from './postgres';
import { randomUUID } from 'crypto';

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
  } catch (err: any) {
    // Non-fatal logging failure
    console.warn(`[AuditLogger] Failed to write audit event '${entry.action}':`, err.message);
  }
}
