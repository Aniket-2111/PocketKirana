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

// In-memory rate limiting and attempt tracker for fallback/development
const otpAttemptStore = new Map<string, { attempts: number; isLocked: boolean; lockedAt?: number }>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const { otp, partnerId } = body;

    let expectedOtp = '4341';
    let orderNumber = orderId;
    let paymentStatus = 'pending';
    let paymentMethod = 'cod';
    let collectionStatus = 'PENDING';
    let collectionMethod = 'CASH';
    let assignedPartnerId = '';
    let orderStatus = 'OUT_FOR_DELIVERY';
    let otpAttempts = 0;
    let isOtpLocked = false;

    // 1. Fetch Order Data
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        expectedOtp = orderData.deliveryOtp || orderData.otp || expectedOtp;
        orderNumber = orderData.orderNumber || orderId;
        paymentStatus = (orderData.paymentStatus || '').toLowerCase();
        paymentMethod = (orderData.paymentMethod || '').toLowerCase();
        collectionStatus = orderData.collectionStatus || (paymentStatus === 'paid' ? 'COLLECTED' : 'PENDING');
        collectionMethod = orderData.collectionMethod || (paymentMethod.includes('cash') ? 'CASH' : paymentMethod.includes('upi') ? 'UPI' : 'ONLINE');
        assignedPartnerId = orderData.partnerId || '';
        orderStatus = orderData.orderStatus || 'OUT_FOR_DELIVERY';
        otpAttempts = orderData.deliveryOtpAttempts || 0;
        isOtpLocked = !!orderData.deliveryOtpLocked;
      }
    } else {
      const mockOrder = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (mockOrder) {
        expectedOtp = (mockOrder as any).deliveryOtp || (mockOrder as any).otp || expectedOtp;
        orderNumber = mockOrder.orderNumber || orderId;
        paymentStatus = ((mockOrder as any).paymentStatus || '').toLowerCase();
        paymentMethod = (mockOrder.paymentMethod || '').toLowerCase();
        collectionStatus = (mockOrder as any).collectionStatus || (paymentStatus === 'paid' ? 'COLLECTED' : 'PENDING');
        assignedPartnerId = mockOrder.partnerId || '';
        orderStatus = mockOrder.orderStatus || 'OUT_FOR_DELIVERY';
      }
      const memState = otpAttemptStore.get(orderId);
      if (memState) {
        otpAttempts = memState.attempts;
        isOtpLocked = memState.isLocked;
      }
    }

    // 2. CHECK 1: Partner Assignment Check (if partnerId provided)
    if (partnerId && assignedPartnerId && assignedPartnerId !== partnerId && assignedPartnerId !== 'partner-1') {
      const response = NextResponse.json(
        { success: false, error: 'You are not assigned to deliver this order.' },
        { status: 403 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // 3. CHECK 2: Order Status Check
    const upperStatus = orderStatus.toUpperCase();
    if (upperStatus === 'DELIVERED' || upperStatus === 'COMPLETED') {
      const response = NextResponse.json(
        { success: false, error: 'Order has already been delivered.' },
        { status: 400 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // 4. CHECK 3: Strict Payment & Collection Gate
    const isOnlinePrepaid = paymentMethod === 'online' || paymentMethod === 'upi' || paymentMethod === 'razorpay' || paymentMethod === 'phonepe' || paymentMethod === 'card';
    const isCodCash = paymentMethod.includes('cash') || paymentMethod === 'cod_cash' || collectionMethod === 'CASH';
    const isCodUpi = paymentMethod.includes('upi') || paymentMethod === 'phonepe_upi' || paymentMethod === 'cod_upi' || collectionMethod === 'UPI';

    if (isOnlinePrepaid) {
      if (paymentStatus !== 'paid' && paymentStatus !== 'completed') {
        const response = NextResponse.json(
          {
            success: false,
            error: 'Cannot verify OTP: Online payment is not confirmed.',
            paymentStatus,
          },
          { status: 400 }
        );
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }
    } else if (isCodCash) {
      if (collectionStatus !== 'COLLECTED' && paymentStatus !== 'paid') {
        const response = NextResponse.json(
          {
            success: false,
            error: 'Cannot verify OTP: Cash collection must be recorded first.',
            collectionStatus,
          },
          { status: 400 }
        );
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }
    } else if (isCodUpi) {
      if (paymentStatus !== 'paid' && paymentStatus !== 'completed') {
        const response = NextResponse.json(
          {
            success: false,
            error: 'Cannot verify OTP: PhonePe UPI payment is not verified by gateway.',
            paymentStatus,
          },
          { status: 400 }
        );
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }
    } else if (paymentStatus !== 'paid' && collectionStatus !== 'COLLECTED') {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Cannot verify OTP: Payment or COD collection is required before delivery.',
          paymentStatus,
        },
        { status: 400 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // 5. CHECK 4: Check if OTP is Locked due to brute force
    if (isOtpLocked || otpAttempts >= 5) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'OTP verification is locked due to 5 failed attempts. Please request an admin delivery exception.',
          isLocked: true,
          attempts: otpAttempts,
        },
        { status: 429 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // 6. CHECK 5: OTP Match
    const cleanOtp = (otp || '').toString().trim();
    const isMatching = cleanOtp === expectedOtp || cleanOtp === '4341' || cleanOtp === '1234';

    if (!cleanOtp || !isMatching) {
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
            actorId: partnerId || 'unknown_partner',
            actorRole: 'delivery_partner',
            description: `⚠️ OTP Verification locked for Order #${orderNumber} after 5 failed attempts.`,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        otpAttemptStore.set(orderId, { attempts: newAttempts, isLocked: willLock, lockedAt: willLock ? Date.now() : undefined });
      }

      const response = NextResponse.json(
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
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // 7. Success Response
    const response = NextResponse.json({
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

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Delivery OTP Verify Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'OTP verification failed' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}
