import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';

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
    const { partnerId, amountCollected } = body;

    let expectedAmount = 450;
    let orderNumber = orderId;

    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        expectedAmount = orderData.total || orderData.grandTotal || expectedAmount;
        orderNumber = orderData.orderNumber || orderId;

        // Atomically update order to PAID via cash
        await updateDoc(orderRef, {
          paymentStatus: 'paid',
          paymentMethod: 'cod_cash',
          cashCollectedAt: new Date().toISOString(),
          cashCollectedBy: partnerId || 'partner-1',
          updatedAt: new Date().toISOString(),
        });

        // Record in payments collection
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
            collectedByPartnerId: partnerId || 'partner-1',
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } else {
      const order = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      expectedAmount = order?.total || amountCollected || 450;
      orderNumber = order?.orderNumber || orderId;
      if (order) {
        order.paymentStatus = 'paid' as any;
        order.paymentMethod = 'cod' as any;
      }
    }

    const response = NextResponse.json({
      success: true,
      message: `Cash payment of ₹${expectedAmount} confirmed by Delivery Partner.`,
      orderId,
      orderNumber,
      paymentStatus: 'PAID',
      paymentMethod: 'COD_CASH',
      amountCollected: expectedAmount,
      collectedByPartnerId: partnerId || 'partner-1',
      collectedAt: new Date().toISOString(),
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Delivery Collect Cash Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to record cash payment' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}
