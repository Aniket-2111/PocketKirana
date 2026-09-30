import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { INITIAL_ORDERS } from '@/lib/mockData';
import { getRouteAuth } from '@/lib/routeAuth';
import { handleCorsPreflight, setCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

// In-memory rate limiting and attempt tracker for fallback/development
const otpAttemptStore = new Map<string, { attempts: number; isLocked: boolean; lockedAt?: number }>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jsonResponse = (data: any, init?: any) =>
    setCorsHeaders(NextResponse.json(data, init), request);

  try {
    // 1. Authentication Check
    const auth = getRouteAuth(request);
    if (!auth) {
      return jsonResponse(
        { success: false, error: 'Unauthorized. Authentication required.' },
        { status: 401 }
      );
    }

    if (auth.role !== 'delivery_partner' && auth.role !== 'admin') {
      return jsonResponse(
        { success: false, error: 'Forbidden. Only delivery partners or admins can verify delivery OTP.' },
        { status: 403 }
      );
    }

    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const { otp } = body;

    let expectedOtp: string | null = null;
    let orderNumber = orderId;
    let paymentStatus = 'pending';
    let paymentMethod = 'cod';
    let collectionStatus = 'PENDING';
    let collectionMethod = 'CASH';
    let assignedPartnerId = '';
    let orderStatus = 'OUT_FOR_DELIVERY';
    let otpAttempts = 0;
    let isOtpLocked = false;

    // 2. Fetch Order Data
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return jsonResponse(
          { success: false, error: 'Order not found.' },
          { status: 404 }
        );
      }

      const orderData = orderSnap.data();
      expectedOtp = orderData.deliveryOtp ? String(orderData.deliveryOtp).trim() : (orderData.otp ? String(orderData.otp).trim() : null);
      orderNumber = orderData.orderNumber || orderId;
      paymentStatus = (orderData.paymentStatus || '').toLowerCase();
      paymentMethod = (orderData.paymentMethod || '').toLowerCase();
      collectionStatus = orderData.collectionStatus || (paymentStatus === 'paid' ? 'COLLECTED' : 'PENDING');
      collectionMethod = orderData.collectionMethod || (paymentMethod.includes('cash') ? 'CASH' : paymentMethod.includes('upi') ? 'UPI' : 'ONLINE');
      assignedPartnerId = orderData.partnerId || '';
      orderStatus = orderData.orderStatus || 'OUT_FOR_DELIVERY';
      otpAttempts = orderData.deliveryOtpAttempts || 0;
      isOtpLocked = !!orderData.deliveryOtpLocked;
    } else {
      const mockOrder = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (!mockOrder) {
        return jsonResponse({ success: false, error: 'Order not found.' }, { status: 404 });
      }

      expectedOtp = (mockOrder as any).deliveryOtp ? String((mockOrder as any).deliveryOtp).trim() : ((mockOrder as any).otp ? String((mockOrder as any).otp).trim() : null);
      orderNumber = mockOrder.orderNumber || orderId;
      paymentStatus = ((mockOrder as any).paymentStatus || '').toLowerCase();
      paymentMethod = (mockOrder.paymentMethod || '').toLowerCase();
      collectionStatus = (mockOrder as any).collectionStatus || (paymentStatus === 'paid' ? 'COLLECTED' : 'PENDING');
      assignedPartnerId = mockOrder.partnerId || '';
      orderStatus = mockOrder.orderStatus || 'OUT_FOR_DELIVERY';

      const memState = otpAttemptStore.get(orderId);
      if (memState) {
        otpAttempts = memState.attempts;
        isOtpLocked = memState.isLocked;
      }
    }

    // 3. Partner Assignment Check
    if (auth.role !== 'admin' && assignedPartnerId && assignedPartnerId !== auth.uid) {
      return jsonResponse(
        { success: false, error: 'Forbidden. You are not assigned to deliver this order.' },
        { status: 403 }
      );
    }

    // 4. Order Status Check
    const upperStatus = orderStatus.toUpperCase();
    if (upperStatus === 'DELIVERED' || upperStatus === 'COMPLETED') {
      return jsonResponse(
        { success: false, error: 'Order has already been delivered.' },
        { status: 400 }
      );
    }
    if (upperStatus === 'CANCELLED') {
      return jsonResponse(
        { success: false, error: 'Order has been cancelled.' },
        { status: 400 }
      );
    }

    // 5. Strict Payment & Collection Gate
    const isOnlinePrepaid = paymentMethod === 'online' || paymentMethod === 'upi' || paymentMethod === 'razorpay' || paymentMethod === 'phonepe' || paymentMethod === 'card';
    const isCodCash = paymentMethod.includes('cash') || paymentMethod === 'cod_cash' || collectionMethod === 'CASH';
    const isCodUpi = paymentMethod.includes('upi') || paymentMethod === 'phonepe_upi' || paymentMethod === 'cod_upi' || collectionMethod === 'UPI';

    if (isOnlinePrepaid) {
      if (paymentStatus !== 'paid' && paymentStatus !== 'completed') {
        return jsonResponse(
          {
            success: false,
            error: 'Cannot verify OTP: Online payment is not confirmed.',
            paymentStatus,
          },
          { status: 400 }
        );
      }
    } else if (isCodCash) {
      if (collectionStatus !== 'COLLECTED' && paymentStatus !== 'paid') {
        return jsonResponse(
          {
            success: false,
            error: 'Cannot verify OTP: Cash collection must be recorded first.',
            collectionStatus,
          },
          { status: 400 }
        );
      }
    } else if (isCodUpi) {
      if (paymentStatus !== 'paid' && paymentStatus !== 'completed') {
        return jsonResponse(
          {
            success: false,
            error: 'Cannot verify OTP: PhonePe UPI payment is not verified by gateway.',
            paymentStatus,
          },
          { status: 400 }
        );
      }
    } else if (paymentStatus !== 'paid' && collectionStatus !== 'COLLECTED') {
      return jsonResponse(
        {
          success: false,
          error: 'Cannot verify OTP: Payment or COD collection is required before delivery.',
          paymentStatus,
        },
        { status: 400 }
      );
    }

    // 6. Check if OTP is Locked due to brute force
    if (isOtpLocked || otpAttempts >= 5) {
      return jsonResponse(
        {
          success: false,
          error: 'OTP verification is locked due to 5 failed attempts. Please request an admin delivery exception.',
          isLocked: true,
          attempts: otpAttempts,
        },
        { status: 429 }
      );
    }

    // 7. Authoritative OTP Validation
    const cleanOtp = (otp || '').toString().trim();
    if (!cleanOtp) {
      return jsonResponse(
        { success: false, error: 'Delivery OTP is required.' },
        { status: 400 }
      );
    }

    if (!expectedOtp) {
      return jsonResponse(
        { success: false, error: 'No delivery OTP configured for this order.' },
        { status: 400 }
      );
    }

    const isMatching = cleanOtp === expectedOtp;

    if (!isMatching) {
      const newAttempts = otpAttempts + 1;
      const willLock = newAttempts >= 5;

      // Update attempt count
      if (isFirebaseConfigured() && db) {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
          deliveryOtpAttempts: newAttempts,
          deliveryOtpLocked: willLock,
          lastFailedOtpAttemptAt: new Date().toISOString(),
        });

        if (willLock) {
          // Log security alert in audit_logs
          await setDoc(doc(db, 'auditLogs', `alert_lock_${orderId}_${Date.now()}`), {
            id: `alert_lock_${orderId}_${Date.now()}`,
            action: 'OTP_VERIFICATION_LOCKED',
            orderId,
            orderNumber,
            actorId: auth.uid,
            actorRole: auth.role,
            description: `⚠️ OTP Verification locked for Order #${orderNumber} after 5 failed attempts.`,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        otpAttemptStore.set(orderId, { attempts: newAttempts, isLocked: willLock, lockedAt: willLock ? Date.now() : undefined });
      }

      return jsonResponse(
        {
          success: false,
          error: willLock
            ? 'OTP verification locked: 5 failed attempts reached. Please request an exception.'
            : `Incorrect OTP. ${5 - newAttempts} attempt(s) remaining.`,
          attemptsRemaining: Math.max(0, 5 - newAttempts),
          isLocked: willLock,
        },
        { status: 400 }
      );
    }

    // 8. Update order on success
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        deliveryOtpAttempts: 0,
        deliveryOtpLocked: false,
        deliveryOtpVerified: true,
        deliveryOtpVerifiedAt: new Date().toISOString(),
        deliveryOtpVerifiedBy: auth.uid,
      });
    }

    // 9. Success Response
    return jsonResponse({
      success: true,
      message: 'Delivery OTP verified successfully!',
      data: {
        verified: true,
        orderId,
        orderNumber,
        otpStatus: 'VERIFIED',
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Delivery OTP Verify Error]', error);
    return jsonResponse(
      { success: false, error: error.message || 'OTP verification failed' },
      { status: 500 }
    );
  }
}
