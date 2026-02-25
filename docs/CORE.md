# SMBOS Core Architecture

## 1) System Boundary

- **NanoClaw (`nanoclaw/`) = execution core**
- **SMBOS = orchestration UI shell**

If a capability already exists in NanoClaw, SMBOS should consume it, not re-implement it.

## 2) NanoClaw Capabilities We Rely On

Reference repo: https://github.com/qwibitai/nanoclaw

### Runtime API

- `GET /api/health`
- `POST /api/chat` (SSE events: `typing`, `message`, `error`, `done`)
- `GET /api/messages`
- `GET /api/tasks`
- `GET /api/state`

### Persistence (SQLite)

- `messages`
- `sessions`
- `registered_groups`
- `scheduled_tasks`
- `task_run_logs`

### Built-in MCP Tools

- `send_message`
- `schedule_task`
- `list_tasks`
- `pause_task`
- `resume_task`
- `cancel_task`
- `register_group`

### Scheduling + Isolation

- Scheduler supports `cron`, `interval`, `once`
- Task execution happens in containerized agent runtime
- Group-scoped context and session behavior are built-in

### Channels

- Web chat group (default)
- Telegram channel (built-in; enabled via `TELEGRAM_BOT_TOKEN`)

## 3) SMBOS Responsibilities

### Agent Lifecycle

- Discover agent folders from filesystem
- Start/stop/restart NanoClaw instances per agent
- Track runtime PID/port/status

### Control/UI Layer

- Agents management UI
- Chat panel for running agent
- Runtime tasks/state view (proxied from NanoClaw)
- NanoClaw config management UI

### Skills Layer

- Skill discovery from `skills/`
- `ui.json`-driven rendering
- Unified execution route `POST /api/skills/[id]/execute`

### SMBOS Local Logs

- Process/lifecycle log stream in `data/logs/{agentId}.jsonl`

## 4) API Surface in SMBOS

### Agent API

- `GET /api/agents`
- `POST /api/agents`
- `DELETE /api/agents`
- `GET /api/agents/[id]`
- `POST /api/agents/[id]`
- `POST /api/agents/[id]/start`
- `POST /api/agents/[id]/stop`
- `GET /api/agents/[id]/status`
- `GET /api/agents/[id]/logs`
- `DELETE /api/agents/[id]/logs`

### NanoClaw Proxy API

- `GET /api/nanoclaw/tasks`
- `GET /api/nanoclaw/state`
- `GET /api/nanoclaw/config`
- `PUT /api/nanoclaw/config`

### Skills API

- `GET /api/skills`
- `GET /api/skills/[id]`
- `POST /api/skills/[id]/execute`
- `GET /api/skills/config`
- `PATCH /api/skills/config`

## 5) Agent Folder Contract (SMBOS Side)

Each agent lives in:

```text
agents/<agent-id>/
  agent.md
  config.yaml
  .env.example
  memory/
```

`config.yaml` in SMBOS is metadata + UI contract for agent setup. Runtime scheduling/session logic remains NanoClaw-native.

## 6) Configuration Keys Managed via SMBOS UI

- `CLAUDE_CODE_OAUTH_TOKEN`
- `ANTHROPIC_API_KEY`
- `ASSISTANT_NAME`
- `ASSISTANT_HAS_OWN_NUMBER`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ONLY`
- `HTTP_PORT`

## 7) Refactoring Guardrails

Do not add SMBOS-side replacements for:

- scheduler engine
- session store
- task queue runtime
- Telegram channel transport

When extending behavior, prefer:

1. NanoClaw configuration
2. NanoClaw extension/skill
3. SMBOS UI adaptation

In that order.
