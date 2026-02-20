import { NextRequest, NextResponse } from 'next/server';
import { getAgentConfig } from '@/lib/agents/registry';
import { getLogs, clearLogs } from '@/lib/agents/logger';
import type { LogEventType } from '@/lib/agents/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const config = getAgentConfig(id);
  if (!config) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit')) || 100;
  const type = url.searchParams.get('type') as LogEventType | null;
  const since = url.searchParams.get('since') || undefined;

  const logs = getLogs(id, {
    limit,
    ...(type && { type }),
    ...(since && { since }),
  });

  return NextResponse.json(logs);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const config = getAgentConfig(id);
  if (!config) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  clearLogs(id);
  return NextResponse.json({ cleared: true });
}
