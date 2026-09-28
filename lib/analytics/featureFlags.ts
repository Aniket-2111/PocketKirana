/**
 * PocketKirana — PostHog Feature Flags & Experimentation Abstraction
 *
 * Provides a resilient API for evaluating feature flags and A/B test variants.
 * Guarantees safe fallback defaults if PostHog is disabled, offline, or evaluating on SSR.
 */

import posthog from 'posthog-js';

export function isFeatureEnabled(flagKey: string, defaultValue: boolean = false): boolean {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const isReady = (posthog as any).__loaded;
    if (!isReady) {
      return defaultValue;
    }

    const value = posthog.isFeatureEnabled(flagKey);
    return typeof value === 'boolean' ? value : defaultValue;
  } catch (err) {
    console.warn(`[Analytics FeatureFlags] Evaluation failed for '${flagKey}':`, err);
    return defaultValue;
  }
}

export function getFeatureFlag(flagKey: string, defaultValue?: string | boolean): string | boolean | undefined {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const isReady = (posthog as any).__loaded;
    if (!isReady) {
      return defaultValue;
    }

    const val = posthog.getFeatureFlag(flagKey);
    return val !== undefined ? val : defaultValue;
  } catch (err) {
    console.warn(`[Analytics FeatureFlags] Flag fetch failed for '${flagKey}':`, err);
    return defaultValue;
  }
}

export function getFeatureFlagPayload(flagKey: string): any {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const isReady = (posthog as any).__loaded;
    if (!isReady) {
      return null;
    }

    return posthog.getFeatureFlagPayload(flagKey);
  } catch (err) {
    console.warn(`[Analytics FeatureFlags] Payload fetch failed for '${flagKey}':`, err);
    return null;
  }
}

export function onFeatureFlags(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  try {
    return posthog.onFeatureFlags(callback);
  } catch {
    return () => {};
  }
}
