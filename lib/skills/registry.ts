import fs from 'fs';
import path from 'path';

export interface SkillInput {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date' | 'toggle' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  default?: any;
  helperText?: string;
  options?: Array<{ value: string; text: string }>;
  source?: string;
  sourceValueKey?: string;
  sourceTextKey?: string;
}

export interface SkillOutputConfig {
  type: 'table' | 'cards' | 'list' | 'accordion' | 'json';
  rootPath?: string;
  columns?: Array<{ key: string; header: string; type?: string; tagType?: string }> | 'auto';
  card?: { titleKey: string; descriptionKey: string; metaKey?: string; tagKey?: string };
  list?: { titleKey: string; descriptionKey: string };
}

export interface SkillRegistryEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  hidden: boolean;
  inputs: SkillInput[];
  outputs: SkillOutputConfig;
  filters?: Array<{ id: string; label: string; type: string; field?: string; options?: Array<{ value: string; text: string }> }>;
  api: { url: string; method: string; bodyMapping: Record<string, string> };
  agentDescription: string;
  keywords: string[];
  layout?: 'simple' | 'tabs' | 'sections';
  tabs?: Array<{ id: string; label: string; inputs: string[] }>;
  sections?: Array<{ id: string; title: string; inputs: string[] }>;
}

function resolveSkillsDir(): string {
  const cwd = process.cwd();
  let skillsDir = path.join(cwd, 'skills');
  if (!fs.existsSync(skillsDir)) {
    skillsDir = path.join(cwd, 'smbos', 'skills');
  }
  return skillsDir;
}

function readConfig(skillsDir: string): { overrides: Record<string, any> } {
  const configPath = path.join(skillsDir, '.config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return { overrides: {} };
}

function parseSkillMdFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '' };

  const yaml = match[1];
  const result: Record<string, string> = {};
  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    result[key] = value;
  }
  return { name: result.name || '', description: result.description || '' };
}

function generateKeywords(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase();
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'use']);
  const words = text.replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  return [...new Set(words)];
}

export async function getAllSkills(): Promise<SkillRegistryEntry[]> {
  const skillsDir = resolveSkillsDir();
  if (!fs.existsSync(skillsDir)) return [];

  const configData = readConfig(skillsDir);

  const dirs = fs.readdirSync(skillsDir).filter(f => {
    if (f.startsWith('_') || f.startsWith('.')) return false;
    const fullPath = path.join(skillsDir, f);
    return fs.statSync(fullPath).isDirectory() &&
      (fs.existsSync(path.join(fullPath, 'ui.json')) || fs.existsSync(path.join(fullPath, 'SKILL.md')));
  });

  return dirs.map(id => {
    const skillPath = path.join(skillsDir, id);
    const overrides = configData.overrides[id] || {};

    // Read ui.json
    let uiConfig: any = {};
    const uiJsonPath = path.join(skillPath, 'ui.json');
    if (fs.existsSync(uiJsonPath)) {
      uiConfig = JSON.parse(fs.readFileSync(uiJsonPath, 'utf8'));
    }

    // Read SKILL.md frontmatter
    let mdMeta = { name: '', description: '' };
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (fs.existsSync(skillMdPath)) {
      mdMeta = parseSkillMdFrontmatter(fs.readFileSync(skillMdPath, 'utf8'));
    }

    const name = overrides.name || uiConfig.name || mdMeta.name || id.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const description = overrides.description || uiConfig.description || mdMeta.description || '';

    return {
      id,
      name,
      description,
      icon: overrides.icon || uiConfig.icon || 'Activity',
      hidden: overrides.hidden || false,
      inputs: uiConfig.inputs || [],
      outputs: uiConfig.outputs || { type: 'json' },
      filters: uiConfig.filters,
      api: uiConfig.api || { url: `/api/skills/${id}/execute`, method: 'POST', bodyMapping: {} },
      agentDescription: mdMeta.description || description,
      keywords: generateKeywords(name, mdMeta.description || description),
      layout: uiConfig.layout,
      tabs: uiConfig.tabs,
      sections: uiConfig.sections,
    };
  });
}

export async function getSkill(id: string): Promise<SkillRegistryEntry | null> {
  const skills = await getAllSkills();
  return skills.find(s => s.id === id) || null;
}

export async function executeSkill(id: string, params: Record<string, any>): Promise<any> {
  const cwd = process.cwd();
  const possiblePaths = [
    `@/skills/${id}/scripts/execute`,
    `@/skills/${id}/tool`,
  ];

  const fsPaths = [
    path.join(cwd, 'skills', id, 'scripts', 'execute.ts'),
    path.join(cwd, 'skills', id, 'tool.ts'),
    path.join(cwd, 'skills', id, 'scripts', 'execute.js'),
    path.join(cwd, 'skills', id, 'tool.js'),
  ];

  let importPath = '';
  for (let i = 0; i < fsPaths.length; i++) {
    if (fs.existsSync(fsPaths[i])) {
      importPath = possiblePaths[i % 2];
      break;
    }
  }

  if (!importPath) {
    throw new Error(`Execution script not found for skill: ${id}`);
  }

  // Use indirect import to prevent Turbopack static analysis
  const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
  const toolModule = await load(importPath);
  if (!toolModule?.execute) {
    throw new Error(`Execute function not found in tool for skill: ${id}`);
  }

  return toolModule.execute(params);
}
