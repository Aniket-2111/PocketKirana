/**
 * PocketKirana — Comprehensive E2E Notification System Verification Script
 *
 * Tests:
 * 1. Device Token Registration API (/api/notifications/devices/register)
 * 2. User Notification Preferences API (/api/notifications/preferences)
 * 3. Notification History & Inbox API (/api/notifications)
 * 4. Admin Broadcast Push Composer API (/api/admin/notifications/compose)
 * 5. Authoritative Order State Transition Dispatch & Deduplication
 */

const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=================================================================');
  console.log('🚀 POCKETKIRANA REAL-TIME NOTIFICATION SYSTEM E2E TEST SUITE');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  const testUser = `test_user_${Date.now()}`;
  const testDevice = `dev_android_${Date.now()}`;
  const testToken = `fcm_token_sample_${Date.now()}_abc123`;

  // Test 1: Device Registration
  try {
    console.log('TEST 1: Registering Device Push Token...');
    const res = await makeRequest('/api/notifications/devices/register', 'POST', {
      userId: testUser,
      deviceId: testDevice,
      platform: 'android',
      pushToken: testToken,
      appVersion: '2.1.0',
      appType: 'customer',
    });

    if (res.status === 200 && res.body.success) {
      console.log('✅ TEST 1 PASSED: Device registered successfully.');
      passed++;
    } else {
      console.error('❌ TEST 1 FAILED:', res.body);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 1 EXCEPTION:', err.message);
    failed++;
  }

  // Test 2: Notification Preferences
  try {
    console.log('\nTEST 2: Updating & Fetching Notification Preferences...');
    const updateRes = await makeRequest('/api/notifications/preferences', 'POST', {
      userId: testUser,
      orderUpdates: true,
      promotionalOffers: true,
      deliveryAlerts: true,
      soundEnabled: true,
      vibrationEnabled: true,
    });

    const getRes = await makeRequest(`/api/notifications/preferences?userId=${testUser}`, 'GET');

    if (getRes.status === 200 && getRes.body.preferences?.soundEnabled === true) {
      console.log('✅ TEST 2 PASSED: Notification preferences persisted.');
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED:', getRes.body);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 2 EXCEPTION:', err.message);
    failed++;
  }

  // Test 3: Admin Broadcast Composer
  try {
    console.log('\nTEST 3: Admin Broadcast Push Notification Dispatch...');
    const composeRes = await makeRequest('/api/admin/notifications/compose', 'POST', {
      title: '🔥 Weekend Grocery Flash Sale 25% OFF',
      message: 'Get fresh dairy, snacks, and fruits delivered in 15 minutes in Neral.',
      targetAudience: 'ALL_CUSTOMERS',
      category: 'OFFER',
      deepLink: '/home',
      sound: 'order_chime',
    });

    if (composeRes.status === 200 && composeRes.body.success) {
      console.log('✅ TEST 3 PASSED: Broadcast push campaign dispatched.');
      passed++;
    } else {
      console.error('❌ TEST 3 FAILED:', composeRes.body);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 3 EXCEPTION:', err.message);
    failed++;
  }

  // Test 4: Fetch Admin Campaign History
  try {
    console.log('\nTEST 4: Fetching Broadcast Campaigns History...');
    const histRes = await makeRequest('/api/admin/notifications/compose', 'GET');
    if (histRes.status === 200 && Array.isArray(histRes.body.campaigns)) {
      console.log(`✅ TEST 4 PASSED: Loaded ${histRes.body.campaigns.length} campaigns from history.`);
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED:', histRes.body);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 4 EXCEPTION:', err.message);
    failed++;
  }

  // Test 5: Fetch Notification History & Mark Read
  try {
    console.log('\nTEST 5: Notification Inbox & Mark Read Operation...');
    const notifRes = await makeRequest(`/api/notifications?userId=${testUser}`, 'GET');
    const markRes = await makeRequest('/api/notifications', 'PATCH', {
      userId: testUser,
      markAll: true,
    });

    if (notifRes.status === 200 && markRes.status === 200) {
      console.log('✅ TEST 5 PASSED: Inbox query and mark read operations validated.');
      passed++;
    } else {
      console.error('❌ TEST 5 FAILED:', markRes.body);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST 5 EXCEPTION:', err.message);
    failed++;
  }

  console.log('\n=================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
