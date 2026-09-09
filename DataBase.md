# Backend Database Schema 

# Pocket Kirana – Grocery Delivery Platform 

**Database Type:** PostgreSQL (Recommended) **ORM:** Prisma / Drizzle ORM 

**ID Format:** UUID **Naming Convention:** snake_case **Timestamps:** created_at, updated_at 

# Database Relationship Overview 

#### Users 

- ├── Customer Profiles ├── Admin Profiles ├── Store Staff └── Delivery Partners 

#### Stores 

- ├── Categories 

- ├── Products 

- ├── Inventory 

- ├── Orders └── Offers 

#### Products 

- ├── Product Images 

- ├── Product Variants 

- ├── Reviews 

- ├── Cart Items 

- ├── Wishlist 

- └── Order Items 

#### Orders 

├── Order Items 

- ├── Payments ├── Delivery 

├── Coupons └── Invoice 

# 1. Users 

|Field|Type|Description|
|---|---|---|
|id|UUID PK|User ID|
|role|ENUM|customer, admin,<br>store_manager,<br>delivery_partner|
|frst_name|VARCHAR(100)|First Name|
|last_name|VARCHAR(100)|Last Name|
|mobile|VARCHAR(20)<br>UNIQUE|Mobile Number|
|email|VARCHAR(150)|Email|
|password_hash|TEXT|Admin/Staf<br>Password|
|profle_image|TEXT|Image URL|
|status|ENUM|active, inactive,<br>blocked|
|last_login|TIMESTAMP|Last Login|
|created_at|TIMESTAMP|Created|
|updated_at|TIMESTAMP|Updated|



# 2. User Addresses 

|Field|Type|
|---|---|
|id|UUID PK|
|user_id|UUID FK|
|address_type|VARCHAR(20)|
|full_name|VARCHAR(100)|



|Field|Type|
|---|---|
|phone|VARCHAR(20)|
|address_line1|TEXT|
|address_line2|TEXT|
|city|VARCHAR(100)|
|state|VARCHAR(100)|
|country|VARCHAR(100)|
|postal_code|VARCHAR(20)|
|latitude|DECIMAL(10,8)|
|longitude|DECIMAL(11,8)|
|is_default|BOOLEAN|



Relationship: 

User └── Multiple Addresses 

# 3. Stores 

|Field|Type|
|---|---|
|id|UUID PK|
|owner_id|UUID FK|
|name|VARCHAR(200)|
|phone|VARCHAR(20)|
|email|VARCHAR(150)|
|gst_number|VARCHAR(50)|
|address|TEXT|
|latitude|DECIMAL|
|longitude|DECIMAL|
|opening_time|TIME|
|closing_time|TIME|



|Field||Type|
|---|---|---|
|delivery_radius|INTEGER||
|status|ENUM||



# 4. Categories 

|Field|Type|
|---|---|
|id|UUID PK|
|parent_id|UUID FK|
|name|VARCHAR(100)|
|slug|VARCHAR(150)|
|image|TEXT|
|sort_order|INTEGER|
|is_active|BOOLEAN|



# 5. Brands 

|Field|Type|
|---|---|
|id|UUID PK|
|name|VARCHAR(100)|
|logo|TEXT|
|description|TEXT|
|status|BOOLEAN|



# 6. Products 

|Field||Type|
|---|---|---|
|id|UUID PK||
|category_id|UUID FK||
|brand_id|UUID FK||



|Field|Type|
|---|---|
|store_id|UUID FK|
|sku|VARCHAR(50)|
|barcode|VARCHAR(50)|
|name|VARCHAR(200)|
|slug|VARCHAR(250)|
|description|TEXT|
|unit|VARCHAR(50)|
|weight|DECIMAL|
|mrp|DECIMAL(10,2)|
|selling_price|DECIMAL(10,2)|
|tax_percentage|DECIMAL(5,2)|
|thumbnail|TEXT|
|status|ENUM|
|created_at|TIMESTAMP|



Relationship: 

Store └── Products 

Category └── Products Brand └── Products 

# 7. Product Images 

|Field||Type|
|---|---|---|
|id|UUID PK||
|product_id|UUID FK||
|image_url|TEXT||



|Field<br>display_order|INTEGER|Type|
|---|---|---|



# 8. Product Variants 

|Field||Type|
|---|---|---|
|id|UUID PK||
|product_id|UUID FK||
|variant_name|VARCHAR||
|unit|VARCHAR||
|price|DECIMAL||
|stock|INTEGER||



# 9. Inventory 

|Field||Type|
|---|---|---|
|id|UUID PK||
|product_id|UUID FK||
|quantity|INTEGER||
|reserved_quantity|INTEGER||
|reorder_level|INTEGER||
|warehouse_location|VARCHAR||



# 10. Shopping Cart 

||Field|Type|
|---|---|---|
|id||UUID PK|
|user_id||UUID FK|
|created_at||TIMESTAMP|



# 11. Cart Items 

|Field||Type|
|---|---|---|
|id|UUID PK||
|cart_id|UUID FK||
|product_id|UUID FK||
|quantity|INTEGER||
|price|DECIMAL||



# 12. Wishlist 

|Field|Type|
|---|---|
|id|UUID PK|
|user_id|UUID FK|
|product_id|UUID FK|
|created_at|TIMESTAMP|



# 13. Orders 

