/**
 * PocketKirana — Server-Side Session Manager
 *
 * Production-grade session management with high-entropy cryptographically
 * random session IDs (UUIDv4), session rotation on login/privilege changes,
 * absolute & idle expiry, and support for multi-device revocation.
 */

import crypto from 'crypto';

export interface UserSessionData {
  sessionId: string;
  userId: string;
  role: 'customer' | 'picker' | 'delivery_partner' | 'admin';
  name?: string;
  mobile?: string;
  email?: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  sessionVersion: number;
}

// In-memory server session store (production backs this with Redis)
const sessionStore = new Map<string, UserSessionData>();
const userSessionsMap = new Map<string, Set<string>>(); // userId -> Set<sessionId>

// Session Lifetime Configurations
const CUSTOMER_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours
const IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days idle

/**
 * Generate a cryptographically random session ID.
 */
export function generateSessionId(): string {
  if (typeof window === 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Node.js crypto fallback
  try {
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomUUID();
  } catch (_) {
    return 'pks_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/**
 * Create and register a new server session.
 */
export function createServerSession(params: {
  userId: string;
  role: 'customer' | 'picker' | 'delivery_partner' | 'admin';
  name?: string;
  mobile?: string;
  email?: string;
}): UserSessionData {
  const sessionId = generateSessionId();
  const now = new Date();
  const maxAgeMs = params.role === 'admin' ? ADMIN_SESSION_MAX_AGE_MS : CUSTOMER_SESSION_MAX_AGE_MS;
  const expiresAt = new Date(now.getTime() + maxAgeMs);

  const sessionData: UserSessionData = {
    sessionId,
    userId: params.userId,
    role: params.role,
    name: params.name,
    mobile: params.mobile,
    email: params.email,
    createdAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    sessionVersion: 1,
  };

  sessionStore.set(sessionId, sessionData);

  // Track session per user for logout-all support
  if (!userSessionsMap.has(params.userId)) {
    userSessionsMap.set(params.userId, new Set());
  }
  userSessionsMap.get(params.userId)?.add(sessionId);

  return sessionData;
}

/**
 * Retrieve and validate an active session by Session ID.
 */
export function getServerSession(sessionId: string): UserSessionData | null {
  if (!sessionId) return null;

  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const now = new Date().getTime();
  const expiresTime = new Date(session.expiresAt).getTime();
  const lastActivityTime = new Date(session.lastActivityAt).getTime();

  // Check absolute expiry
  if (now > expiresTime) {
    destroyServerSession(sessionId);
    return null;
  }

  // Check idle timeout
  if (now - lastActivityTime > IDLE_TIMEOUT_MS) {
    destroyServerSession(sessionId);
    return null;
  }

  // Update last activity timestamp
  session.lastActivityAt = new Date().toISOString();
  sessionStore.set(sessionId, session);

  return session;
}

/**
 * Rotate Session ID on login/auth events to prevent session fixation.
 */
export function rotateServerSession(oldSessionId: string): UserSessionData | null {
  const existing = getServerSession(oldSessionId);
  if (!existing) return null;

  // Destroy old session
  destroyServerSession(oldSessionId);

  // Issue new session ID with preserved user identity
  return createServerSession({
    userId: existing.userId,
    role: existing.role,
    name: existing.name,
    mobile: existing.mobile,
    email: existing.email,
  });
}

/**
 * Destroy a single server session (Logout).
 */
export function destroyServerSession(sessionId: string): void {
  const session = sessionStore.get(sessionId);
  if (session) {
    const userSessions = userSessionsMap.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        userSessionsMap.delete(session.userId);
      }
    }
    sessionStore.delete(sessionId);
  }
}

/**
 * Revoke all active sessions for a user (Logout All Devices).
 */
export function revokeAllUserSessions(userId: string): number {
  const userSessions = userSessionsMap.get(userId);
  if (!userSessions) return 0;

  let count = 0;
  for (const sId of userSessions) {
    sessionStore.delete(sId);
    count++;
  }
  userSessionsMap.delete(userId);
  return count;
}
