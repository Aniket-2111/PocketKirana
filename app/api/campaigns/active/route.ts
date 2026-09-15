import { NextResponse } from 'next/server';
import { INITIAL_FESTIVAL_TEMPLATES } from '@/lib/festivalTemplates';
import { FestivalCampaign } from '@/types/festival';

// In-memory / server cache fallback for active campaigns
let serverEmergencyDisabled = false;
let serverActiveCampaign: FestivalCampaign | null = {
  id: 'cmp-ganesh-chaturthi-2026',
  name: 'Ganesh Chaturthi Maha Utsav 2026',
  festivalName: 'Ganesh Chaturthi',
  templateId: 'tpl-ganesh-chaturthi-premium',
  templateVersion: 1,
  status: 'PUBLISHED',
  priority: 100,
  startAt: '2026-08-15T00:00:00.000Z',
  endAt: '2026-10-15T23:59:59.000Z',
  timezone: 'Asia/Kolkata',
  configurationSnapshot: {
    festivalName: 'Ganesh Chaturthi',
    theme: INITIAL_FESTIVAL_TEMPLATES[0].theme,
    sections: INITIAL_FESTIVAL_TEMPLATES[0].sections,
  },
  publishedAt: '2026-08-15T00:00:00.000Z',
  publishedBy: 'Admin (Master)',
  currentVersion: 1,
  versionHistory: [
    {
      versionNumber: 1,
      snapshot: {
        name: 'Ganesh Chaturthi Maha Utsav 2026',
        templateId: 'tpl-ganesh-chaturthi-premium',
        theme: INITIAL_FESTIVAL_TEMPLATES[0].theme,
        sections: INITIAL_FESTIVAL_TEMPLATES[0].sections,
        festivalName: 'Ganesh Chaturthi',
      },
      savedAt: '2026-08-15T00:00:00.000Z',
      savedBy: 'Admin (Master)',
      notes: 'Initial Published Campaign',
    },
  ],
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const forcePreview = url.searchParams.get('preview') === 'true';

    // 1. Emergency kill switch check
    if (serverEmergencyDisabled && !forcePreview) {
      return NextResponse.json({
        active: false,
        reason: 'Festival campaigns are temporarily disabled by Admin.',
        campaign: null,
      });
    }

    // 2. Check active campaign
    if (!serverActiveCampaign) {
      return NextResponse.json({
        active: false,
        campaign: null,
      });
    }

    const now = new Date().getTime();
    const start = new Date(serverActiveCampaign.startAt).getTime();
    const end = new Date(serverActiveCampaign.endAt).getTime();

    const isPublished = serverActiveCampaign.status === 'PUBLISHED';
    const isWithinTime = now >= start && now <= end;

    if ((isPublished && isWithinTime) || forcePreview) {
      return NextResponse.json(
        {
          active: true,
          campaignId: serverActiveCampaign.id,
          name: serverActiveCampaign.name,
          festivalName: serverActiveCampaign.festivalName,
          status: serverActiveCampaign.status,
          priority: serverActiveCampaign.priority,
          startAt: serverActiveCampaign.startAt,
          endAt: serverActiveCampaign.endAt,
          timezone: serverActiveCampaign.timezone,
          theme: serverActiveCampaign.configurationSnapshot.theme,
          sections: serverActiveCampaign.configurationSnapshot.sections,
          schemaVersion: '1.0',
          version: serverActiveCampaign.currentVersion,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    return NextResponse.json({
      active: false,
      reason: 'No active scheduled campaign for current time window.',
      campaign: null,
    });
  } catch (error: any) {
    console.error('Error fetching active campaign:', error);
    // Safe graceful fallback
    return NextResponse.json(
      {
        active: false,
        error: error?.message || 'Failed to resolve active campaign',
        campaign: null,
      },
      { status: 200 }
    );
  }
}
