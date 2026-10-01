# POCKETKIRANA — IMAGE STORAGE ARCHITECTURE AUDIT

**Audit Date:** Phase 3 Architecture Review  
**Objective:** Comprehensive audit of all image assets, storage locations, database references, upload paths, and display mechanisms across Customer Website, Admin Portal, and Android APKs.

---

## 1. Asset Classification Matrix

### A. Product Images
| Dimension | Current Architecture | Cloudflare R2 Target Architecture |
| :--- | :--- | :--- |
| **Current Storage** | Unsplash external URLs (mock/demo), Firebase Storage (`pocketkirana.firebasestorage.app`), and PostgreSQL binary column `product_images.image_data` (BYTEA). | Cloudflare R2 Object Storage (`pocketkirana-catalog-images` bucket). |
| **Database Reference** | `products.thumbnail` (TEXT / URL), `products.thumbnail_url` (TEXT / URL), `products.images` (JSONB array of URLs/keys), `product_images` table (`file_name`, `image_data`). | `products.thumbnail` (R2 public URL or key), `products.images` (JSON array of R2 keys/URLs). |
| **Upload Path** | Base64 JSON payload via [`app/api/upload/evidence/route.ts`](file:///d:/pocketkirana/app/api/upload/evidence/route.ts) (temporary data URI); direct Firestore/Storage push in admin legacy. | Server-side authenticated multipart/stream upload via `/api/admin/uploads/r2` with MIME and magic byte verification. |
| **Delete Path** | No active automated delete endpoint; manual row update. | Soft delete / versioned object deprecation via `/api/admin/uploads/r2?key=...`. |
| **Display Path** | Next.js `<Image />` and HTML `<img src="..." />` via Next.js image optimizer; Capacitor Android Webview. | Cloudflare CDN edge delivery (`https://images.pocketkirana.com/products/...` or R2 public endpoint) with `public, max-age=31536000, immutable`. |

### B. Category Images
| Dimension | Current Architecture | Cloudflare R2 Target Architecture |
| :--- | :--- | :--- |
| **Current Storage** | Unsplash remote URLs in `lib/mockData.ts` and `categories.image_data` (BYTEA) in PostgreSQL. | Cloudflare R2 bucket: `categories/{categoryId}/icon.webp`. |
| **Database Reference** | `categories.image` (TEXT / URL), `categories.banner_image` (TEXT). | `categories.image` storing R2 URL or relative key `categories/{categoryId}/icon.webp`. |
| **Upload Path** | Handled in admin category editor. | Authenticated admin R2 upload. |
| **Delete Path** | Set NULL on category update. | Retain historical asset; update pointer in DB. |
| **Display Path** | Top navigation bar, category grid, drawer menus. | Cloudflare CDN edge cached. |

### C. Brand Images (Logos)
| Dimension | Current Architecture | Cloudflare R2 Target Architecture |
| :--- | :--- | :--- |
| **Current Storage** | Local static vector SVGs in `public/brands/*.svg` (`amul.svg`, `tata.svg`, `aashirvaad.svg`...) + `brands.logo_data` BYTEA in DB. | Hybrid: Local core SVGs in `public/brands/` for zero-latency shell, dynamic merchant/FMCG brand logos in R2 `brands/{brandId}/logo.webp`. |
| **Database Reference** | `brands.logo` (URL/path), `brands.logo_url` (TEXT). | `brands.logo_url` storing CDN URL. |
| **Upload Path** | Admin brand creation. | Authenticated admin R2 upload. |
| **Delete Path** | Admin brand deletion. | Pointer update; R2 garbage collection. |
| **Display Path** | Brand showcase carousel, brand filter chips, brand store page (`/brand/[slug]`). | Cloudflare CDN edge cached. |

### D. Promotional Banners
| Dimension | Current Architecture | Cloudflare R2 Target Architecture |
| :--- | :--- | :--- |
| **Current Storage** | Unsplash remote URLs in `lib/mockData.ts` and Firestore `banners` collection. | Cloudflare R2 bucket: `banners/{bannerId}/banner_{timestamp}.webp`. |
| **Database Reference** | `homepage_sections` JSON content or Firestore `banners` docs. | `imageUrl` pointing to Cloudflare CDN. |
| **Upload Path** | Admin Festival Campaign & Homepage CMS banner upload. | Authenticated admin R2 upload. |
| **Delete Path** | Campaign archival. | Automatic expiration or archival in R2. |
| **Display Path** | Hero carousel on customer homepage, category header banners. | Edge cached with 24h TTL. |

### E. Other Static Assets
| Dimension | Current Architecture | Cloudflare R2 Target Architecture |
| :--- | :--- | :--- |
| **Current Storage** | Local repository filesystem in `public/`: `pocketkirana-logo.svg`, `logo-icon.png`, `manifest.webmanifest`, PWA icons. | Keep in `public/` directory (static build artifacts bundled with Next.js & Capacitor). |
| **Database Reference** | None (hardcoded in PWA manifest & navigation layout). | Unchanged (static shell assets). |
| **Upload Path** | Git commit / build time. | Build time. |
| **Delete Path** | Git version control. | Git version control. |
| **Display Path** | Native browser shell, favicon, PWA splash screen. | Served directly by web server / edge cache. |

---

## 2. Critical Findings & Architectural Principles
1. **Never Store Binaries in PostgreSQL:**
   Storing images as `BYTEA` inside PostgreSQL tables (`product_images.image_data`, `categories.image_data`) causes rapid database bloat, exhausts I/O buffers, and slows down transaction queries. The database must **only** store the URL or R2 object key.
2. **Never Proxy Public Images Through Node.js:**
   Serving public images via API routes (e.g. `/api/images/[id]`) consumes Node.js event-loop threads and application memory. Images must be served directly from Cloudflare R2 via Cloudflare's global CDN edge.
3. **Never Expose R2 Secret Credentials Client-Side:**
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and S3 API credentials must reside strictly on the server-side runtime (`.env.local` / deployment environment). The client only receives public CDN URLs (`https://images.pocketkirana.com/...`).
