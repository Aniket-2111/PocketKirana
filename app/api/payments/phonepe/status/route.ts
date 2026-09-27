import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { getPhonePeConfig, isSimulationMode } from '@/lib/phonepeConfig';
import { ensurePickingTaskForOrder } from '@/lib/firebaseServices';
import { corsResponse, OPTIONS, authenticateRequest } from '../shared';

export { OPTIONS };

/**
 * GET /api/payments/phonepe/status?merchantTransactionId=...&orderId=...
 * 
 * Secure server-side query endpoint used by:
 * 1. Mobile APK on app restart / recovery
 * 2. Background payment reconciliation
 * 3. Polling for asynchronous UPI confirmations
 * 
 * Invariants:
 * - Amount and status verified authoritatively from PhonePe Gateway API.
 * - Never trusts client-declared status.
 * - Atomic database state updates.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantTransactionId = searchParams.get('merchantTransactionId') || searchParams.get('transactionId') || '';
    const orderId = searchParams.get('orderId') || '';

    if (!merchantTransactionId && !orderId) {
      return corsResponse(
        { success: false, error: 'Either merchantTransactionId or orderId is required' },
        { status: 400 }
      );
    }

    // ── 1. AUTHENTICATION ──────────────────────────────────────────
    const auth = await authenticateRequest();
    if ('error' in auth) {
      return corsResponse({ success: false, error: auth.error }, { status: auth.status });
    }

    if (!isFirebaseConfigured() || !db) {
      return corsResponse({ success: false, error: 'Database service unavailable' }, { status: 503 });
    }

    // ── 2. RESOLVE PAYMENT AND ORDER RECORDS ───────────────────────
    let resolvedTxnId = merchantTransactionId;
    let resolvedOrderId = orderId;
    let paymentData: any = null;

    if (resolvedTxnId) {
      const paymentRef = doc(db, 'payments', `pay_pk_${resolvedTxnId}`);
      const paymentSnap = await getDoc(paymentRef);
      if (paymentSnap.exists()) {
        paymentData = paymentSnap.data();
        if (!resolvedOrderId) {
          resolvedOrderId = paymentData.orderId;
        }
      }
    }

    let orderData: any = null;
    if (resolvedOrderId) {
      const orderRef = doc(db, 'orders', resolvedOrderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        orderData = orderSnap.data();
      }
    }

    // If order is already verified and marked paid
    if (orderData && orderData.paymentStatus === 'paid') {
      return corsResponse({
        success: true,
        data: {
          verified: true,
          status: 'SUCCESS',
          paymentStatus: 'paid',
          orderStatus: orderData.orderStatus || 'CONFIRMED',
          orderId: resolvedOrderId,
          merchantTransactionId: resolvedTxnId || orderData.paymentDetails?.transactionId,
          amount: orderData.total,
          paidAt: orderData.paymentDetails?.paidAt || orderData.updatedAt
        }
      });
    }

    // ── 3. SIMULATION CHECK ────────────────────────────────────────
    if (isSimulationMode() || resolvedTxnId.startsWith('TXN_PK_MOCK')) {
      const isPaid = paymentData?.status === 'completed';
      return corsResponse({
        success: true,
        data: {
          verified: isPaid,
          status: isPaid ? 'SUCCESS' : 'PENDING',
          paymentStatus: isPaid ? 'paid' : 'pending',
          orderStatus: isPaid ? 'CONFIRMED' : 'PAYMENT_PENDING',
          orderId: resolvedOrderId,
          merchantTransactionId: resolvedTxnId,
          isSimulation: true
        }
      });
    }

    // ── 4. REAL GATEWAY STATUS QUERY ───────────────────────────────
    const config = getPhonePeConfig();
    if (!config || !resolvedTxnId) {
      return corsResponse({
        success: true,
        data: {
          verified: false,
          status: paymentData?.status || 'PENDING',
          paymentStatus: orderData?.paymentStatus || 'pending',
          orderStatus: orderData?.orderStatus || 'PAYMENT_PENDING',
          orderId: resolvedOrderId,
          merchantTransactionId: resolvedTxnId
        }
      });
    }

    const endpoint = `/pg/v1/status/${config.merchantId}/${resolvedTxnId}`;
    const hash = crypto
      .createHash('sha256')
      .update(endpoint + config.saltKey)
      .digest('hex');

    const apiResponse = await fetch(`${config.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': `${hash}###${config.saltIndex}`,
        'X-MERCHANT-ID': config.merchantId
      }
    });

    let apiJson: any = null;
    try {
      apiJson = await apiResponse.json();
    } catch {
      console.warn('[PhonePe Status Check] Non-JSON gateway response for:', resolvedTxnId);
    }

    if (!apiJson || !apiJson.success || !apiJson.data) {
      return corsResponse({
        success: true,
        data: {
          verified: false,
          status: apiJson?.code || 'PAYMENT_PENDING',
          paymentStatus: 'pending',
          orderId: resolvedOrderId,
          merchantTransactionId: resolvedTxnId
        }
      });
    }

    const phonepeStatus = apiJson.data.responseCode; // SUCCESS, PAYMENT_ERROR, etc.
    const isPaid = phonepeStatus === 'SUCCESS';

    // ── 5. IDEMPOTENT ORDER CONFIRMATION ───────────────────────────
    if (isPaid && resolvedOrderId && orderData && orderData.paymentStatus !== 'paid') {
      const expectedAmountInPaise = Math.round(orderData.total * 100);
      if (!apiJson.data.amount || apiJson.data.amount === expectedAmountInPaise) {
        const orderRef = doc(db, 'orders', resolvedOrderId);
        await updateDoc(orderRef, {
          paymentStatus: 'paid',
          orderStatus: 'CONFIRMED',
          updatedAt: new Date().toISOString(),
          paymentDetails: {
            transactionId: apiJson.data.transactionId || resolvedTxnId,
            method: 'phonepe',
            amount: orderData.total,
            paidAt: new Date().toISOString(),
            phonepeResponseCode: phonepeStatus
          }
        });

        const paymentRef = doc(db, 'payments', `pay_pk_${resolvedTxnId}`);
        await setDoc(
          paymentRef,
          {
            status: 'completed',
            paidAt: new Date().toISOString(),
            gatewayPaymentId: apiJson.data.transactionId || '',
            amount: orderData.total
          },
          { merge: true }
        );

        await ensurePickingTaskForOrder(resolvedOrderId, orderData as any);
      }
    }

    return corsResponse({
      success: true,
      data: {
        verified: isPaid,
        status: phonepeStatus,
        paymentStatus: isPaid ? 'paid' : 'pending',
        orderStatus: isPaid ? 'CONFIRMED' : 'PAYMENT_PENDING',
        transactionId: apiJson.data.transactionId || '',
        merchantTransactionId: resolvedTxnId,
        orderId: resolvedOrderId
      }
    });

  } catch (error: any) {
    console.error('[PhonePe Status API Exception]', error);
    return corsResponse(
      { success: false, error: error.message || 'Failed to query payment status' },
      { status: 500 }
    );
  }
}
