import { NextRequest, NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/postgres';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';
import { getRouteAuth } from '@/lib/routeAuth';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc } from 'firebase/firestore';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
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
        { success: false, error: 'Forbidden. Only delivery partners or admins can mark orders as delivered.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const {
      otp,
      paymentCollected = true,
      notes,
    } = body;

    const cleanOtp = (otp || '').toString().trim();
    if (!cleanOtp) {
      return NextResponse.json(
        { success: false, error: 'Delivery OTP is required' },
        { status: 400 }
      );
    }

    let isValidOtp = false;
    let assignedPartnerId = '';
    let currentStatus = '';

    // Check Postgres first
    try {
      const orderRes = await queryPostgres(
        `SELECT id, order_number, delivery_otp, order_status, partner_id
         FROM orders
         WHERE id = $1 OR order_number = $1`,
        [id]
      );

      if (orderRes.rowCount && orderRes.rowCount > 0) {
        const row = orderRes.rows[0];
        const dbOtp = row.delivery_otp ? row.delivery_otp.toString().trim() : '';
        assignedPartnerId = row.partner_id || '';
        currentStatus = (row.order_status || '').toUpperCase();

        if (dbOtp && dbOtp === cleanOtp) {
          isValidOtp = true;
        }
      }
    } catch (pgErr) {
      console.warn('[Delivered Route] Postgres check fallback to Firestore:', pgErr);
    }

    // If not validated yet and Firebase is available, check Firestore
    if (!isValidOtp && isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', id);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        const firestoreOtp = orderData.deliveryOtp ? String(orderData.deliveryOtp).trim() : (orderData.otp ? String(orderData.otp).trim() : '');
        assignedPartnerId = assignedPartnerId || orderData.partnerId || '';
        currentStatus = currentStatus || (orderData.orderStatus || '').toUpperCase();

        if (firestoreOtp && firestoreOtp === cleanOtp) {
          isValidOtp = true;
        }
      }
    }

    // Partner assignment check
    if (auth.role !== 'admin' && assignedPartnerId && assignedPartnerId !== auth.uid) {
      return NextResponse.json(
        { success: false, error: 'Forbidden. You are not assigned to this order.' },
        { status: 403 }
      );
    }

    // Disallow already delivered
    if (currentStatus === 'DELIVERED' || currentStatus === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Order has already been delivered.' },
        { status: 400 }
      );
    }

    if (!isValidOtp) {
      return NextResponse.json(
        { success: false, error: 'Invalid Delivery OTP. Please verify with the customer.' },
        { status: 400 }
      );
    }

    const result = await transitionOrderStatus({
      orderId: id,
      eventType: 'ORDER_DELIVERED',
      targetStatus: 'DELIVERED',
      actorId: auth.uid,
      actorType: 'delivery_partner',
      metadata: {
        partnerId: auth.uid,
        paymentCollected,
        otpVerified: true,
        deliveredAt: new Date().toISOString(),
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order successfully delivered and verified with OTP',
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to complete delivery' },
      { status: 500 }
    );
  }
}
