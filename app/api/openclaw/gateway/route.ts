import { NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GATEWAY_PORT = 18789;

// GET /api/openclaw/gateway — check if gateway is running
export async function GET() {
  try {
    const { stdout } = await execAsync('openclaw health --json --timeout 3000', { timeout: 5000 });
    const data = JSON.parse(stdout);
    return NextResponse.json({ running: data.ok === true });
  } catch {
    return NextResponse.json({ running: false });
  }
}

// POST /api/openclaw/gateway — start or stop the gateway
export async function POST(req: Request) {
  try {
    const { action } = await req.json();

    if (action === 'start') {
      // Check if already running
      try {
        const { stdout } = await execAsync('openclaw health --json --timeout 2000', { timeout: 3000 });
        const data = JSON.parse(stdout);
        if (data.ok) {
          return NextResponse.json({ ok: true, message: 'Already running' });
        }
      } catch {
        // Not running, proceed to start
      }

      // Start gateway as a detached background process
      const child = spawn('openclaw', ['gateway', 'run'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });
      child.unref();

      // Wait for it to come up (poll health)
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const { stdout } = await execAsync('openclaw health --json --timeout 2000', { timeout: 3000 });
          const data = JSON.parse(stdout);
          if (data.ok) {
            return NextResponse.json({ ok: true });
          }
        } catch {
          // Not ready yet
        }
      }

      return NextResponse.json({ ok: false, error: 'Gateway did not start in time' }, { status: 500 });
    }

    if (action === 'stop') {
      // Find the gateway process by port and kill it
      try {
        const { stdout } = await execAsync(
          `lsof -t -i :${GATEWAY_PORT} -s TCP:LISTEN`,
          { timeout: 3000 }
        );
        const pids = stdout.trim().split('\n').filter(Boolean);
        if (pids.length === 0) {
          return NextResponse.json({ ok: true, message: 'Not running' });
        }

        for (const pid of pids) {
          process.kill(parseInt(pid, 10), 'SIGTERM');
        }

        // Wait for it to actually stop
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 500));
          try {
            const { stdout: check } = await execAsync(
              `lsof -t -i :${GATEWAY_PORT} -s TCP:LISTEN`,
              { timeout: 2000 }
            );
            if (!check.trim()) break;
          } catch {
            break; // lsof returns error when no process found = stopped
          }
        }

        return NextResponse.json({ ok: true });
      } catch (err: any) {
        // lsof exits non-zero when no process found
        if (err.code === 1 || err.status === 1) {
          return NextResponse.json({ ok: true, message: 'Not running' });
        }
        throw err;
      }
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
