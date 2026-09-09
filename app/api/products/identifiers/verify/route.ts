/**
 * POST /api/products/identifiers/verify
 *
 * Barcode verification & pre-validation endpoint for Admin product creation.
 * Checks:
 *   1. Barcode structure / checksum if EAN-13
 *   2. Uniqueness in product_identifiers database
 *   3. If already registered, returns matched product & variant details
 *   4. If available, returns next available PK system ID recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';

function isValidEan13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;
  const digits = barcode.split('').map(Number);
  const checksum = digits.slice(0, 12).reduce((acc, digit, idx) => {
    return acc + (idx % 2 === 0 ? digit : digit * 3);
  }, 0);
  const calculatedCheckDigit = (10 - (checksum % 10)) % 10;
  return calculatedCheckDigit === digits[12];
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['admin', 'store_manager']);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or insufficient privileges' }, { status: 401 });
    }

    const body = await req.json();
    const { identifier_value, identifier_type = 'EAN13' } = body;

    if (!identifier_value || typeof identifier_value !== 'string') {
      return NextResponse.json({ error: 'identifier_value string is required' }, { status: 400 });
    }

    const cleanValue = identifier_value.trim();
    const isEan = identifier_type.toUpperCase() === 'EAN13';
    const isValidChecksum = isEan ? isValidEan13(cleanValue) : true;

    const pool = getPostgresPool();

    // Check if duplicate exists
    const duplicateRes = await pool.query(
      `SELECT pi.*, p.name AS product_name, p.slug AS product_slug, pv.variant_name, pv.sku
       FROM product_identifiers pi
       JOIN products p ON p.id = pi.product_id
       LEFT JOIN product_variants pv ON pv.id = pi.variant_id
       WHERE pi.identifier_value = $1`,
      [cleanValue]
    );

    if (duplicateRes.rowCount && duplicateRes.rowCount > 0) {
      const match = duplicateRes.rows[0];
      return NextResponse.json({
        success: false,
        isAvailable: false,
        isValidChecksum,
        message: 'Barcode is already assigned to an existing product',
        existingProduct: {
          productId: match.product_id,
          productName: match.product_name,
          variantId: match.variant_id,
          variantName: match.variant_name,
          sku: match.sku,
          identifierType: match.identifier_type,
          identifierValue: match.identifier_value,
        },
      }, { status: 409 });
    }

    // Get current preview sequence for PK Product ID
    const seqRes = await pool.query(`SELECT last_value + 1 AS next_val FROM pk_product_seq`);
    const nextSeq = seqRes.rows[0]?.next_val ? String(seqRes.rows[0].next_val).padStart(7, '0') : '0000001';
    const recommendedPkId = `PK-${nextSeq}`;

    return NextResponse.json({
      success: true,
      isAvailable: true,
      isValidChecksum,
      identifierType: identifier_type,
      identifierValue: cleanValue,
      recommendedPkId,
      message: 'Barcode is valid and available for registration',
    });
  } catch (error: any) {
    console.error('[POST /api/products/identifiers/verify]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
