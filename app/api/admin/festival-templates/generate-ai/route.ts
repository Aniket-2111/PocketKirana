import { NextResponse } from 'next/server';
import { generateAITemplateVariations } from '@/lib/festivalAiEngine';
import { AIGenerateTemplatePrompt } from '@/types/festival';

export async function POST(req: Request) {
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
      { success: false, message: error?.message || 'Failed to generate template variations.' },
      { status: 500 }
    );
  }
}
