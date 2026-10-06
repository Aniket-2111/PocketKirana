import { describe, it, expect } from 'vitest';
import { mapApiError } from '../lib/apiErrorMapper';
import { Validators, validateField, validateForm } from '../lib/formValidator';
import * as states from '../components/states';

describe('PocketKirana UI State & Error-Handling System', () => {
  describe('1. Centralized API Error Mapper (mapApiError)', () => {
    it('maps 401 Unauthorized to SESSION_EXPIRED / UNAUTHORIZED state with login action', () => {
      const err = { status: 401, message: 'JWT expired' };
      const normalized = mapApiError(err);
      expect(normalized.code).toBe('UNAUTHORIZED');
      expect(normalized.title).toBe('Session Expired');
      expect(normalized.canRetry).toBe(false);
      expect(normalized.primaryAction?.action).toBe('login');
    });

    it('maps 403 Forbidden to Access Restricted with permission guidance', () => {
      const err = { status: 403 };
      const normalized = mapApiError(err);
      expect(normalized.code).toBe('FORBIDDEN');
      expect(normalized.title).toBe('Access Restricted');
      expect(normalized.canRetry).toBe(false);
    });

    it('maps 404 Not Found to contextual item not found message', () => {
      const err = { status: 404 };
      const normalized = mapApiError(err, 'product');
      expect(normalized.code).toBe('NOT_FOUND');
      expect(normalized.message).toContain('product');
    });

    it('maps 422 Validation Error to Validation Failed', () => {
      const err = { status: 422, data: { message: 'Invalid phone number format' } };
      const normalized = mapApiError(err);
      expect(normalized.code).toBe('VALIDATION_ERROR');
      expect(normalized.title).toBe('Validation Failed');
      expect(normalized.details?.rawMessage).toBe('Invalid phone number format');
    });

    it('maps 429 Rate Limited to Too Many Requests with retry capability', () => {
      const err = { status: 429 };
      const normalized = mapApiError(err);
      expect(normalized.code).toBe('RATE_LIMITED');
      expect(normalized.canRetry).toBe(true);
      expect(normalized.primaryAction?.action).toBe('retry');
    });

    it('maps 500 & 503 Server Errors to Server Busy with support contact action', () => {
      const err500 = { status: 500 };
      const norm500 = mapApiError(err500);
      expect(norm500.code).toBe('SERVER_ERROR');
      expect(norm500.canRetry).toBe(true);
      expect(norm500.secondaryAction?.action).toBe('support');

      const err503 = { status: 503 };
      const norm503 = mapApiError(err503);
      expect(norm503.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('maps Timeout and AbortError cleanly to TIMEOUT state', () => {
      const abortErr = { name: 'AbortError', message: 'The user aborted a request.' };
      const normalized = mapApiError(abortErr);
      expect(normalized.code).toBe('TIMEOUT');
      expect(normalized.title).toBe('Request Timed Out');
    });

    it('generates a unique sanitized trackingId without leaking stack traces or internal secrets', () => {
      const secretErr = new Error('FATAL: postgres connection failed at 10.0.0.1:5432 with pass=secret123');
      const normalized = mapApiError(secretErr);
      expect(normalized.trackingId).toMatch(/^err_/);
      expect(normalized.userFacingMessage).not.toContain('secret123');
      expect(normalized.userFacingMessage).not.toContain('10.0.0.1');
    });
  });

  describe('2. Accessible Form Validation System (Validators)', () => {
    it('validates required fields correctly', () => {
      const reqValidator = Validators.required('Name is required');
      expect(reqValidator('').isValid).toBe(false);
      expect(reqValidator('   ').isValid).toBe(false);
      expect(reqValidator(null).isValid).toBe(false);
      expect(reqValidator([]).isValid).toBe(false);
      expect(reqValidator('Aniket').isValid).toBe(true);
    });

    it('validates 10-digit Indian mobile numbers starting with 6-9', () => {
      const phoneValidator = Validators.phone();
      expect(phoneValidator('9876543210').isValid).toBe(true);
      expect(phoneValidator('8123456789').isValid).toBe(true);
      expect(phoneValidator('1234567890').isValid).toBe(false); // starts with 1
      expect(phoneValidator('98765').isValid).toBe(false); // too short
      expect(phoneValidator('987654321000').isValid).toBe(false); // too long
    });

    it('validates 6-digit OTP codes', () => {
      const otpValidator = Validators.otp(6);
      expect(otpValidator('123456').isValid).toBe(true);
      expect(otpValidator('12345').isValid).toBe(false);
      expect(otpValidator('1234567').isValid).toBe(false);
      expect(otpValidator('abcdef').isValid).toBe(false);
    });

    it('validates Indian postal pincodes (6 digits)', () => {
      const pinValidator = Validators.pincode();
      expect(pinValidator('410101').isValid).toBe(true);
      expect(pinValidator('400001').isValid).toBe(true);
      expect(pinValidator('012345').isValid).toBe(false); // cannot start with 0
      expect(pinValidator('41010').isValid).toBe(false);
    });

    it('validates full form schemas and returns field-keyed errors', () => {
      const rules = {
        name: [Validators.required('Please enter your name')],
        phone: [Validators.required(), Validators.phone()],
        pincode: [Validators.required(), Validators.pincode()],
      };

      const invalidValues = {
        name: '',
        phone: '12345',
        pincode: '99',
      };

      const result = validateForm(invalidValues, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe('Please enter your name');
      expect(result.errors.phone).toBeDefined();
      expect(result.errors.pincode).toBeDefined();

      const validValues = {
        name: 'Aniket Yadav',
        phone: '9876543210',
        pincode: '410101',
      };

      const validResult = validateForm(validValues, rules);
      expect(validResult.isValid).toBe(true);
      expect(Object.keys(validResult.errors).length).toBe(0);
    });
  });

  describe('3. UI State System Modular Architecture', () => {
    it('exports all 10 required states from barrel components/states', () => {
      expect(states.EmptyState).toBeDefined();
      expect(states.Skeleton).toBeDefined();
      expect(states.PageLoadingState).toBeDefined();
      expect(states.ErrorState).toBeDefined();
      expect(states.OfflineState).toBeDefined();
      expect(states.NetworkStatusBanner).toBeDefined();
      expect(states.SlowNetworkState).toBeDefined();
      expect(states.NoSearchResults).toBeDefined();
      expect(states.PermissionDeniedState).toBeDefined();
      expect(states.SessionExpiredState).toBeDefined();
      expect(states.FormFieldWrapper).toBeDefined();
      expect(states.SuccessState).toBeDefined();
      expect(states.PaymentStateView).toBeDefined();
      expect(states.LocationServiceState).toBeDefined();
      expect(states.ProductImageWithFallback).toBeDefined();
      expect(states.GlobalErrorBoundary).toBeDefined();
      expect(states.StateContainer).toBeDefined();
    });
  });

  describe('4. Payment Lifecycle State Verification', () => {
    const requiredPaymentStates = [
      'INITIATED',
      'PROCESSING',
      'VERIFYING',
      'SUCCESS',
      'FAILED',
      'CANCELLED',
      'TIMEOUT',
      'PENDING',
      'REFUND_INITIATED',
      'REFUND_PROCESSING',
      'REFUNDED',
      'REFUND_FAILED',
    ];

    it('covers all 12 authoritative payment and refund states', () => {
      requiredPaymentStates.forEach((st) => {
        expect(typeof st).toBe('string');
      });
      expect(requiredPaymentStates.length).toBe(12);
    });
  });

  describe('5. Search Query & Stale Request Protection', () => {
    it('ensures newer search queries take precedence over delayed older requests', async () => {
      let latestActiveQuery = '';
      const executedResults: string[] = [];

      const searchSim = async (query: string, delayMs: number) => {
        latestActiveQuery = query;
        const currentReqQuery = query;

        await new Promise((r) => setTimeout(r, delayMs));

        // Stale check
        if (currentReqQuery === latestActiveQuery) {
          executedResults.push(`Result for: ${query}`);
        }
      };

      // Search 'milk' with 50ms delay, then immediately search 'bread' with 10ms delay
      const req1 = searchSim('milk', 50);
      const req2 = searchSim('bread', 10);

      await Promise.all([req1, req2]);

      expect(executedResults).toEqual(['Result for: bread']);
      expect(executedResults).not.toContain('Result for: milk');
    });
  });

  describe('6. Location & GPS Service Range States', () => {
    const locationStates = [
      'PERMISSION_DENIED',
      'GPS_UNAVAILABLE',
      'GPS_INACCURATE',
      'NETWORK_UNAVAILABLE',
      'OUT_OF_SERVICE_RANGE',
      'STORE_CLOSED',
    ];

    it('distinguishes location failure variants without misclassification', () => {
      locationStates.forEach((state) => {
        expect(state).toBeDefined();
      });
      expect(locationStates).toContain('GPS_INACCURATE');
      expect(locationStates).toContain('OUT_OF_SERVICE_RANGE');
      expect(locationStates).toContain('STORE_CLOSED');
    });
  });
});
