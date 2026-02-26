import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadAgent } from './config';
import { logEvent } from './logger';
import { getOpenClawClient, isGatewayReachable } from './openclaw-client';
import type { AgentRunStatus } from './types';

const OPENCLAW_PORT = 18789;
const OPENCLAW_CONFIG_PATH = path.join(
  process.env.HOME || '~',
  '.openclaw',
  'openclaw.json',
);

const AGENTS_DIR = path.join(process.cwd(), 'agents');

// Gateway process state
let gatewayProcess: ChildProcess | null = null;
let gatewayPid: number | null = null;
let gatewayStartedAt: string | null = null;

// Track which agents are "enabled" (have bindings in openclaw.json)
const enabledAgents = new Set<string>();

// Buffer last ~4KB of stderr/stdout for debugging
const MAX_LOG_SIZE = 4096;
const processLogs = { stderr: '', stdout: '' };

function appendLog(stream: 'stderr' | 'stdout', chunk: string): void {
  processLogs[stream] += chunk;
  if (processLogs[stream].length > MAX_LOG_SIZE) {
    processLogs[stream] = processLogs[stream].slice(-MAX_LOG_SIZE);
  }
}

export function getProcessLogs(): { stderr: string; stdout: string } {
  return { ...processLogs };
}

// --- OpenClaw Config Management ---

function readOpenClawConfig(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeOpenClawConfig(config: Record<string, unknown>): void {
  const dir = path.dirname(OPENCLAW_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function ensureAgentInConfig(agentId: string, agentConfig: ReturnType<typeof loadAgent>): void {
  const config = readOpenClawConfig();

  // Ensure agents section exists
  if (!config.agents) config.agents = {};
  const agents = config.agents as Record<string, unknown>;
  if (!agents.list) agents.list = [];
  const list = agents.list as Array<Record<string, unknown>>;

  // Find or create agent entry
  const existing = list.find((a) => a.id === agentId);
  const agentEntry: Record<string, unknown> = existing || { id: agentId };

  agentEntry.name = agentConfig.frontmatter.name;
  agentEntry.model = agentConfig.frontmatter.model;
  agentEntry.workspace = agentConfig.dirPath;

  if (!existing) list.push(agentEntry);

  // Write identity file to agent workspace
  const identityPath = path.join(agentConfig.dirPath, 'IDENTITY.md');
  fs.writeFileSync(identityPath, agentConfig.systemPrompt, 'utf8');

  // Ensure bindings section exists
  if (!config.bindings) config.bindings = [];
  const bindings = config.bindings as Array<Record<string, unknown>>;

  // Add web-chat binding for this agent
  const bindingExists = bindings.some(
    (b) => b.agentId === agentId && (b.match as Record<string, unknown>)?.channel === 'web',
  );
  if (!bindingExists) {
    bindings.push({
      agentId,
      match: { channel: 'web' },
    });
  }

  writeOpenClawConfig(config);
}

function removeAgentBinding(agentId: string): void {
  const config = readOpenClawConfig();
  if (!config.bindings) return;

  const bindings = config.bindings as Array<Record<string, unknown>>;
  config.bindings = bindings.filter((b) => b.agentId !== agentId);

  writeOpenClawConfig(config);
}

// --- Gateway Lifecycle ---

export async function startGateway(): Promise<{ pid: number; port: number }> {
  // Check if already running
  if (gatewayProcess && gatewayPid) {
    try {
      process.kill(gatewayPid, 0);
      return { pid: gatewayPid, port: OPENCLAW_PORT };
    } catch {
      // Process died, clean up
      gatewayProcess = null;
      gatewayPid = null;
    }
  }

  // Check if an external gateway is already running
  const reachable = await isGatewayReachable(OPENCLAW_PORT);
  if (reachable) {
    gatewayStartedAt = new Date().toISOString();
    logEvent('gateway', 'gateway:adopt', { port: OPENCLAW_PORT });
    return { pid: 0, port: OPENCLAW_PORT };
  }

  // Spawn openclaw gateway
  const child = spawn('openclaw', ['gateway', 'run', '--port', String(OPENCLAW_PORT)], {
    stdio: 'pipe',
    detached: true,
    env: { ...process.env },
  });

  if (!child.pid) {
    throw new Error('Failed to start OpenClaw gateway');
  }

  processLogs.stderr = '';
  processLogs.stdout = '';

  child.stderr?.on('data', (data: Buffer) => {
    appendLog('stderr', data.toString());
  });

  child.stdout?.on('data', (data: Buffer) => {
    appendLog('stdout', data.toString());
  });

  child.unref();

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      logEvent('gateway', 'gateway:error', {
        reason: `Gateway exited with code ${code}`,
        stderr: processLogs.stderr.slice(-1000),
      });
    }
    gatewayProcess = null;
    gatewayPid = null;
    gatewayStartedAt = null;
    enabledAgents.clear();
  });

  gatewayProcess = child;
  gatewayPid = child.pid;
  gatewayStartedAt = new Date().toISOString();

  logEvent('gateway', 'gateway:start', { pid: child.pid, port: OPENCLAW_PORT });

  return { pid: child.pid, port: OPENCLAW_PORT };
}

