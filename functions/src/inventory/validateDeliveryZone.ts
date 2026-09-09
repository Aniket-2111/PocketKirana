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

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  haversineKm,
  getStoreConfig,
} from '../utils';

export const validateDeliveryZone = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    const { latitude, longitude } = request.data as {
      latitude: number;
      longitude: number;
    };

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new HttpsError('invalid-argument', 'latitude and longitude are required numbers.');
    }

    const config = await getStoreConfig();

    const distanceKm = haversineKm(
      config.latitude,
      config.longitude,
      latitude,
      longitude
    );

    const isServiceable = distanceKm <= config.deliveryRadiusKm && config.isOpen;

    let message: string;
    if (!config.isOpen) {
      message = 'PocketKirana is currently closed. Please try again during store hours.';
    } else if (!isServiceable) {
      message = `Sorry, PocketKirana does not currently deliver to this location. We deliver within ${config.deliveryRadiusKm} km of our store. Your address is ${distanceKm.toFixed(1)} km away.`;
    } else {
      message = `Great! We deliver to your area (${distanceKm.toFixed(1)} km from store).`;
    }

    return {
      isServiceable,
      distanceKm: Math.round(distanceKm * 100) / 100,
      deliveryRadiusKm: config.deliveryRadiusKm,
      message,
    };
  }
);
