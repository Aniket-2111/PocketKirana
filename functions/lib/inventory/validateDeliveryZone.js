"use strict";
/**
 * Cloud Function: validateDeliveryZone
 *
 * Server-side delivery zone check using Haversine formula.
 * Called before checkout to verify the customer address is
 * within the configured delivery radius.
 *
 * Input:  { latitude: number, longitude: number }
 * Output: { isServiceable: boolean, distanceKm: number, message: string }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDeliveryZone = void 0;
const https_1 = require("firebase-functions/v2/https");
const utils_1 = require("../utils");
exports.validateDeliveryZone = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    const { latitude, longitude } = request.data;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new https_1.HttpsError('invalid-argument', 'latitude and longitude are required numbers.');
    }
    const config = await (0, utils_1.getStoreConfig)();
    const distanceKm = (0, utils_1.haversineKm)(config.latitude, config.longitude, latitude, longitude);
    const isServiceable = distanceKm <= config.deliveryRadiusKm && config.isOpen;
    let message;
    if (!config.isOpen) {
        message = 'PocketKirana is currently closed. Please try again during store hours.';
    }
    else if (!isServiceable) {
        message = `Sorry, PocketKirana does not currently deliver to this location. We deliver within ${config.deliveryRadiusKm} km of our store. Your address is ${distanceKm.toFixed(1)} km away.`;
    }
    else {
        message = `Great! We deliver to your area (${distanceKm.toFixed(1)} km from store).`;
    }
    return {
        isServiceable,
        distanceKm: Math.round(distanceKm * 100) / 100,
        deliveryRadiusKm: config.deliveryRadiusKm,
        message,
    };
});
//# sourceMappingURL=validateDeliveryZone.js.map