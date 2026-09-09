import { Pool, QueryResult } from 'pg';

/**
 * PocketKirana Remote PostgreSQL Database Connection Pool
 * Configured to connect Developer Laptop -> Client Laptop (D:\PostgreSQL\data)
 */

const DB_HOST = process.env.DB_HOST || '192.168.0.102';
const DB_PORT = parseInt(process.env.DB_PORT || '5433', 10);
const DB_NAME = process.env.DB_NAME || 'pocketkirana_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'varbusiness';

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 25,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('⚠️ Unexpected PostgreSQL Pool Error on Client DB:', err.message);
    });
  }
  return pool;
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
      } catch (_) {}

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
  const activePool = getPostgresPool();
  const start = Date.now();
  try {
    const res = await activePool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`🐘 [Client DB Query] Executed in ${duration}ms | Rows: ${res.rowCount}`);
    }
    return res;
  } catch (error: any) {
    console.error(`❌ [Client DB Error] Query failed on ${DB_HOST}:${DB_PORT}:`, error.message);
    throw error;
  }
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
