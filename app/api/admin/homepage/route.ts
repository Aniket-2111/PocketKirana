import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { HomepageCmsService } from '@/lib/homepageCmsService';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });
  try {
    const layout = HomepageCmsService.getLayout();
    const diff = HomepageCmsService.getPublishDiff();
    const versions = HomepageCmsService.getVersionHistory();

    return NextResponse.json({
      success: true,
      layout,
      diff,
      latestPublishedVersion: versions[0]?.version || 1,
      totalVersionsCount: versions.length,
    });
  } catch (error: any) {
    console.error('Admin GET homepage error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });
  try {
    const body = await req.json();
    const { section, layout, admin } = body;

    const actor = admin || { id: 'admin_session', name: 'Authorized Admin', role: 'Admin' };

    if (section) {
      const result = HomepageCmsService.saveSection(section, actor);
      return NextResponse.json({ success: true, ...result });
    }

    if (layout) {
      const updated = HomepageCmsService.updateLayout(layout, actor);
      return NextResponse.json({ success: true, layout: updated });
    }

    return NextResponse.json({ success: false, error: 'No section or layout provided' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin PUT homepage error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get('sectionId');
    if (!sectionId) {
      return NextResponse.json({ success: false, error: 'sectionId is required' }, { status: 400 });
    }

    const result = HomepageCmsService.deleteSection(sectionId);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Admin DELETE homepage error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
