import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getPhonePeConfig } from '@/lib/phonepeConfig';
import { ensurePickingTaskForOrder } from '@/lib/firebaseServices';

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
    // PhonePe requires the X-VERIFY header check on every webhook. Without a
    // configured salt key we cannot verify authenticity, so the webhook is
    // rejected. We still return 200 so PhonePe does not infinitely retry a
    // request we can never process; the missed confirmation is recovered by
    // the client-side verify route instead.
    if (!config) {
      console.error('[PhonePe Webhook] Gateway credentials not configured — cannot validate signature. Configure PHONEPE_SALT_KEY to enable webhook processing.');
      return NextResponse.json({ success: true, message: 'Webhook received but gateway not configured' }, { status: 200 });
    }

    const generatedHash = crypto
      .createHash('sha256')
      .update(base64Response + config.saltKey)
      .digest('hex');
    const expectedVerifyHeader = `${generatedHash}###${config.saltIndex}`;

    if (xVerifyHeader !== expectedVerifyHeader) {
      console.error('[PhonePe Webhook Signature Verification Failed]', {
        received: xVerifyHeader,
        expected: expectedVerifyHeader
      });
      // ACK with 200 so PhonePe doesn't retry forever on tampered traffic;
      // the payment is still recovered via the client-side verify route.
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

    if (!isFirebaseConfigured() || !db) {
      console.error('[PhonePe Webhook] Firestore database not connected');
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
    }

    // ── 3. LOAD ASSOCIATED RECORDS & ENFORCE IDEMPOTENCY ───────────
    const paymentRef = doc(db, 'payments', `pay_pk_${merchantTransactionId}`);
    const paymentSnap = await getDoc(paymentRef);

    let orderId = '';
    let dbCustomerId = 'usr-cust-1';

    if (paymentSnap.exists()) {
      const paymentData = paymentSnap.data();
      orderId = paymentData.orderId;
      dbCustomerId = paymentData.customerId;

      if (paymentData.status === 'completed') {
        console.log(`[PhonePe Webhook Idempotency] Payment pay_pk_${merchantTransactionId} already marked as completed.`);
        return NextResponse.json({ success: true, message: 'Payment already processed' });
      }
    } else {
      console.warn(`[PhonePe Webhook] Payment doc pay_pk_${merchantTransactionId} not found. Attempting lookup on orders collection...`);
      
      const ordersCol = collection(db, 'orders');
      const parts = merchantTransactionId.split('_');
      if (parts.length >= 3) {
        const orderNumberStr = parts[2];
        const ordersQuery = query(ordersCol, where('orderNumber', '==', orderNumberStr));
        const querySnap = await getDocs(ordersQuery);
        if (!querySnap.empty) {
          const docSnap = querySnap.docs[0];
          orderId = docSnap.id;
          dbCustomerId = docSnap.data().customerId;
        }
      }
    }

    if (!orderId) {
      console.error(`[PhonePe Webhook Recovery Failed] No associated order found for transaction: ${merchantTransactionId}`);
      return NextResponse.json({ success: false, error: 'Associated order not found' }, { status: 404 });
    }

    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      console.error(`[PhonePe Webhook Error] Order document ${orderId} missing`);
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderSnap.data();
    const expectedAmountInPaise = Math.round(orderData.total * 100);

    if (phonepeAmountInPaise !== expectedAmountInPaise) {
      console.error('[PhonePe Webhook Amount Mismatch]', { phonepeAmountInPaise, expectedAmountInPaise });
      await setDoc(paymentRef, {
        status: 'failed',
        failureReason: `Webhook amount mismatch: expected ${expectedAmountInPaise} paise, got ${phonepeAmountInPaise} paise`
      }, { merge: true });
      return NextResponse.json({ success: false, error: 'Payment amount mismatch' }, { status: 400 });
    }

    // ── 4. ATOMIC DATABASE UPDATE ──────────────────────────────────
    if (orderData.paymentStatus !== 'paid') {
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        orderStatus: 'CONFIRMED',
        updatedAt: new Date().toISOString(),
        paymentDetails: {
          transactionId: transactionId || merchantTransactionId,
          method: 'phonepe',
          amount: orderData.total,
          paidAt: new Date().toISOString()
        }
      });

      await setDoc(paymentRef, {
        paymentId: `pay_pk_${merchantTransactionId}`,
        orderId,
        customerId: dbCustomerId,
        amount: orderData.total,
        currency: 'INR',
        method: 'phonepe',
        status: 'completed',
        gateway: 'phonepe',
        gatewayOrderId: merchantTransactionId,
        gatewayPaymentId: transactionId || '',
        paidAt: new Date().toISOString()
      }, { merge: true });

      // Automatically route to Picker Queue
      await ensurePickingTaskForOrder(orderId, orderData as any);

      console.log(`[PhonePe Webhook Success] Order #${orderData.orderNumber || orderId} confirmed, paid, and sent to picker queue!`);
    }

    return NextResponse.json({ success: true, message: 'Webhook processed successfully' });

  } catch (error: any) {
    console.error('[PhonePe Webhook Processing Exception]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
