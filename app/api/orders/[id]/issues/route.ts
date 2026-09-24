import { NextResponse } from 'next/server';
import { createCustomerComplaint, fetchCustomerIssuesFS } from '@/lib/customerComplaintService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const issues = await fetchCustomerIssuesFS({ orderId });
    return NextResponse.json({ success: true, data: issues });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error fetching order issues' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      orderNumber,
      customerId,
      customerName,
      customerPhone,
      orderItemId,
      productId,
      productName,
      variantName,
      issueType,
      description,
      photos,
      customerRequestedResolution,
      batchNumber,
      expiryDate,
    } = body;

    if (!orderId || !customerId || !productName || !issueType || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required complaint fields (Product, Issue Type, Description)' },
        { status: 400 }
      );
    }

    const result = await createCustomerComplaint({
      orderId,
      orderNumber: orderNumber || orderId,
      customerId,
      customerName,
      customerPhone,
      orderItemId,
      productId,
      productName,
      variantName,
      issueType,
      description,
      photos,
      customerRequestedResolution,
      batchNumber,
      expiryDate,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.issue });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error creating complaint' },
      { status: 500 }
    );
  }
}
