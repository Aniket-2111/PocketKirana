import { NextResponse } from 'next/server';
import { addServiceRequestFS, fetchServiceRequestsFS, updateServiceRequestStatusFS } from '@/lib/firebaseServices';

export async function GET() {
  try {
    const requests = await fetchServiceRequestsFS();
    return NextResponse.json({ success: true, data: requests });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch service requests' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, email, address, latitude, longitude, pincode, shopId, userId } = body;

    if (!name || !phone || !address || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, phone, address, and coordinates are required' },
        { status: 400 }
      );
    }

    const docId = await addServiceRequestFS({
      userId: userId || 'guest',
      name,
      phone,
      email: email || '',
      address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      pincode: pincode || '410101',
      shopId: shopId || 'store-1',
      status: 'waiting',
    });

    return NextResponse.json({
      success: true,
      data: { id: docId, message: 'Thank you! We will notify you as soon as PocketKirana expands to your area.' },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to save service request' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'ID and status are required' }, { status: 400 });
    }

    const success = await updateServiceRequestStatusFS(id, status);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to update status' }, { status: 500 });
  }
}
