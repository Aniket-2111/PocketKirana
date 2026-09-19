/**
 * GET /api/health
 *
 * Production Diagnostics & Health Check Endpoint
 * Supports:
 *   1. Liveness Probe (Default): Fast, lightweight check for API uptime.
 *   2. Deep Readiness Probe (?deep=true): Verifies PostgreSQL, Outbox backlog, and Firebase.
 *
 * Security: NEVER exposes database credentials, hostnames, passwords, or secret keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { isFirebaseConfigured } from '@/lib/firebase';
import { extractCorrelationId, logger, metrics } from '@/lib/observability';

export async function GET(req: NextRequest) {
  const correlationId = extractCorrelationId(req.headers);
  const { searchParams } = new URL(req.url);
  const isDeepCheck = searchParams.get('deep') === 'true';

  // 1. FAST LIVENESS PROBE (Default)
  if (!isDeepCheck) {
    metrics.increment('health.liveness.probes');
    return NextResponse.json(
      {
        status: 'ok',
        service: 'pocketkirana-api',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'x-correlation-id': correlationId,
          'cache-control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }

  // 2. DEEP READINESS PROBE (?deep=true)
  const startTime = Date.now();
  metrics.increment('health.deep.probes');

  let dbStatus: 'ok' | 'degraded' | 'unavailable' = 'ok';
  let outboxStatus: 'ok' | 'degraded' | 'backlog_high' = 'ok';
  let oldestPendingAgeSec = 0;
  let pendingOutboxCount = 0;
  let poolSaturation = 0;
  let dbLatencyMs = 0;

  // PostgreSQL Check
  try {
    const dbStart = Date.now();
    const pool = getPostgresPool();
    const dbRes = await pool.query(`
      SELECT 
        1 as ping,
        (SELECT COUNT(*) FROM outbox_events WHERE status IN ('PENDING', 'RETRY_SCHEDULED')) as pending_outbox,
        (SELECT EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) FROM outbox_events WHERE status = 'PENDING') as oldest_pending_age
    `);
    dbLatencyMs = Date.now() - dbStart;

    const row = dbRes.rows[0];
    pendingOutboxCount = parseInt(row.pending_outbox || '0', 10);
    oldestPendingAgeSec = parseFloat(row.oldest_pending_age || '0');

    if (pool.totalCount > 0) {
      poolSaturation = Math.round((pool.waitingCount / pool.totalCount) * 100);
    }

    if (oldestPendingAgeSec > 60) {
      outboxStatus = 'degraded';
      metrics.increment('outbox.stale_pending_alert');
    } else if (pendingOutboxCount > 100) {
      outboxStatus = 'backlog_high';
    }

    if (dbLatencyMs > 2000 || poolSaturation > 80) {
      dbStatus = 'degraded';
    }
  } catch (err: any) {
    dbStatus = 'unavailable';
    logger.error('health_db_failure', 'Database health check failed', err, { correlationId });
  }

  // Firebase Configuration Check
  const firebaseStatus = isFirebaseConfigured() ? 'ok' : 'unconfigured';

  // Determine overall status
  let overallStatus: 'ok' | 'degraded' | 'unhealthy' = 'ok';
  if (dbStatus === 'unavailable') {
    overallStatus = 'unhealthy';
  } else if (
    dbStatus === 'degraded' ||
    outboxStatus === 'degraded' ||
    (firebaseStatus === 'unconfigured' && process.env.NODE_ENV === 'production')
  ) {
    overallStatus = 'degraded';
  }

  const responseBody = {
    status: overallStatus,
    service: 'pocketkirana-api',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        poolSaturationPercent: poolSaturation,
      },
      outbox: {
        status: outboxStatus,
        pendingEventsCount: pendingOutboxCount,
        oldestPendingAgeSeconds: Math.round(oldestPendingAgeSec),
      },
      firebase: {
        status: firebaseStatus,
      },
    },
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(responseBody, {
    status: httpStatus,
    headers: {
      'x-correlation-id': correlationId,
      'cache-control': 'no-cache, no-store, must-revalidate',
    },
  });
}
