import { NextResponse } from 'next/server';
import { FestivalCampaign } from '@/types/festival';
import { validateFestivalCampaign } from '@/lib/festivalValidator';
import { INITIAL_FESTIVAL_TEMPLATES } from '@/lib/festivalTemplates';

let inMemoryCampaigns: FestivalCampaign[] = [
  {
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
    publishedBy: 'Admin',
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
        savedBy: 'Admin',
        notes: 'Initial publication',
      },
    ],
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
  },
];

export async function GET(req: Request) {
  try {
    return NextResponse.json({ success: true, campaigns: inMemoryCampaigns });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = validateFestivalCampaign(body);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Campaign validation failed.',
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    const newCampaign: FestivalCampaign = {
      id: body.id || `cmp-${Date.now()}`,
      name: body.name,
      festivalName: body.festivalName || body.name,
      templateId: body.templateId || 'tpl-custom',
      templateVersion: body.templateVersion || 1,
      status: body.status || 'DRAFT',
      priority: body.priority || 50,
      startAt: body.startAt,
      endAt: body.endAt,
      timezone: body.timezone || 'Asia/Kolkata',
      configurationSnapshot: body.configurationSnapshot,
      currentVersion: 1,
      versionHistory: [
        {
          versionNumber: 1,
          snapshot: {
            name: body.name,
            templateId: body.templateId || 'tpl-custom',
            theme: body.configurationSnapshot.theme,
            sections: body.configurationSnapshot.sections,
            festivalName: body.festivalName || body.name,
          },
          savedAt: new Date().toISOString(),
          savedBy: body.createdBy || 'Admin',
          notes: 'Initial draft version',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inMemoryCampaigns.unshift(newCampaign);

    return NextResponse.json({ success: true, campaign: newCampaign });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
