import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cwd = process.cwd();
    
    let skillDir = path.join(cwd, 'skills', id);
    if (!fs.existsSync(skillDir)) {
        skillDir = path.join(cwd, 'smbos', 'skills', id);
    }
    
    if (!fs.existsSync(skillDir)) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const uiJsonPath = path.join(skillDir, 'ui.json');
    if (fs.existsSync(uiJsonPath)) {
        const config = JSON.parse(fs.readFileSync(uiJsonPath, 'utf8'));
        return NextResponse.json(config);
    }

    // Fallback if ui.json is missing but directory exists (maybe just SKILL.md)
    return NextResponse.json({
        id,
        name: id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        description: `Modular skill: ${id}`
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
