import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';
import { getPhonePeConfig, isSimulationMode } from '@/lib/phonepeConfig';
import crypto from 'crypto';

export async function OPTIONS() {
  const res = NextResponse.json({ status: 'ok' });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const url = new URL(req.url);
    const merchantTransactionId = url.searchParams.get('merchantTransactionId');

    let isPaid = false;
    let paymentStatus = 'COD';
    let paymentMethod = 'cod';
    let total = 450;
    let orderNumber = orderId;
    let transactionId = merchantTransactionId || '';

    // 1. Check Firestore
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        total = orderData.total || orderData.grandTotal || 450;
        orderNumber = orderData.orderNumber || orderId;

        const rawStatus = (orderData.paymentStatus || '').toLowerCase();
        const rawMethod = (orderData.paymentMethod || '').toLowerCase();

        if (rawStatus === 'paid' || rawStatus === 'completed' || (rawMethod && rawMethod !== 'cod' && rawMethod !== 'cash')) {
          isPaid = true;
          paymentStatus = 'PAID';
          paymentMethod = orderData.paymentMethod || 'phonepe_upi';
          transactionId = orderData.paymentDetails?.transactionId || transactionId;
        }
      }

      // If merchantTransactionId was provided, also inspect payments doc
      if (merchantTransactionId) {
        const payRef = doc(db, 'payments', `pay_pk_${merchantTransactionId}`);
        const paySnap = await getDoc(payRef);
        if (paySnap.exists()) {
          const payData = paySnap.data();
          if (payData.status === 'completed' || payData.status === 'paid') {
            isPaid = true;
            paymentStatus = 'PAID';
            paymentMethod = payData.method || 'phonepe_upi';
            transactionId = payData.gatewayPaymentId || merchantTransactionId;
          }
        }
      }
    } else {
      // Mock fallback
      const mockOrder = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (mockOrder) {
        total = mockOrder.total || 450;
        orderNumber = mockOrder.orderNumber || orderId;
        const rawStatus = (mockOrder.paymentStatus || '').toLowerCase();
        const rawMethod = (mockOrder.paymentMethod || '').toLowerCase();
        if (rawStatus === 'paid' || (rawMethod && rawMethod !== 'cod' && rawMethod !== 'cash')) {
          isPaid = true;
          paymentStatus = 'PAID';
          paymentMethod = mockOrder.paymentMethod || 'phonepe_upi';
        }
      }
    }

    const response = NextResponse.json({
      success: true,
      orderId,
      orderNumber,
      paymentStatus: isPaid ? 'PAID' : paymentStatus,
      paymentMethod,
      expectedAmount: total,
      currency: 'INR',
      isPaid,
      transactionId,
      paidAt: isPaid ? new Date().toISOString() : null,
      provider: 'phonepe_upi',
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Delivery Payment Status Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch payment status' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Support POST for verify webhook / trigger
  return GET(req, { params });
}
