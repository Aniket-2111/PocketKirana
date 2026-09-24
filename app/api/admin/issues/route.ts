import { NextResponse } from 'next/server';
import { fetchCustomerIssuesFS, resolveCustomerIssueFS } from '@/lib/customerComplaintService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const customerId = searchParams.get('customerId') || undefined;
    const orderId = searchParams.get('orderId') || undefined;

    const issues = await fetchCustomerIssuesFS({ status, customerId, orderId });
    return NextResponse.json({ success: true, data: issues });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error fetching issues' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      issueId,
      adminId,
      adminName,
      action,
      refundAmount,
      adminNotes,
      rejectionReason,
    } = body;

    if (!issueId || !adminId || !action) {
      return NextResponse.json(
        { success: false, error: 'Issue ID, Admin ID, and Action are required' },
        { status: 400 }
      );
    }

    const result = await resolveCustomerIssueFS({
      issueId,
      adminId,
      adminName: adminName || 'Admin',
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
      { success: false, error: error.message || 'Server error resolving issue' },
      { status: 500 }
    );
  }
}
