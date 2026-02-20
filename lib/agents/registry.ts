import fs from 'fs';
import path from 'path';
import { loadAgent } from './config';
import type { AgentConfig, AgentSummary } from './types';
import { getAgentStatus } from './lifecycle';

function resolveAgentsDir(): string {
  const cwd = process.cwd();
  let agentsDir = path.join(cwd, 'agents');
  if (!fs.existsSync(agentsDir)) {
    agentsDir = path.join(cwd, 'smbos', 'agents');
  }
  return agentsDir;
}

export function getAllAgentConfigs(): AgentConfig[] {
  const agentsDir = resolveAgentsDir();
  if (!fs.existsSync(agentsDir)) return [];

  const dirs = fs.readdirSync(agentsDir).filter(f => {
    if (f.startsWith('.') || f.startsWith('_')) return false;
    const fullPath = path.join(agentsDir, f);
    return fs.statSync(fullPath).isDirectory() &&
      fs.existsSync(path.join(fullPath, 'agent.md'));
  });

  return dirs.map(id => loadAgent(path.join(agentsDir, id)));
}

export function getAgentConfig(id: string): AgentConfig | null {
  const agentsDir = resolveAgentsDir();
  const agentDir = path.join(agentsDir, id);
  if (!fs.existsSync(path.join(agentDir, 'agent.md'))) return null;
  return loadAgent(agentDir);
}

export function getAllAgents(): AgentSummary[] {
  const configs = getAllAgentConfigs();
  return configs.map(agent => {
    const status = getAgentStatus(agent.id);
    return {
      id: agent.id,
      name: agent.frontmatter.name,
      model: agent.frontmatter.model,
      version: agent.frontmatter.version,
      status: status.status,
      port: status.port ?? agent.config.port,
      toolsCount: agent.config.tools.length,
      enabledTools: agent.config.tools.filter(t => t.enabled).length,
    };
  });
}

export function getAgentsDir(): string {
  return resolveAgentsDir();
}
