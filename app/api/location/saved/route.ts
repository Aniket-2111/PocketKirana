import { NextResponse } from 'next/server';
import { INITIAL_ADDRESSES } from '@/lib/mockData';
import { Address } from '@/types';

let SAVED_ADDRESSES_STORE: Address[] = [...INITIAL_ADDRESSES];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'usr-cust-1';

    const addresses = SAVED_ADDRESSES_STORE.filter((a) => a.userId === userId || !a.userId);

    return NextResponse.json({
      success: true,
      count: addresses.length,
      data: addresses,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch saved addresses' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId = 'usr-cust-1',
      addressType = 'Home',
      fullName,
      phone,
      houseNumber,
      buildingName,
      landmark,
      addressLine1,
      city = 'Neral',
      state = 'Maharashtra',
      country = 'India',
      postalCode = '410101',
      latitude,
      longitude,
      isDefault = false,
    } = body;

    if (!latitude || !longitude || !addressLine1) {
      return NextResponse.json(
        { success: false, error: 'latitude, longitude, and addressLine1 are required' },
        { status: 400 }
      );
    }

    const newAddress: Address = {
      id: 'addr-' + Date.now(),
      userId,
      addressType,
      fullName: fullName || 'Customer',
      phone: phone || '+91 98201 00000',
      houseNumber,
      buildingName,
      landmark,
      addressLine1,
      city,
      state,
      country,
      postalCode,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      isDefault: Boolean(isDefault),
    };

    if (isDefault) {
      SAVED_ADDRESSES_STORE = SAVED_ADDRESSES_STORE.map((a) => ({
        ...a,
        isDefault: false,
      }));
    }

    SAVED_ADDRESSES_STORE.unshift(newAddress);

    return NextResponse.json({
      success: true,
      message: 'Address saved successfully',
      data: newAddress,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save address' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Address id parameter is required' },
        { status: 400 }
      );
    }

    SAVED_ADDRESSES_STORE = SAVED_ADDRESSES_STORE.filter((a) => a.id !== id);

    return NextResponse.json({
      success: true,
      message: `Address ${id} deleted successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete address' },
      { status: 500 }
    );
  }
}
