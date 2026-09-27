import { NextRequest, NextResponse } from 'next/server';
import { HomepageCmsService } from '@/lib/homepageCmsService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetVersion, admin } = body;

    if (!targetVersion || typeof targetVersion !== 'number') {
      return NextResponse.json({ success: false, error: 'targetVersion number is required' }, { status: 400 });
    }

    const actor = admin || { id: 'admin_session', name: 'Authorized Admin', role: 'Admin' };
    const result = HomepageCmsService.rollback(targetVersion, actor);

    return NextResponse.json({ ...result });
  } catch (error: any) {
    console.error('Admin POST rollback error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
