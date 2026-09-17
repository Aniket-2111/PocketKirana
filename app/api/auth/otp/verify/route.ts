import { NextRequest } from 'next/server';
import { POST as verifyPost } from '../../verify-otp-token/route';

/**
 * POST /api/auth/otp/verify
 * Standard authentication endpoint alias for verifying MSG91 OTP access token.
 */
export async function POST(request: NextRequest) {
  return verifyPost(request);
}
