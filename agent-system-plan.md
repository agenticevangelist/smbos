# SMBOS Multi-Agent System — Plan

---

## Что было → Что предлагаем → Что будет

### Что было

SMBOS — веб-панель с набором skills (навыков). Один NanoClaw-процесс на порту 3100, один чат с агентом, без сессий. Агент реактивный — отвечает только когда к нему обращаются. Навыки работают только через веб-интерфейс (нажал кнопку → получил результат). Нет интеграций с внешними сервисами (Telegram, Calendar, Notion). Нет памяти между сессиями. Нет возможности запустить агента для конкретного проекта или клиента отдельно.

По сути: красивый дашборд с инструментами, но без мозга за ними.

### Что предлагаем

Превратить SMBOS из панели инструментов в **платформу для запуска автономных агентов**. Каждый агент:

- **Изолирован** — свой NanoClaw-процесс, свой конфиг, свои секреты, своя память
- **Модулен** — описан тремя файлами: `agent.md` (кто), `config.yaml` (что умеет + когда действует), `.env` (ключи)
- **Портативен** — zip/Docker, развернуть на любом компе без зависимости от остального
- **Проактивен** — cron-задачи (утренний брифинг, проверки дедлайнов) + webhooks (Telegram, Notion)
- **Многоканален** — работает через Telegram (бот + юзербот), веб-панель SMBOS, или и то и другое
- **Самообучаем** — редактирует свой конфиг, запоминает предпочтения, создаёт суб-агентов

### Почему так

| Решение | Почему |
|---------|--------|
| 1 NanoClaw = 1 агент | Изоляция. Падение одного не ломает остальных. Можно развернуть одного агента клиенту без всей системы |
| Конфиг в файлах (agent.md + config.yaml) | Поменял файл = другой агент. Не нужно писать код, менять БД, передеплоивать. Агент может сам редактировать свой конфиг |
| MCP + Skills + CLI | Каждый формат инструмента для своей задачи. MCP — внешние сервисы. Skills — визуализация в дашборде. CLI — системные операции. Не изобретаем свой формат |
| Cron + Webhooks | Агент-ассистент бесполезен если только отвечает на вопросы. Он должен сам напоминать, мониторить, реагировать |
| Telegram bot + userbot | Бот — для общения с агентом. Юзербот — для мониторинга чатов и действий от твоего имени. Максимум возможностей |
| Memory в файлах | Просто, читаемо, агент может редактировать. Obsidian-совместимо. Для сложных случаев добавим БД позже |

### Что будет в итоге

**6 автономных агентов**, каждый решает свой блок задач:

| # | Агент | Что делает | Кому |
|---|-------|-----------|------|
| 1 | Personal (Andy) | Планировщик, ассистент, Telegram/Calendar/Notion, утренние брифинги | Тебе |
| 2 | Muqta | Поиск скидок, клиенты, аналитика мобильного приложения | Тебе + кофаундер |
| 3 | Business Projects | Данные, инвойсы, отчёты, совместный Notion/Obsidian | Тебе + жена |
| 4 | Marketing Studio | Tone of voice, генерация текстов/картинок | Клиент (маркетинговая студия) |
| 5 | 21dev | Discord/Slack/Featurebase, тикеты, ответы | Тебе + команда |
| 6 | Delivery Flow | WhatsApp рассылки, поиск клиентов, аналитика | Тебе + команда |

Строим #1 первым. Агенты #2–6 — шаблоны с пустыми полями, заполняем по мере готовности. Модульность означает: скопировал папку, поменял конфиг, запустил — новый агент работает. Хоть на твоём компе, хоть на сервере клиента, хоть в Docker.

---

## Architectural Decisions

| Question | Decision |
|----------|----------|
| NanoClaw topology | 1 instance = 1 agent. Full isolation |
| Interfaces | SMBOS web dashboard + Telegram (bot + userbot) |
| Telegram mode | Bot for communication + Userbot for monitoring/actions in chats |
| Proactive behavior | Cron for periodic tasks + Webhooks for real-time events |
| Obsidian | Slot reserved, implement later |
| Config format | `agent.md` (prompt) + `config.yaml` (tools + schedules) + `.env` (secrets) |
| Tool types | MCP servers, SMBOS Skills, CLI tools — by purpose |

