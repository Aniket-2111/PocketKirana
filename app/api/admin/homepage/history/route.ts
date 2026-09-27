import { NextRequest, NextResponse } from 'next/server';
import { HomepageCmsService } from '@/lib/homepageCmsService';

export async function GET(req: NextRequest) {
  try {
    const versions = HomepageCmsService.getVersionHistory();
    const auditLogs = HomepageCmsService.getAuditLogs();

    return NextResponse.json({
      success: true,
      versions,
      auditLogs,
    });
  } catch (error: any) {
    console.error('Admin GET history error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
