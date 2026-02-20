import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.join(process.cwd(), 'nanoclaw', '.env');

// Keys that can be managed through the UI
const MANAGED_KEYS = [
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ASSISTANT_NAME',
  'ASSISTANT_HAS_OWN_NUMBER',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_ONLY',
  'HTTP_PORT',
];

// Keys whose values should be masked in GET responses
const SECRET_KEYS = new Set([
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'TELEGRAM_BOT_TOKEN',
]);

function parseEnvFile(): Record<string, string> {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function writeEnvFile(data: Record<string, string>): void {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8');
}

function maskValue(key: string, value: string): string {
  if (!SECRET_KEYS.has(key) || !value) return value;
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

/** GET /api/nanoclaw/config — return current config with masked secrets */
export async function GET() {
  const env = parseEnvFile();
  const masked: Record<string, string> = {};
  for (const key of MANAGED_KEYS) {
    if (env[key]) {
      masked[key] = maskValue(key, env[key]);
    } else {
      masked[key] = '';
    }
  }

  // Check which auth method is active
  const authMethod = env.CLAUDE_CODE_OAUTH_TOKEN
    ? 'oauth'
    : env.ANTHROPIC_API_KEY
      ? 'api_key'
      : 'none';

  return NextResponse.json({ config: masked, authMethod });
}

/** PUT /api/nanoclaw/config — update config values */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const updates: Record<string, string> = body.config;

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'config object required' }, { status: 400 });
  }

  // Read current env, apply updates for managed keys only
  const env = parseEnvFile();

  for (const key of MANAGED_KEYS) {
    if (key in updates) {
      const value = updates[key];
      // Skip if value contains mask pattern (user didn't change it)
      if (SECRET_KEYS.has(key) && value.includes('****')) continue;
      if (value === '') {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
  }

  writeEnvFile(env);
  return NextResponse.json({ updated: true });
}
