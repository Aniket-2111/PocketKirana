import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { getPhonePeConfig } from '@/lib/phonepeConfig';
import { ensurePickingTaskForOrder } from '@/lib/firebaseServices';
import { getPostgresPool } from '@/lib/postgres';
import { appendOutboxEvent } from '@/lib/db/outbox';

export async function POST(request: Request) {
  try {
    const headersList = request.headers;
    const xVerifyHeader = headersList.get('x-verify');

    const body = await request.json();
    const { response: base64Response } = body;

    if (!base64Response || !xVerifyHeader) {
      console.warn('[PhonePe Webhook] Missing signature or payload');
      return NextResponse.json({ success: false, error: 'Missing signature or payload' }, { status: 400 });
    }

    const config = getPhonePeConfig();

    // ── 1. SIGNATURE VALIDATION (mandatory — fail closed) ──────────
    if (!config) {
      console.error('[PhonePe Webhook] Gateway credentials not configured — cannot validate signature.');
      return NextResponse.json({ success: true, message: 'Webhook received but gateway not configured' }, { status: 200 });
    }

    const generatedHash = crypto
      .createHash('sha256')
      .update(base64Response + config.saltKey)
      .digest('hex');
    const expectedVerifyHeader = `${generatedHash}###${config.saltIndex}`;

    const a = Buffer.from(xVerifyHeader);
    const b = Buffer.from(expectedVerifyHeader);
    const isSignatureValid = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!isSignatureValid) {
      console.error('[PhonePe Webhook Signature Verification Failed]: Signature mismatch');
      return NextResponse.json({ success: true, message: 'Invalid signature ignored' }, { status: 200 });
    }

    // ── 2. DECODE & PARSE PAYLOAD ──────────────────────────────────
    const decodedString = Buffer.from(base64Response, 'base64').toString('utf-8');
    const payload = JSON.parse(decodedString);

    if (!payload.success || !payload.data) {
      console.warn('[PhonePe Webhook Status Notification] Transaction not successful:', payload);
      return NextResponse.json({ success: true, message: 'Processed failure state' });
    }

    const { merchantTransactionId, transactionId, amount: phonepeAmountInPaise } = payload.data;

    // ── 3. EXTRACT CANDIDATE IDENTIFIERS ───────────────────────────
    const candidateIdentifiers: string[] = [];
    let dbCustomerId = 'usr-cust-1';
    let paymentDocRef: any = null;

    if (isFirebaseConfigured() && db) {
      try {
        paymentDocRef = doc(db, 'payments', `pay_pk_${merchantTransactionId}`);
        const paymentSnap = await getDoc(paymentDocRef);
        if (paymentSnap && typeof paymentSnap.exists === 'function' && paymentSnap.exists()) {
          const pData = paymentSnap.data() as any;
          if (pData?.orderId) candidateIdentifiers.push(String(pData.orderId).trim());
          if (pData?.customerId) dbCustomerId = pData.customerId;
          if (pData?.status === 'completed') {
            console.log(`[PhonePe Webhook Idempotency] Payment pay_pk_${merchantTransactionId} already marked as completed.`);
            return NextResponse.json({ success: true, message: 'Payment already processed' });
          }
        }
      } catch (err: any) {
        console.warn('[PhonePe Webhook] Payment doc read notice:', err.message);
      }
    }

    // Extract orderNumber from merchantTransactionId
    // Standard formats: TXN_PK_<orderNumber>_<timestamp> or TXN_PK_MOCK_<orderNumber>_<timestamp>
    if (merchantTransactionId) {
      const parts = String(merchantTransactionId).split('_');
      if (parts.length >= 3) {
        if (parts[2] === 'MOCK' && parts.length >= 4) {
          candidateIdentifiers.push(parts[3].trim());
        } else {
          candidateIdentifiers.push(parts[2].trim());
        }
      }
      candidateIdentifiers.push(String(merchantTransactionId).trim());
    }

    const uniqueCandidates = Array.from(new Set(candidateIdentifiers.filter(Boolean)));

    if (uniqueCandidates.length === 0) {
      console.error(`[PhonePe Webhook Recovery Failed] No candidate order identifiers found for transaction: ${merchantTransactionId}`);
      return NextResponse.json({ success: false, error: 'Associated order not found' }, { status: 404 });
    }

    // ── 4. ATOMIC POSTGRESQL TRANSACTION ───────────────────────────
    const pool = getPostgresPool();
    if (!pool) {
      console.error('[PhonePe Webhook] PostgreSQL pool unavailable');
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ── 5. RESOLVE AUTHORITATIVE ORDER WITH ROW LOCK ──────────────
      const whereClauses = uniqueCandidates.map((_, idx) => `id = $${idx + 1} OR order_number = $${idx + 1}`);
      const orderQuery = `
        SELECT id, order_number, firebase_uid, total_amount, payment_status, order_status
        FROM orders
        WHERE ${whereClauses.join(' OR ')}
        LIMIT 1
        FOR UPDATE
      `;

      const orderRes = await client.query(orderQuery, uniqueCandidates);

      // ── 6. ORDER EXISTENCE GATE ────────────────────────────────────
      if (!orderRes || orderRes.rowCount === 0 || !orderRes.rows[0]) {
        await client.query('ROLLBACK');
        console.error(`[PhonePe Webhook Recovery Failed] No authoritative order found in PostgreSQL for transaction: ${merchantTransactionId}, candidates: ${uniqueCandidates.join(', ')}`);
        return NextResponse.json({ success: false, error: 'Associated order not found' }, { status: 404 });
      }

      const currentOrder = orderRes.rows[0];

      // ── 7. EXTRACT CANONICAL ORDER ID ─────────────────────────────
      const canonicalOrderId = currentOrder.id;
      dbCustomerId = currentOrder.customer_id || currentOrder.firebase_uid || dbCustomerId;

      // ── 8. AMOUNT VERIFICATION ─────────────────────────────────────
      const expectedAmountInPaise = Math.round(Number(currentOrder.total_amount) * 100);
      const paidAmountInPaise = Number(phonepeAmountInPaise);

      if (paidAmountInPaise !== expectedAmountInPaise) {
        console.error('[PhonePe Webhook Amount Mismatch]', { paidAmountInPaise, expectedAmountInPaise });
        await client.query('ROLLBACK');

        if (paymentDocRef) {
          try {
            await setDoc(paymentDocRef, {
              status: 'failed',
              failureReason: `Webhook amount mismatch: expected ${expectedAmountInPaise} paise, got ${paidAmountInPaise} paise`,
            }, { merge: true });
          } catch (e: any) {
            console.warn('[PhonePe Webhook] Failed to update paymentDoc status:', e?.message);
          }
        }

        return NextResponse.json({ success: false, error: 'Payment amount mismatch' }, { status: 400 });
      }

      // ── 9. IDEMPOTENCY CHECK ───────────────────────────────────────
      const isOrderAlreadyPaid =
        currentOrder.order_status === 'CONFIRMED' && currentOrder.payment_status === 'paid';

      const existingTx = await client.query(
        `SELECT id FROM payment_transactions WHERE transaction_id = $1`,
        [transactionId || merchantTransactionId]
      );

      if (isOrderAlreadyPaid || (existingTx && existingTx.rowCount && existingTx.rowCount > 0)) {
        await client.query('COMMIT');
        console.log(`[PhonePe Webhook Idempotency] Order ${canonicalOrderId} already confirmed & paid.`);
        return NextResponse.json({ success: true, message: 'Payment already processed' });
      }

      // ── 10. ATOMIC POSTGRESQL PERSISTENCE ─────────────────────────
      const paymentId = `pay_pk_${merchantTransactionId}`;

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
          merchantTransactionId,
          transactionId || '',
        ]
      );

      // b. Insert payment_transactions ledger
      await client.query(
        `INSERT INTO payment_transactions (
           id, payment_id, transaction_id, transaction_type, amount, status, response_data
         ) VALUES ($1, $2, $3, 'WEBHOOK_PAYMENT', $4, 'SUCCESS', $5)
         ON CONFLICT (transaction_id) DO NOTHING`,
        [
          `ptxn_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          paymentId,
          transactionId || merchantTransactionId,
          currentOrder.total_amount,
          JSON.stringify(payload),
        ]
      );

      // c. Update orders table with exact rowCount verification
      const updateRes = await client.query(
        `UPDATE orders 
         SET payment_status = 'paid', 
             order_status = 'CONFIRMED', 
             confirmed_at = COALESCE(confirmed_at, NOW()), 
             updated_at = NOW() 
         WHERE id = $1`,
        [canonicalOrderId]
      );

      // ── 12. EXPLICIT ROWCOUNT VERIFICATION ────────────────────────
      if (!updateRes || updateRes.rowCount !== 1) {
        throw new Error(
          `Failed to update order state: expected 1 row affected, got ${updateRes?.rowCount ?? 0}`
        );
      }

      // ── 13. PRESERVE ORDER STATUS HISTORY ─────────────────────────
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
          'system:phonepe_webhook',
          `PhonePe payment confirmed: ${transactionId || merchantTransactionId}`,
        ]
      );

      // ── 14. ENQUEUE TRANSACTIONAL OUTBOX EVENT ────────────────────
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
          transactionId,
          paidAt: new Date().toISOString(),
        },
      });

      // ── 15. COMMIT TRANSACTION ────────────────────────────────────
      await client.query('COMMIT');

      // ── 16. DOWNSTREAM READ PROJECTION TO FIRESTORE (AFTER COMMIT) ──
      try {
        if (isFirebaseConfigured() && db) {
          const orderRef = doc(db, 'orders', canonicalOrderId);
          try {
            await updateDoc(orderRef, {
              paymentStatus: 'paid',
              orderStatus: 'CONFIRMED',
              updatedAt: new Date().toISOString(),
              paymentDetails: {
                transactionId: transactionId || merchantTransactionId,
                method: 'phonepe',
                amount: Number(currentOrder.total_amount),
                paidAt: new Date().toISOString(),
              },
            });
          } catch (err: any) {
            console.warn('[PhonePe Webhook] Firestore order projection warning:', err?.message);
          }

          if (paymentDocRef) {
            try {
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
                  gatewayOrderId: merchantTransactionId,
                  gatewayPaymentId: transactionId || '',
                  paidAt: new Date().toISOString(),
                },
                { merge: true }
              );
            } catch (err: any) {
              console.warn('[PhonePe Webhook] Firestore payment projection warning:', err?.message);
            }
          }

          // Trigger picking task projection
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
            console.warn('[PhonePe Webhook] ensurePickingTask warning:', err?.message);
          }

          console.log(`[PhonePe Webhook Success] Order #${currentOrder.order_number || canonicalOrderId} confirmed, paid, and sent to picker queue!`);
        }
      } catch (projErr: any) {
        console.warn('[PhonePe Webhook] Non-fatal downstream projection error:', projErr.message);
      }

      return NextResponse.json({ success: true, message: 'Webhook processed successfully' });
    } catch (pgErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[PhonePe Webhook Transaction Failure]', pgErr.message);
      return NextResponse.json(
        { success: false, error: pgErr.message || 'Failed to update order state' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[PhonePe Webhook Processing Exception]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
