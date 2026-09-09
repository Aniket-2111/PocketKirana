/**
 * /api/products/[id]/identifiers
 *
 * GET:  List all external/internal identifiers attached to a product
 * POST: Attach a new identifier (EAN-13, UPC, INTERNAL, etc.) to a product/variant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';
import { randomUUID } from 'crypto';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const pool = getPostgresPool();

    const res = await pool.query(
      `SELECT pi.*, pv.variant_name, pv.sku
       FROM product_identifiers pi
       LEFT JOIN product_variants pv ON pv.id = pi.variant_id
       WHERE pi.product_id = $1
       ORDER BY pi.is_primary DESC, pi.created_at ASC`,
      [productId]
    );

    return NextResponse.json({
      success: true,
      data: res.rows,
    });
  } catch (error: any) {
    console.error('[GET /api/products/[id]/identifiers]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['admin', 'store_manager']);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: productId } = await params;
    const body = await req.json();
    const {
      variant_id,
      identifier_type = 'EAN13',
      identifier_value,
      is_primary = false,
    } = body;

    if (!identifier_value || typeof identifier_value !== 'string') {
      return NextResponse.json({ error: 'identifier_value is required' }, { status: 400 });
    }

    const cleanValue = identifier_value.trim();
    const pool = getPostgresPool();

    // Verify product exists
    const productCheck = await pool.query(`SELECT id FROM products WHERE id = $1`, [productId]);
    if (productCheck.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // If marking primary, unmark existing primary for this product/variant
      if (is_primary) {
        if (variant_id) {
          await client.query(
            `UPDATE product_identifiers SET is_primary = FALSE WHERE product_id = $1 AND variant_id = $2`,
            [productId, variant_id]
          );
        } else {
          await client.query(
            `UPDATE product_identifiers SET is_primary = FALSE WHERE product_id = $1`,
            [productId]
          );
        }
      }

      const id = randomUUID();
      const insertRes = await client.query(
        `INSERT INTO product_identifiers
           (id, product_id, variant_id, identifier_type, identifier_value, is_primary, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (identifier_type, identifier_value) DO NOTHING
         RETURNING *`,
        [id, productId, variant_id || null, identifier_type, cleanValue, is_primary, auth.uid]
      );

      if (insertRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `Identifier '${cleanValue}' of type '${identifier_type}' is already in use.` },
          { status: 409 }
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: insertRes.rows[0],
      }, { status: 201 });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[POST /api/products/[id]/identifiers]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
