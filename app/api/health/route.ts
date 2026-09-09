/**
 * GET /api/health
 *
 * Production Diagnostics & Health Check Endpoint
 * Inspects:
 *   1. PostgreSQL Database connectivity, latency, and table counts
 *   2. Active Connection Pool stats
 *   3. Server uptime and environment configuration
 */

import { NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

export async function GET() {
  const start = Date.now();
  try {
    const pool = getPostgresPool();
    
    // Test PostgreSQL connectivity & query latency
    const dbRes = await pool.query(`
      SELECT 
        NOW() as server_time,
        VERSION() as version,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM products) as total_products
    `);

    const latencyMs = Date.now() - start;
    const dbStats = dbRes.rows[0];

    const healthReport = {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      latencyMs,
      environment: process.env.NODE_ENV || 'production',
      services: {
        database: {
          connected: true,
          type: 'PostgreSQL',
          host: process.env.DB_HOST || '192.168.0.101',
          port: process.env.DB_PORT || '5433',
          database: process.env.DB_NAME || 'pocketkirana_db',
          tableCount: parseInt(dbStats.table_count, 10),
          totalOrders: parseInt(dbStats.total_orders, 10),
          totalProducts: parseInt(dbStats.total_products, 10),
          dbServerTime: dbStats.server_time,
        },
        connectionPool: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        },
        firebase: {
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pocketkirana',
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'pocketkirana.firebaseapp.com',
        },
      },
    };

    return NextResponse.json(healthReport, { status: 200 });
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    console.error('[HealthCheck Error]', error.message);

    return NextResponse.json(
      {
        status: 'UNHEALTHY',
        timestamp: new Date().toISOString(),
        latencyMs,
        error: error.message,
        services: {
          database: {
            connected: false,
            host: process.env.DB_HOST || '192.168.0.101',
            port: process.env.DB_PORT || '5433',
            database: process.env.DB_NAME || 'pocketkirana_db',
          },
        },
      },
      { status: 503 }
    );
  }
}
