export interface AgentFrontmatter {
  name: string;
  model: string;
  version: string;
  max_tokens: number;
  temperature: number;
}

export interface AgentTool {
  id: string;
  type: 'mcp' | 'skill' | 'cli';
  server?: string;
  skill_id?: string;
  commands?: string[];
  config?: Record<string, string>;
  enabled: boolean;
}

export interface AgentSchedule {
  id: string;
  cron: string;
  action: string;
  enabled: boolean;
}

export interface AgentConfigYaml {
  port?: number;
  tools: AgentTool[];
  schedules: AgentSchedule[];
}

export interface AgentConfig {
  id: string;
  frontmatter: AgentFrontmatter;
  systemPrompt: string;
  config: AgentConfigYaml;
  dirPath: string;
}

export type AgentRunStatus = 'running' | 'stopped' | 'error';

export interface AgentStatus {
  id: string;
  name: string;
  status: AgentRunStatus;
  pid?: number;
  port?: number;
  uptime?: number;
  startedAt?: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  model: string;
  version: string;
  status: AgentRunStatus;
  port?: number;
  schedulesCount: number;
  enabledSchedules: number;
  toolsCount: number;
  enabledTools: number;
}