|Field|Type|
|---|---|
|id|UUID PK|
|order_number|VARCHAR UNIQUE|
|customer_id|UUID FK|
|store_id|UUID FK|
|address_id|UUID FK|
|coupon_id|UUID FK NULL|
|subtotal|DECIMAL|
|discount|DECIMAL|
|delivery_charge|DECIMAL|
|tax|DECIMAL|



|Field|Type|
|---|---|
|total|DECIMAL|
|payment_status|ENUM|
|order_status|ENUM|
|placed_at|TIMESTAMP|



Relationship: 

Customer └── Orders Store └── Orders 

# 14. Order Items 

|Field||Type|
|---|---|---|
|id|UUID PK||
|order_id|UUID FK||
|product_id|UUID FK||
|quantity|INTEGER||
|unit_price|DECIMAL||
|total_price|DECIMAL||



# 15. Payments 

|Field||Type|
|---|---|---|
|id|UUID PK||
|order_id|UUID FK||
|payment_method|ENUM||
|transaction_id|VARCHAR||
|gateway|VARCHAR||



||Field|Type|
|---|---|---|
|amount||DECIMAL|
|status||ENUM|
|paid_at||TIMESTAMP|



# 16. Delivery Partners 

|Field||Type|
|---|---|---|
|id|UUID PK||
|user_id|UUID FK||
|vehicle_type|VARCHAR||
|vehicle_number|VARCHAR||
|license_number|VARCHAR||
|verifcation_status|ENUM||
|current_status|ENUM||



# 17. Deliveries 

|Field|Type|
|---|---|
|id|UUID PK|
|order_id|UUID FK|
|partner_id|UUID FK|
|pickup_time|TIMESTAMP|
|delivery_time|TIMESTAMP|
|otp|VARCHAR|
|status|ENUM|
|live_latitude|DECIMAL|
|live_longitude|DECIMAL|



# 18. Coupons 

|Field<br>Type|
|---|
|id<br>UUID PK|
|code<br>VARCHAR|
|type<br>ENUM|
|value<br>DECIMAL|
|minimum_order<br>DECIMAL|
|max_discount<br>DECIMAL|
|start_date<br>DATE|
|end_date<br>DATE|
|usage_limit<br>INTEGER|
|active<br>BOOLEAN|



# 19. Reviews 

|Field|Type|
|---|---|
|id|UUID PK|
|user_id|UUID FK|
|product_id|UUID FK|
|order_id|UUID FK|
|rating|SMALLINT|
|review|TEXT|
|created_at|TIMESTAMP|



# 20. Notifications 

||Field||Type|
|---|---|---|---|
|id||UUID PK||
|user_id||UUID FK||



|Field|Type|
|---|---|
|title|VARCHAR|
|message|TEXT|
|type|ENUM|
|is_read|BOOLEAN|
|created_at|TIMESTAMP|



# 21. Wallet Transactions 

|Field|Type|
|---|---|
|id|UUID PK|
|partner_id|UUID FK|
|type|ENUM|
|amount|DECIMAL|
|reference_id|UUID|
|status|ENUM|
|created_at|TIMESTAMP|



# 22. Banners 

|Field|Type|
|---|---|
|id|UUID PK|
|title|VARCHAR|
|image|TEXT|
|redirect_url|TEXT|
|start_date|DATE|
|end_date|DATE|
|active|BOOLEAN|



# 23. Offers 

|Field|Type|
|---|---|
|id|UUID PK|
|title|VARCHAR|
|description|TEXT|
|discount_percentage|DECIMAL|
|product_id|UUID FK|
|start_date|DATE|
|end_date|DATE|



# 24. Support Tickets 

|Field|Type|
|---|---|
|id|UUID PK|
|user_id|UUID FK|
|order_id|UUID FK|
|subject|VARCHAR|
|description|TEXT|
|status|ENUM|
|priority|ENUM|
|assigned_to|UUID FK|
|created_at|TIMESTAMP|



# 25. Audit Logs 

|Field||Type|
|---|---|---|
|id|UUID PK||
|user_id|UUID FK||
|action|VARCHAR||



|Field|Type|
|---|---|
|entity|VARCHAR|
|entity_id|UUID|
|ip_address|VARCHAR|
|user_agent|TEXT|
|created_at|TIMESTAMP|



# Entity Relationship Summary 

#### Users 

- ├── Addresses 

- ├── Orders 

- ├── Wishlist 

├── Reviews ├── Notifications 

└── Support Tickets 

#### Stores 

├── Products ├── Inventory 

├── Orders └── Offers 

Categories 

└── Products 

#### Brands 

└── Products 

#### Products 

├── Images ├── Variants 

- ├── Inventory ├── Cart Items 

- ├── Wishlist 

- ├── Reviews 

└── Order Items 

#### Orders 

├── Order Items ├── Payments ├── Deliveries 

├── Coupons └── Support Tickets 

#### Delivery Partners 

├── Deliveries └── Wallet Transactions 

#### Admin 

├── Audit Logs ├── Banners ├── Offers └── Reports 

## Estimated Database Scale 

|Module|Tables||
|---|---|---|
|User Management||4|
|Store Management||2|
|Product Catalog||6|
|Shopping & Checkout||4|
|Orders & Payments||4|
|Delivery||2|
|Marketing||2|
|Customer Support||2|
|Administration||3|



### **Total Core Tables: 29** 

This schema provides a solid foundation for Pocket Kirana, supporting customer shopping, inventory management, order processing, payments, delivery operations, promotions, customer support, analytics, and future expansion to multiple stores and cities. 