export function stopGateway(): boolean {
  if (gatewayPid) {
    try {
      process.kill(gatewayPid, 'SIGTERM');
    } catch {
      // Already dead
    }
    logEvent('gateway', 'gateway:stop', { pid: gatewayPid });
    gatewayProcess = null;
    gatewayPid = null;
    gatewayStartedAt = null;
    enabledAgents.clear();
    return true;
  }
  return false;
}

export async function getGatewayStatus(): Promise<{
  running: boolean;
  pid?: number;
  port: number;
  uptime?: number;
  startedAt?: string;
}> {
  const reachable = await isGatewayReachable(OPENCLAW_PORT);

  if (reachable) {
    return {
      running: true,
      pid: gatewayPid || undefined,
      port: OPENCLAW_PORT,
      uptime: gatewayStartedAt
        ? Math.floor((Date.now() - new Date(gatewayStartedAt).getTime()) / 1000)
        : undefined,
      startedAt: gatewayStartedAt || undefined,
    };
  }

  return { running: false, port: OPENCLAW_PORT };
}

// --- Agent Management (via OpenClaw config) ---

export async function startAgent(agentId: string): Promise<{ port: number }> {
  const agentDir = path.join(AGENTS_DIR, agentId);
  const agent = loadAgent(agentDir);

  // Ensure gateway is running
  await startGateway();

  // Add agent to openclaw.json with binding
  ensureAgentInConfig(agentId, agent);
  enabledAgents.add(agentId);

  // Hot-reload config if gateway is connected
  try {
    const client = getOpenClawClient({ port: OPENCLAW_PORT });
    if (client.isConnected) {
      await client.applyConfig();
    }
  } catch {
    // Gateway might not be fully ready yet
  }

  logEvent(agentId, 'agent:start', { port: OPENCLAW_PORT });
  return { port: OPENCLAW_PORT };
}

export function stopAgent(agentId: string): boolean {
  // Remove binding (agent still defined, just not routed)
  removeAgentBinding(agentId);
  enabledAgents.delete(agentId);
  logEvent(agentId, 'agent:stop', {});

  // Try to hot-reload
  try {
    const client = getOpenClawClient({ port: OPENCLAW_PORT });
    if (client.isConnected) {
      client.applyConfig().catch(() => {});
    }
  } catch {
    // Best effort
  }

  return true;
}

export function getAgentStatus(agentId: string): {
  status: AgentRunStatus;
  port?: number;
  uptime?: number;
  startedAt?: string;
} {
  if (enabledAgents.has(agentId)) {
    return {
      status: 'running',
      port: OPENCLAW_PORT,
      uptime: gatewayStartedAt
        ? Math.floor((Date.now() - new Date(gatewayStartedAt).getTime()) / 1000)
        : undefined,
      startedAt: gatewayStartedAt || undefined,
    };
  }

  // Check openclaw.json for existing bindings
  try {
    const config = readOpenClawConfig();
    const bindings = (config.bindings || []) as Array<Record<string, unknown>>;
    const hasBinding = bindings.some((b) => b.agentId === agentId);
    if (hasBinding) {
      enabledAgents.add(agentId);
      return {
        status: 'running',
        port: OPENCLAW_PORT,
        startedAt: gatewayStartedAt || undefined,
      };
    }
  } catch {
    // Config unreadable
  }

  return { status: 'stopped' };
}

export async function restartAgent(agentId: string): Promise<{ port: number }> {
  stopAgent(agentId);
  await new Promise((resolve) => setTimeout(resolve, 300));
  return startAgent(agentId);
}

export function getRunningAgents(): Array<{ id: string; port: number; startedAt: string }> {
  const result: Array<{ id: string; port: number; startedAt: string }> = [];
  for (const id of enabledAgents) {
    result.push({
      id,
      port: OPENCLAW_PORT,
      startedAt: gatewayStartedAt || new Date().toISOString(),
    });
  }
  return result;
}

export function getProcessInfo(_agentId: string): { pid: number; port: number; startedAt: string } | null {
  if (!gatewayPid && !enabledAgents.size) return null;
  return {
    pid: gatewayPid || 0,
    port: OPENCLAW_PORT,
    startedAt: gatewayStartedAt || new Date().toISOString(),
  };
}
