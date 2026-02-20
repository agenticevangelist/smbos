import { NextRequest, NextResponse } from 'next/server';
import { getAgentConfig } from '@/lib/agents/registry';
import { getAgentStatus, getProcessInfo, getProcessLogs } from '@/lib/agents/lifecycle';

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

  const logs = getProcessLogs(id);

  return NextResponse.json({
    id: config.id,
    name: config.frontmatter.name,
    model: config.frontmatter.model,
    version: config.frontmatter.version,
    max_tokens: config.frontmatter.max_tokens,
    temperature: config.frontmatter.temperature,
    systemPrompt: config.systemPrompt,
    port: config.config.port,
    tools: config.config.tools,
    status: status.status,
    pid: status.pid,
    uptime: status.uptime,
    processLogs: logs,
  });
}

/** POST /api/agents/[id] — send a message to the agent */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (!body.action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  const proc = getProcessInfo(id);
  if (!proc) {
    return NextResponse.json({ error: 'Agent is not running' }, { status: 400 });
  }

  try {
    const res = await fetch(`http://127.0.0.1:${proc.port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body.action }),
    });

    if (res.ok) {
      return NextResponse.json({ triggered: true });
    } else {
      return NextResponse.json({ error: `Agent returned ${res.status}` }, { status: 502 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reach agent' }, { status: 502 });
  }
}
