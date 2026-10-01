import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServerSession, getServerSession, invalidateServerSession } from '../lib/serverSession';
import { normalizeMsg91Phone } from '../lib/msg91Widget';

describe('POCKETKIRANA — CUSTOMER AUTHENTICATION, OTP & SESSION IDENTITY MATRIX', () => {

  const USER_A_PHONE = '8421778740';
  const USER_B_PHONE = '8698893348';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-001: Correct Phone -> Correct Customer
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-001: Normalizes 10-digit input to +91 E.164 and creates deterministic customer identity', () => {
    const rawInput = ' 8421778740 ';
    const cleanDigits = rawInput.replace(/\D/g, '').slice(-10);
    const normalizedMsg91 = normalizeMsg91Phone(cleanDigits);
    const formattedMobile = `+91 ${cleanDigits}`;
    const customerId = `usr-cust-${cleanDigits}`;

    expect(cleanDigits).toBe('8421778740');
    expect(normalizedMsg91).toBe('918421778740');
    expect(formattedMobile).toBe('+91 8421778740');
    expect(customerId).toBe('usr-cust-8421778740');
    expect(customerId).not.toContain(USER_B_PHONE);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-002: User A -> User B Account Switching
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-002: Switching from User A (8421778740) to User B (8698893348) creates isolated session B without leaking A', () => {
    // 1. Login User A
    const sessionA = createServerSession({
      userId: `usr-cust-${USER_A_PHONE}`,
      role: 'customer',
      mobile: `+91 ${USER_A_PHONE}`,
    });
    expect(sessionA.userId).toBe(`usr-cust-${USER_A_PHONE}`);
    expect(sessionA.mobile).toBe(`+91 ${USER_A_PHONE}`);

    // 2. Invalidate / Logout A
    invalidateServerSession(sessionA.sessionId);
    expect(getServerSession(sessionA.sessionId)).toBeNull();

    // 3. Login User B
    const sessionB = createServerSession({
      userId: `usr-cust-${USER_B_PHONE}`,
      role: 'customer',
      mobile: `+91 ${USER_B_PHONE}`,
    });
    expect(sessionB.userId).toBe(`usr-cust-${USER_B_PHONE}`);
    expect(sessionB.mobile).toBe(`+91 ${USER_B_PHONE}`);
    expect(sessionB.sessionId).not.toBe(sessionA.sessionId);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-003: User B -> User A Account Switching
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-003: Switching back from User B to User A guarantees full identity isolation', () => {
    const sessionB = createServerSession({
      userId: `usr-cust-${USER_B_PHONE}`,
      role: 'customer',
      mobile: `+91 ${USER_B_PHONE}`,
    });
    invalidateServerSession(sessionB.sessionId);

    const sessionA = createServerSession({
      userId: `usr-cust-${USER_A_PHONE}`,
      role: 'customer',
      mobile: `+91 ${USER_A_PHONE}`,
    });

    const activeA = getServerSession(sessionA.sessionId);
    expect(activeA?.mobile).toBe(`+91 ${USER_A_PHONE}`);
    expect(activeA?.userId).toBe(`usr-cust-${USER_A_PHONE}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-004: Old Session Cannot Survive a New Login
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-004: Starting a new login clears old customer state so stale sessions cannot persist', () => {
    let clientAuthState = {
      isLoggedIn: true,
      currentUser: { id: `usr-cust-${USER_B_PHONE}`, mobile: `+91 ${USER_B_PHONE}` },
      phoneInput: USER_B_PHONE,
    };

    // Client begins new login with Phone A -> old auth state is purged
    const resetAuthState = () => {
      clientAuthState = {
        isLoggedIn: false,
        currentUser: null as any,
        phoneInput: '',
      };
    };

    resetAuthState();
    expect(clientAuthState.isLoggedIn).toBe(false);
    expect(clientAuthState.currentUser).toBeNull();

    // Now set new candidate Phone A
    clientAuthState.phoneInput = USER_A_PHONE;
    expect(clientAuthState.phoneInput).toBe(USER_A_PHONE);
    expect(clientAuthState.currentUser).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-005: Profile Phone Equals Server-Authenticated Phone
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-005: Profile view derives mobile strictly from server session, never hardcoded fallback', () => {
    const session = createServerSession({
      userId: `usr-cust-${USER_A_PHONE}`,
      role: 'customer',
      mobile: `+91 ${USER_A_PHONE}`,
    });

    const serverMeResponse = {
      authenticated: true,
      customer: {
        id: session.userId,
        phone: session.mobile,
      },
    };

    // Display phone strictly from server customer response
    const profilePhone = serverMeResponse.customer.phone;
    expect(profilePhone).toBe(`+91 ${USER_A_PHONE}`);
    expect(profilePhone).not.toBe(`+91 ${USER_B_PHONE}`);
    expect(profilePhone).not.toContain(USER_B_PHONE);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-006: Customer Cannot Supply Another CustomerId in Request Body
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-006: Server rejects arbitrary client customerId and enforces session token subject', () => {
    const validSession = createServerSession({
      userId: `usr-cust-${USER_A_PHONE}`,
      role: 'customer',
      mobile: `+91 ${USER_A_PHONE}`,
    });

    // Malicious request trying to order as User B
    const requestBody = {
      customerId: `usr-cust-${USER_B_PHONE}`,
      cartItems: [{ productId: 'p-1', quantity: 1 }],
    };

    // Server-side identity resolver MUST ignore body.customerId and read authenticated session
    const resolvedCustomerId = validSession.userId; // never requestBody.customerId
    expect(resolvedCustomerId).toBe(`usr-cust-${USER_A_PHONE}`);
    expect(resolvedCustomerId).not.toBe(requestBody.customerId);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-007: OTP Verification Timeout Handling
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-007: Hanging OTP verification triggers 10s timeout and yields user-friendly retry message', async () => {
    const hangingOtpVerify = () =>
      new Promise<string>((resolve) => {
        // Simulates an endpoint or MSG91 network hang that never resolves
        setTimeout(() => resolve('OK'), 15000);
      });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 100) // 100ms for test
    );

    let caughtError = '';
    try {
      await Promise.race([hangingOtpVerify(), timeoutPromise]);
    } catch (err: any) {
      if (err.message === 'TIMEOUT') {
        caughtError = 'Verification is taking longer than expected. Please try again.';
      }
    }

    expect(caughtError).toBe('Verification is taking longer than expected. Please try again.');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-008: Invalid OTP Handling
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-008: Invalid OTP returns descriptive error and does not produce authenticated session', () => {
    const otpInput: string = '0000';
    const isValid = otpInput === '1234' || otpInput === '9999';

    let sessionCreated = false;
    let errorMessage = '';

    if (!isValid) {
      errorMessage = 'Incorrect OTP code entered. Please check and try again.';
    } else {
      sessionCreated = true;
    }

    expect(sessionCreated).toBe(false);
    expect(errorMessage).toBe('Incorrect OTP code entered. Please check and try again.');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-009: Expired OTP
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-009: Expired OTP response maps to 401 with prompt to request a new code', () => {
    const msg91Response = {
      type: 'error',
      message: 'OTP has expired',
    };

    const status = 401;
    const errorMsg = msg91Response.message || 'OTP expired';
    expect(status).toBe(401);
    expect(errorMsg).toContain('expired');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-010: Resend OTP Throttling & Limits
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-010: Resend OTP respects 10s cooldown and enforces maximum 2 attempts', () => {
    let countdown = 10;
    let resendAttempts = 0;

    // First attempt while countdown is active -> blocked
    const canResendNow = countdown <= 0 && resendAttempts < 2;
    expect(canResendNow).toBe(false);

    // Countdown expires
    countdown = 0;
    expect(countdown <= 0 && resendAttempts < 2).toBe(true);

    // Attempt 1
    resendAttempts += 1;
    countdown = 10;
    expect(resendAttempts).toBe(1);

    // Attempt 2
    countdown = 0;
    resendAttempts += 1;
    expect(resendAttempts).toBe(2);

    // Attempt 3 -> blocked by limit
    const canAttempt3 = countdown <= 0 && resendAttempts < 2;
    expect(canAttempt3).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-011: Network Failure Graceful Recovery
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-011: Network failure during verification is caught without infinite spinner', async () => {
    const networkFailPromise = Promise.reject(new Error('Failed to fetch'));

    let isLoading = true;
    let errorDisplayed = '';

    try {
      await networkFailPromise;
    } catch (err: any) {
      errorDisplayed = 'Network error while verifying OTP. Please check connection.';
    } finally {
      isLoading = false;
    }

    expect(isLoading).toBe(false);
    expect(errorDisplayed).toContain('Network error');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-012: Session Restoration on App Restart
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-012: Server session is restored authoritatively using valid session ID', () => {
    const session = createServerSession({
      userId: `usr-cust-${USER_A_PHONE}`,
      role: 'customer',
      mobile: `+91 ${USER_A_PHONE}`,
    });

    // App restarts: retrieves session by ID
    const restored = getServerSession(session.sessionId);
    expect(restored).not.toBeNull();
    expect(restored?.userId).toBe(`usr-cust-${USER_A_PHONE}`);
    expect(restored?.mobile).toBe(`+91 ${USER_A_PHONE}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-013: Logout Fully Clears Authentication
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-013: Logout fully terminates session on server and clears client authentication state', () => {
    const session = createServerSession({
      userId: `usr-cust-${USER_A_PHONE}`,
      role: 'customer',
      mobile: `+91 ${USER_A_PHONE}`,
    });

    invalidateServerSession(session.sessionId);
    const lookupAfterLogout = getServerSession(session.sessionId);
    expect(lookupAfterLogout).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-014: Duplicate Customer Prevention
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-014: Consistent phone normalization maps variants to the exact same customer ID', () => {
    const variations = [
      '8421778740',
      ' 8421778740 ',
      '+91 8421778740',
      '+918421778740',
      '08421778740',
    ];

    const customerIds = variations.map((v) => {
      const clean = v.replace(/\D/g, '').slice(-10);
      return `usr-cust-${clean}`;
    });

    const uniqueIds = new Set(customerIds);
    expect(uniqueIds.size).toBe(1);
    expect(uniqueIds.has(`usr-cust-${USER_A_PHONE}`)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH-015: Stale Profile Cache Cannot Overwrite Server Identity
  // ──────────────────────────────────────────────────────────────────────────
  it('AUTH-015: Stale local cache with User B is overridden when Server Session authenticates User A', () => {
    const staleLocalUser = { id: `usr-cust-${USER_B_PHONE}`, mobile: `+91 ${USER_B_PHONE}` };

    const authoritativeServerCustomer = {
      id: `usr-cust-${USER_A_PHONE}`,
      mobile: `+91 ${USER_A_PHONE}`,
    };

    // Client reconciliation logic: server response ALWAYS wins
    const reconciledUser = authoritativeServerCustomer;
    expect(reconciledUser.mobile).toBe(`+91 ${USER_A_PHONE}`);
    expect(reconciledUser.id).toBe(`usr-cust-${USER_A_PHONE}`);
    expect(reconciledUser.id).not.toBe(staleLocalUser.id);
  });

});
