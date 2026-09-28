import crypto from 'crypto';

/**
 * PocketKirana Cloudflare R2 Object Storage Service
 * Features:
 * - Server-side only S3-compatible Signature V4 client (Zero client credential exposure)
 * - Cryptographic Magic Byte inspection (prevents malicious file extension spoofing)
 * - Path traversal prevention & safe key normalization
 * - Cache-Control tagging for Cloudflare CDN edge acceleration
 * - Safe graceful fallback when R2 credentials are not yet configured in local development
 */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain: string; // e.g. https://images.pocketkirana.com or https://pub-xxx.r2.dev
}

export interface ImageValidationResult {
  valid: boolean;
  mimeType?: string;
  detectedFormat?: 'jpeg' | 'png' | 'webp' | 'gif';
  sizeBytes?: number;
  error?: string;
}

export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'pocketkirana-catalog-images';
  const publicDomain =
    process.env.R2_PUBLIC_DOMAIN ||
    process.env.NEXT_PUBLIC_IMAGE_DOMAIN ||
    'https://images.pocketkirana.com';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicDomain: publicDomain.replace(/\/+$/, ''),
  };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

/**
 * Validates file buffer by inspecting magic bytes rather than trusting file extensions alone.
 */
export function validateImageBuffer(
  buffer: Buffer,
  declaredMime?: string
): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty file buffer' };
  }

  if (buffer.length > MAX_IMAGE_FILE_SIZE) {
    return {
      valid: false,
      sizeBytes: buffer.length,
      error: `File size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB`,
    };
  }

  // 1. JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return {
      valid: true,
      mimeType: 'image/jpeg',
      detectedFormat: 'jpeg',
      sizeBytes: buffer.length,
    };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return {
      valid: true,
      mimeType: 'image/png',
      detectedFormat: 'png',
      sizeBytes: buffer.length,
    };
  }

  // 3. WEBP: RIFF ... WEBP (Bytes 0-3 = "RIFF", Bytes 8-11 = "WEBP")
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return {
      valid: true,
      mimeType: 'image/webp',
      detectedFormat: 'webp',
      sizeBytes: buffer.length,
    };
  }

  // 4. GIF: "GIF87a" or "GIF89a"
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 4) === 'GIF8') {
    return {
      valid: true,
      mimeType: 'image/gif',
      detectedFormat: 'gif',
      sizeBytes: buffer.length,
    };
  }

  // If declared as SVG (text-based XML/SVG)
  if (declaredMime === 'image/svg+xml') {
    const textStart = buffer.slice(0, 100).toString('utf-8').trim().toLowerCase();
    if (textStart.includes('<svg') || textStart.includes('<?xml')) {
      return {
        valid: true,
        mimeType: 'image/svg+xml',
        sizeBytes: buffer.length,
      };
    }
  }

  return {
    valid: false,
    error: 'Invalid file format. File signature does not match supported image types (JPEG, PNG, WEBP, GIF).',
  };
}

/**
 * Builds standard structured, versioned R2 object keys
 * Example: products/105/main-v1727448000.webp
 */
export function buildR2ObjectKey(options: {
  entityType: 'products' | 'categories' | 'brands' | 'banners';
  entityId: string;
  variant?: 'main' | 'thumb' | 'gallery' | 'icon' | 'logo' | 'banner';
  galleryIndex?: number;
  version?: number | string;
  ext?: string;
}): string {
  // Sanitize entity ID to prevent path traversal
  const cleanId = options.entityId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const variant = options.variant || 'main';
  const ver = options.version || Date.now();
  const ext = (options.ext || 'webp').replace(/^\./, '').toLowerCase();

  const variantSuffix =
    variant === 'gallery' && options.galleryIndex !== undefined
      ? `gallery-${options.galleryIndex}`
      : variant;

  return `${options.entityType}/${cleanId}/${variantSuffix}-v${ver}.${ext}`;
}

