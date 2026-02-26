import { NextResponse } from 'next/server';
import { getGatewayStatus } from '@/lib/agents/lifecycle';
import { getOpenClawClient } from '@/lib/agents/openclaw-client';

export async function GET() {
  const gateway = await getGatewayStatus();

  if (!gateway.running) {
    return NextResponse.json({ status: 'offline', ...gateway });
  }

  try {
    const client = getOpenClawClient({ port: gateway.port });
    const status = await client.getStatus();
    return NextResponse.json({
      status: 'online',
      ...gateway,
      ...status,
    });
  } catch {
    return NextResponse.json({
      status: 'online',
      ...gateway,
    });
  }
}
