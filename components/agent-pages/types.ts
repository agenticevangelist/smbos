export type RpcFn = <T = any>(method: string, params?: object) => Promise<T>;

export interface AgentEntry {
  id: string;
  name?: string;
  default?: boolean;
  workspace?: string;
  model?: string | { primary?: string };
  identity?: {
    name?: string;
    emoji?: string;
    theme?: string;
    avatar?: string;
  };
}

export interface Binding {
  agentId: string;
  match: {
    channel?: string;
    accountId?: string;
    peer?: { kind: string; id: string };
  };
}

export interface ModelEntry {
  id: string;
  name: string;
  provider: string;
}

export interface AgentPageProps {
  rpc: RpcFn;
  connected: boolean;
  agentId: string;
  isNew?: boolean;
  projectId?: string;
  onAgentChange?: () => void;
  onNavigate?: (path: string) => void;
}
