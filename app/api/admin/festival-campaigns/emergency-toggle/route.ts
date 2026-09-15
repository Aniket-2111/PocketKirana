import { NextResponse } from 'next/server';

let emergencyDisabled = false;

export async function GET() {
  return NextResponse.json({
    emergencyDisabled,
    message: emergencyDisabled
      ? 'All festival campaigns are currently disabled.'
      : 'Festival campaigns are operating normally.',
  });
}

export async function POST(req: Request) {
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
