import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { PaymentDoc } from '@/lib/firestoreSchema';

// PhonePe Sandbox / Production Base URLs
const SANDBOX_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox';
const PROD_URL = 'https://api.phonepe.com/apis/hermes';

// Edge/Node-safe JWT payload decoder
function decodeUserFromSession(sessionToken: string) {
  try {
    const parts = sessionToken.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);
    return {
      uid: parsed.sub || parsed.uid || '',
      role: parsed.role || 'customer'
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // ── 1. AUTHENTICATION & DEV BYPASS ─────────────────────────────
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('__pk_session')?.value || cookieStore.get('__session')?.value;
    
    let uid = 'usr-cust-1';
    let authEnabled = process.env.NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED === 'true';
    
    if (sessionToken) {
      const user = decodeUserFromSession(sessionToken);
      if (user) {
        uid = user.uid;
      } else if (authEnabled) {
        return NextResponse.json({ success: false, error: 'Unauthorized session' }, { status: 401 });
      }
    } else if (authEnabled) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // ── 2. DATABASE ORDER FETCH & VERIFICATION ─────────────────────
    const isMockOrder = String(orderId).includes('test_phonepe_');

    if (isMockOrder || !isFirebaseConfigured() || !db) {
      // Offline/Local mock simulation fallback
      const mockTxnId = `TXN_PK_MOCK_${orderId}_${Date.now()}`;
      const mockAmount = String(orderId).includes('999') ? 350.00 : 450.00;
      return NextResponse.json({
        success: true,
        data: {
          merchantTransactionId: mockTxnId,
          redirectUrl: `/checkout/mock-phonepe?transactionId=${mockTxnId}&orderId=${orderId}&amount=${mockAmount}`,
          isSimulation: true
        }
      });
    }

    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;
    if (orderData.customerId !== uid) {
      return NextResponse.json({ success: false, error: 'Access denied: Order ownership mismatch' }, { status: 403 });
    }

    if (orderData.paymentStatus === 'completed' || orderData.paymentStatus === 'paid') {
      return NextResponse.json({ success: false, error: 'Order has already been paid' }, { status: 400 });
    }

    const totalAmount = orderData.total; // in Rupees
    const amountInPaise = Math.round(totalAmount * 100);

    // ── 3. TRANSACTION ID & CREDENTIAL CHECK ────────────────────────
    const merchantTransactionId = `TXN_PK_${orderData.orderNumber || orderId}_${Date.now()}`;
    
    const merchantId = process.env.PHONEPE_MERCHANT_ID || 'PGUATPAYOUT';
    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const env = process.env.PHONEPE_ENV || 'sandbox';

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // If API credentials are not properly configured, run mock simulator automatically
    if (!saltKey || saltKey === 'mock_salt_key') {
      const mockTxnId = `TXN_PK_MOCK_${orderData.orderNumber || orderId}_${Date.now()}`;
      
      // Save pending payment record in Firestore
      const paymentRef = doc(db, 'payments', `pay_pk_${mockTxnId}`);
      const paymentDoc: PaymentDoc = {
        paymentId: `pay_pk_${mockTxnId}`,
        orderId,
        customerId: uid,
        amount: totalAmount,
        currency: 'INR',
        method: 'phonepe',
        status: 'pending',
        gateway: 'phonepe',
        gatewayOrderId: mockTxnId,
        createdAt: new Date().toISOString()
      };
      await setDoc(paymentRef, paymentDoc);

      return NextResponse.json({
        success: true,
        data: {
          merchantTransactionId: mockTxnId,
          redirectUrl: `/checkout/mock-phonepe?transactionId=${mockTxnId}&orderId=${orderId}&amount=${totalAmount}`,
          isSimulation: true
        }
      });
    }

    // ── 4. PHONEPE REQUEST INITIATION ──────────────────────────────
    const payload = {
      merchantId,
      merchantTransactionId,
      merchantUserId: `USER_${uid}`,
      amount: amountInPaise,
      redirectUrl: `${siteUrl}/checkout/success?merchantTransactionId=${merchantTransactionId}&orderId=${orderId}`,
      redirectMode: 'REDIRECT',
      callbackUrl: `${siteUrl}/api/payments/phonepe/webhook`,
      mobileNumber: orderData.customerPhone ? orderData.customerPhone.replace(/[^0-9]/g, '').slice(-10) : '9999999999',
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const payloadJson = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadJson).toString('base64');
    
    // X-VERIFY signature creation: SHA256(base64Payload + "/pg/v1/pay" + saltKey) + "###" + saltIndex
    const endpoint = '/pg/v1/pay';
    const hash = crypto
      .createHash('sha256')
      .update(payloadBase64 + endpoint + saltKey)
      .digest('hex');
    const xVerifyHeader = `${hash}###${saltIndex}`;

    const phonepeApiUrl = `${env === 'production' ? PROD_URL : SANDBOX_URL}${endpoint}`;

    const apiResponse = await fetch(phonepeApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerifyHeader
      },
      body: JSON.stringify({ request: payloadBase64 })
    });

    const apiJson = await apiResponse.json();

    if (!apiJson.success) {
      console.error('[PhonePe API Error Response]', apiJson);
      return NextResponse.json(
        { success: false, error: apiJson.message || 'PhonePe payment initiation failed' },
        { status: 502 }
      );
    }

    const redirectUrl = apiJson.data.instrumentResponse.redirectInfo.url;

    // ── 5. RECORD PENDING TRANSACTION ─────────────────────────────
    const paymentRef = doc(db, 'payments', `pay_pk_${merchantTransactionId}`);
    const paymentDoc: PaymentDoc = {
      paymentId: `pay_pk_${merchantTransactionId}`,
      orderId,
      customerId: uid,
      amount: totalAmount,
      currency: 'INR',
      method: 'phonepe',
      status: 'pending',
      gateway: 'phonepe',
      gatewayOrderId: merchantTransactionId,
      createdAt: new Date().toISOString()
    };
    await setDoc(paymentRef, paymentDoc);

    return NextResponse.json({
      success: true,
      data: {
        merchantTransactionId,
        redirectUrl,
        isSimulation: false
      }
    });

  } catch (error: any) {
    console.error('[PhonePe Create Order Exception]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error initiating payment' },
      { status: 500 }
    );
  }
}
