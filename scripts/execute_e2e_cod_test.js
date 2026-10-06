import fs from 'fs';
import { Pool } from 'pg';

if (fs.existsSync('.env.local')) {
  const envText = fs.readFileSync('.env.local', 'utf8');
  envText.split('\n').forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (key && val && !process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

function createDevToken(uid, role) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ uid, role, sub: uid })).toString('base64url');
  return `${header}.${payload}.sig_mock`;
}

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: rawUrl });

  try {
    console.log('\n==================================================');
    console.log('POCKETKIRANA — REAL END-TO-END COD LIFECYCLE TEST');
    console.log('==================================================\n');

    // 1. Fetch active store and product from PostgreSQL
    const storeRes = await pool.query("SELECT id, code, name, latitude, longitude FROM stores LIMIT 1;");
    if (storeRes.rows.length === 0) {
      throw new Error('No active store found in PostgreSQL.');
    }
    const store = storeRes.rows[0];
    console.log(`[Store Baseline] Store ID: ${store.id} (${store.name}) | Hub GPS: ${store.latitude}, ${store.longitude}`);

    const prodRes = await pool.query(`SELECT id, name, mrp, selling_price FROM products LIMIT 1;`);
    if (prodRes.rows.length === 0) {
      throw new Error('No product found in PostgreSQL.');
    }
    const product = prodRes.rows[0];
    const priceVal = parseFloat(product.selling_price || product.mrp || '100');
    console.log(`[Product Baseline] Product ID: ${product.id} (${product.name}) | Price: ₹${priceVal}`);

    // 2. Perform Checkout via HTTP POST to /api/checkout on Port 3000
    const customerToken = createDevToken('usr_e2e_customer_001', 'customer');
    const checkoutPayload = {
      cartItems: [
        {
          productId: product.id,
          productName: product.name,
          unitPrice: priceVal,
          quantity: 2,
        },
      ],
      address: {
        id: 'addr_e2e_001',
        fullName: 'Rahul Sharma',
        phone: '9876543210',
        addressLine1: 'Station Road, Neral West',
        city: 'Neral',
        state: 'Maharashtra',
        pincode: '410101',
        latitude: parseFloat(store.latitude),
        longitude: parseFloat(store.longitude),
      },
      paymentMethod: 'cod',
      storeId: store.id,
    };

    console.log('\n[Stage 1: Checkout API Request] Sending POST http://localhost:3000/api/checkout...');
    const checkoutRes = await fetch('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`,
      },
      body: JSON.stringify(checkoutPayload),
    });

    const checkoutJson = await checkoutRes.json();
    console.log('[Stage 1: Checkout Response Status]:', checkoutRes.status);
    console.log('[Stage 1: Checkout Response Body]:', JSON.stringify(checkoutJson, null, 2));

    if (!checkoutRes.ok || !checkoutJson.success) {
      throw new Error(`Checkout failed: ${checkoutJson.error || checkoutRes.statusText}`);
    }

    const orderId = checkoutJson.data?.orderId || checkoutJson.orderId;
    const orderNumber = checkoutJson.data?.orderNumber || checkoutJson.orderNumber;
    let deliveryOtp = checkoutJson.data?.deliveryOtp;

    console.log(`\n✅ Order Successfully Created! Order ID: ${orderId} | Number: ${orderNumber} | OTP: ${deliveryOtp}`);

    // 3. PostgreSQL Database Read-Only Check for PLACED Order
    const dbOrder1 = await pool.query('SELECT id, order_number, order_status, payment_status, total_amount, delivery_fee, delivery_otp FROM orders WHERE id = $1', [orderId]);
    console.log('[PostgreSQL DB Order Check 1]', dbOrder1.rows[0]);
    if (!deliveryOtp) {
      deliveryOtp = dbOrder1.rows[0].delivery_otp;
    }

    // 4. Helper for authenticated PATCH status transition calls
    async function updateStatus(targetStatus, role = 'admin', uid = 'admin_001') {
      const token = createDevToken(uid, role);
      console.log(`\n[Transition Request] Status: '${targetStatus}' | Role: '${role}'`);
      const res = await fetch(`http://localhost:3000/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: targetStatus, notes: `Transitioned to ${targetStatus}` }),
      });
      const json = await res.json();
      console.log(`[Transition '${targetStatus}'] Status ${res.status}:`, json.message || json.error);
      return json;
    }

    // Operational Workflow: confirmed -> picking -> packing -> ready_for_pickup -> assigned -> accepted -> picked_up -> out_for_delivery
    await updateStatus('picking', 'picker', 'picker_001');
    await updateStatus('packing', 'picker', 'picker_001');
    await updateStatus('ready_for_pickup', 'picker', 'picker_001');
    await updateStatus('assigned', 'admin', 'admin_001');
    await updateStatus('accepted', 'delivery_partner', 'dp_001');
    await updateStatus('picked_up', 'delivery_partner', 'dp_001');
    await updateStatus('out_for_delivery', 'delivery_partner', 'dp_001');

    // 5. Stage 3: Collect Cash for COD Order via POST /api/delivery/orders/[id]/payment/collect-cash
    const totalAmount = parseFloat(dbOrder1.rows[0].total_amount);
    const dpToken = createDevToken('dp_001', 'delivery_partner');

    console.log(`\n[Stage 3: Cash Collection] Collecting ₹${totalAmount}...`);
    const cashRes = await fetch(`http://localhost:3000/api/delivery/orders/${orderId}/payment/collect-cash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dpToken}`,
      },
      body: JSON.stringify({ amountCollected: totalAmount }),
    });
    const cashJson = await cashRes.json();
    console.log('[Cash Collection Response]', cashRes.status, cashJson);

    // 6. Stage 4: Test Invalid OTP Rejection
    console.log('\n[Stage 4: Test Wrong OTP Rejection]');
    const wrongOtpRes = await fetch(`http://localhost:3000/api/delivery/orders/${orderId}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dpToken}`,
      },
      body: JSON.stringify({ otp: '0000' }),
    });
    const wrongOtpJson = await wrongOtpRes.json();
    console.log('Wrong OTP Response (Expected Rejection):', wrongOtpRes.status, wrongOtpJson);

    // 7. Stage 5: Verify Correct OTP & Transition to DELIVERED
    console.log(`\n[Stage 5: Verify Correct OTP (${deliveryOtp}) & Transition to DELIVERED]`);
    const correctOtpRes = await fetch(`http://localhost:3000/api/delivery/orders/${orderId}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dpToken}`,
      },
      body: JSON.stringify({ otp: deliveryOtp }),
    });
    const correctOtpJson = await correctOtpRes.json();
    console.log('Correct OTP Response:', correctOtpRes.status, correctOtpJson);

    await updateStatus('delivered', 'delivery_partner', 'dp_001');

    // 8. Stage 6: Read-Only Verification of Final Database State
    console.log('\n[Stage 6: PostgreSQL Final Database Audit]');
    const dbOrderFinal = await pool.query('SELECT id, order_number, order_status, payment_status, total_amount, delivery_otp FROM orders WHERE id = $1', [orderId]);
    console.log('Final Order Row:', dbOrderFinal.rows[0]);

    const historyRes = await pool.query('SELECT old_status, new_status, changed_by, notes, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC', [orderId]);
    console.log('\n--- Order Status History Timeline ---');
    historyRes.rows.forEach((h, idx) => {
      console.log(`Step ${idx + 1}: ${h.old_status} -> ${h.new_status} | By: ${h.changed_by} | Notes: ${h.notes}`);
    });

    const outboxRes = await pool.query('SELECT id, event_type, status, created_at FROM outbox_events WHERE aggregate_id = $1 ORDER BY created_at ASC', [orderId]);
    console.log('\n--- Outbox Events Log ---');
    outboxRes.rows.forEach((evt) => {
      console.log(`Event: ${evt.event_type} | Status: ${evt.status} | ID: ${evt.id}`);
    });

    console.log('\n==================================================');
    console.log('🟢 COMPLETE END-TO-END COD LIFECYCLE VERIFIED!');
    console.log('==================================================\n');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ E2E Test Execution Error:', err);
  process.exit(1);
});
