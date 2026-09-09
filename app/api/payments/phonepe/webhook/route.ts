import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

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

    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';

    // ── 1. SIGNATURE VALIDATION ────────────────────────────────────
    if (saltKey) {
      const generatedHash = crypto
        .createHash('sha256')
        .update(base64Response + saltKey)
        .digest('hex');
      const expectedVerifyHeader = `${generatedHash}###${saltIndex}`;

      if (xVerifyHeader !== expectedVerifyHeader) {
        console.error('[PhonePe Webhook Signature Verification Failed]', {
          received: xVerifyHeader,
          expected: expectedVerifyHeader
        });
        return NextResponse.json({ success: false, error: 'Invalid signature verification' }, { status: 401 });
      }
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
      // Backup recovery: find the order by merchantTransactionId inside the orderNumber or transaction references
      console.warn(`[PhonePe Webhook] Payment doc pay_pk_${merchantTransactionId} not found. Attempting lookup on orders collection...`);
      
      const ordersCol = collection(db, 'orders');
      // If we don't have direct ref, extract order identifier from transaction ID
      // Structure: TXN_PK_${orderNumber}_${Date.now()}
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
      await updateDoc(paymentRef, {
        status: 'failed',
        failureReason: `Webhook amount mismatch: expected ${expectedAmountInPaise} paise, got ${phonepeAmountInPaise} paise`
      });
      return NextResponse.json({ success: false, error: 'Payment amount mismatch' }, { status: 400 });
    }

    // ── 4. ATOMIC DATABASE UPDATE ──────────────────────────────────
    if (orderData.paymentStatus !== 'paid') {
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        orderStatus: 'STOCK_RESERVED',
        updatedAt: new Date().toISOString()
      });

      // Ensure payment doc exists/is updated
      await setDocDataHelper(paymentRef, {
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
      });

      console.log(`[PhonePe Webhook Success] Order #${orderData.orderNumber || orderId} confirmed and paid!`);
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

// Helper to update doc or set it if missing
async function setDocDataHelper(docRef: any, data: any) {
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, data);
    } else {
      const { setDoc } = require('firebase/firestore');
      await setDoc(docRef, data);
    }
  } catch (err) {
    console.error('[PhonePe Webhook Helper Error]', err);
  }
}