---

## Agent Config Schema (Variant B)

Every agent is a folder:

```
agents/
  <agent-id>/
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
  # MCP servers — external services with persistent connections
  - id: telegram-bot
    type: mcp
    server: ./mcp/telegram-bot
    config:
      bot_token: ${TELEGRAM_BOT_TOKEN}
    enabled: true

  # SMBOS Skills — web-visible operations with UI
  - id: delivery-analytics
    type: skill
    skill_id: delivery-analytics
    enabled: true

  # CLI tools — system operations
  - id: file-ops
    type: cli
    commands: [read_file, write_file, list_dir]
    enabled: true

schedules:
  - id: morning-briefing
    cron: "0 8 * * *"
    action: "Collect Calendar events, Notion tasks, Telegram unreads → send summary to bot"
    enabled: true

  - id: deadline-check
    cron: "0 */4 * * *"
    action: "Check Notion deadlines, remind if < 24h"
    enabled: true
```

### memory/

```
memory/
  context.md       # Current projects, priorities, active tasks
  people.md        # Contacts, preferences, communication notes
  learnings.md     # Behavioral patterns, user preferences discovered over time
```

Agent reads these files at session start. Agent writes to them when it learns something new.

---

## Tool Types: When to Use What

| Type | When | How it connects | Example |
|------|------|----------------|---------|
| **MCP server** | External service, persistent connection, standard protocol | NanoClaw spawns MCP server process, communicates via stdio/SSE | Telegram, Calendar, Notion, Obsidian |
| **Skill** | Need web UI visualization (forms, tables, charts) | NanoClaw calls SMBOS `/api/skills/{id}/execute` via HTTP | Analytics dashboards, CRM, reports |
| **CLI tool** | Simple one-off operation, wraps system utility | NanoClaw executes command in sandboxed shell | File ops, git, scripts |

### MCP Server Structure

Each MCP server lives in `mcp/` or is an npm package:

```
mcp/
  telegram-bot/       # Custom MCP server for Telegram Bot API
    index.ts
    package.json
  telegram-userbot/   # Custom MCP server for TDLib userbot
    index.ts
    package.json
```

Standard MCP servers installed via npm:
- `@anthropic/google-calendar-mcp`
- `@anthropic/notion-mcp`
- `obsidian-mcp` (later)

---

## Meta-Tools: Self-Improvement + Sub-Agent Creation

Agent #1 gets special tools beyond regular MCP/Skills/CLI:

### edit_own_config
- Reads and modifies own `agent.md`, `config.yaml`, `schedules` section
- Cannot modify `.env` (security boundary)
- Use case: agent realizes it needs a new tool → adds it to config.yaml

### create_agent
- Creates new folder in `agents/` with template files
- Generates `agent.md` with appropriate system prompt
- Sets up `config.yaml` with required tools
- Use case: user says "create an agent for project X" → agent scaffolds it

### spawn_agent
- Starts a new NanoClaw instance for a sub-agent
- Assigns port dynamically (3101, 3102, ...)
- Use case: delegate a complex task to a specialized sub-agent

### update_memory
- Reads/writes files in own `memory/` directory
- Use case: agent learns a preference → saves to learnings.md

---

## Agent #1: Personal Assistant — Implementation Plan

### Identity

- **Name**: Andy (configurable)
- **Role**: Personal planner + assistant
- **Users**: Only you
- **Channels**: Telegram bot, SMBOS web, Telegram userbot (monitoring)

### Tools (MVP)

| Tool | Type | Purpose | Priority |
|------|------|---------|----------|
| Telegram Bot | MCP | Two-way communication, send reminders | P0 |
| Telegram Userbot | MCP | Monitor specific chats/groups, react to messages | P0 |
| Google Calendar | MCP | Read/create events, morning briefing | P0 |
| Notion | MCP | Track tasks, update project statuses | P0 |
| Obsidian | MCP | Read/write notes in vault | P1 (later) |
| edit_own_config | Meta | Self-improvement | P0 |
| create_agent | Meta | Create sub-agents | P1 |
| spawn_agent | Meta | Launch sub-agents | P1 |
| update_memory | Meta | Persistent learning | P0 |

