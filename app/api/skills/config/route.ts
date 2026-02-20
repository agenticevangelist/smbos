import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getConfigPath(): string {
  const cwd = process.cwd();
  let skillsDir = path.join(cwd, 'skills');
  if (!fs.existsSync(skillsDir)) {
    skillsDir = path.join(cwd, 'smbos', 'skills');
  }
  return path.join(skillsDir, '.config.json');
}

function readConfig(): { overrides: Record<string, any> } {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return { overrides: {} };
}

function writeConfig(config: { overrides: Record<string, any> }): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

export async function GET() {
  try {
    const config = readConfig();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { skillId, ...updates } = await request.json();

    if (!skillId) {
      return NextResponse.json({ error: 'skillId is required' }, { status: 400 });
    }

    const config = readConfig();
    config.overrides[skillId] = {
      ...(config.overrides[skillId] || {}),
      ...updates,
    };

    writeConfig(config);
    return NextResponse.json({ success: true, overrides: config.overrides[skillId] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
