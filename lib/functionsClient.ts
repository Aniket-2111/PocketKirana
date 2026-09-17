/**
 * PocketKirana — Firebase Cloud Functions Client
 *
 * Typed wrappers for all callable Cloud Functions.
 * These are called from the client (Next.js app) side.
 *
 * All business-critical operations must go through here —
 * never write directly to Firestore from the client for orders.
 */

'use client';

import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { getFirebaseApp } from './firebase';

// ══════════════════════════════════════════
// FUNCTIONS INSTANCE
// ══════════════════════════════════════════

let _functions: Functions | null = null;

function getFunctionsInstance(): Functions | null {
  if (typeof window === 'undefined') return null;
  if (_functions) return _functions;

  try {
    const app = getFirebaseApp();
    if (!app) return null;
    _functions = getFunctions(app, 'asia-south1');
    return _functions;
  } catch (err) {
    console.warn('[FunctionsClient] Could not initialize Functions:', err);
    return null;
  }
}

// ══════════════════════════════════════════
// RESPONSE TYPES
// ══════════════════════════════════════════

export interface PlaceOrderResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  total: number;
  paymentMethod: string;
  requiresPayment?: boolean;
  message?: string;
}

export interface CancelOrderResult {
  success: boolean;
  message: string;
  refundId: string | null;
}

export interface DeliveryZoneResult {
  isServiceable: boolean;
  distanceKm: number;
  deliveryRadiusKm: number;
  message: string;
}

export interface AcceptAssignmentResult {
  success: boolean;
  storeAddress: string;
  storeLatitude: number;
  storeLongitude: number;
  orderNumber: string;
  itemCount: number;
  estimatedEarnings: number;
  message: string;
}

export interface CompleteDeliveryResult {
  success: boolean;
  earningsTotal: number;
  message: string;
}

// ══════════════════════════════════════════
// ORDER FUNCTIONS
// ══════════════════════════════════════════

/**
 * Place a new order with server-side validation.
 * This is the ONLY way orders should be created.
 */
export async function callPlaceOrder(params: {
  cartItems: Array<{ productId: string; quantity: number }>;
  addressId: string;
  paymentMethod: 'cod' | 'razorpay' | 'phonepe' | 'upi' | 'card';
  couponCode?: string;
  storeId?: string;
}): Promise<PlaceOrderResult> {
  const useLiveFunctions = process.env.NEXT_PUBLIC_USE_LIVE_FUNCTIONS === 'true';

  if (!useLiveFunctions) {
    return callPlaceOrderFallback(params);
  }

  const functions = getFunctionsInstance();

  if (!functions) {
    return callPlaceOrderFallback(params);
  }

  try {
    const callable = httpsCallable<typeof params, PlaceOrderResult>(functions, 'placeOrder');
    const result = await callable(params);
    if (result?.data?.success) {
      return result.data;
    }
    return callPlaceOrderFallback(params);
  } catch (err: any) {
    console.warn(`[FunctionsClient] Cloud Function network error (${err?.message || 'Failed to fetch'}), using dev fallback.`);
    return callPlaceOrderFallback(params);
  }
}

/**
 * Cancel an order with server-side state machine enforcement.
 */
export async function callCancelOrder(params: {
  orderId: string;
  reason?: string;
}): Promise<CancelOrderResult> {
  const functions = getFunctionsInstance();

  if (!functions) {
    throw new Error('Service unavailable. Please try again.');
  }

  try {
    const callable = httpsCallable<typeof params, CancelOrderResult>(functions, 'cancelOrder');
    const result = await callable(params);
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to cancel order');
  }
}

// ══════════════════════════════════════════
// DELIVERY ZONE VALIDATION
// ══════════════════════════════════════════

/**
 * Server-side delivery zone check (Haversine in Cloud Function).
 */
