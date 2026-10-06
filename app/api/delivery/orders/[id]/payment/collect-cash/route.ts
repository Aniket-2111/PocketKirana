import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';
import { getRouteAuth } from '@/lib/routeAuth';
import { handleCorsPreflight, setCorsHeaders } from '@/lib/cors';
import { getPostgresPool } from '@/lib/postgres';

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authentication Check
    const auth = getRouteAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Authentication required.' },
        { status: 401 }
      );
    }

    if (auth.role !== 'delivery_partner' && auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Only delivery partners or admins can collect cash.' },
        { status: 403 }
      );
    }

    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const { amountCollected } = body;

    let expectedAmount = 450;
    let orderNumber = orderId;
    let assignedPartnerId = '';
    let currentPaymentStatus = 'pending';
    let currentPaymentMethod = 'cod';
    let currentCollectionStatus = 'PENDING';

    // Try PostgreSQL lookup first
    try {
      const pool = getPostgresPool();
      const pgRes = await pool.query(
        `SELECT id, order_number, customer_id, total_amount, payment_status, payment_method, delivery_partner_id
         FROM orders 
         WHERE id = $1 OR order_number = $1 
         LIMIT 1`,
        [orderId]
      );

      if (pgRes.rows.length > 0) {
        const row = pgRes.rows[0];
        expectedAmount = Number(row.total_amount) || expectedAmount;
        orderNumber = row.order_number || row.id;
        assignedPartnerId = row.delivery_partner_id || assignedPartnerId;
        currentPaymentStatus = (row.payment_status || 'pending').toLowerCase();
        currentPaymentMethod = (row.payment_method || 'cod').toLowerCase();
      }
    } catch (pgErr) {
      // Non-fatal if PG not reachable in mock mode
    }

    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists() && currentPaymentStatus === 'pending' && orderNumber === orderId) {
        return NextResponse.json(
          { success: false, error: 'Order not found.' },
          { status: 404 }
        );
      }

      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        expectedAmount = Number(orderData.total ?? orderData.grandTotal ?? expectedAmount);
        orderNumber = orderData.orderNumber || orderId;
        assignedPartnerId = orderData.partnerId || assignedPartnerId;
        currentPaymentStatus = (orderData.paymentStatus || currentPaymentStatus).toLowerCase();
        currentPaymentMethod = (orderData.paymentMethod || currentPaymentMethod).toLowerCase();
        currentCollectionStatus = orderData.collectionStatus || (currentPaymentStatus === 'paid' ? 'COLLECTED' : 'PENDING');
      }

      // 2. Partner Assignment Verification
      if (auth.role !== 'admin' && assignedPartnerId && assignedPartnerId !== auth.uid) {
        return NextResponse.json(
          { success: false, error: 'Forbidden. You are not assigned to this order.' },
          { status: 403 }
        );
      }

      // 3. Eligibility Verification: must not be an online prepaid order
      const isOnlinePrepaid = ['online', 'upi', 'phonepe', 'card'].includes(currentPaymentMethod);
      if (isOnlinePrepaid) {
        return NextResponse.json(
          { success: false, error: `Order is not eligible for cash collection (Payment method: ${currentPaymentMethod}).` },
          { status: 400 }
        );
      }

      // 4. Amount Validation
      if (amountCollected !== undefined && amountCollected !== null) {
        const parsedAmount = Number(amountCollected);
        if (isNaN(parsedAmount) || Math.abs(parsedAmount - expectedAmount) > 0.01) {
          return NextResponse.json(
            { success: false, error: `Invalid amount collected. Expected ₹${expectedAmount}, received ₹${amountCollected}.` },
            { status: 400 }
          );
        }
      }

      // 5. Idempotent check if already paid
      if (currentPaymentStatus === 'paid' && currentCollectionStatus === 'COLLECTED') {
        return NextResponse.json({
          success: true,
          message: `Cash payment of ₹${expectedAmount} was already confirmed.`,
          orderId,
          orderNumber,
          paymentStatus: 'PAID',
          paymentMethod: 'COD_CASH',
          amountCollected: expectedAmount,
          collectedByPartnerId: auth.uid,
          alreadyCollected: true,
        });
      }

      // 6. Atomically update order to PAID via cash in Firestore if available
      if (orderSnap.exists()) {
        await updateDoc(orderRef, {
          paymentStatus: 'paid',
          paymentMethod: 'cod_cash',
          collectionStatus: 'COLLECTED',
          collectionMethod: 'CASH',
          cashCollectedAt: new Date().toISOString(),
          cashCollectedBy: auth.uid,
          updatedAt: new Date().toISOString(),
        });

        const paymentTxnId = `CASH_COLLECT_${orderNumber}_${Date.now().toString().slice(-6)}`;
        await setDoc(
          doc(db, 'payments', `pay_pk_${paymentTxnId}`),
          {
            paymentId: `pay_pk_${paymentTxnId}`,
            orderId,
            orderNumber,
            amount: expectedAmount,
            currency: 'INR',
            method: 'cash',
            status: 'completed',
            gateway: 'cod_cash',
            collectedByPartnerId: auth.uid,
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } else {
      const order = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (!order && currentPaymentStatus === 'pending' && orderNumber === orderId) {
        return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
      }

      if (order) {
        expectedAmount = Number(order.total || amountCollected || expectedAmount);
        orderNumber = order.orderNumber || orderId;
        assignedPartnerId = order.partnerId || assignedPartnerId;
        currentPaymentMethod = (order.paymentMethod || currentPaymentMethod).toLowerCase();
        order.paymentStatus = 'paid' as any;
        order.paymentMethod = 'cod' as any;
      }

      // Partner Assignment Verification
      if (auth.role !== 'admin' && assignedPartnerId && assignedPartnerId !== auth.uid) {
        return NextResponse.json(
          { success: false, error: 'Forbidden. You are not assigned to this order.' },
          { status: 403 }
        );
      }

      // Amount Validation
      if (amountCollected !== undefined && amountCollected !== null) {
        const parsedAmount = Number(amountCollected);
        if (isNaN(parsedAmount) || Math.abs(parsedAmount - expectedAmount) > 0.01) {
          return NextResponse.json(
            { success: false, error: `Invalid amount collected. Expected ₹${expectedAmount}, received ₹${amountCollected}.` },
            { status: 400 }
          );
        }
      }
    }

    // 7. Authoritatively update PostgreSQL (Sole Transactional Source of Truth)
    try {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE orders
         SET payment_status = 'paid',
             payment_method = 'cod_cash',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 OR order_number = $1`,
        [orderId]
      );

      const paymentTxnId = `CASH_COLLECT_${orderNumber}_${Date.now().toString().slice(-6)}`;
      await pool.query(
        `INSERT INTO payments (
           id, order_id, firebase_uid, payment_method, amount, currency,
           status, gateway, gateway_order_id, created_at, updated_at
         ) VALUES ($1, $2, $3, 'cod_cash', $4, 'INR', 'completed', 'cod_cash', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET status = 'completed', updated_at = CURRENT_TIMESTAMP`,
        [
          `pay_pk_${paymentTxnId}`,
          orderId,
          auth.uid,
          expectedAmount,
          paymentTxnId,
        ]
      );
    } catch (pgErr: any) {
      console.warn('[Delivery Collect Cash PG Warning]', pgErr.message);
    }

    const response = NextResponse.json({
      success: true,
      message: `Cash payment of ₹${expectedAmount} confirmed by Delivery Partner.`,
      orderId,
      orderNumber,
      paymentStatus: 'PAID',
      paymentMethod: 'COD_CASH',
      amountCollected: expectedAmount,
      collectedByPartnerId: auth.uid,
      collectedAt: new Date().toISOString(),
    });

    return setCorsHeaders(response, req);
  } catch (error: any) {
    console.error('[Delivery Collect Cash Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to record cash payment' },
      { status: 500 }
    );
    return setCorsHeaders(response, req);
  }
}
