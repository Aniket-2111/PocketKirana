import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { generateAITemplateVariations } from '@/lib/festivalAiEngine';
import { AIGenerateTemplatePrompt } from '@/types/festival';

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const prompt: AIGenerateTemplatePrompt = await req.json();

    if (!prompt.festivalName || prompt.festivalName.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Festival Name is required for AI generation.' },
        { status: 400 }
      );
    }

    const variations = generateAITemplateVariations(prompt);

    return NextResponse.json({
      success: true,
      message: `Generated 4 design variations for ${prompt.festivalName}.`,
      variations,
    });
  } catch (error: any) {
    console.error('AI Template Generation Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate template variations.' },
      { status: 500 }
    );
  }
}
