import { getRunningAgents } from './lifecycle';

interface ProxyOptions<T> {
  endpoint: string;
  fallback: T;
  agentId?: string;
  timeoutMs?: number;
}

function pickAgent(agentId?: string): { id: string; port: number } | null {
  const runningAgents = getRunningAgents();
  if (runningAgents.length === 0) return null;

  if (agentId) {
    const match = runningAgents.find((agent) => agent.id === agentId);
    return match ? { id: match.id, port: match.port } : null;
  }

  const primary = runningAgents[0];
  return { id: primary.id, port: primary.port };
}

/**
 * Proxy a JSON request to a running NanoClaw instance.
 * Returns fallback on missing agent, network timeout, or non-2xx status.
 */
export async function proxyNanoClawJson<T>({
  endpoint,
  fallback,
  agentId,
  timeoutMs = 5000,
}: ProxyOptions<T>): Promise<T> {
  const targetAgent = pickAgent(agentId);
  if (!targetAgent) return fallback;

  try {
    const res = await fetch(`http://127.0.0.1:${targetAgent.port}${endpoint}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}
