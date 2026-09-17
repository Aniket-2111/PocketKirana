import { NextResponse } from 'next/server';
import { INITIAL_FESTIVAL_TEMPLATES } from '@/lib/festivalTemplates';
import { FestivalCampaign } from '@/types/festival';
import { fetchFestivalCampaignsFS, fetchFestivalSettingsFS } from '@/lib/firebaseServices';

// In-memory / server cache fallback for active campaigns
const fallbackCampaign: FestivalCampaign = {
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
  versionHistory: [],
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const forcePreview = url.searchParams.get('preview') === 'true';

    // 1. Emergency kill switch check from Firestore
    const settings = await fetchFestivalSettingsFS().catch(() => null);
    const isEmergencyDisabled = !!settings?.isEmergencyDisabled;
    if (isEmergencyDisabled && !forcePreview) {
      return NextResponse.json({
        active: false,
        reason: 'Festival campaigns are temporarily disabled by Admin.',
        campaign: null,
      });
    }

    // 2. Fetch live campaigns from Firestore or fallback
    let allCampaigns = await fetchFestivalCampaignsFS().catch(() => []);
    if (!allCampaigns || allCampaigns.length === 0) {
      allCampaigns = [fallbackCampaign];
    }

    const now = new Date().getTime();
    const publishedCampaigns = allCampaigns.filter((c) => {
      if (c.status !== 'PUBLISHED' && !forcePreview) return false;
      const start = new Date(c.startAt).getTime();
      const end = new Date(c.endAt).getTime();
      return (now >= start && now <= end) || forcePreview;
    });

    if (publishedCampaigns.length === 0) {
      return NextResponse.json({
        active: false,
        reason: 'No active scheduled campaign for current time window.',
        campaign: null,
      });
    }

    // Sort by priority descending
    const activeCampaign = publishedCampaigns.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];

    return NextResponse.json(
      {
        active: true,
        campaignId: activeCampaign.id,
        name: activeCampaign.name,
        festivalName: activeCampaign.festivalName,
        status: activeCampaign.status,
        priority: activeCampaign.priority,
        startAt: activeCampaign.startAt,
        endAt: activeCampaign.endAt,
        timezone: activeCampaign.timezone,
        theme: activeCampaign.configurationSnapshot.theme,
        sections: activeCampaign.configurationSnapshot.sections,
        schemaVersion: '1.0',
        version: activeCampaign.currentVersion,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    );
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
