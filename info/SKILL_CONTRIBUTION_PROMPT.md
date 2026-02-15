# SMBOS Skill Contribution Guide

When a user asks you to create a new tool or skill, you MUST follow this modular format. Do NOT modify any existing project logic or UI components unless explicitly directed. All new functionality should be encapsulated within a new skill directory.

## Skill Directory Structure

Each skill must be a self-contained directory under `smbos/skills/`:

```
smbos/skills/<skill-id>/
├── SKILL.md           # Main instructions & frontmatter (REQUIRED)
├── ui.json            # UI Schema & API mapping (REQUIRED)
├── template.md        # Template for output formatting
├── examples/
│   └── sample.md      # Example of expected output
└── scripts/
    ├── execute.ts     # Main execution logic (REQUIRED)
    └── validate.sh    # Optional validation script
```

## 1. SKILL.md (Claude Code Standard)
Define the skill name and description in YAML frontmatter. This description helps Claude decide when to use the skill.

```yaml
---
name: <skill-id>
description: <detailed description of what the skill does>
---

# <Skill Name>

Detailed instructions on how to use the skill and what it does.
```

## 2. ui.json (SMBOS UI Standard)
Define how the skill appears in the SMBOS dashboard and how it maps to the API.

```json
{
  "id": "<skill-id>",
  "name": "<Display Name>",
  "description": "<Brief description>",
  "icon": "<Carbon Icon Name>",
  "inputs": [
    {
      "id": "query",
      "label": "Search Query",
      "type": "text",
      "required": true
    }
  ],
  "api": {
    "url": "/api/skills/<skill-id>/execute",
    "method": "POST",
    "bodyMapping": {
      "param": "{{query}}"
    }
  },
  "outputs": {
    "type": "table",
    "rootPath": "results",
    "columns": [
      { "key": "name", "header": "Name" }
    ]
  },
  "filters": []
}
```

## 3. scripts/execute.ts
Implement the `execute` function. It should accept the parameters defined in `ui.json` and return the results.

```typescript
export async function execute(params: any) {
  const { param } = params;
  
  // Implementation logic here
  
  return {
    results: [
      { name: "Result 1" }
    ]
  };
}
```

## 4. Integration
The project's central API routes in `smbos/app/api/skills/` will automatically discover and route requests to your new skill based on its directory name. You do NOT need to modify any files in `app/api/` or `components/`.

## Verification
To verify your skill:
1. Ensure `SKILL.md` and `ui.json` are present in the skill directory.
2. Ensure `scripts/execute.ts` exports an `execute` function.
3. Your skill will automatically appear in the SMBOS dashboard.
