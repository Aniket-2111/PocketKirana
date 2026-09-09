"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmPutaway = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
exports.confirmPutaway = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const role = request.auth.token.role;
    const uid = request.auth.uid;
    if (role !== 'picker' && role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Only pickers can perform putaway.');
    }
    const { productId, locationId, quantity, storeId, receiptId } = request.data;
    if (!productId || !locationId || !storeId || typeof quantity !== 'number' || quantity <= 0) {
        throw new https_1.HttpsError('invalid-argument', 'productId, locationId, quantity (>0), and storeId are required.');
    }
    // Picker must belong to this store
    if (role === 'picker') {
        const pickerSnap = await admin.firestore().collection(utils_1.C.PICKERS).doc(uid).get();
        if (!pickerSnap.exists || pickerSnap.data()?.storeId !== storeId) {
            throw new https_1.HttpsError('permission-denied', 'You are not assigned to this store.');
        }
    }
    const db = admin.firestore();
    // Verify product exists
    const productSnap = await db.collection(utils_1.C.PRODUCTS).doc(productId).get();
    if (!productSnap.exists) {
        throw new https_1.HttpsError('not-found', `Product ${productId} not found.`);
    }
    const product = productSnap.data();
    // Verify location exists
    const locationSnap = await db.collection(utils_1.C.STORE_LOCATIONS).doc(locationId).get();
    if (!locationSnap.exists) {
        throw new https_1.HttpsError('not-found', `Location ${locationId} not found.`);
    }
    const location = locationSnap.data();
    const invId = (0, utils_1.inventoryDocId)(productId, storeId);
    // Fetch picker info for audit
    let pickerName = 'Unknown Picker';
    if (role === 'picker') {
        const pickerSnap = await db.collection(utils_1.C.PICKERS).doc(uid).get();
        pickerName = pickerSnap.data()?.name || pickerName;
    }
    // Atomically update inventory
    const invRef = db.collection(utils_1.C.INVENTORY).doc(invId);
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
    const movementId = (0, utils_1.newId)('mv');
    await db.collection(utils_1.C.INVENTORY_MOVEMENTS).doc(movementId).set({
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
        await db.collection(utils_1.C.STOCK_RECEIPTS).doc(receiptId).update({
            status: 'putaway_complete',
            putawayAt: new Date().toISOString(),
            locationId,
            locationCode: location.displayCode || locationId,
        });
    }
    // Audit log
    await (0, utils_1.writeAuditLog)({
        actorId: uid,
        actorName: pickerName,
        actorRole: role,
        action: 'STOCK_PUTAWAY',
        targetCollection: utils_1.C.INVENTORY,
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
});
//# sourceMappingURL=putaway.js.map