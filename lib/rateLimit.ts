/**
 * PocketKirana — Sliding-Window API Rate Limiter
 *
 * In-memory token bucket / sliding-window rate limiter for Next.js API routes.
 * Prevents endpoint flooding, brute force attacks, and rapid checkout races.
 *
 * Usage:
 *   import { rateLimit } from '@/lib/rateLimit';
 *
 *   const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });
 *   await limiter.check(req, 20, 'CHECKOUT_IP'); // 20 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  /** Time window in milliseconds (e.g. 60000 = 1 minute) */
  interval: number;
  /** Max unique tracking keys per window */
  uniqueTokenPerInterval?: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const tokenStore = new Map<string, RateLimitRecord>();

// Periodic garbage collection for expired entries every 2 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of tokenStore.entries()) {
      if (now > record.resetTime) {
        tokenStore.delete(key);
      }
    }
  }, 120000);
}

export function rateLimit(config: RateLimitConfig) {
  const interval = config.interval;
  const maxTokens = config.uniqueTokenPerInterval || 5000;

  return {
    /**
     * Check if the request exceeds the limit.
     * Returns `null` if within limit, or `NextResponse` (429 Too Many Requests) if exceeded.
     */
    check: async (
      req: NextRequest,
      limit: number,
      bucketPrefix = 'DEFAULT'
    ): Promise<NextResponse | null> => {
      // Extract client identifier (IP or auth header)
      const forwardedFor = req.headers.get('x-forwarded-for');
      const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
      const uid = req.headers.get('x-pk-uid') || ip;
      const key = `${bucketPrefix}:${uid}`;

      const now = Date.now();
      const record = tokenStore.get(key);

      if (!record || now > record.resetTime) {
        // Enforce max map size to prevent memory leaks
        if (tokenStore.size >= maxTokens) {
          const firstKey = tokenStore.keys().next().value;
          if (firstKey) tokenStore.delete(firstKey);
        }

        tokenStore.set(key, {
          count: 1,
          resetTime: now + interval,
        });
        return null;
      }

      if (record.count >= limit) {
        const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
        return NextResponse.json(
          {
            error: 'Too many requests. Please slow down.',
            retryAfterSeconds: retryAfterSec,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfterSec),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': '0',
            },
          }
        );
      }

      record.count += 1;
      return null;
    },
  };
}

// Pre-configured rate limiters for common operational scenarios
export const checkoutLimiter = rateLimit({ interval: 60 * 1000 }); // 60s window
export const barcodeScanLimiter = rateLimit({ interval: 60 * 1000 });
export const authLimiter = rateLimit({ interval: 60 * 1000 });
