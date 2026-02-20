import { NextRequest, NextResponse } from 'next/server';
import { proxyNanoClawJson } from '@/lib/agents/nanoclaw';

const EMPTY_TASKS_STATE = { tasks: [], runLogs: [] };

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId') || undefined;
  const data = await proxyNanoClawJson({
    endpoint: '/api/tasks',
    fallback: EMPTY_TASKS_STATE,
    agentId,
  });
  return NextResponse.json(data);
}
