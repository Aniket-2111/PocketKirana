/**
 * PocketKirana — Server-Side PostHog Analytics Engine
 *
 * Implements authoritative server-side tracking for critical business events:
 *  - order_created, order_confirmed, order_delivered, order_cancelled
 *  - payment_verified, payment_failed
 *
 * Characteristics:
 *  1. Completely isolated: never throws or fails a Next.js API route or DB transaction.
 *  2. Sanitized: automatically strips credentials, secrets, raw tokens.
 *  3. Dynamically loaded on server runtime so client bundles never bundle node builtins.
 */

import { sanitizeAnalyticsProperties } from './sanitization';
import { PostHogEventName } from './events';

let serverPostHogInstance: any = null;

function getServerPostHog(): any {
  if (typeof window !== 'undefined') {
    return null; // Server only
  }

  if (serverPostHogInstance) {
    return serverPostHogInstance;
  }

  const apiKey = process.env.POSTHOG_SERVER_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.POSTHOG_SERVER_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    return null;
  }

  try {
    // Dynamic require inside server environment prevents Webpack client errors
    // with Node built-ins (node:fs, node:os, node:path)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PostHog } = require('posthog-node');
    serverPostHogInstance = new PostHog(apiKey, {
      host,
      flushAt: 1, // Flush immediately in serverless / container API handlers
      flushInterval: 0,
    });
    return serverPostHogInstance;
  } catch (err) {
    console.warn('[PostHog Server] Client initialization failed:', err);
    return null;
  }
}

/**
 * Tracks an authoritative server-side event.
 * Always non-blocking; never throws an exception.
 */
export async function trackServerEvent(
  distinctId: string,
  eventName: PostHogEventName | string,
  properties?: Record<string, any>
): Promise<void> {
  try {
    const client = getServerPostHog();
    const sanitized = sanitizeAnalyticsProperties(properties);
    const enrichedProperties = {
      ...sanitized,
      environment: process.env.NODE_ENV || 'development',
      runtime: 'node_server',
      timestamp: new Date().toISOString(),
    };

    if (!client) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[PostHog Server Track] [${distinctId || 'anonymous'}] ${eventName}:`, enrichedProperties);
      }
      return;
    }

    client.capture({
      distinctId: distinctId || 'system',
      event: eventName,
      properties: enrichedProperties,
    });
  } catch (err) {
    // Non-fatal logging
    console.warn(`[PostHog Server] Error tracking '${eventName}':`, (err as any)?.message);
  }
}

/**
 * Identifies a user on the server side with sanitized traits.
 */
export async function identifyServerUser(
  distinctId: string,
  properties?: Record<string, any>
): Promise<void> {
  try {
    const client = getServerPostHog();
    if (!client || !distinctId) return;

    const sanitized = sanitizeAnalyticsProperties(properties);
    client.identify({
      distinctId,
      properties: {
        ...sanitized,
        environment: process.env.NODE_ENV || 'development',
      },
    });
  } catch (err) {
    console.warn(`[PostHog Server] Error identifying '${distinctId}':`, (err as any)?.message);
  }
}

/**
 * Flushes pending events before shutdown (useful in short-lived jobs / workers).
 */
export async function flushServerAnalytics(): Promise<void> {
  try {
    if (serverPostHogInstance) {
      await serverPostHogInstance.shutdown();
      serverPostHogInstance = null;
    }
  } catch (err) {
    console.warn('[PostHog Server] Error flushing analytics:', err);
  }
}
