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

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { C, inventoryDocId } from '../utils';

export const scanBarcode = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }
    const role = request.auth.token.role;
    if (role !== 'picker' && role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only pickers and admins can scan barcodes.');
    }

    const { barcode, storeId } = request.data as {
      barcode: string;
      storeId: string;
    };

    if (!barcode || !storeId) {
      throw new HttpsError('invalid-argument', 'barcode and storeId are required.');
    }

    const db = admin.firestore();

    // 1. Look up in productBarcodes collection
    const barcodeSnap = await db
      .collection(C.PRODUCT_BARCODES)
      .where('barcode', '==', barcode.trim())
      .where('storeId', '==', storeId)
      .limit(1)
      .get();

    if (barcodeSnap.empty) {
      // Also try direct lookup on products.barcode field (legacy)
      const legacySnap = await db
        .collection(C.PRODUCTS)
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
        .collection(C.INVENTORY)
        .doc(inventoryDocId(product.id, storeId))
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
      .collection(C.PRODUCTS)
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
      .collection(C.INVENTORY)
      .doc(inventoryDocId(product.id, storeId))
      .get();

    return {
      found: true,
      product,
      inventory: invSnap.exists ? invSnap.data() : null,
      barcodeType: barcodeDoc.barcodeType,
      barcode,
    };
  }
);
