import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { getPhonePeConfig, isSimulationMode } from '@/lib/phonepeConfig';
import { ensurePickingTaskForOrder } from '@/lib/firebaseServices';
import { corsResponse, OPTIONS, authenticateRequest } from '../shared';

export { OPTIONS };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchantTransactionId, orderId, isMockSuccess } = body;

    if (!merchantTransactionId) {
      return corsResponse(
        { success: false, error: 'Missing merchantTransactionId parameter' },
        { status: 400 }
      );
    }

    // ── 0. AUTHENTICATION (fail closed when middleware is enabled) ──
    const auth = await authenticateRequest();
    if ('error' in auth) {
      return corsResponse({ success: false, error: auth.error }, { status: auth.status });
    }

    const config = getPhonePeConfig();
    const simulation = isSimulationMode();

    // Mock transaction ids may ONLY be verified while simulation mode is on.
    const isMockOrder = String(orderId || '').includes('test_phonepe_');

    if (isMockOrder && !simulation) {
      return corsResponse({ success: false, error: 'Invalid transaction reference' }, { status: 400 });
    }

    // ── 1. SIMULATION (explicit opt-in only) ───────────────────────
    if (simulation) {
      const mockSuccess = isMockSuccess !== false;

      if (!mockSuccess) {
        if (isFirebaseConfigured() && db && !isMockOrder && orderId) {
          const paymentRef = doc(db, 'payments', `pay_pk_${merchantTransactionId}`);
          await setDoc(paymentRef, { status: 'failed', failureReason: 'Mock checkout failure' }, { merge: true });
        }
        return corsResponse({
          success: true,
          data: { verified: false, status: 'FAILED', isSimulation: true }
        });
      }

      if (isFirebaseConfigured() && db && !isMockOrder && orderId) {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists() && orderSnap.data().paymentStatus !== 'paid') {
          const orderData = orderSnap.data();
          const txnId = `txn_sim_ph_${Date.now()}`;

          await updateDoc(orderRef, {
            paymentStatus: 'paid',
            orderStatus: 'CONFIRMED',
            updatedAt: new Date().toISOString(),
            paymentDetails: {
              transactionId: txnId,
              method: 'phonepe',
              amount: orderData.total,
              verifiedAt: new Date().toISOString()
            }
          });

          await setDoc(
            doc(db, 'payments', `pay_pk_${merchantTransactionId}`),
            { status: 'completed', paidAt: new Date().toISOString(), gatewayPaymentId: txnId },
            { merge: true }
          );

          await ensurePickingTaskForOrder(orderId, orderData as any);
        }
      }

      return corsResponse({
        success: true,
        data: {
          verified: true,
          status: 'SUCCESS',
          transactionId: `txn_sim_ph_${Date.now()}`,
          isSimulation: true
        }
      });
    }

    // ── 2. REAL GATEWAY ────────────────────────────────────────────
    if (!config) {
      console.error(
        '[PhonePe Verify] Gateway not configured (PHONEPE_MERCHANT_ID / PHONEPE_SALT_KEY missing). Set credentials or PHONEPE_SIMULATION_MODE=true for local dev.'
      );
      return corsResponse(
        { success: false, error: 'Payment gateway is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    if (!isFirebaseConfigured() || !db) {
      return corsResponse({ success: false, error: 'Database is not connected' }, { status: 500 });
    }

    // Status query signature: SHA256("/pg/v1/status/{merchantId}/{txnId}" + saltKey) + "###" + saltIndex
    const endpoint = `/pg/v1/status/${config.merchantId}/${merchantTransactionId}`;
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

    // Gateway can return empty/non-JSON bodies on hiccups or unknown txns —
    // parse defensively so users see "pending", never a 500 crash.
    let apiJson: any = null;
    try {
      apiJson = await apiResponse.json();
    } catch {
      console.error('[PhonePe Status Check] Non-JSON gateway response', { httpStatus: apiResponse.status });
    }

    if (!apiJson || !apiJson.success || !apiJson.data) {
      console.error('[PhonePe Status Check Failure]', { httpStatus: apiResponse.status, body: apiJson });
      return corsResponse({
        success: true,
        data: {
          verified: false,
          status: apiJson?.code || 'PAYMENT_PENDING',
          responseCode: apiJson?.code
        }
      });
    }

    const phonepeStatus = apiJson.data.responseCode; // SUCCESS, PAYMENT_ERROR, etc.
    const isPaid = phonepeStatus === 'SUCCESS';

    // Resolve which order this transaction belongs to (payment doc is authoritative)
    const paymentRef = doc(db, 'payments', `pay_pk_${merchantTransactionId}`);
    const paymentSnap = await getDoc(paymentRef);
    const resolvedOrderId = paymentSnap.exists() ? paymentSnap.data().orderId || orderId : orderId;

    if (!resolvedOrderId) {
      return corsResponse({
        success: true,
        data: {
          verified: isPaid,
          status: phonepeStatus,
          transactionId: apiJson.data.transactionId || '',
          isSimulation: false
        }
      });
    }

    const orderRef = doc(db, 'orders', resolvedOrderId);
    const orderSnap = await getDoc(orderRef);

    if (orderSnap.exists()) {
      const orderData = orderSnap.data();
      const expectedAmountInPaise = Math.round(orderData.total * 100);

      if (isPaid && apiJson.data.amount && apiJson.data.amount !== expectedAmountInPaise) {
        console.warn('[PhonePe Amount Mismatch]', {
          phonepeAmountInPaise: apiJson.data.amount,
          expectedAmountInPaise
        });
        await setDoc(
          paymentRef,
          { status: 'failed', failureReason: `Amount mismatch: expected ${expectedAmountInPaise} paise, got ${apiJson.data.amount} paise` },
          { merge: true }
        );
        return corsResponse({ success: true, data: { verified: false, status: 'AMOUNT_MISMATCH' } });
      }

      // ── 3. IDEMPOTENT DB UPDATE ──────────────────────────────────
      if (isPaid) {
        if (orderData.paymentStatus !== 'paid') {
          await updateDoc(orderRef, {
            paymentStatus: 'paid',
            orderStatus: 'CONFIRMED',
            updatedAt: new Date().toISOString(),
            paymentDetails: {
              transactionId: apiJson.data.transactionId || merchantTransactionId,
              method: 'phonepe',
              amount: orderData.total,
              paidAt: new Date().toISOString(),
              phonepeResponseCode: phonepeStatus
            }
          });

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

          // Send order to Picker Queue
          await ensurePickingTaskForOrder(resolvedOrderId, orderData as any);
        }
      } else if (['PAYMENT_ERROR', 'TIMED_OUT', 'PAYMENT_DECLINED'].includes(phonepeStatus)) {
        await setDoc(
          paymentRef,
          { status: 'failed', failureReason: apiJson.message || 'Payment failed on PhonePe gateway' },
          { merge: true }
        );
      }
    }

    return corsResponse({
      success: true,
      data: {
        verified: isPaid,
        status: phonepeStatus,
        transactionId: apiJson.data.transactionId || '',
        isSimulation: false
      }
    });
  } catch (error: any) {
    console.error('[PhonePe Verify Order Exception]', error);
    return corsResponse(
      { success: false, error: error.message || 'Server verification failed' },
      { status: 500 }
    );
  }
}
