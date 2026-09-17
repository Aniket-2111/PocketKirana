/**
 * Customer App Device Location Interface
 * Bridges with the Central Location Manager
 */

export {
  locationManager,
  type LocationCoordinates as LocationResult,
  type LocationManagerState,
  type LocationPermissionState,
  type GpsHardwareState,
  type LocationStatus,
} from '@/lib/locationManager';

import { locationManager } from '@/lib/locationManager';

export async function checkDeviceLocationPermission() {
  const state = await locationManager.checkState();
  return {
    state: state.permission === 'GRANTED' ? 'granted' : state.permission === 'DENIED' ? 'denied' : 'prompt',
    gps: state.gps,
  };
}

export async function requestDeviceLocationPermission() {
  return locationManager.requestPermission();
}

export async function getDeviceCoordinates() {
  return locationManager.getCurrentCoordinates({ enableHighAccuracy: true });
}

export function openDeviceLocationSettings() {
  locationManager.openLocationSettings();
}

export function openDeviceAppSettings() {
  locationManager.openAppSettings();
}
