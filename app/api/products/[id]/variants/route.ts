import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/products/[id]/variants
 * Returns all variants for a specific product from PostgreSQL.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id: productId } = await context.params;
    const pool = getPostgresPool();

    const query = `
      SELECT 
        id,
        product_id as "productId",
        variant_name as "variantName",
        quantity_value as "quantityValue",
        quantity_unit as "quantityUnit",
        quantity_unit as unit,
        selling_price as "sellingPrice",
        selling_price as price,
        mrp,
        cost_price as "costPrice",
        discount_percentage as "discountPercentage",
        tax_percentage as "taxPercentage",
        stock_quantity as "stockQuantity",
        stock_quantity as stock,
        low_stock_threshold as "lowStockThreshold",
        sku,
        barcode,
        is_active as "isActive",
        is_default as "isDefault",
        display_order as "displayOrder",
        pk_display_code as "pkDisplayCode",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM product_variants
      WHERE product_id = $1
      ORDER BY display_order ASC, created_at ASC;
    `;

    const result = await pool.query(query, [productId]);

    return NextResponse.json({
      success: true,
      variants: result.rows.map((row) => ({
        ...row,
        sellingPrice: Number(row.sellingPrice),
        price: Number(row.sellingPrice),
        mrp: Number(row.mrp),
        costPrice: row.costPrice ? Number(row.costPrice) : undefined,
        quantityValue: row.quantityValue ? Number(row.quantityValue) : undefined,
        discountPercentage: row.discountPercentage ? Number(row.discountPercentage) : 0,
        stockQuantity: Number(row.stockQuantity) || 0,
        stock: Number(row.stockQuantity) || 0,
        lowStockThreshold: Number(row.lowStockThreshold) || 5,
        displayOrder: Number(row.displayOrder) || 1,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching product variants:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch variants' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products/[id]/variants
 * Adds a new variant to a product with auto-provisioning.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: productId } = await context.params;
    const body = await req.json();

    const {
      productName,
      variantName,
      quantityValue,
      quantityUnit = 'kg',
      sellingPrice,
      mrp,
      costPrice,
      stockQuantity = 20,
      lowStockThreshold = 5,
      sku: customSku,
      barcode,
      isDefault = false,
      isActive = true,
      displayOrder,
    } = body;

    if (!variantName || sellingPrice === undefined || mrp === undefined) {
      return NextResponse.json(
        { success: false, error: 'Variant name, selling price, and MRP are required' },
        { status: 400 }
      );
    }

    const numericSellingPrice = Number(sellingPrice);
    const numericMrp = Number(mrp);

    if (isNaN(numericSellingPrice) || numericSellingPrice < 0) {
      return NextResponse.json(
        { success: false, error: 'Selling price must be a non-negative number' },
        { status: 400 }
      );
    }

    if (isNaN(numericMrp) || numericMrp < 0) {
      return NextResponse.json(
        { success: false, error: 'MRP must be a non-negative number' },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();

    // 1. Verify or auto-provision product in PostgreSQL
    let prodRes = await pool.query('SELECT id, name, slug FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      const pName = (productName || productId).trim();
      const pSlug = pName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const pSku = `PK-${productId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;

      // Pick a valid category
      const catCheck = await pool.query('SELECT id FROM categories LIMIT 1');
      const fallbackCat = catCheck.rows[0]?.id || 'cat-veg';

      await pool.query(
        `
        INSERT INTO products (
          id, category_id, name, slug, sku, unit, mrp, selling_price, stock, status, lifecycle_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, '1 unit', $6, $7, 100, 'active', 'ACTIVE', NOW(), NOW()
        ) ON CONFLICT (id) DO NOTHING;
        `,
        [productId, fallbackCat, pName, pSlug, pSku, numericMrp, numericSellingPrice]
      );

      prodRes = await pool.query('SELECT id, name, slug FROM products WHERE id = $1', [productId]);
    }

    // Determine display order
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined) {
      const maxOrderRes = await pool.query(
        'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM product_variants WHERE product_id = $1',
        [productId]
      );
      finalDisplayOrder = parseInt(maxOrderRes.rows[0].next_order, 10);
    }

    // If setting as default, unset other defaults for this product
    if (isDefault) {
      await pool.query('UPDATE product_variants SET is_default = false WHERE product_id = $1', [productId]);
    }

    const variantId = `var_${productId}_${Date.now().toString().slice(-6)}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanProdId = productId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    const finalSku = customSku || `SKU-${cleanProdId}-${(variantName || 'V').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${Date.now().toString().slice(-3)}`;
    const discount = numericMrp > numericSellingPrice ? Math.round(((numericMrp - numericSellingPrice) / numericMrp) * 100) : 0;
    const pkCode = `PK-V${finalDisplayOrder}`;

    const insertQuery = `
      INSERT INTO product_variants (
        id,
        product_id,
        variant_name,
        quantity_value,
        quantity_unit,
        selling_price,
        mrp,
        cost_price,
        discount_percentage,
        stock_quantity,
        low_stock_threshold,
        sku,
        barcode,
        is_active,
        is_default,
        display_order,
        pk_display_code,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
      RETURNING 
        id,
        product_id as "productId",
        variant_name as "variantName",
        quantity_value as "quantityValue",
        quantity_unit as "quantityUnit",
        quantity_unit as unit,
        selling_price as "sellingPrice",
        selling_price as price,
        mrp,
        cost_price as "costPrice",
        discount_percentage as "discountPercentage",
        stock_quantity as "stockQuantity",
        stock_quantity as stock,
        low_stock_threshold as "lowStockThreshold",
        sku,
        barcode,
        is_active as "isActive",
        is_default as "isDefault",
        display_order as "displayOrder",
        pk_display_code as "pkDisplayCode",
        created_at as "createdAt",
        updated_at as "updatedAt";
    `;

    const result = await pool.query(insertQuery, [
      variantId,
      productId,
      variantName.trim(),
      quantityValue !== undefined && quantityValue !== '' ? Number(quantityValue) : null,
      quantityUnit.trim(),
      numericSellingPrice,
      numericMrp,
      costPrice ? Number(costPrice) : null,
      discount,
      Number(stockQuantity) || 0,
      Number(lowStockThreshold) || 5,
      finalSku,
      barcode ? barcode.trim() : null,
      Boolean(isActive),
      Boolean(isDefault),
      finalDisplayOrder,
      pkCode,
    ]);

    const createdVariant = result.rows[0];

    return NextResponse.json({
      success: true,
      variant: {
        ...createdVariant,
        sellingPrice: Number(createdVariant.sellingPrice),
        price: Number(createdVariant.sellingPrice),
        mrp: Number(createdVariant.mrp),
        quantityValue: createdVariant.quantityValue ? Number(createdVariant.quantityValue) : undefined,
        stockQuantity: Number(createdVariant.stockQuantity),
        stock: Number(createdVariant.stockQuantity),
      },
      message: `Variant "${variantName}" created successfully`,
    });
  } catch (error: any) {
    console.error('Error creating product variant:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create variant' },
      { status: 500 }
    );
  }
}
