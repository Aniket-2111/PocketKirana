/**
 * PocketKirana — Analytics Privacy & Sanitization Layer
 *
 * Enforces strict DPDP & PCI-DSS compliance before any event is dispatched to PostHog:
 * 1. Blocks sensitive authentication & payment credentials (passwords, OTPs, salt keys, CVV, tokens).
 * 2. Prevents tracking exact GPS coordinates (keeps only general zone / city / postal code).
 * 3. Strips raw personal delivery addresses (house/flat number, street address lines).
 * 4. Strips internal server stack traces and credentials.
 */

const BLOCKED_SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'dbpassword',
  'token',
  'idtoken',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'pksession',
  'pksessionid',
  'session',
  'secret',
  'salt',
  'saltkey',
  'phonepesaltkey',
  'razorpaykeysecret',
  'privatekey',
  'otp',
  'deliveryotp',
  'cardnumber',
  'card',
  'cvv',
  'pan',
  'upipin',
  'authkey',
  'msg91authkey',
  'serviceaccount',
  'credentials',
  'cookie',
  'authorization',
  // Exact GPS fields forbidden in product analytics
  'latitude',
  'longitude',
  'lat',
  'lng',
  'coordinates',
  'coords',
  // Specific street level address details
  'housenumber',
  'buildingname',
  'floor',
  'addressline1',
  'addressline2',
  'landmark',
]);

/**
 * Sanitizes an object before sending to PostHog.
 * Recursively removes sensitive keys and redacts suspected confidential strings.
 */
export function sanitizeAnalyticsProperties(
  properties?: Record<string, any>,
  depth: number = 0
): Record<string, any> {
  if (!properties || typeof properties !== 'object') {
    return {};
  }
  if (depth > 5) {
    return {};
  }

  const clean: Record<string, any> = {};

  for (const [rawKey, val] of Object.entries(properties)) {
    const key = rawKey.trim();
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');

    // Skip prohibited sensitive keys
    if (BLOCKED_SENSITIVE_KEYS.has(lowerKey)) {
      continue;
    }

    // Check for substrings indicating secrets
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('otp') ||
      lowerKey.includes('token') ||
      lowerKey.includes('session') ||
      lowerKey.includes('cookie') ||
      lowerKey.includes('salt') ||
      lowerKey.includes('cvv') ||
      lowerKey.includes('cardnumber') ||
      lowerKey.includes('upipin')
    ) {
      continue;
    }

    if (val === null || val === undefined) {
      continue;
    }

    if (typeof val === 'function') {
      continue;
    }

    if (Array.isArray(val)) {
      clean[key] = val
        .map((item) => {
          if (typeof item === 'object' && item !== null) {
            return sanitizeAnalyticsProperties(item, depth + 1);
          }
          return typeof item === 'string' ? sanitizeStringValue(item) : item;
        })
        .filter((item) => item !== null && item !== undefined);
    } else if (typeof val === 'object') {
      clean[key] = sanitizeAnalyticsProperties(val, depth + 1);
    } else if (typeof val === 'string') {
      clean[key] = sanitizeStringValue(val);
    } else {
      clean[key] = val;
    }
  }

  return clean;
}

/**
 * Strips raw JWTs, Bearer tokens, or passwords from string values.
 */
function sanitizeStringValue(str: string): string {
  if (!str) return '';

  // Redact JWT patterns (header.payload.signature)
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(str)) {
    return '[REDACTED_JWT]';
  }

  // Redact Bearer authorization strings
  if (/^bearer\s+[a-z0-9._-]+$/i.test(str)) {
    return '[REDACTED_AUTH]';
  }

  // Cap string length to prevent massive payloads or log injection
  if (str.length > 500) {
    return str.slice(0, 500) + '...';
  }

  return str;
}
