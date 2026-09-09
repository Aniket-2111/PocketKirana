/**
 * PocketKirana — Inventory Service
 *
 * Real-time inventory operations backed by Firestore.
 * All write operations that change stock levels go through
 * Cloud Functions (via HTTP callable) to ensure server-side validation.
 *
 * This service handles:
 * - Reading inventory levels from Firestore
 * - Real-time stock subscriptions
 * - Low stock alerts
 * - Inventory report generation for admin
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { COLLECTIONS } from './firestoreSchema';

// Inventory doc ID format: {productId}_{storeId}
export const inventoryDocId = (productId: string, storeId: string) =>
  `${productId}_${storeId}`;

// ══════════════════════════════════════════
// READ OPERATIONS
// ══════════════════════════════════════════

export interface LiveInventory {
  inventoryId: string;
  productId: string;
  productName: string;
  sku: string;
  storeId: string;
  locationId?: string;
  locationCode?: string;
  quantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  updatedAt: string;
}

/**
 * Fetch inventory for a specific product in a store.
 */
export async function getProductInventory(
  productId: string,
  storeId: string
): Promise<LiveInventory | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const docId = inventoryDocId(productId, storeId);
    const snap = await getDoc(doc(db, COLLECTIONS.INVENTORY, docId));
    if (!snap.exists()) return null;
    return { inventoryId: snap.id, ...snap.data() } as LiveInventory;
  } catch (err) {
    console.error('[InventoryService] getProductInventory error:', err);
    return null;
  }
}

/**
 * Fetch all inventory for a store.
 */
export async function getAllStoreInventory(storeId: string): Promise<LiveInventory[]> {
  const db = getFirebaseDb();
  if (!db) return [];

  try {
    const q = query(
      collection(db, COLLECTIONS.INVENTORY),
      where('storeId', '==', storeId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ inventoryId: d.id, ...d.data() }) as LiveInventory);
  } catch (err) {
    console.error('[InventoryService] getAllStoreInventory error:', err);
    return [];
  }
}

/**
 * Get low stock items (below reorder level).
 */
export async function getLowStockItems(storeId: string): Promise<LiveInventory[]> {
  const all = await getAllStoreInventory(storeId);
  return all.filter((item) => item.availableQuantity <= item.reorderLevel);
}

/**
 * Get out-of-stock items.
 */
export async function getOutOfStockItems(storeId: string): Promise<LiveInventory[]> {
  const all = await getAllStoreInventory(storeId);
  return all.filter((item) => item.availableQuantity <= 0);
}

// ══════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ══════════════════════════════════════════

/**
 * Subscribe to real-time inventory changes for a store.
 * Used by admin dashboard for live low-stock alerts.
 */
export function subscribeToStoreInventory(
  storeId: string,
  callback: (inventory: LiveInventory[]) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};

  try {
    const q = query(
      collection(db, COLLECTIONS.INVENTORY),
      where('storeId', '==', storeId)
    );

    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(
        (d) => ({ inventoryId: d.id, ...d.data() }) as LiveInventory
      );
      callback(items);
    });
  } catch (err) {
    console.error('[InventoryService] subscribeToStoreInventory error:', err);
    return () => {};
  }
}

/**
 * Subscribe to inventory for a single product.
 * Used in product pages to show live stock status.
 */
export function subscribeToProductInventory(
  productId: string,
  storeId: string,
  callback: (inv: LiveInventory | null) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};

  try {
    const docId = inventoryDocId(productId, storeId);
    return onSnapshot(doc(db, COLLECTIONS.INVENTORY, docId), (snap) => {
      if (!snap.exists()) {
        callback(null);
      } else {
        callback({ inventoryId: snap.id, ...snap.data() } as LiveInventory);
      }
    });
  } catch (err) {
    console.error('[InventoryService] subscribeToProductInventory error:', err);
    return () => {};
  }
}

// ══════════════════════════════════════════
// INVENTORY MOVEMENTS READ
// ══════════════════════════════════════════

export interface InventoryMovementRecord {
  id: string;
  productId: string;
  productName: string;
  type: 'RECEIVE' | 'PUTAWAY' | 'PICK' | 'DAMAGED' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  orderId?: string;
  pickerId: string;
  pickerName: string;
  fromLocation?: string;
  toLocation?: string;
  reason?: string;
  timestamp: string;
  storeId: string;
}

export async function getInventoryMovements(
  storeId: string,
  limitCount = 50
): Promise<InventoryMovementRecord[]> {
  const db = getFirebaseDb();
  if (!db) return [];

  try {
    const q = query(
      collection(db, COLLECTIONS.INVENTORY_MOVEMENTS),
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InventoryMovementRecord);
  } catch (err) {
    console.error('[InventoryService] getInventoryMovements error:', err);
    return [];
  }
}

// ══════════════════════════════════════════
// STOCK AVAILABILITY CHECK (for UI only)
// Note: Server-side check in placeOrder Cloud Function is authoritative
// ══════════════════════════════════════════

/**
 * Checks if a product has sufficient available stock.
 * Used for client-side display only — NOT authoritative for orders.
 */
export async function checkStockAvailability(
  productId: string,
  storeId: string,
  quantityRequired: number
): Promise<{
  isAvailable: boolean;
  availableQuantity: number;
  message: string;
}> {
  const inv = await getProductInventory(productId, storeId);

  if (!inv) {
    return {
      isAvailable: false,
      availableQuantity: 0,
      message: 'Product inventory not found',
    };
  }

  const isAvailable = inv.availableQuantity >= quantityRequired;

  return {
    isAvailable,
    availableQuantity: inv.availableQuantity,
    message: isAvailable
      ? `${inv.availableQuantity} units available`
      : `Only ${inv.availableQuantity} units available, requested ${quantityRequired}`,
  };
}
