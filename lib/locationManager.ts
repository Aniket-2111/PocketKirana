/**
 * PocketKirana Central Location Manager
 *
 * Production-ready centralized Location Management Architecture for
 * Web, Customer Mobile App (Capacitor Android), and Delivery Partner App.
 *
 * Handles:
 * - Permission state (GRANTED, DENIED, PERMANENTLY_DENIED, PROMPT)
 * - Device GPS hardware state (ENABLED, DISABLED, CHECKING)
 * - Automatic app resume / visibility change detection
 * - Native Android Location Settings intent launching
 * - High-accuracy coordinate resolution with fallback
 * - Background/Foreground live tracking for delivery partners
 * - Non-blocking reactive subscriptions
 */

import { Geolocation, Position, PermissionStatus } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export type LocationPermissionState = 'GRANTED' | 'DENIED' | 'PERMANENTLY_DENIED' | 'PROMPT';
export type GpsHardwareState = 'ENABLED' | 'DISABLED' | 'CHECKING';
export type LocationStatus = 'IDLE' | 'CHECKING' | 'READY' | 'GPS_DISABLED' | 'PERMISSION_REQUIRED' | 'ERROR';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface LocationManagerState {
  permission: LocationPermissionState;
  gps: GpsHardwareState;
  status: LocationStatus;
  coords: LocationCoordinates | null;
  error: string | null;
  lastChecked: number;
}

type LocationListener = (state: LocationManagerState) => void;

class CentralLocationManager {
  private state: LocationManagerState = {
    permission: 'PROMPT',
    gps: 'CHECKING',
    status: 'IDLE',
    coords: null,
    error: null,
    lastChecked: 0,
  };

