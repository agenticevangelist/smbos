# SMBOS Platform — Core Architecture

---

## Architectural Principles

- **NanoClaw = core.** All intelligence routes through NanoClaw agents. SMBOS is a UI shell — renders data, sends user actions to agents.
- **1 NanoClaw instance = 1 agent.** Full isolation. Crash of one doesn't break others.
- **Portable agents.** Any single agent can be deployed independently without the rest of the system.

---

## Agent Config Schema

Every agent is a folder:

```
agents/<agent-id>/
  agent.md          # WHO — frontmatter (name, model, version) + body (system prompt)
  config.yaml       # WHAT + WHEN — tools, schedules, integrations
  .env              # SECRETS — API keys, tokens (not committed)
  memory/           # KNOWLEDGE — persistent working memory (agent reads/writes)
```

### agent.md

```markdown
---
name: Agent Name
model: claude-sonnet-4-6
version: 1.0
max_tokens: 8192
temperature: 0.7
---

# Identity
...

# Boundaries
...

# Communication style
...
```

### config.yaml

```yaml
tools:
  - id: tool-name
    type: mcp | skill | cli
    # type-specific config
    enabled: true

schedules:
  - id: schedule-name
    cron: "0 8 * * *"
    action: "Description of what to do"
    enabled: true
```

### memory/

```
memory/
  context.md       # Current projects, priorities, active tasks
  people.md        # Contacts, preferences, communication notes
  learnings.md     # Behavioral patterns, user preferences discovered over time
```

Agent reads these at session start. Agent writes when it learns something new.

---

## NanoClaw Capabilities (don't rebuild)

| Capability | How it works |
|------------|-------------|
| Chat sessions | Server-side in SQLite, per-group. Client doesn't send sessionId |
| HTTP API | `GET /api/health`, `POST /api/chat` (SSE: typing→message→done), `OPTIONS` |
| SQLite DB | Tables: `chats`, `messages`, `scheduled_tasks`, `task_run_logs`, `sessions`, `registered_groups` |
| MCP tools | `send_message`, `schedule_task`, `list_tasks`, `pause_task`, `resume_task`, `cancel_task`, `register_group` |
| Scheduler | cron/interval/once, each task runs in Docker container with full agent access |
| Agent Swarms | Sub-agent orchestration via teams |
| Memory | CLAUDE.md (global + per-group), auto-memory enabled |
| Container isolation | Docker, configurable image/timeout/concurrency |
| Config env vars | `ASSISTANT_NAME`, `HTTP_PORT`, `CONTAINER_IMAGE`, `MAX_CONCURRENT_CONTAINERS`, etc. |
| Auth | `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` (only these passed to containers) |

---

## What SMBOS Builds (NanoClaw doesn't have)

| Capability | Status |
|------------|--------|
| Multi-agent lifecycle (start/stop/restart NanoClaw instances) | Done |
| Agent config management (agent.md + config.yaml) | Done |
| SMBOS-side logging (`data/logs/{agentId}.jsonl`) | Done |
| Skill system (ui.json rendering, execute.ts) | Done |
| Health check (polling `GET /api/health`) | Done |
| Chat persistence (localStorage) | Done |
| Cron UI controls (toggle, manual trigger) | Done |
| Log viewer in Agent detail | Done |

---

## Tool Types

| Type | When | How it connects | Example |
|------|------|----------------|---------|
| **MCP server** | External service, persistent connection, standard protocol | NanoClaw spawns MCP server process, communicates via stdio/SSE | Telegram, Calendar, Notion |
| **Skill** | Need web UI visualization (forms, tables, charts) | NanoClaw calls SMBOS `/api/skills/{id}/execute` via HTTP | Analytics dashboards, CRM |
| **CLI tool** | Simple one-off operation, wraps system utility | NanoClaw executes command in sandboxed shell | File ops, git, scripts |

### MCP Server Structure

Each MCP server lives in `mcp/` or is an npm package:

```
mcp/
  <server-name>/
    index.ts
    package.json
```

