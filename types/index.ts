export type UserRole = 'customer' | 'store_manager' | 'delivery_partner' | 'admin' | 'picker';

export interface User {
  id: string;
  role: UserRole;
  mobile: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  profileImage?: string;
  status: 'active' | 'inactive' | 'blocked';
  lastLogin?: string;
  createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  addressType: 'Home' | 'Work' | 'Office' | 'Parents Home' | 'Other' | string;
  fullName: string;
  phone: string;
  houseNumber?: string;
  buildingName?: string;
  floor?: string;
  landmark?: string;
  addressLine1: string;
  addressLine2?: string;
  area?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  geocodedAddress?: string;
  deliveryZoneId?: string;
  isDefault: boolean;
}

export interface Store {
  id: string;
  storeCode?: string;
  ownerId: string;
  name: string;
  phone: string;
  email: string;
  gstNumber: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  openingTime: string;
  closingTime: string;
  deliveryRadiusKm: number;
  maxRoadDistanceKm?: number;
  roadDistanceMultiplier?: number; // Detour factor (default 1.35x straight line)
  minimumOrderValue?: number;
  deliveryFee?: number;
  expressDeliveryEnabled?: boolean;
  status: 'active' | 'inactive' | 'maintenance';
  isStoreOpen?: boolean;
  storeClosedMessage?: string;
  deliveryStatus?: 'ACTIVE' | 'INACTIVE' | 'HIGH_DEMAND';
  polygonGeoJSON?: any;
}

