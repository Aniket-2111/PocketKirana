import { NextResponse } from 'next/server';
import { validateFestivalCampaign } from '@/lib/festivalValidator';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const validation = validateFestivalCampaign(body);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Cannot publish campaign: validation errors found.',
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    const publishedVersion = (body.currentVersion || 1) + 1;
    const publishedAt = new Date().toISOString();
    const publishedBy = body.publishedBy || 'Admin';

    const newVersionSnapshot = {
      versionNumber: publishedVersion,
      snapshot: {
        name: body.name,
        templateId: body.templateId,
        theme: body.configurationSnapshot.theme,
        sections: body.configurationSnapshot.sections,
        festivalName: body.festivalName,
        startAt: body.startAt,
        endAt: body.endAt,
      },
      savedAt: publishedAt,
      savedBy: publishedBy,
      notes: body.publishNotes || `Published Version ${publishedVersion}`,
    };

    const updatedCampaign = {
      ...body,
      id,
      status: 'PUBLISHED',
      publishedAt,
      publishedBy,
      currentVersion: publishedVersion,
      versionHistory: [newVersionSnapshot, ...(body.versionHistory || [])],
      updatedAt: publishedAt,
    };

    return NextResponse.json({
      success: true,
      message: `Campaign "${updatedCampaign.name}" published successfully (Version ${publishedVersion}).`,
      campaign: updatedCampaign,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
