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

    // Mock transaction ids may ONLY be verified while simulation mode is explicitly active.
    const isMockOrder = String(orderId || '').includes('test_phonepe_');
    const isMockTxn = String(merchantTransactionId || '').startsWith('TXN_PK_MOCK');

    if ((isMockOrder || isMockTxn) && !simulation) {
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

          // Authoritative PostgreSQL transition
          try {
            const { OrderService } = await import('@/lib/services/orderService');
            await OrderService.transitionOrder({
              orderId,
              targetStatus: 'CONFIRMED',
              actorId: 'sim-phonepe-verify',
              actorRole: 'system',
              reason: `Simulation payment verified: ${txnId}`,
              metadata: {
                paymentMethod: 'phonepe',
                merchantTransactionId,
                gatewayPaymentId: txnId,
                amount: orderData.total,
              },
            });
          } catch (pgErr: any) {
            console.warn('[PhonePe Verify Sim] PG transition fallback:', pgErr.message);
          }

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

    const { queryPostgres, withTransaction } = await import('@/lib/postgres');

    // ── 2. FETCH AUTHORITATIVE POSTGRESQL ORDER ───────────────────────
    let pgOrder: any = null;
    try {
      const pgOrderRes = await queryPostgres(
        `SELECT id, order_number, firebase_uid, total_amount, order_status, payment_status
         FROM orders
         WHERE id = $1 OR order_number = $1`,
        [resolvedOrderId]
      );
      if (pgOrderRes && pgOrderRes.rows && pgOrderRes.rows.length > 0) {
        pgOrder = pgOrderRes.rows[0];
      }
    } catch (pgErr: any) {
      console.warn('[PhonePe Verify] PG query notice:', pgErr.message);
    }

    const orderRef = doc(db, 'orders', resolvedOrderId);
    const orderSnap = await getDoc(orderRef);
    const orderData = orderSnap.exists() ? orderSnap.data() : null;

    // ── 3. VALIDATE AUTHORITATIVE AMOUNT ──────────────────────────────
    const expectedAmountInPaise = pgOrder
      ? Math.round(Number(pgOrder.total_amount) * 100)
      : orderData
        ? Math.round(Number(orderData.total) * 100)
        : null;

    if (isPaid && apiJson.data.amount && expectedAmountInPaise && apiJson.data.amount !== expectedAmountInPaise) {
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

    // ── 4. AUTHORITATIVE ATOMIC POSTGRESQL RECONCILIATION & UPDATE ────
    if (isPaid) {
      if (pgOrder) {
        const { appendOutboxEvent } = await import('@/lib/db/outbox');

        await withTransaction(async (client) => {
          // 1. SELECT the order FOR UPDATE to serialize concurrent verification attempts
          const lockRes = await client.query(
            `SELECT id, order_number, firebase_uid, total_amount, order_status, payment_status, delivery_otp
             FROM orders
             WHERE id = $1 OR order_number = $1
             FOR UPDATE`,
            [resolvedOrderId]
          );

          if (lockRes.rowCount === 0) {
            return;
          }

          const currentOrder = lockRes.rows[0];
          const currentOrderStatus = (currentOrder.order_status?.toUpperCase() || 'PLACED');
          const currentPaymentStatus = currentOrder.payment_status || 'pending';

          // 2. Determine whether reconciliation is required
          const isOrderAlreadyConfirmed = currentOrderStatus === 'CONFIRMED';
          const isPaymentAlreadyPaid = currentPaymentStatus === 'paid';

          if (isOrderAlreadyConfirmed && isPaymentAlreadyPaid) {
            // Idempotent fast-path: both order and payment are already confirmed
            return;
          }

          // 3. Atomically update BOTH order_status and payment_status in ONE statement
          await client.query(
            `UPDATE orders 
             SET order_status = 'CONFIRMED',
                 payment_status = 'paid',
                 confirmed_at = COALESCE(confirmed_at, NOW()),
                 updated_at = NOW() 
             WHERE id = $1`,
            [currentOrder.id]
          );

          // 4. Upsert payments row
          const paymentId = `pay_pk_${merchantTransactionId}`;
          await client.query(
            `INSERT INTO payments (
               id, order_id, firebase_uid, payment_method, amount, currency,
               status, gateway, gateway_order_id, gateway_payment_id, paid_at
             ) VALUES ($1, $2, $3, 'phonepe', $4, 'INR', 'completed', 'phonepe', $5, $6, NOW())
             ON CONFLICT (id) DO UPDATE SET
               status = 'completed',
               gateway_payment_id = $6,
               paid_at = NOW(),
               updated_at = NOW()`,
            [
              paymentId,
              currentOrder.id,
              currentOrder.firebase_uid || orderData?.customerId || '',
              currentOrder.total_amount,
              merchantTransactionId,
              apiJson.data.transactionId || '',
            ]
          );

          // 5. Insert payment_transactions ledger entry with unique constraint protection
          await client.query(
            `INSERT INTO payment_transactions (
               id, payment_id, transaction_id, transaction_type, amount, status, response_data
             ) VALUES ($1, $2, $3, 'VERIFY_PAYMENT', $4, 'SUCCESS', $5)
             ON CONFLICT (transaction_id) DO NOTHING`,
            [
              `ptxn_${Date.now()}`,
              paymentId,
              apiJson.data.transactionId || merchantTransactionId,
              currentOrder.total_amount,
              JSON.stringify(apiJson.data),
            ]
          );

          // 6. Record order status history ONLY if order was not already CONFIRMED
          if (!isOrderAlreadyConfirmed) {
            const historyId = `osh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            await client.query(
              `INSERT INTO order_status_history (
                 id, order_id, old_status, new_status, changed_by, notes, created_at
               ) VALUES ($1, $2, $3, 'CONFIRMED', 'system:phonepe-verify-system', $4, NOW())`,
              [
                historyId,
                currentOrder.id,
                currentOrderStatus,
                `PhonePe verified payment: ${apiJson.data.transactionId || merchantTransactionId}`,
              ]
            );
          }

          // 7. Append order.confirmed outbox event ONLY if order was not already CONFIRMED
          if (!isOrderAlreadyConfirmed) {
            await appendOutboxEvent(client, {
              aggregateType: 'order',
              aggregateId: currentOrder.id,
              eventType: 'order.confirmed',
              payload: {
                orderId: currentOrder.id,
                orderNumber: currentOrder.order_number,
                previousStatus: currentOrderStatus,
                newStatus: 'CONFIRMED',
                actorId: 'phonepe-verify-system',
                actorRole: 'system',
                metadata: {
                  paymentMethod: 'phonepe',
                  merchantTransactionId,
                  gatewayPaymentId: apiJson.data.transactionId || '',
                  amount: currentOrder.total_amount,
                },
                updatedAt: new Date().toISOString(),
              },
            });
          }
        });
      }

      // ── 5. SECONDARY FIRESTORE PROJECTION SYNC & PICKING TASK ───────
      // Executed strictly after PostgreSQL reconciliation completes successfully.
      try {
        if (orderRef && orderSnap.exists()) {
          const currentOrderData = orderSnap.data();
          if (currentOrderData.paymentStatus !== 'paid' || currentOrderData.orderStatus !== 'CONFIRMED') {
            await updateDoc(orderRef, {
              paymentStatus: 'paid',
              orderStatus: 'CONFIRMED',
              updatedAt: new Date().toISOString(),
              paymentDetails: {
                transactionId: apiJson.data.transactionId || merchantTransactionId,
                method: 'phonepe',
                amount: pgOrder ? Number(pgOrder.total_amount) : currentOrderData.total,
                paidAt: new Date().toISOString(),
                phonepeResponseCode: phonepeStatus
              }
            });
          }

          await setDoc(
            paymentRef,
            {
              status: 'completed',
              paidAt: new Date().toISOString(),
              gatewayPaymentId: apiJson.data.transactionId || '',
              amount: pgOrder ? Number(pgOrder.total_amount) : currentOrderData.total
            },
            { merge: true }
          );

          await ensurePickingTaskForOrder(resolvedOrderId, currentOrderData as any);
        }
      } catch (fsErr: any) {
        console.warn('[PhonePe Verify] Firestore projection sync warning:', fsErr.message);
      }
    } else if (['PAYMENT_ERROR', 'TIMED_OUT', 'PAYMENT_DECLINED'].includes(phonepeStatus)) {
      await setDoc(
        paymentRef,
        { status: 'failed', failureReason: apiJson.message || 'Payment failed on PhonePe gateway' },
        { merge: true }
      );
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