### Schedules (MVP)

| Schedule | Cron | What it does |
|----------|------|-------------|
| Morning briefing | `0 8 * * *` | Calendar today + Notion deadlines + Telegram summary → send to bot |
| Deadline check | `0 */4 * * *` | Scan Notion for approaching deadlines → remind via bot |
| Evening review | `0 21 * * *` | What was done today, what's left → send to bot |
| Telegram monitor | `*/5 * * * *` | Check monitored chats for new messages needing attention |

### Implementation Phases

#### Phase 1: Core Agent Framework
1. Create `agents/` directory structure with Variant B schema
2. Build agent config loader in NanoClaw — parse `agent.md` frontmatter + body, parse `config.yaml`
3. Build tool registry — load MCP/Skill/CLI tools from config.yaml
4. Build scheduler — node-cron for periodic tasks from config.yaml schedules
5. Wire SMBOS web dashboard to show agent status, logs, config

#### Phase 2: Telegram Integration
1. Build `mcp/telegram-bot/` MCP server — send/receive messages via Bot API
2. Build `mcp/telegram-userbot/` MCP server — TDLib client, monitor specific chats
3. Wire NanoClaw ↔ Telegram bot (incoming messages trigger agent)
4. Wire NanoClaw ↔ Telegram userbot (monitored chats trigger agent)
5. Implement webhook receiver for Telegram bot updates

#### Phase 3: Calendar + Notion
1. Integrate Google Calendar MCP server — read events, create events
2. Integrate Notion MCP server — read/update pages, query databases
3. Build morning briefing flow: Calendar + Notion + Telegram → summary
4. Build deadline tracking: Notion query → reminder via Telegram

#### Phase 4: Memory + Self-Improvement
1. Implement `update_memory` tool — agent reads/writes memory/ files
2. Implement `edit_own_config` tool — agent modifies own config.yaml
3. Implement context injection — load memory/ files into agent context at session start
4. Test: agent learns a preference → persists → uses in next session

