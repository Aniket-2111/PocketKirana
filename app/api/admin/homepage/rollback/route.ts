import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { HomepageCmsService } from '@/lib/homepageCmsService';

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const body = await req.json();
    const { targetVersion } = body;

    if (!targetVersion || typeof targetVersion !== 'number') {
      return NextResponse.json({ success: false, error: 'targetVersion number is required' }, { status: 400 });
    }

    // Use verified auth context — never trust client-supplied admin object
    const actor = { id: auth.uid, name: auth.name || 'Admin', role: auth.role };
    const result = HomepageCmsService.rollback(targetVersion, actor);

    return NextResponse.json({ ...result });
  } catch (error: any) {
    console.error('Admin POST rollback error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