export interface Category {
  id: string;
  parentId?: string | null; // null/undefined for top-level categories, parent category ID for subcategories
  name: string;
  slug: string;
  image: string;
  bannerImage?: string;
  description?: string;
  sortOrder?: number;
  displayOrder?: number;
  isActive: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subcategory {
  id: string;
  categoryId: string; // Parent category ID (equivalent to parentId)
  name: string;
  slug: string;
  image?: string;
  bannerImage?: string;
  description?: string;
  displayOrder?: number;
  sortOrder?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  logoUrl?: string;
  banner?: string;
  bannerUrl?: string;
  description?: string;
  isActive: boolean;
  status?: boolean | 'active' | 'inactive'; // Backward compat
  displayOrder?: number;
  categoryIds?: string[];
  categories?: Category[];
  subcategoryIds?: string[];
  subcategories?: Subcategory[];
  productCount?: number;
  activeProductCount?: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  metaImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StorageLocation {
  id: string;
  storeId: string;
  aisle: string; // e.g. 'Aisle A'
  rack: string;  // e.g. '02'
  shelf: string; // e.g. 'B'
  bin: string;   // e.g. '04'
  barcode: string; // e.g. 'LOC-A02B04'
  displayCode: string; // e.g. 'A-02-B-04'
  zone?: 'Ambient' | 'Chilled' | 'Frozen' | 'High-Value';
}

export interface NutritionalInfo {
  energy?: string;
  protein?: string;
  carbohydrates?: string;
  totalSugar?: string;
  addedSugar?: string;
  totalFat?: string;
  saturatedFat?: string;
  unsaturatedFat?: string;
  transFat?: string;
  dietaryFiber?: string;
  sodium?: string;
  [key: string]: string | undefined;
}

export type ProductPublishStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHED';

export interface ProductAttribute {
  id: string;
  sectionId?: string;
  label: string;
  value: string;
  unit?: string;
  displayOrder: number;
  isVisible: boolean;
}

export interface ProductSection {
  id: string;
  productId?: string;
  title: string;
  displayOrder: number;
  isVisible: boolean;
  defaultExpanded: boolean;
  attributes: ProductAttribute[];
}

export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  displayOrder: number;
  isPrimary?: boolean;
}

export type MeasurementType = 'UNIT' | 'WEIGHT' | 'VOLUME';
export type WeightUnit = 'KG' | 'G';
export type VolumeUnit = 'LTR' | 'ML';
export type UnitSellingUnit = 'piece' | 'pack' | 'packet' | 'bottle' | 'box' | 'can' | 'jar' | 'tube' | 'dozen' | string;
export type MeasurementUnit = 
  | 'PCS' 
  | 'PACK' 
  | 'PACKET' 
  | 'BOTTLE' 
  | 'BOX' 
  | 'CAN' 
  | 'JAR' 
  | 'TUBE' 
  | 'DOZEN' 
  | 'KG' 
  | 'G' 
  | 'LTR' 
  | 'ML' 
  | string;

export type PackagingType = 
  | 'Loose' 
  | 'Packet' 
  | 'Box' 
  | 'Bottle' 
  | 'Jar' 
  | 'Can' 
  | 'Pouch' 
  | 'Other';

export interface Product {
  id: string;
  categoryId: string;
  subcategoryId?: string;
  brandId?: string;
  brandName?: string;
  brand?: Brand;
  storeId: string;
  sku: string;
  barcode: string;
  upc?: string;
  ean?: string;
  name: string;
  slug: string;
  description: string;
  unit: string;
  measurementType?: MeasurementType;
  measurementUnit?: MeasurementUnit;
  measurementValue?: number;
  packagingType?: PackagingType;
  hasVariants?: boolean;
  weightUnit?: WeightUnit;
  weight: number;
  mrp: number;
  sellingPrice: number;
  costPrice?: number;
  price?: number;
  salePrice?: number;
  taxPercentage: number;
  thumbnail: string;
  image?: string;
  images?: string[];
  shelfLife?: string;
  foodType?: string;
  productType?: string;
  source?: string;
  dietPreference?: string;
  countryOfOrigin?: string;
  fssaiLicense?: string;
  manufacturer?: string;
  storageInstructions?: string;
  keyFeatures?: string;
  disclaimer?: string;
  nutritionalInfo?: NutritionalInfo;
  category?: string;
  status: 'active' | 'out_of_stock' | 'discontinued';
  publishStatus?: ProductPublishStatus;
  stock?: number;
  rating: number;
  reviewsCount: number;
  isPopular?: boolean;
  isFeatured?: boolean;
  storageLocation?: StorageLocation;
  variants?: ProductVariant[];
  maxDisplayImages?: number;
  sections?: ProductSection[];
  version?: number;
  catalogVersion?: number;
  lastModifiedBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type CatalogEventType =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_PUBLISHED'
  | 'PRODUCT_UNPUBLISHED'
  | 'PRODUCT_DELETED'
  | 'VARIANT_UPDATED'
  | 'PRICE_UPDATED'
  | 'PROMOTION_UPDATED'
  | 'CATEGORY_UPDATED'
  | 'BRAND_UPDATED'
  | 'IMAGE_UPDATED'
  | 'CATALOG_VERSION_BUMPED';

export interface CatalogSyncEvent {
  eventId: string;
  eventType: CatalogEventType;
  entityType: 'PRODUCT' | 'CATEGORY' | 'BRAND' | 'VARIANT' | 'CATALOG';
  entityId: string;
  version: number;
  catalogVersion: number;
  occurredAt: string;
  storeId?: string;
  meta?: Record<string, any>;
}

export interface ProductVariant {
  id: string;
  productId: string;
  variantName: string;            // e.g. "500 g", "1 kg", "250 ml", "6 pieces"
  measurementType?: MeasurementType; // 'UNIT' | 'WEIGHT' | 'VOLUME'
  measurementUnit?: MeasurementUnit; // e.g. 'KG', 'G', 'LTR', 'ML', 'PCS', 'PACKET'
  measurementValue?: number;         // e.g. 500, 1, 2.5
  packagingType?: PackagingType;     // 'Loose', 'Packet', 'Bottle', etc.
  quantityValue?: number;         // alias for measurementValue
  quantityUnit?: string;          // alias for measurementUnit
  unit?: string;                  // alias for unit display
  sellingPrice: number;           // Variant specific price (e.g. 38)
  price?: number;                 // alias for sellingPrice
  mrp: number;                    // Variant specific MRP (e.g. 45)
  costPrice?: number;
  stockQuantity: number;          // Variant specific available stock
  stock?: number;                 // alias for stockQuantity
  lowStockThreshold?: number;     // e.g. 5
  sku?: string;
  barcode?: string;
  discountPercentage?: number;
  taxPercentage?: number;
  isActive: boolean;
  isDefault?: boolean;
  displayOrder?: number;
  pkDisplayCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  storeId: string;
  locationId?: string;
  locationCode?: string;
  quantity: number;              // Total physical stock
  reservedQuantity: number;     // Reserved by active orders
  damagedQuantity: number;      // Damaged/unsellable units
  availableQuantity: number;    // quantity - reservedQuantity - damagedQuantity
  reorderLevel: number;
  maxStockLevel?: number;
  warehouseLocation: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  price: number;
  mrp?: number;
  variantId?: string;
  variantName?: string;
  measurementType?: MeasurementType;
  measurementUnit?: MeasurementUnit;
  measurementValue?: number;
  packagingType?: PackagingType;
  selectedVariant?: ProductVariant;
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  product: Product;
  createdAt: string;
}

/**
 * Full 19-stage production order state machine.
 * Legacy short names are kept as aliases for backward compat.
 */
export type OrderStatus =
  // Normal flow
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'STOCK_RESERVED'
  | 'PICKING'
  | 'PICKED'
  | 'PACKING'
  | 'PACKED'
  | 'WAITING_FOR_DELIVERY'
  | 'ASSIGNED_TO_DELIVERY'
  | 'READY_FOR_PICKUP'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'ARRIVED_AT_STORE'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'ARRIVED_AT_CUSTOMER'
  | 'DELIVERY_ATTEMPTED'
  | 'DELIVERED'
  | 'COMPLETED'
  // Exception & Return states
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'OUT_OF_STOCK'
  | 'PICKING_FAILED'
  | 'CUSTOMER_UNAVAILABLE'
  | 'DELIVERY_FAILED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_PICKUP_ASSIGNED'
  | 'RETURN_PENDING'
  | 'RETURN_IN_TRANSIT'
  | 'RETURNED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  // Legacy aliases (kept for backward compatibility with existing mock data)
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'packed'
  | 'ready'
  | 'partner_assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'paid';

export type PaymentMethod = 'upi' | 'razorpay' | 'phonepe' | 'card' | 'netbanking' | 'cod' | 'wallet' | 'cash' | 'phonepe_upi' | 'cod_cash';

export type CollectionMethod = 'ONLINE' | 'CASH' | 'UPI';

export type CollectionStatus = 'NOT_REQUIRED' | 'PENDING' | 'COLLECTED' | 'VERIFIED' | 'SETTLED' | 'FAILED';

export type SettlementStatus = 'NOT_APPLICABLE' | 'PENDING' | 'SETTLED' | 'PARTIALLY_SETTLED';

export interface DeliveryOtpRecord {
  otp: string;
  attempts: number;
  maxAttempts: number;
  isLocked: boolean;
  lockedAt?: string;
  generatedAt: string;
  expiresAt: string;
  verifiedAt?: string;
  lastAttemptAt?: string;
}

export interface CodCollectionRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerName?: string;
  expectedAmount: number;
  collectedAmount: number;
  settledAmount: number;
  method: CollectionMethod;
  status: CollectionStatus;
  collectedAt?: string;
  settledAt?: string;
  settlementRef?: string;
  adminId?: string;
  adminName?: string;
  note?: string;
}

export interface PartnerSettlementLedger {
  partnerId: string;
  partnerName: string;
  phone?: string;
  totalCashCollected: number;
  totalUpiCollected: number;
  totalCollected: number;
  totalSettled: number;
  pendingSettlement: number;
  lastSettledAt?: string;
  activeOrdersCount?: number;
}

export interface SettlementRecord {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  adminId: string;
  adminName: string;
  settlementRef: string;
  note?: string;
  timestamp: string;
  orderIds?: string[];
}

export type DeliveryExceptionType =
  | 'CUSTOMER_NOT_ANSWERING'
  | 'CUSTOMER_NOT_AVAILABLE'
  | 'CUSTOMER_REFUSED'
  | 'LOCATION_INACCESSIBLE'
  | 'CUSTOMER_REQUESTED_LATER'
  | 'OTHER';

export type DeliveryExceptionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURN_INITIATED' | 'RESOLVED' | 'DISMISSED';

export interface DeliveryExceptionRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  partnerId?: string;
  deliveryPartnerId?: string;
  partnerName?: string;
  deliveryPartnerName?: string;
  exceptionType?: DeliveryExceptionType;
  reason: string;
  notes?: string;
  callAttempts?: number;
  arrivedAt?: string;
  waitingSeconds?: number;
  failedAt?: string;
  latitude?: number;
  longitude?: number;
  evidenceUrl?: string;
  photoEvidenceUrl?: string;
  status: DeliveryExceptionStatus;
  reviewedByAdminId?: string;
  reviewedByAdminName?: string;
  reviewedAt?: string;
  adminNote?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type OrderIssueType =
  | 'DAMAGED'
  | 'EXPIRED'
  | 'WRONG_PRODUCT'
  | 'MISSING_PRODUCT'
  | 'WRONG_QUANTITY'
  | 'QUALITY_ISSUE'
  | 'OTHER';

export type OrderIssueStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REPLACEMENT_PENDING'
  | 'REPLACED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'RESOLVED';

export type OrderIssueResolution = 'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT' | 'NO_ACTION';

export interface OrderIssueReport {
  id: string;
  ticketNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  orderItemId?: string;
  productId?: string;
  productName: string;
  variantName?: string;
  issueType: OrderIssueType;
  description: string;
  photos: string[];
  customerRequestedResolution: 'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT';
  status: OrderIssueStatus;
  resolutionType?: OrderIssueResolution;
  refundAmount?: number;
  replacementOrderId?: string;
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  batchNumber?: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ReturnType = 'FAILED_DELIVERY' | 'CUSTOMER_COMPLAINT' | 'CANCELLATION';

export type ReturnStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderReturn {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId?: string;
  returnType: ReturnType;
  status: ReturnStatus;
  assignedPartnerId?: string;
  assignedPartnerName?: string;
  initiatedBy?: string;
  initiatedAt: string;
  pickedUpAt?: string;
  receivedAt?: string;
  receivedBy?: string;
  inspectionStatus: 'PENDING' | 'COMPLETED';
  totalItems: number;
  createdAt: string;
  updatedAt?: string;
}

export type ItemInspectionDisposition = 'RESTOCKABLE' | 'DAMAGED' | 'EXPIRED' | 'DISPOSED';

export interface ReturnItemInspection {
  id: string;
  returnId: string;
  orderItemId?: string;
  productId?: string;
  variantId?: string;
  productName: string;
  quantity: number;
  batchId?: string;
  expiryDate?: string;
  disposition: ItemInspectionDisposition;
  notes?: string;
  inspectedBy: string;
  inspectedAt: string;
}

export interface OrderAuditLog {
  id: string;
  orderId: string;
  orderNumber: string;
  actorId: string;
  actorRole: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  measurementType?: MeasurementType;
  measurementUnit?: MeasurementUnit;
  measurementValue?: number;
  packagingType?: PackagingType;
  weightUnit?: WeightUnit;
  variantId?: string;
  variantName?: string;
  sku?: string;
  mrp?: number;
  sellingPrice?: number;
  price?: number;
  subtotal?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  storeId: string;
  storeName: string;
  addressId: string;
  address: Address;
  deliveryAddress?: Address;
  couponId?: string;
  couponCode?: string;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  deliveryFee?: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  status?: OrderStatus;
  placedAt: string;
  createdAt?: string;
  deliverySlot: string;
  deliveryOtp: string;
  deliveryOtpData?: DeliveryOtpRecord;
  estimatedDeliveryTime?: string;
  partnerId?: string;
  partnerName?: string;
  partnerPhone?: string;
  pickerId?: string;
  pickerName?: string;
  items: OrderItem[];
  statusHistory?: {
    status: OrderStatus;
    timestamp: string;
    note?: string;
  }[];
  deliveryDistanceKm?: number;
  // Financial & COD Collection fields
  collectionMethod?: CollectionMethod;
  collectionStatus?: CollectionStatus;
  settlementStatus?: SettlementStatus;
  expectedCodAmount?: number;
  collectedCodAmount?: number;
  settledCodAmount?: number;
  cashCollectedAt?: string;
  cashCollectedBy?: string;
  upiVerifiedAt?: string;
  upiTransactionId?: string;
  deliveryOtpAttempts?: number;
  deliveryOtpLocked?: boolean;
  deliveryExceptionId?: string;
  isExceptionDelivery?: boolean;
  deliveredAt?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  transactionId: string;
  gateway: string;
  amount: number;
  status: PaymentStatus;
  paidAt: string;
}

export type DeliveryLifecycleStage =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'ARRIVING_AT_STORE'
  | 'ARRIVED_AT_STORE'
  | 'PICKUP_VERIFICATION'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'ARRIVED_AT_CUSTOMER'
  | 'DELIVERY_VERIFICATION'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'DELIVERY_FAILED';

export interface ProofOfDelivery {
  type: 'otp' | 'qr' | 'cash_collected';
  otpEntered?: string;
  cashReceived?: number;
  changeGiven?: number;
  photoUrl?: string;
  signature?: string;
  timestamp: string;
}

export interface DeliveryEarningBreakdown {
  baseFee: number;
  distanceKm: number;
  distanceFee: number;
  peakBonus: number;
  rainBonus: number;
  orderBonus: number;
  totalEarnings: number;
  total?: number; // Backend compatibility field
}

export interface PartnerDocument {
  id: string;
  type: 'aadhaar' | 'pan' | 'driving_license' | 'vehicle_rc' | 'bank_passbook';
  documentNumber: string;
  fileUrl?: string;
  status: 'verified' | 'pending' | 'rejected';
  submittedAt: string;
}

export interface PartnerStatistics {
  deliveriesToday: number;
  deliveriesThisMonth: number;
  acceptanceRate: number;
  completionRate: number;
  onTimeRate: number;
  customerRating: number;
  hoursOnlineToday: number;
}

export interface PartnerPricingRules {
  baseFee: number;
  perKmRate: number;
  peakHoursBonus: number;
  rainSurgeBonus: number;
  extraOrderBonus: number;
}

export interface PartnerAuthToken {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  status: 'valid' | 'used' | 'expired' | 'revoked';
  usedAt?: string;
  deviceSession?: string;
}

export interface DeliveryPartner {
  id: string;
  userId: string;
  name: string;
  phone: string;
  partnerCode?: string;
  /** Admin-issued login credential ID for password-based login */
  loginId?: string;
  /** Admin-issued login password (plaintext, stored in local store) */
  loginPassword?: string;
  accountStatus?: 'active' | 'inactive' | 'suspended';
  profileImage: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  verificationStatus: 'verified' | 'pending' | 'rejected';
  currentStatus: 'online' | 'offline' | 'busy';
  activeDeliveryStage?: DeliveryLifecycleStage;
  activeOrderId?: string;
  rating: number;
  walletBalance: number;
  todayEarnings: number;
  weekEarnings?: number;
  monthEarnings?: number;
  completedDeliveries: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
    lastUpdated: string;
    speed?: number;
  };
  upiId?: string;
  bankAccount?: {
    accountNumber: string;
    ifsc: string;
    bankName: string;
  };
  documents?: PartnerDocument[];
  statistics?: PartnerStatistics;
  activeSessionToken?: string;
  activeDeviceSession?: string;
  /** Unverified cash on delivery collected and currently held by rider */
  cashInHand?: number;
  /** Status of cash collection settlement with Admin */
  cashSettlementStatus?: 'SETTLED' | 'PENDING_VERIFICATION' | 'UNCLEARED';
  /** Timestamp when cash was last settled and verified by DarkStore Admin */
  lastCashSettledAt?: string;
  /** Flag set when Admin remotely logs out or ends rider's shift */
  forceLoggedOutByAdmin?: boolean;
}

export interface Delivery {
  id: string;
  orderId: string;
  partnerId: string;
  pickupTime?: string;
  deliveryTime?: string;
  otp: string;
  pickupOtp?: string;
  status: 'assigned' | 'accepted' | 'picked_up' | 'delivered' | 'failed' | 'rejected';
  stage?: DeliveryLifecycleStage;
  liveLatitude: number;
  liveLongitude: number;
  proofOfDelivery?: ProofOfDelivery;
  earnings?: DeliveryEarningBreakdown;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minimumOrder: number;
  maxDiscount: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  active: boolean;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  orderId: string;
  rating: number;
  review: string;
  createdAt: string;
}

export type RecipientType = 'customer' | 'admin' | 'delivery_partner' | 'picker';

export type NotificationCategory =
  | 'order'
  | 'offer'
  | 'delivery'
  | 'inventory'
  | 'payment'
  | 'system'
  | 'campaign';

export type NotificationEventType =
  // Customer Order Updates
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_ACCEPTED'
  | 'ORDER_PACKED'
  | 'DELIVERY_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERY_NEARBY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'REFUND_INITIATED'
  | 'REFUND_COMPLETED'
  // Customer Offers & Marketing
  | 'OFFER_DISCOUNT'
  | 'COUPON_AVAILABLE'
  | 'FLASH_SALE'
  | 'FESTIVAL_OFFER'
  | 'NEW_PRODUCT'
  | 'CATEGORY_OFFER'
  | 'FREE_DELIVERY'
  | 'WALLET_CASHBACK'
  // Admin Operations & Alerts
  | 'ADMIN_NEW_ORDER'
  | 'ADMIN_ORDER_CANCELLED'
  | 'ADMIN_PAYMENT_FAILED'
  | 'ADMIN_PAYMENT_RECEIVED'
  | 'ADMIN_REFUND_REQUESTED'
  | 'ADMIN_REFUND_COMPLETED'
  | 'ADMIN_LOW_STOCK'
  | 'ADMIN_OUT_OF_STOCK'
  | 'ADMIN_NEW_CUSTOMER'
  | 'ADMIN_PARTNER_OFFLINE'
  | 'ADMIN_DELIVERY_DELAYED'
  | 'ADMIN_CUSTOMER_COMPLAINT'
  | 'ADMIN_NEW_REVIEW'
  | 'ADMIN_SYSTEM_ALERT'
  // Delivery Partner Operational Updates
  | 'PARTNER_NEW_DELIVERY'
  | 'PARTNER_ASSIGNMENT_CANCELLED'
  | 'PARTNER_PICKUP_READY'
  | 'PARTNER_PICKUP_REMINDER'
  | 'PARTNER_CUSTOMER_NEARBY'
  | 'PARTNER_DELIVERY_COMPLETED'
  | 'PARTNER_EARNINGS_CREDITED'
  | 'PARTNER_NEW_SHIFT'
  | 'PARTNER_ADMIN_MESSAGE'
  // Fallbacks / legacy
  | 'order'
  | 'payment'
  | 'delivery'
  | 'offer'
  | 'system';

export interface Notification {
  id: string;
  recipientId: string; // userId, 'admin', partnerId, or 'all'
  recipientType: RecipientType;
  type: NotificationEventType;
  category?: NotificationCategory;
  title: string;
  message: string;
  orderId?: string;
  imageUrl?: string | null;
  deepLink?: string;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
  couponCode?: string;
  offerId?: string;
  meta?: Record<string, any>;
}

export interface NotificationPreferences {
  orderUpdates: boolean;
  deliveryUpdates: boolean;
  offersDiscounts: boolean;
  newProducts: boolean;
  festivalOffers: boolean;
  promotionalMessages: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  soundEnabled: boolean;
}

export interface NotificationCampaign {
  id: string;
  title: string;
  message: string;
  imageUrl?: string;
  offerId?: string;
  couponCode?: string;
  targetAudience: 'all' | 'new_users' | 'returning' | 'selected';
  selectedUserIds?: string[];
  startDate?: string;
  expiryDate?: string;
  deepLink?: string;
  status: 'draft' | 'scheduled' | 'sent';
  sentAt?: string;
  sentCount?: number;
  readCount?: number;
  createdAt: string;
}

export interface FCMDeviceToken {
  id: string;
  userId: string;
  userRole: UserRole;
  fcmToken: string;
  deviceType: 'android' | 'ios' | 'web' | string;
  appVersion: string;
  lastActive: string;
  enabled: boolean;
}

export type BannerPlatform = 'WEB' | 'APP' | 'WEB_AND_APP';
export type BannerStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'EXPIRED';
export type BannerDestinationType = 'PRODUCT' | 'CATEGORY' | 'BRAND' | 'OFFER' | 'CAMPAIGN' | 'URL' | 'NO_ACTION';

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image: string;
  desktopImage?: string;
  mobileImage?: string;
  apkImage?: string;
  bgImage?: string;
  redirectUrl: string;
  active: boolean;
  status?: BannerStatus;
  platform?: BannerPlatform;
  destinationType?: BannerDestinationType;
  destinationId?: string;
  startDate?: string;
  endDate?: string;
  priority?: number;
  tag?: string;
  placement?: 'hero' | 'promo_dual' | 'popup' | 'footer' | 'in_feed';
  buttonText?: string;
  badge?: string;
  bgColor?: string;
  badgeBg?: string;
  displayOrder?: number;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type OfferDiscountType = 'PERCENTAGE' | 'FLAT' | 'BOGO' | 'FREE_PRODUCT' | 'MIN_ORDER_DISCOUNT';

export interface Offer {
  id: string;
  name?: string;
  title: string;
  subtitle?: string;
  description: string;
  discountPercentage?: number;
  discountAmount?: number;
  discountType?: OfferDiscountType;
  productId?: string;
  categoryId?: string;
  brandId?: string;
  minOrderValue?: number;
  maxDiscount?: number;
  buyQuantity?: number;
  getQuantity?: number;
  freeProductId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';
  priority?: number;
  active: boolean;
  bannerImage?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  orderId?: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  description: string;
  storeId?: string;
  orderId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  // Legacy aliases
  userId?: string;
  userName?: string;
  entity?: string;
  entityId?: string;
  createdAt?: string;
}

export interface ServiceRequest {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  latitude: number;
  longitude: number;
  pincode: string;
  city?: string;
  state?: string;
  shopId: string;
  status: 'waiting' | 'notified' | 'converted';
  createdAt: string;
  updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════════
// 🛒 POCKETKIRANA PICKER & WAREHOUSE INVENTORY DATA MODELS
// ═══════════════════════════════════════════════════════════════

export interface InventoryRecord {
  id: string;
  productId: string;
  storeId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  updatedAt: string;
}

export type InventoryMovementType =
  | 'RECEIVE'
  | 'PUTAWAY'
  | 'PICK'
  | 'DAMAGED'
  | 'ADJUSTMENT'
  | 'RETURN';

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  type: InventoryMovementType;
  quantity: number; // positive or negative
  orderId?: string;
  orderNumber?: string;
  pickerId: string;
  pickerName: string;
  fromLocation?: string;
  toLocation?: string;
  reason?: string;
  timestamp: string;
}

export interface PickingItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  upc: string;
  barcode: string;
  unit: string;
  price?: number;
  measurementType?: MeasurementType;
  weightUnit?: WeightUnit;
  imageUrl: string;
  quantityRequired: number;
  quantityPicked: number;
  storageLocation: StorageLocation;
  status: 'pending' | 'picking' | 'picked' | 'out_of_stock' | 'substituted';
  outOfStockReason?: 'Empty shelf' | 'Damaged' | 'Inventory mismatch' | 'Barcode problem' | 'Other' | string;
  substituteProduct?: {
    productId: string;
    productName: string;
    price: number;
    barcode: string;
    acceptedByCustomer?: boolean;
  };
}

