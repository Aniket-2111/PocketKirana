/**
 * PocketKirana — Secure CORS Management
 *
 * Implements strict, origin-validated CORS headers instead of dangerous
 * wildcard `Access-Control-Allow-Origin: *` when credentials/auth headers are present.
 */

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-zA-Z0-9-]+\.)?pocketkirana\.com$/,
  /^https:\/\/([a-zA-Z0-9-]+\.)?vercel\.app$/,
];

export function getCorsOrigin(req: NextRequest | Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
  return isAllowed ? origin : null;
}

export function setCorsHeaders<T extends NextResponse>(res: T, req?: NextRequest | Request): T {
  if (req) {
    const origin = getCorsOrigin(req);
    if (origin) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-pk-role, x-pk-uid, x-pk-session-id');
  return res;
}

export function handleCorsPreflight(req: NextRequest | Request): NextResponse {
  const res = NextResponse.json({ status: 'ok' });
  return setCorsHeaders(res, req);
}
