import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import {
  validateImageBuffer,
  buildR2ObjectKey,
  uploadToR2,
  deleteFromR2,
  MAX_IMAGE_FILE_SIZE,
} from '@/lib/r2';

/**
 * PocketKirana Admin Cloudflare R2 Upload & Management API
 * 
 * POST /api/admin/uploads/r2
 * - Supports multipart/form-data or JSON (base64)
 * - Server-side only S3-compatible R2 upload
 * - Cryptographic Magic Byte inspection
 * - Path traversal prevention
 * - Requires 'admin' or 'store_manager' role
 * 
 * DELETE /api/admin/uploads/r2
 * - Safely unlinks / deletes R2 object keys
 * - Requires 'admin' or 'store_manager' role
 */

export async function POST(req: NextRequest) {
  // 1. Role Authorization
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin or Store Manager role required.' },
      { status: 403 }
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let buffer: Buffer;
    let declaredMime = '';
    let entityType: 'products' | 'categories' | 'brands' | 'banners' = 'products';
    let entityId = '';
    let variant: 'main' | 'thumb' | 'gallery' | 'icon' | 'logo' | 'banner' = 'main';
    let galleryIndex: number | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Missing file in form-data payload' },
          { status: 400 }
        );
      }

      const rawType = (formData.get('entityType') as string) || 'products';
      if (['products', 'categories', 'brands', 'banners'].includes(rawType)) {
        entityType = rawType as any;
      }
      entityId = (formData.get('entityId') as string) || '';
      const rawVariant = (formData.get('variant') as string) || 'main';
      if (['main', 'thumb', 'gallery', 'icon', 'logo', 'banner'].includes(rawVariant)) {
        variant = rawVariant as any;
      }
      const rawIdx = formData.get('galleryIndex');
      if (rawIdx !== null) {
        galleryIndex = parseInt(String(rawIdx), 10);
      }

      declaredMime = file.type;
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      if (!body.data) {
        return NextResponse.json(
          { success: false, error: 'Missing base64 "data" in JSON payload' },
          { status: 400 }
        );
      }

      entityType = body.entityType || 'products';
      entityId = body.entityId || '';
      variant = body.variant || 'main';
      galleryIndex = body.galleryIndex;

      // Extract base64 and mime if in data URI format: data:image/png;base64,...
      const dataUriMatch = String(body.data).match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        declaredMime = dataUriMatch[1];
        buffer = Buffer.from(dataUriMatch[2], 'base64');
      } else {
        declaredMime = body.mimeType || '';
        buffer = Buffer.from(String(body.data), 'base64');
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Unsupported Content-Type. Use multipart/form-data or application/json.' },
        { status: 415 }
      );
    }

    // 2. Validate Entity ID (Prevent empty or path traversal)
    if (!entityId || typeof entityId !== 'string' || entityId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid entityId is required (e.g. product ID)' },
        { status: 400 }
      );
    }
    if (entityId.includes('..') || entityId.includes('/') || entityId.includes('\\')) {
      return NextResponse.json(
        { success: false, error: 'Invalid entityId: Path traversal characters are forbidden.' },
        { status: 400 }
      );
    }

    // 3. Cryptographic Magic Byte Inspection & File Size Check
    const validation = validateImageBuffer(buffer, declaredMime);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid image file' },
        { status: 400 }
      );
    }

    const mime = validation.mimeType || 'image/webp';
    const ext = validation.detectedFormat || 'webp';

    // 4. Construct Versioned R2 Object Key
    const key = buildR2ObjectKey({
      entityType,
      entityId,
      variant,
      galleryIndex,
      ext,
    });

    // 5. Stream/Upload to R2
    const uploadResult = await uploadToR2(key, buffer, mime, {
      uploadedBy: auth.uid,
      entityType,
      entityId,
    });

    if (!uploadResult.success) {
      return NextResponse.json(
        { success: false, error: uploadResult.error || 'R2 upload failed' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      key: uploadResult.key,
      sizeBytes: buffer.length,
      mimeType: mime,
      format: ext,
    });
  } catch (error: any) {
    console.error('[Admin R2 Upload API Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal upload processing error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  // 1. Role Authorization
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin or Store Manager role required.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    let key = searchParams.get('key');

    if (!key && req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      key = body.key;
    }

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Parameter "key" is required for image deletion.' },
        { status: 400 }
      );
    }

    // Guard against path traversal or attempt to delete non-catalog objects
    const cleanKey = key.trim().replace(/^\/+/, '');
    if (cleanKey.includes('..') || cleanKey.startsWith('.env') || cleanKey.startsWith('private/')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Invalid key traversal path.' },
        { status: 400 }
      );
    }

    const deleteResult = await deleteFromR2(cleanKey);
    if (!deleteResult.success) {
      return NextResponse.json(
        { success: false, error: deleteResult.error || 'Failed to delete object from R2' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Object "${cleanKey}" unlinked/deleted from R2 storage.`,
      key: cleanKey,
    });
  } catch (error: any) {
    console.error('[Admin R2 Delete API Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal delete processing error' },
      { status: 500 }
    );
  }
}
