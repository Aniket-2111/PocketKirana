import { NextResponse } from 'next/server';
import { fetchDeliveryExceptionsFS } from '@/lib/deliveryExceptionService';

export async function GET() {
  try {
    const exceptions = await fetchDeliveryExceptionsFS();
    return NextResponse.json({ success: true, data: exceptions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error fetching delivery exceptions' },
      { status: 500 }
    );
  }
}
