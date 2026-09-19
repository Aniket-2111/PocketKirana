/**
 * PocketKirana — Production Observability, Structured Logging, & Metrics Engine
 *
 * Implements:
 * 1. Request Correlation IDs (tracing requests across Next.js, PostgreSQL, Outbox, FCM)
 * 2. Structured JSON Logging with log levels (DEBUG, INFO, WARN, ERROR, FATAL)
 * 3. Automatic Sensitive Data Redaction (passwords, OTPs, salt keys, private keys, tokens)
 * 4. In-Memory Business & Operational Metrics Collector
 */

import crypto from 'crypto';

// ── SENSITIVE DATA REDACTION ──────────────────────────────────────────────────
const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'db_password',
  'salt',
  'salt_key',
  'phonepe_salt_key',
  'razorpay_key_secret',
  'secret',
  'private_key',
  'token',
  'push_token',
  'authorization',
  'cookie',
  'otp',
  'delivery_otp',
  'card_number',
  'cvv',
  'authkey',
  'msg91_authkey',
  'service_account',
  'credentials',
]);

export function redactSensitiveData(obj: any, depth = 0): any {
  if (depth > 6) return '[MAX_DEPTH_REACHED]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1));
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive =
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('otp') ||
      lowerKey.includes('salt') ||
      lowerKey.includes('cvv') ||
      lowerKey.includes('cardnumber') ||
      lowerKey.includes('card_number') ||
      lowerKey.includes('pan');

    if (typeof val === 'object' && val !== null) {
      cleanObj[key] = redactSensitiveData(val, depth + 1);
    } else if (isSensitive || lowerKey === 'card') {
      cleanObj[key] = '[REDACTED]';
    } else {
      cleanObj[key] = val;
    }
  }
  return cleanObj;
}

// ── CORRELATION ID MANAGEMENT ─────────────────────────────────────────────────
export function generateCorrelationId(): string {
  return `pk_req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

export function extractCorrelationId(headers?: Headers | Record<string, string | string[] | undefined>): string {
  if (!headers) return generateCorrelationId();

  if (typeof (headers as Headers).get === 'function') {
    const val = (headers as Headers).get('x-correlation-id') || (headers as Headers).get('x-request-id');
    if (val) return val;
  } else {
    const raw = headers as Record<string, string | string[] | undefined>;
    const val = raw['x-correlation-id'] || raw['x-request-id'];
    if (typeof val === 'string' && val.length > 0) return val;
    if (Array.isArray(val) && val[0]) return val[0];
  }

  return generateCorrelationId();
}

// ── STRUCTURED LOGGER ─────────────────────────────────────────────────────────
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
  level: LogLevel;
  service: string;
  event: string;
  message?: string;
  correlationId?: string;
  orderId?: string;
  userId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string | number;
  };
}

class StructuredLogger {
  private serviceName: string;

  constructor(serviceName: string = 'pocketkirana-api') {
    this.serviceName = serviceName;
  }

  private log(level: LogLevel, event: string, message: string, options: Partial<LogEntry> = {}) {
    const entry: LogEntry = {
      level,
      service: this.serviceName,
      event,
      message,
      correlationId: options.correlationId,
      orderId: options.orderId,
      userId: options.userId,
      timestamp: new Date().toISOString(),
      metadata: options.metadata ? redactSensitiveData(options.metadata) : undefined,
      error: options.error
        ? {
            message: options.error.message,
            code: (options.error as any).code,
            stack: process.env.NODE_ENV !== 'production' ? options.error.stack : undefined,
          }
        : undefined,
    };

    const serialized = JSON.stringify(entry);
    if (level === 'ERROR' || level === 'FATAL') {
      console.error(serialized);
    } else if (level === 'WARN') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(event: string, message: string, options?: Partial<LogEntry>) {
    if (process.env.NODE_ENV !== 'production') {
      this.log('DEBUG', event, message, options);
    }
  }

  info(event: string, message: string, options?: Partial<LogEntry>) {
    this.log('INFO', event, message, options);
  }

  warn(event: string, message: string, options?: Partial<LogEntry>) {
    this.log('WARN', event, message, options);
  }

  error(event: string, message: string, error?: Error | any, options?: Partial<LogEntry>) {
    this.log('ERROR', event, message, { ...options, error });
  }

  fatal(event: string, message: string, error?: Error | any, options?: Partial<LogEntry>) {
    this.log('FATAL', event, message, { ...options, error });
  }
}

export const logger = new StructuredLogger();

// ── OPERATIONAL & BUSINESS METRICS COLLECTOR ──────────────────────────────────
interface MetricRecord {
  count: number;
  lastEmittedAt: string;
  tags?: Record<string, string>;
}

class MetricsCollector {
  private counters = new Map<string, MetricRecord>();

  increment(metricName: string, value: number = 1, tags?: Record<string, string>): void {
    const existing = this.counters.get(metricName);
    if (existing) {
      existing.count += value;
      existing.lastEmittedAt = new Date().toISOString();
      if (tags) existing.tags = { ...existing.tags, ...tags };
    } else {
      this.counters.set(metricName, {
        count: value,
        lastEmittedAt: new Date().toISOString(),
        tags,
      });
    }
  }

  getSnapshot(): Record<string, MetricRecord> {
    const snapshot: Record<string, MetricRecord> = {};
    for (const [k, v] of this.counters.entries()) {
      snapshot[k] = { ...v };
    }
    return snapshot;
  }

  reset(): void {
    this.counters.clear();
  }
}

export const metrics = new MetricsCollector();
