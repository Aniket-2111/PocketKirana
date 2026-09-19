import { describe, it, expect } from 'vitest';
import { isFirebaseConfigured } from '../../lib/firebase';

describe('Phase 19 — Gate G2: Firebase Production Isolation', () => {
  it('enforces that production environment rejects dev project ids', () => {
    const origEnv = process.env.NODE_ENV;
    const origKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const origProj = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    try {
      (process.env as any).NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'AIzaSyD_EXAMPLE_VALID_LENGTH_KEY_12345';
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'pocketkirana-dev';

      // Security check: must return false when connecting to dev project in production mode
      expect(isFirebaseConfigured()).toBe(false);
    } finally {
      (process.env as any).NODE_ENV = origEnv;
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY = origKey;
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = origProj;
    }
  });
});
