import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const resolvePath = (p: string) => {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
};

async function getAgentWorkspacePath(agentId: string) {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    // Check if agent has an explicit workspace in agents.list
    const agent = config.agents?.list?.find((a: any) => a.id === agentId);
    if (agent?.workspace) {
      return resolvePath(agent.workspace);
    }

    // For the default/main agent (or any agent not in list), use agents.defaults.workspace
    const defaultWs = config.agents?.defaults?.workspace;
    if (defaultWs && (agentId === 'main' || !config.agents?.list?.length)) {
      return resolvePath(defaultWs);
    }
  } catch {
    // ignore config read errors
  }

  // Fallback: main uses the bare workspace, others get suffixed
  if (agentId === 'main') {
    return path.join(os.homedir(), '.openclaw', 'workspace');
  }
  return path.join(os.homedir(), '.openclaw', `workspace-${agentId}`);
}

export async function POST(req: Request) {
  try {
    const { action, agentId, filePath, content } = await req.json();

    if (!agentId) {
      return NextResponse.json({ ok: false, error: 'Agent ID required' }, { status: 400 });
    }

    const workspacePath = await getAgentWorkspacePath(agentId);

    try {
      await fs.access(workspacePath);
    } catch {
      return NextResponse.json({ ok: false, error: `Workspace not found: ${workspacePath}` }, { status: 404 });
    }

    if (action === 'list') {
      const entries = await fs.readdir(workspacePath, { withFileTypes: true });
      const files = entries
        .filter(e => e.isFile())
        .map(e => e.name);
      const dirs = entries
        .filter(e => e.isDirectory())
        .map(e => e.name + '/');
      return NextResponse.json({ ok: true, files: [...dirs, ...files] });
    }

    if (action === 'read') {
      if (!filePath) return NextResponse.json({ ok: false, error: 'FilePath required' }, { status: 400 });
      const targetPath = path.join(workspacePath, filePath);
      if (!targetPath.startsWith(workspacePath)) {
        return NextResponse.json({ ok: false, error: 'Invalid path' }, { status: 403 });
      }
      try {
        const data = await fs.readFile(targetPath, 'utf-8');
        return NextResponse.json({ ok: true, content: data });
      } catch {
        return NextResponse.json({ ok: false, error: 'File not found' }, { status: 404 });
      }
    }

    if (action === 'write') {
      if (!filePath || content === undefined) return NextResponse.json({ ok: false, error: 'FilePath and content required' }, { status: 400 });
      const targetPath = path.join(workspacePath, filePath);
      if (!targetPath.startsWith(workspacePath)) {
        return NextResponse.json({ ok: false, error: 'Invalid path' }, { status: 403 });
      }
      await fs.writeFile(targetPath, content, 'utf-8');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
