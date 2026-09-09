/**
 * PocketKirana — User Service
 *
 * Handles all user-related operations:
 * - Creating/fetching user profiles after Firebase Auth success
 * - Resolving role from Firestore (not from client state)
 * - Saving FCM tokens for push notifications
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './firebase';
import { User, UserRole } from '@/types';

const USERS_COLLECTION = 'users';
const FCM_TOKENS_SUBCOLLECTION = 'fcmTokens';

// ══════════════════════════════════════════
// PROFILE CREATION ON AUTH SUCCESS
// ══════════════════════════════════════════

/**
 * Called after successful Firebase Phone OTP verification.
 * Fetches or creates the user profile in Firestore.
 * Returns the complete user object with role from Firestore.
 */
export async function onAuthSuccess(firebaseUid: string, phoneNumber: string): Promise<User | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  const now = new Date().toISOString();

  try {
    const userRef = doc(db, USERS_COLLECTION, firebaseUid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // Update last login
      await updateDoc(userRef, { lastLogin: now });
      return { id: userSnap.id, ...userSnap.data() } as User;
    }

    // New user — create profile with customer role
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const newUser: User = {
      id: firebaseUid,
      role: 'customer',
      mobile: cleanPhone,
      status: 'active',
      createdAt: now,
      lastLogin: now,
    };

    await setDoc(userRef, newUser);
    return newUser;
  } catch (err) {
    console.error('[UserService] onAuthSuccess error:', err);
    return null;
  }
}

// ══════════════════════════════════════════
// ROLE RESOLUTION (always from Firestore)
// ══════════════════════════════════════════

/**
 * Gets the authoritative role for a user from Firestore.
 * Never trust the client-side role from local state.
 */
export async function getUserRole(uid: string): Promise<UserRole> {
  const db = getFirebaseDb();
  if (!db) return 'customer';

  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (userSnap.exists()) {
      return (userSnap.data().role as UserRole) || 'customer';
    }
  } catch (err) {
    console.error('[UserService] getUserRole error:', err);
  }
  return 'customer';
}

/**
 * Gets the full user profile from Firestore by UID.
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() } as User;
    }
  } catch (err) {
    console.error('[UserService] getUserProfile error:', err);
  }
  return null;
}

// ══════════════════════════════════════════
// PROFILE UPDATES
// ══════════════════════════════════════════

export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<User, 'firstName' | 'lastName' | 'email' | 'profileImage'>>
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    await updateDoc(doc(db, USERS_COLLECTION, uid), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('[UserService] updateUserProfile error:', err);
    return false;
  }
}

// ══════════════════════════════════════════
// FCM TOKEN MANAGEMENT
// ══════════════════════════════════════════

/**
 * Saves or updates an FCM token for the authenticated user.
 * Stores in users/{uid}/fcmTokens/{tokenId}
 */
export async function saveFcmToken(
  uid: string,
  fcmToken: string,
  deviceType: 'web' | 'android' | 'ios' = 'web'
): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !uid || !fcmToken) return;

  try {
    const tokenId = `tok-${fcmToken.slice(-16)}`;
    const tokenRef = doc(
      collection(db, USERS_COLLECTION, uid, FCM_TOKENS_SUBCOLLECTION),
      tokenId
    );

    await setDoc(tokenRef, {
      id: tokenId,
      userId: uid,
      fcmToken,
      deviceType,
      appVersion: '1.0',
      lastActive: new Date().toISOString(),
      enabled: true,
    }, { merge: true });
  } catch (err) {
    console.error('[UserService] saveFcmToken error:', err);
  }
}

/**
 * Disables an FCM token (called when token becomes invalid).
 */
export async function disableFcmToken(uid: string, fcmToken: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;

  try {
    const tokenId = `tok-${fcmToken.slice(-16)}`;
    const tokenRef = doc(
      collection(db, USERS_COLLECTION, uid, FCM_TOKENS_SUBCOLLECTION),
      tokenId
    );
    await updateDoc(tokenRef, { enabled: false });
  } catch (err) {
    console.error('[UserService] disableFcmToken error:', err);
  }
}
