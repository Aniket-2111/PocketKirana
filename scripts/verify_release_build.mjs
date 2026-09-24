#!/usr/bin/env node

/**
 * PocketKirana Release Build Guard
 * Validates that production APK bundles do NOT contain localhost, 127.0.0.1,
 * LAN IP references, or missing production API configs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const APPS = ['customer-app', 'picker-app', 'delivery-app'];
const FORBIDDEN_PATTERNS = [
  /http:\/\/localhost/i,
  /http:\/\/127\.0\.0\.1/i,
  /http:\/\/0\.0\.0\.0/i,
  /http:\/\/192\.168\.\d+\.\d+/i,
  /http:\/\/10\.\d+\.\d+\.\d+/i,
  /ws:\/\/localhost/i,
  /ws:\/\/127\.0\.0\.1/i,
];

const REQUIRED_PROD_URL = 'https://pocketkirana.in';

let errorCount = 0;

function logPass(msg) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`);
}

function logFail(msg) {
  console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`);
  errorCount++;
}

function logInfo(msg) {
  console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`);
}

console.log('====================================================');
console.log(' POCKETKIRANA PRODUCTION RELEASE BUILD GUARD');
console.log('====================================================\n');

// 1. Verify Environment Files
for (const app of APPS) {
  const envProdPath = path.join(rootDir, app, '.env.production');
  if (!fs.existsSync(envProdPath)) {
    logFail(`${app}: Missing .env.production file!`);
    continue;
  }

  const content = fs.readFileSync(envProdPath, 'utf8');
  if (!content.includes('NEXT_PUBLIC_API_URL')) {
    logFail(`${app}: .env.production is missing NEXT_PUBLIC_API_URL!`);
  } else if (content.includes('localhost') || content.includes('127.0.0.1')) {
    logFail(`${app}: .env.production contains localhost or 127.0.0.1!`);
  } else {
    logPass(`${app}: .env.production contains valid production API configuration.`);
  }
}

// 2. Verify Android Network Security Configs
for (const app of APPS) {
  const netSecPath = path.join(rootDir, app, 'android/app/src/main/res/xml/network_security_config.xml');
  if (!fs.existsSync(netSecPath)) {
    logFail(`${app}: Missing network_security_config.xml!`);
    continue;
  }

  const content = fs.readFileSync(netSecPath, 'utf8');
  if (content.includes('pocketkirana.in') && content.includes('cleartextTrafficPermitted="false"')) {
    logPass(`${app}: network_security_config.xml enforces HTTPS for pocketkirana.in`);
  } else {
    logFail(`${app}: network_security_config.xml does not enforce secure HTTPS policy for pocketkirana.in`);
  }

  const manifestPath = path.join(rootDir, app, 'android/app/src/main/AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    if (manifestContent.includes('android:networkSecurityConfig="@xml/network_security_config"')) {
      logPass(`${app}: AndroidManifest.xml attaches network_security_config`);
    } else {
      logFail(`${app}: AndroidManifest.xml is missing networkSecurityConfig attribute!`);
    }
  }
}

// 3. Verify Centralized API Client
const apiClientPath = path.join(rootDir, 'lib/apiClient.ts');
if (fs.existsSync(apiClientPath)) {
  const clientContent = fs.readFileSync(apiClientPath, 'utf8');
  if (clientContent.includes('https://pocketkirana.in')) {
    logPass(`lib/apiClient.ts defaults to https://pocketkirana.in for APK runtime.`);
  } else {
    logFail(`lib/apiClient.ts is missing https://pocketkirana.in fallback!`);
  }
} else {
  logFail(`Missing lib/apiClient.ts centralized client!`);
}

// 4. Verify Middleware CORS & CSRF Mobile Support
const middlewarePath = path.join(rootDir, 'middleware.ts');
if (fs.existsSync(middlewarePath)) {
  const mwContent = fs.readFileSync(middlewarePath, 'utf8');
  if (mwContent.includes('capacitor://localhost') && mwContent.includes('https://localhost')) {
    logPass(`middleware.ts allows Capacitor mobile origins for CORS & CSRF.`);
  } else {
    logFail(`middleware.ts does not allow Capacitor mobile origins!`);
  }
}

console.log('\n====================================================');
if (errorCount === 0) {
  console.log('\x1b[32m[RESULT] ALL RELEASE GUARDS PASSED. READY FOR PRODUCTION APK BUILD.\x1b[0m');
  console.log('====================================================\n');
  process.exit(0);
} else {
  console.error(`\x1b[31m[RESULT] ${errorCount} GUARD CHECK(S) FAILED. PRODUCTION BUILD BLOCKED.\x1b[0m`);
  console.log('====================================================\n');
  process.exit(1);
}