/**
 * Returns public CDN delivery URL for a given R2 object key
 */
export function getR2PublicUrl(key: string): string {
  const config = getR2Config();
  const base = config?.publicDomain || 'https://images.pocketkirana.com';
  const cleanKey = key.replace(/^\/+/, '');
  return `${base}/${cleanKey}`;
}

/**
 * Returns safe fallback image when image is missing or R2 is unavailable
 */
export function getR2FallbackUrl(entityType: string = 'product'): string {
  if (entityType === 'brand') return '/brands/amul.svg';
  if (entityType === 'category') return '/icon.svg';
  return '/pocketkirana-logo.svg';
}

/**
 * Native AWS SigV4 implementation for Cloudflare R2 S3 compatibility
 */
function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

/**
 * Uploads an image buffer to Cloudflare R2 with immutable edge-cache headers
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
  customMetadata: Record<string, string> = {}
): Promise<{ success: boolean; url: string; key: string; error?: string }> {
  const config = getR2Config();

  // If R2 is not configured, return safe dev URL with normalized data uri or placeholder
  if (!config) {
    console.warn(`[R2 Service] R2 not configured in environment. Using dev fallback for key: ${key}`);
    return {
      success: true,
      key,
      url: `data:${contentType};base64,${buffer.slice(0, 100).toString('base64')}`, // safe stub
    };
  }

  try {
    const cleanKey = key.replace(/^\/+/, '');
    const endpointHost = `${config.accountId}.r2.cloudflarestorage.com`;
    const host = `${config.bucketName}.${endpointHost}`;
    const url = `https://${host}/${encodeURI(cleanKey)}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';

    const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const headers: Record<string, string> = {
      host: host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'content-type': contentType,
      'content-length': String(buffer.length),
      'cache-control': 'public, max-age=31536000, immutable',
    };

    // Include custom metadata
    Object.entries(customMetadata).forEach(([k, v]) => {
      headers[`x-amz-meta-${k.toLowerCase()}`] = encodeURIComponent(v);
    });

    const canonicalHeaders =
      Object.keys(headers)
        .sort()
        .map((k) => `${k}:${headers[k]}\n`)
        .join('');

    const signedHeaders = Object.keys(headers).sort().join(';');

    const canonicalRequest = [
      'PUT',
      `/${encodeURI(cleanKey)}`,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    headers['Authorization'] = authorization;

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`R2 upload failed (${response.status}): ${errText}`);
    }

    return {
      success: true,
      key: cleanKey,
      url: getR2PublicUrl(cleanKey),
    };
  } catch (err: any) {
    console.error(`[R2 Upload Error] Key: ${key}:`, err.message);
    return {
      success: false,
      key,
      url: getR2FallbackUrl(),
      error: err.message,
    };
  }
}

/**
 * Deletes an image from Cloudflare R2
 */
export async function deleteFromR2(key: string): Promise<{ success: boolean; error?: string }> {
  const config = getR2Config();
  if (!config) {
    return { success: true };
  }

  try {
    const cleanKey = key.replace(/^\/+/, '');
    const endpointHost = `${config.accountId}.r2.cloudflarestorage.com`;
    const host = `${config.bucketName}.${endpointHost}`;
    const url = `https://${host}/${encodeURI(cleanKey)}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';

    const payloadHash = crypto.createHash('sha256').update('').digest('hex');

    const headers: Record<string, string> = {
      host: host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    };

    const canonicalHeaders =
      Object.keys(headers)
        .sort()
        .map((k) => `${k}:${headers[k]}\n`)
        .join('');

    const signedHeaders = Object.keys(headers).sort().join(';');

    const canonicalRequest = [
      'DELETE',
      `/${encodeURI(cleanKey)}`,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    headers['Authorization'] = authorization;

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`R2 deletion failed (${response.status})`);
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[R2 Delete Error] Key: ${key}:`, err.message);
    return { success: false, error: err.message };
  }
}
