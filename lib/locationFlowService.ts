/**
 * PocketKirana — Location & Serviceability Flow Service
 *
 * Implements the Blinkit-style deterministic onboarding flow:
 * 1. App Open -> check location availability
 * 2. Pre-login location explanation modal -> "Use my location" or "Choose location manually"
 * 3. Precise or Approximate location support
 * 4. 3-Layer Serviceability Engine check (Haversine radius, Road distance limit, Store operational hours)
 * 5. Distinct states: SERVICEABLE, UNSERVICEABLE, STORE_CLOSED, SERVICEABILITY_NETWORK_ERROR
 * 6. Non-blocking browsing fallback
 * 7. State synchronization with header & address picker
 */

import { locationManager, LocationCoordinates } from './locationManager';
import {
  resolveLocationFromCoords,
  ZoneServiceability,
  GeocodedLocation,
} from './locationServices';

export type LocationFlowStatus =
  | 'LOCATION_UNKNOWN'
  | 'LOCATION_PERMISSION_REQUIRED'
  | 'LOCATION_PERMISSION_DENIED'
  | 'LOCATION_PERMISSION_DENIED_PERMANENTLY'
  | 'LOCATION_FETCHING'
  | 'LOCATION_AVAILABLE'
  | 'LOCATION_UNAVAILABLE'
  | 'SERVICEABILITY_CHECKING'
  | 'SERVICEABLE'
  | 'UNSERVICEABLE'
  | 'STORE_CLOSED'
  | 'SERVICEABILITY_NETWORK_ERROR'
  | 'MANUAL_LOCATION_REQUIRED';

export interface SelectedLocationData {
  latitude: number;
  longitude: number;
  addressLine: string;
  city: string;
  pincode: string;
  isManual: boolean;
  isPrecise?: boolean;
}

export interface LocationFlowState {
  status: LocationFlowStatus;
  selectedLocation: SelectedLocationData | null;
  serviceability: ZoneServiceability | null;
  error: string | null;
  isNetworkError: boolean;
  isExplanationOpen: boolean;
  isManualPickerOpen: boolean;
  isUnserviceableModalOpen: boolean;
  allowBrowsingUnserviceable: boolean;
  lastUpdated: number;
}

type Listener = (state: LocationFlowState) => void;

const STORAGE_KEY_LOCATION = 'pk_selected_location';
const STORAGE_KEY_ONBOARDED = 'pk_location_onboarding_shown';

// Default Fallback Hub (Neral, Maule Kirana Hub)
export const DEFAULT_NERAL_LOCATION: SelectedLocationData = {
  latitude: 19.0224536,
  longitude: 73.3210018,
  addressLine: 'Maule Kirana Hub, Station Road',
  city: 'Neral',
  pincode: '410101',
  isManual: true,
  isPrecise: true,
};

class LocationFlowService {
  private state: LocationFlowState = {
    status: 'LOCATION_UNKNOWN',
    selectedLocation: null,
    serviceability: null,
    error: null,
    isNetworkError: false,
    isExplanationOpen: false,
    isManualPickerOpen: false,
    isUnserviceableModalOpen: false,
    allowBrowsingUnserviceable: false,
    lastUpdated: 0,
  };

  private listeners = new Set<Listener>();
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public getState(): LocationFlowState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(partial: Partial<LocationFlowState>): void {
    this.state = {
      ...this.state,
      ...partial,
      lastUpdated: Date.now(),
    };
    this.notify();
  }

