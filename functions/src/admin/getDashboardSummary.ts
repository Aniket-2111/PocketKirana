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

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { C } from '../utils';

export const getDashboardSummary = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const callerRole = request.auth.token.role;
    const isAdmin = callerRole === 'admin' || request.auth.token.admin === true;

    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Only admins can access dashboard summary.');
    }

    const db = admin.firestore();
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      // 1. Get active orders count (status not in COMPLETED or CANCELLED)
      const activeOrdersQuery = db.collection(C.ORDERS)
        .where('orderStatus', 'not-in', ['COMPLETED', 'CANCELLED']);
      
      const activeOrdersCountSnap = await activeOrdersQuery.count().get();
      const activeOrdersCount = activeOrdersCountSnap.data().count;

      // 2. Get today's total revenue and orders count
      const todayStart = new Date(todayStr + 'T00:00:00.000Z').toISOString();
      const todayOrdersQuery = db.collection(C.ORDERS)
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
      const onlinePartnersQuery = db.collection(C.DELIVERY_PARTNERS)
        .where('currentStatus', '==', 'online');
      
      const onlinePartnersSnap = await onlinePartnersQuery.count().get();
      const onlinePartnersCount = onlinePartnersSnap.data().count;

      // 4. Get active pickers count
      const activePickersQuery = db.collection(C.PICKERS)
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
    } catch (error: any) {
      console.error('Error generating dashboard summary:', error);
      throw new HttpsError('internal', error.message || 'Failed to fetch dashboard summary.');
    }
  }
);
