import { NextRequest, NextResponse } from 'next/server';
import { HomepageCmsService } from '@/lib/homepageCmsService';
import { CustomerPersona } from '@/types/homepageCms';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const persona = (searchParams.get('persona') as CustomerPersona) || 'ALL';
    const clientVersion = searchParams.get('version') ? parseInt(searchParams.get('version')!, 10) : null;

    const data = HomepageCmsService.getPublishedCustomerHomepage(persona);

    // Bandwidth Optimization: If client already has the current published version
    if (clientVersion !== null && clientVersion === data.version) {
      return NextResponse.json(
        {
          upToDate: true,
          version: data.version,
          publishedAt: data.publishedAt,
          serverTime: data.serverTime,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
            'X-Homepage-Version': data.version.toString(),
          },
        }
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
        'X-Homepage-Version': data.version.toString(),
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch published homepage:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve published homepage', message: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
