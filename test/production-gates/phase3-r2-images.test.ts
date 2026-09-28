import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  validateImageBuffer,
  buildR2ObjectKey,
  getR2PublicUrl,
  getR2FallbackUrl,
  MAX_IMAGE_FILE_SIZE,
} from '../../lib/r2';
import { POST as r2UploadPost, DELETE as r2UploadDelete } from '../../app/api/admin/uploads/r2/route';

describe('Phase 3 — Cloudflare R2 Product Image Storage & Edge Cache Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Magic Byte Inspection & Cryptographic File Validation', () => {
    it('accepts valid JPEG buffer (FF D8 FF signature)', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const result = validateImageBuffer(jpegBuffer, 'image/jpeg');
      expect(result.valid).toBe(true);
      expect(result.detectedFormat).toBe('jpeg');
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('accepts valid PNG buffer (89 50 4E 47 signature)', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const result = validateImageBuffer(pngBuffer, 'image/png');
      expect(result.valid).toBe(true);
      expect(result.detectedFormat).toBe('png');
      expect(result.mimeType).toBe('image/png');
    });

    it('accepts valid WebP buffer (RIFF...WEBP signature)', () => {
      // 0-3: 'RIFF', 4-7: length, 8-11: 'WEBP'
      const webpBuffer = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.from([0x00, 0x00, 0x00, 0x20]),
        Buffer.from('WEBP', 'ascii'),
        Buffer.from('VP8 ', 'ascii'),
      ]);
      const result = validateImageBuffer(webpBuffer, 'image/webp');
      expect(result.valid).toBe(true);
      expect(result.detectedFormat).toBe('webp');
      expect(result.mimeType).toBe('image/webp');
    });

    it('rejects spoofed executable / malicious file claiming to be an image', () => {
      const maliciousScript = Buffer.from('#!/bin/bash\nrm -rf /;\necho "malicious"', 'utf-8');
      const result = validateImageBuffer(maliciousScript, 'image/png');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file format');
    });

    it('rejects oversized file exceeding 5MB limit', () => {
      const largeBuffer = Buffer.alloc(MAX_IMAGE_FILE_SIZE + 1024);
      // Give it JPEG magic bytes
      largeBuffer[0] = 0xff;
      largeBuffer[1] = 0xd8;
      largeBuffer[2] = 0xff;

      const result = validateImageBuffer(largeBuffer);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed limit of 5 MB');
    });

    it('rejects empty or zero-byte buffers', () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = validateImageBuffer(emptyBuffer);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Empty file buffer');
    });
  });

  describe('2. R2 Object Key Generation & Path Traversal Prevention', () => {
    it('creates versioned, structured product main image key', () => {
      const key = buildR2ObjectKey({
        entityType: 'products',
        entityId: 'prod_105',
        variant: 'main',
        version: 1727448000,
        ext: 'webp',
      });
      expect(key).toBe('products/prod_105/main-v1727448000.webp');
    });

    it('creates versioned gallery item key with index', () => {
      const key = buildR2ObjectKey({
        entityType: 'products',
        entityId: 'prod_105',
        variant: 'gallery',
        galleryIndex: 2,
        version: 1727448000,
        ext: 'webp',
      });
      expect(key).toBe('products/prod_105/gallery-2-v1727448000.webp');
    });

    it('neutralizes path traversal attempts in entity ID', () => {
      const key = buildR2ObjectKey({
        entityType: 'products',
        entityId: '../../etc/passwd',
        variant: 'main',
        version: 12345,
      });
      expect(key).not.toContain('..');
      expect(key).not.toContain('/etc');
      expect(key).toBe('products/______etc_passwd/main-v12345.webp');
    });

    it('resolves correct public CDN URL and fallback paths', () => {
      const url = getR2PublicUrl('products/105/main-v1.webp');
      expect(url).toMatch(/^https:\/\/[^/]+\/products\/105\/main-v1\.webp$/);

      expect(getR2FallbackUrl('product')).toBe('/pocketkirana-logo.svg');
      expect(getR2FallbackUrl('brand')).toBe('/brands/amul.svg');
      expect(getR2FallbackUrl('category')).toBe('/icon.svg');
    });
  });

  describe('3. Admin R2 Upload API Authorization & Security', () => {
    const validPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    it('rejects unauthenticated upload requests with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: validPng.toString('base64'), entityId: 'prod_101' }),
      });

      const res = await r2UploadPost(req);
      expect(res.status).toBe(403);
    });

    it('rejects unauthorized customer role from uploading images with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pk-uid': 'cust_123',
          'x-pk-role': 'customer',
        },
        body: JSON.stringify({ data: validPng.toString('base64'), entityId: 'prod_101' }),
      });

      const res = await r2UploadPost(req);
      expect(res.status).toBe(403);
    });

    it('rejects unauthorized delivery partner role with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pk-uid': 'del_123',
          'x-pk-role': 'delivery',
        },
        body: JSON.stringify({ data: validPng.toString('base64'), entityId: 'prod_101' }),
      });

      const res = await r2UploadPost(req);
      expect(res.status).toBe(403);
    });

    it('rejects unauthorized picker role with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pk-uid': 'picker_123',
          'x-pk-role': 'picker',
        },
        body: JSON.stringify({ data: validPng.toString('base64'), entityId: 'prod_101' }),
      });

      const res = await r2UploadPost(req);
      expect(res.status).toBe(403);
    });

    it('allows admin role to upload valid image and returns sanitized R2 key', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pk-uid': 'admin_master',
          'x-pk-role': 'admin',
        },
        body: JSON.stringify({
          data: validPng.toString('base64'),
          entityType: 'products',
          entityId: 'prod_105',
          variant: 'main',
        }),
      });

      const res = await r2UploadPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.key).toMatch(/^products\/prod_105\/main-v\d+\.png$/);
      expect(json.mimeType).toBe('image/png');
    });

    it('rejects admin upload with path traversal in entityId with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pk-uid': 'admin_master',
          'x-pk-role': 'admin',
        },
        body: JSON.stringify({
          data: validPng.toString('base64'),
          entityType: 'products',
          entityId: '../traversal_attempt',
        }),
      });

      const res = await r2UploadPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Path traversal characters are forbidden');
    });

    it('rejects admin upload with fake/malicious file payload with 400', async () => {
      const fakeBinary = Buffer.from('NOT_AN_IMAGE_BINARY', 'utf-8');
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pk-uid': 'admin_master',
          'x-pk-role': 'admin',
        },
        body: JSON.stringify({
          data: fakeBinary.toString('base64'),
          entityType: 'products',
          entityId: 'prod_105',
        }),
      });

      const res = await r2UploadPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid file format');
    });
  });

  describe('4. Admin R2 Delete & Unlink Security', () => {
    it('rejects unauthorized delete request from non-admin role with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2?key=products/105/main.webp', {
        method: 'DELETE',
        headers: {
          'x-pk-uid': 'customer_456',
          'x-pk-role': 'customer',
        },
      });

      const res = await r2UploadDelete(req);
      expect(res.status).toBe(403);
    });

    it('rejects path traversal in delete key with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2?key=../../private_data', {
        method: 'DELETE',
        headers: {
          'x-pk-uid': 'admin_master',
          'x-pk-role': 'admin',
        },
      });

      const res = await r2UploadDelete(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid key traversal path');
    });

    it('allows admin role to safely unlink/delete R2 key', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/uploads/r2?key=products/105/main-v1.webp', {
        method: 'DELETE',
        headers: {
          'x-pk-uid': 'admin_master',
          'x-pk-role': 'admin',
        },
      });

      const res = await r2UploadDelete(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain('unlinked/deleted from R2 storage');
    });
  });
});
