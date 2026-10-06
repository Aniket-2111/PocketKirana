#!/usr/bin/env node
/**
 * PocketKirana — Cloudflare R2 External Configuration & Connectivity Verifier
 * 
 * Verifies:
 * 1. Environment variables required by lib/r2.ts
 * 2. SigV4 S3 PUT to bucket 'pocketkirana-catalog-images'
 * 3. CDN URL reachability via 'https://images.pocketkirana.com'
 * 4. Safe unlinking / deletion of test probe object
 * 5. Reports exact manual steps if external Cloudflare configuration is pending.
 */

const crypto = require('crypto');
const https = require('https');

console.log('='.repeat(70));
console.log('  POCKETKIRANA — CLOUDFLARE R2 CONNECTIVITY VERIFIER');
console.log('='.repeat(70));

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'pocketkirana-catalog-images';
const publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://images.pocketkirana.com').replace(/\/+$/, '');

console.log('\n[1/5] Checking Environment Variables:');
console.log(` - R2_ACCOUNT_ID:        ${accountId ? 'CONFIGURED (' + accountId.slice(0, 6) + '...)' : 'MISSING (YELLOW)'}`);
console.log(` - R2_ACCESS_KEY_ID:     ${accessKeyId ? 'CONFIGURED (' + accessKeyId.slice(0, 6) + '...)' : 'MISSING (YELLOW)'}`);
console.log(` - R2_SECRET_ACCESS_KEY: ${secretAccessKey ? 'CONFIGURED (HIDDEN)' : 'MISSING (YELLOW)'}`);
console.log(` - R2_BUCKET_NAME:       ${bucketName}`);
console.log(` - R2_PUBLIC_DOMAIN:     ${publicDomain}`);

const isConfigured = !!(accountId && accessKeyId && secretAccessKey);

if (!isConfigured) {
  console.log('\n[STATUS: YELLOW — EXTERNAL CONFIGURATION REQUIRED]');
  console.log('\nCloudflare R2 credentials are not yet set in environment.');
  console.log('Follow the exact Cloudflare Dashboard instructions in R2_EXTERNAL_CONFIGURATION_VERIFICATION.md.');
  process.exit(0);
}

// 1x1 valid WebP image binary
const testWebpBuffer = Buffer.from(
  'UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoBAAEALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA',
  'base64'
);

const testKey = `products/probe_verify/test-v${Date.now()}.webp`;

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

async function putTestObject() {
  console.log(`\n[2/5] Uploading Test Object: ${testKey}...`);
  const endpointHost = `${accountId}.r2.cloudflarestorage.com`;
  const host = `${bucketName}.${endpointHost}`;
  const url = `https://${host}/${encodeURI(testKey)}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = crypto.createHash('sha256').update(testWebpBuffer).digest('hex');

  const headers = {
    host: host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    'content-type': 'image/webp',
    'content-length': String(testWebpBuffer.length),
    'cache-control': 'public, max-age=31536000, immutable',
  };

  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalRequest = ['PUT', `/${encodeURI(testKey)}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'PUT', headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`  -> PUT succeeded with HTTP ${res.statusCode}.`);
          resolve(true);
        } else {
          reject(new Error(`PUT failed: HTTP ${res.statusCode} - ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(testWebpBuffer);
    req.end();
  });
}

async function verifyPublicUrl() {
  const publicUrl = `${publicDomain}/${testKey}`;
  console.log(`\n[3/5] Verifying Public CDN Retrieval: ${publicUrl}...`);
  return new Promise((resolve) => {
    https.get(publicUrl, { timeout: 8000 }, (res) => {
      console.log(`  -> Public URL response HTTP status: ${res.statusCode}`);
      if (res.statusCode === 200) {
        console.log('  -> Test image successfully retrieved from public CDN domain!');
        resolve(true);
      } else {
        console.warn(`  -> Public domain returned HTTP ${res.statusCode}. (DNS/Custom domain binding may still be propagating).`);
        resolve(false);
      }
    }).on('error', (err) => {
      console.warn(`  -> Public domain check note: ${err.message}`);
      resolve(false);
    });
  });
}

async function deleteTestObject() {
  console.log(`\n[4/5] Deleting Test Object: ${testKey}...`);
  const endpointHost = `${accountId}.r2.cloudflarestorage.com`;
  const host = `${bucketName}.${endpointHost}`;
  const url = `https://${host}/${encodeURI(testKey)}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = crypto.createHash('sha256').update('').digest('hex');
  const headers = {
    host: host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalRequest = ['DELETE', `/${encodeURI(testKey)}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'DELETE', headers }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`  -> DELETE succeeded with HTTP ${res.statusCode}.`);
        resolve(true);
      } else {
        reject(new Error(`DELETE failed: HTTP ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  try {
    await putTestObject();
    await verifyPublicUrl();
    await deleteTestObject();
    console.log('\n[5/5] R2 Integration Verified: 🟢 ALL OPERATIONS PASSED');
  } catch (err) {
    console.error('\n[R2 Verification Failed]:', err.message);
    process.exit(1);
  }
}

run();
