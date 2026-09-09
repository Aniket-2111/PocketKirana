/**
 * GET /api/products/barcode/[value]
 *
 * Universal Barcode & Identifier Lookup endpoint.
 * Accepts EAN-13, UPC, or Internal PK Product ID.
 * Returns product, variant, pricing, and live inventory balance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ value: string }> }
) {
  try {
    const { value } = await params;
    const barcode = decodeURIComponent(value).trim();

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode value is required' }, { status: 400 });
    }

    const pool = getPostgresPool();

    // 1. Search via product_identifiers
    const query = `
      SELECT 
        pi.identifier_type,
        pi.identifier_value,
        pi.is_primary,
        p.id AS product_id,
        p.name AS product_name,
        p.slug AS product_slug,
        p.description AS product_description,
        p.lifecycle_status,
        p.pk_sequence_id,
        pv.id AS variant_id,
        pv.variant_name,
        pv.sku,
        pv.pk_display_code,
        pv.mrp,
        pv.selling_price,
        pv.cost_price,
        pv.weight_value,
        pv.weight_unit,
        b.name AS brand_name,
        c.name AS category_name
      FROM product_identifiers pi
      JOIN products p ON p.id = pi.product_id
      LEFT JOIN product_variants pv ON pv.id = pi.variant_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE pi.identifier_value = $1
      LIMIT 1
    `;

    let res = await pool.query(query, [barcode]);

    // Fallback: search product_variants.barcode or products.product_code directly if not yet migrated
    if (res.rowCount === 0) {
      const fallbackQuery = `
        SELECT 
          'FALLBACK' AS identifier_type,
          COALESCE(pv.barcode, p.product_code) AS identifier_value,
          TRUE AS is_primary,
          p.id AS product_id,
          p.name AS product_name,
          p.slug AS product_slug,
          p.description AS product_description,
          p.lifecycle_status,
          p.pk_sequence_id,
          pv.id AS variant_id,
          pv.variant_name,
          pv.sku,
          pv.pk_display_code,
          pv.mrp,
          pv.selling_price,
          pv.cost_price,
          pv.weight_value,
          pv.weight_unit,
          b.name AS brand_name,
          c.name AS category_name
        FROM products p
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        LEFT JOIN brands b ON b.id = p.brand_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE pv.barcode = $1 OR p.product_code = $1 OR pv.sku = $1 OR pv.pk_display_code = $1
        LIMIT 1
      `;
      res = await pool.query(fallbackQuery, [barcode]);
    }

    if (res.rowCount === 0) {
      return NextResponse.json({
        success: false,
        found: false,
        message: `No product found matching barcode or identifier: ${barcode}`,
      }, { status: 404 });
    }

    const item = res.rows[0];

    // 2. Fetch stock balances across warehouses if variant exists
    let stockSummary = { available: 0, reserved: 0, damaged: 0 };
    if (item.variant_id) {
      const stockRes = await pool.query(
        `SELECT 
           COALESCE(SUM(available_qty), 0) AS total_available,
           COALESCE(SUM(reserved_qty), 0) AS total_reserved,
           COALESCE(SUM(damaged_qty), 0) AS total_damaged
         FROM inventory_balances
         WHERE variant_id = $1`,
        [item.variant_id]
      );
      if (stockRes.rowCount && stockRes.rowCount > 0) {
        stockSummary = {
          available: parseInt(stockRes.rows[0].total_available, 10),
          reserved: parseInt(stockRes.rows[0].total_reserved, 10),
          damaged: parseInt(stockRes.rows[0].total_damaged, 10),
        };
      }
    }

    return NextResponse.json({
      success: true,
      found: true,
      data: {
        ...item,
        stock: stockSummary,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/products/barcode/[value]]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
