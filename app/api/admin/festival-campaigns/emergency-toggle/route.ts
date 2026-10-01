import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';

let emergencyDisabled = false;

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  return NextResponse.json({
    emergencyDisabled,
    message: emergencyDisabled
      ? 'All festival campaigns are currently disabled.'
      : 'Festival campaigns are operating normally.',
  });
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const body = await req.json();
    emergencyDisabled = Boolean(body.disabled);

    return NextResponse.json({
      success: true,
      emergencyDisabled,
      message: emergencyDisabled
        ? 'EMERGENCY: All festival campaigns have been DISABLED. Normal homepage is active.'
        : 'Festival campaigns have been ENABLED and restored.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
