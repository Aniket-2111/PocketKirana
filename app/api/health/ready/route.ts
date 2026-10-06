/**
 * GET /api/health/ready
 *
 * Production Readiness Probe for PocketKirana Infrastructure
 * Checks:
 *   1. PostgreSQL Database connectivity & latency
 *   2. Firebase Auth & Firestore readiness
 *   3. PhonePe configuration status
 *   4. Cloudflare R2 object storage readiness
 *   5. Outbox Worker queue status & backlog
 *
 * Security: NEVER exposes database credentials, hostnames, passwords, or secret keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getPhonePeConfig } from '@/lib/phonepeConfig';
import { isR2Configured } from '@/lib/r2';
import { extractCorrelationId, logger, metrics } from '@/lib/observability';

export async function GET(req: NextRequest) {
  const correlationId = extractCorrelationId(req.headers);
  const startTime = Date.now();
  metrics.increment('health.readiness.probes');

  const checks: {
    postgres: { status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string };
    firebase: { status: 'healthy' | 'unhealthy'; message?: string };
    phonepe: { status: 'configured' | 'simulation' | 'missing' };
    r2: { status: 'configured' | 'unconfigured' };
    outbox: { status: 'healthy' | 'backlog_high' | 'unknown'; pendingCount?: number; oldestAgeSec?: number };
  } = {
    postgres: { status: 'unhealthy' },
    firebase: { status: 'unhealthy' },
    phonepe: { status: 'missing' },
    r2: { status: 'unconfigured' },
    outbox: { status: 'unknown' },
  };

  let allCriticalHealthy = true;

  // 1. PostgreSQL Check
  try {
    const dbStart = Date.now();
    const pool = getPostgresPool();
    const res = await pool.query(`
      SELECT 
        1 as ping,
        (SELECT COUNT(*) FROM outbox_events WHERE status = 'pending') as pending_outbox,
        COALESCE(
          (SELECT EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) FROM outbox_events WHERE status = 'pending'),
          0
        ) as oldest_pending_age_sec
    `);
    const dbDuration = Date.now() - dbStart;
    const row = res.rows[0];

    checks.postgres = {
      status: 'healthy',
      latencyMs: dbDuration,
    };

    const pendingCount = parseInt(row?.pending_outbox || '0', 10);
    const oldestAgeSec = Math.round(parseFloat(row?.oldest_pending_age_sec || '0'));

    checks.outbox = {
      status: pendingCount > 100 || oldestAgeSec > 300 ? 'backlog_high' : 'healthy',
      pendingCount,
      oldestAgeSec,
    };
  } catch (dbErr: any) {
    checks.postgres = {
      status: 'unhealthy',
      error: 'PostgreSQL connection failed',
    };
    allCriticalHealthy = false;
  }

  // 2. Firebase Check
  const fbConfigured = isFirebaseConfigured();
  checks.firebase = {
    status: fbConfigured ? 'healthy' : 'unhealthy',
    message: fbConfigured ? 'Firebase services initialized' : 'Firebase not configured',
  };
  if (!fbConfigured) {
    allCriticalHealthy = false;
  }

  // 3. PhonePe Config Check
  const phonePeConfig = getPhonePeConfig();
  if (phonePeConfig) {
    checks.phonepe = { status: 'configured' };
  } else if (process.env.PHONEPE_SIMULATION_MODE === 'true') {
    checks.phonepe = { status: 'simulation' };
  } else {
    checks.phonepe = { status: 'missing' };
  }

  // 4. Cloudflare R2 Check
  checks.r2 = {
    status: isR2Configured() ? 'configured' : 'unconfigured',
  };

  const isPostgresHealthy = checks.postgres.status === 'healthy';
  const isFirebaseHealthy = checks.firebase.status === 'healthy';
  const isCriticalHealthy = isPostgresHealthy && isFirebaseHealthy;

  const hasDegradedDependencies =
    checks.r2.status === 'unconfigured' ||
    checks.phonepe.status === 'missing' ||
    checks.outbox.status === 'backlog_high';

  let overallStatus: 'ready' | 'degraded' | 'not_ready';
  let statusCode: number;

  if (!isCriticalHealthy) {
    overallStatus = 'not_ready';
    statusCode = 503;
  } else if (hasDegradedDependencies) {
    overallStatus = 'degraded';
    statusCode = 200;
  } else {
    overallStatus = 'ready';
    statusCode = 200;
  }

  const totalDuration = Date.now() - startTime;

  logger.info('READINESS_PROBE', 'Readiness probe evaluated', {
    correlationId,
    metadata: {
      overallStatus,
      durationMs: totalDuration,
      criticalHealthy: isCriticalHealthy,
      degraded: hasDegradedDependencies,
      checks,
    },
  });

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      durationMs: totalDuration,
      checks,
    },
    {
      status: statusCode,
      headers: {
        'x-correlation-id': correlationId,
        'cache-control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
