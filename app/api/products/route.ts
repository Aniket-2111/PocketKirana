import { NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { fetchProductsFS } from '@/lib/firebaseServices';
import { Product, ProductVariant } from '@/types';

export const revalidate = 30; // Next.js cache revalidation time in seconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    // 1. Try fetching from PostgreSQL database with variants
    try {
      const pool = getPostgresPool();

      let prodQuery = `
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
          p.created_at as "createdAt",
          p.updated_at as "updatedAt"
        FROM products p
      `;

      const values: any[] = [];
      if (categoryId) {
        prodQuery += ' WHERE p.category_id = $1 OR p.subcategory_id = $1';
        values.push(categoryId);
      }
      prodQuery += ' ORDER BY p.created_at DESC';

      const prodRes = await pool.query(prodQuery, values);

      if (prodRes.rows.length > 0) {
        // Fetch all variants for these products
        const productIds = prodRes.rows.map((r) => r.id);
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
            pk_display_code as "pkDisplayCode"
          FROM product_variants
          WHERE product_id = ANY($1)
          ORDER BY display_order ASC, created_at ASC;
          `,
          [productIds]
        );

        const variantsByProdId: Record<string, ProductVariant[]> = {};
        for (const row of varRes.rows) {
          if (!variantsByProdId[row.productId]) {
            variantsByProdId[row.productId] = [];
          }
          variantsByProdId[row.productId].push({
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
          });
        }

        const enrichedProducts: Product[] = prodRes.rows.map((p) => {
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

        const response = NextResponse.json({
          success: true,
          data: enrichedProducts,
          products: enrichedProducts,
        });

        response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
        return response;
      }
    } catch (pgErr) {
      console.warn('PostgreSQL product fetch fallback:', pgErr);
    }

    // 2. Fallback to Firestore
    let products = await fetchProductsFS();
    if (categoryId) {
      products = products.filter((p) => p.categoryId === categoryId || p.subcategoryId === categoryId);
    }

    const response = NextResponse.json({
      success: true,
      data: products,
      products,
    });

    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
