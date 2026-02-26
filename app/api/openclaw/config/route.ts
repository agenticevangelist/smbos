import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/agents/openclaw-client';
import { getGatewayStatus } from '@/lib/agents/lifecycle';

const SECRET_PATTERNS = [
  /token/i,
  /key/i,
  /secret/i,
  /password/i,
  /hash/i,
];

function isSecretKey(key: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(key));
}

function maskSecrets(obj: unknown, depth = 0): unknown {
  if (depth > 5) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map((item) => maskSecrets(item, depth + 1));
  if (obj && typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isSecretKey(key) && typeof value === 'string' && value.length > 0) {
        masked[key] = value.length <= 8 ? '****' : value.slice(0, 4) + '****' + value.slice(-4);
      } else {
        masked[key] = maskSecrets(value, depth + 1);
      }
    }
    return masked;
  }
  return obj;
}

export async function GET() {
  const gateway = await getGatewayStatus();

  if (!gateway.running) {
    return NextResponse.json({ error: 'Gateway offline' }, { status: 503 });
  }

  try {
    const client = getOpenClawClient({ port: gateway.port });
    const config = await client.getConfig();
    return NextResponse.json({ config: maskSecrets(config) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read config' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const gateway = await getGatewayStatus();

  if (!gateway.running) {
    return NextResponse.json({ error: 'Gateway offline' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const patch = body.patch || body.config;

    if (!patch || typeof patch !== 'object') {
      return NextResponse.json({ error: 'patch object required' }, { status: 400 });
    }

    const client = getOpenClawClient({ port: gateway.port });
    await client.patchConfig(patch);
    await client.applyConfig();

    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update config' },
      { status: 500 },
    );
  }
}
