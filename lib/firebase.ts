import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if Firebase is properly configured with real credentials
export const isFirebaseConfigured = (): boolean => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Production isolation guard: ensure production never points to dev projects
  if (process.env.NODE_ENV === 'production') {
    if (projectId === 'pocketkirana-dev' || projectId === 'default') {
      console.error('🚨 [Firebase Security] Production environment cannot connect to development Firebase project!');
      return false;
    }
  }

  return Boolean(
    apiKey &&
      projectId &&
      !apiKey.includes('your_api_key_here') &&
      !apiKey.includes('YOUR_') &&
      apiKey.length > 20
  );
};

// Suppress non-fatal Firestore network stream and browser extension abort errors
if (typeof window !== 'undefined') {
  const suppressFirestoreError = (reasonOrMsg: any) => {
    if (!reasonOrMsg) return false;
    const str = String(reasonOrMsg?.message || reasonOrMsg?.reason?.message || reasonOrMsg || '').toLowerCase();
    return (
      str.includes('firestore.googleapis.com') ||
      str.includes('failed to fetch') ||
      str.includes('aborterror') ||
      str.includes('aborted') ||
      str.includes('networkerror') ||
      str.includes('load failed')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (suppressFirestoreError(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (suppressFirestoreError(event.error || event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

// Lazily initialize Firebase on both client and server side
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  try {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  } catch (error) {
    console.warn('Firebase app initialization failed:', error);
    return null;
  }
}

// Exported getters — always returns the live instance
export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  try {
    return getAuth(firebaseApp);
  } catch {
    return null;
  }
}

export function getFirebaseDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  try {
    return getFirestore(firebaseApp);
  } catch {
    try {
      return initializeFirestore(firebaseApp, {
        experimentalAutoDetectLongPolling: true,
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true,
      });
    } catch {
      return null;
    }
  }
}

// Legacy static exports (still used by existing code)
let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

try {
  if (isFirebaseConfigured()) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    try {
      dbInstance = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true,
      });
    } catch {
      try {
        dbInstance = getFirestore(app);
      } catch {}
    }
    authInstance = getAuth(app);
  }
} catch (error) {
  console.warn('Firebase initialization skipped or failed:', error);
}

export const db = dbInstance;
export const auth = authInstance;
export { app };
