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
    const { orderId, customerPhone: bodyPhone } = body;

    if (!orderId) {
      return corsResponse({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    // ── 1. AUTHENTICATION ──────────────────────────────────────────
    const auth = await authenticateRequest();
    if ('error' in auth) {
      return corsResponse({ success: false, error: auth.error }, { status: auth.status });
    }
    const uid = auth.uid;

    // ── 2. DATABASE READINESS CHECK (fail-closed in production) ───
    if (!isFirebaseConfigured() || !db) {
      return corsResponse(
        { success: false, error: 'Database service is currently unavailable. Please contact support.' },
        { status: 503 }
      );
    }

    const isMockOrder = String(orderId).includes('test_phonepe_');
    if (isMockOrder && !isSimulationMode()) {
      return corsResponse({ success: false, error: 'Invalid order reference' }, { status: 400 });
    }

    // ── 3. ORDER FETCH & OWNERSHIP CHECK (PostgreSQL authoritative) ───
    let orderData: {
      orderId: string;
      orderNumber: string;
      customerId: string;
      total: number;
      paymentStatus: string;
      customerPhone?: string;
    } | null = null;

    try {
      const { queryPostgres } = await import('@/lib/postgres');
      const pgRes = await queryPostgres(
        `SELECT 
           o.id, 
           o.order_number, 
           o.firebase_uid, 
           o.total_amount, 
           o.payment_status,
           oa.phone AS customer_phone
         FROM orders o
         LEFT JOIN order_addresses oa ON oa.order_id = o.id
         WHERE o.id = $1 OR o.order_number = $1 
         LIMIT 1`,
        [orderId]
      );
      if (pgRes.rows.length > 0) {
        const row = pgRes.rows[0];
        orderData = {
          orderId: row.id || orderId,
          orderNumber: row.order_number || row.id || orderId,
          customerId: row.firebase_uid || row.customer_id || '',
          total: parseFloat(row.total_amount || 0),
          paymentStatus: row.payment_status || 'pending',
          customerPhone: row.customer_phone || bodyPhone || undefined,
        };
      }
    } catch (pgErr: any) {
      console.warn('[PhonePe Create] PG query fallback:', pgErr.message);
    }

    if (!orderData && isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const snapData = orderSnap.data()!;
        orderData = {
          orderId,
          orderNumber: snapData.orderNumber || orderId,
          customerId: snapData.customerId || '',
          total: snapData.total,
          paymentStatus: snapData.paymentStatus,
          customerPhone: snapData.customerPhone || bodyPhone || undefined,
        };
      }
    }

    if (!orderData) {
      return corsResponse({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const isGuestOrder = Boolean(orderData.customerId && orderData.customerId.startsWith('usr-guest-'));
    if (orderData.customerId && orderData.customerId !== uid && uid !== 'dev-user' && !isGuestOrder) {
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
          orderId,
          merchantTransactionId: mockTxnId,
          amount: totalAmount,
          redirectUrl: `/checkout/mock-phonepe?transactionId=${mockTxnId}&orderId=${orderId}&amount=${totalAmount}`,
          token: `token_mock_${Date.now()}`,
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

    // ── 6. RECORD PENDING TRANSACTION (PostgreSQL + Firebase mirror) ───
    try {
      const { queryPostgres } = await import('@/lib/postgres');
      await queryPostgres(
        `INSERT INTO payments (
           id, order_id, firebase_uid, payment_method, amount, currency,
           status, gateway, gateway_order_id, created_at
         ) VALUES ($1, $2, $3, 'phonepe', $4, 'INR', 'pending', 'phonepe', $5, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          `pay_pk_${merchantTransactionId}`,
          orderId,
          customerId,
          totalAmount,
          merchantTransactionId,
        ]
      );
    } catch (pgInsertErr: any) {
      console.warn('[PhonePe Create] PG payment insert fallback:', pgInsertErr.message);
    }

    if (isFirebaseConfigured() && db) {
      await setDoc(
        doc(db, 'payments', `pay_pk_${merchantTransactionId}`),
        buildPaymentDoc(orderId, customerId, totalAmount, merchantTransactionId)
      );
    }

    const token = apiJson.data?.instrumentResponse?.token || apiJson.data?.token || '';

    return corsResponse({
      success: true,
      data: {
        orderId,
        merchantTransactionId,
        redirectUrl,
        token,
        amount: totalAmount,
        isSimulation: false
      }
    });
  } catch (error: any) {
    console.error('[PhonePe Create Order Exception]', error);
    return corsResponse(
      { success: false, error: error.message || 'Server error initiating payment' },
      { status: 500 }
    );
  }
}
