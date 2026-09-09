import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

interface RouteContext {
  params: Promise<{ id: string; variantId: string }>;
}

/**
 * GET /api/products/[id]/variants/[variantId]
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id: productId, variantId } = await context.params;
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
      WHERE id = $1 AND product_id = $2;
    `;

    const result = await pool.query(query, [variantId, productId]);
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Variant not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      variant: {
        ...row,
        sellingPrice: Number(row.sellingPrice),
        price: Number(row.sellingPrice),
        mrp: Number(row.mrp),
        costPrice: row.costPrice ? Number(row.costPrice) : undefined,
        quantityValue: row.quantityValue ? Number(row.quantityValue) : undefined,
        stockQuantity: Number(row.stockQuantity) || 0,
        stock: Number(row.stockQuantity) || 0,
        lowStockThreshold: Number(row.lowStockThreshold) || 5,
        displayOrder: Number(row.displayOrder) || 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching variant:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch variant' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products/[id]/variants/[variantId]
 * Updates a variant's attributes, price, stock, default status, etc.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id: productId, variantId } = await context.params;
    const body = await req.json();
    const pool = getPostgresPool();

    // Check if variant exists
    const checkRes = await pool.query(
      'SELECT * FROM product_variants WHERE id = $1 AND product_id = $2',
      [variantId, productId]
    );

    if (checkRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Variant not found' },
        { status: 404 }
      );
    }

    const current = checkRes.rows[0];

    const finalName = body.variantName !== undefined ? body.variantName.trim() : current.variant_name;
    const finalValue = body.quantityValue !== undefined ? (body.quantityValue !== '' ? Number(body.quantityValue) : null) : current.quantity_value;
    const finalUnit = body.quantityUnit !== undefined ? body.quantityUnit.trim() : current.quantity_unit;
    const finalSellingPrice = body.sellingPrice !== undefined ? Number(body.sellingPrice) : Number(current.selling_price);
    const finalMrp = body.mrp !== undefined ? Number(body.mrp) : Number(current.mrp);
    const finalCostPrice = body.costPrice !== undefined ? Number(body.costPrice) : current.cost_price;
    const finalStock = body.stockQuantity !== undefined ? Number(body.stockQuantity) : (body.stock !== undefined ? Number(body.stock) : current.stock_quantity);
    const finalLowStock = body.lowStockThreshold !== undefined ? Number(body.lowStockThreshold) : current.low_stock_threshold;
    const finalSku = body.sku !== undefined ? body.sku.trim() : current.sku;
    const finalBarcode = body.barcode !== undefined ? (body.barcode ? body.barcode.trim() : null) : current.barcode;
    const finalIsActive = body.isActive !== undefined ? Boolean(body.isActive) : current.is_active;
    const finalIsDefault = body.isDefault !== undefined ? Boolean(body.isDefault) : current.is_default;
    const finalDisplayOrder = body.displayOrder !== undefined ? Number(body.displayOrder) : current.display_order;

    const discount = finalMrp > finalSellingPrice ? Math.round(((finalMrp - finalSellingPrice) / finalMrp) * 100) : 0;

    // If setting as default, unset other defaults for this product
    if (finalIsDefault && !current.is_default) {
      await pool.query(
        'UPDATE product_variants SET is_default = false WHERE product_id = $1 AND id != $2',
        [productId, variantId]
      );
    }

    const updateQuery = `
      UPDATE product_variants SET
        variant_name = $1,
        quantity_value = $2,
        quantity_unit = $3,
        selling_price = $4,
        mrp = $5,
        cost_price = $6,
        discount_percentage = $7,
        stock_quantity = $8,
        low_stock_threshold = $9,
        sku = $10,
        barcode = $11,
        is_active = $12,
        is_default = $13,
        display_order = $14,
        updated_at = NOW()
      WHERE id = $15 AND product_id = $16
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

    const updateRes = await pool.query(updateQuery, [
      finalName,
      finalValue,
      finalUnit,
      finalSellingPrice,
      finalMrp,
      finalCostPrice,
      discount,
      finalStock,
      finalLowStock,
      finalSku,
      finalBarcode,
      finalIsActive,
      finalIsDefault,
      finalDisplayOrder,
      variantId,
      productId,
    ]);

    const updated = updateRes.rows[0];

    return NextResponse.json({
      success: true,
      variant: {
        ...updated,
        sellingPrice: Number(updated.sellingPrice),
        price: Number(updated.sellingPrice),
        mrp: Number(updated.mrp),
        quantityValue: updated.quantityValue ? Number(updated.quantityValue) : undefined,
        stockQuantity: Number(updated.stockQuantity),
        stock: Number(updated.stockQuantity),
      },
      message: `Variant "${finalName}" updated successfully`,
    });
  } catch (error: any) {
    console.error('Error updating variant:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update variant' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]/variants/[variantId]
 * Safe delete: If referenced by historical order_items or inventory_batches, marks is_active = false (archives)
 * to preserve database integrity. Otherwise deletes permanently.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id: productId, variantId } = await context.params;
    const pool = getPostgresPool();

    // Check if variant exists
    const checkRes = await pool.query(
      'SELECT * FROM product_variants WHERE id = $1 AND product_id = $2',
      [variantId, productId]
    );

    if (checkRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Variant not found' },
        { status: 404 }
      );
    }

    const variant = checkRes.rows[0];

    // Check if variant is referenced in order_items or inventory_batches
    let isReferenced = false;

    try {
      const orderCheck = await pool.query(
        'SELECT COUNT(*) as count FROM order_items WHERE variant_id = $1',
        [variantId]
      );
      if (parseInt(orderCheck.rows[0]?.count || '0', 10) > 0) {
        isReferenced = true;
      }
    } catch (_) {}

    try {
      const batchCheck = await pool.query(
        'SELECT COUNT(*) as count FROM inventory_batches WHERE variant_id = $1',
        [variantId]
      );
      if (parseInt(batchCheck.rows[0]?.count || '0', 10) > 0) {
        isReferenced = true;
      }
    } catch (_) {}

    if (isReferenced) {
      // Safe Archive (deactivate) so historical records remain fully preserved
      await pool.query(
        'UPDATE product_variants SET is_active = false, is_default = false, updated_at = NOW() WHERE id = $1',
        [variantId]
      );

      return NextResponse.json({
        success: true,
        archived: true,
        message: `Variant "${variant.variant_name}" has historical order/inventory records and was safely archived (deactivated).`,
      });
    }

    // Safe to permanently delete
    await pool.query('DELETE FROM product_variants WHERE id = $1', [variantId]);

    return NextResponse.json({
      success: true,
      deleted: true,
      message: `Variant "${variant.variant_name}" deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting variant:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete variant' },
      { status: 500 }
    );
  }
}
