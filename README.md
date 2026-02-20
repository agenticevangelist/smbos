# SMBOS

SMBOS is a NanoClaw-first UI shell for running and operating multiple agents.

## Core Model

- **NanoClaw is the runtime core** (`nanoclaw/`): chat sessions, scheduler, task execution, MCP tools, channel integrations.
- **SMBOS is the control plane + UI**: starts/stops agents, renders skill interfaces, shows runtime state/logs.

This repository intentionally avoids re-implementing functionality already available in NanoClaw.

## What We Use from NanoClaw (ready-made)

Reference: https://github.com/qwibitai/nanoclaw

- HTTP API: `GET /api/health`, `POST /api/chat` (SSE), `GET /api/messages`, `GET /api/tasks`, `GET /api/state`
- SQLite persistence: sessions, messages, registered groups, scheduled tasks, task run logs
- Built-in MCP tools inside runner:
  - `send_message`
  - `schedule_task`
  - `list_tasks`
  - `pause_task`
  - `resume_task`
  - `cancel_task`
  - `register_group`
- Built-in scheduler: `cron` / `interval` / `once`
- Built-in channels:
  - Web chat (`web-chat@smbos`)
  - Telegram channel (enabled by `TELEGRAM_BOT_TOKEN`)
- Agent swarms support (Claude Agent SDK teams)
- Container isolation and mount-allowlist security model

## What SMBOS Adds

- Multi-agent lifecycle in one UI (`start` / `stop` / `restart` NanoClaw instances)
- Agent folder management (`agents/<id>/agent.md`, `config.yaml`, `.env.example`, `memory/`)
- Unified dashboard for:
  - agents
  - NanoClaw runtime tasks and state
  - skill execution UI (`ui.json`-driven)
- SMBOS-side event/process logs (`data/logs/*.jsonl`)

## Current Architecture

```text
smbos/
├── app/
│   └── api/
│       ├── agents/*               # Agent lifecycle + metadata
│       ├── nanoclaw/*             # Proxy to NanoClaw runtime API
│       └── skills/*               # Skill registry and execution routes
├── components/
│   ├── Agents.tsx
│   ├── AgentChat.tsx
│   ├── ScheduledTasks.tsx
│   ├── NanoClawSettings.tsx
│   └── DynamicSkillUI.tsx
├── lib/
│   ├── agents/*                   # Agent config/lifecycle helpers
│   └── skills/*                   # Skill discovery and metadata
├── agents/                        # Agent definitions
├── skills/                        # Skill modules (UI + execute scripts)
└── nanoclaw/                      # Embedded NanoClaw runtime
```

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Build NanoClaw runtime once:

```bash
cd nanoclaw
npm install
npm run build
cd ..
```

3. Configure secrets:
- `nanoclaw/.env` (or per-agent `.env` copied at runtime)
- minimally one auth method:
  - `CLAUDE_CODE_OAUTH_TOKEN` or
  - `ANTHROPIC_API_KEY`

4. Run SMBOS:

```bash
npm run dev
```

5. Open UI, create/start agent from **Agents** page, then chat from right sidebar.

## NanoClaw Config Keys Exposed in SMBOS UI

- `CLAUDE_CODE_OAUTH_TOKEN`
- `ANTHROPIC_API_KEY`
- `ASSISTANT_NAME`
- `ASSISTANT_HAS_OWN_NUMBER`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ONLY`
- `HTTP_PORT`

## Documentation

- `docs/CORE.md` — source-of-truth architecture and boundaries
- `docs/REFACTOR_PLAN.md` — current implementation plan without NanoClaw duplication
- `docs/agent-system-plan.md` — multi-agent product/system plan
- `docs/DAVID_PERSONAL.md` — personal agent use-cases

## Non-Goals

Do not build these in SMBOS if NanoClaw already provides them:

- another scheduler engine
- separate session store
- custom task orchestration protocol
- duplicate Telegram channel layer

Use NanoClaw built-ins first; extend only where SMBOS needs UI/ops workflows.
