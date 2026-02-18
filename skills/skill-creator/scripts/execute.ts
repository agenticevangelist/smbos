import path from 'path';
import fs from 'fs';

export async function execute(params: any) {
  const { skillId, name, description, inputsJson, outputType = 'json' } = params;

  if (!skillId) throw new Error('Skill ID is required');
  if (!name) throw new Error('Display name is required');
  if (!description) throw new Error('Description is required');

  // Validate skill ID format
  if (!/^[a-z][a-z0-9-]*$/.test(skillId)) {
    throw new Error('Skill ID must start with a letter and contain only lowercase letters, numbers, and hyphens');
  }

  const skillsDir = path.join(process.cwd(), 'skills');
  const skillPath = path.join(skillsDir, skillId);

  if (fs.existsSync(skillPath)) {
    throw new Error(`Skill "${skillId}" already exists`);
  }

  // Parse inputs
  let inputs: any[] = [];
  if (inputsJson) {
    try {
      inputs = typeof inputsJson === 'string' ? JSON.parse(inputsJson) : inputsJson;
      if (!Array.isArray(inputs)) throw new Error('Inputs must be an array');
    } catch (e: any) {
      if (e.message === 'Inputs must be an array') throw e;
      throw new Error('Invalid inputs JSON: ' + e.message);
    }
  }

  // Create directory structure
  fs.mkdirSync(path.join(skillPath, 'scripts'), { recursive: true });

  // Generate SKILL.md
  const skillMd = `---
name: ${skillId}
description: ${description}
---

# ${name}

${description}

## Usage

Provide the required inputs and execute the skill.
`;

  // Generate ui.json
  const bodyMapping: Record<string, string> = {};
  inputs.forEach((input: any) => {
    bodyMapping[input.id] = `{{${input.id}}}`;
  });

  const uiJson = {
    id: skillId,
    name,
    description,
    icon: 'Activity',
    inputs: inputs.length > 0 ? inputs : [
      { id: 'input', label: 'Input', type: 'text', placeholder: 'Enter input...', required: true },
    ],
    api: {
      url: `/api/skills/${skillId}/execute`,
      method: 'POST',
      bodyMapping: Object.keys(bodyMapping).length > 0 ? bodyMapping : { input: '{{input}}' },
    },
    outputs: {
      type: outputType,
      ...(outputType === 'table' ? { rootPath: 'rows', columns: 'auto' } : {}),
    },
  };

  // Generate stub execute.ts
  const inputParams = inputs.length > 0
    ? inputs.map((i: any) => `  const ${i.id} = params.${i.id};`).join('\n')
    : '  const input = params.input;';

  const executeTs = `export async function execute(params: any) {
${inputParams}

  // TODO: Implement your skill logic here
  console.log('[${name}] Executing with params:', params);

  return {
    message: '${name} executed successfully',
    params,
    timestamp: new Date().toISOString(),
  };
}
`;

  // Write all files
  const files: string[] = [];

  fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillMd);
  files.push(`skills/${skillId}/SKILL.md`);

  fs.writeFileSync(path.join(skillPath, 'ui.json'), JSON.stringify(uiJson, null, 2));
  files.push(`skills/${skillId}/ui.json`);

  fs.writeFileSync(path.join(skillPath, 'scripts', 'execute.ts'), executeTs);
  files.push(`skills/${skillId}/scripts/execute.ts`);

  return {
    success: true,
    skillId,
    name,
    files,
    message: `Skill "${name}" created successfully at skills/${skillId}/. Restart the dev server to see it in the sidebar.`,
  };
}
