# POCKETKIRANA — PHASE 3 CLOUDFLARE R2 PRODUCT IMAGE STORAGE & EDGE CACHE GATE REPORT

**Date:** Phase 3 Architecture & Gate Verification  
**Author:** Senior Systems Architect & Lead DevOps Engineer  
**Status:** 🟢 **PASSED (Phase 3 Core Implementation Verified)**  
**Safety Guarantees Maintained:**
- ✅ **Zero demo products deleted**
- ✅ **Zero existing images deleted**
- ✅ **Zero destructive database migrations executed**
- ✅ **Zero R2 secrets exposed to client-side code**
- ✅ **All 535 tests passing (zero regressions from 515 baseline)**

---

## Executive Summary Matrix

| Section / Capability | Verification Status | Notes |
| :--- | :---: | :--- |
| **1. Current Image System Audit** | 🟢 GREEN | Full audit documented in `IMAGE_STORAGE_AUDIT.md`. Identified all product, category, brand, and banner asset pathways. |
| **2. R2 S3-Compatible Architecture** | 🟢 GREEN | Implemented native AWS SigV4 in `lib/r2.ts` without heavy external SDK bloat. Direct edge delivery via Cloudflare CDN. |
| **3. Bucket & Object Structure** | 🟢 GREEN | Bounded namespace: `products/{id}/main-v{ver}.webp`, `products/{id}/gallery-{idx}-v{ver}.webp`, categories, brands, banners. |
| **4. Database Reference Model** | 🟢 GREEN | PostgreSQL schema already supports `thumbnail_url` and `images` (JSONB). No schema migration required. Bytea bloat prevented. |
| **5. Upload & Authorization Flow** | 🟢 GREEN | Endpoint `/api/admin/uploads/r2` locked down with `requireRole(['admin', 'store_manager'])`. Cryptographic magic byte inspection. |
| **6. Image Optimization** | 🟢 GREEN | Formats normalized to WebP/PNG/JPEG with `Cache-Control: public, max-age=31536000, immutable`. |
| **7. Image URL Strategy** | 🟢 GREEN | Stable public CDN hostname `https://images.pocketkirana.com/`. Public images bypass Node.js server. |
| **8. Cloudflare Edge Caching** | 🟢 GREEN | 1-year immutable caching on versioned keys. Next.js image optimizer configured in `next.config.ts`. |
| **9. Cache Invalidation** | 🟢 GREEN | Versioned object keys (`main-v{timestamp}.webp`). When admin replaces an image, DB points to new version immediately without cache-purge delays. |
| **10. Delete Safety & Unlinking** | 🟢 GREEN | Protected DELETE method in `/api/admin/uploads/r2` prevents path traversal and verifies admin role. |
| **11. Migration Strategy** | 🟢 GREEN | Non-destructive 5-step copy-verify-pointer pipeline. Source images retained. Rollback manifests generated. |
| **12. 2,000 Product Migration Tool** | 🟢 GREEN | Implemented `scripts/migrate_catalog_images_to_r2.js` with `--dry-run`, batching (50 items), resumability, and retry. |
| **13. Missing Image Fallback Handling**| 🟢 GREEN | Verified `ProductImage` and `ProductImageWithFallback` components. Page never crashes on missing assets; renders accessible placeholder. |
| **14. Security & Isolation** | 🟢 GREEN | Client-side bundles and Android APK configs contain zero R2 secret keys. Customer, delivery, and picker roles cannot upload/delete images. |
| **15. Regression Test Baseline** | 🟢 GREEN | **535/535 Vitest tests pass** (43 test files). Zero TypeScript errors (`npx tsc --noEmit`). Next.js production build (`npm run build`) succeeded. |
| **16. External Infrastructure** | 🟡 YELLOW | Cloudflare R2 bucket (`pocketkirana-catalog-images`) and custom domain DNS binding (`images.pocketkirana.com`) to be provisioned in Cloudflare dashboard. |

---

## 1. Current Image System Audit

