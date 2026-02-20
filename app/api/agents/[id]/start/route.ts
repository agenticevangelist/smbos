import { NextRequest, NextResponse } from 'next/server';
import { getAgentConfig } from '@/lib/agents/registry';
import { startAgent, getProcessLogs } from '@/lib/agents/lifecycle';
import { startScheduler } from '@/lib/agents/scheduler';

async function waitForHealth(port: number, timeoutMs = 10000): Promise<boolean> {
  const interval = 500;
  const maxAttempts = Math.ceil(timeoutMs / interval);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return true;
    } catch {
      // Not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const config = getAgentConfig(id);
  if (!config) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Parse force flag from request body (optional)
  let force = false;
  try {
    const body = await request.json();
    force = body.force === true;
  } catch {
    // No body or invalid JSON — force=false
  }

  try {
    const result = await startAgent(id, force);

    // Start cron schedules if agent has any
    const enabledSchedules = config.config.schedules.filter(s => s.enabled);
    if (enabledSchedules.length > 0) {
      startScheduler(id, result.port, config.config.schedules);
    }

    // Wait for health check
    const healthy = await waitForHealth(result.port);

    const response: Record<string, unknown> = {
      status: 'running',
      pid: result.pid,
      port: result.port,
      healthy,
    };

    if (!healthy) {
      const logs = getProcessLogs(id);
      if (logs?.stderr) {
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
