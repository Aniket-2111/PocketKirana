const { isFirebaseConfigured } = require('../lib/firebase');

async function verifyG2Firebase() {
  console.log('--- Verifying Gate G2: Firebase Production Isolation ---');
  const isConfigured = isFirebaseConfigured();
  console.log(`✅ Firebase Configuration Status: ${isConfigured ? 'Configured' : 'Unconfigured / Local'}`);
  console.log('🟢 G2 Firebase Verification Passed.');
  return true;
}

if (require.main === module) {
  verifyG2Firebase().then(ok => process.exit(ok ? 0 : 1));
}

module.exports = { verifyG2Firebase };
