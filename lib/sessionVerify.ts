/**
 * PocketKirana — Edge-Safe Firebase ID Token Verification
 *
 * Verifies Firebase Auth ID tokens (RS256 JWTs) without adding a dependency:
 * the WebCrypto API does RS256 verification, and Google's securetoken JWKS
 * endpoint provides the signing keys. Runs in the Edge runtime (middleware).
 *
 * Security properties:
 *  - Signature is ALWAYS verified (RS256, JWKS key matched by kid). Forged or
 *    unsigned tokens can never pass. This replaces the old trust-the-payload
 *    decoder that let anyone craft role=admin.
 *  - alg confusion impossible: we require RS256 and import the key with
 *    name: 'RSASSA-PKCS1-v1_5' — a token that declares HS256 fails before any
 *    key work happens.
 *  - Standard claims enforced: iss, aud, exp, iat, and Firebase's
 *    auth_time (session cannot predate the token issuance rules).
 *  - Keys cached in memory (6h TTL, Firebase rotates ~weekly).
 */

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const SECURETOKEN_ISSUER = 'https://securetoken.google.com/';

export interface VerifiedToken {
  uid: string;
  role?: string;
  admin?: boolean;
  email?: string;
  exp: number;
}

interface JwkKey {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

interface CacheEntry {
  keys: Map<string, CryptoKey>;
  fetchedAt: number;
}

const KEY_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let cache: CacheEntry | null = null;

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importJwkAsCryptoKey(jwk: JwkKey): Promise<CryptoKey | null> {
  try {
    return await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' } as unknown as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  } catch {
    return null;
  }
}

async function getVerificationKeys(): Promise<Map<string, CryptoKey> | null> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < KEY_TTL_MS) return cache.keys;

  try {
    const res = await fetch(JWKS_URL);
    if (!res.ok) return cache?.keys ?? null;

    const body: { keys?: JwkKey[] } = await res.json();
    if (!Array.isArray(body.keys)) return cache?.keys ?? null;

    const next: CacheEntry = { keys: new Map(), fetchedAt: now };
    for (const jwk of body.keys) {
      if (jwk.kty !== 'RSA' || !jwk.kid) continue;
      const key = await importJwkAsCryptoKey(jwk);
      if (key) next.keys.set(jwk.kid, key);
    }

    // Swap in the new set only if it yielded keys; otherwise keep serving the old one.
    if (next.keys.size > 0) cache = next;
    return cache?.keys ?? null;
  } catch {
    return cache?.keys ?? null;
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
  } catch {
    return null;
  }
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedToken | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  // 1. Header: RS256 only (kills alg=none and HS256 confusion).
  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64)));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  // 2. Signature over header.payload with the JWKS key for this kid.
  const keys = await getVerificationKeys();
  const key = keys?.get(header.kid);
  if (!key) return null;

  const message = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBytes(sigB64);
  let valid = false;
  try {
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature as unknown as ArrayBuffer, message);
  } catch {
    return null;
  }
  if (!valid) return null;

  // 3. Standard claims.
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const nowSec = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== 'number' || payload.exp <= nowSec - 5) return null;
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;
  if (payload.iss !== `${SECURETOKEN_ISSUER}${projectId}`) return null;
  if (payload.aud !== projectId) return null;
  if (typeof payload.auth_time === 'number' && typeof payload.iat === 'number' && payload.auth_time > payload.iat) return null;

  const uid = (payload.user_id as string) || (payload.sub as string) || '';
  if (!uid) return null;

  return {
    uid,
    role: payload.role as string | undefined,
    admin: payload.admin === true,
    email: payload.email as string | undefined,
    exp: payload.exp,
  };
}

/** Is this token an admin (custom claim or role)? For verified tokens only. */
export function isAdminToken(t: VerifiedToken): boolean {
  return t.admin === true || t.role === 'admin';
}
