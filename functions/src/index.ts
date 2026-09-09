/**
 * PocketKirana Cloud Functions — Main Entry Point
 *
 * All exported functions from this file are deployed to Firebase Cloud Functions.
 * Region: asia-south1 (Mumbai) for lowest latency for Indian users.
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (once, at cold start)
if (!admin.apps.length) {
  admin.initializeApp();
}

// ══════════════════════════════════════════
// INVENTORY FUNCTIONS
// ══════════════════════════════════════════

export { validateDeliveryZone } from './inventory/validateDeliveryZone';
export { scanBarcode } from './inventory/scanBarcode';
export { confirmPutaway } from './inventory/putaway';
export { releaseExpiredReservations } from './inventory/releaseExpiredReservations';

// ══════════════════════════════════════════
// ORDER FUNCTIONS
// ══════════════════════════════════════════

export { placeOrder } from './orders/placeOrder';
export { cancelOrder } from './orders/cancelOrder';
export { autoCompleteOrders } from './orders/autoCompleteOrders';

// ══════════════════════════════════════════
// DELIVERY FUNCTIONS (Callables)
// ══════════════════════════════════════════

export {
  acceptDeliveryAssignment,
  rejectDeliveryAssignment,
} from './delivery/acceptAssignment';

export { verifyStorePickup, updateDeliveryStage } from './delivery/verifyPickup';

export {
  completeDelivery,
  recordDeliveryFailure,
} from './delivery/completeDelivery';

// ══════════════════════════════════════════
// DELIVERY FUNCTIONS (Firestore Triggers)
// ══════════════════════════════════════════

export { assignDeliveryPartner } from './delivery/assignPartner';

export { setUserRole } from './auth/setUserRole';
export { onUserCreated, updateUserProfile, saveFcmToken } from './auth/userAuth';

// ══════════════════════════════════════════
// ADMIN FUNCTIONS
// ══════════════════════════════════════════

export { getDashboardSummary } from './admin/getDashboardSummary';
