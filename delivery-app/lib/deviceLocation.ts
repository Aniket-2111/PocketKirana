/**
 * Delivery App Device Location Interface
 * Bridges with the Central Location Manager
 */

export {
  locationManager,
  type LocationCoordinates,
  type LocationManagerState,
  type LocationPermissionState,
  type GpsHardwareState,
  type LocationStatus,
} from '@/lib/locationManager';

import { locationManager, LocationCoordinates } from '@/lib/locationManager';

export async function checkDeliveryLocationState() {
  return locationManager.checkState({ forceFresh: true });
}

export async function requestDeliveryLocationPermission() {
  return locationManager.requestPermission();
}

export async function getDeliveryCurrentLocation() {
  return locationManager.getCurrentCoordinates({ enableHighAccuracy: true });
}

export function startDeliveryLiveTracking(callback: (coords: LocationCoordinates) => void) {
  return locationManager.startLiveTracking(callback);
}

export function stopDeliveryLiveTracking() {
  locationManager.stopLiveTracking();
}

export function openDeliveryLocationSettings() {
  locationManager.openLocationSettings();
}

export function openDeliveryAppSettings() {
  locationManager.openAppSettings();
}
