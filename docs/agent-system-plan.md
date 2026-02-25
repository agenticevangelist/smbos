# SMBOS Multi-Agent System Plan (NanoClaw-First)

## Objective

Run multiple isolated agents where:
- NanoClaw provides runtime intelligence and execution
- SMBOS provides operator UX, lifecycle control, and skill dashboards

## Non-Negotiable Architecture

1. `1 NanoClaw instance = 1 agent runtime`
2. No duplication of NanoClaw internals in SMBOS
3. Agent folders are portable units
4. Integrations should reuse built-in channels/tools first

## Agent Unit Contract

```text
agents/<agent-id>/
  agent.md
  config.yaml
  .env.example
  memory/
```

Notes:
- `agent.md` = identity/system behavior
- `config.yaml` = SMBOS-side metadata and tool declarations
- `.env` (runtime secrets) may be provided per environment
- scheduler/session execution remains NanoClaw-native

## Shared Capabilities (Already in NanoClaw)

- Web chat API (`/api/chat`, `/api/messages`, `/api/state`, `/api/tasks`)
- SQLite persistence
- Scheduler (`cron` / `interval` / `once`)
- MCP task tools (`schedule_task`, `list_tasks`, `pause_task`, `resume_task`, `cancel_task`)
- Group registration (`register_group`)
- Built-in Telegram channel (config-driven)
- Agent teams/swarms support

## SMBOS Responsibilities

- Agent discovery and lifecycle (`start/stop/restart`)
- Runtime observability UI
- Skill UI execution and visualization
- Configuration surface for core NanoClaw env keys

## Implementation Phases

## Phase 1: Runtime Reliability

- Validate end-to-end startup and chat reliability
- Harden lifecycle error reporting
- Ensure NanoClaw proxy routes are stable for multiple running agents

## Phase 2: Integrations

- Enable Telegram by configuration (no transport rewrite)
- Add Calendar MCP integration
- Add Notion MCP integration

## Phase 3: Proactive Automation

- Implement daily/periodic flows through NanoClaw scheduler tools
- Observe and manage tasks through SMBOS dashboards

## Phase 4: Memory + Self-Improvement

- Standardize memory file conventions
- Evaluate need for meta-tools (only if NanoClaw built-ins are insufficient)

## Phase 5: Scaled Agent Portfolio

- Scaffold agents #2-#6 from templates
- Define per-agent integration packs and schedules
- Use swarms selectively for complex delegated workflows

## Agent Portfolio

## #1 Personal (Andy)

Focus:
- personal planning
- proactive reminders
- calendar/notion sync
- Telegram + web control

## #2 Muqta

Focus:
- discount discovery
- client operations
- analytics reporting

## #3 Business Projects

Focus:
- shared project tracking
- invoicing/reporting automation

## #4 Marketing Studio

Focus:
- tone-of-voice outputs
- content production workflows

## #5 21dev

Focus:
- ticket triage
- support workflows

## #6 Delivery Flow

Focus:
- campaign operations
- lead and delivery analytics

## Governance Rules

- Any roadmap item that duplicates NanoClaw must be converted into integration/configuration work.
- Architecture docs must be updated whenever NanoClaw capability coverage changes.
- SMBOS core should stay small and UI-focused.
