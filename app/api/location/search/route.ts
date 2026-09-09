import { NextResponse } from 'next/server';
import { searchLocationsAutocomplete } from '@/lib/locationServices';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }

    const results = await searchLocationsAutocomplete(query);
    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Location search failed' },
      { status: 500 }
    );
  }
}
