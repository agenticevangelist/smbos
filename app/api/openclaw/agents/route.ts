import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// POST /api/openclaw/agents — workspace operations via CLI
export async function POST(req: Request) {
  try {
    const { action, id } = await req.json();

    if (!id || typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid agent id (lowercase alphanumeric + hyphens only)' }, { status: 400 });
    }

    if (action === 'add') {
      const { stdout, stderr } = await execAsync(`openclaw agents add ${id}`, { timeout: 15000 });
      return NextResponse.json({ ok: true, output: stdout || stderr });
    }

    if (action === 'delete') {
      const { stdout, stderr } = await execAsync(`openclaw agents delete ${id} --yes`, { timeout: 15000 });
      return NextResponse.json({ ok: true, output: stdout || stderr });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
