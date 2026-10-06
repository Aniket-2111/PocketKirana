# POCKETKIRANA — PRODUCTION ENVIRONMENT VARIABLE SECURITY MATRIX

**Classification Policy:** Zero Secret Exposure  
**Storage Target:** Oracle VPS `/home/pocketkirana/app/.env.production` (Permissions: `chmod 600`)  
**Strict Rule:** No secret variables may ever be committed to Git, embedded in Android APKs, prefixed with `NEXT_PUBLIC_`, or printed in logs.  

---

## 1. Complete Environment Inventory & Classification

| Variable Name | Classification | Target Scope | Required in Prod | Exposure Protection |
| :--- | :--- | :---: | :---: | :--- |
| `NODE_ENV` | **SERVER_CONFIG** | Server Runtime | Yes (`production`) | Server-only; sets Next.js optimizations |
| `PORT` | **SERVER_CONFIG** | Server Runtime | Yes (`3000`) | Internal listening port |
| `NEXT_PUBLIC_SITE_URL` | **PUBLIC** | Client & Server | Yes (`https://pocketkirana.com`) | Safe for SEO, OG tags, canonical URLs |
| `NEXT_PUBLIC_IMAGE_DOMAIN`| **PUBLIC** | Client & Server | Yes (`https://images.pocketkirana.com`) | Public CDN image delivery hostname |
| `NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED` | **PUBLIC** | Edge / Middleware | Yes (`true`) | Enforces JWT token verification in production |
| **Database Credentials** | | | | |
| `DB_HOST` | **DATABASE_SECRET**| Server Runtime | Yes (`127.0.0.1`) | Localhost only; never exposed |
| `DB_PORT` | **SERVER_CONFIG** | Server Runtime | Yes (`5432`) | Default PostgreSQL port |
| `DB_NAME` | **SERVER_CONFIG** | Server Runtime | Yes (`pocketkirana_db`) | Database name |
| `DB_USER` | **DATABASE_SECRET**| Server Runtime | Yes (`pk_app_user`) | Dedicated DML application user |
| `DB_PASSWORD` | **DATABASE_SECRET**| Server Runtime | Yes (Secret) | High-entropy password |
| `DATABASE_URL` | **DATABASE_SECRET**| Server Runtime | Yes (Secret) | Connection string; sanitized in all logs |
| `PG_MAX_POOL_SIZE` | **SERVER_CONFIG** | Server Runtime | Yes (`20`) | Caps database connection pool |
| `PG_STATEMENT_TIMEOUT_MS`| **SERVER_CONFIG** | Server Runtime | Yes (`4000`) | 4s query statement cutoff |
| `PG_CONNECTION_TIMEOUT_MS`| **SERVER_CONFIG**| Server Runtime | Yes (`5000`) | 5s pool connection timeout |
| **Firebase Configuration** | | | | |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | **PUBLIC** | Client / Web App | Yes | Firebase client Web SDK API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | **PUBLIC** | Client / Web App | Yes | Web auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | **PUBLIC** | Client / Web App | Yes (`pocketkirana`) | Project identifier |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| **PUBLIC**| Client / Web App | Yes | Storage bucket identifier |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`| **PUBLIC**| Client | Yes | FCM messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | **PUBLIC** | Client / Web App | Yes | Web client application ID |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | **PUBLIC** | Client Browser | Optional | Web push subscription key |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **SERVER_SECRET** | Server Runtime | Yes (Secret) | Firebase Admin SDK credentials |
| **PhonePe Payment Gateway** | | | | |
| `PHONEPE_ENV` | **SERVER_CONFIG** | Server Runtime | Yes (`production`) | Payment environment (`sandbox` or `production`) |
| `PHONEPE_MERCHANT_ID` | **SERVER_SECRET** | Server Runtime | Yes (Secret) | Production Merchant Identifier |
| `PHONEPE_SALT_KEY` | **SERVER_SECRET** | Server Runtime | Yes (Secret) | HMAC SHA-256 signing secret key |
| `PHONEPE_SALT_INDEX` | **SERVER_SECRET** | Server Runtime | Yes (`1`) | Salt key index |
| **MSG91 OTP Service** | | | | |
| `NEXT_PUBLIC_MSG91_WIDGET_ID` | **PUBLIC** | Client Browser | Yes | Client OTP widget ID |
| `NEXT_PUBLIC_MSG91_TOKEN_KEY` | **PUBLIC** | Client Browser | Yes | Client OTP token key |
| `MSG91_AUTHKEY` | **THIRD_PARTY_SECRET**| Server Runtime | Yes (Secret) | Server-side OTP verification auth key |
| **Cloudflare R2 Storage** | | | | |
| `R2_ACCOUNT_ID` | **THIRD_PARTY_SECRET**| Server Runtime | Yes (Secret) | Cloudflare account identifier |
| `R2_ACCESS_KEY_ID` | **THIRD_PARTY_SECRET**| Server Runtime | Yes (Secret) | S3-compatible Access Key ID |
| `R2_SECRET_ACCESS_KEY` | **THIRD_PARTY_SECRET**| Server Runtime | Yes (Secret) | S3-compatible Secret Access Key |
| `R2_BUCKET_NAME` | **SERVER_CONFIG** | Server Runtime | Yes (`pocketkirana-catalog-images`) | Target bucket name |
| `R2_PUBLIC_DOMAIN` | **PUBLIC** | Server Runtime | Yes (`https://images.pocketkirana.com`) | CDN edge delivery URL |

---

## 2. Leakage Prevention Verification Checklist

- [x] **Git Repository:** `.env`, `.env.local`, `.env.production` explicitly declared in `.gitignore`.
- [x] **Client JavaScript Bundles:** Zero server secrets compiled into `.next/static/` chunks.
- [x] **Android APK Codebases:** Zero server secrets in `customer-app`, `delivery-app`, or `picker-app`.
- [x] **API Output Sanitization:** Error mapper (`mapApiError`) strips internal strings before sending responses.
- [x] **Server Logs:** Database error logging (`categorizeDbError`) masks passwords and connection strings.
