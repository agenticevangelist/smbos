import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const cwd = process.cwd();

    // Look for execution script in the skill directory
    // We prioritize scripts/execute.ts, then tool.ts
    const possiblePaths = [
      path.join(cwd, 'skills', id, 'scripts', 'execute.ts'),
      path.join(cwd, 'skills', id, 'tool.ts'),
      path.join(cwd, 'smbos', 'skills', id, 'scripts', 'execute.ts'),
      path.join(cwd, 'smbos', 'skills', id, 'tool.ts'),
    ];

    let toolFilePath = possiblePaths.find(p => fs.existsSync(p));
    let importPath = '';

    if (toolFilePath) {
      if (toolFilePath.includes('/scripts/execute.ts')) {
        importPath = `@/skills/${id}/scripts/execute`;
      } else {
        importPath = `@/skills/${id}/tool`;
      }
    } else {
      // Try JS version if compiled (simplified check)
      toolFilePath = possiblePaths.map(p => p.replace('.ts', '.js')).find(p => fs.existsSync(p));
      if (toolFilePath) {
         if (toolFilePath.includes('/scripts/execute.js')) {
          importPath = `@/skills/${id}/scripts/execute`;
        } else {
          importPath = `@/skills/${id}/tool`;
        }
      }
    }

    if (!importPath) {
      return NextResponse.json({ error: `Execution script not found for skill: ${id}. Checked: ${possiblePaths.join(', ')}` }, { status: 404 });
    }

    // Dynamic import the tool (new Function prevents Turbopack from tracing the import path)
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
    const toolModule = await load(importPath);
    
    if (!toolModule || !toolModule.execute) {
      return NextResponse.json({ error: `Execute function not found in tool for skill: ${id}` }, { status: 500 });
    }

    const result = await toolModule.execute(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Skill Execution Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    }, { status: 500 });
  }
}
