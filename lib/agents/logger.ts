import fs from 'fs';
import path from 'path';

export type LogEventType =
  | 'agent:start'
  | 'agent:stop'
  | 'agent:error'
  | 'process:stderr'
  | 'process:stdout'
  | 'cron:trigger'
  | 'cron:success'
  | 'cron:error'
  | 'chat:message'
  | 'chat:response';

export interface LogEntry {
  timestamp: string;
  type: LogEventType;
  agentId: string;
  data?: Record<string, unknown>;
}

const LOGS_DIR = path.join(process.cwd(), 'data', 'logs');

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function getLogPath(agentId: string): string {
  return path.join(LOGS_DIR, `${agentId}.jsonl`);
}

export function logEvent(agentId: string, type: LogEventType, data?: Record<string, unknown>): void {
  ensureLogsDir();

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    type,
    agentId,
    ...(data && { data }),
  };

  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(getLogPath(agentId), line, 'utf8');
}

export interface GetLogsOptions {
  limit?: number;
  type?: LogEventType;
  since?: string; // ISO timestamp
}

export function getLogs(agentId: string, options: GetLogsOptions = {}): LogEntry[] {
  const logPath = getLogPath(agentId);
  if (!fs.existsSync(logPath)) return [];

  const raw = fs.readFileSync(logPath, 'utf8');
  const lines = raw.trim().split('\n').filter(Boolean);

  let entries: LogEntry[] = lines.map(line => {
    try { return JSON.parse(line); }
    catch { return null; }
  }).filter(Boolean);

  if (options.type) {
    entries = entries.filter(e => e.type === options.type);
  }

  if (options.since) {
    entries = entries.filter(e => e.timestamp >= options.since!);
  }

  // Return newest first, limited
  entries.reverse();
  if (options.limit) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

export function clearLogs(agentId: string): void {
  const logPath = getLogPath(agentId);
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
}
