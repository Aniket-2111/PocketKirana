import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  limit,
  startAfter,
  DocumentSnapshot,
  Firestore
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  Product,
  Category,
  Order,
  Address,
  Coupon,
  Banner,
  DeliveryPartner,
  PartnerAuthToken,
  OrderStatus,
  User,
  Store,
  ServiceRequest,
  PickingTask,
  PickingItem,
  Picker,
  Delivery,
  Brand
} from '@/types';
import {
  FestivalCampaign,
  FestivalTemplate,
  FestivalAuditLog,
} from '@/types/festival';
import { INITIAL_STORAGE_LOCATIONS, INITIAL_STORES } from './mockData';

// Collection Names
const COLLECTIONS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  BRANDS: 'brands',
  SETTINGS: 'settings',
  ORDERS: 'orders',
  USERS: 'users',
  ADDRESSES: 'addresses',
  BANNERS: 'banners',
  COUPONS: 'coupons',
  DELIVERY_PARTNERS: 'deliveryPartners',
  PICKERS: 'pickers',
  SHOPS: 'shops',
  SERVICE_REQUESTS: 'serviceRequests',
  PICKING_TASKS: 'pickingTasks',
  DELIVERY_ASSIGNMENTS: 'deliveryAssignments',
  DELIVERY_TRACKING: 'deliveryTracking',
  FESTIVAL_CAMPAIGNS: 'festival_campaigns',
  FESTIVAL_TEMPLATES: 'festival_templates',
  FESTIVAL_SETTINGS: 'festival_settings',
};

// Helper to get non-null firestore instance
function getFirestoreInstance(): Firestore | null {
  if (!isFirebaseConfigured() || !db) return null;
  return db;
}

// Helper to prevent slow network requests from hanging page load.
// Also swallows AbortError silently \u2014 happens when React StrictMode
// double-invokes effects, or the user navigates away mid-fetch.
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2000, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch((err) => {
      if (
        err?.name === 'AbortError' ||
        err?.code === 'ERR_ABORTED' ||
        (err?.message && String(err.message).toLowerCase().includes('aborted')) ||
        (err?.message && String(err.message).toLowerCase().includes('failed to fetch'))
      ) {
        return fallback;
      }
      console.warn('withTimeout caught non-fatal query error:', err?.message);
      return fallback;
    }),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

// Helper to recursively strip undefined values (which crash Firestore updateDoc / setDoc)
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === 'object' && item !== null ? stripUndefined(item) : item)) as any;
  }
  const clean: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        clean[k] = stripUndefined(v);
      } else {
        clean[k] = v;
      }
    }
  }
  return clean;
}

// ==========================================
// PRODUCTS
// ==========================================
export async function fetchProductsFS(): Promise<Product[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.PRODUCTS)),
      1500,
      null as any
    );
    if (!querySnapshot) return [];
    const products: Product[] = [];
    querySnapshot.forEach((docSnap: any) => {
      products.push({ id: docSnap.id, ...docSnap.data() } as Product);
    });
    return products;
  } catch (error) {
    console.error('Error fetching products from Firestore:', error);
    return [];
  }
}

export async function addProductFS(product: Omit<Product, 'id'> & { id?: string }): Promise<string | null> {
  const firestore = getFirestoreInstance();
  if (!firestore) return null;
  try {
    const newDocRef = doc(collection(firestore, COLLECTIONS.PRODUCTS));
    const newId = product.id || newDocRef.id;
    const docRef = doc(firestore, COLLECTIONS.PRODUCTS, newId);
    const sanitized = stripUndefined({ ...product, id: newId });
    await setDoc(docRef, sanitized);
    return newId;
  } catch (error) {
    console.error('Error adding product to Firestore:', error);
    return null;
  }
}

export async function batchAddProductsFS(products: Product[]): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore || products.length === 0) return false;
  try {
    const batch = writeBatch(firestore);
    products.forEach((product) => {
      const docRef = doc(firestore, COLLECTIONS.PRODUCTS, product.id);
      batch.set(docRef, stripUndefined(product));
    });
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error batch inserting products to Firestore:', error);
    return false;
  }
}

export async function updateProductFS(id: string, updates: Partial<Product>): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.PRODUCTS, id);
    const sanitized = stripUndefined(updates);
    await updateDoc(docRef, sanitized);
    return true;
  } catch (error) {
    console.error('Error updating product in Firestore:', error);
    return false;
  }
}

export async function deleteProductFS(id: string): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    await deleteDoc(doc(firestore, COLLECTIONS.PRODUCTS, id));
    return true;
  } catch (error) {
    console.error('Error deleting product from Firestore:', error);
    return false;
  }
}

/**
 * Real-time listener for products collection.
 * Triggers callback instantly whenever Admin adds, edits, updates stock/price, or deletes a product.
 */
export function subscribeProductsFS(callback: (products: Product[]) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    const unsub = onSnapshot(collection(firestore, COLLECTIONS.PRODUCTS), (snapshot) => {
      const products: Product[] = [];
      snapshot.forEach((docSnap) => {
        products.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      if (products.length > 0) {
        callback(products);
      }
    }, (err) => {
      console.warn('Firestore products subscription error:', err?.message);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

// ==========================================
// BRANDS
// ==========================================
export async function fetchBrandsFS(): Promise<Brand[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.BRANDS)),
      1500,
      null as any
    );
    if (!querySnapshot) return [];
    const brands: Brand[] = [];
    querySnapshot.forEach((docSnap: any) => {
      brands.push({ id: docSnap.id, ...docSnap.data() } as Brand);
    });
    return brands;
  } catch (error) {
    console.error('Error fetching brands from Firestore:', error);
    return [];
  }
}

export function subscribeBrandsFS(callback: (brands: Brand[]) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    const unsub = onSnapshot(collection(firestore, COLLECTIONS.BRANDS), (snapshot) => {
      const brands: Brand[] = [];
      snapshot.forEach((docSnap) => {
        brands.push({ id: docSnap.id, ...docSnap.data() } as Brand);
      });
      if (brands.length > 0) {
        callback(brands);
      }
    }, (err) => {
      console.warn('Firestore brands subscription error:', err?.message);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

export async function saveBrandFS(brand: Brand): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.BRANDS, brand.id);
    await setDoc(docRef, brand, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving brand in Firestore:', error);
    return false;
  }
}

export async function deleteBrandFS(brandId: string): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    await deleteDoc(doc(firestore, COLLECTIONS.BRANDS, brandId));
    return true;
  } catch (error) {
    console.error('Error deleting brand from Firestore:', error);
    return false;
  }
}

