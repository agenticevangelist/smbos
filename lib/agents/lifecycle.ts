import { ChildProcess, execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadAgent } from './config';
import { logEvent } from './logger';
import type { AgentRunStatus } from './types';

interface RunningAgent {
  pid: number;
  port: number;
  process: ChildProcess | null; // null for recovered orphan processes
  startedAt: string;
}

// In-memory store of running agent processes
const runningAgents = new Map<string, RunningAgent>();

// Buffer last ~4KB of stderr/stdout per agent for debugging
const MAX_LOG_SIZE = 4096;
const processLogs = new Map<string, { stderr: string; stdout: string }>();

function appendProcessLog(agentId: string, stream: 'stderr' | 'stdout', chunk: string): void {
  let entry = processLogs.get(agentId);
  if (!entry) {
    entry = { stderr: '', stdout: '' };
    processLogs.set(agentId, entry);
  }
  entry[stream] += chunk;
  if (entry[stream].length > MAX_LOG_SIZE) {
    entry[stream] = entry[stream].slice(-MAX_LOG_SIZE);
  }
}

export function getProcessLogs(agentId: string): { stderr: string; stdout: string } | null {
  return processLogs.get(agentId) || null;
}

const NANOCLAW_DIR = path.join(process.cwd(), 'nanoclaw');
const AGENTS_DIR = path.join(process.cwd(), 'agents');

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function writeEnvFile(filePath: string, values: Record<string, string>): void {
  const lines = Object.entries(values)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

/** Find the PID listening on a given port, or null */
function findPidOnPort(port: number): number | null {
  try {
    const lsofBin = fs.existsSync('/usr/sbin/lsof') ? '/usr/sbin/lsof' : 'lsof';
    const out = execSync(`${lsofBin} -ti :${port}`, { encoding: 'utf-8', timeout: 3000 });
    const pid = parseInt(out.trim().split('\n')[0], 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/** Kill a process by PID (best-effort) */
function killProcess(pid: number): void {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // already dead
  }
}

export function getProcessInfo(agentId: string): { pid: number; port: number; startedAt: string } | null {
  const entry = runningAgents.get(agentId);
  if (!entry) return null;

  // Verify process is still alive
  try {
    process.kill(entry.pid, 0);
    return { pid: entry.pid, port: entry.port, startedAt: entry.startedAt };
  } catch {
    // Process died — clean up
    runningAgents.delete(agentId);
    return null;
  }
}

export function getAgentStatus(agentId: string): { status: AgentRunStatus; pid?: number; port?: number; uptime?: number; startedAt?: string } {
  const info = getProcessInfo(agentId);
  if (info) {
    const uptime = Math.floor((Date.now() - new Date(info.startedAt).getTime()) / 1000);
    return { status: 'running', pid: info.pid, port: info.port, uptime, startedAt: info.startedAt };
  }

  // Orphan recovery: check if NanoClaw is running on the expected port but not in our Map
  const agentDir = path.join(AGENTS_DIR, agentId);
  try {
    const agent = loadAgent(agentDir);
    const port = agent.config.port || 3100;
    const orphanPid = findPidOnPort(port);
    if (orphanPid) {
      // Adopt the orphan process
      runningAgents.set(agentId, {
        pid: orphanPid,
        port,
        process: null,
        startedAt: new Date().toISOString(),
      });
      return { status: 'running', pid: orphanPid, port };
    }
  } catch {
    // Agent dir doesn't exist or can't be loaded — just return stopped
  }

  return { status: 'stopped' };
}

/**
 * Prepare NanoClaw for an agent.
 * Writes the system prompt to NanoClaw's groups/web-chat/CLAUDE.md.
 * Copies the agent's .env into NanoClaw dir if it exists, otherwise
 * NanoClaw uses its own .env (which has the auth token).
 * NanoClaw runs from its own directory so all relative paths
 * (container/, groups/, store/, data/) resolve correctly.
 */
function prepareRuntime(agentDir: string, systemPrompt: string): void {
  const groupDir = path.join(NANOCLAW_DIR, 'groups', 'web-chat');
  fs.mkdirSync(groupDir, { recursive: true });

  // Write system prompt for NanoClaw's web-chat group
  fs.writeFileSync(path.join(groupDir, 'CLAUDE.md'), systemPrompt, 'utf8');

  // If agent has its own .env, merge it into NanoClaw's .env without
  // dropping runtime keys (e.g. TELEGRAM_BOT_TOKEN) that may exist only
  // in the base NanoClaw environment.
  const agentEnv = path.join(agentDir, '.env');
  if (fs.existsSync(agentEnv)) {
    const nanoclawEnv = path.join(NANOCLAW_DIR, '.env');
    const baseEnv = parseEnvFile(nanoclawEnv);
    const agentValues = parseEnvFile(agentEnv);
    const merged = { ...baseEnv, ...agentValues };
    writeEnvFile(nanoclawEnv, merged);
  }
}

export async function startAgent(agentId: string, force = false): Promise<{ pid: number; port: number }> {
  // Check if already running in our Map
  const existing = getProcessInfo(agentId);
  if (existing && !force) {
    throw new Error(`Agent ${agentId} is already running (PID ${existing.pid}, port ${existing.port})`);
  }

  // Load agent config from filesystem
  const agentDir = path.join(AGENTS_DIR, agentId);
  const agent = loadAgent(agentDir);
  const port = agent.config.port || 3100;

  // Kill existing process if force mode or orphan on port
  if (existing && force) {
    killProcess(existing.pid);
    runningAgents.delete(agentId);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Check for orphan process on the port
  const orphanPid = findPidOnPort(port);
  if (orphanPid) {
    if (force) {
      killProcess(orphanPid);
      // Wait for port to free up
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      throw new Error(`Port ${port} is already in use by PID ${orphanPid}. Use force restart to kill it.`);
    }
  }

  // Verify NanoClaw binary exists
  const binaryPath = NANOCLAW_DIR + '/dist/index.js';
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`NanoClaw binary not found at ${binaryPath}. Run: cd nanoclaw && npm run build`);
  }

  // Prepare NanoClaw runtime (writes CLAUDE.md, copies .env)
  prepareRuntime(agentDir, agent.systemPrompt);
  const nanoclawEnv = parseEnvFile(path.join(NANOCLAW_DIR, '.env'));

  // Wrap spawn in new Function to prevent Turbopack from tracing the file path as a module
  const spawnChild = new Function('s', 'a', 'o', 'return s(...a, o)') as (...args: any[]) => ChildProcess;
  const child = spawnChild(spawn, ['node', [binaryPath]], {
    cwd: NANOCLAW_DIR,
    stdio: 'pipe',
    detached: true,
    env: {
      ...process.env,
      HTTP_PORT: String(port),
      ASSISTANT_NAME: agent.frontmatter.name,
      ...(process.env.TZ || nanoclawEnv.TZ
        ? { TZ: process.env.TZ || nanoclawEnv.TZ }
        : {}),
    },
  });

  if (!child.pid) {
    throw new Error(`Failed to start agent ${agentId}`);
  }

  // Initialize process log buffer
  processLogs.set(agentId, { stderr: '', stdout: '' });

  // Capture stderr/stdout for debugging
  child.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    appendProcessLog(agentId, 'stderr', text);
    logEvent(agentId, 'process:stderr', { text: text.slice(0, 500) });
  });

  child.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    appendProcessLog(agentId, 'stdout', text);
    logEvent(agentId, 'process:stdout', { text: text.slice(0, 500) });
  });

  child.unref();

  // Clean up on exit
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      const logs = processLogs.get(agentId);
      const stderrSnippet = logs?.stderr ? logs.stderr.slice(-1000) : undefined;
      logEvent(agentId, 'agent:error', {
        reason: `Process exited with code ${code}`,
        ...(stderrSnippet && { stderr: stderrSnippet }),
      });
    }
    runningAgents.delete(agentId);
  });

  const entry: RunningAgent = {
    pid: child.pid,
    port,
    process: child,
    startedAt: new Date().toISOString(),
  };
  runningAgents.set(agentId, entry);

  logEvent(agentId, 'agent:start', { pid: child.pid, port });

  return { pid: child.pid, port };
}

export function stopAgent(agentId: string): boolean {
  const entry = runningAgents.get(agentId);
  if (!entry) return false;

  killProcess(entry.pid);
  logEvent(agentId, 'agent:stop', { pid: entry.pid });
  runningAgents.delete(agentId);
  return true;
}

export async function restartAgent(agentId: string): Promise<{ pid: number; port: number }> {
  stopAgent(agentId);
  await new Promise(resolve => setTimeout(resolve, 500));
  return startAgent(agentId, true);
}

export function getRunningAgents(): Array<{ id: string; pid: number; port: number; startedAt: string }> {
  const result: Array<{ id: string; pid: number; port: number; startedAt: string }> = [];
  for (const [id, entry] of runningAgents) {
    // Verify still alive
    try {
      process.kill(entry.pid, 0);
      result.push({ id, pid: entry.pid, port: entry.port, startedAt: entry.startedAt });
    } catch {
      runningAgents.delete(id);
    }
  }
  return result;
}
