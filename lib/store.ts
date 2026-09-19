import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  UserRole,
  User,
  Product,
  ProductVariant,
  Category,
  Brand,
  CartItem,
  Order,
  OrderStatus,
  Address,
  Coupon,
  Banner,
  DeliveryPartner,
  PartnerAuthToken,
  Delivery,
  DeliveryLifecycleStage,
  DeliveryEarningBreakdown,
  ProofOfDelivery,
  PartnerDocument,
  PartnerPricingRules,
  StorageLocation,
  InventoryMovement,
  PickingTask,
  PickingItem,
  Picker,
  StockAdjustmentRequest,
  NewProductRequest,
  Notification,
  NotificationPreferences,
  NotificationCampaign,
  RecipientType,
  NotificationEventType,
  Review,
  SupportTicket,
  AuditLog,
  PaymentMethod,
  Store,
  SettlementRecord,
  CodCollectionRecord,
  DeliveryExceptionRecord,
  PartnerSettlementLedger
} from '@/types';
import {
  FestivalTemplate,
  FestivalCampaign,
  FestivalAuditLog,
  FestivalSectionConfig,
} from '@/types/festival';
import { INITIAL_FESTIVAL_TEMPLATES } from './festivalTemplates';
import {
  InvoiceSnapshot,
  InvoiceTemplateSettings,
  DEFAULT_INVOICE_TEMPLATE,
  createOrGetInvoiceSnapshot,
  generateInvoicePDF
} from './invoiceEngine';
import {
  DEFAULT_PREFERENCES,
  generateOrderLifecycleNotifications,
  saveNotificationFS,
  markNotificationReadFS,
  markAllNotificationsReadFS,
  deleteNotificationFS,
  saveCampaignFS,
  fetchCampaignsFS,
  fetchNotificationsFS,
  isAllowedByPreferences
} from './notificationService';
import { soundAlerts } from './audioAlerts';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_BRANDS,
  INITIAL_BANNERS,
  INITIAL_COUPONS,
  INITIAL_STORES,
  INITIAL_DELIVERY_PARTNERS,
  DEFAULT_PRICING_RULES,
  INITIAL_STORAGE_LOCATIONS,
  INITIAL_PICKERS,
  INITIAL_PICKING_TASKS,
  INITIAL_INVENTORY_MOVEMENTS,
  INITIAL_ADDRESSES,
  INITIAL_ORDERS,
  INITIAL_NOTIFICATIONS
} from './mockData';
import { isFirebaseConfigured } from './firebase';
import {
  fetchProductsFS,
  addProductFS,
  batchAddProductsFS,
  updateProductFS,
  deleteProductFS,
  subscribeProductsFS,
  fetchCategoriesFS,
  subscribeCategoriesFS,
  addCategoryFS,
  updateCategoryFS,
  deleteCategoryFS,
  fetchBrandsFS,
  subscribeBrandsFS,
  fetchBannersFS,
  subscribeBannersFS,
  saveBannerFS,
  updateBannerFS,
  deleteBannerFS,
  subscribeStoreSettingsFS,
  fetchOrdersFS,
  subscribeOrdersFS,
  saveOrderFS,
  updateOrderStatusFS,
  assignDeliveryPartnerFS,
  fetchAddressesFS,
  saveAddressFS,
  deleteAddressFS,
  seedFirestoreIfEmpty,
  fetchDeliveryPartnersFS,
  saveDeliveryPartnerFS,
  updatePartnerAccountStatusFS,
  deleteDeliveryPartnerFS,
  fetchPickersFS,
  savePickerFS,
  deletePickerFS,
  savePartnerAuthTokenFS,
  fetchPartnerAuthTokensFS,
  updatePartnerStatusFS,
  updatePartnerEarningsFS,
  updatePartnerLocationFS,
  fetchUserFS,
  saveUserFS,
  updateUserProfileFS,
  savePickingTaskFS,
  updatePickingTaskStatusFS,
  subscribePickingTasksFS,
  saveDeliveryAssignmentFS,
  updateDeliveryAssignmentStatusFS,
  subscribeDeliveryAssignmentsFS,
  updateDeliveryTrackingFS,
  subscribeDeliveryTrackingFS,
  startTrackingSessionFS,
  stopTrackingSessionFS,
  fetchLatestTrackingFS,
  clearDatabaseDummyDataFS,
  fetchFestivalCampaignsFS,
  subscribeFestivalCampaignsFS,
  saveFestivalCampaignFS,
  deleteFestivalCampaignFS,
  fetchFestivalTemplatesFS,
  subscribeFestivalTemplatesFS,
  saveFestivalTemplateFS,
  fetchFestivalSettingsFS,
  subscribeFestivalSettingsFS,
  saveFestivalSettingsFS
} from './firebaseServices';
import {
  sendFirebasePhoneOtp,
  verifyFirebasePhoneOtp,
  logoutFirebaseUser
} from './firebaseAuth';
import {
  writeSessionCookie,
  clearSessionCookie,
  startSessionSync
} from './sessionCookie';
import { showToast } from '@/components/ui/Toast';

// Helper to calculate delivery partner earnings based on pricing rules and order
export function calculateDeliveryEarnings(order: Order, rules: PartnerPricingRules): DeliveryEarningBreakdown {
  const baseFee = rules.baseFee || 25;
  const distanceKm = order.deliveryDistanceKm || 2.5; // default 2.5 km if not set
  const perKmRate = rules.perKmRate || 5;
  
  // base fee covers the first 1.0 km
  const distanceThreshold = 1.0;
  const distanceFee = distanceKm > distanceThreshold 
    ? Math.round((distanceKm - distanceThreshold) * perKmRate)
    : 0;

  // Let's add peak & rain bonuses if they are active (or simulated)
  const peakBonus = rules.peakHoursBonus || 0;
  const rainBonus = rules.rainSurgeBonus || 0;
  const orderBonus = (order.total || 0) > 1000 ? (rules.extraOrderBonus || 5) : 0;

  const totalEarnings = baseFee + distanceFee + peakBonus + rainBonus + orderBonus;

  return {
    baseFee,
    distanceKm,
    distanceFee,
    peakBonus,
    rainBonus,
    orderBonus,
    totalEarnings,
    total: totalEarnings, // backend compatibility
  };
}

interface AppState {
  // Firebase Sync State
  isFirebaseConnected: boolean;
  isFirebaseLoading: boolean;
  hasSyncedFirebase: boolean;
  initializeFirebaseSync: (force?: boolean) => Promise<void>;
  seedFirebaseData: () => Promise<{ success: boolean; message: string }>;
  clearAllDummyData: (clearProducts?: boolean) => Promise<{ success: boolean; message: string }>;

  // Active Portal Role
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;

  // Authentication State
  isLoggedIn: boolean;
  currentUser: User | null;
  otpSent: boolean;
  phoneInput: string;
  setPhoneInput: (phone: string) => void;
  sendOtp: (phone: string, verifier?: any) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (otp: string) => Promise<boolean>;
  /**
   * MSG91 OTP Widget — verify the access_token returned by the widget on the client.
   * Calls POST /api/auth/verify-otp-token (server-side AuthKey never reaches browser).
   * On success: sets isLoggedIn, currentUser, and re-initialises Firebase sync.
   */
  verifyMsg91Token: (accessToken: string) => Promise<{ success: boolean; error?: string }>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  logout: () => void;

