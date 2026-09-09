/**
 * Cloud Function: onUserCreated
 *
 * Triggers when a new Firebase Auth user is created.
 * Automatically creates their Firestore user profile with role 'customer'.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { auth } from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { C, writeAuditLog } from '../utils';

/**
 * Auth trigger: creates user profile on signup
 */
export const onUserCreated = auth.user().onCreate(async (user) => {
  const db = admin.firestore();

  try {
    const now = new Date().toISOString();
    const phone = user.phoneNumber || '';

    // Create user document in Firestore
    await db.collection(C.USERS).doc(user.uid).set({
      id: user.uid,
      role: 'customer',
      mobile: phone,
      phone,
      email: user.email || '',
      firstName: '',
      lastName: '',
      status: 'active',
      createdAt: now,
      lastLogin: now,
    });

    // Set default custom claim
    await admin.auth().setCustomUserClaims(user.uid, { role: 'customer' });

    console.log(`[onUserCreated] Profile created for ${user.uid} (${phone})`);
  } catch (err) {
    console.error('[onUserCreated] Error creating user profile:', err);
  }
});

/**
 * Callable: updateUserProfile
 * Allows a customer to update their own profile (name, email).
 */
export const updateUserProfile = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = request.auth.uid;
    const { firstName, lastName, email } = request.data as {
      firstName?: string;
      lastName?: string;
      email?: string;
    };

    const db = admin.firestore();
    const updates: Record<string, string> = {
      updatedAt: new Date().toISOString(),
    };

    if (firstName !== undefined) updates.firstName = firstName.trim();
    if (lastName !== undefined) updates.lastName = lastName.trim();
    if (email !== undefined) {
      // Basic email validation
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email address.');
      }
      updates.email = email.toLowerCase().trim();
    }

    await db.collection(C.USERS).doc(uid).update(updates);

    return { success: true, message: 'Profile updated successfully.' };
  }
);

/**
 * Callable: saveFcmToken
 * Saves/updates the FCM token for the authenticated user.
 * Tokens are stored in users/{uid}/fcmTokens/{tokenId}
 */
export const saveFcmToken = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const { fcmToken, deviceType, appVersion } = request.data as {
      fcmToken: string;
      deviceType: string;
      appVersion?: string;
    };

    if (!fcmToken) {
      throw new HttpsError('invalid-argument', 'fcmToken is required.');
    }

    const uid = request.auth.uid;
    const db = admin.firestore();
    const tokenId = `tok-${fcmToken.slice(-16)}`;

    await db
      .collection(C.USERS)
      .doc(uid)
      .collection('fcmTokens')
      .doc(tokenId)
      .set({
        id: tokenId,
        userId: uid,
        fcmToken,
        deviceType: deviceType || 'web',
        appVersion: appVersion || '1.0',
        lastActive: new Date().toISOString(),
        enabled: true,
      }, { merge: true });

    return { success: true };
  }
);
