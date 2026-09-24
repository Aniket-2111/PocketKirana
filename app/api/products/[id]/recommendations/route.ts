import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { fetchProductsFS } from '@/lib/firebaseServices';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
import { Product, ProductVariant } from '@/types';
import { getProductDetailRecommendations } from '@/lib/recommendationsEngine';

export const revalidate = 30; // 30s cache revalidation

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID or slug is required' },
        { status: 400 }
      );
    }

    // 1. Try PostgreSQL fetch with candidate queries
    try {
      const pool = getPostgresPool();

      // Find target product
      const targetRes = await pool.query(
        `
        SELECT 
          p.id,
          p.category_id as "categoryId",
          p.subcategory_id as "subcategoryId",
          p.brand_id as "brandId",
          p.sku,
          p.barcode,
          p.name,
          p.slug,
          p.description,
          p.unit,
          p.mrp,
          p.selling_price as "sellingPrice",
          p.stock,
          p.status,
          p.thumbnail_url as thumbnail,
          p.is_featured as "isFeatured"
        FROM products p
        WHERE p.id = $1 OR p.slug = $1
        LIMIT 1
        `,
        [id]
      );

      if (targetRes.rows.length > 0) {
        const targetProduct: Product = {
          ...targetRes.rows[0],
          sellingPrice: Number(targetRes.rows[0].sellingPrice),
          mrp: Number(targetRes.rows[0].mrp),
          stock: Number(targetRes.rows[0].stock) || 0,
        };

        // Query active candidates from database
        const candidatesRes = await pool.query(
          `
          SELECT 
            p.id,
            p.category_id as "categoryId",
            p.subcategory_id as "subcategoryId",
            p.brand_id as "brandId",
            p.sku,
            p.barcode,
            p.name,
            p.slug,
            p.description,
            p.unit,
            p.mrp,
            p.selling_price as "sellingPrice",
            p.stock,
            p.status,
            p.thumbnail_url as thumbnail,
            p.is_featured as "isFeatured",
            p.created_at as "createdAt"
          FROM products p
          WHERE p.id != $1 AND p.slug != $2
            AND (p.status IS NULL OR LOWER(p.status) NOT IN ('inactive', 'discontinued'))
          ORDER BY CASE WHEN p.stock > 0 THEN 0 ELSE 1 END, p.created_at DESC
          LIMIT 100
          `,
          [targetProduct.id, targetProduct.slug || targetProduct.id]
        );

        // Fetch variants for candidates
        const candidateIds = candidatesRes.rows.map((r) => r.id);
        const variantsByProdId: Record<string, ProductVariant[]> = {};

        if (candidateIds.length > 0) {
          const varRes = await pool.query(
            `
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
              stock_quantity as "stockQuantity",
              stock_quantity as stock,
              is_active as "isActive",
              is_default as "isDefault",
              display_order as "displayOrder"
            FROM product_variants
            WHERE product_id = ANY($1)
            ORDER BY display_order ASC, created_at ASC;
            `,
            [candidateIds]
          );

          for (const row of varRes.rows) {
            if (!variantsByProdId[row.productId]) {
              variantsByProdId[row.productId] = [];
            }
            variantsByProdId[row.productId].push({
              ...row,
              sellingPrice: Number(row.sellingPrice),
              price: Number(row.sellingPrice),
              mrp: Number(row.mrp),
              stockQuantity: Number(row.stockQuantity) || 0,
              stock: Number(row.stockQuantity) || 0,
            });
          }
        }

        const candidateProducts: Product[] = candidatesRes.rows.map((p) => {
          const variants = variantsByProdId[p.id] || [];
          const lowestVariantPrice = variants.length > 0
            ? Math.min(...variants.filter((v) => v.isActive).map((v) => v.sellingPrice))
            : Number(p.sellingPrice);

          return {
            ...p,
            sellingPrice: lowestVariantPrice || Number(p.sellingPrice) || 0,
            mrp: Number(p.mrp) || Number(p.sellingPrice) || 0,
            stock: Number(p.stock) || 0,
            rating: 4.8,
            reviewsCount: 124,
            variants,
          };
        });

        const recommendations = getProductDetailRecommendations(targetProduct, candidateProducts);

        const response = NextResponse.json({
          success: true,
          ...recommendations,
        });
        response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
        return response;
      }
    } catch (pgErr) {
      console.warn('Postgres recommendation query fallback:', pgErr);
    }

    // 2. Fallback to In-Memory Cache / Firestore
    let allProducts: Product[] = [];
    try {
      allProducts = await fetchProductsFS();
    } catch (_) {
      allProducts = INITIAL_PRODUCTS;
    }

    if (!allProducts || allProducts.length === 0) {
      allProducts = INITIAL_PRODUCTS;
    }

    const target = allProducts.find((p) => p.id === id || p.slug === id);
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const recommendations = getProductDetailRecommendations(target, allProducts);

    const response = NextResponse.json({
      success: true,
      ...recommendations,
    });
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}
