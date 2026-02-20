import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAllAgents, getAgentsDir } from '@/lib/agents/registry';

export async function GET() {
  try {
    const agents = getAllAgents();
    return NextResponse.json(agents);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, model, systemPrompt } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }

    // Validate id format (kebab-case)
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
      return NextResponse.json({ error: 'id must be kebab-case (e.g., my-agent)' }, { status: 400 });
    }

    const agentsDir = getAgentsDir();
    const agentDir = path.join(agentsDir, id);

    if (fs.existsSync(agentDir)) {
      return NextResponse.json({ error: `Agent "${id}" already exists` }, { status: 409 });
    }

    // Scaffold agent directory
    fs.mkdirSync(path.join(agentDir, 'memory'), { recursive: true });

    // Write agent.md
    const agentMd = `---
name: ${name}
model: ${model || 'claude-sonnet-4-6'}
version: 1.0
max_tokens: 8192
temperature: 0.7
---

${systemPrompt || `# Identity\n\nYou are ${name}.`}
`;
    fs.writeFileSync(path.join(agentDir, 'agent.md'), agentMd, 'utf8');

    // Write config.yaml
    const configYaml = `port: null

tools: []
`;
    fs.writeFileSync(path.join(agentDir, 'config.yaml'), configYaml, 'utf8');

    // Write .env.example
    fs.writeFileSync(path.join(agentDir, '.env.example'), '# Add secrets here\nANTHROPIC_API_KEY=\n', 'utf8');

    // Write initial memory
    fs.writeFileSync(path.join(agentDir, 'memory', 'context.md'), '# Current Context\n\n(empty)\n', 'utf8');

    return NextResponse.json({ id, name, created: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Agent id is required' }, { status: 400 });

    const agentsDir = getAgentsDir();
    const agentDir = path.join(agentsDir, id);

    if (!fs.existsSync(agentDir)) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    fs.rmSync(agentDir, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
