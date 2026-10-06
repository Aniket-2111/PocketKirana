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

import { onCall, HttpsError } from 'firebase-functions/v2/https';

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface PlaceOrderInput {
  cartItems: CartItemInput[];
  addressId: string;
  paymentMethod: 'cod' | 'phonepe' | 'upi' | 'card';
  couponCode?: string;
  storeId?: string;
}

export const placeOrder = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    // ── PERMANENT DECOMMISSION GUARD ──────────────────────────────
    // The legacy Firebase Cloud Function order-creation authority is disabled.
    // All customer orders must be created authoritatively through POST /api/checkout.
    throw new HttpsError(
      'failed-precondition',
      'Legacy Firebase placeOrder is decommissioned. All customer orders must be created via the canonical POST /api/checkout endpoint.',
      {
        code: 'LEGACY_ORDER_PATH_DECOMMISSIONED',
        canonicalEndpoint: '/api/checkout',
      }
    );
  }
);
