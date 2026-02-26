import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/agents/openclaw-client';
import { getGatewayStatus } from '@/lib/agents/lifecycle';

export async function GET() {
  const gateway = await getGatewayStatus();

  if (!gateway.running) {
    return NextResponse.json({ jobs: [], runs: [] });
  }

  try {
    const client = getOpenClawClient({ port: gateway.port });
    const result = await client.listCronJobs();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ jobs: [], runs: [] });
  }
}

export async function POST(request: NextRequest) {
  const gateway = await getGatewayStatus();

  if (!gateway.running) {
    return NextResponse.json({ error: 'Gateway offline' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { action, ...params } = body;

    const client = getOpenClawClient({ port: gateway.port });

    switch (action) {
      case 'add': {
        const job = await client.addCronJob(params);
        return NextResponse.json(job, { status: 201 });
      }
      case 'remove': {
        await client.removeCronJob(params.id);
        return NextResponse.json({ removed: true });
      }
      case 'run': {
        await client.runCronJob(params.id);
        return NextResponse.json({ triggered: true });
      }
      case 'runs': {
        const runs = await client.getCronRuns(params.id, params.limit);
        return NextResponse.json(runs);
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
