import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const targetVersionNumber = body.targetVersionNumber;

    if (!targetVersionNumber) {
      return NextResponse.json(
        { success: false, message: 'Target version number is required for rollback.' },
        { status: 400 }
      );
    }

    const versionHistory = body.versionHistory || [];
    const targetVersion = versionHistory.find((v: any) => v.versionNumber === targetVersionNumber);

    if (!targetVersion) {
      return NextResponse.json(
        { success: false, message: `Version ${targetVersionNumber} was not found in history.` },
        { status: 404 }
      );
    }

    const restoredCampaign = {
      ...body,
      id,
      name: targetVersion.snapshot.name,
      configurationSnapshot: {
        theme: targetVersion.snapshot.theme,
        sections: targetVersion.snapshot.sections,
        festivalName: targetVersion.snapshot.festivalName,
      },
      currentVersion: targetVersionNumber,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: `Successfully rolled back campaign "${restoredCampaign.name}" to Version ${targetVersionNumber}.`,
      campaign: restoredCampaign,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