// ==========================================
// STORE SETTINGS & AVAILABILITY
// ==========================================
export interface StoreSettingsDoc {
  isStoreOpen: boolean;
  storeClosedMessage?: string;
  deliveryCharge?: number;
  freeDeliveryThreshold?: number;
  minimumOrderAmount?: number;
  deliveryRadiusKm?: number;
  operatingHours?: { open: string; close: string };
  updatedAt?: string;
}

export function subscribeStoreSettingsFS(callback: (settings: StoreSettingsDoc) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    const docRef = doc(firestore, COLLECTIONS.SETTINGS, 'store_config');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as StoreSettingsDoc);
      }
    }, (err) => {
      console.warn('Firestore store settings subscription error:', err?.message);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

export async function updateStoreSettingsFS(settings: Partial<StoreSettingsDoc>): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.SETTINGS, 'store_config');
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating store settings in Firestore:', error);
    return false;
  }
}

// ==========================================
// CATEGORIES
// ==========================================
export async function fetchCategoriesFS(): Promise<Category[]> {
  // First try fetching from PostgreSQL API endpoint
  try {
    const res = await fetch('/api/categories?includeInactive=true', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
        return data.categories;
      }
    }
  } catch (_) {}

  // Fallback to Firestore
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.CATEGORIES)),
      1500,
      null as any
    );
    if (!querySnapshot) return [];
    const categories: Category[] = [];
    querySnapshot.forEach((docSnap: any) => {
      categories.push({ id: docSnap.id, ...docSnap.data() } as Category);
    });
    return categories;
  } catch (error) {
    console.error('Error fetching categories from Firestore:', error);
    return [];
  }
}

export function subscribeCategoriesFS(callback: (categories: Category[]) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    const unsub = onSnapshot(collection(firestore, COLLECTIONS.CATEGORIES), (snapshot) => {
      const categories: Category[] = [];
      snapshot.forEach((docSnap) => {
        categories.push({ id: docSnap.id, ...docSnap.data() } as Category);
      });
      if (categories.length > 0) {
        callback(categories);
      }
    }, (err) => {
      console.warn('Firestore categories subscription error:', err?.message);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

export async function addCategoryFS(category: Omit<Category, 'id'> & { id?: string }): Promise<string | null> {
  // Sync to PostgreSQL API
  try {
    fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    }).catch(() => {});
  } catch (_) {}

  const firestore = getFirestoreInstance();
  if (!firestore) return category.id || null;
  try {
    const newDocRef = doc(collection(firestore, COLLECTIONS.CATEGORIES));
    const newId = category.id || newDocRef.id;
    const docRef = doc(firestore, COLLECTIONS.CATEGORIES, newId);
    await setDoc(docRef, { ...category, id: newId });
    return newId;
  } catch (error) {
    console.error('Error adding category to Firestore:', error);
    return null;
  }
}

export async function updateCategoryFS(id: string, updates: Partial<Category>): Promise<boolean> {
  // Sync to PostgreSQL API
  try {
    fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});
  } catch (_) {}

  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.CATEGORIES, id);
    await updateDoc(docRef, updates);
    return true;
  } catch (error) {
    console.error('Error updating category in Firestore:', error);
    return false;
  }
}

