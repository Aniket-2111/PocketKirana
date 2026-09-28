/**
 * PocketKirana — User Analytics Consent Management
 *
 * Implements consent mechanisms conforming to privacy guidelines.
 * When user explicitly declines tracking, optional analytics is disabled.
 */

const CONSENT_STORAGE_KEY = 'pk_analytics_consent';

/**
 * Checks if the user has given consent for product analytics.
 * Defaults to true for essential app operation unless explicitly opted out.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') {
    return true; // Server-side operations default to allowed
  }

  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored === 'false') {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Sets user analytics consent preference.
 */
export function setAnalyticsConsent(consent: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent ? 'true' : 'false');
  } catch (err) {
    console.warn('[Analytics Consent] Unable to persist consent preference:', err);
  }
}
