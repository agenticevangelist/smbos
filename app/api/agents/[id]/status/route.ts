import { NextRequest, NextResponse } from 'next/server';
import { getAgentConfig } from '@/lib/agents/registry';
import { getAgentStatus } from '@/lib/agents/lifecycle';

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

  return NextResponse.json({
    id,
    name: config.frontmatter.name,
    ...status,
  });
}