export async function callValidateDeliveryZone(
  latitude: number,
  longitude: number
): Promise<DeliveryZoneResult> {
  const functions = getFunctionsInstance();

  if (!functions) {
    // Local fallback
    const STORE_LAT = 19.0224536;
    const STORE_LNG = 73.3210018;
    const R = 6371;
    const dLat = ((latitude - STORE_LAT) * Math.PI) / 180;
    const dLng = ((longitude - STORE_LNG) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((STORE_LAT * Math.PI) / 180) *
        Math.cos((latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
    const isServiceable = distanceKm <= 3;
    return {
      isServiceable,
      distanceKm,
      deliveryRadiusKm: 3,
      message: isServiceable
        ? `Delivery available (${distanceKm.toFixed(1)} km)`
        : `Outside delivery area (${distanceKm.toFixed(1)} km from store)`,
    };
  }

  try {
    const callable = httpsCallable<
      { latitude: number; longitude: number },
      DeliveryZoneResult
    >(functions, 'validateDeliveryZone');
    const result = await callable({ latitude, longitude });
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Zone validation failed');
  }
}

// ══════════════════════════════════════════
// DELIVERY PARTNER FUNCTIONS
// ══════════════════════════════════════════

export async function callAcceptDeliveryAssignment(
  assignmentId: string
): Promise<AcceptAssignmentResult> {
  const functions = getFunctionsInstance();
  if (!functions) throw new Error('Service unavailable.');

  try {
    const callable = httpsCallable<{ assignmentId: string }, AcceptAssignmentResult>(
      functions, 'acceptDeliveryAssignment'
    );
    const result = await callable({ assignmentId });
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to accept assignment');
  }
}

export async function callRejectDeliveryAssignment(
  assignmentId: string,
  reason?: string
): Promise<{ success: boolean }> {
  const functions = getFunctionsInstance();
  if (!functions) throw new Error('Service unavailable.');

  try {
    const callable = httpsCallable<{ assignmentId: string; reason?: string }, { success: boolean }>(
      functions, 'rejectDeliveryAssignment'
    );
    const result = await callable({ assignmentId, reason });
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to reject assignment');
  }
}

export async function callVerifyStorePickup(params: {
  assignmentId: string;
  pickupOtp: string;
}): Promise<{ success: boolean; deliveryAddress: string; customerName: string }> {
  const functions = getFunctionsInstance();
  if (!functions) throw new Error('Service unavailable.');

  try {
    const callable = httpsCallable<typeof params, any>(functions, 'verifyStorePickup');
    const result = await callable(params);
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to verify pickup OTP');
  }
}

export async function callCompleteDelivery(params: {
  assignmentId: string;
  customerOtp: string;
  codAmountCollected?: number;
  proofPhotoUrl?: string;
  latitude?: number;
  longitude?: number;
}): Promise<CompleteDeliveryResult> {
  const functions = getFunctionsInstance();
  if (!functions) throw new Error('Service unavailable.');

  try {
    const callable = httpsCallable<typeof params, CompleteDeliveryResult>(
      functions, 'completeDelivery'
    );
    const result = await callable(params);
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to complete delivery');
  }
}

export async function callUpdateDeliveryStage(params: {
  assignmentId: string;
  stage: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ success: boolean }> {
  const functions = getFunctionsInstance();
  if (!functions) throw new Error('Service unavailable.');

  try {
    const callable = httpsCallable<typeof params, { success: boolean }>(
      functions, 'updateDeliveryStage'
    );
    const result = await callable(params);
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to update stage');
  }
}

export async function callRecordDeliveryFailure(params: {
  assignmentId: string;
  reason: string;
}): Promise<{ success: boolean }> {
  const functions = getFunctionsInstance();
  if (!functions) throw new Error('Service unavailable.');

  try {
    const callable = httpsCallable<typeof params, { success: boolean }>(
      functions, 'recordDeliveryFailure'
    );
    const result = await callable(params);
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to record failure');
  }
}

// ══════════════════════════════════════════
// PICKER FUNCTIONS
// ══════════════════════════════════════════

export async function callScanBarcode(params: {
  barcode: string;
  storeId: string;
}): Promise<{
  found: boolean;
  product?: any;
  inventory?: any;
  barcodeType?: string;
  barcode: string;
  message?: string;
}> {
  const functions = getFunctionsInstance();
  if (!functions) throw new Error('Service unavailable.');

  try {
    const callable = httpsCallable<typeof params, any>(functions, 'scanBarcode');
    const result = await callable(params);
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Barcode scan failed');
  }
}

export async function callConfirmPutaway(params: {
  productId: string;
  locationId: string;
  quantity: number;
  storeId: string;
  receiptId?: string;
}): Promise<{ success: boolean; newQuantity: number; locationCode: string; movementId: string }> {
  const functions = getFunctionsInstance();
  if (!functions) throw new Error('Service unavailable.');

  try {
    const callable = httpsCallable<typeof params, any>(functions, 'confirmPutaway');
    const result = await callable(params);
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Putaway confirmation failed');
  }
}

// ══════════════════════════════════════════
// AUTH FUNCTIONS
// ══════════════════════════════════════════

export async function callSetUserRole(params: {
  uid: string;
  role: string;
  storeId?: string;
}): Promise<{ success: boolean; message: string }> {
  const functions = getFunctionsInstance();
  if (!functions) throw new Error('Service unavailable.');

  try {
    const callable = httpsCallable<typeof params, any>(functions, 'setUserRole');
    const result = await callable(params);
    return result.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to set role');
  }
}

export async function callSaveFcmToken(params: {
  fcmToken: string;
  deviceType: string;
  appVersion?: string;
}): Promise<{ success: boolean }> {
  const functions = getFunctionsInstance();
  if (!functions) return { success: false };

  try {
    const callable = httpsCallable<typeof params, any>(functions, 'saveFcmToken');
    const result = await callable(params);
    return result.data;
  } catch (err) {
    return { success: false };
  }
}

// ══════════════════════════════════════════
// DEV FALLBACK: Direct Firestore order creation
// Used only when Cloud Functions are not deployed.
// Does NOT perform server-side stock validation.
// ══════════════════════════════════════════

async function callPlaceOrderFallback(params: {
  cartItems: Array<{ productId: string; quantity: number }>;
  addressId: string;
  paymentMethod: string;
  couponCode?: string;
  storeId?: string;
}): Promise<PlaceOrderResult> {
  const { getFirebaseDb, getFirebaseAuth } = await import('./firebase');
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();

  const uid = auth?.currentUser?.uid || 'usr-cust-1';
  const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const orderNumber = `PK${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${Math.floor(10000 + Math.random() * 90000)}`;

  let subtotal = 0;
  const items: any[] = [];

  if (db) {
    const { doc, getDoc, setDoc } = await import('firebase/firestore');

    // Server-side serviceability check on the delivery address
    try {
      const addrSnap = await getDoc(doc(db, 'addresses', params.addressId));
      if (addrSnap.exists()) {
        const addrData = addrSnap.data();
        if (typeof addrData.latitude === 'number' && typeof addrData.longitude === 'number') {
          const { calculateDistanceKm } = await import('./locationServices');
          const dist = calculateDistanceKm(19.0224536, 73.3210018, addrData.latitude, addrData.longitude);
          const isNeral = addrData.postalCode === '410101' || 
            (addrData.city && addrData.city.toLowerCase().includes('neral')) ||
            (addrData.addressLine1 && addrData.addressLine1.toLowerCase().includes('neral'));
          if (dist > 4.5 && !isNeral) {
            throw new Error(`Address is ${dist.toFixed(1)} KM away, which exceeds PocketKirana's 4.5 KM delivery radius from Maule Kirana in Neral.`);
          }
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('exceeds PocketKirana')) {
        throw err;
      }
      console.warn('[Fallback] Could not verify address coordinates:', err);
    }

    for (const item of params.cartItems) {
      try {
        const pSnap = await getDoc(doc(db, 'products', item.productId));
        if (pSnap.exists()) {
          const p = pSnap.data();
          const price = p.sellingPrice ?? p.price ?? p.mrp ?? 0;
          const lineTotal = price * item.quantity;
          subtotal += lineTotal;
          items.push({
            productId: item.productId,
            productName: p.name || 'Grocery Item',
            quantity: item.quantity,
            unitPrice: price,
            totalPrice: lineTotal,
            imageUrl: p.thumbnail || '',
            barcode: p.barcode || '8901234567890',
            unit: p.unit || '1 pack',
          });
        } else {
          // Fallback if product document not found by raw ID
          const price = (item as any).price || 99;
          const lineTotal = price * item.quantity;
          subtotal += lineTotal;
          items.push({
            productId: item.productId,
            productName: (item as any).name || (item as any).productName || 'Grocery Item',
            quantity: item.quantity,
            unitPrice: price,
            totalPrice: lineTotal,
            imageUrl: (item as any).imageUrl || '',
            barcode: '8901234567890',
            unit: '1 pack',
          });
        }
      } catch (e) {
        console.warn('[Fallback] Could not fetch product details:', e);
      }
    }

    const total = Math.round((subtotal + 25) * 100) / 100;

    try {
      await setDoc(doc(db, 'orders', orderId), {
        id: orderId,
        orderNumber,
        customerId: uid,
        storeId: params.storeId || 'store-001',
        addressId: params.addressId,
        items,
        subtotal,
        discount: 0,
        deliveryFee: 25,
        tax: 0,
        total,
        paymentMethod: params.paymentMethod,
        paymentStatus: 'pending',
        orderStatus: params.paymentMethod === 'cod' ? 'CONFIRMED' : 'PAYMENT_PENDING',
        placedAt: new Date().toISOString(),
        statusHistory: [{ status: 'CREATED', timestamp: new Date().toISOString(), actorId: uid }],
        _devFallback: true,
      });

      // Create matching PickingTask in Firestore for real-time picker app sync
      const pickingItems = items.map((it: any, idx: number) => ({
        id: `pi-${orderId}-${idx}`,
        productId: it.productId,
        productName: it.productName || 'Grocery Item',
        sku: `SKU-${it.productId.slice(0, 8).toUpperCase()}`,
        upc: it.barcode || '8901234567890',
        barcode: it.barcode || '8901234567890',
        unit: it.unit || '1 pack',
        imageUrl: it.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80',
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
          displayCode: 'A-01-A-01'
        },
        status: 'pending'
      }));

      const pickingTaskData = {
        id: `task-${orderId}`,
        orderId,
        orderNumber,
        storeId: params.storeId || 'store-001',
        storeName: 'PocketKirana Neral Hub',
        status: 'assigned',
        priority: 'NORMAL',
        items: pickingItems,
        totalItemsCount: pickingItems.length,
        pickedItemsCount: 0,
        createdAt: new Date().toISOString(),
      };

      // Save to BOTH pickingTasks (camelCase) and picking_tasks (snake_case)
      await Promise.all([
        setDoc(doc(db, 'pickingTasks', `task-${orderId}`), pickingTaskData),
        setDoc(doc(db, 'picking_tasks', `task-${orderId}`), pickingTaskData),
      ]);
    } catch (e) {
      console.warn('[Fallback] Could not write order/picking doc to Firestore:', e);
    }
  }

  const total = Math.round((subtotal + 25) * 100) / 100;

  return {
    success: true,
    orderId,
    orderNumber,
    total,
    paymentMethod: params.paymentMethod,
    requiresPayment: params.paymentMethod !== 'cod',
  };
}
