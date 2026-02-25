import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const PROJECTS_FILE = path.join(process.cwd(), 'projects.json');

async function ensureProjectsFile() {
  try {
    await fs.access(PROJECTS_FILE);
  } catch {
    // If file doesn't exist, create it with default structure
    await fs.writeFile(PROJECTS_FILE, JSON.stringify({ projects: [] }, null, 2));
  }
}

export async function GET() {
  try {
    await ensureProjectsFile();
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error: any) {
    console.error('Projects API Read Error:', error);
    return NextResponse.json({ error: 'Failed to read projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureProjectsFile();
    const body = await request.json();

    // Basic validation: verify 'projects' array exists
    if (!body.projects || !Array.isArray(body.projects)) {
      return NextResponse.json({ error: 'Invalid data format: "projects" array required' }, { status: 400 });
    }

    await fs.writeFile(PROJECTS_FILE, JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Projects API Write Error:', error);
    return NextResponse.json({ error: 'Failed to save projects' }, { status: 500 });
  }
}
