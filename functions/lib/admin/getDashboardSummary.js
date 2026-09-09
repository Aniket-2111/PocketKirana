"use strict";
/**
 * Cloud Function: getDashboardSummary
 *
 * Server-side aggregation endpoint for the Admin Portal dashboard.
 * Uses cheap Firestore count() aggregation queries to count active orders,
 * online partners, and active pickers without downloading any documents.
 * Also sums today's total revenue from orders placed today.
 *
 * Region: asia-south1
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
exports.getDashboardSummary = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
exports.getDashboardSummary = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const callerRole = request.auth.token.role;
    const isAdmin = callerRole === 'admin' || request.auth.token.admin === true;
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Only admins can access dashboard summary.');
    }
    const db = admin.firestore();
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    try {
        // 1. Get active orders count (status not in COMPLETED or CANCELLED)
        const activeOrdersQuery = db.collection(utils_1.C.ORDERS)
            .where('orderStatus', 'not-in', ['COMPLETED', 'CANCELLED']);
        const activeOrdersCountSnap = await activeOrdersQuery.count().get();
        const activeOrdersCount = activeOrdersCountSnap.data().count;
        // 2. Get today's total revenue and orders count
        const todayStart = new Date(todayStr + 'T00:00:00.000Z').toISOString();
        const todayOrdersQuery = db.collection(utils_1.C.ORDERS)
            .where('placedAt', '>=', todayStart);
        const todayOrdersSnap = await todayOrdersQuery.get();
        let todayRevenue = 0;
        let todayOrdersCount = 0;
        todayOrdersSnap.forEach((doc) => {
            const order = doc.data();
            if (order.orderStatus !== 'CANCELLED') {
                todayRevenue += order.total || 0;
                todayOrdersCount++;
            }
        });
        // 3. Get online delivery partners count
        const onlinePartnersQuery = db.collection(utils_1.C.DELIVERY_PARTNERS)
            .where('currentStatus', '==', 'online');
        const onlinePartnersSnap = await onlinePartnersQuery.count().get();
        const onlinePartnersCount = onlinePartnersSnap.data().count;
        // 4. Get active pickers count
        const activePickersQuery = db.collection(utils_1.C.PICKERS)
            .where('status', '==', 'active');
        const activePickersSnap = await activePickersQuery.count().get();
        const activePickersCount = activePickersSnap.data().count;
        return {
            success: true,
            summary: {
                activeOrdersCount,
                todayOrdersCount,
                todayRevenue: Math.round(todayRevenue),
                onlinePartnersCount,
                activePickersCount,
            }
        };
    }
    catch (error) {
        console.error('Error generating dashboard summary:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to fetch dashboard summary.');
    }
});
//# sourceMappingURL=getDashboardSummary.js.map