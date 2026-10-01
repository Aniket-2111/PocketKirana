import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';
import { getRouteAuth } from '@/lib/routeAuth';
import { handleCorsPreflight, setCorsHeaders } from '@/lib/cors';

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

    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return NextResponse.json(
          { success: false, error: 'Order not found.' },
          { status: 404 }
        );
      }

      const orderData = orderSnap.data();
      expectedAmount = Number(orderData.total ?? orderData.grandTotal ?? expectedAmount);
      orderNumber = orderData.orderNumber || orderId;
      assignedPartnerId = orderData.partnerId || '';
      currentPaymentStatus = (orderData.paymentStatus || 'pending').toLowerCase();
      currentPaymentMethod = (orderData.paymentMethod || 'cod').toLowerCase();
      currentCollectionStatus = orderData.collectionStatus || (currentPaymentStatus === 'paid' ? 'COLLECTED' : 'PENDING');

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
          collectedByPartnerId: orderData.cashCollectedBy || auth.uid,
          alreadyCollected: true,
        });
      }

      // 6. Atomically update order to PAID via cash
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        paymentMethod: 'cod_cash',
        collectionStatus: 'COLLECTED',
        collectionMethod: 'CASH',
        cashCollectedAt: new Date().toISOString(),
        cashCollectedBy: auth.uid,
        updatedAt: new Date().toISOString(),
      });

      // 7. Record in payments collection
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
    } else {
      const order = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (!order) {
        return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
      }

      expectedAmount = Number(order.total || amountCollected || 450);
      orderNumber = order.orderNumber || orderId;
      assignedPartnerId = order.partnerId || '';
      currentPaymentMethod = (order.paymentMethod || 'cod').toLowerCase();

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

      order.paymentStatus = 'paid' as any;
      order.paymentMethod = 'cod' as any;
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