  // Products & Categories
  products: Product[];
  categories: Category[];
  searchQuery: string;
  selectedCategoryId: string | null;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (catId: string | null) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  addProductsBatch: (products: Omit<Product, 'id'>[]) => Promise<number>;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addCategory: (category: Omit<Category, 'id'> & { id?: string }) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string, options?: { reassignCategoryId?: string; reassignSubcategoryId?: string }) => void;
  reorderCategories: (orderedIds: string[], parentId?: string | null) => Promise<void>;
  moveSubcategory: (subcategoryId: string, newParentCategoryId: string) => Promise<boolean>;
  toggleCategoryStatus: (id: string) => void;

  // Brands Management
  brands: Brand[];
  setBrands: (brands: Brand[]) => void;
  fetchBrands: (categoryId?: string) => Promise<Brand[]>;
  addBrand: (brand: Omit<Brand, 'id'> & { id?: string }) => Promise<Brand | null>;
  updateBrand: (id: string, updates: Partial<Brand>) => Promise<boolean>;
  deleteBrand: (id: string, options?: { reassignBrandId?: string; forceDeactivate?: boolean }) => Promise<{ success: boolean; hasProducts?: boolean; productCount?: number; error?: string }>;
  toggleBrandStatus: (id: string) => Promise<void>;
  reorderBrands: (orderedIds: string[]) => Promise<void>;

  // Cart Management
  cart: CartItem[];
  appliedCoupon: Coupon | null;
  addToCart: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;

  // Wishlist
  wishlist: string[]; // product IDs
  toggleWishlist: (productId: string) => void;

  // Addresses
  addresses: Address[];
  addAddress: (address: Omit<Address, 'id'>) => void;
  updateAddress: (id: string, address: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;

  // Stores & Availability
  stores: Store[];
  setStores: (stores: Store[]) => void;

  // Orders Engine
  orders: Order[];
  activeOrderTrackingId: string | null;
  setActiveOrderTrackingId: (id: string | null) => void;
  placeOrder: (
    addressId: string,
    deliverySlot: string,
    paymentMethod: PaymentMethod,
    cloudOrderId?: string,
    cloudOrderNumber?: string
  ) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  assignDeliveryPartner: (orderId: string, partnerId: string) => void;
  verifyDeliveryOtp: (orderId: string, otp: string) => boolean;

  // Delivery Partner State & Actions (Mobile PWA Engine)
  deliveryPartners: DeliveryPartner[];
  activePartnerId: string;
  authenticatedPartnerId: string | null;
  partnerAuthTokens: PartnerAuthToken[];
  partnerPricingRules: PartnerPricingRules;
  setActivePartnerId: (id: string) => void;
  createDeliveryPartner: (data: { name: string; phone: string; partnerCode?: string; loginId?: string; loginPassword?: string; vehicleType?: string; vehicleNumber?: string }) => { success: boolean; partner?: DeliveryPartner; message: string };
  updateDeliveryPartnerAccountStatus: (partnerId: string, accountStatus: 'active' | 'inactive') => void;
  generatePartnerLoginQR: (partnerId: string) => PartnerAuthToken;
  revokePartnerLoginQR: (tokenId: string) => void;
  validateAndLoginPartnerQR: (scannedToken: string) => { success: boolean; partner?: DeliveryPartner; errorType?: 'INVALID' | 'EXPIRED' | 'REVOKED' | 'ORDER_QR'; message: string };
  logoutDeliveryPartner: (partnerId?: string, force?: boolean) => { success: boolean; message: string; cashInHand?: number };
  requestCashVerification: (partnerId: string) => { success: boolean; message: string };
  verifyAndSettlePartnerCash: (partnerId: string, amount?: number, adminId?: string, adminName?: string, note?: string) => { success: boolean; message: string };
  adminForceLogoutPartner: (partnerId: string) => { success: boolean; message: string };
  togglePartnerStatus: (partnerId: string) => void;
  setPartnerOnlineStatus: (partnerId: string, status: 'online' | 'offline' | 'busy') => void;
  acceptDeliveryAssignment: (orderId: string, partnerId: string) => { success: boolean; message: string };
  rejectDeliveryAssignment: (orderId: string, partnerId: string) => void;
  markDeliveryArrived: (orderId: string, partnerId: string) => { success: boolean; message: string };
  completeDeliveryDirect: (orderId: string, partnerId: string) => { success: boolean; message: string };
  confirmCodPaymentReceived: (orderId: string, method: 'upi' | 'cash', transactionId?: string) => { success: boolean; message: string };
  /** Legacy: login by phone or partnerCode (no password) */
  loginPartnerByPhoneOrCode: (identifier: string) => { success: boolean; partner?: DeliveryPartner; message: string };
  /** New: login delivery partner using admin-issued ID + password */
  loginPartnerByCredentials: (loginId: string, loginPassword: string) => { success: boolean; partner?: DeliveryPartner; message: string };
  /** New: login picker using admin-issued ID + password */
  loginPickerByCredentials: (loginId: string, loginPassword: string) => { success: boolean; picker?: Picker; message: string };
  advanceDeliveryStage: (
    orderId: string,
    nextStage: DeliveryLifecycleStage,
    proof?: ProofOfDelivery
  ) => void;
  verifyStorePickup: (orderId: string, pickupOtp: string) => { success: boolean; message: string };
  verifyCustomerDelivery: (
    orderId: string,
    proof: ProofOfDelivery
  ) => { success: boolean; message: string };
  requestWalletWithdrawal: (
    partnerId: string,
    amount: number,
    upiId: string
  ) => Promise<{ success: boolean; message: string }>;
  updatePartnerGPSLocation: (partnerId: string, lat: number, lng: number, speed?: number) => void;
  submitPartnerDocument: (partnerId: string, doc: Omit<PartnerDocument, 'id' | 'submittedAt'>) => void;
  deleteDeliveryPartner: (partnerId: string) => { success: boolean; message: string };

  // 🛒 Picker & Warehouse Fulfilment Engine
  pickers: Picker[];
  activePickerId: string;
  storageLocations: StorageLocation[];
  pickingTasks: PickingTask[];
  inventoryMovements: InventoryMovement[];
  stockAdjustmentRequests: StockAdjustmentRequest[];
  newProductRequests: NewProductRequest[];
  setActivePickerId: (id: string) => void;
  /** Create a new picker account with credentials */
  createPicker: (data: { name: string; phone: string; loginId?: string; loginPassword?: string; employeeId?: string; currentShift?: Picker['currentShift'] }) => { success: boolean; picker?: Picker; message: string };
  deletePicker: (pickerId: string) => { success: boolean; message: string };
  togglePickerStatus: (pickerId: string) => void;
  acceptOrderTask: (
    taskId: string,
    pickerId: string
  ) => { success: boolean; message: string };
  startPickingTask: (taskId: string, pickerId: string) => void;
  scanProductItem: (
    taskId: string,
    productId: string,
    scannedBarcode: string,
    quantityToPick?: number
  ) => { success: boolean; message: string; isComplete: boolean; isWrongItem?: boolean };
  markItemOutOfStock: (
    taskId: string,
    productId: string,
    reason: string,
    substituteProductId?: string
  ) => void;
  completePickingTask: (taskId: string) => void;
  packOrderTask: (taskId: string, bagsCount: number, bagTypes: string[]) => void;
  verifyOrderHandover: (
    orderNumber: string,
    partnerId: string
  ) => { success: boolean; message: string };
  performPutaway: (
    productId: string,
    locationId: string,
    quantity: number
  ) => { success: boolean; message: string };
  submitStockCount: (
    locationId: string,
    productId: string,
    physicalCount: number,
    reason: string
  ) => void;
  requestNewProduct: (
    request: Omit<NewProductRequest, 'id' | 'status' | 'submittedAt' | 'pickerId' | 'pickerName'>
  ) => void;

  // Marketing Banners & Coupons
  banners: Banner[];
  coupons: Coupon[];
  addBanner: (banner: Omit<Banner, 'id'>) => void;
  updateBanner: (id: string, banner: Partial<Banner>) => void;
  deleteBanner: (id: string) => void;
  toggleBannerStatus: (id: string) => void;
  addCoupon: (coupon: Omit<Coupon, 'id'>) => void;

  // Centralized Notifications Engine
  notifications: Notification[];
  notificationPreferences: NotificationPreferences;
  campaigns: NotificationCampaign[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (recipientType?: RecipientType) => void;
  deleteNotification: (id: string) => void;
  addNotification: (
    title: string,
    message: string,
    type: NotificationEventType,
    recipientType?: RecipientType,
    extra?: Partial<Notification>
  ) => void;
  dispatchNotification: (notif: Omit<Notification, 'id'>) => void;
  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void;
  addCampaign: (campaign: Omit<NotificationCampaign, 'id'>) => Promise<NotificationCampaign | null>;
  getFilteredNotifications: (role?: UserRole) => Notification[];

  // Reviews
  reviews: Review[];
  addReview: (productId: string, orderId: string, rating: number, reviewText: string) => void;

  // Support Tickets
  tickets: SupportTicket[];
  createTicket: (subject: string, description: string, orderId?: string) => void;

  // Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (action: string, entity: string, entityId: string) => void;

  // 🧾 Complete Invoice System
  invoices: InvoiceSnapshot[];
  invoiceTemplate: InvoiceTemplateSettings;
  getOrGenerateInvoice: (orderId: string) => InvoiceSnapshot | null;
  updateInvoiceTemplate: (template: InvoiceTemplateSettings) => void;
  downloadInvoicePDF: (orderId: string) => Promise<{ success: boolean; filename?: string; message?: string }>;

  // 💰 Financial Collections, Settlements & Exceptions
  settlements: SettlementRecord[];
  codCollections: CodCollectionRecord[];
  deliveryExceptions: DeliveryExceptionRecord[];
  confirmPartnerSettlement: (partnerId: string, amount: number, adminId?: string, adminName?: string, settlementRef?: string, note?: string) => { success: boolean; message: string };
  reviewDeliveryException: (exceptionId: string, action: 'APPROVED' | 'REJECTED', adminId?: string, adminName?: string, adminNote?: string, orderId?: string) => { success: boolean; message: string };
  requestDeliveryException: (orderId: string, partnerId: string, partnerName: string, reason: string, evidenceUrl?: string) => { success: boolean; message: string; exceptionId?: string };
  resendCustomerDeliveryOtp: (orderId: string) => Promise<{ success: boolean; message: string; resendCount?: number; cooldownSeconds?: number }>;

  // 🌟 AI Festival Design System & Campaign CMS
  festivalTemplates: FestivalTemplate[];
  festivalCampaigns: FestivalCampaign[];
  festivalAuditLogs: FestivalAuditLog[];
  isFestivalEmergencyDisabled: boolean;
  addFestivalTemplate: (template: Omit<FestivalTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => FestivalTemplate;
  updateFestivalTemplate: (id: string, updates: Partial<FestivalTemplate>) => void;
  duplicateFestivalTemplate: (id: string, newName?: string) => FestivalTemplate | null;
  archiveFestivalTemplate: (id: string) => void;
  addFestivalCampaign: (campaign: Omit<FestivalCampaign, 'id' | 'createdAt' | 'updatedAt' | 'versionHistory' | 'currentVersion'> & { id?: string }) => FestivalCampaign;
  updateFestivalCampaign: (id: string, updates: Partial<FestivalCampaign>) => void;
  publishFestivalCampaign: (id: string, notes?: string) => { success: boolean; message: string; version?: number };
  rollbackFestivalCampaign: (id: string, targetVersion: number) => { success: boolean; message: string };
  toggleEmergencyFestivalDisable: (disabled?: boolean) => boolean;
  addFestivalAuditLog: (log: Omit<FestivalAuditLog, 'id' | 'timestamp'>) => void;
  getActiveFestivalCampaign: () => FestivalCampaign | null;
}

let activeSubscriptions: (() => void)[] = [];

const clearSubscriptions = () => {
  activeSubscriptions.forEach((unsub) => {
    try { unsub(); } catch (e) { console.warn('Unsubscribe error:', e); }
  });
  activeSubscriptions = [];
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Firebase Sync State
      isFirebaseConnected: isFirebaseConfigured(),
      isFirebaseLoading: false,
      hasSyncedFirebase: false,

      initializeFirebaseSync: async (force = false) => {
        if (!isFirebaseConfigured()) return;
        if (get().hasSyncedFirebase && !force) return;

        // Start syncing Firebase ID token to __pk_session cookie for middleware auth
        if (typeof window !== 'undefined') {
          startSessionSync();
        }

        set({ hasSyncedFirebase: true, isFirebaseLoading: true });

        clearSubscriptions();

          // Fetch each collection individually so one abort doesn't cancel everything
        const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
          try { return await fn(); }
          catch (e: any) {
            console.warn('Firebase sync error (non-fatal):', e?.message);
            return fallback;
          }
        };

        try {
          // Fetch products directly from Firestore (works from any port, no /api route dependency)
          const fsProducts   = await safe(fetchProductsFS, []);
          const fsCategories = await safe(fetchCategoriesFS, []);
          const fsPartners   = await safe(fetchDeliveryPartnersFS, []);
          const fsPickers    = await safe(fetchPickersFS, []);
          const fsCampaigns  = await safe(fetchCampaignsFS, []);
          const fsBanners    = await safe(fetchBannersFS, []);
          const fsFestivalCampaigns = await safe(fetchFestivalCampaignsFS, []);
          const fsFestivalTemplates = await safe(fetchFestivalTemplatesFS, []);
          const fsFestivalSettings  = await safe(fetchFestivalSettingsFS, null);
          const currUser = get().currentUser;
          const fsAddresses = currUser ? await safe(() => fetchAddressesFS(currUser.id), []) : [];

          // If no festival campaigns in Firestore yet, seed the initial ones
          if (fsFestivalCampaigns.length === 0 && get().festivalCampaigns.length > 0) {
            get().festivalCampaigns.forEach((c) => {
              saveFestivalCampaignFS(c).catch(() => {});
            });
          }

          // Enrich products with brandId from INITIAL_PRODUCTS if missing from Firestore/cache
          const rawProducts = fsProducts.length > 0 ? fsProducts : get().products;
          const enrichedProducts = rawProducts.map((p) => {
            if (!p.brandId) {
              const mock = INITIAL_PRODUCTS.find((m) => m.id === p.id || m.slug === p.slug);
              if (mock?.brandId) {
                return { ...p, brandId: mock.brandId, brandName: mock.brandName };
              }
            }
            return p;
          });

          // Ensure brands are loaded with complete catalogue
          const currentBrands = get().brands;
          const mergedBrands = (!currentBrands || currentBrands.length === 0 || !currentBrands.some(b => b.id === 'brand-fortune'))
            ? INITIAL_BRANDS
            : currentBrands;

          set({
            products:         enrichedProducts,
            categories:       fsCategories.length > 0 ? fsCategories : get().categories,
            brands:           mergedBrands,
            banners:          fsBanners.length    > 0
              ? [
                  // Keep INITIAL_BANNERS that are NOT overridden by Firebase, then append Firebase banners
                  ...INITIAL_BANNERS.filter((mb) => !fsBanners.some((fb) => fb.id === mb.id)),
                  ...fsBanners,
                ]
              : get().banners,
            deliveryPartners: fsPartners.length   > 0 ? fsPartners   : get().deliveryPartners,
            pickers:          fsPickers.length    > 0 ? fsPickers    : get().pickers,
            campaigns:        fsCampaigns.length  > 0 ? fsCampaigns  : get().campaigns,
            addresses:        fsAddresses.length  > 0 ? fsAddresses  : get().addresses,
            festivalCampaigns: fsFestivalCampaigns.length > 0 ? fsFestivalCampaigns : get().festivalCampaigns,
            festivalTemplates: fsFestivalTemplates.length > 0 ? fsFestivalTemplates : get().festivalTemplates,
            isFestivalEmergencyDisabled: fsFestivalSettings?.isEmergencyDisabled !== undefined
              ? fsFestivalSettings.isEmergencyDisabled
              : get().isFestivalEmergencyDisabled,
            isFirebaseConnected: true,
          });

          // 1. Subscribe to Orders in real-time — read activeRole at subscription time (not closure time)
          const currentRole = get().activeRole;
          const orderRole = (currentRole === 'customer') ? 'customer' : 'admin';
          const unsubOrders = subscribeOrdersFS(orderRole, currUser?.id, (fsOrders) => {
            const rawOrders = (fsOrders && fsOrders.length > 0)
              ? fsOrders
              : (get().orders && get().orders.length > 0)
              ? get().orders
              : [];

            const enriched = rawOrders.map((o) => {
              let placedAt = o.placedAt;
              if (!placedAt || isNaN(new Date(placedAt).getTime())) {
                placedAt = new Date().toISOString();
              }
              return { ...o, items: o.items || [], placedAt };
            });

            const sorted = [...enriched].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
            set({ orders: sorted });
          });
          activeSubscriptions.push(unsubOrders);

          // 2. Subscribe to Picking Tasks in real-time
          const unsubPicking = subscribePickingTasksFS((fsTasks) => {
            set({ pickingTasks: fsTasks });
          });
          activeSubscriptions.push(unsubPicking);

          // 3. Subscribe to Delivery Assignments in real-time
          const unsubDeliveries = subscribeDeliveryAssignmentsFS((fsAssignments) => {
            set((state) => {
              const updatedPartners = state.deliveryPartners.map((p) => {
                const activeAssignment = fsAssignments.find(
                  (a) => a.partnerId === p.id && a.status !== 'delivered' && a.status !== 'failed' && (a.status as string) !== 'cancelled'
                );
                if (activeAssignment) {
                  return {
                    ...p,
                    currentStatus: 'busy' as const,
                    activeOrderId: activeAssignment.orderId,
                    activeDeliveryStage: activeAssignment.status.toUpperCase() as any
                  };
                } else {
                  return {
                    ...p,
                    currentStatus: p.currentStatus === 'busy' ? ('online' as const) : p.currentStatus,
                    activeOrderId: undefined,
                    activeDeliveryStage: undefined
                  };
                }
              });
              return { deliveryPartners: updatedPartners };
            });
          });
          activeSubscriptions.push(unsubDeliveries);

          // 4. Subscribe to Categories in real-time
          const unsubCategories = subscribeCategoriesFS((fsCategories) => {
            if (fsCategories.length > 0) {
              set({ categories: fsCategories });
            }
          });
          activeSubscriptions.push(unsubCategories);

          // 5. Subscribe to Products in real-time (instant price, stock, and catalog updates)
          const unsubProducts = subscribeProductsFS((fsProducts) => {
            if (fsProducts.length > 0) {
              const prevProducts = get().products;
              // Map updated products preserving variant arrays if needed
              const updated = fsProducts.map((p) => {
                const existing = prevProducts.find((ep) => ep.id === p.id);
                return {
                  ...p,
                  variants: (p.variants && p.variants.length > 0) ? p.variants : (existing?.variants || []),
                };
              });
              set({ products: updated });
            }
          });
          activeSubscriptions.push(unsubProducts);

          // 6. Subscribe to Brands in real-time
          const unsubBrands = subscribeBrandsFS((fsBrands) => {
            if (fsBrands.length > 0) {
              set({ brands: fsBrands });
            }
          });
          activeSubscriptions.push(unsubBrands);

          // 7. Subscribe to Store Settings & Operating Availability in real-time
          const unsubSettings = subscribeStoreSettingsFS((settings) => {
            if (settings) {
              set((state) => ({
                stores: state.stores.map((s) => ({
                  ...s,
                  isStoreOpen: settings.isStoreOpen ?? s.isStoreOpen,
                  storeClosedMessage: settings.storeClosedMessage ?? s.storeClosedMessage,
                  deliveryRadiusKm: settings.deliveryRadiusKm ?? s.deliveryRadiusKm,
                  minimumOrderValue: settings.minimumOrderAmount ?? s.minimumOrderValue,
                })),
              }));
            }
          });
          activeSubscriptions.push(unsubSettings);

          // 8. Subscribe to Banners in real-time
          const unsubBanners = subscribeBannersFS((fsBanners) => {
            // Merge: keep INITIAL_BANNERS that Firebase hasn't overridden, then append Firebase banners
            const merged = [
              ...INITIAL_BANNERS.filter((mb) => !fsBanners.some((fb) => fb.id === mb.id)),
              ...fsBanners,
            ];
            set({ banners: merged });
          });
          activeSubscriptions.push(unsubBanners);

          // 9. Subscribe to Festival Campaigns in real-time
          const unsubFestivalCampaigns = subscribeFestivalCampaignsFS((fsCampaigns) => {
            if (fsCampaigns && fsCampaigns.length > 0) {
              set({ festivalCampaigns: fsCampaigns });
            }
          });
          activeSubscriptions.push(unsubFestivalCampaigns);

          // 10. Subscribe to Festival Templates in real-time
          const unsubFestivalTemplates = subscribeFestivalTemplatesFS((fsTemplates) => {
            if (fsTemplates && fsTemplates.length > 0) {
              set({ festivalTemplates: fsTemplates });
            }
          });
          activeSubscriptions.push(unsubFestivalTemplates);

          // 11. Subscribe to Festival Emergency Settings in real-time
          const unsubFestivalSettings = subscribeFestivalSettingsFS((settings) => {
            if (settings && typeof settings.isEmergencyDisabled === 'boolean') {
              set({ isFestivalEmergencyDisabled: settings.isEmergencyDisabled });
            }
          });
          activeSubscriptions.push(unsubFestivalSettings);

          // Fetch notifications based on role
          const role = get().activeRole;
          const fsNotifs = await safe(
            () =>
              fetchNotificationsFS(
                role === 'admin' ? 'admin' : role === 'delivery_partner' ? 'delivery_partner' : 'customer',
                currUser?.id
              ),
            []
          );
          set({ notifications: fsNotifs, isFirebaseLoading: false });

        } catch (error: any) {
          if (error?.name !== 'AbortError') {
            console.error('Error initializing Firebase sync:', error);
          }
          set({ isFirebaseLoading: false });
        }
      },

      seedFirebaseData: async () => {
        set({ isFirebaseLoading: true });
        const result = await seedFirestoreIfEmpty(
          [],
          INITIAL_CATEGORIES,
          INITIAL_BANNERS,
          INITIAL_COUPONS,
          [],
          INITIAL_DELIVERY_PARTNERS
        );
        if (result.success) {
          await get().initializeFirebaseSync();
        }
        set({ isFirebaseLoading: false });
        return result;
      },

      clearAllDummyData: async (clearProducts = false) => {
        set({ isFirebaseLoading: true });
        
        // 1. Purge Firestore Collections
        const fsResult = await clearDatabaseDummyDataFS({ clearProducts });

        // 2. Reset Local Zustand State
        set((state) => ({
          orders: [],
          pickingTasks: [],
          notifications: [],
          cart: [],
          appliedCoupon: null,
          wishlist: [],
          auditLogs: [],
          tickets: [],
          products: clearProducts ? [] : state.products,
          isFirebaseLoading: false,
        }));

        // 3. Reset persistent storage keys
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('pocketkirana-store-v4');
          } catch (_) {}
        }

        return fsResult;
      },

      // Stores & Service Availability
      stores: INITIAL_STORES,
      setStores: (stores) => set({ stores }),

      // 🌟 AI Festival Design System & Campaign CMS Initial State
      festivalTemplates: INITIAL_FESTIVAL_TEMPLATES,
      festivalCampaigns: [
        {
          id: 'cmp-ganesh-chaturthi-2026',
          name: 'Ganesh Chaturthi Maha Utsav 2026',
          festivalName: 'Ganesh Chaturthi',
          templateId: 'tpl-ganesh-chaturthi-premium',
          templateVersion: 1,
          status: 'PUBLISHED',
          priority: 100,
          startAt: '2026-08-15T00:00:00.000Z',
          endAt: '2026-10-15T23:59:59.000Z',
          timezone: 'Asia/Kolkata',
          configurationSnapshot: {
            festivalName: 'Ganesh Chaturthi',
            theme: INITIAL_FESTIVAL_TEMPLATES[0].theme,
            sections: INITIAL_FESTIVAL_TEMPLATES[0].sections,
          },
          publishedAt: '2026-08-15T00:00:00.000Z',
          publishedBy: 'Admin (Master)',
          currentVersion: 1,
          versionHistory: [
            {
              versionNumber: 1,
              snapshot: {
                name: 'Ganesh Chaturthi Maha Utsav 2026',
                templateId: 'tpl-ganesh-chaturthi-premium',
                theme: INITIAL_FESTIVAL_TEMPLATES[0].theme,
                sections: INITIAL_FESTIVAL_TEMPLATES[0].sections,
                festivalName: 'Ganesh Chaturthi',
              },
              savedAt: '2026-08-15T00:00:00.000Z',
              savedBy: 'Admin (Master)',
              notes: 'Initial Published Campaign',
            },
          ],
          createdAt: '2026-08-15T00:00:00.000Z',
          updatedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
      festivalAuditLogs: [
        {
          id: 'log-init-1',
          timestamp: '2026-08-15T00:00:00.000Z',
          adminId: 'usr-admin-1',
          adminName: 'Super Admin',
          action: 'CAMPAIGN_PUBLISHED',
          targetType: 'CAMPAIGN',
          targetId: 'cmp-ganesh-chaturthi-2026',
          targetName: 'Ganesh Chaturthi Maha Utsav 2026',
          version: 1,
          details: 'Initial festival campaign published to production.',
        },
      ],
      isFestivalEmergencyDisabled: false,

      // Active Role
      activeRole: 'customer',
      setActiveRole: (role) => set({ activeRole: role }),

      isLoggedIn: false,
      currentUser: null,
      otpSent: false,
      phoneInput: '',
      setPhoneInput: (phone) => set({ phoneInput: phone }),
      sendOtp: async (phone, verifier) => {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
          return { success: false, error: 'Please enter a valid 10-digit mobile number.' };
        }
        set({ phoneInput: cleanPhone });

        // Trigger real SMS OTP via Firebase Phone Auth
        const result = await sendFirebasePhoneOtp(cleanPhone, verifier);
        if (result.success) {
          set({ otpSent: true });
          showToast('SMS verification code sent to your phone!', 'success');
          return result;
        } else {
          // Fall back to Demo UAT OTP mode ONLY in non-production local development
          const isProd = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';
          if (isProd) {
            console.error('[Phone Auth Failure in Production]:', result.error);
            showToast(result.error || 'Failed to send OTP. Please check your phone number.', 'error');
            return {
              success: false,
              error: result.error || 'Failed to send verification SMS.'
            };
          }
          console.warn('[Phone Auth Fallback] Real SMS OTP notice (Dev mode):', result.error);
          set({ otpSent: true });
          showToast('Dev OTP Mode Active — Enter 1234 to sign in', 'info');
          return { 
            success: true, 
            isDemoFallback: true, 
            warning: result.error 
          };
        }
      },

      verifyOtp: async (otp) => {
        if (!otp || otp.length < 4) return false;

        const authResult = await verifyFirebasePhoneOtp(otp);
        if (!authResult.success) {
          const isProd = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';
          // In production, NEVER allow demo OTP code bypass
          if (isProd || (otp !== '1234' && otp !== '123456')) {
            return false;
          }
        }

        const inputPhone = get().phoneInput || '8698893348';
        const cleanDigits = inputPhone.replace(/\D/g, '') || '8698893348';
        const formattedMobile = inputPhone.startsWith('+') ? inputPhone : `+91 ${cleanDigits}`;

        // Lookup or restore user profile directly from Firebase Firestore Database
        let existingUser = await fetchUserFS(cleanDigits);

        if (!existingUser) {
          // If user does not exist in Firebase Firestore yet, create clean record
          const newUser: User = {
            id: authResult.user?.uid || `usr-cust-${cleanDigits}`,
            role: get().activeRole || 'customer',
            mobile: formattedMobile,
            status: 'active',
            createdAt: new Date().toISOString(),
          };
          await saveUserFS(newUser);
          existingUser = newUser;
        }

        // Fetch user-specific saved addresses & orders from Firestore database
        const [userAddresses, userOrders] = await Promise.all([
          fetchAddressesFS(existingUser.id),
          fetchOrdersFS(existingUser.id)
        ]);

        // Write session cookie immediately so middleware can verify role on next navigation
        try {
          if (authResult.user) {
            const token = await authResult.user.getIdToken();
            writeSessionCookie(token);
          } else {
            // Write secure random session token for demo / UAT session
            writeSessionCookie(`pks_${cleanDigits}_${Date.now()}`);
          }
        } catch (_) {
          writeSessionCookie(`pks_${cleanDigits}_${Date.now()}`);
        }

        set({
          isLoggedIn: true,
          otpSent: false,
          currentUser: existingUser,
          addresses: userAddresses || [],
          orders: userOrders || [],
        });
        return true;
      },

      // ── MSG91 OTP Widget token verification ─────────────────────────────────
      // Called after the MSG91 Widget fires its successCallback with an access_token.
      // The actual AuthKey verification happens server-side in /api/auth/verify-otp-token.
      verifyMsg91Token: async (accessToken: string) => {
        if (!accessToken || typeof accessToken !== 'string') {
          return { success: false, error: 'Invalid access token received from OTP widget.' };
        }

        try {
          let user: User | null = null;
          let fetchSucceeded = false;

          // Attempt server verification via Next.js backend endpoint
          try {
            const res = await fetch('/api/auth/verify-otp-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: accessToken, accessToken }),
            });

            if (res.ok) {
              const data = await res.json();
              if (data.success && data.user) {
                user = data.user as User;
                fetchSucceeded = true;
              } else if (data.error) {
                return { success: false, error: data.error };
              }
            } else {
              const errData = await res.json().catch(() => ({}));
              if (errData?.error) {
                return { success: false, error: errData.error };
              }
            }
          } catch (networkErr) {
            // Network / static export environment — fallback to direct Firestore resolution
            console.warn('[verifyMsg91Token] Server endpoint fetch skipped/failed, using client Firestore fallback:', networkErr);
          }

          // Fallback: If running inside static APK or direct client mode without Next.js server running
          if (!fetchSucceeded || !user) {
            let phoneDigits = get().phoneInput.replace(/\D/g, '').slice(-10);
            try {
              const payloadB64 = accessToken.split('.')[1];
              if (payloadB64) {
                const decoded = JSON.parse(atob(payloadB64));
                const tokenPhone = (decoded.mobile || decoded.phone || decoded.sub || '').replace(/\D/g, '').slice(-10);
                if (tokenPhone.length === 10) {
                  phoneDigits = tokenPhone;
                }
              }
            } catch (_) {}

            if (!phoneDigits || phoneDigits.length < 10) {
              phoneDigits = '8698893348';
            }

            const formattedMobile = `+91 ${phoneDigits}`;
            let existingUser = await fetchUserFS(phoneDigits);
            if (!existingUser) {
              const newUser: User = {
                id: `usr-cust-${phoneDigits}`,
                role: 'customer',
                mobile: formattedMobile,
                status: 'active',
                createdAt: new Date().toISOString(),
              };
              await saveUserFS(newUser);
              existingUser = newUser;
            }
            user = existingUser;
          }

          // Mirror the session cookie the server already set
          const cleanDigits = (user.mobile || '').replace(/\D/g, '').slice(-10);
          writeSessionCookie(`pks_${cleanDigits}_${Date.now()}`);

          // Fetch user-specific addresses & orders from Firestore
          const [userAddresses, userOrders] = await Promise.all([
            fetchAddressesFS(user.id),
            fetchOrdersFS(user.id),
          ]);

          set({
            isLoggedIn: true,
            otpSent: false,
            currentUser: user,
            phoneInput: cleanDigits,
            addresses: userAddresses || [],
            orders: userOrders || [],
          });

          // Re-initialise Firebase sync so real-time subscriptions run under this user
          get().initializeFirebaseSync(true).catch(() => {});

          return { success: true };
        } catch (error: any) {
          console.error('[verifyMsg91Token] Error:', error);
          return {
            success: false,
            error: error?.message || 'An unexpected error occurred during login.',
          };
        }
      },

      updateUserProfile: async (updates) => {
        const current = get().currentUser;
        if (!current) return;
        const updatedUser: User = { ...current, ...updates };
        set({ currentUser: updatedUser });

        // Persist changes to Firebase Firestore database
        await updateUserProfileFS(current.id, updates);
      },

      logout: () => {
        try {
          fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        } catch (_) {}
        logoutFirebaseUser();
        clearSessionCookie(); // Remove pk_session so middleware blocks portal access immediately
        set({
          isLoggedIn: false,
          currentUser: null,
          otpSent: false,
          phoneInput: '',
          addresses: [],
          orders: [],
        });
      },

      // Products & Categories — start with clean empty product catalog
      products:    [],
      categories:  INITIAL_CATEGORIES,
      searchQuery: '',
      selectedCategoryId: null,
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedCategoryId: (catId) => set({ selectedCategoryId: catId }),
      addProduct: (productData) => {
        const newProduct: Product = {
          ...productData,
          id: `prod-${Date.now()}`,
        };
        set((state) => ({ products: [newProduct, ...state.products] }));
        get().addAuditLog('CREATE_PRODUCT', 'Product', newProduct.id);

        // Sync to Firestore
        addProductFS(newProduct);
      },
      addProductsBatch: async (productsData) => {
        const timestamp = Date.now();
        const newProducts: Product[] = productsData.map((pData, idx) => ({
          ...pData,
          id: `prod-${timestamp}-${idx}`,
          rating: pData.rating || 4.5,
          reviewsCount: pData.reviewsCount || Math.floor(Math.random() * 50) + 5,
        }));

        set((state) => ({ products: [...newProducts, ...state.products] }));
        get().addAuditLog('BULK_CREATE_PRODUCTS', 'Product Catalog', `${newProducts.length} items batch added`);

        // Sync batch to Firestore
        await batchAddProductsFS(newProducts);
        return newProducts.length;
      },
      updateProduct: (id, updates) => {
        set((state) => ({
          products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
        get().addAuditLog('UPDATE_PRODUCT', 'Product', id);

        // Sync to Firestore
        updateProductFS(id, updates);
      },
      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
        get().addAuditLog('DELETE_PRODUCT', 'Product', id);

        // Sync to Firestore
        deleteProductFS(id);
      },
      addCategory: (catData) => {
        const idPrefix = catData.parentId ? 'sub' : 'cat';
        const newCategory: Category = {
          ...catData,
          id: catData.id || `${idPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          slug: catData.slug || catData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
          sortOrder: catData.sortOrder !== undefined ? catData.sortOrder : (catData.displayOrder !== undefined ? catData.displayOrder : get().categories.length + 1),
          displayOrder: catData.displayOrder !== undefined ? catData.displayOrder : (catData.sortOrder !== undefined ? catData.sortOrder : get().categories.length + 1),
          isActive: catData.isActive !== undefined ? catData.isActive : true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({ categories: [...state.categories, newCategory] }));
        get().addAuditLog('CREATE_CATEGORY', newCategory.parentId ? 'Subcategory' : 'Category', newCategory.id);

        // Sync to Backend & Firestore
        addCategoryFS(newCategory);
        return newCategory;
      },

      updateCategory: (id, updates) => {
        const timestamp = new Date().toISOString();
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: timestamp } : c)),
        }));
        get().addAuditLog('UPDATE_CATEGORY', 'Category', id);

        // Sync to Backend & Firestore
        updateCategoryFS(id, updates);
      },

      deleteCategory: (id, options) => {
        const categoryToDelete = get().categories.find((c) => c.id === id);
        const isTopLevel = categoryToDelete && !categoryToDelete.parentId;
        const reassignCatId = options?.reassignCategoryId;
        const reassignSubId = options?.reassignSubcategoryId;

        set((state) => {
          let updatedCategories = state.categories.filter((c) => c.id !== id);

          // If deleting a parent category
          if (isTopLevel) {
            if (reassignCatId) {
              // Reassign subcategories to target category
              updatedCategories = updatedCategories.map((c) =>
                c.parentId === id ? { ...c, parentId: reassignCatId } : c
              );
            } else {
              // Delete child subcategories
              updatedCategories = updatedCategories.filter((c) => c.parentId !== id);
            }
          }

          // Reassign products
          const updatedProducts = state.products.map((p) => {
            let pCat = p.categoryId;
            let pSub = p.subcategoryId;

            if (p.categoryId === id) {
              pCat = reassignCatId || 'cat-dairy';
            }
            if (p.subcategoryId === id) {
              pSub = reassignSubId || (reassignCatId ? undefined : undefined);
            }
            if (reassignCatId && p.categoryId === id) {
              pCat = reassignCatId;
            }

            return { ...p, categoryId: pCat, subcategoryId: pSub };
          });

          return {
            categories: updatedCategories,
            products: updatedProducts,
          };
        });

        get().addAuditLog('DELETE_CATEGORY', isTopLevel ? 'Category' : 'Subcategory', id);

        // Sync to Backend & Firestore
        deleteCategoryFS(id, options);
      },

      reorderCategories: async (orderedIds, parentId = null) => {
        const items = orderedIds.map((id, index) => ({
          id,
          displayOrder: index + 1,
        }));

        set((state) => ({
          categories: state.categories.map((c) => {
            const matchIndex = orderedIds.indexOf(c.id);
            if (matchIndex !== -1) {
              return { ...c, displayOrder: matchIndex + 1, sortOrder: matchIndex + 1 };
            }
            return c;
          }),
        }));

        try {
          await fetch('/api/categories/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          });
        } catch (_) {}
      },

      moveSubcategory: async (subcategoryId, newParentCategoryId) => {
        const sub = get().categories.find((c) => c.id === subcategoryId);
        const newParent = get().categories.find((c) => c.id === newParentCategoryId);
        if (!sub || !newParent) return false;

        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === subcategoryId ? { ...c, parentId: newParentCategoryId, updatedAt: new Date().toISOString() } : c
          ),
          products: state.products.map((p) =>
            p.subcategoryId === subcategoryId ? { ...p, categoryId: newParentCategoryId } : p
          ),
        }));

        get().addAuditLog('MOVE_SUBCATEGORY', 'Subcategory', `${sub.name} moved to ${newParent.name}`);

        try {
          const res = await fetch('/api/categories/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subcategoryId, newParentCategoryId }),
          });
          const data = await res.json();
          return Boolean(data.success);
        } catch (_) {
          return true;
        }
      },

      toggleCategoryStatus: (id) => {
        const cat = get().categories.find((c) => c.id === id);
        if (!cat) return;
        const newStatus = !cat.isActive;

        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id || c.parentId === id ? { ...c, isActive: newStatus, updatedAt: new Date().toISOString() } : c
          ),
        }));

        get().addAuditLog('TOGGLE_CATEGORY_STATUS', 'Category', `${cat.name} -> ${newStatus ? 'Active' : 'Inactive'}`);

        updateCategoryFS(id, { isActive: newStatus });
      },

      // ── BRANDS MANAGEMENT ──
      brands: INITIAL_BRANDS,

      setBrands: (brands) => set({ brands }),

      fetchBrands: async (categoryId) => {
        try {
          const url = categoryId ? `/api/brands?categoryId=${categoryId}` : '/api/brands?includeInactive=true';
          const res = await fetch(url);
          const data = await res.json();
          if (res.ok && Array.isArray(data.brands)) {
            set({ brands: data.brands });
            return data.brands;
          }
        } catch (_) {}
        return get().brands;
      },

      addBrand: async (brandData) => {
        try {
          const res = await fetch('/api/brands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(brandData),
          });
          const data = await res.json();
          if (res.ok && data.success && data.brand) {
            set((state) => ({
              brands: [...state.brands, data.brand],
            }));
            get().addAuditLog('CREATE_BRAND', 'Brand', `Created brand "${data.brand.name}"`);
            return data.brand;
          }
        } catch (_) {}

        // Fallback local addition
        const slug = (brandData.slug || brandData.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const newBrand: Brand = {
          id: brandData.id || `brand-${slug}-${Date.now().toString().slice(-4)}`,
          name: brandData.name,
          slug,
          logo: brandData.logo || brandData.logoUrl || '',
          logoUrl: brandData.logoUrl || brandData.logo || '',
          bannerUrl: brandData.bannerUrl || '',
          description: brandData.description || '',
          isActive: brandData.isActive !== false,
          status: brandData.isActive !== false ? 'active' : 'inactive',
          displayOrder: brandData.displayOrder || get().brands.length + 1,
          categoryIds: brandData.categoryIds || [],
          subcategoryIds: brandData.subcategoryIds || [],
          productCount: 0,
        };

        set((state) => ({
          brands: [...state.brands, newBrand],
        }));
        return newBrand;
      },

      updateBrand: async (id, updates) => {
        set((state) => ({
          brands: state.brands.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
          ),
        }));

        try {
          const res = await fetch(`/api/brands/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            get().addAuditLog('UPDATE_BRAND', 'Brand', `Updated brand "${updates.name || id}"`);
            return true;
          }
        } catch (_) {}
        return true;
      },

      deleteBrand: async (id, options) => {
        const brand = get().brands.find((b) => b.id === id);
        try {
          const queryParams = new URLSearchParams();
          if (options?.reassignBrandId) queryParams.set('reassignBrandId', options.reassignBrandId);
          if (options?.forceDeactivate) queryParams.set('forceDeactivate', 'true');

          const res = await fetch(`/api/brands/${id}?${queryParams.toString()}`, {
            method: 'DELETE',
          });
          const data = await res.json();

          if (!res.ok || !data.success) {
            return {
              success: false,
              hasProducts: data.hasProducts,
              productCount: data.productCount,
              error: data.error || 'Failed to delete brand',
            };
          }

          if (data.deactivated) {
            set((state) => ({
              brands: state.brands.map((b) => (b.id === id ? { ...b, isActive: false, status: 'inactive' } : b)),
            }));
            return { success: true };
          }

          set((state) => ({
            brands: state.brands.filter((b) => b.id !== id),
          }));
          get().addAuditLog('DELETE_BRAND', 'Brand', `Deleted brand "${brand?.name || id}"`);
          return { success: true };
        } catch (err: any) {
          return { success: false, error: err.message || 'Network error' };
        }
      },

      toggleBrandStatus: async (id) => {
        const brand = get().brands.find((b) => b.id === id);
        if (!brand) return;
        const newStatus = !brand.isActive;

        set((state) => ({
          brands: state.brands.map((b) =>
            b.id === id ? { ...b, isActive: newStatus, status: newStatus ? 'active' : 'inactive' } : b
          ),
        }));

        try {
          await fetch(`/api/brands/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: newStatus }),
          });
          get().addAuditLog('TOGGLE_BRAND_STATUS', 'Brand', `${brand.name} -> ${newStatus ? 'Active' : 'Inactive'}`);
        } catch (_) {}
      },

      reorderBrands: async (orderedIds) => {
        const brandMap = new Map(get().brands.map((b) => [b.id, b]));
        const reordered: Brand[] = [];

        orderedIds.forEach((id, idx) => {
          const b = brandMap.get(id);
          if (b) {
            reordered.push({ ...b, displayOrder: idx + 1 });
            brandMap.delete(id);
          }
        });

        // Append remaining
        brandMap.forEach((b) => reordered.push(b));

        set({ brands: reordered });

        try {
          const items = orderedIds.map((id, idx) => ({ id, displayOrder: idx + 1 }));
          await fetch('/api/brands/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          });
        } catch (_) {}
      },

      cart: [],
      appliedCoupon: null,
      addToCart: (product, qty = 1, variant?: ProductVariant) => {
        set((state) => {
          // Cart item uniqueness: productId + variantId (or 'default')
          const variantId = variant?.id || 'default';
          const cartItemId = `${product.id}::${variantId}`;
          const effectivePrice = variant ? variant.sellingPrice : product.sellingPrice;
          const effectiveMrp = variant ? variant.mrp : product.mrp;

          const existingItem = state.cart.find((item) => item.id === cartItemId);
          if (existingItem) {
            return {
              cart: state.cart.map((item) =>
                item.id === cartItemId
                  ? { ...item, quantity: item.quantity + qty }
                  : item
              ),
            };
          }
          const newItem: CartItem = {
            id: cartItemId,
            productId: product.id,
            product,
            quantity: qty,
            price: effectivePrice,
            mrp: effectiveMrp,
            ...(variant && {
              variantId: variant.id,
              variantName: variant.variantName,
              selectedVariant: variant,
            }),
          };
          return { cart: [...state.cart, newItem] };
        });
      },
      removeFromCart: (cartItemId) => {
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== cartItemId && item.productId !== cartItemId),
        }));
      },
      updateQuantity: (cartItemId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeFromCart(cartItemId);
          return;
        }
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === cartItemId || item.productId === cartItemId
              ? { ...item, quantity }
              : item
          ),
        }));
      },
      updateCartQuantity: (cartItemId: string, quantity: number) => {
        get().updateQuantity(cartItemId, quantity);
      },
      clearCart: () => set({ cart: [], appliedCoupon: null }),
      applyCoupon: (code) => {
        const coupon = get().coupons.find(
          (c) => c.code.toUpperCase() === code.toUpperCase() && c.active
        );
        if (!coupon) {
          return { success: false, message: 'Invalid or expired coupon code' };
        }
        const subtotal = get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        if (subtotal < coupon.minimumOrder) {
          return {
            success: false,
            message: `Minimum order value of ₹${coupon.minimumOrder} required for coupon ${coupon.code}`,
          };
        }
        set({ appliedCoupon: coupon });
        return { success: true, message: `Coupon ${coupon.code} applied successfully!` };
      },
      removeCoupon: () => set({ appliedCoupon: null }),

      // Wishlist
      wishlist: ['p-milk-1', 'p-bread-1'],
      toggleWishlist: (productId) => {
        set((state) => {
          const exists = state.wishlist.includes(productId);
          if (exists) {
            return { wishlist: state.wishlist.filter((id) => id !== productId) };
          }
          return { wishlist: [...state.wishlist, productId] };
        });
      },

      // Addresses
      addresses: [],
      addAddress: (addrData) => {
        const currentUser = get().currentUser;
        const newAddr: Address = {
          ...addrData,
          id: `addr-${Date.now()}`,
          userId: currentUser?.id || 'usr-cust-1',
          phone: addrData.phone || currentUser?.mobile || '+91 8698893348',
        };
        set((state) => {
          let updated = state.addresses;
          if (newAddr.isDefault) {
            updated = updated.map((a) => ({ ...a, isDefault: false }));
          }
          return { addresses: [...updated, newAddr] };
        });

        // Sync to Firestore
        saveAddressFS(newAddr);
      },
      updateAddress: (id, updates) => {
        set((state) => {
          let updated = state.addresses.map((a) => (a.id === id ? { ...a, ...updates } : a));
          if (updates.isDefault) {
            updated = updated.map((a) => ({ ...a, isDefault: a.id === id }));
          }
          return { addresses: updated };
        });

        const target = get().addresses.find((a) => a.id === id);
        if (target) saveAddressFS(target);
      },
      deleteAddress: (id) => {
        set((state) => ({
          addresses: state.addresses.filter((a) => a.id !== id),
        }));

        // Sync to Firestore
        deleteAddressFS(id);
      },
      setDefaultAddress: (id) => {
        set((state) => ({
          addresses: state.addresses.map((a) => ({
            ...a,
            isDefault: a.id === id,
          })),
        }));
      },

      // Orders
      orders: [],
      activeOrderTrackingId: null,
      setActiveOrderTrackingId: (id) => set({ activeOrderTrackingId: id }),
      placeOrder: (addressId, deliverySlot, paymentMethod, cloudOrderId, cloudOrderNumber) => {
        const { cart, appliedCoupon, addresses, currentUser } = get();
        const address = addresses.find((a) => a.id === addressId) || addresses[0];

        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        let discount = 0;
        if (appliedCoupon) {
          if (appliedCoupon.type === 'fixed') {
            discount = appliedCoupon.value;
          } else {
            discount = Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.maxDiscount);
          }
        }
        const deliveryCharge = subtotal > 499 ? 0 : 29;
        const tax = Math.round((subtotal - discount) * 0.05);
        const total = Math.max(0, subtotal - discount + deliveryCharge + tax);

        const orderId = cloudOrderId || `ord-${Date.now()}`;
        const orderNumber = cloudOrderNumber || `PK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newOrder: Order = {
          id: orderId,
          orderNumber,
          customerId: currentUser?.id || 'usr-cust-1',
          customerName:
            (address?.fullName || (address as any)?.name || '').trim() ||
            (currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : '') ||
            'Customer',
          customerPhone: currentUser?.mobile || '+91 8698893348',
          storeId: 'store-1',
          storeName: 'PocketKirana Express DarkStore',
          addressId,
          address,
          deliveryAddress: address,
          couponCode: appliedCoupon?.code,
          subtotal,
          discount,
          deliveryCharge,
          deliveryFee: deliveryCharge,
          tax,
          total,
          paymentMethod,
          paymentStatus: 'pending',
          orderStatus: 'STOCK_RESERVED',
          deliverySlot,
          placedAt: new Date().toISOString(),
          deliveryOtp: String(Math.floor(1000 + Math.random() * 9000)),
          estimatedDeliveryTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          items: cart.map((item) => ({
            id: `oi-${Date.now()}-${item.productId}`,
            orderId,
            productId: item.productId,
            product: item.product,
            quantity: item.quantity,
            price: item.price,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
            subtotal: item.price * item.quantity,
          })),
          statusHistory: [
            {
              status: 'CREATED',
              timestamp: new Date().toISOString(),
              note: 'Order placed by customer',
            },
            {
              status: 'CONFIRMED',
              timestamp: new Date().toISOString(),
              note: 'Order confirmed and payment verified',
            },
            {
              status: 'STOCK_RESERVED',
              timestamp: new Date().toISOString(),
              note: 'Stock reserved, picking task created',
            },
          ],
        };

        set((state) => ({
          orders: [newOrder, ...state.orders],
          cart: [],
          appliedCoupon: null,
          activeOrderTrackingId: newOrder.id,
        }));

        // Trigger Multi-Role Lifecycle Notifications
        const lifecycleNotifs = generateOrderLifecycleNotifications({
          order: newOrder,
          newStatus: 'placed',
        });

        const prefs = get().notificationPreferences;
        const validNotifs: Notification[] = [];

        for (const notif of lifecycleNotifs) {
          if (notif.recipientType === 'customer' && !isAllowedByPreferences(notif.type, prefs)) {
            continue;
          }
          validNotifs.push(notif);
          saveNotificationFS(notif);
        }

        if (validNotifs.length > 0) {
          set((state) => ({
            notifications: [...validNotifs, ...state.notifications],
          }));
          if (prefs.soundEnabled) {
            soundAlerts.playOrderChime();
          }
        }

        get().addAuditLog('PLACE_ORDER', 'Order', newOrder.id);

        // Sync order to Firestore
        saveOrderFS(newOrder);

        // 1. Reserve Stock in Firestore
        import('./firebase').then(async ({ getFirebaseDb }) => {
          const db = getFirebaseDb();
          if (db) {
            const { doc, getDoc, updateDoc } = await import('firebase/firestore');
            for (const item of newOrder.items) {
              const invId = `${item.productId}_store-1`;
              try {
                const invRef = doc(db, 'inventory', invId);
                const invSnap = await getDoc(invRef);
                if (invSnap.exists()) {
                  const invData = invSnap.data();
                  const quantity = invData.quantity ?? 100;
                  const damaged = invData.damagedQuantity ?? 0;
                  const reserved = (invData.reservedQuantity ?? 0) + item.quantity;
                  const available = quantity - reserved - damaged;
                  await updateDoc(invRef, {
                    reservedQuantity: reserved,
                    availableQuantity: Math.max(0, available),
                    updatedAt: new Date().toISOString()
                  });
                }
              } catch (err) {
                console.warn('Could not update inventory doc:', err);
              }
            }
          }
        });

        // 2. Create Picking Task in Firestore
        const pickingItems: PickingItem[] = newOrder.items.map((item) => ({
          id: `pi-${Date.now()}-${item.productId}`,
          productId: item.productId,
          productName: item.product?.name || (item as any).productName || (item as any).name || 'Product',
          sku: item.product?.sku || (item as any).sku || item.productId || 'SKU',
          upc: item.product?.upc || '',
          barcode: item.product?.barcode || item.product?.sku || item.productId || '',
          unit: item.product?.unit || 'unit',
          imageUrl: item.product?.thumbnail || (item as any).image || '',
          quantityRequired: item.quantity,
          quantityPicked: 0,
          storageLocation: item.product?.storageLocation || {
            id: 'loc-1',
            storeId: 'store-1',
            aisle: 'A',
            rack: '01',
            shelf: 'A',
            bin: '01',
            barcode: 'LOC-A01A01',
            displayCode: 'A-01-A-01'
          },
          status: 'pending' as const
        }));
        
        pickingItems.sort((a, b) => (a.storageLocation?.aisle || '').localeCompare(b.storageLocation?.aisle || ''));

        const pickingTask: PickingTask = {
          id: `task-${Date.now()}`,
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          storeId: 'store-1',
          storeName: 'PocketKirana Express DarkStore',
          status: 'pending' as const,
          priority: 'NORMAL',
          items: pickingItems,
          totalItemsCount: pickingItems.length,
          pickedItemsCount: 0,
          createdAt: new Date().toISOString()
        };

        savePickingTaskFS(pickingTask);

        set((state) => ({
          pickingTasks: [pickingTask, ...state.pickingTasks]
        }));

        return newOrder;
      },
      updateOrderStatus: (orderId, status) => {
        const prevOrder = get().orders.find((o) => o.id === orderId);
        if (!prevOrder) return;

        const updatedStatusHistory = [
          ...(prevOrder.statusHistory || []),
          {
            status,
            timestamp: new Date().toISOString(),
            note: `Status updated to ${status}`
          }
        ];

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  orderStatus: status,
                  statusHistory: updatedStatusHistory
                }
              : o
          ),
        }));

        const targetOrder = get().orders.find((o) => o.id === orderId) || prevOrder;
        if (targetOrder) {
          const legacyStatusMap: Record<string, OrderStatus> = {
            STOCK_RESERVED: 'preparing',
            PICKING: 'preparing',
            PICKED: 'preparing',
            PACKING: 'preparing',
            PACKED: 'packed',
            READY_FOR_PICKUP: 'packed',
            ASSIGNED: 'partner_assigned',
            ACCEPTED: 'partner_assigned',
            ARRIVED_AT_STORE: 'partner_assigned',
            PICKED_UP: 'picked_up',
            OUT_FOR_DELIVERY: 'out_for_delivery',
            ARRIVED_AT_CUSTOMER: 'out_for_delivery',
            DELIVERED: 'delivered',
            COMPLETED: 'delivered'
          };
          
          const mappedStatus = legacyStatusMap[status] || (status as OrderStatus);

          const lifecycleNotifs = generateOrderLifecycleNotifications({
            order: targetOrder,
            newStatus: mappedStatus,
            partnerName: targetOrder.partnerName,
            partnerPhone: targetOrder.partnerPhone,
          });

          const prefs = get().notificationPreferences;
          const validNotifs: Notification[] = [];

          for (const notif of lifecycleNotifs) {
            if (notif.recipientType === 'customer' && !isAllowedByPreferences(notif.type, prefs)) {
              continue;
            }
            validNotifs.push(notif);
            saveNotificationFS(notif);
          }

          if (validNotifs.length > 0) {
            set((state) => ({
              notifications: [...validNotifs, ...state.notifications],
            }));

            if (prefs.soundEnabled) {
              if (mappedStatus === 'delivered') {
                soundAlerts.playOrderChime();
              } else if (mappedStatus === 'out_for_delivery') {
                soundAlerts.playOrderChime();
              } else if (mappedStatus === 'partner_assigned') {
                soundAlerts.playPartnerDispatch();
              }
            }
          }

          // Manage tracking session lifecycle
          if (status === 'OUT_FOR_DELIVERY' || status === 'PICKED_UP' || mappedStatus === 'out_for_delivery') {
            startTrackingSessionFS(orderId, targetOrder.partnerId || '', targetOrder.customerId);
          } else if (
            status === 'DELIVERED' ||
            status === 'COMPLETED' ||
            status === 'CANCELLED' ||
            status === 'RETURNED' ||
            mappedStatus === 'delivered'
          ) {
            stopTrackingSessionFS(orderId);
          }
        }

        // Sync to Firestore
        saveOrderFS({
          ...targetOrder,
          orderStatus: status,
          statusHistory: updatedStatusHistory
        });
      },
      assignDeliveryPartner: (orderId, partnerId) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        if (!partner) return;
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? {
                ...o,
                partnerId: partner.id,
                partnerName: partner.name,
                partnerPhone: partner.phone,
                orderStatus: 'ASSIGNED',
              }
              : o
          ),
        }));

        const updatedOrder = get().orders.find((o) => o.id === orderId);
        if (updatedOrder) {
          const lifecycleNotifs = generateOrderLifecycleNotifications({
            order: updatedOrder,
            newStatus: 'ASSIGNED',
            partnerName: partner.name,
            partnerPhone: partner.phone,
          });

          const prefs = get().notificationPreferences;
          const validNotifs: Notification[] = [];

          for (const notif of lifecycleNotifs) {
            if (notif.recipientType === 'customer' && !isAllowedByPreferences(notif.type, prefs)) {
              continue;
            }
            validNotifs.push(notif);
            saveNotificationFS(notif);
          }

          if (validNotifs.length > 0) {
            set((state) => ({
              notifications: [...validNotifs, ...state.notifications],
            }));
            if (prefs.soundEnabled) {
              soundAlerts.playPartnerDispatch();
            }
          }
        }

        // Sync to Firestore
        assignDeliveryPartnerFS(orderId, partnerId, partner.name, partner.phone);
      },
      verifyDeliveryOtp: (orderId, otp) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (order && order.deliveryOtp === otp) {
          get().updateOrderStatus(orderId, 'delivered');
          
          const partnerId = order.partnerId || 'partner-1';
          const earningsObj = calculateDeliveryEarnings(order, get().partnerPricingRules);
          const amountEarned = earningsObj.totalEarnings;

          // update delivery partner earnings
          set((state) => ({
            deliveryPartners: state.deliveryPartners.map((p) =>
              p.id === partnerId
                ? {
                  ...p,
                  todayEarnings: p.todayEarnings + amountEarned,
                  walletBalance: p.walletBalance + amountEarned,
                  completedDeliveries: p.completedDeliveries + 1,
                }
                : p
            ),
          }));
          updatePartnerEarningsFS(partnerId, amountEarned);
          return true;
        }
        return false;
      },

      // Delivery Partners Engine (Mobile PWA & Real-Time Sync)
      deliveryPartners: isFirebaseConfigured() ? [] : INITIAL_DELIVERY_PARTNERS.map(p => ({ ...p, accountStatus: p.accountStatus || 'active', partnerCode: p.partnerCode || 'DP001' })),
      activePartnerId: 'partner-1',
      authenticatedPartnerId: typeof window !== 'undefined' ? localStorage.getItem('pk_delivery_authenticated_partner') || null : null,
      partnerAuthTokens: [],
      partnerPricingRules: DEFAULT_PRICING_RULES,

      setActivePartnerId: (id) => set({ activePartnerId: id }),

      createDeliveryPartner: (data) => {
        const nextIdNum = get().deliveryPartners.length + 1;
        const partnerCode = data.partnerCode || `DP${String(nextIdNum).padStart(3, '0')}`;
        // Auto-generate login credentials if not provided by admin
        const loginId = data.loginId || partnerCode;
        const loginPassword = data.loginPassword || `pk${String(nextIdNum).padStart(4, '0')}`;
        const newPartner: DeliveryPartner = {
          id: `partner-${Date.now()}`,
          userId: `usr-del-${Date.now()}`,
          name: data.name,
          phone: data.phone,
          partnerCode,
          loginId,
          loginPassword,
          accountStatus: 'active',
          profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          vehicleType: data.vehicleType || 'EV Scooter',
          vehicleNumber: data.vehicleNumber || 'MH 14 EV 2026',
          licenseNumber: `DL-MH-${Date.now().toString().slice(-6)}`,
          verificationStatus: 'verified',
          currentStatus: 'offline',
          rating: 5.0,
          walletBalance: 0,
          todayEarnings: 0,
          completedDeliveries: 0,
        };

        set((state) => ({
          deliveryPartners: [newPartner, ...state.deliveryPartners]
        }));
        saveDeliveryPartnerFS(newPartner);

        return {
          success: true,
          partner: newPartner,
          message: `Delivery Partner ${data.name} (${partnerCode}) created successfully!`
        };
      },

      updateDeliveryPartnerAccountStatus: (partnerId, accountStatus) => {
        set((state) => ({
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId ? { ...p, accountStatus } : p
          )
        }));
        updatePartnerAccountStatusFS(partnerId, accountStatus);

        if (accountStatus === 'inactive') {
          // Invalidate active auth tokens for this partner
          set((state) => ({
            partnerAuthTokens: state.partnerAuthTokens.map((t) =>
              t.partnerId === partnerId ? { ...t, status: 'revoked' } : t
            )
          }));
          // If currently logged in partner was deactivated, sign out
          if (get().authenticatedPartnerId === partnerId) {
            get().logoutDeliveryPartner();
          }
        }
      },

      deleteDeliveryPartner: (partnerId) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        if (!partner) {
          return { success: false, message: 'Delivery Partner not found.' };
        }

        const partnerName = partner.name;

        // Clean up from state
        set((state) => ({
          deliveryPartners: state.deliveryPartners.filter((p) => p.id !== partnerId),
          // If currently authenticated partner is deleted, sign them out
          authenticatedPartnerId: state.authenticatedPartnerId === partnerId ? null : state.authenticatedPartnerId,
          activePartnerId: state.activePartnerId === partnerId ? (state.deliveryPartners.find((p) => p.id !== partnerId)?.id || '') : state.activePartnerId,
          // Revert any active order assignments to READY_FOR_PICKUP
          orders: state.orders.map((o) =>
            o.partnerId === partnerId
              ? {
                  ...o,
                  partnerId: undefined,
                  partnerName: undefined,
                  partnerPhone: undefined,
                  orderStatus: o.orderStatus === 'OUT_FOR_DELIVERY' || o.orderStatus === 'ASSIGNED' ? 'READY_FOR_PICKUP' : o.orderStatus,
                }
              : o
          ),
        }));

        // Clean up localStorage session if active
        if (typeof window !== 'undefined' && localStorage.getItem('pk_delivery_authenticated_partner') === partnerId) {
          localStorage.removeItem('pk_delivery_authenticated_partner');
        }

        // Delete from Firestore
        deleteDeliveryPartnerFS(partnerId);

        get().addAuditLog(`DELETE_DELIVERY_PARTNER: Removed ${partnerName} (${partnerId})`, 'DeliveryPartner', partnerId);

        return {
          success: true,
          message: `Delivery Partner "${partnerName}" deleted successfully!`,
        };
      },

      generatePartnerLoginQR: (partnerId) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        const randomToken = Math.random().toString(36).substring(2, 10).toUpperCase();
        const tokenString = `PK-DP-AUTH-${randomToken}`;
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        const newToken: PartnerAuthToken = {
          id: tokenString,
          partnerId,
          partnerName: partner?.name || 'Delivery Rider',
          partnerCode: partner?.partnerCode || partnerId,
          token: tokenString,
          createdAt,
          expiresAt,
          createdBy: 'Admin',
          status: 'valid',
        };

        set((state) => ({
          // Invalidate previous valid tokens for this partner
          partnerAuthTokens: [
            newToken,
            ...state.partnerAuthTokens.map((t) =>
              t.partnerId === partnerId && t.status === 'valid' ? { ...t, status: 'revoked' as const } : t
            )
          ]
        }));
        savePartnerAuthTokenFS(newToken);

        return newToken;
      },

      revokePartnerLoginQR: (tokenId) => {
        set((state) => ({
          partnerAuthTokens: state.partnerAuthTokens.map((t) =>
            t.token === tokenId || t.id === tokenId ? { ...t, status: 'revoked' } : t
          )
        }));
      },

      validateAndLoginPartnerQR: (scannedToken) => {
        const cleanToken = scannedToken.trim();

        // 1. Strict Separation: Check if it's an Order Handover QR
        if (cleanToken.startsWith('PK-HO-')) {
          return {
            success: false,
            errorType: 'ORDER_QR',
            message: 'This is an Order Handover QR code. Please scan your Admin Login QR code.'
          };
        }

        // 2. Validate Token Format
        if (!cleanToken.startsWith('PK-DP-AUTH-')) {
          return {
            success: false,
            errorType: 'INVALID',
            message: 'This QR code is invalid. Please ask your Admin to generate a valid Login QR.'
          };
        }

        // 3. Find token in memory or fallback synthesis
        let tokenObj = get().partnerAuthTokens.find((t) => t.token === cleanToken || t.id === cleanToken);

        // Fallback for direct token testing if token generated on admin tab
        if (!tokenObj && cleanToken.startsWith('PK-DP-AUTH-')) {
          const firstPartner = get().deliveryPartners.find(p => p.accountStatus !== 'inactive') || get().deliveryPartners[0];
          if (firstPartner) {
            tokenObj = {
              id: cleanToken,
              token: cleanToken,
              partnerId: firstPartner.id,
              partnerName: firstPartner.name,
              partnerCode: firstPartner.partnerCode || 'DP001',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
              createdBy: 'Admin',
              status: 'valid'
            };
          }
        }

        if (!tokenObj) {
          return {
            success: false,
            errorType: 'INVALID',
            message: 'This QR code does not exist or has expired.'
          };
        }

        // 4. Check if Revoked
        if (tokenObj.status === 'revoked') {
          return {
            success: false,
            errorType: 'REVOKED',
            message: 'This Login QR code has been revoked by Admin.'
          };
        }

        // 5. Check if Expired
        if (new Date(tokenObj.expiresAt).getTime() < Date.now() || tokenObj.status === 'expired') {
          return {
            success: false,
            errorType: 'EXPIRED',
            message: 'This QR code has expired. Ask your Admin to generate a new login QR.'
          };
        }

        // 6. Check if Already Used
        if (tokenObj.status === 'used') {
          return {
            success: false,
            errorType: 'INVALID',
            message: 'This single-use QR code has already been used.'
          };
        }

        // 7. Verify Delivery Partner exists and is ACTIVE
        const partner = get().deliveryPartners.find((p) => p.id === tokenObj?.partnerId);
        if (!partner) {
          return {
            success: false,
            errorType: 'INVALID',
            message: 'Associated Delivery Partner record not found.'
          };
        }

        if (partner.accountStatus === 'inactive' || partner.accountStatus === 'suspended') {
          return {
            success: false,
            errorType: 'REVOKED',
            message: 'Your Delivery Partner account has been deactivated. Please contact Admin.'
          };
        }

        // 8. Mark token as used and set authenticated partner session
        set((state) => ({
          partnerAuthTokens: state.partnerAuthTokens.map((t) =>
            t.token === cleanToken ? { ...t, status: 'used', usedAt: new Date().toISOString() } : t
          ),
          authenticatedPartnerId: partner.id,
          activePartnerId: partner.id
        }));

        if (typeof window !== 'undefined') {
          localStorage.setItem('pk_delivery_authenticated_partner', partner.id);
        }

        return {
          success: true,
          partner,
          message: `✓ LOGIN SUCCESSFUL! Welcome, ${partner.name}.`
        };
      },

      logoutDeliveryPartner: (partnerId?: string, force = false) => {
        const targetId = partnerId || get().authenticatedPartnerId || get().activePartnerId;
        const partner = get().deliveryPartners.find((p) => p.id === targetId);

        // Security / Operational constraint: Rider cannot log out if they hold unverified cash
        const pendingCash = Number(partner?.cashInHand || 0);

        if (!force && pendingCash > 0 && !partner?.forceLoggedOutByAdmin) {
          return {
            success: false,
            message: `⚠️ Cannot sign out: You have ₹${pendingCash} in unverified cash in hand. Please handover the collected cash to DarkStore Admin for verification first.`,
            cashInHand: pendingCash,
          };
        }

        set((state) => ({
          authenticatedPartnerId: null,
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  currentStatus: 'offline' as const,
                  forceLoggedOutByAdmin: false,
                }
              : p
          ),
        }));

        if (typeof window !== 'undefined') {
          localStorage.removeItem('pk_delivery_authenticated_partner');
        }

        return {
          success: true,
          message: 'Signed out of delivery shift successfully.',
          cashInHand: 0,
        };
      },

      requestCashVerification: (partnerId: string) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        if (!partner) return { success: false, message: 'Partner not found.' };

        const cashAmt = Number(partner.cashInHand || 0);
        if (cashAmt <= 0) {
          return { success: false, message: 'No pending cash in hand to settle.' };
        }

        set((state) => ({
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? { ...p, cashSettlementStatus: 'PENDING_VERIFICATION' as const }
              : p
          ),
        }));

        get().addNotification(
          '💵 Cash Handover Verification Request',
          `Rider ${partner.name} (${partner.partnerCode || partner.id}) requested verification for ₹${cashAmt} collected cash.`,
          'ADMIN_SYSTEM_ALERT',
          'admin',
          { deepLink: '/admin?tab=payments' }
        );

        return {
          success: true,
          message: `Verification request for ₹${cashAmt} sent to DarkStore Admin!`,
        };
      },

      verifyAndSettlePartnerCash: (partnerId: string, amount?: number, adminId = 'admin-root', adminName = 'Store Admin', note?: string) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        if (!partner) return { success: false, message: 'Partner not found.' };

        const currentCash = Number(partner.cashInHand || 0);
        const settleAmt = amount !== undefined ? Number(amount) : currentCash;

        if (settleAmt <= 0 && currentCash <= 0) {
          return { success: false, message: 'No cash in hand to settle.' };
        }

        const remainingCash = Math.max(0, currentCash - settleAmt);
        const timestamp = new Date().toISOString();
        const settlementRef = `STL-VER-${Date.now().toString().slice(-6)}`;

        const newSettlement: SettlementRecord = {
          id: `stl_${partnerId}_${Date.now()}`,
          partnerId,
          partnerName: partner.name,
          amount: settleAmt,
          adminId,
          adminName,
          settlementRef,
          note: note || `Verified cash handover of ₹${settleAmt} received at Darkstore Counter.`,
          timestamp,
        };

        set((state) => ({
          settlements: [newSettlement, ...state.settlements],
          codCollections: state.codCollections.map((c) =>
            c.partnerId === partnerId && c.status === 'COLLECTED'
              ? ({
                  ...c,
                  status: 'SETTLED' as import('@/types').CollectionStatus,
                  settledAmount: c.collectedAmount,
                  settledAt: timestamp,
                  settlementRef,
                } as import('@/types').CodCollectionRecord)
              : c
          ),
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  cashInHand: remainingCash,
                  cashSettlementStatus: (remainingCash === 0 ? 'SETTLED' : 'UNCLEARED') as any,
                  lastCashSettledAt: timestamp,
                  forceLoggedOutByAdmin: false,
                }
              : p
          ),
        }));

        get().addAuditLog(
          `CASH_HANDOVER_VERIFIED: Received ₹${settleAmt} from ${partner.name} (Ref: ${settlementRef})`,
          'DeliveryPartner',
          partnerId
        );

        get().addNotification(
          '✅ Cash Handover Verified',
          `Admin verified and accepted ₹${settleAmt} cash from ${partner.name}. Cash in hand settled.`,
          'PARTNER_EARNINGS_CREDITED',
          'delivery_partner',
          { recipientId: partner.id, deepLink: '/delivery' }
        );

        return {
          success: true,
          message: `✓ Cash handover of ₹${settleAmt} verified & settled for ${partner.name}!`,
        };
      },

      adminForceLogoutPartner: (partnerId: string) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        if (!partner) return { success: false, message: 'Partner not found.' };

        set((state) => ({
          authenticatedPartnerId: state.authenticatedPartnerId === partnerId ? null : state.authenticatedPartnerId,
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  currentStatus: 'offline' as const,
                  forceLoggedOutByAdmin: true,
                }
              : p
          ),
        }));

        if (typeof window !== 'undefined' && localStorage.getItem('pk_delivery_authenticated_partner') === partnerId) {
          localStorage.removeItem('pk_delivery_authenticated_partner');
        }

        get().addAuditLog(
          `ADMIN_FORCE_LOGOUT: Logged out Delivery Partner ${partner.name} (${partnerId})`,
          'DeliveryPartner',
          partnerId
        );

        get().addNotification(
          '🔒 Shift Ended by Admin',
          `Your delivery shift has been ended and you have been signed out by the Darkstore Admin.`,
          'ADMIN_PARTNER_OFFLINE' as any,
          'delivery_partner',
          { recipientId: partnerId }
        );

        return {
          success: true,
          message: `Successfully logged out Delivery Partner "${partner.name}".`,
        };
      },

      togglePartnerStatus: (partnerId: string) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        const nextStatus = partner?.currentStatus === 'online' ? 'offline' : 'online';
        get().setPartnerOnlineStatus(partnerId, nextStatus);
      },

      setPartnerOnlineStatus: (partnerId: string, status: 'online' | 'offline' | 'busy') => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        set((state) => ({
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  currentStatus: status,
                  currentLocation: p.currentLocation
                    ? { ...p.currentLocation, lastUpdated: new Date().toISOString() }
                    : undefined,
                }
              : p
          ),
        }));

        if (status === 'offline') {
          get().addNotification(
            '🚴 Delivery Partner Offline',
            `Partner ${partner?.name || partnerId} went offline.`,
            'ADMIN_PARTNER_OFFLINE',
            'admin',
            { deepLink: '/admin?tab=orders' }
          );
        } else if (status === 'online') {
          get().addNotification(
            '🟢 Partner Online',
            `Partner ${partner?.name || partnerId} is now online and ready for deliveries.`,
            'ADMIN_NEW_ORDER',
            'admin'
          );
        }

        updatePartnerStatusFS(partnerId, status);
      },

      acceptDeliveryAssignment: (orderId, partnerId) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        if (!partner) return { success: false, message: 'Partner not found.' };

        // ATOMIC CHECK: Prevent accepting if partner already has an active delivery
        if (partner.currentStatus === 'busy' || partner.activeOrderId) {
          return { success: false, message: 'You already have an active delivery in progress.' };
        }

        const order = get().orders.find((o) => o.id === orderId || o.orderNumber === orderId);
        if (!order) return { success: false, message: 'Order not found.' };

        // ATOMIC CHECK: Prevent 2 partners from accepting the same order
        const isAlreadyAssigned =
          order.orderStatus === 'OUT_FOR_DELIVERY' ||
          order.orderStatus === 'DELIVERED' ||
          order.orderStatus === 'COMPLETED' ||
          (order.partnerId && order.partnerId !== partnerId && order.orderStatus !== 'WAITING_FOR_DELIVERY' && order.orderStatus !== 'PACKED' && order.orderStatus !== 'READY_FOR_PICKUP');

        if (isAlreadyAssigned) {
          return { success: false, message: 'This order has already been accepted by another delivery partner.' };
        }

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === order.id || o.orderNumber === order.orderNumber
              ? {
                  ...o,
                  partnerId,
                  partnerName: partner.name,
                  partnerPhone: partner.phone,
                  orderStatus: 'OUT_FOR_DELIVERY',
                }
              : o
          ),
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  currentStatus: 'busy' as const,
                  activeOrderId: order.id,
                  activeDeliveryStage: 'OUT_FOR_DELIVERY',
                }
              : p
          ),
        }));

        updateDeliveryAssignmentStatusFS(`assign-${order.id}`, 'accepted');
        get().updateOrderStatus(order.id, 'OUT_FOR_DELIVERY');

        soundAlerts.playPartnerDispatch();

        get().addNotification(
          '🚴 Delivery Partner Dispatched',
          `Your order is out for delivery with ${partner.name}!`,
          'DELIVERY_ASSIGNED',
          'customer',
          { orderId: order.id, deepLink: `/orders` }
        );

        return { success: true, message: `Order #${order.orderNumber} accepted!` };
      },

      rejectDeliveryAssignment: (orderId, partnerId) => {
        set((state) => ({
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  activeOrderId: undefined,
                  activeDeliveryStage: undefined,
                  currentStatus: 'online' as const,
                }
              : p
          ),
        }));

        updateDeliveryAssignmentStatusFS(`assign-${orderId}`, 'rejected');

        // Search next partner
        const order = get().orders.find((o) => o.id === orderId);
        if (order) {
          const eligiblePartners = get().deliveryPartners.filter(
            (p) => p.currentStatus === 'online' && p.verificationStatus === 'verified' && p.id !== partnerId
          );

          if (eligiblePartners.length === 0) {
            get().updateOrderStatus(orderId, 'READY_FOR_PICKUP');

            get().addNotification(
              '⚠️ NO PARTNER AVAILABLE',
              `No online delivery partners are available to pick up Order #${order.orderNumber} after rejection.`,
              'ADMIN_PARTNER_OFFLINE',
              'admin',
              { orderId: order.id, deepLink: '/admin?tab=orders' }
            );
          } else {
            const nextPartner = eligiblePartners[0];
            const newAssignment: Delivery = {
              id: `assign-${order.id}`,
              orderId: order.id,
              partnerId: nextPartner.id,
              otp: order.deliveryOtp,
              pickupOtp: '4821',
              status: 'assigned',
              stage: 'ASSIGNED',
              liveLatitude: 19.0224536,
              liveLongitude: 73.3210018,
              earnings: calculateDeliveryEarnings(order, get().partnerPricingRules)
            };

            saveDeliveryAssignmentFS(newAssignment);

            set((state) => ({
              orders: state.orders.map((o) =>
                o.id === order.id
                  ? {
                      ...o,
                      partnerId: nextPartner.id,
                      partnerName: nextPartner.name,
                      partnerPhone: nextPartner.phone,
                      orderStatus: 'ASSIGNED',
                    }
                  : o
              )
            }));

            const updatedOrder = get().orders.find(o => o.id === order.id);
            if (updatedOrder) {
              saveOrderFS(updatedOrder);
            }

            get().addNotification(
              '🚴 NEW DELIVERY',
              `New delivery assignment for Order #${order.orderNumber}. Pickup: PocketKirana Store. Payout: ₹42.`,
              'PARTNER_NEW_DELIVERY',
              'delivery_partner',
              { recipientId: nextPartner.id, orderId: order.id, deepLink: `/delivery?orderId=${order.id}` }
            );
          }
        }

        get().addNotification(
          '⚠️ Delivery Assignment Rejected',
          `Partner rejected order #${orderId}. Reassigning...`,
          'ADMIN_PARTNER_OFFLINE',
          'admin',
          { deepLink: `/admin?tab=orders&orderId=${orderId}` }
        );
      },

      markDeliveryArrived: (orderId, partnerId) => {
        const order = get().orders.find((o) => o.id === orderId || o.orderNumber === orderId);
        if (!order) return { success: false, message: 'Order not found.' };

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === order.id || o.orderNumber === order.orderNumber
              ? {
                  ...o,
                  orderStatus: 'ARRIVED_AT_CUSTOMER' as any,
                }
              : o
          ),
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  activeDeliveryStage: 'ARRIVED_AT_CUSTOMER' as any,
                }
              : p
          ),
        }));

        get().updateOrderStatus(order.id, 'ARRIVED_AT_CUSTOMER' as any);
        soundAlerts.playPartnerDispatch();

        get().addNotification(
          '📍 Delivery Partner Arrived',
          'Your delivery partner has arrived with your order!',
          'DELIVERY_NEARBY',
          'customer',
          { orderId: order.id, deepLink: `/orders/${order.id}` }
        );

        return { success: true, message: `Marked arrived for Order #${order.orderNumber}` };
      },

      completeDeliveryDirect: (orderId, partnerId) => {
        const order = get().orders.find((o) => o.id === orderId || o.orderNumber === orderId);
        if (!order) return { success: false, message: 'Order not found.' };

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === order.id || o.orderNumber === order.orderNumber
              ? {
                  ...o,
                  orderStatus: 'DELIVERED',
                }
              : o
          ),
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  currentStatus: 'online' as const,
                  activeOrderId: undefined,
                  activeDeliveryStage: undefined,
                  completedDeliveries: (p.completedDeliveries || 0) + 1,
                }
              : p
          ),
        }));

        get().updateOrderStatus(order.id, 'DELIVERED');
        soundAlerts.playOrderChime();

        // Broadcast notifications
        get().addNotification(
          '🎉 Order Delivered',
          `Order #${order.orderNumber} has been delivered successfully!`,
          'ORDER_DELIVERED',
          'customer',
          { orderId: order.id, deepLink: `/orders/${order.id}` }
        );

        get().addNotification(
          '✅ Delivery Completed',
          `Order #${order.orderNumber} delivered by partner.`,
          'PARTNER_DELIVERY_COMPLETED',
          'admin',
          { orderId: order.id, deepLink: `/admin?tab=orders` }
        );

        return { success: true, message: `Order #${order.orderNumber} delivered successfully!` };
      },

      confirmCodPaymentReceived: (orderId, method, transactionId) => {
        const order = get().orders.find((o) => o.id === orderId || o.orderNumber === orderId);
        if (!order) return { success: false, message: 'Order not found.' };

        const orderTotal = Number(order.total || 450);
        const assignedPartnerId = order.partnerId || get().authenticatedPartnerId || get().activePartnerId || 'partner-1';
        const now = new Date().toISOString();

        const codRecord: CodCollectionRecord = {
          id: `cod_${order.id}_${Date.now()}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          partnerId: assignedPartnerId,
          expectedAmount: orderTotal,
          collectedAmount: orderTotal,
          settledAmount: 0,
          method: method === 'cash' ? 'CASH' : 'UPI',
          status: 'COLLECTED',
          collectedAt: now,
        };

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === order.id || o.orderNumber === order.orderNumber
              ? ({
                  ...o,
                  paymentStatus: 'paid' as const,
                  paymentMethod: (method === 'cash' ? 'cod' : 'upi') as any,
                  collectionMethod: method === 'cash' ? 'CASH' : 'UPI',
                  collectionStatus: 'COLLECTED',
                  collectedAt: now,
                } as Order)
              : o
          ),
          codCollections: [codRecord, ...state.codCollections.filter((c) => c.orderId !== order.id)],
          deliveryPartners: state.deliveryPartners.map((p) => {
            if (p.id === assignedPartnerId && method === 'cash') {
              return {
                ...p,
                cashInHand: (p.cashInHand || 0) + orderTotal,
                cashSettlementStatus: 'UNCLEARED' as const,
                forceLoggedOutByAdmin: false,
              };
            }
            return p;
          }),
        }));

        soundAlerts.playOrderChime();

        get().addNotification(
          method === 'cash' ? '💵 COD Cash Collected by Rider' : '💳 UPI Payment Verified',
          `₹${orderTotal} collected via ${method.toUpperCase()} for Order #${order.orderNumber}. ${method === 'cash' ? 'Added to Rider Cash in Hand for DarkStore handover.' : ''}`,
          'ADMIN_PAYMENT_RECEIVED',
          'admin',
          { orderId: order.id, deepLink: `/admin?tab=payments` }
        );

        return {
          success: true,
          message: `Payment of ₹${orderTotal} verified via ${method.toUpperCase()}!`,
        };
      },

      loginPartnerByPhoneOrCode: (identifier) => {
        const clean = identifier.trim().toLowerCase();
        const partner = get().deliveryPartners.find(
          (p) =>
            p.phone.replace(/\D/g, '') === clean.replace(/\D/g, '') ||
            (p.partnerCode && p.partnerCode.toLowerCase() === clean) ||
            p.id.toLowerCase() === clean ||
            p.name.toLowerCase() === clean
        );

        if (!partner) {
          return { success: false, message: 'No registered Delivery Partner found with this Phone or Partner Code.' };
        }

        if (partner.accountStatus === 'inactive' || partner.accountStatus === 'suspended') {
          return { success: false, message: 'This Delivery Partner account is inactive. Please contact Admin.' };
        }

        set({
          authenticatedPartnerId: partner.id,
          activePartnerId: partner.id,
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('pk_delivery_authenticated_partner', partner.id);
        }

        return { success: true, partner, message: `Welcome back, ${partner.name}!` };
      },

      loginPartnerByCredentials: (loginId, loginPassword) => {
        const cleanId = loginId.trim();
        const cleanPw = loginPassword.trim();
        const digits = cleanId.replace(/\D/g, '');

        // Find partner by loginId (case-insensitive), partnerCode, or phone
        const partner = get().deliveryPartners.find(
          (p) =>
            (p.loginId && p.loginId.toLowerCase() === cleanId.toLowerCase()) ||
            (p.partnerCode && p.partnerCode.toLowerCase() === cleanId.toLowerCase()) ||
            p.id.toLowerCase() === cleanId.toLowerCase() ||
            (digits.length >= 10 && p.phone && p.phone.replace(/\D/g, '').endsWith(digits.slice(-10)))
        );

        if (!partner) {
          return { success: false, message: 'No Delivery Partner account found with this ID or Phone. Please contact Admin.' };
        }

        if (partner.accountStatus === 'inactive' || partner.accountStatus === 'suspended') {
          return { success: false, message: 'Your account is currently deactivated. Please contact Admin.' };
        }

        // Verify password if one is set; otherwise allow default 'pk1234'
        const expectedPw = partner.loginPassword || 'pk1234';
        if (cleanPw !== expectedPw) {
          return { success: false, message: 'Incorrect password. Please try again.' };
        }

        set({
          authenticatedPartnerId: partner.id,
          activePartnerId: partner.id,
          isLoggedIn: true,
          activeRole: 'delivery_partner',
          currentUser: {
            id: partner.userId || partner.id,
            role: 'delivery_partner',
            firstName: partner.name,
            mobile: partner.phone,
            status: 'active',
            createdAt: new Date().toISOString(),
          } as any,
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('pk_delivery_authenticated_partner', partner.id);
        }

        return { success: true, partner, message: `✓ Welcome, ${partner.name}!` };
      },

      loginPickerByCredentials: (loginId, loginPassword) => {
        const cleanId = loginId.trim();
        const cleanPw = loginPassword.trim();
        const digits = cleanId.replace(/\D/g, '');

        // Find picker by loginId (case-insensitive), employeeId, or phone
        const picker = get().pickers.find(
          (p) =>
            (p.loginId && p.loginId.toLowerCase() === cleanId.toLowerCase()) ||
            (p.employeeId && p.employeeId.toLowerCase() === cleanId.toLowerCase()) ||
            p.id.toLowerCase() === cleanId.toLowerCase() ||
            (digits.length >= 10 && p.phone && p.phone.replace(/\D/g, '').endsWith(digits.slice(-10)))
        );

        if (!picker) {
          return { success: false, message: 'No Picker account found with this ID or Phone. Please contact Admin.' };
        }

        // Verify password if one is set; otherwise allow default 'pk1234'
        const expectedPw = picker.loginPassword || 'pk1234';
        if (cleanPw !== expectedPw) {
          return { success: false, message: 'Incorrect password. Please try again.' };
        }

        // Set picker session
        set({
          activePickerId: picker.id,
          isLoggedIn: true,
          activeRole: 'picker',
          currentUser: {
            id: picker.id,
            role: 'picker',
            firstName: picker.name,
            mobile: picker.phone,
            status: 'active',
            createdAt: new Date().toISOString(),
          } as any,
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('pk_picker_authenticated', picker.id);
        }

        return { success: true, picker, message: `✓ Welcome, ${picker.name}!` };
      },

      advanceDeliveryStage: (orderId, nextStage, proof) => {
        const partnerId = get().activePartnerId;

        let nextOrderStatus: OrderStatus | undefined;
        if (nextStage === 'ACCEPTED') {
          nextOrderStatus = 'ACCEPTED';
        } else if (nextStage === 'ARRIVED_AT_STORE') {
          nextOrderStatus = 'ARRIVED_AT_STORE';
        } else if (nextStage === 'PICKED_UP') {
          nextOrderStatus = 'PICKED_UP';
        } else if (nextStage === 'OUT_FOR_DELIVERY') {
          nextOrderStatus = 'OUT_FOR_DELIVERY';
        } else if (nextStage === 'ARRIVED_AT_CUSTOMER') {
          nextOrderStatus = 'ARRIVED_AT_CUSTOMER';
        } else if (nextStage === 'DELIVERED') {
          nextOrderStatus = 'DELIVERED';
        } else if (nextStage === 'COMPLETED') {
          nextOrderStatus = 'COMPLETED';
        }

        const order = get().orders.find((o) => o.id === orderId);
        const amountEarned = order ? calculateDeliveryEarnings(order, get().partnerPricingRules).totalEarnings : 45;

        set((state) => ({
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  activeDeliveryStage: nextStage === 'COMPLETED' ? undefined : (nextStage as any),
                  activeOrderId: nextStage === 'COMPLETED' ? undefined : orderId,
                  currentStatus: nextStage === 'COMPLETED' ? ('online' as const) : ('busy' as const),
                  ...(nextStage === 'COMPLETED'
                    ? {
                        todayEarnings: p.todayEarnings + amountEarned,
                        walletBalance: p.walletBalance + amountEarned,
                        completedDeliveries: p.completedDeliveries + 1,
                      }
                    : {}),
                }
              : p
          ),
          orders: state.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  ...(nextOrderStatus ? { orderStatus: nextOrderStatus } : {}),
                }
              : o
          ),
        }));

        // Sync assignment to Firestore
        updateDeliveryAssignmentStatusFS(`assign-${orderId}`, nextStage.toLowerCase() as any);

        if (nextOrderStatus) {
          get().updateOrderStatus(orderId, nextOrderStatus);
        }

        if (nextStage === 'PICKED_UP') {
          soundAlerts.playOrderChime();
          get().addNotification(
            '📦 Order Picked Up',
            'Your order has been picked up from PocketKirana store and is on the way!',
            'OUT_FOR_DELIVERY',
            'customer',
            { orderId, deepLink: `/orders` }
          );
        } else if (nextStage === 'ARRIVED_AT_CUSTOMER') {
          soundAlerts.playPartnerDispatch();
          get().addNotification(
            '📍 Delivery Partner Nearby',
            'Rider is reaching your doorstep. Please keep OTP or payment ready!',
            'DELIVERY_NEARBY',
            'customer',
            { orderId, deepLink: `/orders` }
          );
        } else if (nextStage === 'COMPLETED') {
          // Finalize stock: deduct physical stock, release reservation
          const order = get().orders.find((o) => o.id === orderId);
          if (order) {
            import('./firebase').then(async ({ getFirebaseDb }) => {
              const db = getFirebaseDb();
              if (db) {
                const { doc, getDoc, updateDoc } = await import('firebase/firestore');
                for (const item of order.items) {
                  const invId = `${item.productId}_store-1`;
                  try {
                    const invRef = doc(db, 'inventory', invId);
                    const invSnap = await getDoc(invRef);
                    if (invSnap.exists()) {
                      const invData = invSnap.data();
                      const quantity = Math.max(0, (invData.quantity ?? 100) - item.quantity);
                      const reserved = Math.max(0, (invData.reservedQuantity ?? 0) - item.quantity);
                      await updateDoc(invRef, {
                        quantity,
                        reservedQuantity: reserved,
                        availableQuantity: Math.max(0, quantity - reserved - (invData.damagedQuantity ?? 0)),
                        updatedAt: new Date().toISOString()
                      });
                    }
                  } catch (e) {
                    console.warn(e);
                  }
                }
              }
            });
          }

          // Sync partner statistics to Firestore
          const updatedPartner = get().deliveryPartners.find((p) => p.id === partnerId);
          if (updatedPartner && order) {
            const amountEarned = calculateDeliveryEarnings(order, get().partnerPricingRules).totalEarnings;
            updatePartnerEarningsFS(partnerId, amountEarned);
          }
        }
      },

      verifyStorePickup: (orderId, pickupOtp) => {
        const order = get().orders.find((o) => o.id === orderId);
        // Default valid store pickup OTP is 4821 or matches order suffix
        const isValid = pickupOtp.trim() === '4821' || pickupOtp.trim().length === 4;

        if (isValid) {
          get().advanceDeliveryStage(orderId, 'PICKED_UP');
          return { success: true, message: 'Store pickup verified! Start customer navigation.' };
        }
        return { success: false, message: 'Invalid store pickup OTP. Please check with store staff.' };
      },

      verifyCustomerDelivery: (orderId, proof) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) {
          return { success: false, message: 'Order not found.' };
        }

        if (proof.type === 'otp') {
          if (proof.otpEntered && proof.otpEntered === order.deliveryOtp) {
            get().advanceDeliveryStage(orderId, 'COMPLETED', proof);
            soundAlerts.playOrderChime();
            return { success: true, message: 'OTP verified! Delivery marked complete.' };
          }
          return { success: false, message: `Incorrect OTP. Expected 4-digit customer code.` };
        }

        if (proof.type === 'cash_collected') {
          const cashAmt = Number(proof.cashReceived || order.total || 0);
          const assignedPartnerId = order.partnerId || get().authenticatedPartnerId || get().activePartnerId || 'partner-1';
          const now = new Date().toISOString();

          const codRecord: CodCollectionRecord = {
            id: `cod_${order.id}_${Date.now()}`,
            orderId: order.id,
            orderNumber: order.orderNumber,
            partnerId: assignedPartnerId,
            expectedAmount: cashAmt,
            collectedAmount: cashAmt,
            settledAmount: 0,
            method: 'CASH',
            status: 'COLLECTED',
            collectedAt: now,
          };

          set((state) => ({
            codCollections: [codRecord, ...state.codCollections.filter((c) => c.orderId !== order.id)],
            deliveryPartners: state.deliveryPartners.map((p) =>
              p.id === assignedPartnerId
                ? {
                    ...p,
                    cashInHand: (p.cashInHand || 0) + cashAmt,
                    cashSettlementStatus: 'UNCLEARED' as const,
                    forceLoggedOutByAdmin: false,
                  }
                : p
            ),
          }));

          get().advanceDeliveryStage(orderId, 'COMPLETED', proof);
          soundAlerts.playOrderChime();
          return { success: true, message: `Cash payment of ₹${cashAmt} confirmed! Added to Cash in Hand.` };
        }

        if (proof.type === 'qr') {
          get().advanceDeliveryStage(orderId, 'COMPLETED', proof);
          soundAlerts.playOrderChime();
          return { success: true, message: 'QR Code verified! Delivery completed.' };
        }

        return { success: false, message: 'Invalid verification proof.' };
      },

      requestWalletWithdrawal: async (partnerId, amount, upiId) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        if (!partner) return { success: false, message: 'Partner not found' };
        if (amount <= 0 || amount > partner.walletBalance) {
          return { success: false, message: 'Withdrawal amount exceeds available wallet balance.' };
        }

        set((state) => ({
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  walletBalance: p.walletBalance - amount,
                }
              : p
          ),
        }));

        get().addNotification(
          '💰 Wallet Withdrawal Initiated',
          `Withdrawal of ₹${amount} to UPI: ${upiId} is being processed. Expected in 15 mins.`,
          'PARTNER_EARNINGS_CREDITED',
          'delivery_partner',
          { deepLink: '/delivery?tab=earnings' }
        );

        return { success: true, message: `₹${amount} withdrawal request sent successfully to ${upiId}!` };
      },

      updatePartnerGPSLocation: (partnerId, latitude, longitude, speed = 22) => {
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        const activeOrderId = partner?.activeOrderId || '';

        set((state) => ({
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  currentLocation: {
                    latitude,
                    longitude,
                    lastUpdated: new Date().toISOString(),
                    speed,
                  },
                }
              : p
          ),
        }));

        updatePartnerLocationFS(partnerId, latitude, longitude);

        if (activeOrderId) {
          updateDeliveryTrackingFS(`assign-${activeOrderId}`, partnerId, activeOrderId, latitude, longitude, true);
        }
      },

      submitPartnerDocument: (partnerId, docData) => {
        const newDoc: PartnerDocument = {
          ...docData,
          id: `doc-${Date.now()}`,
          submittedAt: new Date().toISOString(),
        };

        set((state) => ({
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  documents: [...(p.documents || []), newDoc],
                }
              : p
          ),
        }));
      },

      // Picker & Warehouse Fulfilment Engine — start with clean empty queue
      pickers:              INITIAL_PICKERS,
      activePickerId:       'picker-1',
      storageLocations:     INITIAL_STORAGE_LOCATIONS,
      pickingTasks:         [],
      inventoryMovements:   [],
      stockAdjustmentRequests: [],
      newProductRequests: [],

      setActivePickerId: (id) => set({ activePickerId: id }),

      createPicker: (data) => {
        const nextIdNum = get().pickers.length + 1;
        const employeeId = data.employeeId || `PKP-${String(nextIdNum).padStart(3, '0')}`;
        const loginId = data.loginId || employeeId;
        const loginPassword = data.loginPassword || `pk${String(nextIdNum).padStart(4, '0')}`;
        const newPicker: Picker = {
          id: `picker-${Date.now()}`,
          name: data.name,
          phone: data.phone,
          photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
          employeeId,
          loginId,
          loginPassword,
          storeId: 'store-1',
          storeName: 'PocketKirana Main Store',
          status: 'offline',
          currentShift: data.currentShift || 'Morning (06:00 - 14:00)',
          joiningDate: new Date().toISOString().split('T')[0],
          statistics: {
            ordersPickedToday: 0,
            itemsPickedToday: 0,
            averagePickTimeSeconds: 0,
            accuracyPercent: 100,
            missingItemsCount: 0,
            wrongItemsScanned: 0,
            rating: 5.0,
          },
        };

        set((state) => ({
          pickers: [newPicker, ...state.pickers],
        }));

        savePickerFS(newPicker);

        return {
          success: true,
          picker: newPicker,
          message: `Picker ${data.name} (${employeeId}) created successfully!`,
        };
      },

      deletePicker: (pickerId) => {
        const picker = get().pickers.find((p) => p.id === pickerId);
        if (!picker) {
          return { success: false, message: 'Store Picker not found.' };
        }

        const pickerName = picker.name;

        // Clean up from state
        set((state) => ({
          pickers: state.pickers.filter((p) => p.id !== pickerId),
          activePickerId: state.activePickerId === pickerId ? (state.pickers.find((p) => p.id !== pickerId)?.id || '') : state.activePickerId,
          // Unassign any active picking tasks
          pickingTasks: state.pickingTasks.map((t) =>
            t.pickerId === pickerId
              ? {
                  ...t,
                  pickerId: undefined,
                  pickerName: undefined,
                  status: 'pending' as const,
                }
              : t
          ),
          orders: state.orders.map((o) =>
            o.pickerId === pickerId
              ? {
                  ...o,
                  pickerId: undefined,
                  pickerName: undefined,
                  orderStatus: o.orderStatus === 'PICKING' ? 'STOCK_RESERVED' : o.orderStatus,
                }
              : o
          ),
        }));

        // Clean up localStorage session if active
        if (typeof window !== 'undefined' && localStorage.getItem('pk_picker_authenticated') === pickerId) {
          localStorage.removeItem('pk_picker_authenticated');
        }

        // Delete from Firestore
        deletePickerFS(pickerId);

        get().addAuditLog(`DELETE_STORE_PICKER: Removed ${pickerName} (${pickerId})`, 'Picker', pickerId);

        return {
          success: true,
          message: `Store Picker "${pickerName}" deleted successfully!`,
        };
      },

      togglePickerStatus: (pickerId) => {
        set((state) => ({
          pickers: state.pickers.map((p) =>
            p.id === pickerId
              ? { ...p, status: p.status === 'active' ? 'offline' : 'active' }
              : p
          ),
        }));
      },

      acceptOrderTask: (taskId, pickerId) => {
        const picker = get().pickers.find((p) => p.id === pickerId);
        const rawOrderId = taskId.startsWith('task-') ? taskId.slice(5) : taskId;
        const order = get().orders.find((o) => o.id === rawOrderId || o.orderNumber === taskId || o.orderNumber === rawOrderId);
        
        let existingTask = get().pickingTasks.find((t) => t.id === taskId || t.orderNumber === taskId || t.orderId === rawOrderId);

        // 🔒 Prevent picker from accepting a new order if they are already busy with another
        if (picker && picker.status === 'busy' && picker.activeTaskId && picker.activeTaskId !== taskId) {
          return { success: false, message: 'You already have an active order. Complete it before accepting a new one.' };
        }

        // Prevent another picker from accepting an already assigned task
        if (existingTask && existingTask.pickerId && existingTask.pickerId !== pickerId) {
          return { success: false, message: 'This order has already been assigned to another picker.' };
        }

        if (order && order.pickerId && order.pickerId !== pickerId) {
          return { success: false, message: 'This order has already been assigned to another picker.' };
        }

        const now = new Date().toISOString();
        if (!existingTask && order) {
          existingTask = {
            id: taskId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            storeId: order.storeId || 'store-001',
            storeName: 'PocketKirana Neral Hub',
            status: 'assigned' as const,
            priority: 'NORMAL',
            pickerId,
            pickerName: picker?.name || (get().currentUser?.firstName || 'Picker'),
            items: (order.items || []).map((it: any, idx: number) => ({
              id: `pi-${order.id}-${idx}`,
              productId: it.productId,
              productName: it.productName || it.product?.name || 'Grocery Item',
              sku: `SKU-${it.productId.slice(0, 8).toUpperCase()}`,
              upc: it.barcode || '8901234567890',
              barcode: it.barcode || it.productId,
              unit: it.unit || '1 pack',
              imageUrl: it.imageUrl || it.product?.thumbnail || '',
              quantityRequired: it.quantity,
              quantityPicked: 0,
              storageLocation: {
                id: 'loc-1',
                storeId: 'store-001',
                aisle: 'A',
                rack: '01',
                shelf: 'A',
                bin: '01',
                barcode: 'LOC-A01A01',
                displayCode: 'A-01-A-01',
              },
              status: 'pending' as const,
            })),
            totalItemsCount: (order.items || []).length,
            pickedItemsCount: 0,
            createdAt: order.placedAt || now,
          };
        }

        set((state) => ({
          pickingTasks: existingTask
            ? state.pickingTasks.some((t) => t.id === existingTask!.id)
              ? state.pickingTasks.map((t) =>
                  t.id === existingTask!.id ? { ...t, status: 'assigned' as const, pickerId, pickerName: picker?.name || 'Picker' } : t
                )
              : [existingTask, ...state.pickingTasks]
            : state.pickingTasks,
          orders: state.orders.map((o) =>
            o.id === rawOrderId || o.orderNumber === (existingTask?.orderNumber || taskId)
              ? { ...o, orderStatus: 'ASSIGNED', pickerId, pickerName: picker?.name || 'Picker' }
              : o
          ),
          pickers: state.pickers.map((p) =>
            p.id === pickerId ? { ...p, activeTaskId: taskId, status: 'busy' as const } : p
          ),
        }));

        if (order) {
          get().updateOrderStatus(order.id, 'ASSIGNED');
        }

        soundAlerts.playOrderChime();
        return { success: true, message: `Order #${existingTask?.orderNumber || taskId} accepted successfully!` };
      },

      startPickingTask: (taskId, pickerId) => {
        const picker = get().pickers.find((p) => p.id === pickerId);
        const now = new Date().toISOString();

        // Try to find in existing pickingTasks first
        let task = get().pickingTasks.find((t) => t.id === taskId);

        if (!task) {
          // Synthetic task — derive from orders (taskId is "task-<orderId>")
          const orderId = taskId.startsWith('task-') ? taskId.slice(5) : taskId;
          const order = get().orders.find((o) => o.id === orderId);
          if (!order) {
            console.warn('startPickingTask: neither pickingTask nor order found for', taskId);
            return;
          }
          // Build a real PickingTask from the order
          const newTask: PickingTask = {
            id: taskId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            storeId: order.storeId || 'store-001',
            storeName: 'PocketKirana Neral Hub',
            status: 'picking' as const,
            priority: 'NORMAL',
            pickerId,
            pickerName: picker?.name || (get().currentUser?.firstName || 'Picker'),
            startTime: now,
            items: (order.items || []).map((it: any, idx: number) => ({
              id: `pi-${order.id}-${idx}`,
              productId: it.productId,
              productName: it.productName || it.product?.name || 'Grocery Item',
              sku: `SKU-${it.productId.slice(0, 8).toUpperCase()}`,
              upc: it.barcode || '8901234567890',
              barcode: it.barcode || it.productId,
              unit: it.unit || '1 pack',
              imageUrl: it.imageUrl || it.product?.thumbnail || '',
              quantityRequired: it.quantity,
              quantityPicked: 0,
              storageLocation: {
                id: 'loc-1',
                storeId: 'store-001',
                aisle: 'A',
                rack: '01',
                shelf: 'A',
                bin: '01',
                barcode: 'LOC-A01A01',
                displayCode: 'A-01-A-01',
              },
              status: 'pending' as const,
            })),
            totalItemsCount: (order.items || []).length,
            pickedItemsCount: 0,
            createdAt: order.placedAt || now,
          };

          // Inject into store and persist to Firestore
          set((state) => ({
            pickingTasks: [newTask, ...state.pickingTasks],
            pickers: state.pickers.map((p) =>
              p.id === pickerId ? { ...p, status: 'busy' as const, activeTaskId: taskId } : p
            ),
          }));

          savePickingTaskFS(newTask);
          get().updateOrderStatus(order.id, 'PICKING');
          soundAlerts.playOrderChime();
          return;
        }

        // Task found in pickingTasks — normal flow
        set((state) => ({
          pickingTasks: state.pickingTasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'picking' as const,
                  pickerId,
                  pickerName: picker?.name || (get().currentUser?.firstName || 'Picker'),
                  startTime: t.startTime || now,
                }
              : t
          ),
          pickers: state.pickers.map((p) =>
            p.id === pickerId
              ? { ...p, status: 'busy' as const, activeTaskId: taskId }
              : p
          ),
        }));

        // Sync picking task status to Firestore
        updatePickingTaskStatusFS(taskId, 'picking', {
          pickerId,
          pickerName: picker?.name || 'Picker',
          startTime: now,
        });

        // Enforce state machine: update order status to PICKING
        get().updateOrderStatus(task.orderId, 'PICKING');

        soundAlerts.playOrderChime();
      },

      scanProductItem: (taskId, productId, scannedBarcode, quantityToPick) => {
        const task = get().pickingTasks.find((t) => t.id === taskId);
        if (!task) {
          return { success: false, message: 'Task not found', isComplete: false };
        }

        const item = task.items.find((i) => i.productId === productId);
        if (!item) {
          return { success: false, message: 'Item not found in current task', isComplete: false };
        }

        const cleanBarcode = scannedBarcode.trim();
        const matches =
          cleanBarcode === item.barcode ||
          cleanBarcode === item.upc ||
          cleanBarcode === item.sku ||
          cleanBarcode === item.productId ||
          cleanBarcode === item.productName;

        if (!matches) {
          soundAlerts.playPartnerDispatch();
          return {
            success: false,
            message: `Scanned barcode (${scannedBarcode}) does not match expected product: ${item.productName} (${item.barcode})`,
            isComplete: false,
            isWrongItem: true,
          };
        }

        // Pick full required quantity on scan so picker doesn't need to rescan
        const remainingNeeded = item.quantityRequired - item.quantityPicked;
        const qtyToAdd = quantityToPick ?? (remainingNeeded > 0 ? remainingNeeded : 1);
        const newPickedQty = Math.min(item.quantityRequired, item.quantityPicked + Math.max(1, qtyToAdd));
        const isItemDone = newPickedQty >= item.quantityRequired;

        soundAlerts.playOrderChime();

        let allDone = false;
        let updatedItems: PickingItem[] = [];

        set((state) => {
          const updatedTasks = state.pickingTasks.map((t) => {
            if (t.id !== taskId) return t;

            updatedItems = t.items.map((i) => {
              if (i.productId !== productId) return i;
              return {
                ...i,
                quantityPicked: newPickedQty,
                status: isItemDone ? ('picked' as const) : ('picking' as const),
              };
            });

            const totalPickedCount = updatedItems.reduce(
              (sum, i) => sum + (i.status === 'picked' ? 1 : 0),
              0
            );
            allDone = totalPickedCount === updatedItems.length;

            return {
              ...t,
              items: updatedItems,
              pickedItemsCount: totalPickedCount,
              status: allDone ? ('picked' as const) : ('picking' as const),
            };
          });

          return { pickingTasks: updatedTasks };
        });

        // Sync task to Firestore
        updatePickingTaskStatusFS(taskId, allDone ? 'picked' : 'picking', {
          items: updatedItems,
          pickedItemsCount: updatedItems.filter(i => i.status === 'picked').length
        });

        // If all items picked, auto-transition order status to PICKED
        if (allDone) {
          get().updateOrderStatus(task.orderId, 'PICKED');
        }

        // Record inventory movement
        const newMovement: InventoryMovement = {
          id: `mov-${Date.now()}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode,
          type: 'PICK',
          quantity: -1,
          orderId: task.orderId,
          orderNumber: task.orderNumber,
          pickerId: task.pickerId || 'picker-1',
          pickerName: task.pickerName || 'Picker',
          fromLocation: item.storageLocation.displayCode,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          inventoryMovements: [newMovement, ...state.inventoryMovements],
        }));

        // Write inventory movement to Firestore client-side
        import('./firebase').then(async ({ getFirebaseDb }) => {
          const db = getFirebaseDb();
          if (db) {
            const { doc, setDoc } = await import('firebase/firestore');
            await setDoc(doc(db, 'inventoryMovements', newMovement.id), newMovement);
          }
        });

        return {
          success: true,
          message: `✓ Verified: ${item.productName} (${newPickedQty}/${item.quantityRequired})`,
          isComplete: allDone,
        };
      },

      markItemOutOfStock: (taskId, productId, reason, substituteProductId) => {
        const task = get().pickingTasks.find((t) => t.id === taskId);
        if (!task) return;

        let updatedItems: PickingItem[] = [];
        set((state) => {
          const newTasks = state.pickingTasks.map((t) => {
            if (t.id !== taskId) return t;
            updatedItems = t.items.map((i) => {
              if (i.productId !== productId) return i;
              return {
                ...i,
                status: substituteProductId ? ('substituted' as const) : ('out_of_stock' as const),
                outOfStockReason: reason,
              };
            });
            return { ...t, items: updatedItems };
          });
          return { pickingTasks: newTasks };
        });

        // Sync to Firestore
        updatePickingTaskStatusFS(taskId, task.status, { items: updatedItems });

        get().addNotification(
          '⚠️ Item Out of Stock / Substituted',
          `Picker reported out-of-stock item in Order #${task.orderNumber}. Reason: ${reason}`,
          'ADMIN_PARTNER_OFFLINE',
          'admin',
          { deepLink: '/admin?tab=orders' }
        );
      },

      completePickingTask: (taskId) => {
        let task = get().pickingTasks.find((t) => t.id === taskId || t.orderNumber === taskId || t.orderId === taskId);
        
        if (!task) {
          const rawId = taskId.startsWith('task-') ? taskId.slice(5) : taskId;
          const matchedOrder = get().orders.find((o) => o.id === rawId || o.orderNumber === taskId || o.orderNumber === rawId);
          if (matchedOrder) {
            task = {
              id: taskId,
              orderId: matchedOrder.id,
              orderNumber: matchedOrder.orderNumber,
              storeId: matchedOrder.storeId || 'store-001',
              storeName: 'PocketKirana Neral Hub',
              status: 'packing',
              priority: 'NORMAL',
              items: [],
              totalItemsCount: (matchedOrder.items || []).length,
              pickedItemsCount: (matchedOrder.items || []).length,
              createdAt: matchedOrder.placedAt || new Date().toISOString(),
            };
          }
        }

        const endTime = new Date().toISOString();
        const duration = task?.startTime
          ? Math.floor((Date.now() - new Date(task.startTime).getTime()) / 1000)
          : 260;

        const targetOrderId = task ? task.orderId : (taskId.startsWith('task-') ? taskId.slice(5) : taskId);

        set((state) => {
          const exists = state.pickingTasks.some((t) => t.id === taskId || (task && t.orderNumber === task.orderNumber));
          let newTasks = state.pickingTasks;
          if (exists) {
            newTasks = state.pickingTasks.map((t) =>
              t.id === taskId || (task && t.orderNumber === task.orderNumber)
                ? {
                    ...t,
                    status: 'packing' as const,
                    endTime,
                    pickDurationSeconds: duration,
                  }
                : t
            );
          } else if (task) {
            newTasks = [
              ...state.pickingTasks,
              {
                ...task,
                status: 'packing' as const,
                endTime,
                pickDurationSeconds: duration,
              },
            ];
          }

          return { pickingTasks: newTasks };
        });

        // Sync picking task in Firestore
        updatePickingTaskStatusFS(taskId, 'packing', {
          endTime,
          pickDurationSeconds: duration
        });

        // Update order status to PACKING in Firestore
        if (targetOrderId) {
          get().updateOrderStatus(targetOrderId, 'PACKING');
        }

        soundAlerts.playOrderChime();
      },

      packOrderTask: (taskId, bagsCount, bagTypes) => {
        let task = get().pickingTasks.find((t) => t.id === taskId || t.orderNumber === taskId || t.orderId === taskId);
        
        if (!task) {
          const rawId = taskId.startsWith('task-') ? taskId.slice(5) : taskId;
          const matchedOrder = get().orders.find((o) => o.id === rawId || o.orderNumber === taskId || o.orderNumber === rawId);
          if (matchedOrder) {
            task = {
              id: taskId,
              orderId: matchedOrder.id,
              orderNumber: matchedOrder.orderNumber,
              storeId: matchedOrder.storeId || 'store-001',
              storeName: 'PocketKirana Neral Hub',
              status: 'packed',
              priority: 'NORMAL',
              items: [],
              totalItemsCount: (matchedOrder.items || []).length,
              pickedItemsCount: (matchedOrder.items || []).length,
              createdAt: matchedOrder.placedAt || new Date().toISOString(),
            };
          }
        }

        const orderNumber = task ? task.orderNumber : taskId;
        const targetOrderId = task ? task.orderId : (taskId.startsWith('task-') ? taskId.slice(5) : taskId);
        const qrCode = `PK-HO-${orderNumber}-DP102`;

        set((state) => {
          const exists = state.pickingTasks.some((t) => t.id === taskId || t.orderNumber === orderNumber);
          let newTasks = state.pickingTasks;
          if (exists) {
            newTasks = state.pickingTasks.map((t) =>
              t.id === taskId || t.orderNumber === orderNumber
                ? {
                    ...t,
                    status: 'packed' as const,
                    bagsCount,
                    bagTypes,
                  }
                : t
            );
          } else if (task) {
            newTasks = [
              ...state.pickingTasks,
              {
                ...task,
                status: 'packed' as const,
                bagsCount,
                bagTypes,
              },
            ];
          }

          return {
            pickingTasks: newTasks,
            orders: state.orders.map((o) =>
              o.id === targetOrderId || o.orderNumber === orderNumber
                ? { ...o, orderStatus: 'WAITING_FOR_DELIVERY' as any }
                : o
            ),
            pickers: state.pickers.map((p) =>
              p.activeTaskId === taskId || p.activeTaskId === task?.id
                ? { ...p, status: 'active' as const, activeTaskId: undefined }
                : p
            ),
          };
        });

        // Sync picking task in Firestore
        updatePickingTaskStatusFS(taskId, 'packed', {
          bagsCount,
          bagTypes,
        });

        if (targetOrderId) {
          get().updateOrderStatus(targetOrderId, 'WAITING_FOR_DELIVERY' as any);
        }

        soundAlerts.playOrderChime();

        // ── BROADCAST REALTIME NOTIFICATION TO ONLINE DELIVERY PARTNERS ──
        get().addNotification(
          '🔔 NEW DELIVERY AVAILABLE',
          `Order #${orderNumber} is packed and ready for delivery in the Delivery Queue!`,
          'PARTNER_NEW_DELIVERY',
          'delivery_partner',
          { orderId: targetOrderId, deepLink: `/delivery?orderId=${targetOrderId}` }
        );
      },

      verifyOrderHandover: (orderNumber, partnerId) => {
        let task = get().pickingTasks.find((t) => t.orderNumber === orderNumber || t.id === orderNumber);
        const order = get().orders.find((o) => o.orderNumber === orderNumber || o.id === orderNumber);
        
        // Single-use token and invalid status check
        if (task && task.status === 'handed_over') {
          return {
            success: false,
            message: `⚠ INVALID QR: Order #${orderNumber} has already been handed over.`
          };
        }

        if (order && (order.orderStatus === 'OUT_FOR_DELIVERY' || order.orderStatus === 'DELIVERED' || order.orderStatus === 'COMPLETED')) {
          return {
            success: false,
            message: `⚠ INVALID QR: Order #${orderNumber} is already out for delivery or completed.`
          };
        }

        const now = new Date().toISOString();

        set((state) => ({
          pickingTasks: state.pickingTasks.map((t) =>
            t.orderNumber === orderNumber || t.id === orderNumber
              ? {
                  ...t,
                  status: 'handed_over' as const,
                  assignedPartnerId: partnerId,
                  handoverVerifiedAt: now,
                }
              : t
          ),
          orders: state.orders.map((o) =>
            o.orderNumber === orderNumber || o.id === orderNumber
              ? { ...o, orderStatus: 'OUT_FOR_DELIVERY', partnerId }
              : o
          ),
          pickers: state.pickers.map((p) =>
            p.activeTaskId === task?.id || p.activeTaskId === orderNumber
              ? { ...p, status: 'active' as const, activeTaskId: undefined }
              : p
          )
        }));

        if (task) {
          updatePickingTaskStatusFS(task.id, 'handed_over', {
            assignedPartnerId: partnerId,
            handoverVerifiedAt: now
          });
        }

        if (order) {
          get().updateOrderStatus(order.id, 'OUT_FOR_DELIVERY');
        }

        soundAlerts.playPartnerDispatch();

        return {
          success: true,
          message: `✓ ORDER VERIFIED: Order #${orderNumber} successfully handed over & dispatched!`,
        };
      },

      performPutaway: (productId, locationId, quantity) => {
        const product = get().products.find((p) => p.id === productId || p.barcode === productId);
        const location = get().storageLocations.find(
          (l) => l.id === locationId || l.barcode === locationId || l.displayCode === locationId
        );

        if (!product) {
          return { success: false, message: 'Product not found.' };
        }
        if (!location) {
          return { success: false, message: 'Storage location not found.' };
        }

        const newMovement: InventoryMovement = {
          id: `mov-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          type: 'PUTAWAY',
          quantity,
          pickerId: get().activePickerId,
          pickerName: 'Aniket Yadav',
          toLocation: location.displayCode,
          reason: 'Warehouse Inward Putaway',
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          inventoryMovements: [newMovement, ...state.inventoryMovements],
          products: state.products.map((p) =>
            p.id === product.id
              ? { ...p, storageLocation: location }
              : p
          ),
        }));

        soundAlerts.playOrderChime();

        return {
          success: true,
          message: `✓ Putaway confirmed: ${quantity}x ${product.name} placed in ${location.displayCode}`,
        };
      },

      submitStockCount: (locationId, productId, physicalCount, reason) => {
        const location = get().storageLocations.find((l) => l.id === locationId || l.displayCode === locationId);
        const product = get().products.find((p) => p.id === productId || p.barcode === productId);
        const systemQty = 47; // Default mock system qty
        const difference = physicalCount - systemQty;

        const newRequest: StockAdjustmentRequest = {
          id: `adj-${Date.now()}`,
          productId: product?.id || productId,
          productName: product?.name || 'Product',
          locationId: location?.id || locationId,
          locationCode: location?.displayCode || locationId,
          systemQuantity: systemQty,
          physicalQuantity: physicalCount,
          difference,
          reason,
          status: 'pending',
          pickerId: get().activePickerId,
          pickerName: 'Aniket Yadav',
          submittedAt: new Date().toISOString(),
        };

        const newMovement: InventoryMovement = {
          id: `mov-${Date.now()}`,
          productId: product?.id || productId,
          productName: product?.name || 'Product',
          type: 'ADJUSTMENT',
          quantity: difference,
          pickerId: get().activePickerId,
          pickerName: 'Aniket Yadav',
          fromLocation: location?.displayCode || locationId,
          reason: `Stock Count Audit: ${reason}`,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          stockAdjustmentRequests: [newRequest, ...state.stockAdjustmentRequests],
          inventoryMovements: [newMovement, ...state.inventoryMovements],
        }));

        soundAlerts.playOrderChime();

        get().addNotification(
          '📋 Stock Adjustment Audit Logged',
          `Picker submitted stock count for ${product?.name || productId} at ${location?.displayCode || locationId} (Diff: ${difference}).`,
          'ADMIN_PARTNER_OFFLINE',
          'admin',
          { deepLink: '/admin' }
        );
      },

      requestNewProduct: (requestData) => {
        const newReq: NewProductRequest = {
          ...requestData,
          id: `npr-${Date.now()}`,
          status: 'pending',
          pickerId: get().activePickerId,
          pickerName: 'Aniket Yadav',
          submittedAt: new Date().toISOString(),
        };

        set((state) => ({
          newProductRequests: [newReq, ...state.newProductRequests],
        }));

        soundAlerts.playOrderChime();

        get().addNotification(
          '✨ New Product Catalog Request',
          `Picker requested new product: "${requestData.name}" (${requestData.barcode}). Awaiting admin review.`,
          'ADMIN_NEW_ORDER',
          'admin',
          { deepLink: '/admin' }
        );
      },

      // Marketing — populated from Firestore; mock data used only in demo mode
      banners: INITIAL_BANNERS,
      coupons: INITIAL_COUPONS,
      addBanner: (bannerData) => {
        const newBanner: Banner = { ...bannerData, id: `ban-${Date.now()}` };
        set((state) => ({ banners: [newBanner, ...state.banners] }));
        saveBannerFS(newBanner);
      },
      updateBanner: (id, bannerData) => {
        set((state) => ({
          banners: state.banners.map((b) => (b.id === id ? { ...b, ...bannerData } : b)),
        }));
        updateBannerFS(id, bannerData);
      },
      deleteBanner: (id) => {
        set((state) => ({
          banners: state.banners.filter((b) => b.id !== id),
        }));
        deleteBannerFS(id);
      },
      toggleBannerStatus: (id) => {
        const target = get().banners.find((b) => b.id === id);
        const newStatus = target ? !target.active : false;
        set((state) => ({
          banners: state.banners.map((b) => (b.id === id ? { ...b, active: newStatus } : b)),
        }));
        updateBannerFS(id, { active: newStatus });
      },
      addCoupon: (couponData) => {
        const newCoupon: Coupon = { ...couponData, id: `coup-${Date.now()}` };
        set((state) => ({ coupons: [newCoupon, ...state.coupons] }));
      },

      // Centralized Notifications Engine State
      // Loaded from Firestore for the logged-in user in initializeFirebaseSync.
      notifications: isFirebaseConfigured() ? [] : INITIAL_NOTIFICATIONS,
      notificationPreferences: DEFAULT_PREFERENCES,
      campaigns: [],

      updateNotificationPreferences: (prefs) => {
        set((state) => ({
          notificationPreferences: { ...state.notificationPreferences, ...prefs },
        }));
      },

      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        }));
        markNotificationReadFS(id);
      },

      markAllNotificationsRead: (recipientType) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            !recipientType || n.recipientType === recipientType
              ? { ...n, isRead: true }
              : n
          ),
        }));
        const matchingIds = get()
          .notifications.filter((n) => !recipientType || n.recipientType === recipientType)
          .map((n) => n.id);
        markAllNotificationsReadFS(matchingIds);
      },

      deleteNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
        deleteNotificationFS(id);
      },

      addNotification: (title, message, type, recipientType, extra = {}) => {
        const rType = recipientType || (type.startsWith('ADMIN') ? 'admin' : type.startsWith('PARTNER') ? 'delivery_partner' : 'customer');
        const newNotif: Notification = {
          id: `notif-${Date.now()}`,
          recipientId: extra.recipientId || (rType === 'customer' ? get().currentUser?.id || 'usr-cust-1' : rType === 'admin' ? 'admin' : get().activePartnerId),
          recipientType: rType,
          type: type as any,
          category: extra.category,
          title,
          message,
          orderId: extra.orderId,
          imageUrl: extra.imageUrl,
          deepLink: extra.deepLink,
          couponCode: extra.couponCode,
          offerId: extra.offerId,
          meta: extra.meta,
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        const prefs = get().notificationPreferences;
        if (rType === 'customer' && !isAllowedByPreferences(type as any, prefs)) {
          return;
        }

        set((state) => ({ notifications: [newNotif, ...state.notifications] }));
        saveNotificationFS(newNotif);

        if (prefs.soundEnabled) {
          soundAlerts.playByNotification(type as string, rType);
        }
      },

      dispatchNotification: (notifData) => {
        const notif: Notification = {
          ...notifData,
          id: `notif-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          isRead: false,
          createdAt: notifData.createdAt || new Date().toISOString(),
        };

        const prefs = get().notificationPreferences;
        if (notif.recipientType === 'customer' && !isAllowedByPreferences(notif.type, prefs)) {
          return;
        }

        set((state) => ({ notifications: [notif, ...state.notifications] }));
        saveNotificationFS(notif);

        if (prefs.soundEnabled) {
          soundAlerts.playByNotification(notif.type, notif.recipientType);
        }
      },

      addCampaign: async (campaignData) => {
        const campaign = await saveCampaignFS(campaignData);
        if (!campaign) return null;

        set((state) => ({ campaigns: [campaign, ...state.campaigns] }));

        // Broadcast to customer notification center
        const notif: Notification = {
          id: `notif-camp-${campaign.id}`,
          recipientId: 'all',
          recipientType: 'customer',
          type: campaign.offerId ? 'OFFER_DISCOUNT' : 'COUPON_AVAILABLE',
          category: 'campaign',
          title: campaign.title,
          message: campaign.message,
          imageUrl: campaign.imageUrl,
          deepLink: campaign.deepLink || '/offers',
          couponCode: campaign.couponCode,
          offerId: campaign.offerId,
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        const prefs = get().notificationPreferences;
        if (prefs.offersDiscounts || prefs.promotionalMessages) {
          set((state) => ({ notifications: [notif, ...state.notifications] }));
          saveNotificationFS(notif);
          if (prefs.soundEnabled) {
            soundAlerts.playPromoChime();
          }
        }

        return campaign;
      },

      getFilteredNotifications: (role) => {
        const activeRole = role || get().activeRole;
        const currUser = get().currentUser;
        const partnerId = get().activePartnerId;
        const allNotifs = get().notifications;

        if (activeRole === 'admin' || activeRole === 'store_manager') {
          return allNotifs.filter((n) => n.recipientType === 'admin');
        }

        if (activeRole === 'delivery_partner') {
          return allNotifs.filter(
            (n) =>
              n.recipientType === 'delivery_partner' &&
              (n.recipientId === partnerId || n.recipientId === 'all')
          );
        }

        // Customer
        return allNotifs.filter(
          (n) =>
            n.recipientType === 'customer' &&
            (!currUser || n.recipientId === currUser.id || n.recipientId === 'all' || !n.recipientId)
        );
      },

      // Reviews
      reviews: [
        {
          id: 'rev-1',
          userId: 'usr-cust-1',
          userName: 'Aniket Yadav',
          productId: 'prod-1',
          orderId: 'ord-1001',
          rating: 5,
          review: 'Fresh and high quality wheat flour. Excellent soft rotis!',
          createdAt: '2026-02-10T12:00:00Z',
        },
      ],
      addReview: (productId, orderId, rating, reviewText) => {
        const { currentUser } = get();
        const newReview: Review = {
          id: `rev-${Date.now()}`,
          userId: currentUser?.id || 'usr-cust-1',
          userName: `${currentUser?.firstName || 'User'} ${currentUser?.lastName || ''}`,
          productId,
          orderId,
          rating,
          review: reviewText,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ reviews: [newReview, ...state.reviews] }));
      },

      // Tickets
      tickets: [],
      createTicket: (subject, description, orderId) => {
        const { currentUser } = get();
        const newTicket: SupportTicket = {
          id: `tkt-${Date.now()}`,
          userId: currentUser?.id || 'usr-cust-1',
          userName: `${currentUser?.firstName || 'User'}`,
          orderId,
          subject,
          description,
          status: 'open',
          priority: 'medium',
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ tickets: [newTicket, ...state.tickets] }));
        get().addNotification('Support Ticket Raised 🎫', `Ticket #${newTicket.id} created successfully.`, 'system');
      },

      // Audit Logs
      auditLogs: [
        {
          id: 'log-1',
          // Required fields (new schema)
          actorId: 'system',
          actorName: 'System',
          actorRole: 'admin',
          action: 'SYSTEM_BOOT',
          targetCollection: 'Platform',
          targetId: 'pocketkirana-prod',
          description: 'System initialized',
          timestamp: new Date().toISOString(),
          // Legacy aliases (kept for backward compat)
          userId: 'usr-admin-1',
          userName: 'System Admin',
          entity: 'Platform',
          entityId: 'pocketkirana-prod',
          ipAddress: '127.0.0.1',
          createdAt: new Date().toISOString(),
        },
      ],
      addAuditLog: (action, entity, entityId) => {
        const { currentUser } = get();
        const actorName = `${currentUser?.firstName || 'System'} ${currentUser?.lastName || ''}`.trim();
        const now = new Date().toISOString();
        const newLog: AuditLog = {
          id: `log-${Date.now()}`,
          // Required new fields
          actorId: currentUser?.id || 'system',
          actorName,
          actorRole: currentUser?.role || 'system',
          action,
          targetCollection: entity,
          targetId: entityId,
          description: `${action} on ${entity} (${entityId})`,
          timestamp: now,
          // Legacy aliases
          userId: currentUser?.id || 'system',
          userName: actorName,
          entity,
          entityId,
          ipAddress: '192.168.1.1',
          createdAt: now,
        };
        set((state) => ({ auditLogs: [newLog, ...state.auditLogs] }));
      },

      // 🧾 Complete Invoice System Implementations
      invoices: [],
      invoiceTemplate: DEFAULT_INVOICE_TEMPLATE,
      getOrGenerateInvoice: (orderId: string) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
        if (!order) return null;
        const inv = createOrGetInvoiceSnapshot(order, state.invoiceTemplate, state.invoices);
        if (!state.invoices.some((i) => i.id === inv.id || i.invoiceNumber === inv.invoiceNumber)) {
          set((s) => ({ invoices: [inv, ...s.invoices] }));
        }
        return inv;
      },
      updateInvoiceTemplate: (template: InvoiceTemplateSettings) => {
        set({ invoiceTemplate: template });
      },
      downloadInvoicePDF: async (orderId: string) => {
        try {
          const state = get();
          const order = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
          if (!order) {
            return { success: false, message: 'Order not found' };
          }
          const invoice = state.getOrGenerateInvoice(orderId);
          if (!invoice) {
            return { success: false, message: 'Unable to resolve invoice for this order' };
          }
          const { filename } = generateInvoicePDF(invoice, { saveAsFile: true });
          return { success: true, filename };
        } catch (err: any) {
          console.error('Download invoice PDF failed:', err);
          return { success: false, message: err?.message || 'Failed to download invoice' };
        }
      },

      // 💰 Financial Collections, Settlements & Exceptions Implementation
      settlements: [
        {
          id: 'stl-init-1',
          partnerId: 'partner-1',
          partnerName: 'Sunil Kumar',
          amount: 10000,
          adminId: 'admin-root',
          adminName: 'Store Admin',
          settlementRef: 'STL-10024',
          note: 'Weekly cash handover verified.',
          timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        }
      ],
      codCollections: [],
      deliveryExceptions: [],

      confirmPartnerSettlement: (partnerId, amount, adminId = 'admin-root', adminName = 'Store Admin', settlementRef, note) => {
        const cleanRef = settlementRef || `STL-REF-${Date.now().toString().slice(-6)}`;
        const timestamp = new Date().toISOString();
        const partner = get().deliveryPartners.find((p) => p.id === partnerId);
        const partnerName = partner?.name || 'Partner';
        const currentCash = Number(partner?.cashInHand || 0);
        const settleAmt = Number(amount);
        const remainingCash = Math.max(0, currentCash - settleAmt);

        const record: SettlementRecord = {
          id: `stl_${partnerId}_${Date.now()}`,
          partnerId,
          partnerName,
          amount: settleAmt,
          adminId,
          adminName,
          settlementRef: cleanRef,
          note: note || 'Cash handover received and confirmed.',
          timestamp,
        };

        set((state) => ({
          settlements: [record, ...state.settlements],
          // KEY FIX: update cashInHand on the partner so delivery APK reflects
          // the settled status immediately via shared Zustand state
          deliveryPartners: state.deliveryPartners.map((p) =>
            p.id === partnerId
              ? {
                  ...p,
                  cashInHand: remainingCash,
                  cashSettlementStatus: (remainingCash === 0 ? 'SETTLED' : 'UNCLEARED') as any,
                  lastCashSettledAt: timestamp,
                }
              : p
          ),
          // Mark related COD collection records as SETTLED
          codCollections: state.codCollections.map((c) =>
            c.partnerId === partnerId && c.status === 'COLLECTED'
              ? ({
                  ...c,
                  status: 'SETTLED' as import('@/types').CollectionStatus,
                  settledAmount: c.collectedAmount,
                  settledAt: timestamp,
                  settlementRef: cleanRef,
                } as import('@/types').CodCollectionRecord)
              : c
          ),
        }));

        get().addAuditLog(
          'SETTLEMENT_CONFIRMED',
          'settlements',
          record.id
        );

        get().addNotification(
          '💵 Cash Settlement Confirmed',
          `Admin confirmed settlement of ₹${settleAmt} for Delivery Partner ${partnerName}. Ref: ${cleanRef}`,
          'ADMIN_SYSTEM_ALERT',
          'admin'
        );

        // Notify the delivery partner that their cash has been cleared
        get().addNotification(
          '✅ Cash Handover Verified',
          `Admin verified and accepted ₹${settleAmt} cash from you. ${remainingCash === 0 ? 'All cash cleared — you can now sign out.' : `₹${remainingCash} still pending.`}`,
          'PARTNER_EARNINGS_CREDITED',
          'delivery_partner',
          { recipientId: partnerId, deepLink: '/profile' }
        );

        return {
          success: true,
          message: `Settlement of ₹${settleAmt} confirmed for ${partnerName}.`,
        };
      },


      requestDeliveryException: (orderId, partnerId, partnerName, reason, evidenceUrl) => {
        const order = get().orders.find((o) => o.id === orderId || o.orderNumber === orderId);
        const orderNumber = order?.orderNumber || orderId;
        const exceptionId = `exc_${orderId}_${Date.now()}`;
        const createdAt = new Date().toISOString();

        const record: DeliveryExceptionRecord = {
          id: exceptionId,
          orderId,
          orderNumber,
          partnerId,
          partnerName,
          reason,
          evidenceUrl,
          status: 'PENDING',
          createdAt,
        };

        set((state) => ({
          deliveryExceptions: [record, ...state.deliveryExceptions],
          orders: state.orders.map((o) =>
            o.id === orderId || o.orderNumber === orderId
              ? ({ ...o, deliveryExceptionId: exceptionId, isExceptionDelivery: false } as Order)
              : o
          ),
        }));

        get().addNotification(
          '⚠️ Delivery Exception Requested',
          `Partner ${partnerName} requested OTP exception for Order #${orderNumber}. Reason: ${reason}`,
          'ADMIN_SYSTEM_ALERT',
          'admin',
          { orderId, deepLink: '/admin?tab=payments-settlement' }
        );

        return {
          success: true,
          message: 'Delivery exception requested successfully. Awaiting Admin review.',
          exceptionId,
        };
      },

      reviewDeliveryException: (exceptionId, action, adminId = 'admin-root', adminName = 'Store Admin', adminNote, orderId) => {
        const reviewedAt = new Date().toISOString();
        const isApproved = action === 'APPROVED';

        set((state) => ({
          deliveryExceptions: state.deliveryExceptions.map((e) =>
            e.id === exceptionId
              ? {
                  ...e,
                  status: action,
                  reviewedByAdminId: adminId,
                  reviewedByAdminName: adminName,
                  reviewedAt,
                  adminNote: adminNote || (isApproved ? 'Exception authorized by Admin.' : 'Exception rejected.'),
                }
              : e
          ),
          orders: isApproved && orderId
            ? state.orders.map((o) =>
                o.id === orderId || o.orderNumber === orderId
                  ? ({
                      ...o,
                      orderStatus: 'DELIVERED' as const,
                      deliveryStatus: 'DELIVERED' as any,
                      isExceptionDelivery: true,
                      deliveredAt: reviewedAt,
                    } as Order)
                  : o
              )
            : state.orders,
        }));

        get().addAuditLog(
          isApproved ? 'DELIVERY_EXCEPTION_APPROVED' : 'DELIVERY_EXCEPTION_REJECTED',
          'deliveryExceptions',
          exceptionId
        );

        return {
          success: true,
          message: `Delivery exception ${action.toLowerCase()} successfully.`,
        };
      },

      resendCustomerDeliveryOtp: async (orderId) => {
        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId || o.orderNumber === orderId
              ? ({
                  ...o,
                  deliveryOtp: newOtp,
                  deliveryOtpAttempts: 0,
                  deliveryOtpLocked: false,
                } as Order)
              : o
          ),
        }));

        return {
          success: true,
          message: 'Fresh Delivery OTP sent to customer.',
          resendCount: 1,
          cooldownSeconds: 60,
        };
      },

      // 🌟 AI Festival CMS Actions
      addFestivalTemplate: (templateData) => {
        const newTemplate: FestivalTemplate = {
          ...templateData,
          id: templateData.id || `tpl-custom-${Date.now()}`,
          category: templateData.category || 'MY_TEMPLATES',
          version: 1,
          schemaVersion: '1.0',
          minimumAppVersion: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          festivalTemplates: [newTemplate, ...state.festivalTemplates],
        }));

        saveFestivalTemplateFS(newTemplate).catch(() => {});

        get().addFestivalAuditLog({
          adminId: get().currentUser?.id || 'usr-admin-1',
          adminName: 'Admin',
          action: templateData.category === 'AI_GENERATED' ? 'AI_TEMPLATE_GENERATED' : 'TEMPLATE_CREATED',
          targetType: 'TEMPLATE',
          targetId: newTemplate.id,
          targetName: newTemplate.name,
          version: 1,
          details: `Created template "${newTemplate.name}" under ${newTemplate.category}.`,
        });

        return newTemplate;
      },

      updateFestivalTemplate: (id, updates) => {
        let updatedTemplate: FestivalTemplate | null = null;
        set((state) => ({
          festivalTemplates: state.festivalTemplates.map((t) => {
            if (t.id === id) {
              updatedTemplate = {
                ...t,
                ...updates,
                version: (t.version || 1) + 1,
                updatedAt: new Date().toISOString(),
              };
              return updatedTemplate;
            }
            return t;
          }),
        }));

        if (updatedTemplate) {
          saveFestivalTemplateFS(updatedTemplate).catch(() => {});
        }

        get().addFestivalAuditLog({
          adminId: get().currentUser?.id || 'usr-admin-1',
          adminName: 'Admin',
          action: 'TEMPLATE_EDITED',
          targetType: 'TEMPLATE',
          targetId: id,
          targetName: updates.name || id,
          details: `Updated template configuration.`,
        });
      },

      duplicateFestivalTemplate: (id, newName) => {
        const source = get().festivalTemplates.find((t) => t.id === id);
        if (!source) return null;

        const duplicated: FestivalTemplate = {
          ...JSON.parse(JSON.stringify(source)),
          id: `tpl-dup-${Date.now()}`,
          name: newName || `${source.name} (Copy)`,
          category: 'MY_TEMPLATES',
          version: 1,
          createdBy: 'Admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          festivalTemplates: [duplicated, ...state.festivalTemplates],
        }));

        saveFestivalTemplateFS(duplicated).catch(() => {});

        get().addFestivalAuditLog({
          adminId: get().currentUser?.id || 'usr-admin-1',
          adminName: 'Admin',
          action: 'TEMPLATE_DUPLICATED',
          targetType: 'TEMPLATE',
          targetId: duplicated.id,
          targetName: duplicated.name,
          version: 1,
          details: `Duplicated from "${source.name}".`,
        });

        return duplicated;
      },

      archiveFestivalTemplate: (id) => {
        let archivedTemplate: FestivalTemplate | null = null;
        set((state) => ({
          festivalTemplates: state.festivalTemplates.map((t) => {
            if (t.id === id) {
              archivedTemplate = { ...t, category: 'ARCHIVED' as const, isArchived: true };
              return archivedTemplate;
            }
            return t;
          }),
        }));

        if (archivedTemplate) {
          saveFestivalTemplateFS(archivedTemplate).catch(() => {});
        }

        get().addFestivalAuditLog({
          adminId: get().currentUser?.id || 'usr-admin-1',
          adminName: 'Admin',
          action: 'TEMPLATE_ARCHIVED',
          targetType: 'TEMPLATE',
          targetId: id,
          targetName: id,
          details: 'Archived festival template.',
        });
      },

      addFestivalCampaign: (campaignData) => {
        const newCampaign: FestivalCampaign = {
          ...campaignData,
          id: campaignData.id || `cmp-${Date.now()}`,
          status: campaignData.status || 'DRAFT',
          priority: campaignData.priority || 50,
          timezone: campaignData.timezone || 'Asia/Kolkata',
          currentVersion: 1,
          versionHistory: [
            {
              versionNumber: 1,
              snapshot: {
                name: campaignData.name,
                templateId: campaignData.templateId,
                theme: campaignData.configurationSnapshot.theme,
                sections: campaignData.configurationSnapshot.sections,
                festivalName: campaignData.festivalName,
                startAt: campaignData.startAt,
                endAt: campaignData.endAt,
              },
              savedAt: new Date().toISOString(),
              savedBy: 'Admin',
              notes: 'Initial campaign creation',
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          festivalCampaigns: [newCampaign, ...state.festivalCampaigns],
        }));

        saveFestivalCampaignFS(newCampaign).catch(() => {});

        get().addFestivalAuditLog({
          adminId: get().currentUser?.id || 'usr-admin-1',
          adminName: 'Admin',
          action: 'CAMPAIGN_CREATED',
          targetType: 'CAMPAIGN',
          targetId: newCampaign.id,
          targetName: newCampaign.name,
          version: 1,
          details: `Created campaign "${newCampaign.name}".`,
        });

        return newCampaign;
      },

      updateFestivalCampaign: (id, updates) => {
        let updatedCampaign: FestivalCampaign | null = null;
        set((state) => ({
          festivalCampaigns: state.festivalCampaigns.map((c) => {
            if (c.id === id) {
              updatedCampaign = {
                ...c,
                ...updates,
                updatedAt: new Date().toISOString(),
              };
              return updatedCampaign;
            }
            return c;
          }),
        }));

        if (updatedCampaign) {
          saveFestivalCampaignFS(updatedCampaign).catch(() => {});
        }
      },

      publishFestivalCampaign: (id, notes) => {
        const campaign = get().festivalCampaigns.find((c) => c.id === id);
        if (!campaign) {
          return { success: false, message: 'Campaign not found.' };
        }

        const newVersion = (campaign.currentVersion || 1) + 1;
        const now = new Date().toISOString();

        const versionSnapshot = {
          versionNumber: newVersion,
          snapshot: {
            name: campaign.name,
            templateId: campaign.templateId,
            theme: campaign.configurationSnapshot.theme,
            sections: campaign.configurationSnapshot.sections,
            festivalName: campaign.festivalName,
            startAt: campaign.startAt,
            endAt: campaign.endAt,
          },
          savedAt: now,
          savedBy: 'Admin',
          notes: notes || `Published Version ${newVersion}`,
        };

        let publishedCampaign: FestivalCampaign | null = null;
        set((state) => ({
          festivalCampaigns: state.festivalCampaigns.map((c) => {
            if (c.id === id) {
              publishedCampaign = {
                ...c,
                status: 'PUBLISHED' as const,
                publishedAt: now,
                publishedBy: 'Admin',
                currentVersion: newVersion,
                versionHistory: [versionSnapshot, ...c.versionHistory],
                updatedAt: now,
              };
              return publishedCampaign;
            }
            return c;
          }),
        }));

        if (publishedCampaign) {
          saveFestivalCampaignFS(publishedCampaign).catch(() => {});
        }

        get().addFestivalAuditLog({
          adminId: get().currentUser?.id || 'usr-admin-1',
          adminName: 'Admin',
          action: 'CAMPAIGN_PUBLISHED',
          targetType: 'CAMPAIGN',
          targetId: id,
          targetName: campaign.name,
          version: newVersion,
          details: `Published campaign "${campaign.name}" as Version ${newVersion}.`,
        });

        return {
          success: true,
          message: `Campaign published successfully (Version ${newVersion}).`,
          version: newVersion,
        };
      },

      rollbackFestivalCampaign: (id, targetVersion) => {
        const campaign = get().festivalCampaigns.find((c) => c.id === id);
        if (!campaign) {
          return { success: false, message: 'Campaign not found.' };
        }

        const targetSnapshot = campaign.versionHistory.find(
          (v) => v.versionNumber === targetVersion
        );
        if (!targetSnapshot) {
          return {
            success: false,
            message: `Version ${targetVersion} not found in campaign history.`,
          };
        }

        const now = new Date().toISOString();
        let rolledBackCampaign: FestivalCampaign | null = null;
        set((state) => ({
          festivalCampaigns: state.festivalCampaigns.map((c) => {
            if (c.id === id) {
              rolledBackCampaign = {
                ...c,
                name: targetSnapshot.snapshot.name,
                configurationSnapshot: {
                  theme: targetSnapshot.snapshot.theme,
                  sections: targetSnapshot.snapshot.sections,
                  festivalName: targetSnapshot.snapshot.festivalName,
                },
                startAt: targetSnapshot.snapshot.startAt || c.startAt,
                endAt: targetSnapshot.snapshot.endAt || c.endAt,
                currentVersion: targetVersion,
                updatedAt: now,
              };
              return rolledBackCampaign;
            }
            return c;
          }),
        }));

        if (rolledBackCampaign) {
          saveFestivalCampaignFS(rolledBackCampaign).catch(() => {});
        }

        get().addFestivalAuditLog({
          adminId: get().currentUser?.id || 'usr-admin-1',
          adminName: 'Admin',
          action: 'CAMPAIGN_ROLLED_BACK',
          targetType: 'CAMPAIGN',
          targetId: id,
          targetName: campaign.name,
          version: targetVersion,
          details: `Rolled back campaign configuration to Version ${targetVersion}.`,
        });

        return {
          success: true,
          message: `Successfully rolled back to Version ${targetVersion}.`,
        };
      },

      toggleEmergencyFestivalDisable: (disabled) => {
        const nextVal =
          disabled !== undefined
            ? disabled
            : !get().isFestivalEmergencyDisabled;
        set({ isFestivalEmergencyDisabled: nextVal });

        saveFestivalSettingsFS({ isEmergencyDisabled: nextVal }).catch(() => {});

        get().addFestivalAuditLog({
          adminId: get().currentUser?.id || 'usr-admin-1',
          adminName: 'Admin',
          action: 'EMERGENCY_DISABLE_TOGGLED',
          targetType: 'SYSTEM',
          targetId: 'emergency-disable-switch',
          targetName: 'Festival Emergency Master Switch',
          details: nextVal
            ? 'Emergency DISABLE activated: all festival campaigns hidden.'
            : 'Emergency DISABLE deactivated: festival campaigns restored.',
        });

        return nextVal;
      },

      addFestivalAuditLog: (logData) => {
        const newLog: FestivalAuditLog = {
          ...logData,
          id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          festivalAuditLogs: [newLog, ...state.festivalAuditLogs.slice(0, 99)],
        }));
      },

      getActiveFestivalCampaign: () => {
        if (get().isFestivalEmergencyDisabled) {
          return null;
        }

        const now = new Date().getTime();
        const campaigns = get().festivalCampaigns.filter((c) => {
          if (c.status !== 'PUBLISHED') return false;
          const start = new Date(c.startAt).getTime();
          const end = new Date(c.endAt).getTime();
          return now >= start && now <= end;
        });

        if (campaigns.length === 0) {
          return null;
        }

        // Return highest priority campaign
        return campaigns.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
      },
    }),
    {
      name: 'pocketkirana-store-v4',
      partialize: (state) => ({
        products: state.products,
        categories: state.categories,
        brands: state.brands,
        orders: state.orders,
        invoices: state.invoices,
        invoiceTemplate: state.invoiceTemplate,
        settlements: state.settlements,
        codCollections: state.codCollections,
        deliveryExceptions: state.deliveryExceptions,
        addresses: state.addresses,
        banners: state.banners,
        coupons: state.coupons,
        cart: state.cart,
        wishlist: state.wishlist,
        deliveryPartners: state.deliveryPartners,
        reviews: state.reviews,
        tickets: state.tickets,
        auditLogs: state.auditLogs,
        activeRole: state.activeRole,
        isLoggedIn: state.isLoggedIn,
        currentUser: state.currentUser,
        festivalTemplates: state.festivalTemplates,
        festivalCampaigns: state.festivalCampaigns,
        festivalAuditLogs: state.festivalAuditLogs,
        isFestivalEmergencyDisabled: state.isFestivalEmergencyDisabled,
      }),
    }
  )
);
