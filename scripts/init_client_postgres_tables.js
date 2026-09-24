/**
 * PocketKirana Production PostgreSQL Schema Initialization Script
 * Complete 38-Table Database Setup across 10 Functional Modules (plus legacy delivery app support tables)
 * Targets Client Laptop PostgreSQL (pocketkirana_db @ 192.168.0.101:5433)
 * Usage: node scripts/init_client_postgres_tables.js
 */

const { Client } = require('pg');

const targetHost = process.env.DB_HOST || '192.168.0.101';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

const connectionString = `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

const schemaSql = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- MODULE 01: CATALOG
--------------------------------------------------------------------------------

-- 1. categories
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  parent_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(128) UNIQUE NOT NULL,
  description TEXT,
  image_data BYTEA,
  image_mime_type VARCHAR(64),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(64);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2. brands
CREATE TABLE IF NOT EXISTS brands (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(128) UNIQUE NOT NULL,
  description TEXT,
  logo_data BYTEA,
  logo_mime_type VARCHAR(64),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. products
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  category_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL,
  brand_id VARCHAR(64) REFERENCES brands(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  product_code VARCHAR(64) UNIQUE,
  hsn_code VARCHAR(32),
  gst_percentage NUMERIC(5, 2) DEFAULT 0.00,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id VARCHAR(64) REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(64);
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(32);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5, 2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- 4. product_variants
CREATE TABLE IF NOT EXISTS product_variants (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(64) UNIQUE NOT NULL,
  variant_name VARCHAR(128) NOT NULL,
  weight_value NUMERIC(10, 3),
  weight_unit VARCHAR(32),
  mrp NUMERIC(10, 2) NOT NULL,
  selling_price NUMERIC(10, 2) NOT NULL,
  cost_price NUMERIC(10, 2),
  discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
  tax_percentage NUMERIC(5, 2) DEFAULT 0.00,
  barcode VARCHAR(64) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. product_images (BYTEA Binary Image Data)
CREATE TABLE IF NOT EXISTS product_images (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE CASCADE,
  variant_id VARCHAR(64) REFERENCES product_variants(id) ON DELETE CASCADE,
  image_data BYTEA,
  image_mime_type VARCHAR(64),
  file_name VARCHAR(255),
  file_size INT,
  image_width INT,
  image_height INT,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. product_attributes
CREATE TABLE IF NOT EXISTS product_attributes (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  data_type VARCHAR(32) DEFAULT 'string',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. product_attribute_values
CREATE TABLE IF NOT EXISTS product_attribute_values (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE CASCADE,
  attribute_id VARCHAR(64) REFERENCES product_attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------------------------
-- MODULE 02: STORE & INVENTORY
--------------------------------------------------------------------------------

-- 8. stores
CREATE TABLE IF NOT EXISTS stores (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) UNIQUE NOT NULL,
  phone VARCHAR(32),
  address TEXT,
  city VARCHAR(64),
  state VARCHAR(64),
  pincode VARCHAR(16),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. inventory
CREATE TABLE IF NOT EXISTS inventory (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(64) REFERENCES stores(id) ON DELETE CASCADE,
  variant_id VARCHAR(64) REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. inventory_transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(64) REFERENCES stores(id) ON DELETE CASCADE,
  variant_id VARCHAR(64) REFERENCES product_variants(id) ON DELETE CASCADE,
  transaction_type VARCHAR(32) NOT NULL,
  quantity INT NOT NULL,
  reference_type VARCHAR(64),
  reference_id VARCHAR(64),
  notes TEXT,
  created_by VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. stock_reservations
CREATE TABLE IF NOT EXISTS stock_reservations (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(64) REFERENCES stores(id) ON DELETE CASCADE,
  variant_id VARCHAR(64) REFERENCES product_variants(id) ON DELETE CASCADE,
  order_id VARCHAR(64),
  quantity INT NOT NULL,
  status VARCHAR(32) DEFAULT 'reserved',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------------------------
-- MODULE 03: SHOPPING
--------------------------------------------------------------------------------

-- 12. carts
CREATE TABLE IF NOT EXISTS carts (
  id VARCHAR(64) PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL,
  store_id VARCHAR(64) REFERENCES stores(id) ON DELETE SET NULL,
  status VARCHAR(32) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  id VARCHAR(64) PRIMARY KEY,
  cart_id VARCHAR(64) REFERENCES carts(id) ON DELETE CASCADE,
  variant_id VARCHAR(64) REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. wishlists
CREATE TABLE IF NOT EXISTS wishlists (
  id VARCHAR(64) PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. wishlist_items
CREATE TABLE IF NOT EXISTS wishlist_items (
  id VARCHAR(64) PRIMARY KEY,
  wishlist_id VARCHAR(64) REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------------------------
-- MODULE 04: ORDERS
--------------------------------------------------------------------------------

-- 16. orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  order_number VARCHAR(64) UNIQUE NOT NULL,
  firebase_uid VARCHAR(128),
  store_id VARCHAR(64) REFERENCES stores(id) ON DELETE SET NULL,
  subtotal NUMERIC(10, 2) DEFAULT 0.00,
  discount_amount NUMERIC(10, 2) DEFAULT 0.00,
  delivery_fee NUMERIC(10, 2) DEFAULT 0.00,
  tax_amount NUMERIC(10, 2) DEFAULT 0.00,
  total_amount NUMERIC(10, 2) NOT NULL,
  coupon_id VARCHAR(64),
  payment_method VARCHAR(32) NOT NULL,
  payment_status VARCHAR(32) DEFAULT 'pending',
  order_status VARCHAR(32) NOT NULL DEFAULT 'placed',
  delivery_status VARCHAR(32) DEFAULT 'pending',
  notes TEXT,
  placed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drop legacy FK constraint on users.id if present
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(32) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 17. order_items
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE RESTRICT,
  variant_id VARCHAR(64) REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(128),
  sku VARCHAR(64),
  quantity INT NOT NULL,
  mrp NUMERIC(10, 2) DEFAULT 0.00,
  selling_price NUMERIC(10, 2) DEFAULT 0.00,
  discount_amount NUMERIC(10, 2) DEFAULT 0.00,
  tax_amount NUMERIC(10, 2) DEFAULT 0.00,
  total_amount NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(64);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_name VARCHAR(128);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku VARCHAR(64);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0.00;

-- 18. order_addresses
CREATE TABLE IF NOT EXISTS order_addresses (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
  receiver_name VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  landmark TEXT,
  city VARCHAR(64) NOT NULL,
  state VARCHAR(64) NOT NULL,
  pincode VARCHAR(16) NOT NULL,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. order_status_history
CREATE TABLE IF NOT EXISTS order_status_history (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
  old_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  changed_by VARCHAR(128),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. order_notes
CREATE TABLE IF NOT EXISTS order_notes (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
  firebase_uid VARCHAR(128) NOT NULL,
  note TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------------------------
-- MODULE 05: PAYMENTS
--------------------------------------------------------------------------------

-- 21. payments
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
  firebase_uid VARCHAR(128) NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'INR',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  gateway VARCHAR(64),
  gateway_order_id VARCHAR(128),
  gateway_payment_id VARCHAR(128),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. payment_transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR(64) PRIMARY KEY,
  payment_id VARCHAR(64) REFERENCES payments(id) ON DELETE CASCADE,
  transaction_id VARCHAR(128) UNIQUE,
  transaction_type VARCHAR(32) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(32) NOT NULL,
  response_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. refunds
CREATE TABLE IF NOT EXISTS refunds (
  id VARCHAR(64) PRIMARY KEY,
  payment_id VARCHAR(64) REFERENCES payments(id) ON DELETE CASCADE,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  reason TEXT,
  status VARCHAR(32) DEFAULT 'initiated',
  gateway_refund_id VARCHAR(128),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------------------------
-- MODULE 06: DELIVERY
--------------------------------------------------------------------------------

-- 24. delivery_zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  pincode VARCHAR(16) NOT NULL,
  delivery_fee NUMERIC(10, 2) DEFAULT 0.00,
  minimum_order_amount NUMERIC(10, 2) DEFAULT 0.00,
  estimated_minutes INT DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 25. delivery_partners
CREATE TABLE IF NOT EXISTS delivery_partners (
  id VARCHAR(64) PRIMARY KEY,
  firebase_uid VARCHAR(128),
  employee_code VARCHAR(32),
  vehicle_type VARCHAR(64),
  vehicle_number VARCHAR(32),
  status VARCHAR(32) DEFAULT 'offline',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS employee_code VARCHAR(32);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 26. delivery_assignments
CREATE TABLE IF NOT EXISTS delivery_assignments (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
  delivery_partner_id VARCHAR(64) REFERENCES delivery_partners(id) ON DELETE CASCADE,
  assigned_by VARCHAR(128),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(32) DEFAULT 'assigned'
);

-- 27. delivery_status_history
CREATE TABLE IF NOT EXISTS delivery_status_history (
  id VARCHAR(64) PRIMARY KEY,
  assignment_id VARCHAR(64) REFERENCES delivery_assignments(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 28. delivery_tracking
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id VARCHAR(64) PRIMARY KEY,
  assignment_id VARCHAR(64) REFERENCES delivery_assignments(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  accuracy NUMERIC(6, 2),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Operational Helper Tables (QR Tokens & Picking Workflow)
CREATE TABLE IF NOT EXISTS partner_auth_tokens (
  token VARCHAR(128) PRIMARY KEY,
  partner_id VARCHAR(64) REFERENCES delivery_partners(id) ON DELETE CASCADE,
  partner_name VARCHAR(128) NOT NULL,
  partner_code VARCHAR(32) NOT NULL,
  status VARCHAR(32) DEFAULT 'valid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS picking_tasks (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
  order_number VARCHAR(64) NOT NULL,
  picker_id VARCHAR(64),
  picker_name VARCHAR(128),
  status VARCHAR(32) DEFAULT 'pending',
  handover_qr_code VARCHAR(128),
  assigned_partner_id VARCHAR(64) REFERENCES delivery_partners(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------------------------
-- MODULE 07: OFFERS & COUPONS
--------------------------------------------------------------------------------

-- 29. coupons
CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(32) NOT NULL,
  discount_value NUMERIC(10, 2) NOT NULL,
  minimum_order_amount NUMERIC(10, 2) DEFAULT 0.00,
  maximum_discount NUMERIC(10, 2),
  usage_limit INT,
  per_user_limit INT DEFAULT 1,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 30. coupon_usage
CREATE TABLE IF NOT EXISTS coupon_usage (
  id VARCHAR(64) PRIMARY KEY,
  coupon_id VARCHAR(64) REFERENCES coupons(id) ON DELETE CASCADE,
  firebase_uid VARCHAR(128) NOT NULL,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount NUMERIC(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 31. offers
CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  offer_type VARCHAR(32) NOT NULL,
  discount_type VARCHAR(32),
  discount_value NUMERIC(10, 2),
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 32. offer_products
CREATE TABLE IF NOT EXISTS offer_products (
  id VARCHAR(64) PRIMARY KEY,
  offer_id VARCHAR(64) REFERENCES offers(id) ON DELETE CASCADE,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE CASCADE
);

-- 33. offer_categories
CREATE TABLE IF NOT EXISTS offer_categories (
  id VARCHAR(64) PRIMARY KEY,
  offer_id VARCHAR(64) REFERENCES offers(id) ON DELETE CASCADE,
  category_id VARCHAR(64) REFERENCES categories(id) ON DELETE CASCADE
);

--------------------------------------------------------------------------------
-- MODULE 08: CUSTOMER ACTIVITY
--------------------------------------------------------------------------------

-- 34. reviews
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(64) PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE CASCADE,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 35. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(64),
  reference_type VARCHAR(64),
  reference_id VARCHAR(64),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP WITH TIME ZONE
);

-- 36. support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(64) PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(32) DEFAULT 'medium',
  status VARCHAR(32) DEFAULT 'open',
  assigned_to VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP WITH TIME ZONE
);

--------------------------------------------------------------------------------
-- MODULE 09: ADMIN
--------------------------------------------------------------------------------

-- 37. roles
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 38. permissions
CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL,
  description TEXT
);

-- 39. role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id VARCHAR(64) PRIMARY KEY,
  role_id VARCHAR(64) REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(64) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 40. admin_users
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(64) PRIMARY KEY,
  firebase_uid VARCHAR(128) UNIQUE NOT NULL,
  role_id VARCHAR(64) REFERENCES roles(id) ON DELETE SET NULL,
  employee_code VARCHAR(32) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 41. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  firebase_uid VARCHAR(128),
  action VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64),
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------------------------
-- MODULE 10: REPORTING
--------------------------------------------------------------------------------

-- 42. daily_statistics
CREATE TABLE IF NOT EXISTS daily_statistics (
  id VARCHAR(64) PRIMARY KEY,
  stat_date DATE UNIQUE NOT NULL,
  total_users INT DEFAULT 0,
  new_users INT DEFAULT 0,
  total_orders INT DEFAULT 0,
  completed_orders INT DEFAULT 0,
  cancelled_orders INT DEFAULT 0,
  total_sales NUMERIC(12, 2) DEFAULT 0.00,
  total_discount NUMERIC(12, 2) DEFAULT 0.00,
  total_delivery_fee NUMERIC(12, 2) DEFAULT 0.00,
  total_tax NUMERIC(12, 2) DEFAULT 0.00,
  total_products_sold INT DEFAULT 0,
  average_order_value NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 43. sales_summaries
CREATE TABLE IF NOT EXISTS sales_summaries (
  id VARCHAR(64) PRIMARY KEY,
  summary_date DATE NOT NULL,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
  variant_id VARCHAR(64) REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity_sold INT DEFAULT 0,
  gross_sales NUMERIC(12, 2) DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) DEFAULT 0.00,
  net_sales NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------------------------
-- PERFORMANCE INDEXES
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_discover_sort ON products(is_featured DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_product_display ON product_variants(product_id, display_order, created_at);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_store_variant ON inventory(store_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_carts_firebase_uid ON carts(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_orders_firebase_uid ON orders(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_firebase_uid ON payments(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_assignment ON delivery_tracking(assignment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_firebase_uid ON reviews(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_notifications_firebase_uid ON notifications(firebase_uid);
`;

async function initRemoteTables() {
  console.log('\n======================================================');
  console.log('🚀 INITIALIZING POSTGRESQL SCHEMA ON CLIENT LAPTOP');
  console.log(`📍 Client IP: ${targetHost}:${targetPort} | DB: ${targetDb}`);
  console.log('======================================================\n');

  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();
    console.log('⚡ Executing DDL Schema creation script...');
    await client.query(schemaSql);
    console.log('✅ SUCCESS: All PocketKirana core tables created / verified on Client Laptop DB!\n');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`📊 Verified Tables in Database (Total: ${res.rows.length}):`);
    res.rows.forEach((r, idx) => {
      console.log(`   ${String(idx + 1).padStart(2, ' ')}. ${r.table_name}`);
    });
    console.log('\n🎉 PocketKirana PostgreSQL database schema is fully initialized and operational!\n');

  } catch (err) {
    console.error('❌ Error initializing tables on Client Laptop PostgreSQL:', err?.stack || err?.message || err);
  } finally {
    await client.end();
  }
}

initRemoteTables();
