import { NextRequest, NextResponse } from 'next/server';
import { getAgentConfig } from '@/lib/agents/registry';
import { getAgentStatus, getProcessLogs } from '@/lib/agents/lifecycle';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const config = getAgentConfig(id);
  if (!config) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const status = getAgentStatus(id);
  const logs = getProcessLogs();

  return NextResponse.json({
    id: config.id,
    name: config.frontmatter.name,
    model: config.frontmatter.model,
    version: config.frontmatter.version,
    max_tokens: config.frontmatter.max_tokens,
    temperature: config.frontmatter.temperature,
    systemPrompt: config.systemPrompt,
    port: status.port,
    tools: config.config.tools,
    status: status.status,
    uptime: status.uptime,
    processLogs: logs,
  });
}

/** POST /api/agents/[id] — send a message to the agent via OpenClaw */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (!body.action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  const status = getAgentStatus(id);
  if (status.status !== 'running') {
    return NextResponse.json({ error: 'Agent is not running' }, { status: 400 });
  }

  try {
    const res = await fetch('/api/openclaw/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body.action, agentId: id }),
    });

    if (res.ok) {
      return NextResponse.json({ triggered: true });
    } else {
      return NextResponse.json({ error: `Agent returned ${res.status}` }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to reach agent' }, { status: 502 });
  }
}