export async function deleteCategoryFS(id: string, reassignments?: { reassignCategoryId?: string; reassignSubcategoryId?: string }): Promise<boolean> {
  // Sync to PostgreSQL API
  try {
    fetch(`/api/categories/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reassignments || {}),
    }).catch(() => {});
  } catch (_) {}

  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    await deleteDoc(doc(firestore, COLLECTIONS.CATEGORIES, id));
    return true;
  } catch (error) {
    console.error('Error deleting category from Firestore:', error);
    return false;
  }
}

// ==========================================
// BANNERS
// ==========================================
export async function fetchBannersFS(): Promise<Banner[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const snap = await getDocs(collection(firestore, COLLECTIONS.BANNERS));
    const banners: Banner[] = [];
    snap.forEach((d) => {
      banners.push({ id: d.id, ...d.data() } as Banner);
    });
    return banners;
  } catch (err) {
    console.warn('Error fetching banners from Firestore:', err);
    return [];
  }
}

export function subscribeBannersFS(callback: (banners: Banner[]) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    const unsub = onSnapshot(collection(firestore, COLLECTIONS.BANNERS), (snapshot) => {
      const banners: Banner[] = [];
      snapshot.forEach((docSnap) => {
        banners.push({ id: docSnap.id, ...docSnap.data() } as Banner);
      });
      callback(banners);
    }, (err) => {
      console.warn('Firestore banners subscription error:', err?.message);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

export async function saveBannerFS(banner: Banner): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.BANNERS, banner.id);
    await setDoc(docRef, banner, { merge: true });
    return true;
  } catch (err) {
    console.error('Error saving banner to Firestore:', err);
    return false;
  }
}

export async function updateBannerFS(id: string, updates: Partial<Banner>): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.BANNERS, id);
    await updateDoc(docRef, updates);
    return true;
  } catch (err) {
    console.error('Error updating banner in Firestore:', err);
    return false;
  }
}

export async function deleteBannerFS(id: string): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    await deleteDoc(doc(firestore, COLLECTIONS.BANNERS, id));
    return true;
  } catch (err) {
    console.error('Error deleting banner from Firestore:', err);
    return false;
  }
}


export async function fetchOrdersFS(userIdOrPhone?: string): Promise<Order[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const cleanPhone = userIdOrPhone ? userIdOrPhone.replace(/\D/g, '') : '';
    
    if (userIdOrPhone) {
      // Query by customerId matching the user ID or variations
      const lookupIds = Array.from(new Set([
        userIdOrPhone,
        cleanPhone ? `usr-cust-${cleanPhone}` : '',
        cleanPhone ? `+91 ${cleanPhone}` : '',
        cleanPhone
      ])).filter(Boolean);

      const q = query(
        collection(firestore, COLLECTIONS.ORDERS),
        where('customerId', 'in', lookupIds)
      );

      let querySnapshot = await withTimeout(
        getDocs(q),
        2000,
        null as any
      );

      if ((!querySnapshot || querySnapshot.empty) && cleanPhone) {
        const qPhone = query(
          collection(firestore, COLLECTIONS.ORDERS),
          where('customerPhone', 'in', [`+91 ${cleanPhone}`, cleanPhone])
        );
        querySnapshot = await withTimeout(getDocs(qPhone), 2000, null as any);
      }

      if (!querySnapshot) return [];
      const orders: Order[] = [];
      querySnapshot.forEach((docSnap: any) => {
        orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
      });
      return orders;
    }

    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.ORDERS)),
      2000,
      null as any
    );
    if (!querySnapshot) return [];
    const orders: Order[] = [];
    querySnapshot.forEach((docSnap: any) => {
      orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
    });
    return orders;
  } catch (error) {
    console.error('Error fetching orders from Firestore:', error);
    return [];
  }
}

function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

export async function saveOrderFS(order: Order): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.ORDERS, order.id);
    await setDoc(docRef, sanitizeForFirestore(order));
    return true;
  } catch (error) {
    console.error('Error saving order to Firestore:', error);
    return false;
  }
}

export async function updateOrderStatusFS(orderId: string, status: OrderStatus): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.ORDERS, orderId);
    await updateDoc(docRef, { orderStatus: status });
    return true;
  } catch (error) {
    console.error('Error updating order status in Firestore:', error);
    return false;
  }
}

export async function assignDeliveryPartnerFS(
  orderId: string,
  partnerId: string,
  partnerName?: string,
  partnerPhone?: string
): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.ORDERS, orderId);
    await updateDoc(docRef, {
      partnerId,
      partnerName,
      partnerPhone,
      orderStatus: 'ASSIGNED'
    });
    return true;
  } catch (error) {
    console.error('Error assigning delivery partner in Firestore:', error);
    return false;
  }
}

// Subscribe to Orders Realtime Updates based on Role and UserId
export function subscribeOrdersFS(
  role: string,
  userId: string | null | undefined,
  callback: (orders: Order[]) => void
): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    let q;
    const ordersCol = collection(firestore, COLLECTIONS.ORDERS);
    
    if (role === 'customer' && userId) {
      const cleanPhone = userId.replace(/\D/g, '');
      const lookupIds = Array.from(new Set([
        userId,
        cleanPhone ? `usr-cust-${cleanPhone}` : '',
        cleanPhone ? `+91 ${cleanPhone}` : '',
        cleanPhone
      ])).filter(Boolean);

      q = query(
        ordersCol,
        where('customerId', 'in', lookupIds),
        orderBy('placedAt', 'desc'),
        limit(50)
      );
    } else {
      // Admin/Picker/Delivery: Subscribe to recent 100 orders
      q = query(
        ordersCol,
        orderBy('placedAt', 'desc'),
        limit(100)
      );
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const orders: Order[] = [];
        snapshot.forEach((docSnap) => {
          orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
        });
        callback(orders);
      },
      (error) => {
        console.warn('Firestore subscribeOrdersFS error (non-fatal):', error?.message);
      }
    );
  } catch (error) {
    console.error('Error subscribing to orders in Firestore:', error);
    return () => {};
  }
}

// Subscribe to a Single Order Real-Time Document Stream
export function subscribeSingleOrderFS(
  orderId: string,
  callback: (order: Order | null) => void
): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore || !orderId) return () => {};
  try {
    const docRef = doc(firestore, COLLECTIONS.ORDERS, orderId);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() } as Order);
        } else {
          const q = query(collection(firestore, COLLECTIONS.ORDERS), where('orderNumber', '==', orderId), limit(1));
          getDocs(q).then((snap) => {
            if (!snap.empty) {
              const first = snap.docs[0];
              callback({ id: first.id, ...first.data() } as Order);
            }
          }).catch(() => {});
        }
      },
      (error) => {
        console.warn('Firestore subscribeSingleOrderFS error (non-fatal):', error?.message);
      }
    );
  } catch (error) {
    console.error('Error subscribing to single order:', error);
    return () => {};
  }
}

// Fetch Orders with Cursor Pagination
export async function fetchOrdersPaginatedFS(
  options: {
    userIdOrPhone?: string;
    limitCount?: number;
    startAfterDoc?: DocumentSnapshot | null;
  }
): Promise<{ orders: Order[]; lastDoc: DocumentSnapshot | null }> {
  const firestore = getFirestoreInstance();
  if (!firestore) return { orders: [], lastDoc: null };
  try {
    const { userIdOrPhone, limitCount = 20, startAfterDoc } = options;
    const ordersCol = collection(firestore, COLLECTIONS.ORDERS);
    let q;

    if (userIdOrPhone) {
      const cleanPhone = userIdOrPhone.replace(/\D/g, '');
      const lookupIds = Array.from(new Set([
        userIdOrPhone,
        cleanPhone ? `usr-cust-${cleanPhone}` : '',
        cleanPhone ? `+91 ${cleanPhone}` : '',
        cleanPhone
      ])).filter(Boolean);

      q = query(
        ordersCol,
        where('customerId', 'in', lookupIds),
        orderBy('placedAt', 'desc'),
        limit(limitCount)
      );

      if (startAfterDoc) {
        q = query(q, startAfter(startAfterDoc));
      }
    } else {
      q = query(
        ordersCol,
        orderBy('placedAt', 'desc'),
        limit(limitCount)
      );

      if (startAfterDoc) {
        q = query(q, startAfter(startAfterDoc));
      }
    }

    const snapshot = await getDocs(q);
    const orders: Order[] = [];
    snapshot.forEach((docSnap) => {
      orders.push({ id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as unknown as Order);
    });

    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    return { orders, lastDoc: lastVisible as any };
  } catch (error) {
    console.error('Error fetching paginated orders from Firestore:', error);
    return { orders: [], lastDoc: null };
  }
}

// ==========================================
// ADDRESSES
// ==========================================
export async function fetchAddressesFS(userIdOrPhone?: string): Promise<Address[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const cleanPhone = userIdOrPhone ? userIdOrPhone.replace(/\D/g, '') : '';

    if (userIdOrPhone) {
      const lookupIds = Array.from(new Set([
        userIdOrPhone,
        cleanPhone ? `usr-cust-${cleanPhone}` : '',
        cleanPhone ? `+91 ${cleanPhone}` : '',
        cleanPhone
      ])).filter(Boolean);

      const q = query(
        collection(firestore, COLLECTIONS.ADDRESSES),
        where('userId', 'in', lookupIds)
      );
      let querySnapshot = await withTimeout(
        getDocs(q),
        2000,
        null as any
      );

      if ((!querySnapshot || querySnapshot.empty) && cleanPhone) {
        const qPhone = query(
          collection(firestore, COLLECTIONS.ADDRESSES),
          where('phone', 'in', [`+91 ${cleanPhone}`, cleanPhone])
        );
        querySnapshot = await withTimeout(getDocs(qPhone), 2000, null as any);
      }

      if (!querySnapshot) return [];
      const addresses: Address[] = [];
      querySnapshot.forEach((docSnap: any) => {
        addresses.push({ id: docSnap.id, ...docSnap.data() } as Address);
      });
      return addresses;
    }

    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.ADDRESSES)),
      2000,
      null as any
    );
    if (!querySnapshot) return [];
    const addresses: Address[] = [];
    querySnapshot.forEach((docSnap: any) => {
      addresses.push({ id: docSnap.id, ...docSnap.data() } as Address);
    });
    return addresses;
  } catch (error) {
    console.error('Error fetching addresses from Firestore:', error);
    return [];
  }
}

export async function saveAddressFS(address: Address): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.ADDRESSES, address.id);
    await setDoc(docRef, address);
    return true;
  } catch (error) {
    console.error('Error saving address to Firestore:', error);
    return false;
  }
}

export async function deleteAddressFS(id: string): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    await deleteDoc(doc(firestore, COLLECTIONS.ADDRESSES, id));
    return true;
  } catch (error) {
    console.error('Error deleting address from Firestore:', error);
    return false;
  }
}

// ==========================================
// AUTO-SEEDER FOR NEW FIREBASE PROJECTS
// ==========================================
export async function seedFirestoreIfEmpty(
  initialProducts: Product[],
  initialCategories: Category[],
  initialBanners: Banner[],
  initialCoupons: Coupon[],
  initialOrders: Order[],
  initialDeliveryPartners: DeliveryPartner[]
): Promise<{ success: boolean; message: string }> {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return { success: false, message: 'Firebase is not configured. Please set your credentials in .env.local' };
  }

  try {
    const productsSnap = await getDocs(collection(firestore, COLLECTIONS.PRODUCTS));
    if (!productsSnap.empty) {
      return { success: true, message: 'Firestore already contains data. Skipping initial seed.' };
    }

    const batch = writeBatch(firestore);

    // Seed Products
    initialProducts.forEach((p) => {
      const docRef = doc(firestore, COLLECTIONS.PRODUCTS, p.id);
      batch.set(docRef, p);
    });

    // Seed Categories
    initialCategories.forEach((c) => {
      const docRef = doc(firestore, COLLECTIONS.CATEGORIES, c.id);
      batch.set(docRef, c);
    });

    // Seed Banners
    initialBanners.forEach((b) => {
      const docRef = doc(firestore, COLLECTIONS.BANNERS, b.id);
      batch.set(docRef, b);
    });

    // Seed Coupons
    initialCoupons.forEach((cp) => {
      const docRef = doc(firestore, COLLECTIONS.COUPONS, cp.id);
      batch.set(docRef, cp);
    });

    // Seed Orders
    initialOrders.forEach((o) => {
      const docRef = doc(firestore, COLLECTIONS.ORDERS, o.id);
      batch.set(docRef, o);
    });

    // Seed Delivery Partners
    initialDeliveryPartners.forEach((dp) => {
      const docRef = doc(firestore, COLLECTIONS.DELIVERY_PARTNERS, dp.id);
      batch.set(docRef, dp);
    });

    await batch.commit();
    return { success: true, message: 'Successfully seeded initial Pocket Kirana dataset into Firestore!' };
  } catch (error: any) {
    console.error('Error seeding Firestore:', error);
    return { success: false, message: `Failed to seed Firestore: ${error?.message || error}` };
  }
}

// ==========================================
// DELIVERY PARTNER SERVICES & THROTTLED GPS
// ==========================================
export async function fetchDeliveryPartnersFS(): Promise<DeliveryPartner[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.DELIVERY_PARTNERS)),
      1500,
      null as any
    );
    if (!querySnapshot) return [];
    const partners: DeliveryPartner[] = [];
    querySnapshot.forEach((docSnap: any) => {
      partners.push({ id: docSnap.id, ...docSnap.data() } as DeliveryPartner);
    });
    return partners;
  } catch (error) {
    console.error('Error fetching delivery partners from Firestore:', error);
    return [];
  }
}

export async function updatePartnerStatusFS(
  partnerId: string,
  currentStatus: 'online' | 'offline' | 'busy'
): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_PARTNERS, partnerId);
    await updateDoc(docRef, { currentStatus });
    return true;
  } catch (error) {
    console.error('Error updating delivery partner status in Firestore:', error);
    return false;
  }
}

export async function updatePartnerEarningsFS(partnerId: string, amountEarned: number): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_PARTNERS, partnerId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as DeliveryPartner;
      await updateDoc(docRef, {
        todayEarnings: (data.todayEarnings || 0) + amountEarned,
        walletBalance: (data.walletBalance || 0) + amountEarned,
        completedDeliveries: (data.completedDeliveries || 0) + 1
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating partner earnings in Firestore:', error);
    return false;
  }
}

export async function saveDeliveryPartnerFS(partner: DeliveryPartner): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_PARTNERS, partner.id);
    await setDoc(docRef, sanitizeForFirestore(partner), { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving delivery partner to Firestore:', error);
    return false;
  }
}

export async function updatePartnerAccountStatusFS(partnerId: string, accountStatus: 'active' | 'inactive'): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_PARTNERS, partnerId);
    await setDoc(docRef, { accountStatus, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating partner account status in Firestore:', error);
    return false;
  }
}

export async function deleteDeliveryPartnerFS(partnerId: string): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_PARTNERS, partnerId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting delivery partner from Firestore:', error);
    return false;
  }
}

// ==========================================
// STORE PICKERS (WAREHOUSE STAFF)
// ==========================================
export async function fetchPickersFS(): Promise<Picker[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.PICKERS)),
      1500,
      null as any
    );
    if (!querySnapshot) return [];
    const pickers: Picker[] = [];
    querySnapshot.forEach((docSnap: any) => {
      pickers.push({ id: docSnap.id, ...docSnap.data() } as Picker);
    });
    return pickers;
  } catch (error) {
    console.error('Error fetching pickers from Firestore:', error);
    return [];
  }
}

export async function savePickerFS(picker: Picker): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.PICKERS, picker.id);
    await setDoc(docRef, sanitizeForFirestore(picker), { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving picker to Firestore:', error);
    return false;
  }
}

export async function deletePickerFS(pickerId: string): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.PICKERS, pickerId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting picker from Firestore:', error);
    return false;
  }
}

export async function savePartnerAuthTokenFS(tokenData: PartnerAuthToken): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, 'partnerAuthTokens', tokenData.token);
    await setDoc(docRef, sanitizeForFirestore(tokenData), { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving partner auth token to Firestore:', error);
    return false;
  }
}

export async function fetchPartnerAuthTokensFS(): Promise<PartnerAuthToken[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, 'partnerAuthTokens')),
      1500,
      null as any
    );
    if (!querySnapshot) return [];
    const tokens: PartnerAuthToken[] = [];
    querySnapshot.forEach((docSnap: any) => {
      tokens.push({ id: docSnap.id, ...docSnap.data() } as PartnerAuthToken);
    });
    return tokens;
  } catch (error) {
    console.error('Error fetching partner auth tokens from Firestore:', error);
    return [];
  }
}

// Throttled GPS Location Update (Max once per 30 seconds to minimize Firestore write costs)
let lastGpsTimestamp = 0;
const GPS_THROTTLE_MS = 30000;

export async function updatePartnerLocationFS(partnerId: string, lat: number, lng: number): Promise<boolean> {
  const now = Date.now();
  if (now - lastGpsTimestamp < GPS_THROTTLE_MS) {
    // Skip write: Throttled to save Firestore operations
    return false;
  }

  const firestore = getFirestoreInstance();
  if (!firestore) return false;

  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_PARTNERS, partnerId);
    await updateDoc(docRef, {
      currentLocation: { latitude: lat, longitude: lng, lastUpdated: new Date().toISOString() }
    });
    lastGpsTimestamp = now;
    return true;
  } catch (error) {
    console.error('Error updating throttled GPS location in Firestore:', error);
    return false;
  }
}

// ==========================================
// USER PROFILE SERVICES (FIREBASE FIRESTORE)
// ==========================================
export async function fetchUserFS(identifier: string): Promise<User | null> {
  const firestore = getFirestoreInstance();
  if (!firestore || !identifier) return null;

  try {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPhone = identifier.replace(/\D/g, '');

    // 1. Direct check doc by ID
    const directDocRef = doc(firestore, COLLECTIONS.USERS, cleanId.startsWith('usr-') ? cleanId : `usr-${cleanPhone || cleanId}`);
    const directSnap = await getDoc(directDocRef);
    if (directSnap.exists()) {
      return { id: directSnap.id, ...directSnap.data() } as User;
    }

    // 2. Query by mobile field
    if (cleanPhone) {
      const qPhone = query(collection(firestore, COLLECTIONS.USERS), where('mobile', '==', cleanPhone));
      const phoneSnap = await getDocs(qPhone);
      if (!phoneSnap.empty) {
        const firstDoc = phoneSnap.docs[0];
        return { id: firstDoc.id, ...firstDoc.data() } as User;
      }

      const qPhoneFormatted = query(collection(firestore, COLLECTIONS.USERS), where('mobile', '==', `+91 ${cleanPhone}`));
      const phoneFormattedSnap = await getDocs(qPhoneFormatted);
      if (!phoneFormattedSnap.empty) {
        const firstDoc = phoneFormattedSnap.docs[0];
        return { id: firstDoc.id, ...firstDoc.data() } as User;
      }
    }

    // 3. Query by email field
    if (cleanId.includes('@')) {
      const qEmail = query(collection(firestore, COLLECTIONS.USERS), where('email', '==', cleanId));
      const emailSnap = await getDocs(qEmail);
      if (!emailSnap.empty) {
        const firstDoc = emailSnap.docs[0];
        return { id: firstDoc.id, ...firstDoc.data() } as User;
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching user from Firestore:', error);
    return null;
  }
}

export async function saveUserFS(user: User): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore || !user || !user.id) return false;

  try {
    const docRef = doc(firestore, COLLECTIONS.USERS, user.id);
    await setDoc(docRef, user, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving user to Firestore:', error);
    return false;
  }
}

export async function updateUserProfileFS(userId: string, updates: Partial<User>): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore || !userId) return false;

  try {
    const docRef = doc(firestore, COLLECTIONS.USERS, userId);
    await setDoc(docRef, updates, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating user profile in Firestore:', error);
    return false;
  }
}

// ==========================================
// SHOPS / DARK STORES & SERVICE AREA CONFIG
// ==========================================

export async function fetchShopsFS(): Promise<Store[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [...INITIAL_STORES];

  try {
    const snap = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.SHOPS)),
      2000,
      null as any
    );
    if (!snap || snap.empty) return [...INITIAL_STORES];
    const shops: Store[] = [];
    snap.forEach((docSnap: any) => {
      shops.push({ id: docSnap.id, ...docSnap.data() } as Store);
    });
    return shops.length > 0 ? shops : [...INITIAL_STORES];
  } catch (error) {
    console.error('Error fetching shops from Firestore:', error);
    return [...INITIAL_STORES];
  }
}

export function subscribeShopsFS(callback: (shops: Store[]) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    callback([...INITIAL_STORES]);
    return () => {};
  }
  try {
    const unsub = onSnapshot(collection(firestore, COLLECTIONS.SHOPS), (snap) => {
      if (snap && !snap.empty) {
        const list: Store[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Store));
        callback(list);
      } else {
        callback([...INITIAL_STORES]);
      }
    }, (err) => {
      console.warn('Firestore shops subscription error:', err?.message);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

export async function fetchShopFS(shopId: string): Promise<Store | null> {
  const firestore = getFirestoreInstance();
  if (!firestore || !shopId) return null;

  try {
    const snap = await getDoc(doc(firestore, COLLECTIONS.SHOPS, shopId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Store;
    }
    return null;
  } catch (error) {
    console.error('Error fetching shop from Firestore:', error);
    return null;
  }
}

export async function saveShopConfigFS(shop: Store): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore || !shop || !shop.id) return false;

  try {
    const docRef = doc(firestore, COLLECTIONS.SHOPS, shop.id);
    await setDoc(docRef, { ...shop, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving shop config to Firestore:', error);
    return false;
  }
}

export async function updateShopLocationAndRadiusFS(
  shopId: string,
  latitude: number,
  longitude: number,
  deliveryRadiusKm: number,
  serviceStatus: 'active' | 'inactive' | 'maintenance',
  address?: string,
  name?: string
): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore || !shopId) return false;

  try {
    const docRef = doc(firestore, COLLECTIONS.SHOPS, shopId);
    const payload: any = {
      latitude,
      longitude,
      deliveryRadiusKm,
      status: serviceStatus,
      updatedAt: new Date().toISOString(),
    };
    if (address) payload.address = address;
    if (name) payload.name = name;

    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating shop service area in Firestore:', error);
    return false;
  }
}

// ==========================================
// SERVICE REQUESTS ("NOTIFY ME WHEN AVAILABLE")
// ==========================================

export async function fetchServiceRequestsFS(): Promise<ServiceRequest[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];

  try {
    const snap = await withTimeout(
      getDocs(query(collection(firestore, COLLECTIONS.SERVICE_REQUESTS), orderBy('createdAt', 'desc'))),
      2000,
      null as any
    );
    if (!snap || snap.empty) return [];
    const reqs: ServiceRequest[] = [];
    snap.forEach((docSnap: any) => {
      reqs.push({ id: docSnap.id, ...docSnap.data() } as ServiceRequest);
    });
    return reqs;
  } catch (error) {
    console.error('Error fetching service requests from Firestore:', error);
    return [];
  }
}

export async function addServiceRequestFS(req: Omit<ServiceRequest, 'id' | 'createdAt'> & { id?: string }): Promise<string | null> {
  const firestore = getFirestoreInstance();
  if (!firestore) return null;

  try {
    const docId = req.id || `req-${Date.now()}`;
    const docRef = doc(firestore, COLLECTIONS.SERVICE_REQUESTS, docId);
    const payload: ServiceRequest = {
      ...req,
      id: docId,
      status: req.status || 'waiting',
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, payload, { merge: true });
    return docId;
  } catch (error) {
    console.error('Error adding service request to Firestore:', error);
    return null;
  }
}

export async function updateServiceRequestStatusFS(
  requestId: string,
  status: 'waiting' | 'notified' | 'converted'
): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore || !requestId) return false;

  try {
    const docRef = doc(firestore, COLLECTIONS.SERVICE_REQUESTS, requestId);
    await setDoc(docRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating service request status:', error);
    return false;
  }
}

// ==========================================
// PICKING TASKS FIRESTORE SYNC
// ==========================================

/**
 * Build and persist the picking task for a paid order (idempotent — no-op if
 * the task already exists). Used by the PhonePe verify/webhook routes to push
 * orders into the picker queue.
 */
export async function ensurePickingTaskForOrder(orderId: string, orderData: Order): Promise<void> {
  const task = buildPickingTaskForOrder(orderId, orderData);
  try {
    const taskRef = doc(await getDb(), COLLECTIONS.PICKING_TASKS, task.id);
    const existing = await getDoc(taskRef);
    if (!existing.exists()) await savePickingTaskFS(task);
  } catch (err) {
    console.error('Error ensuring picking task for order:', err);
  }
}

function getDb(): Firestore {
  const firestore = getFirestoreInstance();
  if (!firestore) throw new Error('Firestore not configured');
  return firestore;
}

export function buildPickingTaskForOrder(orderId: string, orderData: Order): PickingTask {
  const items: PickingItem[] = (orderData.items || []).map((item: any) => ({
    id: `pi-${Date.now()}-${item.productId || item.product?.id || Math.random()}`,
    productId: item.productId || item.product?.id || '',
    productName: item.product?.name || item.productName || item.name || 'Grocery Item',
    sku: item.product?.sku || item.sku || '',
    upc: item.product?.upc || item.upc || '',
    barcode: item.product?.barcode || item.product?.sku || item.sku || '',
    unit: item.product?.unit || item.unit || '1 unit',
    imageUrl: item.product?.thumbnail || item.imageUrl || '',
    quantityRequired: item.quantity || 1,
    quantityPicked: 0,
    storageLocation: item.product?.storageLocation || INITIAL_STORAGE_LOCATIONS[0],
    status: 'pending'
  }));

  return {
    id: `task-${orderId}`,
    orderId,
    orderNumber: orderData.orderNumber || orderId,
    storeId: orderData.storeId || 'store-1',
    storeName: orderData.storeName || 'PocketKirana Express DarkStore',
    status: 'pending',
    priority: 'NORMAL',
    items,
    totalItemsCount: items.length,
    pickedItemsCount: 0,
    createdAt: new Date().toISOString()
  };
}

export async function savePickingTaskFS(task: PickingTask): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef1 = doc(firestore, COLLECTIONS.PICKING_TASKS, task.id);
    const docRef2 = doc(firestore, 'picking_tasks', task.id);
    const cleanTask = sanitizeForFirestore(task);
    await Promise.all([
      setDoc(docRef1, cleanTask),
      setDoc(docRef2, cleanTask),
    ]);
    return true;
  } catch (error) {
    console.error('Error saving picking task to Firestore:', error);
    return false;
  }
}

export async function updatePickingTaskStatusFS(
  taskId: string,
  status: PickingTask['status'],
  updates: Partial<PickingTask> = {}
): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef1 = doc(firestore, COLLECTIONS.PICKING_TASKS, taskId);
    const docRef2 = doc(firestore, 'picking_tasks', taskId);
    await Promise.all([
      setDoc(docRef1, { status, ...updates, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {}),
      setDoc(docRef2, { status, ...updates, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {}),
    ]);
    return true;
  } catch (error) {
    console.error('Error updating picking task status in Firestore:', error);
    return false;
  }
}

export function subscribePickingTasksFS(callback: (tasks: PickingTask[]) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};

  const taskMap = new Map<string, PickingTask>();

  const emitTasks = () => {
    const sorted = Array.from(taskMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    callback(sorted);
  };

  try {
    const q1 = collection(firestore, COLLECTIONS.PICKING_TASKS);
    const q2 = collection(firestore, 'picking_tasks');

    const unsub1 = onSnapshot(
      q1,
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          taskMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as PickingTask);
        });
        emitTasks();
      },
      (error) => {
        console.warn('Firestore subscribePickingTasksFS q1 error (non-fatal):', error?.message);
      }
    );

    const unsub2 = onSnapshot(
      q2,
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          taskMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as PickingTask);
        });
        emitTasks();
      },
      (error) => {
        console.warn('Firestore subscribePickingTasksFS q2 error (non-fatal):', error?.message);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  } catch (error) {
    console.error('Error subscribing to picking tasks:', error);
    return () => {};
  }
}

// ==========================================
// DELIVERY ASSIGNMENTS & LIVE TRACKING SYNC
// ==========================================

export async function saveDeliveryAssignmentFS(assignment: Delivery): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_ASSIGNMENTS, assignment.id);
    await setDoc(docRef, sanitizeForFirestore(assignment));
    return true;
  } catch (error) {
    console.error('Error saving delivery assignment to Firestore:', error);
    return false;
  }
}

export async function updateDeliveryAssignmentStatusFS(
  assignmentId: string,
  status: Delivery['status'],
  updates: Partial<Delivery> = {}
): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_ASSIGNMENTS, assignmentId);
    await setDoc(docRef, { status, ...updates, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating delivery assignment in Firestore:', error);
    return false;
  }
}

export function subscribeDeliveryAssignmentsFS(callback: (assignments: Delivery[]) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    const q = collection(firestore, COLLECTIONS.DELIVERY_ASSIGNMENTS);
    return onSnapshot(
      q,
      (snapshot) => {
        const assignments: Delivery[] = [];
        snapshot.forEach((docSnap) => {
          assignments.push({ id: docSnap.id, ...docSnap.data() } as Delivery);
        });
        callback(assignments);
      },
      (error) => {
        console.warn('Firestore subscribeDeliveryAssignmentsFS error (non-fatal):', error?.message);
      }
    );
  } catch (error) {
    console.error('Error subscribing to delivery assignments:', error);
    return () => {};
  }
}

// ══════════════════════════════════════════════════════════
// DELIVERY TRACKING — Full telemetry, session lifecycle
// ══════════════════════════════════════════════════════════

/** Full telemetry payload for a single GPS fix */
export interface DeliveryLocationTelemetry {
  partnerId: string;
  orderId: string;
  latitude: number;
  longitude: number;
  /** GPS horizontal accuracy in metres */
  accuracy?: number;
  /** Speed in km/h */
  speed?: number;
  /** Compass heading in degrees (0–360) */
  heading?: number;
  /** Altitude in metres above sea level */
  altitude?: number;
  /** ISO timestamp from the device */
  deviceTimestamp?: string;
}

export async function updateDeliveryTrackingFS(
  assignmentId: string,
  partnerId: string,
  orderId: string,
  lat: number,
  lng: number,
  isActive: boolean = true,
  telemetry?: Partial<DeliveryLocationTelemetry>
): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_TRACKING, assignmentId);
    await setDoc(docRef, {
      assignmentId,
      partnerId,
      orderId,
      currentLat: lat,
      currentLng: lng,
      accuracy: telemetry?.accuracy ?? null,
      speed: telemetry?.speed ?? null,
      heading: telemetry?.heading ?? null,
      altitude: telemetry?.altitude ?? null,
      deviceTimestamp: telemetry?.deviceTimestamp ?? null,
      // Server-side received timestamp (authoritative, not client-controlled)
      receivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive,
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating delivery tracking in Firestore:', error);
    return false;
  }
}

/**
 * Opens a delivery tracking session when an order goes out for delivery.
 * Sets status to 'active' with startedAt timestamp.
 */
export async function startTrackingSessionFS(
  orderId: string,
  partnerId: string,
  customerId?: string
): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const assignmentId = `assign-${orderId}`;
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_TRACKING, assignmentId);
    await setDoc(docRef, {
      assignmentId,
      orderId,
      partnerId,
      customerId: customerId ?? null,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
      isActive: true,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error starting tracking session in Firestore:', error);
    return false;
  }
}

/**
 * Closes a delivery tracking session when an order is delivered, cancelled, or failed.
 * Sets isActive to false so the customer map stops showing live location.
 */
export async function stopTrackingSessionFS(orderId: string): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const assignmentId = `assign-${orderId}`;
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_TRACKING, assignmentId);
    await setDoc(docRef, {
      status: 'ended',
      endedAt: new Date().toISOString(),
      isActive: false,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error stopping tracking session in Firestore:', error);
    return false;
  }
}

/**
 * One-time fetch of the latest tracking document for reconnect synchronisation.
 * Returns null if no tracking session exists or Firebase is unavailable.
 */
export async function fetchLatestTrackingFS(orderId: string): Promise<any | null> {
  const firestore = getFirestoreInstance();
  if (!firestore) return null;
  try {
    const assignmentId = `assign-${orderId}`;
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_TRACKING, assignmentId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data();
    return null;
  } catch (error) {
    console.warn('fetchLatestTrackingFS error (non-fatal):', error);
    return null;
  }
}

export function subscribeDeliveryTrackingFS(
  assignmentId: string,
  callback: (tracking: any | null) => void
): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore || !assignmentId) return () => {};
  try {
    const docRef = doc(firestore, COLLECTIONS.DELIVERY_TRACKING, assignmentId);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data());
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn('Firestore subscribeDeliveryTrackingFS error (non-fatal):', error?.message);
      }
    );
  } catch (error) {
    console.error('Error subscribing to delivery tracking:', error);
    return () => {};
  }
}


// ==========================================
// DUMMY DATA PURGE / DATABASE CLEANUP
// ==========================================
export async function clearDatabaseDummyDataFS(options?: { clearProducts?: boolean }): Promise<{ success: boolean; deletedCount: number; message: string }> {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    return { success: false, deletedCount: 0, message: 'Firebase is not configured.' };
  }

  try {
    let deletedCount = 0;
    const collectionsToClear = [
      COLLECTIONS.ORDERS,
      COLLECTIONS.PICKING_TASKS || 'picking_tasks',
      COLLECTIONS.DELIVERY_ASSIGNMENTS || 'deliveries',
      'notifications',
      'audit_logs',
    ];

    if (options?.clearProducts) {
      collectionsToClear.push(COLLECTIONS.PRODUCTS);
    }

    for (const colName of collectionsToClear) {
      if (!colName) continue;
      const snap = await getDocs(collection(firestore, colName));
      if (!snap.empty) {
        const batch = writeBatch(firestore);
        snap.docs.forEach((d) => {
          batch.delete(d.ref);
          deletedCount++;
        });
        await batch.commit();
      }
    }

    return {
      success: true,
      deletedCount,
      message: `Successfully purged ${deletedCount} dummy records from Firestore database.`,
    };
  } catch (error: any) {
    console.error('Error clearing Firestore dummy data:', error);
    return { success: false, deletedCount: 0, message: error?.message || 'Failed to clear Firestore database' };
  }
}

// ==========================================
// FESTIVAL CAMPAIGNS & TEMPLATES FIRESTORE SYNC
// ==========================================

export async function fetchFestivalCampaignsFS(): Promise<FestivalCampaign[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.FESTIVAL_CAMPAIGNS)),
      2000,
      null as any
    );
    if (!querySnapshot) return [];
    const campaigns: FestivalCampaign[] = [];
    querySnapshot.forEach((docSnap: any) => {
      campaigns.push({ id: docSnap.id, ...docSnap.data() } as FestivalCampaign);
    });
    return campaigns;
  } catch (error) {
    console.error('Error fetching festival campaigns from Firestore:', error);
    return [];
  }
}

export function subscribeFestivalCampaignsFS(callback: (campaigns: FestivalCampaign[]) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    const unsub = onSnapshot(collection(firestore, COLLECTIONS.FESTIVAL_CAMPAIGNS), (snapshot) => {
      const campaigns: FestivalCampaign[] = [];
      snapshot.forEach((docSnap) => {
        campaigns.push({ id: docSnap.id, ...docSnap.data() } as FestivalCampaign);
      });
      if (campaigns.length > 0) {
        callback(campaigns);
      }
    }, (err) => {
      console.warn('Firestore festival campaigns subscription error:', err?.message);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

export async function saveFestivalCampaignFS(campaign: FestivalCampaign): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.FESTIVAL_CAMPAIGNS, campaign.id);
    await setDoc(docRef, campaign, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving festival campaign in Firestore:', error);
    return false;
  }
}

export async function deleteFestivalCampaignFS(id: string): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    await deleteDoc(doc(firestore, COLLECTIONS.FESTIVAL_CAMPAIGNS, id));
    return true;
  } catch (error) {
    console.error('Error deleting festival campaign from Firestore:', error);
    return false;
  }
}

export async function fetchFestivalTemplatesFS(): Promise<FestivalTemplate[]> {
  const firestore = getFirestoreInstance();
  if (!firestore) return [];
  try {
    const querySnapshot = await withTimeout(
      getDocs(collection(firestore, COLLECTIONS.FESTIVAL_TEMPLATES)),
      2000,
      null as any
    );
    if (!querySnapshot) return [];
    const templates: FestivalTemplate[] = [];
    querySnapshot.forEach((docSnap: any) => {
      templates.push({ id: docSnap.id, ...docSnap.data() } as FestivalTemplate);
    });
    return templates;
  } catch (error) {
    console.error('Error fetching festival templates from Firestore:', error);
    return [];
  }
}

export function subscribeFestivalTemplatesFS(callback: (templates: FestivalTemplate[]) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    const unsub = onSnapshot(collection(firestore, COLLECTIONS.FESTIVAL_TEMPLATES), (snapshot) => {
      const templates: FestivalTemplate[] = [];
      snapshot.forEach((docSnap) => {
        templates.push({ id: docSnap.id, ...docSnap.data() } as FestivalTemplate);
      });
      if (templates.length > 0) {
        callback(templates);
      }
    }, (err) => {
      console.warn('Firestore festival templates subscription error:', err?.message);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

export async function saveFestivalTemplateFS(template: FestivalTemplate): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.FESTIVAL_TEMPLATES, template.id);
    await setDoc(docRef, template, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving festival template in Firestore:', error);
    return false;
  }
}

export async function fetchFestivalSettingsFS(): Promise<{ isEmergencyDisabled?: boolean; lastUpdated?: string } | null> {
  const firestore = getFirestoreInstance();
  if (!firestore) return null;
  try {
    const docSnap = await withTimeout(
      getDoc(doc(firestore, COLLECTIONS.FESTIVAL_SETTINGS, 'config')),
      1500,
      null as any
    );
    if (docSnap && docSnap.exists()) {
      return docSnap.data() as any;
    }
    return null;
  } catch (error) {
    console.error('Error fetching festival settings from Firestore:', error);
    return null;
  }
}

export function subscribeFestivalSettingsFS(callback: (settings: { isEmergencyDisabled?: boolean }) => void): () => void {
  const firestore = getFirestoreInstance();
  if (!firestore) return () => {};
  try {
    const unsub = onSnapshot(doc(firestore, COLLECTIONS.FESTIVAL_SETTINGS, 'config'), (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as any);
      }
    }, (err) => {
      console.warn('Firestore festival settings subscription error:', err?.message);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

export async function saveFestivalSettingsFS(settings: { isEmergencyDisabled: boolean }): Promise<boolean> {
  const firestore = getFirestoreInstance();
  if (!firestore) return false;
  try {
    const docRef = doc(firestore, COLLECTIONS.FESTIVAL_SETTINGS, 'config');
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving festival settings in Firestore:', error);
    return false;
  }
}
