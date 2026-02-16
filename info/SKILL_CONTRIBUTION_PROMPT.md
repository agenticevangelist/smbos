# SMBOS Skill Contribution Guide

When requested to create a new tool or skill, you MUST follow this modular format. Encapsulate all functionality within a new directory under `smbos/skills/`.

## 1. Directory Structure

```text
smbos/skills/<skill-id>/
├── SKILL.md           # Instructions & LLM instructions (REQUIRED)
├── ui.json            # UI Schema & API mapping (REQUIRED)
├── scripts/
│   └── execute.ts     # Execution logic (REQUIRED)
├── template.md        # Output template (Optional)
└── examples/          # Reference data (Optional)
```

## 2. UI Schema (ui.json) Reference

The `ui.json` file drives the `DynamicSkillUI` engine. It supports complex layouts and a wide range of Carbon Design System components.

### Top-level Properties
*   `id`: unique-slug
*   `name`: Display Name
*   `description`: Tool description
*   `layout`: `simple` | `tabs` | `sections` (default: `simple`)

### Inputs Configuration
Supported types: `text`, `textarea`, `number`, `select`, `multiselect`, `date`, `toggle`, `checkbox`.

```json
{
  "id": "param_id",
  "label": "Display Label",
  "type": "text",
  "placeholder": "...",
  "required": true,
  "default": "...",
  "options": [ { "value": "v1", "text": "Label 1" } ] // For select/multiselect
}
```

### Layout Definitions
Used if `layout` is `tabs` or `sections`.

```json
"tabs": [
  { "id": "t1", "label": "Tab 1", "inputs": ["input_id_1", "input_id_2"] }
],
"sections": [
  { "id": "s1", "title": "Section 1", "inputs": ["input_id_1"] }
]
```

### Outputs Configuration
Supported types: `table`, `cards`, `accordion`, `list`, `json`.

#### Table Output
```json
"outputs": {
  "type": "table",
  "rootPath": "data_key",
  "columns": [
    { "key": "name", "header": "Name", "type": "text" },
    { "key": "rating", "header": "Rating", "type": "tag", "tagType": "rating" },
    { "key": "url", "header": "Link", "type": "linkOrTag" }
  ]
}
```

#### Card Grid Output
```json
"outputs": {
  "type": "cards",
  "rootPath": "data_key",
  "card": {
    "titleKey": "title",
    "descriptionKey": "summary",
    "tagKey": "category"
  }
}
```

## 3. Execution Logic (scripts/execute.ts)

Implement an `async function execute(params: any)` that returns the data expected by the output schema.

```typescript
export async function execute(params: any) {
  // Logic here
  return {
    data_key: [ /* objects */ ]
  };
}
```

## 4. LLM Instructions (SKILL.md)

Define the tool's behavior for agents using YAML frontmatter and standard markdown.

```yaml
---
name: skill-id
description: Detailed description for agent discovery
---
# Skill Title
Instructions on when and how to use this tool.
```
