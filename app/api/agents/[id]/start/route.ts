import { NextRequest, NextResponse } from 'next/server';
import { getAgentConfig } from '@/lib/agents/registry';
import { startAgent, getProcessLogs } from '@/lib/agents/lifecycle';
import { isGatewayReachable } from '@/lib/agents/openclaw-client';

async function waitForGateway(port: number, timeoutMs = 10000): Promise<boolean> {
  const interval = 500;
  const maxAttempts = Math.ceil(timeoutMs / interval);
  for (let i = 0; i < maxAttempts; i++) {
    const reachable = await isGatewayReachable(port);
    if (reachable) return true;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const config = getAgentConfig(id);
  if (!config) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const result = await startAgent(id);

    // Wait for gateway to be reachable
    const healthy = await waitForGateway(result.port);

    const response: Record<string, unknown> = {
      status: 'running',
      port: result.port,
      healthy,
    };

    if (!healthy) {
      const logs = getProcessLogs();
      if (logs.stderr) {
        response.stderr = logs.stderr.slice(-1000);
      }
    }

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start agent' },
      { status: 500 }
    );
  }
}
