import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { getPhonePeConfig, isSimulationMode } from '@/lib/phonepeConfig';
import { ensurePickingTaskForOrder } from '@/lib/firebaseServices';
import { corsResponse, OPTIONS, authenticateRequest } from '../shared';
import { getPostgresPool } from '@/lib/postgres';
import { appendOutboxEvent } from '@/lib/db/outbox';

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
 * - Authoritative PostgreSQL ACID reconciliation (orders, payments, payment_transactions, outbox).
 * - Row-level locking (SELECT FOR UPDATE) to prevent concurrency races.
 * - Idempotent execution preventing duplicate transactions or outbox events.
 * - Firestore and picker queue updated only as post-commit read projections.
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

    let resolvedTxnId = merchantTransactionId;
    let resolvedOrderId = orderId;

    // ── 2. EXTRACT CANDIDATE IDENTIFIERS ───────────────────────────
    const candidateIdentifiers: string[] = [];
    if (resolvedOrderId) {
      candidateIdentifiers.push(resolvedOrderId.trim());
    }

    if (resolvedTxnId) {
      candidateIdentifiers.push(resolvedTxnId.trim());
      const parts = String(resolvedTxnId).split('_');
      if (parts.length >= 3) {
        if (parts[2] === 'MOCK' && parts.length >= 4) {
          candidateIdentifiers.push(parts[3].trim());
        } else {
          candidateIdentifiers.push(parts[2].trim());
        }
      }
    }

    // Check Firestore payment doc if available to discover linked orderId
    if (isFirebaseConfigured() && db && resolvedTxnId) {
      try {
        const paymentRef = doc(db, 'payments', `pay_pk_${resolvedTxnId}`);
        const paymentSnap = await getDoc(paymentRef);
        if (paymentSnap && typeof paymentSnap.exists === 'function' && paymentSnap.exists()) {
          const pData = paymentSnap.data() as any;
          if (pData?.orderId) {
            candidateIdentifiers.push(String(pData.orderId).trim());
            if (!resolvedOrderId) {
              resolvedOrderId = String(pData.orderId).trim();
            }
          }
        }
      } catch (err: any) {
        console.warn('[PhonePe Status] Payment doc lookup warning:', err.message);
      }
    }

    const uniqueCandidates = Array.from(new Set(candidateIdentifiers.filter(Boolean)));

    // ── 3. SIMULATION MODE CHECK ───────────────────────────────────
    if (isSimulationMode()) {
      return corsResponse({
        success: true,
        data: {
          verified: true,
          status: 'SUCCESS',
          paymentStatus: 'paid',
          orderStatus: 'CONFIRMED',
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
          status: 'PENDING',
          paymentStatus: 'pending',
          orderStatus: 'PAYMENT_PENDING',
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

    // ── 5. NON-SUCCESS PHONEPE STATES (Fail-Closed) ────────────────
    if (!isPaid) {
      return corsResponse({
        success: true,
        data: {
          verified: false,
          status: phonepeStatus,
          paymentStatus: 'pending',
          orderStatus: 'PAYMENT_PENDING',
          transactionId: apiJson.data.transactionId || '',
          merchantTransactionId: resolvedTxnId,
          orderId: resolvedOrderId
        }
      });
    }

    // ── 6. ATOMIC POSTGRESQL RECONCILIATION FOR SUCCESS ────────────
    const pool = getPostgresPool();
    if (!pool) {
      console.error('[PhonePe Status] PostgreSQL pool unavailable');
      return corsResponse({ success: false, error: 'Database unavailable' }, { status: 500 });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ── 7. RESOLVE AUTHORITATIVE ORDER WITH ROW LOCK ──────────────
      if (uniqueCandidates.length === 0) {
        await client.query('ROLLBACK');
        console.error(`[PhonePe Status Recovery Failed] No candidate order identifiers found for transaction: ${resolvedTxnId}`);
        return corsResponse({ success: false, error: 'Associated order not found' }, { status: 404 });
      }

      const whereClauses = uniqueCandidates.map((_, idx) => `id = $${idx + 1} OR order_number = $${idx + 1}`);
      const orderQuery = `
        SELECT id, order_number, firebase_uid, total_amount, payment_status, order_status
        FROM orders
        WHERE ${whereClauses.join(' OR ')}
        LIMIT 1
        FOR UPDATE
      `;

      const orderRes = await client.query(orderQuery, uniqueCandidates);

      // ── 8. ORDER EXISTENCE GATE ────────────────────────────────────
      if (!orderRes || orderRes.rowCount === 0 || !orderRes.rows[0]) {
        await client.query('ROLLBACK');
        console.error(`[PhonePe Status Recovery Failed] No authoritative order found in PostgreSQL for transaction: ${resolvedTxnId}, candidates: ${uniqueCandidates.join(', ')}`);
        return corsResponse({ success: false, error: 'Associated order not found' }, { status: 404 });
      }

      const currentOrder = orderRes.rows[0];
      const canonicalOrderId = currentOrder.id;
      const dbCustomerId = currentOrder.customer_id || currentOrder.firebase_uid || 'usr-cust-1';

      // ── 9. AMOUNT VERIFICATION ─────────────────────────────────────
      const expectedAmountInPaise = Math.round(Number(currentOrder.total_amount) * 100);
      const paidAmountInPaise = Number(apiJson.data.amount);

      if (isNaN(paidAmountInPaise) || paidAmountInPaise !== expectedAmountInPaise) {
        console.error('[PhonePe Status Amount Mismatch]', { paidAmountInPaise, expectedAmountInPaise });
        await client.query('ROLLBACK');
        return corsResponse({ success: false, error: 'Payment amount mismatch' }, { status: 400 });
      }

      // ── 10. IDEMPOTENCY CHECK ──────────────────────────────────────
      const isOrderAlreadyPaid =
        currentOrder.order_status === 'CONFIRMED' && currentOrder.payment_status === 'paid';

      const gatewayTransactionId = apiJson.data.transactionId || resolvedTxnId;

      const existingTx = await client.query(
        `SELECT id FROM payment_transactions WHERE transaction_id = $1`,
        [gatewayTransactionId]
      );

      if (isOrderAlreadyPaid || (existingTx && existingTx.rowCount && existingTx.rowCount > 0)) {
        await client.query('COMMIT');
        console.log(`[PhonePe Status Idempotency] Order ${canonicalOrderId} already confirmed & paid.`);
        return corsResponse({
          success: true,
          message: 'Payment already processed',
          data: {
            verified: true,
            status: 'SUCCESS',
            paymentStatus: 'paid',
            orderStatus: 'CONFIRMED',
            transactionId: gatewayTransactionId,
            merchantTransactionId: resolvedTxnId,
            orderId: canonicalOrderId,
            amount: Number(currentOrder.total_amount)
          }
        });
      }

      // ── 11. ATOMIC POSTGRESQL PERSISTENCE ──────────────────────────
      const paymentId = `pay_pk_${resolvedTxnId}`;

      // a. Upsert payments record
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
          canonicalOrderId,
          dbCustomerId,
          currentOrder.total_amount,
          resolvedTxnId,
          gatewayTransactionId,
        ]
      );

      // b. Insert payment_transactions ledger
      await client.query(
        `INSERT INTO payment_transactions (
           id, payment_id, transaction_id, transaction_type, amount, status, response_data
         ) VALUES ($1, $2, $3, 'STATUS_RECOVERY', $4, 'SUCCESS', $5)
         ON CONFLICT (transaction_id) DO NOTHING`,
        [
          `ptxn_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          paymentId,
          gatewayTransactionId,
          currentOrder.total_amount,
          JSON.stringify(apiJson),
        ]
      );

      // c. Update orders table with explicit rowCount verification
      const updateRes = await client.query(
        `UPDATE orders 
         SET payment_status = 'paid', 
             order_status = 'CONFIRMED', 
             confirmed_at = COALESCE(confirmed_at, NOW()), 
             updated_at = NOW() 
         WHERE id = $1`,
        [canonicalOrderId]
      );

      if (!updateRes || updateRes.rowCount !== 1) {
        throw new Error(
          `Failed to update order state: expected 1 row affected, got ${updateRes?.rowCount ?? 0}`
        );
      }

      // d. Record order status transition history
      const historyId = `osh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO order_status_history (
           id, order_id, old_status, new_status, changed_by, notes, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          historyId,
          canonicalOrderId,
          currentOrder.order_status,
          'CONFIRMED',
          'system:phonepe_status_recovery',
          `PhonePe payment confirmed via status recovery: ${gatewayTransactionId}`,
        ]
      );

      // e. Enqueue transactional outbox event
      await appendOutboxEvent(client, {
        aggregateType: 'payment',
        aggregateId: paymentId,
        eventType: 'payment.confirmed',
        payload: {
          paymentId,
          orderId: canonicalOrderId,
          orderNumber: currentOrder.order_number,
          customerId: dbCustomerId,
          amount: Number(currentOrder.total_amount),
          gateway: 'phonepe',
          transactionId: gatewayTransactionId,
          paidAt: new Date().toISOString(),
        },
      });

      // ── 12. COMMIT TRANSACTION ─────────────────────────────────────
      await client.query('COMMIT');

      // ── 13. DOWNSTREAM READ PROJECTIONS TO FIRESTORE (AFTER COMMIT ONLY) ──
      try {
        if (isFirebaseConfigured() && db) {
          const orderRef = doc(db, 'orders', canonicalOrderId);
          try {
            await updateDoc(orderRef, {
              paymentStatus: 'paid',
              orderStatus: 'CONFIRMED',
              updatedAt: new Date().toISOString(),
              paymentDetails: {
                transactionId: gatewayTransactionId,
                method: 'phonepe',
                amount: Number(currentOrder.total_amount),
                paidAt: new Date().toISOString(),
                phonepeResponseCode: phonepeStatus,
              },
            });
          } catch (err: any) {
            console.warn('[PhonePe Status] Firestore order projection warning:', err?.message);
          }

          try {
            const paymentDocRef = doc(db, 'payments', paymentId);
            await setDoc(
              paymentDocRef,
              {
                paymentId,
                orderId: canonicalOrderId,
                customerId: dbCustomerId,
                amount: Number(currentOrder.total_amount),
                currency: 'INR',
                method: 'phonepe',
                status: 'completed',
                gateway: 'phonepe',
                gatewayOrderId: resolvedTxnId,
                gatewayPaymentId: gatewayTransactionId,
                paidAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } catch (err: any) {
            console.warn('[PhonePe Status] Firestore payment projection warning:', err?.message);
          }

          try {
            await ensurePickingTaskForOrder(canonicalOrderId, {
              id: canonicalOrderId,
              orderNumber: currentOrder.order_number,
              customerId: dbCustomerId,
              total: Number(currentOrder.total_amount),
              paymentStatus: 'paid',
              orderStatus: 'CONFIRMED',
            } as any);
          } catch (err: any) {
            console.warn('[PhonePe Status] ensurePickingTask warning:', err?.message);
          }

          console.log(`[PhonePe Status Recovery Success] Order #${currentOrder.order_number || canonicalOrderId} confirmed, paid, and sent to picker queue!`);
        }
      } catch (projErr: any) {
        console.warn('[PhonePe Status] Non-fatal downstream projection error:', projErr.message);
      }

      return corsResponse({
        success: true,
        data: {
          verified: true,
          status: phonepeStatus,
          paymentStatus: 'paid',
          orderStatus: 'CONFIRMED',
          transactionId: gatewayTransactionId,
          merchantTransactionId: resolvedTxnId,
          orderId: canonicalOrderId,
          amount: Number(currentOrder.total_amount),
        },
      });

    } catch (pgErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[PhonePe Status Transaction Failure]', pgErr.message);
      return corsResponse(
        { success: false, error: pgErr.message || 'Failed to update order state' },
        { status: 500 }
      );
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[PhonePe Status API Exception]', error);
    return corsResponse(
      { success: false, error: error.message || 'Failed to query payment status' },
      { status: 500 }
    );
  }
}