  private listeners = new Set<LocationListener>();
  private watchId: string | number | null = null;
  private activeLiveTrackingCallback: ((coords: LocationCoordinates) => void) | null = null;
  private isChecking = false;
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initLifecycleListeners();
    }
  }

  /**
   * Initializes automatic App Resume and Visibility Change triggers
   */
  public initLifecycleListeners(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Web standard visibility and focus handlers
    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        this.checkState({ forceFresh: true });
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', () => this.checkState({ forceFresh: true }));
    window.addEventListener('pageshow', () => this.checkState({ forceFresh: true }));

    // 2. Capacitor native App lifecycle state change
    try {
      if ((window as any).Capacitor?.Plugins?.App) {
        (window as any).Capacitor.Plugins.App.addListener('appStateChange', (appState: { isActive: boolean }) => {
          if (appState.isActive) {
            this.checkState({ forceFresh: true });
          }
        });
        (window as any).Capacitor.Plugins.App.addListener('resume', () => {
          this.checkState({ forceFresh: true });
        });
      }
    } catch (_) {}

    // Initial check
    setTimeout(() => {
      this.checkState();
    }, 500);
  }

  /**
   * Subscribe to reactive location state changes
   */
  public subscribe(listener: LocationListener): () => void {
    this.listeners.add(listener);
    // Immediately notify current state
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): LocationManagerState {
    return { ...this.state };
  }

  private setState(partial: Partial<LocationManagerState>): void {
    this.state = {
      ...this.state,
      ...partial,
      lastChecked: Date.now(),
    };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const current = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (e) {
        console.error('Location listener error:', e);
      }
    });
  }

  /**
   * Checks current permission & GPS state across platforms
   */
  public async checkState(options?: { forceFresh?: boolean }): Promise<LocationManagerState> {
    if (typeof window === 'undefined') return this.state;
    if (this.isChecking && !options?.forceFresh) return this.state;

    this.isChecking = true;
    this.setState({ status: 'CHECKING' });

    try {
      let permissionState: LocationPermissionState = 'PROMPT';

      // Step 1: Check permission via Capacitor or Permissions API
      if (Capacitor.isNativePlatform()) {
        try {
          const perm: PermissionStatus = await Geolocation.checkPermissions();
          if (perm.location === 'granted') {
            permissionState = 'GRANTED';
          } else if (perm.location === 'denied') {
            permissionState = 'DENIED';
          } else {
            permissionState = 'PROMPT';
          }
        } catch (_) {
          permissionState = 'PROMPT';
        }
      } else if ('permissions' in navigator && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (result.state === 'granted') permissionState = 'GRANTED';
          else if (result.state === 'denied') permissionState = 'DENIED';
          else permissionState = 'PROMPT';
        } catch (_) {
          permissionState = 'PROMPT';
        }
      }

      if (permissionState !== 'GRANTED') {
        this.setState({
          permission: permissionState,
          status: 'PERMISSION_REQUIRED',
          error: permissionState === 'DENIED' ? 'Location permission is denied' : null,
        });
        this.isChecking = false;
        return this.state;
      }

      // Step 2: Test GPS hardware availability
      try {
        const coords = await this.probeCoordinates();
        this.setState({
          permission: 'GRANTED',
          gps: 'ENABLED',
          status: 'READY',
          coords,
          error: null,
        });

        // Resume live tracking if delivery partner had it active
        if (this.activeLiveTrackingCallback && !this.watchId) {
          this.startLiveTracking(this.activeLiveTrackingCallback);
        }
      } catch (gpsError: any) {
        // GeolocationPositionError 2 is POSITION_UNAVAILABLE (GPS Hardware switched OFF)
        const isGpsOff =
          gpsError?.code === 2 ||
          gpsError?.message?.toLowerCase().includes('position unavailable') ||
          gpsError?.message?.toLowerCase().includes('location is disabled') ||
          gpsError?.message?.toLowerCase().includes('disabled');

        if (isGpsOff) {
          this.setState({
            permission: 'GRANTED',
            gps: 'DISABLED',
            status: 'GPS_DISABLED',
            error: 'Device Location / GPS is turned off',
          });
        } else {
          this.setState({
            permission: 'GRANTED',
            gps: 'ENABLED',
            status: 'READY',
            error: null,
          });
        }
      }
    } catch (e: any) {
      this.setState({
        status: 'ERROR',
        error: e?.message || 'Unknown location check error',
      });
    } finally {
      this.isChecking = false;
    }

    return this.state;
  }

  /**
   * Fast probe to verify if GPS hardware produces a fix
   */
  private async probeCoordinates(): Promise<LocationCoordinates> {
    if (Capacitor.isNativePlatform()) {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 15000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading ?? null,
        speed: pos.coords.speed ?? null,
        timestamp: pos.timestamp,
      };
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
            timestamp: pos.timestamp,
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 }
      );
    });
  }

  /**
   * Prompts native Android OS location permission dialog
   */
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return true;

    try {
      if (Capacitor.isNativePlatform()) {
        const req = await Geolocation.requestPermissions({ permissions: ['location'] });
        const granted = req.location === 'granted';
        await this.checkState({ forceFresh: true });
        return granted;
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            this.checkState({ forceFresh: true });
            resolve(true);
          },
          () => {
            this.checkState({ forceFresh: true });
            resolve(false);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    } catch (err) {
      console.warn('LocationManager requestPermission error:', err);
      await this.checkState({ forceFresh: true });
      return false;
    }
  }

  /**
   * Retrieves high accuracy device coordinates
   */
  public async getCurrentCoordinates(options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
  }): Promise<LocationCoordinates> {
    const timeout = options?.timeout ?? 12000;
    const enableHighAccuracy = options?.enableHighAccuracy ?? true;

    if (Capacitor.isNativePlatform()) {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy,
          timeout,
          maximumAge: 5000,
        });
        const coords: LocationCoordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading ?? null,
          speed: pos.coords.speed ?? null,
          timestamp: pos.timestamp,
        };
        this.setState({ coords, gps: 'ENABLED', status: 'READY', permission: 'GRANTED' });
        return coords;
      } catch (err) {
        // Fallback to standard accuracy if high accuracy timed out
        const fallback = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 30000,
        });
        const coords: LocationCoordinates = {
          latitude: fallback.coords.latitude,
          longitude: fallback.coords.longitude,
          accuracy: fallback.coords.accuracy,
          heading: fallback.coords.heading ?? null,
          speed: fallback.coords.speed ?? null,
          timestamp: fallback.timestamp,
        };
        this.setState({ coords, gps: 'ENABLED', status: 'READY', permission: 'GRANTED' });
        return coords;
      }
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: LocationCoordinates = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
            timestamp: pos.timestamp,
          };
          this.setState({ coords, gps: 'ENABLED', status: 'READY', permission: 'GRANTED' });
          resolve(coords);
        },
        (err) => {
          // Retry with low accuracy
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              const coords: LocationCoordinates = {
                latitude: pos2.coords.latitude,
                longitude: pos2.coords.longitude,
                accuracy: pos2.coords.accuracy,
                heading: pos2.coords.heading ?? null,
                speed: pos2.coords.speed ?? null,
                timestamp: pos2.timestamp,
              };
              this.setState({ coords, gps: 'ENABLED', status: 'READY', permission: 'GRANTED' });
              resolve(coords);
            },
            (err2) => {
              reject(err2);
            },
            { enableHighAccuracy: false, timeout: 8000 }
          );
        },
        { enableHighAccuracy, timeout, maximumAge: 5000 }
      );
    });
  }

  /**
   * Starts live continuous GPS tracking for delivery partners
   */
  public async startLiveTracking(callback: (coords: LocationCoordinates) => void): Promise<void> {
    this.stopLiveTracking();
    this.activeLiveTrackingCallback = callback;

    if (Capacitor.isNativePlatform()) {
      try {
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
          (position: Position | null, err) => {
            if (err) {
              console.warn('Watch position error:', err);
              if (err.message?.includes('disabled')) {
                this.setState({ gps: 'DISABLED', status: 'GPS_DISABLED' });
              }
              return;
            }
            if (position?.coords) {
              const coords: LocationCoordinates = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading ?? null,
                speed: position.coords.speed ?? null,
                timestamp: position.timestamp,
              };
              this.setState({ coords, gps: 'ENABLED', status: 'READY' });
              callback(coords);
            }
          }
        );
        this.watchId = id;
        return;
      } catch (e) {
        console.warn('Capacitor watchPosition failed, falling back to web watcher:', e);
      }
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords: LocationCoordinates = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
            timestamp: pos.timestamp,
          };
          this.setState({ coords, gps: 'ENABLED', status: 'READY' });
          callback(coords);
        },
        (err) => {
          if (err.code === 2) {
            this.setState({ gps: 'DISABLED', status: 'GPS_DISABLED' });
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
    }
  }

  /**
   * Stops live continuous GPS tracking
   */
  public stopLiveTracking(): void {
    if (this.watchId !== null) {
      if (typeof this.watchId === 'string' && Capacitor.isNativePlatform()) {
        Geolocation.clearWatch({ id: this.watchId });
      } else if (typeof this.watchId === 'number' && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(this.watchId);
      }
      this.watchId = null;
    }
    this.activeLiveTrackingCallback = null;
  }

  /**
   * Opens native Android Location Settings screen
   */
  public openLocationSettings(): void {
    // 1. Direct custom native scheme handled in MainActivity.java
    try {
      window.location.href = 'pocketkirana://location-settings';
      return;
    } catch (_) {}

    // 2. Capacitor NativeSettings plugin fallback if present
    try {
      if ((window as any).Capacitor?.Plugins?.NativeSettings?.openAndroid) {
        (window as any).Capacitor.Plugins.NativeSettings.openAndroid({
          option: 'location',
        });
        return;
      }
    } catch (_) {}
  }

  /**
   * Opens native Android Application Details / Permission Settings screen
   */
  public openAppSettings(): void {
    try {
      window.location.href = 'pocketkirana://app-settings';
      return;
    } catch (_) {}

    try {
      if ((window as any).Capacitor?.Plugins?.NativeSettings?.openAndroid) {
        (window as any).Capacitor.Plugins.NativeSettings.openAndroid({
          option: 'application_details',
        });
        return;
      }
    } catch (_) {}
  }
}

export const locationManager = new CentralLocationManager();
export default locationManager;
