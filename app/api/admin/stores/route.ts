import { NextResponse } from 'next/server';
import { getStores } from '@/lib/locationServices';

export async function GET() {
  const stores = getStores();
  return NextResponse.json({
    success: true,
    data: stores,
  });
}
