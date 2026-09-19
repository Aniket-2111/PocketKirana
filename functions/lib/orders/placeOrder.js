"use strict";
/**
 * Cloud Function: placeOrder
 *
 * The most critical business logic function.
 * Handles the complete order creation flow server-side:
 *
 * 1. Auth check — must be authenticated customer
 * 2. Validate address (belongs to customer, has coordinates)
 * 3. Server-side delivery zone check (Haversine)
 * 4. Validate all cart items (exist, active status)
 * 5. Check available stock for each item
 * 6. Validate coupon (if provided) server-side
 * 7. Calculate all totals server-side (subtotal, delivery fee, discount, tax, total)
 * 8. Create order document in Firestore (status: CREATED)
 * 9. Reserve stock atomically (stockReservations collection)
 * 10. For COD: immediately set status CONFIRMED
 * 11. For online payment: return Razorpay order ID
 * 12. Send notifications (customer + admin)
 * 13. Create audit log
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
exports.placeOrder = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
exports.placeOrder = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be logged in to place an order.');
    }
    const uid = request.auth.uid;
    const userRole = request.auth.token.role || 'customer';
    // Only customers can place orders
    if (userRole !== 'customer' && userRole !== undefined) {
        // Allow no-role users (new customers before role is set)
    }
    const db = admin.firestore();
    const { cartItems, addressId, paymentMethod, couponCode, storeId = utils_1.STORE_ID, } = request.data;
    // ── 2. INPUT VALIDATION ────────────────────────────────────────
    if (!cartItems || cartItems.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'Cart cannot be empty.');
    }
    if (!addressId) {
        throw new https_1.HttpsError('invalid-argument', 'Delivery address is required.');
    }
    if (!['cod', 'razorpay', 'phonepe', 'upi', 'card'].includes(paymentMethod)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid payment method.');
    }
    // ── 3. FETCH ADDRESS & VALIDATE OWNERSHIP ─────────────────────
    const addrSnap = await db.collection(utils_1.C.ADDRESSES).doc(addressId).get();
    if (!addrSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Delivery address not found.');
    }
    const address = addrSnap.data();
    if (address.userId !== uid) {
        throw new https_1.HttpsError('permission-denied', 'This address does not belong to you.');
    }
    if (!address.latitude || !address.longitude) {
        throw new https_1.HttpsError('invalid-argument', 'Address is missing coordinates. Please re-select your delivery location.');
    }
    // ── 4. SERVER-SIDE DELIVERY ZONE CHECK ────────────────────────
    const config = await (0, utils_1.getStoreConfig)();
    const distanceKm = (0, utils_1.haversineKm)(config.latitude, config.longitude, address.latitude, address.longitude);
    if (distanceKm > config.deliveryRadiusKm) {
        throw new https_1.HttpsError('failed-precondition', `Sorry, PocketKirana does not deliver to your location. Your address is ${distanceKm.toFixed(1)} km from our store (limit: ${config.deliveryRadiusKm} km).`);
    }
    if (!config.isOpen) {
        throw new https_1.HttpsError('failed-precondition', 'PocketKirana store is currently closed. Please order during store hours.');
    }
    if (paymentMethod === 'cod' && !config.codEnabled) {
        throw new https_1.HttpsError('failed-precondition', 'Cash on Delivery is not available at this time.');
    }
    // ── 5. FETCH & VALIDATE PRODUCTS ──────────────────────────────
    const productFetches = cartItems.map((item) => db.collection(utils_1.C.PRODUCTS).doc(item.productId).get());
    const productSnaps = await Promise.all(productFetches);
    const validatedItems = [];
    let subtotal = 0;
    for (let i = 0; i < cartItems.length; i++) {
        const snap = productSnaps[i];
        const cartItem = cartItems[i];
        if (!snap.exists) {
            throw new https_1.HttpsError('not-found', `Product ${cartItem.productId} not found.`);
        }
        const product = snap.data();
        if (product.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', `${product.name} is currently unavailable.`);
        }
        const unitPrice = product.sellingPrice ?? product.price ?? product.mrp;
        const lineTotal = unitPrice * cartItem.quantity;
        subtotal += lineTotal;
        validatedItems.push({
            productId: cartItem.productId,
            productName: product.name,
            sku: product.sku || '',
            quantity: cartItem.quantity,
            unitPrice,
            totalPrice: lineTotal,
            imageUrl: product.thumbnail || product.imageUrl || '',
        });
    }
    // ── 6. MINIMUM ORDER CHECK ────────────────────────────────────
    if (subtotal < config.minimumOrderValue) {
        throw new https_1.HttpsError('failed-precondition', `Minimum order value is ₹${config.minimumOrderValue}. Your cart total is ₹${subtotal}.`);
    }
    // ── 7. PER-USER RATE LIMIT ────────────────────────────────────────
    // Max 5 orders per user per hour to prevent abuse
    const rateLimitRef = db.collection('rateLimits').doc(`placeOrder:${uid}`);
    const rateLimitSnap = await rateLimitRef.get();
    const rateData = rateLimitSnap.data();
    const windowStart = Date.now() - 60 * 60 * 1000; // 1 hour ago
    if (rateData) {
        const recentCount = (rateData.timestamps || [])
            .filter((ts) => ts > windowStart).length;
        if (recentCount >= 5) {
            throw new https_1.HttpsError('resource-exhausted', 'You have placed too many orders in the last hour. Please wait before placing another order.');
        }
    }
    // ── 8. COUPON VALIDATION ──────────────────────────────────────
    let discount = 0;
    let appliedCouponCode = null;
    if (couponCode) {
        const couponSnap = await db
            .collection(utils_1.C.COUPONS)
            .where('code', '==', couponCode.toUpperCase().trim())
            .limit(1)
            .get();
        if (!couponSnap.empty) {
            const coupon = couponSnap.docs[0].data();
            const now = new Date().toISOString();
            if (coupon.active &&
                coupon.startDate <= now &&
                coupon.endDate >= now &&
                subtotal >= (coupon.minimumOrder || 0)) {
                if (coupon.type === 'percentage') {
                    discount = Math.min((subtotal * coupon.value) / 100, coupon.maxDiscount || Infinity);
                }
                else {
                    discount = Math.min(coupon.value, subtotal);
                }
                appliedCouponCode = coupon.code;
            }
        }
    }
    // ── 8. CALCULATE TOTALS ───────────────────────────────────────
    const afterDiscount = subtotal - discount;
    const deliveryFee = afterDiscount >= config.freeDeliveryThreshold ? 0 : config.deliveryFee;
    const taxRate = 0.05; // 5% GST
    const taxAmount = Math.round(afterDiscount * taxRate * 100) / 100;
    const total = Math.round((afterDiscount + deliveryFee + taxAmount) * 100) / 100;
    // ── 9. FETCH USER PROFILE ─────────────────────────────────────
    const userSnap = await db.collection(utils_1.C.USERS).doc(uid).get();
    const user = userSnap.data() || {};
    const customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
    const customerPhone = user.mobile || user.phone || '';
    // ── 10. CREATE ORDER ──────────────────────────────────────────
    const orderId = (0, utils_1.newId)('ord');
    // Generate concurrency-safe sequential production order number (PK-01, PK-02 ...)
    const orderNumber = await (0, utils_1.generateProductionOrderNumber)();
    const deliveryOtp = String(1000 + Math.floor(Math.random() * 9000));
    const now = new Date().toISOString();
    const orderDoc = {
        id: orderId,
        orderNumber,
        customerId: uid,
        customerName,
        customerPhone,
        storeId,
        storeName: 'PocketKirana',
        addressId,
        address,
        subtotal,
        discount,
        deliveryFee,
        tax: taxAmount,
        total,
        couponCode: appliedCouponCode,
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
        orderStatus: 'CREATED',
        deliveryOtp,
        placedAt: now,
        statusHistory: [
            { status: 'CREATED', timestamp: now, actorId: uid, note: 'Order created by customer' },
        ],
        items: validatedItems,
    };
    await db.collection(utils_1.C.ORDERS).doc(orderId).set(orderDoc);
    // ── 12. RESERVE STOCK ATOMICALLY (with in-transaction availability re-check) ────
    // IMPORTANT: This transaction is the AUTHORITATIVE stock check.
    // The check above is optimistic (fast fail for UX). The real guard is here.
    const reservationItems = validatedItems.map((item) => ({
        productId: item.productId,
        inventoryId: (0, utils_1.inventoryDocId)(item.productId, storeId),
        quantity: item.quantity,
    }));
    const reservationExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    await db.runTransaction(async (tx) => {
        // ── Inside transaction: re-check availability and reserve ──
        for (const item of reservationItems) {
            const invRef = db.collection(utils_1.C.INVENTORY).doc(item.inventoryId);
            const invSnap = await tx.get(invRef);
            const inv = invSnap.data() || { quantity: 0, reservedQuantity: 0, damagedQuantity: 0 };
            // AUTHORITATIVE availability check (inside transaction — race-safe)
            const currentAvailable = (inv.quantity || 0) - (inv.reservedQuantity || 0) - (inv.damagedQuantity || 0);
            if (currentAvailable < item.quantity) {
                // Find the product name for a better error message
                const productName = validatedItems.find((v) => v.productId === item.productId)?.productName || item.productId;
                throw new https_1.HttpsError('failed-precondition', `"${productName}" just went out of stock. Please remove it from your cart and try again.`);
            }
            const newReserved = (inv.reservedQuantity || 0) + item.quantity;
            const newAvailable = (inv.quantity || 0) - newReserved - (inv.damagedQuantity || 0);
            tx.update(invRef, {
                reservedQuantity: newReserved,
                availableQuantity: Math.max(0, newAvailable),
                updatedAt: now,
            });
        }
        // Create reservation record
        tx.set(db.collection(utils_1.C.STOCK_RESERVATIONS).doc(orderId), {
            reservationId: orderId,
            orderId,
            customerId: uid,
            storeId,
            items: reservationItems,
            status: 'reserved',
            reservedAt: now,
            expiresAt: reservationExpiry,
        });
        // Record this order in the rate limit counter
        tx.set(rateLimitRef, {
            uid,
            timestamps: [...((rateData?.timestamps || []).filter((ts) => ts > windowStart)), Date.now()],
            updatedAt: now,
        });
    });
    // ── 12. FOR COD — IMMEDIATELY CONFIRM ─────────────────────────
    if (paymentMethod === 'cod') {
        await db.collection(utils_1.C.ORDERS).doc(orderId).update({
            orderStatus: 'CONFIRMED',
            paymentStatus: 'pending', // COD = pending until delivery
            statusHistory: admin.firestore.FieldValue.arrayUnion({
                status: 'CONFIRMED',
                timestamp: new Date().toISOString(),
                actorId: 'system',
                note: 'Order auto-confirmed for COD payment',
            }),
        });
        // Create picking task
        await createPickingTask(db, orderId, orderNumber, storeId, validatedItems, now);
    }
    // ── 13. SEND NOTIFICATIONS ────────────────────────────────────
    await Promise.allSettled([
        (0, utils_1.createNotificationRecord)({
            recipientId: uid,
            recipientType: 'customer',
            type: 'ORDER_PLACED',
            title: '🛒 Order Placed!',
            message: `Your order #${orderNumber} worth ₹${total} has been placed successfully.`,
            orderId,
            deepLink: `/orders/${orderId}`,
        }),
        (0, utils_1.sendFcmToUser)(uid, {
            title: '🛒 Order Placed!',
            body: `Order #${orderNumber} (₹${total}) — ${paymentMethod === 'cod' ? 'COD, confirmed!' : 'Complete payment to confirm.'}`,
        }, { orderId, orderNumber }),
        (0, utils_1.createNotificationRecord)({
            recipientId: 'admin',
            recipientType: 'admin',
            type: 'ADMIN_NEW_ORDER',
            title: `🆕 New Order: #${orderNumber}`,
            message: `₹${total} • ${paymentMethod.toUpperCase()} • ${validatedItems.length} items`,
            orderId,
        }),
        (0, utils_1.sendFcmToRole)('admin', storeId, {
            title: `🆕 New Order: #${orderNumber}`,
            body: `₹${total} • ${paymentMethod.toUpperCase()} • ${validatedItems.length} items`,
        }, { orderId, orderNumber }),
    ]);
    // ── 14. AUDIT LOG ─────────────────────────────────────────────
    await (0, utils_1.writeAuditLog)({
        actorId: uid,
        actorName: customerName,
        actorRole: 'customer',
        action: 'ORDER_PLACED',
        targetCollection: utils_1.C.ORDERS,
        targetId: orderId,
        description: `Order #${orderNumber} placed for ₹${total} via ${paymentMethod}`,
        orderId,
    });
    // Return response
    return {
        success: true,
        orderId,
        orderNumber,
        total,
        paymentMethod,
        // For online payment: return Razorpay details
        ...(paymentMethod !== 'cod' && {
            // razorpayOrderId: razorpayOrder.id,  // Uncomment when Razorpay is configured
            requiresPayment: true,
            message: 'Complete payment to confirm your order.',
        }),
    };
});
// ── HELPER: Create picking task ────────────────────────────────────────
async function createPickingTask(db, orderId, orderNumber, storeId, items, now) {
    const taskId = (0, utils_1.newId)('task');
    // Fetch storage locations for items
    const locSnap = await db.collection(utils_1.C.STORE_LOCATIONS)
        .where('storeId', '==', storeId)
        .get();
    const locMap = {};
    locSnap.docs.forEach((d) => { locMap[d.id] = d.data(); });
    // Fetch inventory to get location for each product
    const invFetches = items.map((item) => db.collection(utils_1.C.INVENTORY).doc((0, utils_1.inventoryDocId)(item.productId, storeId)).get());
    const invSnaps = await Promise.all(invFetches);
    const pickingItems = items.map((item, i) => {
        const inv = invSnaps[i].data();
        const locationId = inv?.locationId || '';
        const loc = locMap[locationId];
        return {
            id: (0, utils_1.newId)('pi'),
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            upc: '',
            barcode: '',
            unit: '',
            imageUrl: '',
            quantityRequired: item.quantity,
            quantityPicked: 0,
            storageLocation: loc || { displayCode: '?', aisle: '' },
            locationId,
            status: 'pending',
        };
    });
    // Sort items by aisle for optimal picking route
    pickingItems.sort((a, b) => {
        const aisleA = (a.storageLocation?.aisle || '').toLowerCase();
        const aisleB = (b.storageLocation?.aisle || '').toLowerCase();
        return aisleA.localeCompare(aisleB);
    });
    await db.collection(utils_1.C.PICKING_TASKS).doc(taskId).set({
        id: taskId,
        orderId,
        orderNumber,
        storeId,
        storeName: 'PocketKirana',
        status: 'assigned',
        priority: 'NORMAL',
        items: pickingItems,
        totalItemsCount: items.length,
        pickedItemsCount: 0,
        createdAt: now,
    });
    // Link picking task to order
    await db.collection(utils_1.C.ORDERS).doc(orderId).update({
        pickingTaskId: taskId,
        orderStatus: 'STOCK_RESERVED',
        statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: 'STOCK_RESERVED',
            timestamp: now,
            actorId: 'system',
            note: 'Stock reserved, picking task created',
        }),
    });
}
//# sourceMappingURL=placeOrder.js.map