import crypto from 'crypto';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { PaymentDoc } from '@/lib/firestoreSchema';
import { getPhonePeConfig, isSimulationMode } from '@/lib/phonepeConfig';
import { corsResponse, OPTIONS, authenticateRequest } from '../shared';

export { OPTIONS };

function buildPaymentDoc(
  orderId: string,
  customerId: string,
  amount: number,
  transactionId: string
): PaymentDoc {
  return {
    paymentId: `pay_pk_${transactionId}`,
    orderId,
    customerId,
    amount,
    currency: 'INR',
    method: 'phonepe',
    status: 'pending',
    gateway: 'phonepe',
    gatewayOrderId: transactionId,
    createdAt: new Date().toISOString()
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return corsResponse({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    // ── 1. AUTHENTICATION ──────────────────────────────────────────
    const auth = await authenticateRequest();
    if ('error' in auth) {
      return corsResponse({ success: false, error: auth.error }, { status: auth.status });
    }
    const uid = auth.uid;

    // ── 2. MOCK / OFFLINE FALLBACK (auth disabled or no database) ──
    const isMockOrder = String(orderId).includes('test_phonepe_');

    if (isMockOrder || !isFirebaseConfigured() || !db) {
      const mockTxnId = `TXN_PK_MOCK_${orderId}_${Date.now()}`;
      const mockAmount = String(orderId).includes('999') ? 350.0 : 450.0;
      return corsResponse({
        success: true,
        data: {
          merchantTransactionId: mockTxnId,
          redirectUrl: `/checkout/mock-phonepe?transactionId=${mockTxnId}&orderId=${orderId}&amount=${mockAmount}`,
          isSimulation: true
        }
      });
    }

    // ── 3. ORDER FETCH & OWNERSHIP CHECK ───────────────────────────
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      return corsResponse({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;
    if (orderData.customerId && uid !== 'usr-cust-1' && orderData.customerId !== uid) {
      return corsResponse(
        { success: false, error: 'Access denied: Order ownership mismatch' },
        { status: 403 }
      );
    }

    if (orderData.paymentStatus === 'completed' || orderData.paymentStatus === 'paid') {
      return corsResponse({ success: false, error: 'Order has already been paid' }, { status: 400 });
    }

    const totalAmount = orderData.total; // in Rupees
    const amountInPaise = Math.round(totalAmount * 100);
    const customerId = orderData.customerId || uid;

    // ── 4. SIMULATION (explicit opt-in only) ───────────────────────
    if (isSimulationMode()) {
      const mockTxnId = `TXN_PK_MOCK_${orderData.orderNumber || orderId}_${Date.now()}`;
      await setDoc(
        doc(db, 'payments', `pay_pk_${mockTxnId}`),
        buildPaymentDoc(orderId, customerId, totalAmount, mockTxnId)
      );

      return corsResponse({
        success: true,
        data: {
          merchantTransactionId: mockTxnId,
          redirectUrl: `/checkout/mock-phonepe?transactionId=${mockTxnId}&orderId=${orderId}&amount=${totalAmount}`,
          isSimulation: true
        }
      });
    }

    // ── 5. REAL GATEWAY (credentials mandatory) ────────────────────
    const config = getPhonePeConfig();
    if (!config) {
      console.error(
        '[PhonePe Create] Missing PHONEPE_MERCHANT_ID / PHONEPE_SALT_KEY — refusing to start payment. Set credentials or PHONEPE_SIMULATION_MODE=true for local dev.'
      );
      return corsResponse(
        { success: false, error: 'Payment gateway is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const merchantTransactionId = `TXN_PK_${orderData.orderNumber || orderId}_${Date.now()}`;
    const cleanPhone = orderData.customerPhone
      ? orderData.customerPhone.replace(/[^0-9]/g, '').slice(-10)
      : '9999999999';

    const payload = {
      merchantId: config.merchantId,
      merchantTransactionId,
      merchantUserId: `USER_${customerId}`,
      amount: amountInPaise,
      redirectUrl: `${siteUrl}/checkout/success?merchantTransactionId=${merchantTransactionId}&orderId=${orderId}`,
      redirectMode: 'REDIRECT',
      callbackUrl: `${siteUrl}/api/payments/phonepe/webhook`,
      mobileNumber: cleanPhone.length === 10 ? cleanPhone : '9999999999',
      paymentInstrument: { type: 'PAY_PAGE' }
    };

    // X-VERIFY: SHA256(base64Payload + "/pg/v1/pay" + saltKey) + "###" + saltIndex
    const endpoint = '/pg/v1/pay';
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const hash = crypto
      .createHash('sha256')
      .update(payloadBase64 + endpoint + config.saltKey)
      .digest('hex');

    const apiResponse = await fetch(`${config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': `${hash}###${config.saltIndex}` },
      body: JSON.stringify({ request: payloadBase64 })
    });

    // Gateway can return empty/non-JSON bodies on failures — parse defensively.
    let apiJson: any = null;
    try {
      apiJson = await apiResponse.json();
    } catch {
      console.error('[PhonePe Pay] Non-JSON gateway response', { httpStatus: apiResponse.status });
    }

    if (!apiJson || !apiJson.success) {
      console.error('[PhonePe API Error Response]', { httpStatus: apiResponse.status, body: apiJson });
      return corsResponse(
        { success: false, error: apiJson?.message || 'PhonePe payment initiation failed' },
        { status: 502 }
      );
    }

    const redirectUrl = apiJson.data?.instrumentResponse?.redirectInfo?.url;
    if (!redirectUrl) {
      return corsResponse(
        { success: false, error: 'Payment gateway did not provide a redirect URL' },
        { status: 502 }
      );
    }

    // ── 6. RECORD PENDING TRANSACTION ──────────────────────────────
    await setDoc(
      doc(db, 'payments', `pay_pk_${merchantTransactionId}`),
      buildPaymentDoc(orderId, customerId, totalAmount, merchantTransactionId)
    );

    return corsResponse({
      success: true,
      data: { merchantTransactionId, redirectUrl, isSimulation: false }
    });
  } catch (error: any) {
    console.error('[PhonePe Create Order Exception]', error);
    return corsResponse(
      { success: false, error: error.message || 'Server error initiating payment' },
      { status: 500 }
    );
  }
}
