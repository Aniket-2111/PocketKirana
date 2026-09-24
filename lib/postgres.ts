import { Pool, QueryResult, PoolClient } from 'pg';

/**
 * PocketKirana Production-Hardened PostgreSQL Database Connection Pool
 * Features:
 * - Runtime singleton lifecycle management (guards against HMR pool leaks in development)
 * - Safe bounded connection/query/statement timeouts
 * - Structured pool health metrics and diagnostics
 * - Sanitized logging (zero credential / token leakage)
 */

const DB_HOST = process.env.DB_HOST || '192.168.0.106';
const DB_PORT = parseInt(process.env.DB_PORT || '5433', 10);
const DB_NAME = process.env.DB_NAME || 'pocketkirana_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'varbusiness';

const PG_MAX_POOL_SIZE = parseInt(process.env.PG_MAX_POOL_SIZE || '20', 10);
const PG_IDLE_TIMEOUT_MS = parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10);
const PG_CONNECTION_TIMEOUT_MS = parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || '5000', 10);
const PG_STATEMENT_TIMEOUT_MS = parseInt(process.env.PG_STATEMENT_TIMEOUT_MS || '4000', 10);
const PG_QUERY_TIMEOUT_MS = parseInt(process.env.PG_QUERY_TIMEOUT_MS || '4500', 10);

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

/**
 * Categorize database errors for structured diagnostics without exposing secrets.
 */
export function categorizeDbError(err: any): {
  category:
    | 'CONNECTION_TIMEOUT'
    | 'QUERY_TIMEOUT'
    | 'CONNECTION_TERMINATED'
    | 'UNAVAILABLE'
    | 'DEADLOCK'
    | 'INVALID_SQL'
    | 'UNKNOWN';
  message: string;
} {
  const rawMsg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '');

  // Strip any accidental connection strings or password patterns
  const sanitizedMsg = String(err?.message || 'Database error')
    .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***:***@')
    .replace(/password=[^\s;]+/gi, 'password=***');

  if (rawMsg.includes('connection timeout') || rawMsg.includes('timeout expired') || code === 'ETIMEDOUT') {
    return { category: 'CONNECTION_TIMEOUT', message: sanitizedMsg };
  }
  if (
    rawMsg.includes('statement timeout') ||
    rawMsg.includes('query_timeout') ||
    rawMsg.includes('canceling statement due to statement timeout') ||
    code === '57014'
  ) {
    return { category: 'QUERY_TIMEOUT', message: sanitizedMsg };
  }
  if (
    rawMsg.includes('connection terminated') ||
    rawMsg.includes('terminating connection') ||
    rawMsg.includes('connection reset') ||
    code === 'ECONNRESET' ||
    code === 'EPIPE'
  ) {
    return { category: 'CONNECTION_TERMINATED', message: sanitizedMsg };
  }
  if (
    rawMsg.includes('connect econnrefused') ||
    rawMsg.includes('getaddrinfo enotfound') ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND'
  ) {
    return { category: 'UNAVAILABLE', message: sanitizedMsg };
  }
  if (code === '40P01' || code === '40001' || rawMsg.includes('deadlock')) {
    return { category: 'DEADLOCK', message: sanitizedMsg };
  }
  if (code.startsWith('42') || rawMsg.includes('syntax error')) {
    return { category: 'INVALID_SQL', message: sanitizedMsg };
  }

  return { category: 'UNKNOWN', message: sanitizedMsg };
}

/**
 * Returns active pool connection counts for observability
 */
export function getPostgresPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} {
  const p = globalThis._postgresPool;
  return {
    totalCount: p?.totalCount ?? 0,
    idleCount: p?.idleCount ?? 0,
    waitingCount: p?.waitingCount ?? 0,
  };
}

/**
 * Returns singleton PostgreSQL Pool across HMR reloads
 */
export function getPostgresPool(): Pool {
  if (!globalThis._postgresPool) {
    globalThis._postgresPool = new Pool({
      connectionString: getConnectionString(),
      max: PG_MAX_POOL_SIZE,
      idleTimeoutMillis: PG_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS,
      statement_timeout: PG_STATEMENT_TIMEOUT_MS,
      query_timeout: PG_QUERY_TIMEOUT_MS,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      allowExitOnIdle: true,
    });

    globalThis._postgresPool.on('error', (err) => {
      const { category, message } = categorizeDbError(err);
      console.error(`⚠️ [PostgreSQL Pool Error] [${category}]:`, message);
      // Cleanly teardown so subsequent calls rebuild rather than stall
      if (globalThis._postgresPool) {
        globalThis._postgresPool.end().catch(() => {});
        globalThis._postgresPool = undefined;
      }
    });

    // Guard against stale TCP sockets
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
  work: (client: PoolClient) => Promise<T>,
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
        console.warn(
          `[withTransaction] Transient lock conflict (code: ${err.code}). Retrying in ${backoffMs.toFixed(0)}ms (attempt ${attempt}/${maxRetries})...`
        );
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
 * Execute a SQL query against PostgreSQL with duration tracking and transient retry
 */
export async function queryPostgres(
  text: string,
  params?: any[],
  options?: { timeoutMs?: number }
): Promise<QueryResult> {
  const start = Date.now();

  const isTransient = (err: any) => {
    const { category } = categorizeDbError(err);
    return (
      category === 'CONNECTION_TERMINATED' ||
      category === 'CONNECTION_TIMEOUT' ||
      category === 'DEADLOCK'
    );
  };

  let lastError: any;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const activePool = getPostgresPool();
      let res: QueryResult;
      if (options?.timeoutMs) {
        // Query-level timeout override
        const queryObj = {
          text,
          values: params,
          query_timeout: options.timeoutMs,
        };
        res = await activePool.query(queryObj);
      } else {
        res = await activePool.query(text, params);
      }

      const duration = Date.now() - start;
      if (process.env.NODE_ENV === 'development' && duration > 200) {
        const stats = getPostgresPoolStats();
        console.log(
          `🐘 [Postgres Query] Executed in ${duration}ms | Rows: ${res.rowCount} | Pool: total=${stats.totalCount}, idle=${stats.idleCount}, waiting=${stats.waitingCount}`
        );
      }
      return res;
    } catch (error: any) {
      lastError = error;
      const { category, message } = categorizeDbError(error);
      if (attempt < 2 && isTransient(error)) {
        console.warn(`[queryPostgres] Transient ${category} on attempt ${attempt}, retrying in ${attempt * 150}ms…`);
        await new Promise((r) => setTimeout(r, attempt * 150));
        continue;
      }
      console.error(`❌ [Postgres Query Error] [${category}]:`, message);
      throw error;
    }
  }
  throw lastError;
}

/**
 * Diagnostic Healthcheck: Tests connection to PostgreSQL
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
  poolStats?: { totalCount: number; idleCount: number; waitingCount: number };
  errorCategory?: string;
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
      poolStats: getPostgresPoolStats(),
    };
  } catch (err: any) {
    const { category, message } = categorizeDbError(err);
    return {
      connected: false,
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      poolStats: getPostgresPoolStats(),
      errorCategory: category,
      error: message,
    };
  }
}
