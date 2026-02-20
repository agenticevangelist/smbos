import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { AgentFrontmatter, AgentConfigYaml, AgentConfig } from './types';

const DEFAULT_FRONTMATTER: AgentFrontmatter = {
  name: 'Unnamed Agent',
  model: 'claude-sonnet-4-6',
  version: '1.0',
  max_tokens: 8192,
  temperature: 0.7,
};

export function parseAgentMd(filePath: string): { frontmatter: AgentFrontmatter; systemPrompt: string } {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);

  const frontmatter: AgentFrontmatter = {
    name: data.name || DEFAULT_FRONTMATTER.name,
    model: data.model || DEFAULT_FRONTMATTER.model,
    version: String(data.version ?? DEFAULT_FRONTMATTER.version),
    max_tokens: Number(data.max_tokens) || DEFAULT_FRONTMATTER.max_tokens,
    temperature: Number(data.temperature) ?? DEFAULT_FRONTMATTER.temperature,
  };

  return { frontmatter, systemPrompt: content.trim() };
}

export function parseConfigYaml(filePath: string): AgentConfigYaml {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = yaml.load(raw) as Record<string, any> | null;

  if (!data) {
    return { port: undefined, tools: [] };
  }

  return {
    port: data.port ? Number(data.port) : undefined,
    tools: Array.isArray(data.tools) ? data.tools.map((t: any) => ({
      id: t.id || '',
      type: t.type || 'skill',
      server: t.server,
      skill_id: t.skill_id,
      commands: t.commands,
      config: t.config,
      enabled: t.enabled !== false,
    })) : [],
  };
}

export function loadAgent(agentDir: string): AgentConfig {
  const id = path.basename(agentDir);

  const agentMdPath = path.join(agentDir, 'agent.md');
  if (!fs.existsSync(agentMdPath)) {
    throw new Error(`agent.md not found in ${agentDir}`);
  }
  const { frontmatter, systemPrompt } = parseAgentMd(agentMdPath);

  const configYamlPath = path.join(agentDir, 'config.yaml');
  const config = fs.existsSync(configYamlPath)
    ? parseConfigYaml(configYamlPath)
    : { port: undefined, tools: [] };

  return {
    id,
    frontmatter,
    systemPrompt,
    config,
    dirPath: agentDir,
  };
}
