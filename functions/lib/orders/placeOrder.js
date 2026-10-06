"use strict";
/**
 * Cloud Function: placeOrder
 *
 * @deprecated DECOMMISSIONED / NON-AUTHORITATIVE
 *
 * This Cloud Function previously handled order creation in Firestore.
 * It has been permanently decommissioned as an order-creation authority.
 *
 * CANONICAL ORDER AUTHORITY:
 * All customer orders must be created authoritatively via:
 *   POST /api/checkout
 * backed by PostgreSQL transactions, FEFO batch reservations,
 * and canonical server-side serviceability evaluation.
 *
 * Any invocation of this callable is unconditionally rejected.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeOrder = void 0;
const https_1 = require("firebase-functions/v2/https");
exports.placeOrder = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    // ── PERMANENT DECOMMISSION GUARD ──────────────────────────────
    // The legacy Firebase Cloud Function order-creation authority is disabled.
    // All customer orders must be created authoritatively through POST /api/checkout.
    throw new https_1.HttpsError('failed-precondition', 'Legacy Firebase placeOrder is decommissioned. All customer orders must be created via the canonical POST /api/checkout endpoint.', {
        code: 'LEGACY_ORDER_PATH_DECOMMISSIONED',
        canonicalEndpoint: '/api/checkout',
    });
});
//# sourceMappingURL=placeOrder.js.map