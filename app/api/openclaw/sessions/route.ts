import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/agents/openclaw-client';
import { getGatewayStatus } from '@/lib/agents/lifecycle';

export async function GET(request: NextRequest) {
  const gateway = await getGatewayStatus();

  if (!gateway.running) {
    return NextResponse.json({ sessions: [], messages: [] });
  }

  const agentId = request.nextUrl.searchParams.get('agentId');
  const sessionKey = request.nextUrl.searchParams.get('sessionKey');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '200', 10);

  try {
    const client = getOpenClawClient({ port: gateway.port });

    // If sessionKey or agentId provided, return history
    if (sessionKey || agentId) {
      const key = sessionKey || `agent:${agentId}:main`;
      const result = await client.getSessionHistory(key, limit);
      return NextResponse.json(result);
    }

    // Otherwise list sessions
    const result = await client.listSessions({ limit: 100 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ sessions: [], messages: [] });
  }
}