Standard MCP servers installed via npm (e.g. `@anthropic/google-calendar-mcp`).

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agents` | GET | List agents from filesystem |
| `/api/agents` | POST | Scaffold new agent folder |
| `/api/agents` | DELETE | Delete agent folder |
| `/api/agents/[id]` | GET | Full config + runtime status |
| `/api/agents/[id]` | PATCH | Update schedule enabled/disabled |
| `/api/agents/[id]` | POST | Manual trigger (send action to NanoClaw) |
| `/api/agents/[id]/start` | POST | Start NanoClaw + cron schedules |
| `/api/agents/[id]/stop` | POST | Stop + cron cleanup |
| `/api/agents/[id]/status` | GET | Runtime status |
| `/api/agents/[id]/logs` | GET | Agent logs (JSONL) |
| `/api/agents/[id]/logs` | DELETE | Clear logs |
| `/api/scheduled-tasks` | GET | All schedules from all agents |

---

## UI Components

| Component | Purpose |
|-----------|---------|
| `Agents.tsx` | Grid cards, Create/Delete/Start/Stop/Restart, Detail modal with Tabs (Overview + Logs) |
| `AgentChat.tsx` | Agent selector, health check, localStorage persistence, SSE streaming, Clear chat |
| `ScheduledTasks.tsx` | Schedule table, Toggle enable/disable, Manual trigger Run Now |
| `AppShell.tsx` | Three-panel layout (left nav, center content, right agent chat) |

---

## Logging

- Lifecycle events: `agent:start`, `agent:stop`, `agent:error`
- Cron events: `cron:trigger`, `cron:success`, `cron:error`
- Storage: `data/logs/{agentId}.jsonl`
- API: `GET /api/agents/[id]/logs?limit=50&type=cron:error&since=2026-02-20T00:00:00Z`

---

## Meta-Tools

| Tool | Purpose | Boundaries |
|------|---------|------------|
| `edit_own_config` | Agent modifies own `agent.md`, `config.yaml` | Cannot modify `.env` (security) |
| `create_agent` | Scaffold `agents/{id}/` with template files | Creates folder + config files |
| `spawn_agent` | Launch NanoClaw on dynamic port (3101+) | Port management needed |
| `update_memory` | Read/write files in own `memory/` | Scoped to agent's memory dir |

Inter-agent communication via MCP `send_message`.

---

## Modularity Principle

To launch a new agent:

1. Create `agents/<id>/` folder
2. Write `agent.md` — system prompt
3. Write `config.yaml` — tools + schedules
4. Create `.env` — secrets
5. Run: `nanoclaw --agent agents/<id>/ --port 31XX`

No code changes. No redeployment of SMBOS. Just config + env + start.

---

## Deployment & Distribution

An agent is a portable unit. Runs on any machine independently.

### Deployable package

```
agent-package/
├── agents/<agent-id>/
│   ├── agent.md
│   ├── config.yaml
│   ├── .env.example
│   └── memory/
├── mcp/                  # Only custom MCP servers this agent uses
└── install.sh
```

### Deployment scenarios

| Scenario | What to deliver | How to run |
|----------|----------------|------------|
| Dev machine | Just the `agents/` folder | `nanoclaw --agent agents/<id>/ --port 31XX` |
| Client server | Agent package + NanoClaw | Client fills `.env`, runs `install.sh` |
| VPS / cloud | Same + Docker | `docker run -v ./agents/<id>:/agent -p 3100:3100 nanoclaw` |
| Multiple agents | Multiple agent folders | Each on its own port |
| Standalone (no SMBOS) | Agent package only | Works via Telegram/Slack/Discord |
| With SMBOS | Agent package + SMBOS | SMBOS connects to agent's port |

### Updating a deployed agent

| What changed | How to update |
|-------------|--------------|
| System prompt (agent.md) | Replace file, restart NanoClaw |
| Tools (config.yaml) | Replace file, restart NanoClaw |
| Secrets (.env) | Replace file, restart NanoClaw |
| Memory (memory/) | Files update live — no restart needed |
| MCP server code | Replace files, `npm install`, restart NanoClaw |
| NanoClaw itself | `npm update -g nanoclaw`, restart |

---

## Core Roadmap

| # | Task | Blocker | Purpose |
|---|------|---------|---------|
| 13 | Verify NanoClaw end-to-end | None | Prove full stack works: SMBOS → NanoClaw → Claude → response |
| 14 | Extend NanoClaw HTTP API (multi-group) | #13 | `groupId` in POST /api/chat, `GET /api/sessions` |
| 21 | Memory tools (update_memory, context injection) | #13 | Persistent learning across sessions |
| 22 | edit_own_config meta-tool | #21 | Agent self-improvement |
| 23 | Sub-agent creation (create_agent + spawn_agent) | #22 | Dynamic agent spawning |
| 24 | SMBOS UI: search, notifications, profile | #16 | Search/notifications/profile via NanoClaw |

---

## Refactoring (completed)

- Removed: `carbondocs/`, `docs/`, `info/`, `app/api/usage/`, `postcss.config.mjs`
- Cleaned: `.gitignore`, `package.json` (removed tailwind, googlemaps), `next.config.ts`
- Removed `console.log` from components
- CLAUDE.md compressed to ~70 lines

---

## Project Structure

```
smbos/
├── app/
│   ├── page.tsx, layout.tsx, globals.scss
│   └── api/
│       ├── skills/           — GET list, GET [id], POST execute, PATCH config
│       ├── agents/           — GET/POST/DELETE, [id] GET/PATCH/POST, start, stop, status, logs
│       └── scheduled-tasks/  — GET (reads from agent configs)
├── components/
│   ├── AppShell.tsx + .scss
│   ├── DynamicSkillUI.tsx + .scss
│   ├── AgentChat.tsx
│   ├── Dashboard.tsx
│   ├── Agents.tsx
│   ├── ScheduledTasks.tsx
│   └── SkillsManagement.tsx
├── lib/
│   ├── skills/registry.ts
│   ├── events/skillEvents.ts
│   └── agents/
│       ├── types.ts, config.ts, registry.ts
│       ├── lifecycle.ts, scheduler.ts, logger.ts
├── skills/                   — 21 skills + _shared/
├── agents/                   — Agent folders
├── data/                     — Runtime storage (logs/)
├── nanoclaw/                 — NanoClaw core
└── mcp/                      — Custom MCP servers
```
