import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const DEFAULT_PORT = 18789;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RPC_TIMEOUT_MS = 10000;

const OPENCLAW_CONFIG_PATH = path.join(
  process.env.HOME || '~',
  '.openclaw',
  'openclaw.json',
);

/** Read auth token and port from ~/.openclaw/openclaw.json */
function readConfigDefaults(): { port: number; token: string } {
  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8');
    const config = JSON.parse(raw);
    const gw = config?.gateway || {};
    return {
      port: gw.port || DEFAULT_PORT,
      token: gw.auth?.token || '',
    };
  } catch {
    return { port: DEFAULT_PORT, token: '' };
  }
}

export interface OpenClawConfig {
  port?: number;
  host?: string;
  token?: string;
}

interface WsFrame {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  ok?: boolean;
  payload?: unknown;
  error?: string;
  event?: string;
  seq?: number;
  stateVersion?: number;
}

type EventHandler = (payload: unknown) => void;

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let clientInstance: OpenClawClient | null = null;

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private port: number;
  private host: string;
  private token: string;
  private connected = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private destroyed = false;

  constructor(config: OpenClawConfig = {}) {
    const defaults = readConfigDefaults();
    this.port = config.port || defaults.port;
    this.host = config.host || '127.0.0.1';
    this.token = config.token || defaults.token;
  }

  get isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    return new Promise((resolve, reject) => {
      const url = `ws://${this.host}:${this.port}`;
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('Connection timeout'));
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempt = 0;
      });

      this.ws.on('message', (data) => {
        try {
          const frame: WsFrame = JSON.parse(data.toString());
          this.handleFrame(frame, resolve);
        } catch {
          // Ignore malformed frames
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.rejectAllPending('Connection closed');
        if (!this.destroyed) this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        if (!this.connected) {
          reject(err);
        }
      });
    });
  }

  private handleFrame(frame: WsFrame, connectResolve?: (value: void) => void): void {
    if (frame.type === 'event') {
      if (frame.event === 'connect.challenge') {
        // Respond to challenge with connect request
        this.sendRaw({
          type: 'req',
          id: randomUUID(),
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            auth: { token: this.token },
            device: { id: randomUUID(), name: 'smbos' },
          },
        });
      } else {
        // Broadcast event to handlers
        const handlers = this.eventHandlers.get(frame.event!);
        if (handlers) {
          for (const handler of handlers) {
            handler(frame.payload);
          }
        }
        // Also broadcast to wildcard handlers
        const wildcardHandlers = this.eventHandlers.get('*');
        if (wildcardHandlers) {
          for (const handler of wildcardHandlers) {
            handler({ event: frame.event, payload: frame.payload });
          }
        }
      }
    } else if (frame.type === 'res') {
      if (frame.id) {
        const pending = this.pendingRequests.get(frame.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(frame.id);
          if (frame.ok) {
            pending.resolve(frame.payload);
          } else {
            pending.reject(new Error(frame.error || 'RPC error'));
          }
        }
        // Check if this is the connect response
        if (frame.ok && connectResolve) {
          this.connected = true;
          connectResolve();
        }
      }
    }
  }

  private sendRaw(frame: WsFrame): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  async call<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs = RPC_TIMEOUT_MS): Promise<T> {
    if (!this.isConnected) {
      await this.connect();
    }

    const id = randomUUID();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.sendRaw({
        type: 'req',
        id,
        method,
        params: params || {},
      });
    });
  }

  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) this.eventHandlers.delete(event);
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
  }

  private rejectAllPending(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending('Client destroyed');
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  // --- High-level RPC methods ---

  async getStatus(): Promise<GatewayStatus> {
    return this.call<GatewayStatus>('status');
  }

  async listSessions(params?: { activeMinutes?: number; limit?: number }): Promise<SessionListResult> {
    return this.call<SessionListResult>('sessions.list', params);
  }

  async getSessionHistory(sessionKey: string, limit = 200): Promise<SessionHistoryResult> {
    return this.call<SessionHistoryResult>('sessions.history', { sessionKey, limit });
  }

  async sendSessionMessage(sessionKey: string, message: string): Promise<unknown> {
    return this.call('sessions.send', { sessionKey, message });
  }

  async listCronJobs(): Promise<CronListResult> {
    return this.call<CronListResult>('cron.list');
  }

  async addCronJob(job: CronJobInput): Promise<CronJob> {
    return this.call<CronJob>('cron.add', job as unknown as Record<string, unknown>);
  }

  async removeCronJob(jobId: string): Promise<void> {
    await this.call('cron.remove', { id: jobId });
  }

  async runCronJob(jobId: string): Promise<void> {
    await this.call('cron.run', { id: jobId });
  }

  async getCronRuns(jobId: string, limit = 50): Promise<CronRunsResult> {
    return this.call<CronRunsResult>('cron.runs', { id: jobId, limit });
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return this.call<Record<string, unknown>>('config.get');
  }

  async patchConfig(patch: Record<string, unknown>): Promise<void> {
    await this.call('config.patch', { patch });
  }

  async applyConfig(): Promise<void> {
    await this.call('config.apply');
  }

  async restartGateway(delayMs = 0): Promise<void> {
    await this.call('gateway.restart', { delayMs });
  }
}

// --- Types ---

export interface GatewayStatus {
  version?: string;
  uptime?: number;
  agents?: Array<{ id: string; name?: string; model?: string }>;
  sessions?: number;
  channels?: Record<string, { connected: boolean }>;
  cron?: { enabled: boolean; activeJobs: number };
}

export interface SessionListResult {
  sessions: Array<{
    key: string;
    agentId: string;
    lastActivity: string;
    messageCount: number;
  }>;
}

export interface SessionHistoryResult {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    toolUse?: boolean;
  }>;
}

export interface CronJob {
  id: string;
  name?: string;
  kind: 'at' | 'every' | 'cron';
  schedule: string;
  sessionTarget: 'main' | 'isolated';
  enabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  agentId?: string;
  message?: string;
}

export interface CronJobInput {
  name?: string;
  kind: 'at' | 'every' | 'cron';
  schedule: string;
  sessionTarget?: 'main' | 'isolated';
  message: string;
  agentId?: string;
  delivery?: 'announce' | 'webhook' | 'none';
}

export interface CronRunsResult {
  runs: Array<{
    id: string;
    jobId: string;
    startedAt: string;
    finishedAt?: string;
    durationMs?: number;
    status: 'success' | 'error' | 'running';
    error?: string;
  }>;
}

export interface CronListResult {
  jobs: CronJob[];
}

// --- Singleton accessor ---

export function getOpenClawClient(config?: OpenClawConfig): OpenClawClient {
  if (!clientInstance) {
    clientInstance = new OpenClawClient(config);
  }
  return clientInstance;
}

export function destroyOpenClawClient(): void {
  if (clientInstance) {
    clientInstance.destroy();
    clientInstance = null;
  }
}

// --- Utility: check if gateway is reachable without full connection ---

export async function isGatewayReachable(port = DEFAULT_PORT): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const timeout = setTimeout(() => {
      ws.close();
      resolve(false);
    }, 3000);

    ws.on('open', () => {
      clearTimeout(timeout);
      ws.close();
      resolve(true);
    });

    ws.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}
