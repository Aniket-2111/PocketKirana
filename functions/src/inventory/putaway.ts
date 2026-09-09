/**
 * Cloud Function: confirmPutaway
 *
 * Picker scans product barcode → walks to bin → scans location barcode
 * → enters quantity → calls this function.
 *
 * This function:
 * 1. Validates picker permissions and store assignment
 * 2. Verifies product and location exist in Firestore
 * 3. Atomically updates inventory quantity in a Firestore transaction
 * 4. Creates an InventoryMovement record (type: PUTAWAY)
 * 5. Updates the stock receipt status to putaway_complete
 * 6. Writes audit log
 *
 * Input: { productId, locationId, quantity, storeId, receiptId? }
 * Output: { success: true, newQuantity: number }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  C,
  inventoryDocId,
  writeAuditLog,
  newId,
} from '../utils';

export const confirmPutaway = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const role = request.auth.token.role;
    const uid = request.auth.uid;
    if (role !== 'picker' && role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only pickers can perform putaway.');
    }

    const { productId, locationId, quantity, storeId, receiptId } = request.data as {
      productId: string;
      locationId: string;
      quantity: number;
      storeId: string;
      receiptId?: string;
    };

    if (!productId || !locationId || !storeId || typeof quantity !== 'number' || quantity <= 0) {
      throw new HttpsError('invalid-argument', 'productId, locationId, quantity (>0), and storeId are required.');
    }

    // Picker must belong to this store
    if (role === 'picker') {
      const pickerSnap = await admin.firestore().collection(C.PICKERS).doc(uid).get();
      if (!pickerSnap.exists || pickerSnap.data()?.storeId !== storeId) {
        throw new HttpsError('permission-denied', 'You are not assigned to this store.');
      }
    }

    const db = admin.firestore();

    // Verify product exists
    const productSnap = await db.collection(C.PRODUCTS).doc(productId).get();
    if (!productSnap.exists) {
      throw new HttpsError('not-found', `Product ${productId} not found.`);
    }
    const product = productSnap.data()!;

    // Verify location exists
    const locationSnap = await db.collection(C.STORE_LOCATIONS).doc(locationId).get();
    if (!locationSnap.exists) {
      throw new HttpsError('not-found', `Location ${locationId} not found.`);
    }
    const location = locationSnap.data()!;

    const invId = inventoryDocId(productId, storeId);

    // Fetch picker info for audit
    let pickerName = 'Unknown Picker';
    if (role === 'picker') {
      const pickerSnap = await db.collection(C.PICKERS).doc(uid).get();
      pickerName = pickerSnap.data()?.name || pickerName;
    }

    // Atomically update inventory
    const invRef = db.collection(C.INVENTORY).doc(invId);
    let newQuantity = 0;

    await db.runTransaction(async (tx) => {
      const invSnap = await tx.get(invRef);
      const existing = invSnap.data() || {
        quantity: 0,
        reservedQuantity: 0,
        damagedQuantity: 0,
        availableQuantity: 0,
      };

      newQuantity = (existing.quantity || 0) + quantity;
      const available = newQuantity - (existing.reservedQuantity || 0) - (existing.damagedQuantity || 0);

      tx.set(invRef, {
        inventoryId: invId,
        productId,
        productName: product.name,
        sku: product.sku || '',
        storeId,
        locationId,
        locationCode: location.displayCode || location.id,
        quantity: newQuantity,
        reservedQuantity: existing.reservedQuantity || 0,
        damagedQuantity: existing.damagedQuantity || 0,
        availableQuantity: available,
        reorderLevel: existing.reorderLevel || 5,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      }, { merge: true });
    });

    // Create inventory movement record
    const movementId = newId('mv');
    await db.collection(C.INVENTORY_MOVEMENTS).doc(movementId).set({
      id: movementId,
      productId,
      productName: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      type: 'PUTAWAY',
      quantity,
      storeId,
      toLocation: location.displayCode || locationId,
      pickerId: uid,
      pickerName,
      reason: 'Stock putaway from receiving',
      receiptId: receiptId || null,
      timestamp: new Date().toISOString(),
    });

    // Update stock receipt if provided
    if (receiptId) {
      await db.collection(C.STOCK_RECEIPTS).doc(receiptId).update({
        status: 'putaway_complete',
        putawayAt: new Date().toISOString(),
        locationId,
        locationCode: location.displayCode || locationId,
      });
    }

    // Audit log
    await writeAuditLog({
      actorId: uid,
      actorName: pickerName,
      actorRole: role,
      action: 'STOCK_PUTAWAY',
      targetCollection: C.INVENTORY,
      targetId: invId,
      description: `Picker putaway ${quantity} units of ${product.name} to location ${location.displayCode}`,
      storeId,
      newValue: { quantity: newQuantity, locationCode: location.displayCode },
    });

    return {
      success: true,
      newQuantity,
      locationCode: location.displayCode,
      movementId,
    };
  }
);
