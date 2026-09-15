import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';
import { getPhonePeConfig, isSimulationMode } from '@/lib/phonepeConfig';

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

    // 1. Fetch from Firestore if configured
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const data = orderSnap.data();
        orderTotal = data.total || data.grandTotal || 450;
        orderNumber = data.orderNumber || orderId;
        customerId = data.customerId || customerId;
        customerPhone = data.customerPhone || customerPhone;
      }
    } else {
      const mockOrder = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (mockOrder) {
        orderTotal = mockOrder.total || 450;
        orderNumber = mockOrder.orderNumber || orderId;
        customerId = mockOrder.customerId || customerId;
        customerPhone = mockOrder.customerPhone || customerPhone;
      }
    }

    const amountInPaise = Math.round(orderTotal * 100);
    const merchantTransactionId = `TXN_PK_COD_${orderNumber}_${Date.now().toString().slice(-6)}`;

    // Standard Bank & NPCI Compliant Dynamic UPI QR Payload for Maule Kirana / Pocket Kirana
    const upiQrPayload = `upi://pay?pa=maule.kirana@okaxis&pn=Maule+Kirana+Store&am=${orderTotal.toFixed(2)}&cu=INR&tn=PocketKirana+Order+${orderNumber}&tr=${merchantTransactionId}`;

    // Record pending payment in Firestore if available
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
      expiresInSeconds: 600,
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
