import { NextRequest, NextResponse } from 'next/server';
import { HomepageCmsService } from '@/lib/homepageCmsService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderedSectionIds, admin } = body;

    if (!Array.isArray(orderedSectionIds)) {
      return NextResponse.json({ success: false, error: 'orderedSectionIds array required' }, { status: 400 });
    }

    const actor = admin || { id: 'admin_session', name: 'Authorized Admin', role: 'Admin' };
    const result = HomepageCmsService.reorderSections(orderedSectionIds, actor);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Admin POST reorder error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
