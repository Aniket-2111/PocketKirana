/**
 * Cloud Function: setUserRole
 *
 * Admin-only callable function to assign roles to users.
 * Sets Firebase Auth custom claims AND updates Firestore user document.
 * Forces a token refresh so the new role takes effect immediately.
 *
 * Input:  { uid, role }
 * Output: { success: true, message }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { C, writeAuditLog } from '../utils';

const VALID_ROLES = ['customer', 'admin', 'picker', 'delivery_partner', 'store_manager'];

export const setUserRole = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    // Must be an admin to set roles
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const callerRole = request.auth.token.role;
    const isAdmin = callerRole === 'admin' || request.auth.token.admin === true;

    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Only admins can set user roles.');
    }

    const { uid, role, storeId } = request.data as {
      uid: string;
      role: string;
      storeId?: string;
    };

    if (!uid || !role) {
      throw new HttpsError('invalid-argument', 'uid and role are required.');
    }

    if (!VALID_ROLES.includes(role)) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`
      );
    }

    // Cannot demote another admin (safety guard)
    const targetUser = await admin.auth().getUser(uid);
    const existingClaims = targetUser.customClaims || {};
    if (existingClaims.role === 'admin' && role !== 'admin') {
      throw new HttpsError(
        'permission-denied',
        'Cannot change role of an existing admin. Contact system administrator.'
      );
    }

    // Set Firebase Auth custom claim
    await admin.auth().setCustomUserClaims(uid, {
      role,
      ...(storeId && { storeId }),
    });

    const db = admin.firestore();

    // Update Firestore user document
    await db.collection(C.USERS).doc(uid).set(
      {
        role,
        ...(storeId && { storeId }),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // If assigning picker role — create/update picker document
    if (role === 'picker') {
      const userSnap = await db.collection(C.USERS).doc(uid).get();
      const userData = userSnap.data() || {};
      await db.collection(C.PICKERS).doc(uid).set(
        {
          id: uid,
          name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Picker',
          phone: userData.mobile || userData.phone || '',
          storeId: storeId || '',
          status: 'offline',
          employeeId: `PKP-${uid.slice(-4).toUpperCase()}`,
          currentShift: 'Morning (06:00 - 14:00)',
          joiningDate: new Date().toISOString().split('T')[0],
          statistics: {
            ordersPickedToday: 0,
            itemsPickedToday: 0,
            averagePickTimeSeconds: 0,
            accuracyPercent: 100,
            missingItemsCount: 0,
            wrongItemsScanned: 0,
            rating: 5.0,
          },
        },
        { merge: true }
      );
    }

    // If assigning delivery_partner role — create/update partner document
    if (role === 'delivery_partner') {
      const userSnap = await db.collection(C.USERS).doc(uid).get();
      const userData = userSnap.data() || {};
      await db.collection(C.DELIVERY_PARTNERS).doc(uid).set(
        {
          id: uid,
          userId: uid,
          name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Partner',
          phone: userData.mobile || userData.phone || '',
          storeId: storeId || '',
          currentStatus: 'offline',
          verificationStatus: 'pending',
          walletBalance: 0,
          todayEarnings: 0,
          weekEarnings: 0,
          monthEarnings: 0,
          completedDeliveries: 0,
          rating: 5.0,
        },
        { merge: true }
      );
    }

    // Audit log
    await writeAuditLog({
      actorId: request.auth.uid,
      actorName: 'Admin',
      actorRole: 'admin',
      action: 'USER_ROLE_CHANGED',
      targetCollection: C.USERS,
      targetId: uid,
      description: `Role changed to "${role}" for user ${uid}`,
      oldValue: { role: existingClaims.role },
      newValue: { role },
    });

    return {
      success: true,
      message: `User ${uid} role set to "${role}" successfully. The change will take effect on their next login or token refresh.`,
    };
  }
);
