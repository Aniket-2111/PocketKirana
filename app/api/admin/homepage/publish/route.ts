import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { HomepageCmsService } from '@/lib/homepageCmsService';

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const { customSummary } = body;

    // Use verified auth context — never trust client-supplied admin object
    const actor = { id: auth.uid, name: auth.name || 'Admin', role: auth.role };
    const result = HomepageCmsService.publish(actor, customSummary);

    return NextResponse.json({ ...result });
  } catch (error: any) {
    console.error('Admin POST publish error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
