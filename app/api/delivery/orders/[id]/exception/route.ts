import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
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
    const { partnerId, partnerName, reason, evidenceUrl } = body;

    if (!reason || !reason.trim()) {
      const response = NextResponse.json(
        { success: false, error: 'A specific reason is required for requesting a delivery exception.' },
        { status: 400 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    let orderNumber = orderId;
    let customerName = 'Customer';
    let customerPhone = '9999999999';

    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const data = orderSnap.data();
        orderNumber = data.orderNumber || orderId;
        customerName = data.customerName || customerName;
        customerPhone = data.customerPhone || customerPhone;
      }
    } else {
      const order = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (order) {
        orderNumber = order.orderNumber || orderId;
        customerName = order.customerName || customerName;
        customerPhone = order.customerPhone || customerPhone;
      }
    }

    const exceptionId = `exc_${orderId}_${Date.now()}`;
    const createdAt = new Date().toISOString();

    const exceptionRecord = {
      id: exceptionId,
      orderId,
      orderNumber,
      partnerId: partnerId || 'partner-1',
      partnerName: partnerName || 'Sunil Kumar',
      customerName,
      customerPhone,
      reason: reason.trim(),
      evidenceUrl: evidenceUrl || null,
      status: 'PENDING',
      createdAt,
    };

    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'deliveryExceptions', exceptionId), exceptionRecord);

      // Flag order with pending exception
      await updateDoc(doc(db, 'orders', orderId), {
        deliveryExceptionId: exceptionId,
        hasPendingException: true,
        updatedAt: createdAt,
      });

      // Audit Log
      await setDoc(doc(db, 'auditLogs', `log_exc_${exceptionId}`), {
        id: `log_exc_${exceptionId}`,
        action: 'DELIVERY_EXCEPTION_REQUESTED',
        orderId,
        orderNumber,
        actorId: partnerId || 'partner-1',
        actorRole: 'delivery_partner',
        description: `Delivery Partner ${partnerName || 'Partner'} requested OTP exception for Order #${orderNumber}. Reason: ${reason}`,
        timestamp: createdAt,
      });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Delivery exception request submitted to Admin successfully.',
      exceptionId,
      data: exceptionRecord,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Delivery Exception Submit Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to submit delivery exception' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}