#### Phase 5: Sub-Agent Creation
1. Implement `create_agent` tool — scaffold new agent folder
2. Implement `spawn_agent` tool — launch new NanoClaw instance
3. Port management — dynamic port allocation for sub-agents
4. Inter-agent communication protocol (agent #1 ↔ sub-agents)

---

## Agents #2–6: Templates

Each agent below is a **template** — fill in the `[PLACEHOLDER]` fields when ready to implement.

---

### Agent #2: Muqta (Discount App)

```
agents/muqta/
```

**Users**: You + co-founder

**Purpose**: Replace employees for product search, client communication, analytics, discount uploads

| Field | Value |
|-------|-------|
| Name | [NAME] |
| Model | [claude-sonnet-4-6 / claude-haiku-4-5] |
| Primary channel | [Telegram bot / Web / Both] |

**Tools needed**:

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| [Product search source] | MCP | Find products and discounts | Not built |
| [Client messaging] | MCP | Communicate with clients | Not built |
| [Analytics dashboard] | Skill | View discount performance | Not built |
| [Discount uploader] | MCP/CLI | Upload discounts to app backend | Not built |
| [App backend API] | MCP | CRUD operations on app data | Not built |

**Schedules**:

| Schedule | Cron | Action |
|----------|------|--------|
| [Daily scan] | [TBD] | [Scan for new discounts] |
| [Client follow-up] | [TBD] | [Check client responses] |
| [Analytics report] | [TBD] | [Generate daily/weekly report] |

**Questions to resolve**:
- [ ] What is the app backend? (API URL, auth method)
- [ ] Where do discounts come from? (websites, APIs, manual)
- [ ] What client messaging platform? (WhatsApp, Telegram, in-app)
- [ ] What analytics metrics matter?

---

### Agent #3: Business Projects (You + Wife)

```
agents/business-projects/
```

**Users**: You + wife (shared access, possibly different permission levels)

**Purpose**: Project management, data analysis, client communication, invoicing, reports

| Field | Value |
|-------|-------|
| Name | [NAME] |
| Model | [claude-sonnet-4-6 / claude-opus-4-6] |
| Primary channel | [Telegram bot (separate for each?) / Shared chat / Web] |

**Tools needed**:

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| Data analysis (Excel, Python, PDF) | CLI/MCP | Parse and analyze data files | Not built |
| Client communication | MCP | Send invoices, reports, status updates | Not built |
| Email | MCP | Read/send emails | Not built |
| Google Calendar | MCP | Shared calendar management | Can reuse from Agent #1 |
| Shared Notion/Obsidian | MCP | Shared workspace with auto-updates | Can reuse from Agent #1 |
| Invoice generator | Skill | Create and send invoices | Not built |
| Report generator | Skill | Generate client reports | Not built |

**Schedules**:

| Schedule | Cron | Action |
|----------|------|--------|
| [Task reminder] | [TBD] | [Remind both users about pending tasks] |
| [Path correction] | [TBD] | [Analyze project trajectory, alert if off-track] |
| [Client status check] | [TBD] | [Check client communication status] |

**Questions to resolve**:
- [ ] Same Telegram bot for both, or separate bots?
- [ ] Permission model: can wife see everything, or scoped access?
- [ ] What data formats? (Excel specific templates, PDF types)
- [ ] What email provider? (Gmail, Outlook, custom SMTP)
- [ ] What does "correct path" mean concretely? (deadlines, budget, milestones)

---

### Agent #4: Marketing Studio (Corporate AI)

```
agents/marketing-studio/
```

**Users**: Marketing studio team (multiple people, not you)

**Purpose**: Corporate AI that maintains brand tone of voice, runs specialized creative tools

| Field | Value |
|-------|-------|
| Name | [BRAND NAME] |
| Model | [claude-sonnet-4-6 / claude-opus-4-6] |
| Tone of voice | [BRAND GUIDELINES — to be embedded in agent.md] |
| Primary channel | [Web UI / Telegram / Slack] |

**Tools needed**:

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| Text generator | Skill | Generate copy in brand voice | Not built |
| Image generator | MCP/CLI | Generate images (DALL-E, Midjourney API) | Not built |
| Brand guidelines checker | CLI | Validate content against brand rules | Not built |
| Content calendar | MCP | Plan and schedule content | Not built |
| [Social media poster] | MCP | Post to social platforms | Not built |

**Schedules**:

| Schedule | Cron | Action |
|----------|------|--------|
| [Content calendar check] | [TBD] | [Remind about upcoming content deadlines] |

**Questions to resolve**:
- [ ] Which brand(s)? One agent per brand or one multi-brand agent?
- [ ] What image generation service? (DALL-E, Midjourney, Stable Diffusion)
- [ ] What social platforms? (Instagram, Facebook, LinkedIn, TikTok)
- [ ] Who are the users? (copywriters, designers, managers)
- [ ] Access control: who can do what?

---

### Agent #5: 21dev (Developer Support)

```
agents/21dev/
```

**Users**: You (+ team later)

**Purpose**: Monitor Discord, Slack, Featurebase — analyze tickets, learn to respond

| Field | Value |
|-------|-------|
| Name | [NAME] |
| Model | [claude-sonnet-4-6 / claude-haiku-4-5] |
| Primary channel | [Discord / Slack / Web] |

**Tools needed**:

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| Discord | MCP | Read messages, respond to tickets | Not built |
| Slack | MCP | Read messages, respond to tickets | Not built |
| Featurebase | MCP | Read/update feature requests and bugs | Not built |
| Knowledge base | MCP/CLI | Search docs, codebase, past answers | Not built |
| [Ticket analyzer] | Skill | Dashboard of ticket trends, categories | Not built |

**Schedules**:

| Schedule | Cron | Action |
|----------|------|--------|
| [Ticket scan] | [TBD] | [Check new tickets across all platforms] |
| [Daily summary] | [TBD] | [Summarize ticket activity, unresolved issues] |

**Questions to resolve**:
- [ ] Which Discord server(s) and channels?
- [ ] Which Slack workspace(s) and channels?
- [ ] Featurebase API access?
- [ ] Should agent auto-respond or draft responses for approval?
- [ ] What knowledge base to learn from? (docs, codebase, wiki)

---

### Agent #6: Delivery Flow

```
agents/delivery-flow/
```

**Users**: You (+ team later)

**Purpose**: WhatsApp campaigns, find clients, validate, analyze

| Field | Value |
|-------|-------|
| Name | [NAME] |
| Model | [claude-sonnet-4-6] |
| Primary channel | [WhatsApp / Telegram / Web] |

**Tools needed**:

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| WhatsApp sender | Skill | Send campaign messages | Exists (whatsapp-campaign skill) |
| Client finder | Skill | Find potential clients | Partially exists (google-maps-leads, restaurant-scraper) |
| Client validator | CLI/MCP | Validate client data (phone, email, business) | Not built |
| Delivery analytics | Skill | Analyze delivery performance | Exists (delivery-analytics skill) |
| Customer CRM | Skill | Manage client relationships | Exists (customer-crm skill) |

**Schedules**:

| Schedule | Cron | Action |
|----------|------|--------|
| [Lead generation] | [TBD] | [Scan for new potential clients] |
| [Campaign follow-up] | [TBD] | [Check campaign message delivery/responses] |
| [Analytics report] | [TBD] | [Generate performance report] |

**Questions to resolve**:
- [ ] Which WhatsApp number/account?
- [ ] What criteria for client validation?
- [ ] Campaign frequency limits?
- [ ] Existing skills sufficient or need new ones?

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                    SMBOS Web                     │
│          (Next.js — dashboard, config,           │
│           skill UIs, agent monitoring)           │
└──────────────┬──────────────────┬────────────────┘
               │ HTTP             │ HTTP
               ▼                  ▼
┌──────────────────┐  ┌──────────────────┐
│  NanoClaw :3100  │  │  NanoClaw :3101  │  ...per agent
│  Agent #1        │  │  Agent #2        │
│  (Personal)      │  │  (Muqta)         │
├──────────────────┤  ├──────────────────┤
│ agent.md         │  │ agent.md         │
│ config.yaml      │  │ config.yaml      │
│ .env             │  │ .env             │
│ memory/          │  │ memory/          │
├──────────────────┤  ├──────────────────┤
│ MCP servers:     │  │ MCP servers:     │
│  ├ telegram-bot  │  │  ├ [TBD]         │
│  ├ telegram-ub   │  │  └ [TBD]         │
│  ├ calendar      │  │                  │
│  └ notion        │  │                  │
├──────────────────┤  ├──────────────────┤
│ Scheduler:       │  │ Scheduler:       │
│  ├ cron jobs     │  │  ├ cron jobs     │
│  └ webhook rx    │  │  └ webhook rx    │
└──────────────────┘  └──────────────────┘
        │                     │
        ▼                     ▼
┌──────────────────────────────────────┐
│          External Services           │
│  Telegram, Calendar, Notion,         │
│  Obsidian, Discord, Slack, etc.      │
└──────────────────────────────────────┘
```

---

## Implementation Roadmap

### Stage 1: Agent Framework (do first)
Build the core that all agents share:
- Agent config loader (parse agent.md + config.yaml)
- Tool registry (MCP / Skill / CLI loader)
- Scheduler (node-cron from config.yaml schedules)
- Agent lifecycle (start, stop, reload config)
- SMBOS agent management UI (list agents, view status, edit config)

### Stage 2: Agent #1 Personal (MVP)
Implement the personal assistant with:
- Telegram bot MCP server
- Telegram userbot MCP server
- Google Calendar MCP server
- Notion MCP server
- Memory system (read/write memory/ files)
- Morning briefing, deadline checks, evening review
- Self-improvement (edit_own_config)

### Stage 3: Agent #1 Advanced
- Sub-agent creation (create_agent, spawn_agent)
- Obsidian integration
- Path correction (analyze if projects are on track)
- Inter-agent communication

### Stage 4+: Agents #2–6
Fill in templates above, implement one at a time.
Modular system means: copy agent folder → edit config → new agent runs.

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

An agent is a portable unit. It can run on any machine independently — no dependency on SMBOS, other agents, or the development environment.

### What makes up a deployable agent

```
agent-package/
├── agents/<agent-id>/
│   ├── agent.md          # System prompt, personality, boundaries
│   ├── config.yaml       # Tools + schedules
│   ├── .env.example      # Which secrets to fill in (no real values)
│   └── memory/           # Empty or pre-seeded with initial context
├── mcp/                  # Only custom MCP servers this agent uses
│   └── <server-name>/    # (skip if agent uses only npm MCP packages)
└── install.sh            # Setup script: install NanoClaw + MCP deps
```

### Deployment scenarios

| Scenario | What to deliver | How to run |
|----------|----------------|-----------|
| **Your machine** (dev) | Just the `agents/` folder, everything local | `nanoclaw --agent agents/<id>/ --port 31XX` |
| **Client's server** (production) | Agent package + NanoClaw | Client fills `.env`, runs `install.sh`, then `nanoclaw start` |
| **VPS / cloud** | Same package + Docker | `docker run -v ./agents/<id>:/agent -p 3100:3100 nanoclaw` |
| **Multiple agents on one machine** | Multiple agent folders | Each on its own port: `:3100`, `:3101`, `:3102` |
| **Standalone (no SMBOS)** | Agent package only | Works via Telegram/Slack/Discord — no web UI needed |
| **With SMBOS dashboard** | Agent package + SMBOS | SMBOS connects to agent's port for web visualization |

### install.sh (example)

```bash
#!/bin/bash
# Install NanoClaw
npm install -g nanoclaw

# Install MCP server dependencies
cd mcp/telegram-bot && npm install && cd ../..

# Prompt for secrets
if [ ! -f agents/<agent-id>/.env ]; then
  cp agents/<agent-id>/.env.example agents/<agent-id>/.env
  echo "Fill in agents/<agent-id>/.env with your API keys, then run:"
  echo "  nanoclaw --agent agents/<agent-id>/ --port 3100"
  exit 0
fi

# Start
nanoclaw --agent agents/<agent-id>/ --port 3100
```

### Docker deployment

```dockerfile
FROM node:20-alpine
RUN npm install -g nanoclaw

COPY agents/<agent-id>/ /agent/
COPY mcp/ /mcp/

WORKDIR /agent
EXPOSE 3100

CMD ["nanoclaw", "--agent", "/agent/", "--port", "3100"]
```

```bash
# Build and run
docker build -t agent-marketing-studio .
docker run -d --env-file .env -p 3100:3100 agent-marketing-studio
```

### Delivering to a client (step by step)

1. **Prepare** — create agent folder, write agent.md with client's brand/context, configure tools in config.yaml
2. **Strip secrets** — ensure `.env` is `.env.example` with placeholder values
3. **Bundle** — zip the agent package (agent folder + custom MCP servers + install script)
4. **Send** — deliver to client (git repo, zip, or Docker image)
5. **Client setup** — client fills `.env` with their API keys, runs install script
6. **Verify** — agent responds via configured channel (Telegram, Slack, web)

### Updating a deployed agent

| What changed | How to update |
|-------------|--------------|
| System prompt (agent.md) | Replace file, restart NanoClaw |
| Tools (config.yaml) | Replace file, restart NanoClaw |
| Secrets (.env) | Replace file, restart NanoClaw |
| Memory (memory/) | Files update live — no restart needed |
| MCP server code | Replace files, `npm install`, restart NanoClaw |
| NanoClaw itself | `npm update -g nanoclaw`, restart |

No redeployment of SMBOS or other agents needed. Each agent is updated independently.
