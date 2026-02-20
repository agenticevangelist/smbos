import { NextResponse } from 'next/server';
import { getAllAgentConfigs } from '@/lib/agents/registry';

// Scheduled tasks are now derived from agent config.yaml files.
// This endpoint returns a flat list for backwards compatibility.
export async function GET() {
  try {
    const agents = getAllAgentConfigs();
    const tasks = agents.flatMap(agent =>
      agent.config.schedules.map(s => ({
        id: `${agent.id}-${s.id}`,
        agentId: agent.id,
        agentName: agent.frontmatter.name,
        scheduleId: s.id,
        cron: s.cron,
        action: s.action,
        enabled: s.enabled,
      }))
    );
    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
