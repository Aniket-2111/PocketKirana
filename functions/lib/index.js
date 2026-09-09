"use strict";
/**
 * PocketKirana Cloud Functions — Main Entry Point
 *
 * All exported functions from this file are deployed to Firebase Cloud Functions.
 * Region: asia-south1 (Mumbai) for lowest latency for Indian users.
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
exports.getDashboardSummary = exports.saveFcmToken = exports.updateUserProfile = exports.onUserCreated = exports.setUserRole = exports.assignDeliveryPartner = exports.recordDeliveryFailure = exports.completeDelivery = exports.updateDeliveryStage = exports.verifyStorePickup = exports.rejectDeliveryAssignment = exports.acceptDeliveryAssignment = exports.autoCompleteOrders = exports.cancelOrder = exports.placeOrder = exports.releaseExpiredReservations = exports.confirmPutaway = exports.scanBarcode = exports.validateDeliveryZone = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK (once, at cold start)
if (!admin.apps.length) {
    admin.initializeApp();
}
// ══════════════════════════════════════════
// INVENTORY FUNCTIONS
// ══════════════════════════════════════════
var validateDeliveryZone_1 = require("./inventory/validateDeliveryZone");
Object.defineProperty(exports, "validateDeliveryZone", { enumerable: true, get: function () { return validateDeliveryZone_1.validateDeliveryZone; } });
var scanBarcode_1 = require("./inventory/scanBarcode");
Object.defineProperty(exports, "scanBarcode", { enumerable: true, get: function () { return scanBarcode_1.scanBarcode; } });
var putaway_1 = require("./inventory/putaway");
Object.defineProperty(exports, "confirmPutaway", { enumerable: true, get: function () { return putaway_1.confirmPutaway; } });
var releaseExpiredReservations_1 = require("./inventory/releaseExpiredReservations");
Object.defineProperty(exports, "releaseExpiredReservations", { enumerable: true, get: function () { return releaseExpiredReservations_1.releaseExpiredReservations; } });
// ══════════════════════════════════════════
// ORDER FUNCTIONS
// ══════════════════════════════════════════
var placeOrder_1 = require("./orders/placeOrder");
Object.defineProperty(exports, "placeOrder", { enumerable: true, get: function () { return placeOrder_1.placeOrder; } });
var cancelOrder_1 = require("./orders/cancelOrder");
Object.defineProperty(exports, "cancelOrder", { enumerable: true, get: function () { return cancelOrder_1.cancelOrder; } });
var autoCompleteOrders_1 = require("./orders/autoCompleteOrders");
Object.defineProperty(exports, "autoCompleteOrders", { enumerable: true, get: function () { return autoCompleteOrders_1.autoCompleteOrders; } });
// ══════════════════════════════════════════
// DELIVERY FUNCTIONS (Callables)
// ══════════════════════════════════════════
var acceptAssignment_1 = require("./delivery/acceptAssignment");
Object.defineProperty(exports, "acceptDeliveryAssignment", { enumerable: true, get: function () { return acceptAssignment_1.acceptDeliveryAssignment; } });
Object.defineProperty(exports, "rejectDeliveryAssignment", { enumerable: true, get: function () { return acceptAssignment_1.rejectDeliveryAssignment; } });
var verifyPickup_1 = require("./delivery/verifyPickup");
Object.defineProperty(exports, "verifyStorePickup", { enumerable: true, get: function () { return verifyPickup_1.verifyStorePickup; } });
Object.defineProperty(exports, "updateDeliveryStage", { enumerable: true, get: function () { return verifyPickup_1.updateDeliveryStage; } });
var completeDelivery_1 = require("./delivery/completeDelivery");
Object.defineProperty(exports, "completeDelivery", { enumerable: true, get: function () { return completeDelivery_1.completeDelivery; } });
Object.defineProperty(exports, "recordDeliveryFailure", { enumerable: true, get: function () { return completeDelivery_1.recordDeliveryFailure; } });
// ══════════════════════════════════════════
// DELIVERY FUNCTIONS (Firestore Triggers)
// ══════════════════════════════════════════
var assignPartner_1 = require("./delivery/assignPartner");
Object.defineProperty(exports, "assignDeliveryPartner", { enumerable: true, get: function () { return assignPartner_1.assignDeliveryPartner; } });
var setUserRole_1 = require("./auth/setUserRole");
Object.defineProperty(exports, "setUserRole", { enumerable: true, get: function () { return setUserRole_1.setUserRole; } });
var userAuth_1 = require("./auth/userAuth");
Object.defineProperty(exports, "onUserCreated", { enumerable: true, get: function () { return userAuth_1.onUserCreated; } });
Object.defineProperty(exports, "updateUserProfile", { enumerable: true, get: function () { return userAuth_1.updateUserProfile; } });
Object.defineProperty(exports, "saveFcmToken", { enumerable: true, get: function () { return userAuth_1.saveFcmToken; } });
// ══════════════════════════════════════════
// ADMIN FUNCTIONS
// ══════════════════════════════════════════
var getDashboardSummary_1 = require("./admin/getDashboardSummary");
Object.defineProperty(exports, "getDashboardSummary", { enumerable: true, get: function () { return getDashboardSummary_1.getDashboardSummary; } });
//# sourceMappingURL=index.js.map