  private notify(): void {
    const current = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (err) {
        console.error('[LocationFlowService] Listener error:', err);
      }
    });
  }

  /**
   * Deterministic App Startup Initialization
   */
  public async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.initialized) return;
    this.initialized = true;

    // 1. Check if selected location is already persisted
    const saved = localStorage.getItem(STORAGE_KEY_LOCATION);
    if (saved) {
      try {
        const parsed: SelectedLocationData = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude) {
          this.setState({
            selectedLocation: parsed,
            status: 'SERVICEABILITY_CHECKING',
          });
          await this.evaluateServiceability(parsed.latitude, parsed.longitude, parsed.pincode);
          return;
        }
      } catch (_) {}
    }

    // 2. Check native/browser location permission
    const locMgrState = await locationManager.checkState({ silent: true });

    if (locMgrState.permission === 'GRANTED' && locMgrState.coords) {
      // Permission already granted previously
      await this.resolveAndSetCoords(locMgrState.coords.latitude, locMgrState.coords.longitude, true);
    } else {
      // Location permission required before login
      this.setState({
        status: 'LOCATION_PERMISSION_REQUIRED',
        isExplanationOpen: true,
      });
    }
  }

  /**
   * User taps "Use my location" from pre-login explanation
   */
  public async requestDeviceLocation(): Promise<boolean> {
    this.setState({
      status: 'LOCATION_FETCHING',
      error: null,
      isNetworkError: false,
    });

    try {
      const granted = await locationManager.requestPermission();
      if (!granted) {
        const check = await locationManager.checkState({ forceFresh: true });
        const isPermDenied = check.permission === 'DENIED';
        this.setState({
          status: isPermDenied
            ? 'LOCATION_PERMISSION_DENIED_PERMANENTLY'
            : 'LOCATION_PERMISSION_DENIED',
          isExplanationOpen: true,
          error: 'Location permission was denied. You can choose your location manually.',
        });
        return false;
      }

      // Permission granted -> Fetch Coordinates (supports precise or approximate)
      const coords = await locationManager.getCurrentCoordinates();
      if (!coords) {
        this.setState({
          status: 'LOCATION_UNAVAILABLE',
          isExplanationOpen: true,
          error: 'Unable to get GPS location. Please turn on device location or select manually.',
        });
        return false;
      }

      // Determine precision (accuracy <= 100m usually precise, > 100m approximate)
      const isPrecise = coords.accuracy <= 100;
      await this.resolveAndSetCoords(coords.latitude, coords.longitude, isPrecise);
      return true;
    } catch (err: any) {
      console.warn('[LocationFlowService] requestDeviceLocation error:', err);
      this.setState({
        status: 'LOCATION_UNAVAILABLE',
        error: err?.message || 'Error fetching location coordinates.',
        isExplanationOpen: true,
      });
      return false;
    }
  }

  /**
   * Resolves reverse geocode and evaluates 3-layer serviceability
   */
  public async resolveAndSetCoords(
    lat: number,
    lon: number,
    isPrecise = true,
    isManual = false,
    overrideDetails?: Partial<SelectedLocationData>
  ): Promise<void> {
    this.setState({
      status: 'SERVICEABILITY_CHECKING',
      isExplanationOpen: false,
      error: null,
      isNetworkError: false,
    });

    let addressLine = overrideDetails?.addressLine || (isManual ? 'Selected Location' : 'Current Location');
    let city = overrideDetails?.city || 'Neral';
    let pincode = overrideDetails?.pincode || '410101';

    // Reverse geocode if not already explicitly provided
    if (!overrideDetails?.addressLine || !overrideDetails?.city) {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error('NETWORK_OFFLINE');
        }

        const geocoded: GeocodedLocation = await resolveLocationFromCoords(lat, lon);
        if (geocoded.addressLine && !overrideDetails?.addressLine) {
          addressLine = geocoded.addressLine;
        }
        if (geocoded.city && !overrideDetails?.city) city = geocoded.city;
        if (geocoded.pincode && !overrideDetails?.pincode) pincode = geocoded.pincode;
      } catch (netErr: any) {
        console.warn('[LocationFlowService] Geocoding network note:', netErr);
        if (netErr?.message === 'NETWORK_OFFLINE' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          this.setState({
            status: 'SERVICEABILITY_NETWORK_ERROR',
            isNetworkError: true,
            error: "Couldn't check delivery availability. Please try again.",
          });
          return;
        }
      }
    }

    const locData: SelectedLocationData = {
      latitude: lat,
      longitude: lon,
      addressLine,
      city,
      pincode,
      isManual,
      isPrecise,
    };

    // Persist
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(locData));
        localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
      } catch (_) {}
    }

    this.setState({
      selectedLocation: locData,
    });

    await this.evaluateServiceability(lat, lon, pincode);
  }

  /**
   * Evaluates serviceability against the canonical backend API (GET /api/serviceability/check).
   * Advisory only: does NOT determine final checkout validity or block order placement.
   */
  public async evaluateServiceability(
    lat: number,
    lon: number,
    pincode?: string
  ): Promise<ZoneServiceability | null> {
    try {
      // Check offline status first to prevent false unserviceable determination
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.setState({
          status: 'SERVICEABILITY_NETWORK_ERROR',
          isNetworkError: true,
          error: "Couldn't check delivery availability. Please try again.",
        });
        return null;
      }

      const query = new URLSearchParams({
        lat: String(lat),
        lng: String(lon),
        storeId: 'store-001',
      });
      const endpoint = `/api/serviceability/check?${query.toString()}`;
      let targetUrl = endpoint;
      try {
        new URL(endpoint);
      } catch {
        const base =
          typeof window !== 'undefined' &&
          window.location?.origin &&
          window.location.origin !== 'null' &&
          window.location.origin !== 'about:blank'
            ? window.location.origin
            : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
        targetUrl = new URL(endpoint, base).toString();
      }

      const res = await fetch(targetUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok && res.status >= 500) {
        throw new Error(`API_ERROR_${res.status}`);
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        throw new Error('INVALID_RESPONSE');
      }

      const isServiceable = Boolean(data.serviceable);
      const distance =
        typeof data.distanceKm === 'number'
          ? data.distanceKm
          : (typeof data.straightLineDistanceKm === 'number' ? data.straightLineDistanceKm : 0);

      const radius =
        typeof data.maximumDistanceKm === 'number'
          ? data.maximumDistanceKm
          : (typeof data.store?.deliveryRadiusKm === 'number' ? data.store.deliveryRadiusKm : 3.0);

      const storeName = data.storeName || data.store?.name || 'Maule Kirana (Neral Hub)';
      const storeId = data.storeId || data.store?.id || 'store-001';

      if (isServiceable) {
        const serviceability: ZoneServiceability = {
          isServiceable: true,
          zoneId: `ZONE_${storeId}`,
          zoneName: `${storeName} — Hyperlocal Express`,
          distanceKm: distance,
          straightLineDistanceKm: distance,
          roadDistanceKm: distance,
          radiusKm: radius,
          maximumDistanceKm: radius,
          remainingKm: Number(Math.max(0, radius - distance).toFixed(1)),
          estimatedDeliveryMinutes: Math.max(10, Math.round(10 + distance * 3)),
          deliveryFee: typeof data.deliveryFee === 'number' ? data.deliveryFee : 0,
          storeId,
          storeName,
          storeLatitude: data.storeLatitude ?? data.store?.latitude,
          storeLongitude: data.storeLongitude ?? data.store?.longitude,
          storeOperatingHours: '06:00 - 23:00',
          isStoreOpen: true,
          layer1Passed: true,
          layer2Passed: true,
          layer3Passed: true,
          message: data.message || '✓ PocketKirana delivers to your location',
        };

        this.setState({
          serviceability,
          status: 'SERVICEABLE',
          isUnserviceableModalOpen: false,
          isExplanationOpen: false,
          error: null,
          isNetworkError: false,
        });

        return serviceability;
      } else {
        // Distinguish Store Closed from Outside Delivery Area
        const isStoreClosed = data.code === 'STORE_CLOSED';
        const newStatus: LocationFlowStatus = isStoreClosed ? 'STORE_CLOSED' : 'UNSERVICEABLE';

        let unserviceableReason = data.message || data.error || 'Outside Delivery Area';
        if (data.code === 'OUT_OF_SERVICE_AREA' || data.code === 'OUT_OF_RANGE') {
          unserviceableReason = `Outside Delivery Radius (${distance} KM vs max ${radius} KM radius)`;
        } else if (data.code === 'STORE_CLOSED') {
          unserviceableReason = `Store Closed (${storeName})`;
        } else if (data.code === 'STORE_INACTIVE') {
          unserviceableReason = `Store Offline (${storeName} delivery service currently paused)`;
        }

        const serviceability: ZoneServiceability = {
          isServiceable: false,
          zoneId: `ZONE_${storeId}`,
          zoneName: `${storeName} — Outside Delivery Zone`,
          distanceKm: distance,
          straightLineDistanceKm: distance,
          roadDistanceKm: distance,
          radiusKm: radius,
          maximumDistanceKm: radius,
          remainingKm: 0,
          estimatedDeliveryMinutes: 0,
          deliveryFee: 0,
          storeId,
          storeName,
          storeLatitude: data.storeLatitude ?? data.store?.latitude,
          storeLongitude: data.storeLongitude ?? data.store?.longitude,
          storeOperatingHours: '06:00 - 23:00',
          isStoreOpen: !isStoreClosed,
          layer1Passed: false,
          layer2Passed: false,
          layer3Passed: !isStoreClosed,
          message: unserviceableReason,
          unserviceableReason,
        };

        this.setState({
          serviceability,
          status: newStatus,
          isUnserviceableModalOpen: true,
          isExplanationOpen: false,
          error: null,
          isNetworkError: false,
        });

        return serviceability;
      }
    } catch (err: any) {
      console.warn('[LocationFlowService] Canonical serviceability API note:', err?.message || err);
      this.setState({
        status: 'SERVICEABILITY_NETWORK_ERROR',
        isNetworkError: true,
        error: "Couldn't check delivery availability. Please try again.",
      });
      return null;
    }
  }

  /**
   * User manually chooses a location from manual picker or saved addresses
   */
  public async setManualLocation(loc: SelectedLocationData): Promise<void> {
    this.setState({ isManualPickerOpen: false });
    await this.resolveAndSetCoords(loc.latitude, loc.longitude, true, true, loc);
  }

  /**
   * Retry serviceability check (e.g. after network failure)
   */
  public async retryServiceability(): Promise<void> {
    const loc = this.state.selectedLocation || DEFAULT_NERAL_LOCATION;
    this.setState({
      status: 'SERVICEABILITY_CHECKING',
      error: null,
      isNetworkError: false,
    });
    await this.resolveAndSetCoords(loc.latitude, loc.longitude, loc.isPrecise ?? true, loc.isManual, loc);
  }

  /**
   * UI Dialog Controls
   */
  public openExplanation(): void {
    this.setState({ isExplanationOpen: true });
  }

  public closeExplanation(): void {
    this.setState({ isExplanationOpen: false });
  }

  public openManualPicker(): void {
    this.setState({
      isManualPickerOpen: true,
      isExplanationOpen: false,
      isUnserviceableModalOpen: false,
    });
  }

  public closeManualPicker(): void {
    this.setState({ isManualPickerOpen: false });
  }

  public closeUnserviceableModal(): void {
    this.setState({
      isUnserviceableModalOpen: false,
      allowBrowsingUnserviceable: true,
    });
  }

  public continueBrowsing(): void {
    this.setState({
      isUnserviceableModalOpen: false,
      allowBrowsingUnserviceable: true,
    });
  }

  /**
   * Clears state on fresh install or manual reset
   */
  public reset(): void {
    this.initialized = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_LOCATION);
      localStorage.removeItem(STORAGE_KEY_ONBOARDED);
    }
    this.setState({
      status: 'LOCATION_UNKNOWN',
      selectedLocation: null,
      serviceability: null,
      error: null,
      isNetworkError: false,
      isExplanationOpen: false,
      isManualPickerOpen: false,
      isUnserviceableModalOpen: false,
      allowBrowsingUnserviceable: false,
    });
  }
}

export const locationFlowService = new LocationFlowService();
