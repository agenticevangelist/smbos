import { NextRequest, NextResponse } from 'next/server';
import { proxyNanoClawJson } from '@/lib/agents/nanoclaw';

const EMPTY_STATE = {
  dbExists: false,
  sessions: 0,
  groups: [],
  taskStats: { total: 0, active: 0, paused: 0, completed: 0 },
};

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId') || undefined;
  const data = await proxyNanoClawJson({
    endpoint: '/api/state',
    fallback: EMPTY_STATE,
    agentId,
  });
  return NextResponse.json(data);
}
