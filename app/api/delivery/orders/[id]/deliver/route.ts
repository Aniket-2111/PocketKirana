import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';
import { requireRole } from '@/lib/routeAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['delivery_partner', 'admin']);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Delivery partner or Admin role required' },
        { status: 403 }
      );
    }

    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const { partnerId: bodyPartnerId, otp, paymentStatus: clientPaymentStatus } = body;
    const partnerId = bodyPartnerId || auth.uid;

    let expectedOtp: string | null = null;
    let orderNumber = orderId;
    let paymentStatus = 'pending';
    let paymentMethod = 'cod';
    let collectionStatus = 'PENDING';
    let collectionMethod = 'CASH';
    let total = 450;
    let partnerName = 'Sunil Kumar';

    // 1. Fetch Order
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        expectedOtp = orderData.deliveryOtp || orderData.otp || null;
        orderNumber = orderData.orderNumber || orderId;
        paymentStatus = (orderData.paymentStatus || clientPaymentStatus || '').toLowerCase();
        paymentMethod = (orderData.paymentMethod || '').toLowerCase();
        collectionStatus = orderData.collectionStatus || (paymentStatus === 'paid' ? 'COLLECTED' : 'PENDING');
        collectionMethod = orderData.collectionMethod || (paymentMethod.includes('cash') ? 'CASH' : paymentMethod.includes('upi') ? 'UPI' : 'ONLINE');
        total = orderData.total || orderData.grandTotal || total;
        partnerName = orderData.partnerName || partnerName;
      }
    } else {
      const order = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (order) {
        expectedOtp = (order as any).deliveryOtp || (order as any).otp || null;
        orderNumber = order.orderNumber || orderId;
        paymentStatus = ((order as any).paymentStatus || clientPaymentStatus || '').toLowerCase();
        paymentMethod = (order.paymentMethod || '').toLowerCase();
        collectionStatus = (order as any).collectionStatus || (paymentStatus === 'paid' ? 'COLLECTED' : 'PENDING');
        collectionMethod = (order as any).collectionMethod || (paymentMethod.includes('cash') ? 'CASH' : paymentMethod.includes('upi') ? 'UPI' : 'ONLINE');
        total = order.total || total;
      }
    }

    // 2. Strict Payment / Collection Gate
    const isOnlinePrepaid = paymentMethod === 'online' || paymentMethod === 'upi' || paymentMethod === 'phonepe' || paymentMethod === 'card';
    const isCodUpi = paymentMethod.includes('upi') || paymentMethod === 'phonepe_upi' || paymentMethod === 'cod_upi' || collectionMethod === 'UPI';
    const isCodCash = paymentMethod === 'cod' || paymentMethod.includes('cash') || paymentMethod === 'cod_cash' || collectionMethod === 'CASH';
    const isCodOrder = paymentMethod.includes('cod') || isCodCash || isCodUpi || (!isOnlinePrepaid);

    if (isOnlinePrepaid) {
      if (paymentStatus !== 'paid' && paymentStatus !== 'completed') {
        return NextResponse.json(
          { success: false, error: 'Cannot complete delivery: Online payment is unverified.' },
          { status: 400 }
        );
      }
    } else if (isCodUpi) {
      if (paymentStatus !== 'paid' && paymentStatus !== 'completed') {
        return NextResponse.json(
          { success: false, error: 'Cannot complete delivery: PhonePe UPI payment is unverified.' },
          { status: 400 }
        );
      }
    } else if (isCodOrder || isCodCash) {
      if (collectionStatus !== 'COLLECTED' && paymentStatus !== 'paid' && paymentStatus !== 'completed') {
        return NextResponse.json(
          { success: false, error: 'Cannot complete delivery: COD payment (Cash or UPI QR) must be verified before completing delivery.' },
          { status: 400 }
        );
      }
    }

    // 3. Strict OTP Check
    const cleanOtp = (otp || '').toString().trim();
    if (!expectedOtp) {
      return NextResponse.json(
        { success: false, error: 'Cannot complete delivery: Delivery OTP not configured for this order.' },
        { status: 400 }
      );
    }

    if (!cleanOtp || cleanOtp !== expectedOtp) {
      return NextResponse.json(
        { success: false, error: 'Cannot complete delivery: Invalid or incorrect Delivery OTP.' },
        { status: 400 }
      );
    }

    const deliveredAt = new Date().toISOString();
    const settlementStatus = isCodCash ? 'PENDING' : 'NOT_APPLICABLE';

    // 4. Update Database
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        orderStatus: 'DELIVERED',
        deliveryStatus: 'DELIVERED',
        paymentStatus: 'paid',
        collectionStatus: isCodCash ? 'COLLECTED' : 'VERIFIED',
        settlementStatus,
        deliveredAt,
        deliveredByPartnerId: partnerId,
        deliveryOtpVerifiedAt: deliveredAt,
        deliveryOtpVerified: true,
        updatedAt: deliveredAt,
      });

      // Update / Create COD Collection doc if COD cash
      if (isCodCash) {
        const codRef = doc(db, 'codCollections', `cod_${orderId}`);
        await setDoc(codRef, {
          id: `cod_${orderId}`,
          orderId,
          orderNumber,
          partnerId,
          partnerName,
          expectedAmount: total,
          collectedAmount: total,
          settledAmount: 0,
          method: 'CASH',
          status: 'COLLECTED',
          settlementStatus: 'PENDING',
          collectedAt: deliveredAt,
          createdAt: deliveredAt,
        }, { merge: true });
      }

      // Record in Audit Logs
      await setDoc(doc(db, 'auditLogs', `log_deliv_${orderId}_${Date.now()}`), {
        id: `log_deliv_${orderId}_${Date.now()}`,
        action: 'ORDER_DELIVERED',
        orderId,
        orderNumber,
        actorId: partnerId,
        actorRole: 'delivery_partner',
        amount: total,
        previousState: 'OUT_FOR_DELIVERY',
        newState: 'DELIVERED',
        description: `Order #${orderNumber} delivered successfully by ${partnerName} with verified Delivery OTP. ${isCodCash ? `Cash ₹${total} collected (Settlement PENDING).` : ''}`,
        timestamp: deliveredAt,
      });
    } else {
      const order = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (order) {
        (order as any).orderStatus = 'DELIVERED';
        (order as any).deliveryStatus = 'DELIVERED';
        (order as any).paymentStatus = 'paid';
        (order as any).collectionStatus = isCodCash ? 'COLLECTED' : 'VERIFIED';
        (order as any).settlementStatus = settlementStatus;
        (order as any).deliveredAt = deliveredAt;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Order #${orderNumber} delivered successfully!`,
      orderId,
      orderNumber,
      orderStatus: 'DELIVERED',
      collectionStatus: isCodCash ? 'COLLECTED' : 'VERIFIED',
      settlementStatus,
      deliveredAt,
      deliveredByPartnerId: partnerId,
    });
  } catch (error: any) {
    console.error('[Delivery Deliver Order Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to complete delivery' },
      { status: 500 }
    );
  }
}
