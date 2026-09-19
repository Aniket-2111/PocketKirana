import { Pool, QueryResult } from 'pg';

/**
 * PocketKirana Remote PostgreSQL Database Connection Pool
 * Configured to connect Developer Laptop -> Client Laptop (D:\PostgreSQL\data)
 */

const DB_HOST = process.env.DB_HOST || '192.168.0.106';
const DB_PORT = parseInt(process.env.DB_PORT || '5433', 10);
const DB_NAME = process.env.DB_NAME || 'pocketkirana_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'varbusiness';

declare global {
  // eslint-disable-next-line no-var
  var _postgresPool: Pool | undefined;
}

function getConnectionString(): string {
  const dbHost = process.env.DB_HOST || '192.168.0.106';
  const dbPort = parseInt(process.env.DB_PORT || '5433', 10);
  const dbName = process.env.DB_NAME || 'pocketkirana_db';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'varbusiness';

  return (
    process.env.DATABASE_URL ||
    `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`
  );
}

export function getPostgresPool(): Pool {
  if (!globalThis._postgresPool) {
    globalThis._postgresPool = new Pool({
      connectionString: getConnectionString(),
      max: 15,
      // 60s idle timeout — prevents silent connection drops on the LAN between requests
      idleTimeoutMillis: 60000,
      // 10s connection timeout — enough headroom for a remote LAN host
      connectionTimeoutMillis: 10000,
      // Allow pool to fully close when Node exits
      allowExitOnIdle: true,
    });

    globalThis._postgresPool.on('error', (err) => {
      console.error('⚠️ PostgreSQL Pool Error (client DB):', err.message);
      // Destroy the singleton so the next call rebuilds a fresh pool
      // instead of endlessly retrying with a dead pool.
      if (globalThis._postgresPool) {
        globalThis._postgresPool.end().catch(() => {});
        globalThis._postgresPool = undefined;
      }
    });

    // Verify each new connection is truly alive (guards against stale TCP)
    globalThis._postgresPool.on('connect', (client) => {
      client.query('SELECT 1').catch(() => {});
    });
  }
  return globalThis._postgresPool;
}

/**
 * Execute a unit of work inside a PostgreSQL transaction with automatic rollback and client release.
 * Retries up to `maxRetries` times if a transient serialization failure or deadlock occurs.
 */
export async function withTransaction<T>(
  work: (client: import('pg').PoolClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  const p = getPostgresPool();
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err: any) {
      try {
        await client.query('ROLLBACK');
      } catch (_) { }

      // Retry on 40001 (serialization_failure) or 40P01 (deadlock_detected)
      const isRetryable = err.code === '40001' || err.code === '40P01';
      if (isRetryable && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 50 + Math.random() * 50;
        console.warn(`[withTransaction] Transient lock conflict (code: ${err.code}). Retrying in ${backoffMs.toFixed(0)}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  throw new Error('Transaction failed after maximum retries');
}

/**
 * Execute a SQL query against the Client Laptop PostgreSQL DB
 */
export async function queryPostgres(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();

  const isTransientConnectionError = (err: any) => {
    const msg: string = (err?.message || '').toLowerCase();
    return (
      msg.includes('connection terminated') ||
      msg.includes('connection timeout') ||
      msg.includes('terminating connection') ||
      msg.includes('connection reset') ||
      err?.code === 'ECONNRESET' ||
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'EPIPE'
    );
  };

  let lastError: any;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const activePool = getPostgresPool();
      const res = await activePool.query(text, params);
      const duration = Date.now() - start;
      if (process.env.NODE_ENV === 'development') {
        console.log(`🐘 [Client DB Query] Executed in ${duration}ms | Rows: ${res.rowCount}`);
      }
      return res;
    } catch (error: any) {
      lastError = error;
      if (attempt < 2 && isTransientConnectionError(error)) {
        console.warn(`[queryPostgres] Transient connection error on attempt ${attempt}, retrying…`);
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }
      console.error(`❌ [Client DB Error] Query failed on ${DB_HOST}:${DB_PORT}:`, error.message);
      throw error;
    }
  }
  throw lastError;
}

/**
 * Diagnostic Healthcheck: Tests connection to Client Laptop PostgreSQL
 */
export async function checkClientPostgresConnection(): Promise<{
  connected: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  latencyMs?: number;
  dbTime?: string;
  version?: string;
  error?: string;
}> {
  const start = Date.now();
  try {
    const activePool = getPostgresPool();
    const result = await activePool.query('SELECT NOW() as db_time, VERSION() as version');
    const duration = Date.now() - start;
    return {
      connected: true,
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      latencyMs: duration,
      dbTime: result.rows[0].db_time,
      version: result.rows[0].version,
    };
  } catch (err: any) {
    return {
      connected: false,
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      error: err.message || 'Failed to connect to Client Laptop PostgreSQL',
    };
  }
}
