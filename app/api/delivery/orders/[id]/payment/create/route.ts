import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';
import { getPhonePeConfig, isSimulationMode } from '@/lib/phonepeConfig';
import { getPostgresPool } from '@/lib/postgres';

export async function OPTIONS() {
  const res = NextResponse.json({ status: 'ok' });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const { partnerId } = body;

    let orderTotal = 450;
    let orderNumber = orderId;
    let customerId = 'customer-1';
    let customerPhone = '9999999999';
    let isAlreadyPaid = false;

    // 1. Try PostgreSQL lookup first
    try {
      const pool = getPostgresPool();
      const pgRes = await pool.query(
        `SELECT id, order_number, customer_id, total_amount, payment_status, payment_method, assigned_partner_id
         FROM orders 
         WHERE id = $1 OR order_number = $1 
         LIMIT 1`,
        [orderId]
      );

      if (pgRes.rows.length > 0) {
        const row = pgRes.rows[0];
        orderTotal = Number(row.total_amount) || orderTotal;
        orderNumber = row.order_number || row.id;
        customerId = row.customer_id || customerId;
        if (row.payment_status === 'paid' || row.payment_status === 'completed') {
          isAlreadyPaid = true;
        }
      }
    } catch (pgErr) {
      // Fallback to Firestore / In-Memory
    }

    // 2. Fetch from Firestore if configured
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const data = orderSnap.data();
        orderTotal = data.total || data.grandTotal || orderTotal;
        orderNumber = data.orderNumber || orderId;
        customerId = data.customerId || customerId;
        customerPhone = data.customerPhone || customerPhone;
        if (data.paymentStatus === 'paid' || data.paymentStatus === 'completed') {
          isAlreadyPaid = true;
        }
      }
    } else if (!orderNumber || orderNumber === orderId) {
      const mockOrder = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (mockOrder) {
        orderTotal = mockOrder.total || 450;
        orderNumber = mockOrder.orderNumber || orderId;
        customerId = mockOrder.customerId || customerId;
        customerPhone = mockOrder.customerPhone || customerPhone;
        if (mockOrder.paymentStatus === 'paid') {
          isAlreadyPaid = true;
        }
      }
    }

    if (isAlreadyPaid) {
      const response = NextResponse.json(
        { success: false, error: 'Order is already marked as paid. No COD collection needed.' },
        { status: 400 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    const amountInPaise = Math.round(orderTotal * 100);
    const merchantTransactionId = `TXN_PK_COD_${orderNumber}_${Date.now().toString().slice(-6)}`;
    const expiresInSeconds = 600; // 10 minutes
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    // Standard Bank & NPCI Compliant Dynamic UPI QR Payload for Maule Kirana / Pocket Kirana
    const upiQrPayload = `upi://pay?pa=maule.kirana@okaxis&pn=Maule+Kirana+Store&am=${orderTotal.toFixed(2)}&cu=INR&tn=PocketKirana+Order+${orderNumber}&tr=${merchantTransactionId}`;

    // 3. Record pending payment attempt in PostgreSQL
    try {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO payments (
           id, order_id, firebase_uid, payment_method, amount, currency,
           status, gateway, gateway_order_id, created_at, updated_at
         ) VALUES ($1, $2, $3, 'phonepe_upi', $4, 'INR', 'pending', 'phonepe_qr', $5, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          `pay_pk_${merchantTransactionId}`,
          orderId,
          customerId,
          orderTotal,
          merchantTransactionId,
        ]
      );
    } catch (pgInsertErr) {
      // Non-fatal if table not present in test mode
    }

    // 4. Record pending payment in Firestore if available
    if (isFirebaseConfigured() && db) {
      const paymentRef = doc(db, 'payments', `pay_pk_${merchantTransactionId}`);
      await setDoc(paymentRef, {
        paymentId: `pay_pk_${merchantTransactionId}`,
        orderId,
        orderNumber,
        customerId,
        partnerId: partnerId || 'partner-1',
        amount: orderTotal,
        amountInPaise,
        currency: 'INR',
        method: 'phonepe_upi',
        status: 'pending',
        gateway: 'phonepe_qr',
        gatewayOrderId: merchantTransactionId,
        createdAt: new Date().toISOString(),
        expiresAt,
        qrPayload: upiQrPayload,
      }, { merge: true });
    }

    const response = NextResponse.json({
      success: true,
      orderId,
      orderNumber,
      merchantTransactionId,
      expectedAmount: orderTotal,
      amountInPaise,
      currency: 'INR',
      qrPayload: upiQrPayload,
      payeeName: 'Maule Kirana Store',
      upiId: 'maule.kirana@okaxis',
      status: 'PAYMENT_PENDING',
      expiresInSeconds,
      expiresAt,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Delivery Payment Create Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to create payment QR' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}