export type PickingTaskStatus =
  | 'pending'
  | 'assigned'
  | 'picking'
  | 'picked'
  | 'packing'
  | 'packed'
  | 'handed_over';

export interface PickingTask {
  id: string;
  orderId: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  pickerId?: string;
  pickerName?: string;
  status: PickingTaskStatus;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  items: PickingItem[];
  totalItemsCount: number;
  pickedItemsCount: number;
  startTime?: string;
  endTime?: string;
  pickDurationSeconds?: number;
  bagsCount?: number;
  bagTypes?: string[]; // e.g. ['Grocery Ambient', 'Cold Storage / Fragile']
  handoverQrCode?: string;
  assignedPartnerId?: string;
  assignedPartnerName?: string;
  handoverVerifiedAt?: string;
  createdAt: string;
}

export interface StockAdjustmentRequest {
  id: string;
  productId: string;
  productName: string;
  locationId: string;
  locationCode: string;
  systemQuantity: number;
  physicalQuantity: number;
  difference: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  pickerId: string;
  pickerName: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface NewProductRequest {
  id: string;
  name: string;
  brand: string;
  categoryId: string;
  categoryName?: string;
  barcode: string;
  unit: string;
  suggestedMrp: number;
  suggestedSellingPrice?: number;
  imageUrl?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  pickerId: string;
  pickerName: string;
  submittedAt: string;
}

export interface PickerStatistics {
  ordersPickedToday: number;
  itemsPickedToday: number;
  averagePickTimeSeconds: number; // e.g. 261s (04:21)
  accuracyPercent: number;        // e.g. 99.1%
  missingItemsCount: number;      // e.g. 3
  wrongItemsScanned: number;      // e.g. 1
  rating: number;                 // e.g. 4.9
}

export interface Picker {
  id: string;
  name: string;
  phone: string;
  email?: string;
  photo: string;
  employeeId: string; // e.g. 'PKP-014'
  /** Admin-issued login credential ID for password-based login */
  loginId?: string;
  /** Admin-issued login password (plaintext, stored in local store) */
  loginPassword?: string;
  storeId: string;
  storeName: string;
  status: 'active' | 'offline' | 'busy';
  currentShift: 'Morning (06:00 - 14:00)' | 'Evening (14:00 - 22:00)' | 'Night';
  joiningDate: string;
  activeTaskId?: string;
  statistics: PickerStatistics;
}
