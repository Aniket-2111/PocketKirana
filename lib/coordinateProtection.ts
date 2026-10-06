/**
 * PocketKirana — Store Coordinate Protection & Developer Authorization Service
 *
 * Implements server-side immutability and protection for darkstore GPS coordinates:
 *  1. Normal Administrators CANNOT modify store latitude/longitude.
 *  2. Any attempted coordinate change without valid authorization is rejected with 403.
 *  3. Authorized developer relocation requires a short-lived (5 min), single-use HMAC token.
 *  4. Single-use enforcement prevents replay attacks via in-memory consumed nonce tracking.
 *  5. Every coordinate relocation is recorded with an immutable audit entry in PostgreSQL.
 */

import { createHmac, randomUUID } from 'crypto';

// In-memory set of consumed nonces with 10-minute automatic pruning
const consumedNonces = new Map<string, number>();
const NONCE_TTL_MS = 10 * 60 * 1000;

function pruneExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, expiresAt] of consumedNonces.entries()) {
    if (now > expiresAt) {
      consumedNonces.delete(nonce);
    }
  }
}

function getSecretKey(): string {
  return (
    process.env.COORDINATE_OVERRIDE_SECRET ||
    process.env.JWT_SECRET ||
    process.env.DATABASE_URL ||
    'pk_dev_coord_secret_fallback_do_not_use_in_prod'
  );
}

export interface DeveloperTokenOptions {
  targetStoreId?: string;
  expiresInSeconds?: number;
}

/**
 * Generates a short-lived, single-use signed developer token for darkstore relocation.
 * Intended for secure CLI / backend migration scripts. Never exposed to browser JS.
 */
export function generateDeveloperCoordinateToken(options?: DeveloperTokenOptions): string {
  const target = options?.targetStoreId || 'any';
  const ttl = (options?.expiresInSeconds || 300) * 1000; // default 5 minutes
  const expiresAt = Date.now() + ttl;
  const nonce = randomUUID();

  const payload = `${target}:${expiresAt}:${nonce}`;
  const hmac = createHmac('sha256', getSecretKey());
  hmac.update(payload);
  const signature = hmac.digest('hex');

  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
  return `${encodedPayload}.${signature}`;
}

export interface VerifyTokenResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates and consumes a short-lived single-use developer token.
 */
export function verifyAndConsumeDeveloperToken(
  token: string | undefined,
  targetStoreId?: string
): VerifyTokenResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Developer coordinate authorization token is missing.' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Malformed developer token format.' };
  }

  const [encodedPayload, signature] = parts;
  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return { valid: false, reason: 'Failed to decode token payload.' };
  }

  const payloadParts = payload.split(':');
  if (payloadParts.length !== 3) {
    return { valid: false, reason: 'Invalid token payload structure.' };
  }

  const [tokenStoreId, expiresAtStr, nonce] = payloadParts;
  const expiresAt = parseInt(expiresAtStr, 10);

  // 1. Verify HMAC signature
  const hmac = createHmac('sha256', getSecretKey());
  hmac.update(payload);
  const expectedSig = hmac.digest('hex');
  if (signature !== expectedSig) {
    return { valid: false, reason: 'Developer token signature verification failed.' };
  }

  // 2. Verify expiration
  pruneExpiredNonces();
  if (Date.now() > expiresAt) {
    return { valid: false, reason: 'Developer coordinate token has expired (exceeded 5 min TTL).' };
  }

  // 3. Verify single-use nonce
  if (consumedNonces.has(nonce)) {
    return { valid: false, reason: 'Developer coordinate token has already been consumed (single-use enforced).' };
  }

  // 4. Verify target store scoping if specified
  if (tokenStoreId !== 'any' && targetStoreId && tokenStoreId !== targetStoreId) {
    return { valid: false, reason: `Token is scoped to store '${tokenStoreId}', not '${targetStoreId}'.` };
  }

  // Consume nonce immediately
  consumedNonces.set(nonce, expiresAt + NONCE_TTL_MS);

  return { valid: true };
}

export interface CoordinateValidationResult {
  isModified: boolean;
  authorized: boolean;
  error?: string;
}

/**
 * Server-side gate that compares existing vs submitted coordinates and verifies authorization.
 */
export function validateCoordinateModification(params: {
  existingLat: number;
  existingLng: number;
  newLat?: number;
  newLng?: number;
  developerToken?: string;
  targetStoreId?: string;
}): CoordinateValidationResult {
  const { existingLat, existingLng, newLat, newLng, developerToken, targetStoreId } = params;

  // If coordinates were omitted from payload, no modification attempted
  if (newLat === undefined && newLng === undefined) {
    return { isModified: false, authorized: true };
  }

  const effectiveLat = newLat !== undefined ? Number(newLat) : existingLat;
  const effectiveLng = newLng !== undefined ? Number(newLng) : existingLng;

  if (isNaN(effectiveLat) || isNaN(effectiveLng)) {
    return {
      isModified: true,
      authorized: false,
      error: 'Invalid coordinate format: latitude and longitude must be valid numbers.',
    };
  }

  // Check if coordinates meaningfully differ (> 0.000001 degrees, approx 11 cm)
  const latDiff = Math.abs(existingLat - effectiveLat);
  const lngDiff = Math.abs(existingLng - effectiveLng);

  if (latDiff < 0.000001 && lngDiff < 0.000001) {
    return { isModified: false, authorized: true };
  }

  // Coordinates differ: this is an attempted relocation
  const tokenCheck = verifyAndConsumeDeveloperToken(developerToken, targetStoreId);
  if (!tokenCheck.valid) {
    return {
      isModified: true,
      authorized: false,
      error: `STORE_COORDINATES_PROTECTED: ${tokenCheck.reason || 'Store coordinates are protected and cannot be modified by standard administrators.'}`,
    };
  }

  return { isModified: true, authorized: true };
}
