"use strict";
/**
 * Cloud Function: onUserCreated
 *
 * Triggers when a new Firebase Auth user is created.
 * Automatically creates their Firestore user profile with role 'customer'.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveFcmToken = exports.updateUserProfile = exports.onUserCreated = void 0;
const https_1 = require("firebase-functions/v2/https");
const v1_1 = require("firebase-functions/v1");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
/**
 * Auth trigger: creates user profile on signup
 */
exports.onUserCreated = v1_1.auth.user().onCreate(async (user) => {
    const db = admin.firestore();
    try {
        const now = new Date().toISOString();
        const phone = user.phoneNumber || '';
        // Create user document in Firestore
        await db.collection(utils_1.C.USERS).doc(user.uid).set({
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
    }
    catch (err) {
        console.error('[onUserCreated] Error creating user profile:', err);
    }
});
/**
 * Callable: updateUserProfile
 * Allows a customer to update their own profile (name, email).
 */
exports.updateUserProfile = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = request.auth.uid;
    const { firstName, lastName, email } = request.data;
    const db = admin.firestore();
    const updates = {
        updatedAt: new Date().toISOString(),
    };
    if (firstName !== undefined)
        updates.firstName = firstName.trim();
    if (lastName !== undefined)
        updates.lastName = lastName.trim();
    if (email !== undefined) {
        // Basic email validation
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid email address.');
        }
        updates.email = email.toLowerCase().trim();
    }
    await db.collection(utils_1.C.USERS).doc(uid).update(updates);
    return { success: true, message: 'Profile updated successfully.' };
});
/**
 * Callable: saveFcmToken
 * Saves/updates the FCM token for the authenticated user.
 * Tokens are stored in users/{uid}/fcmTokens/{tokenId}
 */
exports.saveFcmToken = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const { fcmToken, deviceType, appVersion } = request.data;
    if (!fcmToken) {
        throw new https_1.HttpsError('invalid-argument', 'fcmToken is required.');
    }
    const uid = request.auth.uid;
    const db = admin.firestore();
    const tokenId = `tok-${fcmToken.slice(-16)}`;
    await db
        .collection(utils_1.C.USERS)
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
});
//# sourceMappingURL=userAuth.js.map