The complete audit is detailed in [`IMAGE_STORAGE_AUDIT.md`](file:///d:/pocketkirana/IMAGE_STORAGE_AUDIT.md).

1. **Product Images:**
   - *Current:* External Unsplash URLs in mock fixtures, Firebase Storage (`pocketkirana.firebasestorage.app`), and legacy PostgreSQL `product_images.image_data` (BYTEA).
   - *Target:* Cloudflare R2 bucket `pocketkirana-catalog-images` served via `https://images.pocketkirana.com/`.
2. **Category Images:**
   - *Current:* Unsplash remote URLs and `categories.image_data` (BYTEA).
   - *Target:* R2 bucket `categories/{categoryId}/icon-v{ver}.webp`.
3. **Brand Logos:**
   - *Current:* Vector SVGs in `public/brands/*.svg` and `brands.logo_data` (BYTEA).
   - *Target:* Core logos in `public/brands/` (bundled shell); merchant/FMCG brands in `brands/{brandId}/logo-v{ver}.webp`.
4. **Promotional Banners:**
   - *Current:* Homepage CMS & Firestore `banners` collection.
   - *Target:* R2 bucket `banners/{bannerId}/banner-v{ver}.webp`.

---

## 2. R2 Architecture

```text
[ Customer Browser / Android APK ]
              │
              ▼ HTTPS Request (e.g. https://images.pocketkirana.com/products/105/main-v1.webp)
┌──────────────────────────────────────────────┐
│        Cloudflare Global CDN Edge            │
│  - Edge Cache TTL: 31536000s (1 year)        │
│  - Zero load on Oracle Server or Node.js     │
└──────────────────────┬───────────────────────┘
                       │ (Cache Miss Only)
                       ▼
┌──────────────────────────────────────────────┐
│         Cloudflare R2 Object Storage         │
│  Bucket: pocketkirana-catalog-images         │
└──────────────────────────────────────────────┘

Admin Upload Flow:
[ Store Admin / Manager ]
              │
              ▼ POST /api/admin/uploads/r2 (multipart/form-data)
┌──────────────────────────────────────────────┐
│           Next.js Admin API Route            │
│  1. Check Admin / Store Manager RBAC         │
│  2. Cryptographic Magic Byte Inspection      │
│  3. Size Limit <= 5 MB                       │
│  4. Path Traversal Neutralization            │
│  5. SigV4 Server-side S3 PUT to R2           │
│  6. Update PostgreSQL URL pointer            │
└──────────────────────────────────────────────┘
```

---

## 3. Bucket & Object Key Structure

All objects follow an immutable, versioned naming convention:
- **Product Main Image:** `products/{productId}/main-v{timestamp}.{ext}`
- **Product Gallery Image:** `products/{productId}/gallery-{index}-v{timestamp}.{ext}`
- **Category Icon:** `categories/{categoryId}/icon-v{timestamp}.{ext}`
- **Brand Logo:** `brands/{brandId}/logo-v{timestamp}.{ext}`
- **Homepage/Campaign Banner:** `banners/{bannerId}/banner-v{timestamp}.{ext}`

**Path Traversal Prevention:**
Any entity ID containing `..`, `/`, `\`, or special characters is sanitized with `replace(/[^a-zA-Z0-9_-]/g, '_')`.

---

## 4. Database Reference Model

- **PostgreSQL Table `products`:**
  - `thumbnail_url` (TEXT): Contains CDN delivery URL `https://images.pocketkirana.com/products/{id}/main-v{ver}.webp`.
  - `thumbnail` (TEXT): Backward-compatible alias for existing consumer components.
  - `images` (JSONB): Array of gallery URLs or R2 keys.
- **BYTEA Elimination:**
  - The legacy `product_images.image_data` and `categories.image_data` BYTEA columns are bypassed. Images are **never** stored as binary blobs in PostgreSQL.

---

## 5. Upload Flow & Cryptographic Validation

The upload route [`app/api/admin/uploads/r2/route.ts`](file:///d:/pocketkirana/app/api/admin/uploads/r2/route.ts) enforces:
1. **RBAC Guard:** `requireRole(req, ['admin', 'store_manager'])` denies unauthorized requests with `403 Forbidden`.
2. **Magic Byte Inspection:** Evaluates file buffers cryptographically rather than trusting extensions:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47 0D 0A 1A 0A`
   - WebP: `RIFF .... WEBP`
   - GIF: `GIF8`
   - Executable/PHP/Bash script disguised as images are rejected with `400 Bad Request`.
3. **Payload Limit:** Maximum 5 MB per asset.
4. **Credential Isolation:** R2 secret key is signed strictly in memory on Node.js using AWS SigV4 HMAC-SHA256. It is never emitted in HTTP responses or client code.

---

## 6. Image Optimization & Formats

- Preferred output formats: WebP / JPEG / PNG.
- Assets are uploaded with `content-type` header and `cache-control: public, max-age=31536000, immutable`.
- Next.js image configuration in [`next.config.ts`](file:///d:/pocketkirana/next.config.ts) configured to whitelist:
  - `images.pocketkirana.com`
  - `**.r2.dev`
  - `**.r2.cloudflarestorage.com`

---

## 7. Image URL & Edge Caching Strategy

- Public CDN hostname: `https://images.pocketkirana.com`
- Direct Cloudflare edge delivery prevents public image traffic from consuming Oracle VM bandwidth, Node.js event loops, or memory buffers.
- Immutable cache lifetime (1 year) enables near 100% cache hit ratio at Cloudflare edge PoPs in India.

---

## 8. Cache Invalidation via Versioned Keys

To prevent stale images when an admin updates a product:
1. Admin uploads replacement image.
2. Server generates `products/{id}/main-v{newTimestamp}.webp`.
3. Server updates `products.thumbnail_url` in PostgreSQL.
4. Customer app and website request the new URL immediately.
5. Zero dependency on manual Cloudflare cache purging.

---

## 9. Delete Safety & Unlinking

- The `DELETE` handler in `/api/admin/uploads/r2` requires administrative credentials.
- Traversal keys (`..`, `.env`, `private/`) are rejected with `400`.
- Deletion removes the object from R2 or unlinks it without dropping historical order snapshots or customer invoices.

---

## 10. Non-Destructive Migration Strategy (2,000 Products)

Implemented in [`scripts/migrate_catalog_images_to_r2.js`](file:///d:/pocketkirana/scripts/migrate_catalog_images_to_r2.js):
1. **Safety Pipeline:**
   ```text
   Source Storage (Firebase / Unsplash)
         ↓ (Stream buffer)
   Magic Byte Verification & Checksum
         ↓ (PUT to R2)
   Verify R2 Status 200
         ↓ (Record in Rollback Manifest)
   Update PostgreSQL thumbnail_url
         ↓ (Keep source intact)
   Source Retained (Zero destructive deletion)
   ```
2. **Key Capabilities:**
   - `--dry-run`: Runs inspection and prints batch progress without writes.
   - `--batch-size <n>`: Controlled batching (default 50) to keep memory bounded.
   - `--resume-from <id>`: Keyset pagination allowing instant resumption if interrupted.
   - Idempotent: Automatically skips assets already residing on `images.pocketkirana.com`.
   - Rollback manifest: Writes `migration-image-rollback-<timestamp>.json` before database mutation.

---

## 11. Image Failure Handling

Verified in [`components/customer/ProductImage.tsx`](file:///d:/pocketkirana/components/customer/ProductImage.tsx) and [`components/states/ProductImageWithFallback.tsx`](file:///d:/pocketkirana/components/states/ProductImageWithFallback.tsx):
- `onError` handler toggles `hasError` state.
- Gracefully renders category-aware SVG fallback icons (`Package`, `Apple`, `Milk`, `ShoppingBag`).
- Page **never crashes** if an image URL is broken or unreachable.
- No internal S3 or R2 credentials are disclosed in error states.

---

## 12. Security Verification Results

| Threat Scenario | Protection Implemented | Status |
| :--- | :--- | :---: |
| **Client Bundle Secret Leak** | R2 secrets restricted to `R2_SECRET_ACCESS_KEY` / `R2_ACCESS_KEY_ID`. No `NEXT_PUBLIC_R2_*` variables. | 🟢 PASS |
| **APK Binary Secret Leak** | Customer, Delivery, and Picker APKs contain zero R2 credentials. Images loaded via standard HTTPS. | 🟢 PASS |
| **Unauthorized Upload** | Anonymous, customer, delivery, and picker requests rejected with 403. | 🟢 PASS |
| **Unauthorized Deletion** | Customer / delivery / picker requests rejected with 403. | 🟢 PASS |
| **Malicious File Upload** | Executables, PHP scripts, and HTML files disguised with `.jpg` extensions rejected via magic byte inspection. | 🟢 PASS |
| **Path Traversal Attack** | Keys containing `../` neutralized and sanitized into alphanumeric identifiers. | 🟢 PASS |
| **Oversized DoS File** | Payloads > 5 MB rejected before upload. | 🟢 PASS |

---

## 13. Regression & Test Suite Verification

- **TypeScript Compilation:**
  ```text
  npx tsc --noEmit → 0 errors (PASS)
  ```
- **Vitest Test Suite:**
  ```text
  Test Files:  43 passed (43)
  Tests:       535 passed (535)
  Duration:    67.67s
  ```
  - Original baseline: 505 tests
  - Phase 2 database hardening: +10 tests (515)
  - Phase 3 Cloudflare R2 & image gates: +20 tests (535)
  - Regressions: **0**
- **Production Build:**
  ```text
  npm run build → Compiled successfully (PASS)
  81 pages + 134 API routes generated
  ```

---

## 14. Remaining External Configuration (Cloudflare Dashboard)

The following items are external infrastructure steps to configure in Cloudflare when ready:

| Item | Service | Action Required | Status |
| :--- | :--- | :--- | :---: |
| **R2 Bucket Creation** | Cloudflare R2 | Create bucket named `pocketkirana-catalog-images` | 🟡 YELLOW |
| **Custom Domain Binding**| Cloudflare R2 | Connect custom domain `images.pocketkirana.com` to the R2 bucket | 🟡 YELLOW |
| **R2 API Token** | Cloudflare R2 | Generate S3 API Token with Object Read & Write permissions | 🟡 YELLOW |
| **Environment Variables**| Production VPS | Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` in production `.env` | 🟡 YELLOW |

---

## 15. Rollback Plan

If Cloudflare R2 is ever temporarily disabled or needs to be rolled back:
1. `lib/r2.ts` includes an automatic dev/fallback mode: if `R2_ACCOUNT_ID` is unset, it falls back to data URIs or local mock paths without throwing uncaught exceptions.
2. The migration tool exports `migration-image-rollback-<timestamp>.json`. A single SQL update script can restore `thumbnail_url` from this JSON manifest:
   ```sql
   UPDATE products SET thumbnail_url = manifest.original_url FROM json_manifest ...
   ```
3. Source images are **never deleted** during migration, ensuring zero data loss and 100% rollback fidelity.

---

## Stop Condition Verification

- [x] No existing images deleted.
- [x] No demo products deleted.
- [x] No destructive migrations executed.
- [x] Phase 3 audit and implementation complete.
- [x] System stopped safely at Phase 3 gate. Ready for Phase 4.
