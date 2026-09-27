import { NextRequest, NextResponse } from 'next/server';
import { HomepageCmsService } from '@/lib/homepageCmsService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { admin, customSummary } = body;

    const actor = admin || { id: 'admin_session', name: 'Authorized Admin', role: 'Admin' };
    const result = HomepageCmsService.publish(actor, customSummary);

    return NextResponse.json({ ...result });
  } catch (error: any) {
    console.error('Admin POST publish error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
