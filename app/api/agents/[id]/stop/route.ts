import { NextRequest, NextResponse } from 'next/server';
import { getAgentConfig } from '@/lib/agents/registry';
import { stopAgent } from '@/lib/agents/lifecycle';
import { stopScheduler } from '@/lib/agents/scheduler';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const config = getAgentConfig(id);
  if (!config) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  stopScheduler(id);
  const stopped = stopAgent(id);

  return NextResponse.json({
    status: 'stopped',
    wasStopped: stopped,
  });
}
