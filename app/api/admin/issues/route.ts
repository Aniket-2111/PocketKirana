import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { fetchCustomerIssuesFS, resolveCustomerIssueFS } from '@/lib/customerComplaintService';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const customerId = searchParams.get('customerId') || undefined;
    const orderId = searchParams.get('orderId') || undefined;

    const issues = await fetchCustomerIssuesFS({ status, customerId, orderId });
    return NextResponse.json({ success: true, data: issues });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Server error fetching issues' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const {
      issueId,
      adminName,
      action,
      refundAmount,
      adminNotes,
      rejectionReason,
    } = body;

    // Use verified auth context — never trust client-supplied adminId
    const adminId = auth.uid;

    if (!issueId || !action) {
      return NextResponse.json(
        { success: false, error: 'Issue ID and Action are required' },
        { status: 400 }
      );
    }

    const result = await resolveCustomerIssueFS({
      issueId,
      adminId,
      adminName: adminName || auth.name || 'Admin',
      action,
      refundAmount,
      adminNotes,
      rejectionReason,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Server error resolving issue' },
      { status: 500 }
    );
  }
}
