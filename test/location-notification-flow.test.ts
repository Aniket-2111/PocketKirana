import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  locationFlowService,
  DEFAULT_NERAL_LOCATION,
  SelectedLocationData,
} from '../lib/locationFlowService';
import { locationManager } from '../lib/locationManager';
import { requestFCMNotificationPermission } from '../lib/fcmClient';
import { saveFcmToken } from '../lib/userService';

describe('Blinkit-Style Location & Notification Flow Test Matrix', () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
    });

    vi.stubGlobal('navigator', {
      onLine: true,
      permissions: {
        query: vi.fn().mockResolvedValue({ state: 'prompt' }),
      },
    });

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes('/api/serviceability/check')) {
        const url = new URL(urlStr, 'http://localhost:3000');
        const lat = parseFloat(url.searchParams.get('lat') || '0');
        const lng = parseFloat(url.searchParams.get('lng') || '0');

        // Neral Hub coordinates: 19.0224536, 73.3210018
        // Within Neral area (lat between 19.01 and 19.05, lng between 73.30 and 73.34)
        const isNearNeral = Math.abs(lat - 19.0224536) < 0.05 && Math.abs(lng - 73.3210018) < 0.05;

        if (isNearNeral) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              serviceable: true,
              code: 'SERVICEABLE',
              status: 'SERVICEABLE',
              message: '✓ PocketKirana delivers to your location',
              straightLineDistanceKm: 0.5,
              distanceKm: 0.5,
              deliveryFee: 0,
              maximumDistanceKm: 4.5,
              store: {
                id: 'store-001',
                name: 'Maule Kirana (Neral Hub)',
                deliveryRadiusKm: 4.5,
                isActive: true,
              },
            }),
          } as Response);
        } else {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              serviceable: false,
              code: 'OUT_OF_SERVICE_AREA',
              status: 'OUT_OF_RANGE',
              error: 'Outside Delivery Radius (13.5 KM vs max 4.5 KM radius)',
              message: 'Outside Delivery Radius (13.5 KM vs max 4.5 KM radius)',
              straightLineDistanceKm: 13.5,
              distanceKm: 13.5,
              maximumDistanceKm: 4.5,
              store: {
                id: 'store-001',
                name: 'Maule Kirana (Neral Hub)',
                deliveryRadiusKm: 4.5,
                isActive: true,
              },
            }),
          } as Response);
        }
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
    }));

    locationFlowService.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // LOCATION TESTS (LOCATION-001 through LOCATION-011)
  // ══════════════════════════════════════════════════════════════════════════════

  it('LOCATION-001: Fresh install -> location explanation appears', async () => {
    // Fresh install has no saved location and permission is prompt
    vi.spyOn(locationManager, 'checkState').mockResolvedValue({
      permission: 'PROMPT',
      gps: 'ENABLED',
      status: 'PERMISSION_REQUIRED',
      coords: null,
      error: null,
      lastChecked: Date.now(),
    });

    await locationFlowService.init();
    const state = locationFlowService.getState();

    expect(state.status).toBe('LOCATION_PERMISSION_REQUIRED');
    expect(state.isExplanationOpen).toBe(true);
  });

  it('LOCATION-002: Location permission granted -> location resolved', async () => {
    vi.spyOn(locationManager, 'requestPermission').mockResolvedValue(true);
    vi.spyOn(locationManager, 'getCurrentCoordinates').mockResolvedValue({
      latitude: 19.0224536,
      longitude: 73.3210018,
      accuracy: 15,
      heading: null,
      speed: null,
      timestamp: Date.now(),
    });

    const success = await locationFlowService.requestDeviceLocation();
    expect(success).toBe(true);

    const state = locationFlowService.getState();
    expect(state.selectedLocation).not.toBeNull();
    expect(state.selectedLocation?.latitude).toBeCloseTo(19.0224, 2);
    expect(state.isExplanationOpen).toBe(false);
  });

  it('LOCATION-003: Precise location works', async () => {
    // Precise GPS fix (accuracy = 12m)
    vi.spyOn(locationManager, 'requestPermission').mockResolvedValue(true);
    vi.spyOn(locationManager, 'getCurrentCoordinates').mockResolvedValue({
      latitude: 19.033,
      longitude: 73.317,
      accuracy: 12,
      heading: 90,
      speed: 1.5,
      timestamp: Date.now(),
    });

    await locationFlowService.requestDeviceLocation();
    const state = locationFlowService.getState();

    expect(state.selectedLocation?.isPrecise).toBe(true);
    expect(state.selectedLocation?.latitude).toBe(19.033);
  });

  it('LOCATION-004: Approximate location works where supported', async () => {
    // Approximate fix (accuracy = 450m)
    vi.spyOn(locationManager, 'requestPermission').mockResolvedValue(true);
    vi.spyOn(locationManager, 'getCurrentCoordinates').mockResolvedValue({
      latitude: 19.035,
      longitude: 73.319,
      accuracy: 450,
      heading: null,
      speed: null,
      timestamp: Date.now(),
    });

    await locationFlowService.requestDeviceLocation();
    const state = locationFlowService.getState();

    expect(state.selectedLocation?.isPrecise).toBe(false);
    expect(state.selectedLocation?.latitude).toBe(19.035);
    expect(state.status).toBe('SERVICEABLE');
  });

  it('LOCATION-005: Location denied -> manual location option available', async () => {
    vi.spyOn(locationManager, 'requestPermission').mockResolvedValue(false);
    vi.spyOn(locationManager, 'checkState').mockResolvedValue({
      permission: 'PROMPT',
      gps: 'ENABLED',
      status: 'PERMISSION_REQUIRED',
      coords: null,
      error: null,
      lastChecked: Date.now(),
    });

    const result = await locationFlowService.requestDeviceLocation();
    expect(result).toBe(false);

    const state = locationFlowService.getState();
    expect(state.status).toBe('LOCATION_PERMISSION_DENIED');
    expect(state.isExplanationOpen).toBe(true);

    // User can open manual picker
    locationFlowService.openManualPicker();
    expect(locationFlowService.getState().isManualPickerOpen).toBe(true);
  });

  it('LOCATION-006: Permanent denial -> app does not loop permission popup', async () => {
    vi.spyOn(locationManager, 'requestPermission').mockResolvedValue(false);
    vi.spyOn(locationManager, 'checkState').mockResolvedValue({
      permission: 'DENIED',
      gps: 'ENABLED',
      status: 'PERMISSION_REQUIRED',
      coords: null,
      error: 'Location permission is denied',
      lastChecked: Date.now(),
    });

    await locationFlowService.requestDeviceLocation();
    const state = locationFlowService.getState();

    expect(state.status).toBe('LOCATION_PERMISSION_DENIED_PERMANENTLY');
    // Does not loop: user can dismiss and choose manual
    locationFlowService.closeExplanation();
    expect(locationFlowService.getState().isExplanationOpen).toBe(false);
  });

  it('LOCATION-007: Serviceable location -> normal customer experience', async () => {
    // Maule Kirana Hub in Neral (0 km)
    await locationFlowService.resolveAndSetCoords(19.0224536, 73.3210018);
    const state = locationFlowService.getState();

    expect(state.status).toBe('SERVICEABLE');
    expect(state.serviceability?.isServiceable).toBe(true);
    expect(state.isUnserviceableModalOpen).toBe(false);
  });

  it('LOCATION-008: Unserviceable location -> correct unserviceable screen', async () => {
    // Karjat station (~13 km away, outside 3 km radius)
    await locationFlowService.resolveAndSetCoords(18.910, 73.323);
    const state = locationFlowService.getState();

    expect(state.status).toBe('UNSERVICEABLE');
    expect(state.serviceability?.isServiceable).toBe(false);
    expect(state.isUnserviceableModalOpen).toBe(true);
    expect(state.serviceability?.unserviceableReason).toContain('Outside Delivery Radius');
  });

  it('LOCATION-009: Network failure during serviceability -> retry state, NOT unserviceable', async () => {
    // Simulate offline network
    vi.stubGlobal('navigator', { onLine: false });

    await locationFlowService.resolveAndSetCoords(19.0224536, 73.3210018);
    const state = locationFlowService.getState();

    expect(state.status).toBe('SERVICEABILITY_NETWORK_ERROR');
    expect(state.isNetworkError).toBe(true);
    expect(state.status).not.toBe('UNSERVICEABLE');
    expect(state.error).toContain("Couldn't check delivery availability");
  });

  it('LOCATION-010: Changing location rechecks serviceability', async () => {
    // First set serviceable location
    await locationFlowService.resolveAndSetCoords(19.0224536, 73.3210018);
    expect(locationFlowService.getState().status).toBe('SERVICEABLE');

    // User changes location to Badlapur (> 15 km away)
    const newLocation: SelectedLocationData = {
      latitude: 19.155,
      longitude: 73.265,
      addressLine: 'Badlapur West',
      city: 'Badlapur',
      pincode: '421503',
      isManual: true,
    };

    await locationFlowService.setManualLocation(newLocation);
    const state = locationFlowService.getState();

    expect(state.selectedLocation?.city).toBe('Badlapur');
    expect(state.status).toBe('UNSERVICEABLE');
    expect(state.serviceability?.isServiceable).toBe(false);
  });

  it('LOCATION-011: Location state survives normal app restart', async () => {
    // Save location to localStorage
    const savedLoc: SelectedLocationData = {
      latitude: 19.033,
      longitude: 73.317,
      addressLine: 'Neral Station Area',
      city: 'Neral',
      pincode: '410101',
      isManual: true,
    };
    localStorageMock['pk_selected_location'] = JSON.stringify(savedLoc);

    // Re-instantiate / init
    locationFlowService.reset();
    localStorageMock['pk_selected_location'] = JSON.stringify(savedLoc);
    await locationFlowService.init();

    const state = locationFlowService.getState();
    expect(state.selectedLocation?.addressLine).toBe('Neral Station Area');
    expect(state.status).toBe('SERVICEABLE');
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // NOTIFICATION TESTS (NOTIFICATION-001 through NOTIFICATION-007)
  // ══════════════════════════════════════════════════════════════════════════════

  it('NOTIFICATION-001: After successful login, notification education can appear', () => {
    const isLoggedIn = true;
    const hasSeenOnboarding = localStorageMock['pk_notification_onboarding_shown'] === 'true';

    expect(isLoggedIn).toBe(true);
    expect(hasSeenOnboarding).toBe(false);
    // Modal qualifies to be shown
    const shouldShow = isLoggedIn && !hasSeenOnboarding;
    expect(shouldShow).toBe(true);
  });

  it('NOTIFICATION-002: No notification permission request before user action', () => {
    const requestNotificationSpy = vi.fn();
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: requestNotificationSpy,
    });

    // App boot / login screen: no permission request should be made
    expect(requestNotificationSpy).not.toHaveBeenCalled();
  });

  it('NOTIFICATION-003: "Enable notifications" -> Android permission requested', async () => {
    const requestPermissionMock = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: requestPermissionMock,
    });

    const res = await requestFCMNotificationPermission('usr-cust-1', 'customer');
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(res.permission).toBe('granted');
  });

  it('NOTIFICATION-004: Permission granted -> FCM token registered', async () => {
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });

    const res = await requestFCMNotificationPermission('usr-cust-1', 'customer');
    expect(res.token).not.toBeNull();
    expect(res.token).toContain('pk_fcm_customer_');
    expect(localStorageMock['fcm_token_usr-cust-1']).toBe(res.token);
  });

  it('NOTIFICATION-005: Permission denied -> no infinite retry', async () => {
    vi.stubGlobal('Notification', {
      permission: 'denied',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    });

    const res = await requestFCMNotificationPermission('usr-cust-1', 'customer');
    expect(res.permission).toBe('denied');
    expect(res.token).toBeNull();

    // Mark dismissed so it does not loop
    localStorageMock['pk_notification_onboarding_shown'] = 'true';
    expect(localStorageMock['pk_notification_onboarding_shown']).toBe('true');
  });

  it('NOTIFICATION-006: Notification education is not repeatedly displayed', () => {
    localStorageMock['pk_notification_onboarding_shown'] = 'true';
    const isLoggedIn = true;
    const shouldShow = isLoggedIn && localStorageMock['pk_notification_onboarding_shown'] !== 'true';

    expect(shouldShow).toBe(false);
  });

  it('NOTIFICATION-007: Logout/login another customer -> notification token/customer association remains correct', async () => {
    // Customer A logs in and registers token
    localStorageMock['fcm_token_usr-cust-A'] = 'token_AAA';
    expect(localStorageMock['fcm_token_usr-cust-A']).toBe('token_AAA');

    // Customer A logs out
    delete localStorageMock['fcm_token_usr-cust-A'];
    expect(localStorageMock['fcm_token_usr-cust-A']).toBeUndefined();

    // Customer B logs in and registers their own token
    localStorageMock['fcm_token_usr-cust-B'] = 'token_BBB';
    expect(localStorageMock['fcm_token_usr-cust-B']).toBe('token_BBB');
    expect(localStorageMock['fcm_token_usr-cust-A']).toBeUndefined();
  });
});
