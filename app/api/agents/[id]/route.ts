import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getAgentConfig, getAgentsDir } from '@/lib/agents/registry';
import { getAgentStatus, getProcessInfo, getProcessLogs } from '@/lib/agents/lifecycle';
import { logEvent } from '@/lib/agents/logger';

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
    schedules: config.config.schedules,
    status: status.status,
    pid: status.pid,
    uptime: status.uptime,
    processLogs: logs,
  });
}

/** PATCH /api/agents/[id] — update schedule enabled state */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const config = getAgentConfig(id);
  if (!config) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Toggle schedule enabled
  if (body.scheduleId !== undefined && body.enabled !== undefined) {
    const configPath = path.join(getAgentsDir(), id, 'config.yaml');
    if (!fs.existsSync(configPath)) {
      return NextResponse.json({ error: 'config.yaml not found' }, { status: 404 });
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const data = yaml.load(raw) as Record<string, any>;

    if (Array.isArray(data.schedules)) {
      const schedule = data.schedules.find((s: any) => s.id === body.scheduleId);
      if (schedule) {
        schedule.enabled = body.enabled;
        fs.writeFileSync(configPath, yaml.dump(data, { lineWidth: -1 }), 'utf8');
        return NextResponse.json({ updated: true });
      }
    }

    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
}

/** POST /api/agents/[id] — manual trigger a schedule action */
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

  logEvent(id, 'cron:trigger', { scheduleId: body.scheduleId || 'manual', action: body.action });

  try {
    const res = await fetch(`http://127.0.0.1:${proc.port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body.action }),
    });

    if (res.ok) {
      logEvent(id, 'cron:success', { scheduleId: body.scheduleId || 'manual' });
      return NextResponse.json({ triggered: true });
    } else {
      logEvent(id, 'cron:error', { scheduleId: body.scheduleId || 'manual', status: res.status });
      return NextResponse.json({ error: `Agent returned ${res.status}` }, { status: 502 });
    }
  } catch (err) {
    logEvent(id, 'cron:error', {
      scheduleId: body.scheduleId || 'manual',
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Failed to reach agent' }, { status: 502 });
  }
}
