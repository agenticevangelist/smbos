import { NextRequest, NextResponse } from 'next/server';
import { NanoClawBridge } from '@/lib/nanoclaw-bridge';

export async function GET() {
  try {
    const agents = await NanoClawBridge.listAgents();
    return NextResponse.json(agents);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list agents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    await NanoClawBridge.createAgent({
      id: data.id || `agent-${Date.now()}`,
      name: data.name,
      role: data.role,
      skills: data.skills || [],
      config: data.config || {}
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
