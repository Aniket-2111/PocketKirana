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
  return Boolean(
    apiKey &&
      projectId &&
      !apiKey.includes('your_api_key_here') &&
      !apiKey.includes('YOUR_') &&
      apiKey.length > 20
  );
};

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
      return initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true });
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
      dbInstance = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    } catch {
      dbInstance = getFirestore(app);
    }
    authInstance = getAuth(app);
  }
} catch (error) {
  console.warn('Firebase initialization skipped or failed:', error);
}

export const db = dbInstance;
export const auth = authInstance;
export { app };
