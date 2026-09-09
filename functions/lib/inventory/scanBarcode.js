"use strict";
/**
 * Cloud Function: scanBarcode
 *
 * Barcode lookup for pickers. Searches productBarcodes collection
 * and returns the matching product with live inventory levels.
 *
 * Restricted to authenticated users with role 'picker' or 'admin'.
 *
 * Input:  { barcode: string, storeId: string }
 * Output: { found: boolean, product?, inventory?, barcode }
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
exports.scanBarcode = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
exports.scanBarcode = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    // Auth check
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const role = request.auth.token.role;
    if (role !== 'picker' && role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Only pickers and admins can scan barcodes.');
    }
    const { barcode, storeId } = request.data;
    if (!barcode || !storeId) {
        throw new https_1.HttpsError('invalid-argument', 'barcode and storeId are required.');
    }
    const db = admin.firestore();
    // 1. Look up in productBarcodes collection
    const barcodeSnap = await db
        .collection(utils_1.C.PRODUCT_BARCODES)
        .where('barcode', '==', barcode.trim())
        .where('storeId', '==', storeId)
        .limit(1)
        .get();
    if (barcodeSnap.empty) {
        // Also try direct lookup on products.barcode field (legacy)
        const legacySnap = await db
            .collection(utils_1.C.PRODUCTS)
            .where('barcode', '==', barcode.trim())
            .limit(1)
            .get();
        if (legacySnap.empty) {
            return {
                found: false,
                barcode,
                message: 'Barcode not found in product master. Please submit a New Product Request.',
            };
        }
        const product = { id: legacySnap.docs[0].id, ...legacySnap.docs[0].data() };
        const invSnap = await db
            .collection(utils_1.C.INVENTORY)
            .doc((0, utils_1.inventoryDocId)(product.id, storeId))
            .get();
        return {
            found: true,
            product,
            inventory: invSnap.exists ? invSnap.data() : null,
            barcode,
        };
    }
    const barcodeDoc = barcodeSnap.docs[0].data();
    const productSnap = await db
        .collection(utils_1.C.PRODUCTS)
        .doc(barcodeDoc.productId)
        .get();
    if (!productSnap.exists) {
        return {
            found: false,
            barcode,
            message: 'Product record not found for this barcode.',
        };
    }
    const product = { id: productSnap.id, ...productSnap.data() };
    // Fetch live inventory
    const invSnap = await db
        .collection(utils_1.C.INVENTORY)
        .doc((0, utils_1.inventoryDocId)(product.id, storeId))
        .get();
    return {
        found: true,
        product,
        inventory: invSnap.exists ? invSnap.data() : null,
        barcodeType: barcodeDoc.barcodeType,
        barcode,
    };
});
//# sourceMappingURL=scanBarcode.js.map