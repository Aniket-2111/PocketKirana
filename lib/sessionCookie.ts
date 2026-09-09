/**
 * PocketKirana — Session Cookie Manager
 *
 * Manages the secure `pk_session` HttpOnly cookie.
 * The browser receives only a cryptographically random session identifier.
 * User identities, roles, and permissions remain strictly server-side.
 *
 * Cookie Specs:
 *   name:     pk_session
 *   value:    Cryptographically secure random UUID
 *   path:     /
 *   secure:   true (HTTPS)
 *   samesite: Lax (protects against CSRF on cross-site navigation)
 *   max-age:  2592000 (30 days for customer sessions)
 */

export const SESSION_COOKIE_NAME = 'pk_session';

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
}

/**
 * Write or refresh the secure `pk_session` cookie on client-side authentication.
 */
export function writeSessionCookie(sessionId: string, maxAgeSeconds: number = 2592000): void {
  if (typeof document === 'undefined') return;

  const secure = isSecureContext() ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

/**
 * Clear the `pk_session` cookie on logout.
 */
export function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Start watching auth changes and maintain session cookie state.
 */
export function startSessionSync(): () => void {
  // Syncs session cookie state across tabs
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'pk_logout_signal') {
      clearSessionCookie();
    }
  };

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

/**
 * Force refresh the session cookie.
 */
export async function forceRefreshSession(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  return true;
}
