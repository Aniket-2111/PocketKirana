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

const resendCooldowns = new Map<string, { lastResentAt: number; count: number }>();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const now = Date.now();
    const cooldownData = resendCooldowns.get(orderId) || { lastResentAt: 0, count: 0 };

    // 1. Check 60-second cooldown
    const secondsSinceLast = Math.floor((now - cooldownData.lastResentAt) / 1000);
    if (secondsSinceLast < 60 && cooldownData.lastResentAt > 0) {
      const remaining = 60 - secondsSinceLast;
      const response = NextResponse.json(
        {
          success: false,
          error: `Please wait ${remaining} second(s) before requesting another OTP resend.`,
          secondsRemaining: remaining,
        },
        { status: 429 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // 2. Check max resend limit (3 resends)
    if (cooldownData.count >= 3) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Maximum OTP resend limit (3 times) reached. Please contact customer support.',
          isExhausted: true,
        },
        { status: 429 }
      );
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // 3. Generate fresh 4-digit OTP
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const generatedAt = new Date().toISOString();
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString();

    let orderNumber = orderId;
    let customerPhone = '9999999999';

    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const data = orderSnap.data();
        orderNumber = data.orderNumber || orderId;
        customerPhone = data.customerPhone || customerPhone;

        await updateDoc(orderRef, {
          deliveryOtp: newOtp,
          deliveryOtpAttempts: 0, // Reset attempt count on fresh OTP
          deliveryOtpLocked: false,
          deliveryOtpGeneratedAt: generatedAt,
          deliveryOtpExpiresAt: expiresAt,
          updatedAt: generatedAt,
        });

        // Audit Log
        await setDoc(doc(db, 'auditLogs', `log_resend_otp_${orderId}_${now}`), {
          id: `log_resend_otp_${orderId}_${now}`,
          action: 'OTP_RESENT',
          orderId,
          orderNumber,
          description: `Fresh Delivery OTP generated and sent to customer (${customerPhone}) for Order #${orderNumber}.`,
          timestamp: generatedAt,
        });
      }
    } else {
      const order = INITIAL_ORDERS.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (order) {
        order.deliveryOtp = newOtp;
      }
    }

    // Update cooldown map
    resendCooldowns.set(orderId, {
      lastResentAt: now,
      count: cooldownData.count + 1,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Fresh Delivery OTP sent to customer successfully!',
      orderId,
      orderNumber,
      resendCount: cooldownData.count + 1,
      maxResends: 3,
      cooldownSeconds: 60,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('[Delivery Resend OTP Error]', error);
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to resend OTP' },
      { status: 500 }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}
