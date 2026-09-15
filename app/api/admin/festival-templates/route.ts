import { NextResponse } from 'next/server';
import { INITIAL_FESTIVAL_TEMPLATES } from '@/lib/festivalTemplates';
import { validateFestivalTemplate } from '@/lib/festivalValidator';
import { FestivalTemplate } from '@/types/festival';

let inMemoryTemplates: FestivalTemplate[] = [...INITIAL_FESTIVAL_TEMPLATES];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search')?.toLowerCase();

    let list = [...inMemoryTemplates];

    if (category && category !== 'ALL') {
      list = list.filter((t) => t.category === category);
    }

    if (search) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search) ||
          t.tags.some((tag) => tag.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({ success: true, templates: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = validateFestivalTemplate(body);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Template validation failed.',
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    const newTemplate: FestivalTemplate = {
      id: body.id || `tpl-admin-${Date.now()}`,
      name: body.name,
      description: body.description || '',
      festivalKey: body.festivalKey || 'custom',
      category: body.category || 'MY_TEMPLATES',
      version: body.version || 1,
      schemaVersion: '1.0',
      minimumAppVersion: '1.0.0',
      previewThumbnail:
        body.previewThumbnail ||
        'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=600&q=80',
      theme: body.theme,
      sections: body.sections,
      tags: body.tags || ['Custom'],
      createdBy: body.createdBy || 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inMemoryTemplates.unshift(newTemplate);

    return NextResponse.json({ success: true, template: newTemplate });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
