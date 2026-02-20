# SMBOS — Development Progress & Roadmap

---

## Архитектурный принцип

**NanoClaw = ядро.** Всё intelligence (чат, сессии, scheduling, MCP tools, memory) — через NanoClaw агентов. SMBOS — это UI shell: рендерит данные, отправляет действия пользователя агентам.

### Что NanoClaw даёт из коробки (НЕ дублировать)

| Возможность | Как работает |
|-------------|-------------|
| Сессии чата | Server-side в SQLite, per-group. Клиент не отправляет sessionId |
| HTTP API | `GET /api/health`, `POST /api/chat` (SSE: typing→message→done) |
| MCP tools | `send_message`, `schedule_task`, `list_tasks`, `pause_task`, `resume_task`, `cancel_task`, `register_group` |
| Scheduler | cron/interval/once, каждый таск запускает Docker контейнер с полным доступом агента |
| Agent Swarms | Sub-agent orchestration через teams |
| Memory | CLAUDE.md (global + per-group), auto-memory enabled |
| Container isolation | Docker, configurable image/timeout/concurrency |

### Что строит SMBOS (NanoClaw не имеет)

| Возможность | Статус |
|-------------|--------|
| Multi-agent lifecycle (start/stop/restart NanoClaw инстансов) | ✅ Готово |
| Agent config management (agent.md + config.yaml) | ✅ Готово |
| SMBOS-side logging (`data/logs/{agentId}.jsonl`) | ✅ Готово |
| Skill system (ui.json rendering, execute.ts) | ✅ Готово |
| Health check (polling `GET /api/health`) | ✅ Готово |
| Chat persistence (localStorage) | ✅ Готово |
| Cron UI controls (toggle, manual trigger) | ✅ Готово |
| Log viewer в Agent detail | ✅ Готово |

---

## ✅ Рефакторинг — ВЫПОЛНЕНО

- Удалены: `carbondocs/`, `docs/`, `info/`, `app/api/usage/`, `postcss.config.mjs`
- Очищены: `.gitignore`, `package.json` (убран tailwind, googlemaps), `next.config.ts`
- Удалены `console.log` из компонентов
- CLAUDE.md сжат до ~70 строк с актуальными правилами

---

## ✅ Phase 1: Agent Framework — ВЫПОЛНЕНО

### Файлы

```
lib/agents/types.ts          — AgentFrontmatter, AgentTool, AgentSchedule, AgentConfig, AgentSummary, AgentStatus
lib/agents/config.ts         — parseAgentMd(), parseConfigYaml(), loadAgent()
lib/agents/registry.ts       — getAllAgentConfigs(), getAgentConfig(), getAllAgents(), getAgentsDir()
lib/agents/lifecycle.ts      — startAgent(), stopAgent(), restartAgent(), getProcessInfo(), getAgentStatus()
lib/agents/scheduler.ts      — startScheduler(), stopScheduler(), getActiveSchedules()
lib/agents/logger.ts         — logEvent(), getLogs(), clearLogs()
agents/personal/             — Agent #1 шаблон (agent.md, config.yaml, .env.example, memory/)
```

### API Routes

| Route | Method | Что делает |
|-------|--------|-----------|
| `/api/agents` | GET | Список агентов из filesystem |
| `/api/agents` | POST | Scaffold новую папку агента |
| `/api/agents` | DELETE | Удалить папку агента |
| `/api/agents/[id]` | GET | Полный конфиг + runtime статус |
| `/api/agents/[id]` | PATCH | Обновить schedule enabled/disabled |
| `/api/agents/[id]` | POST | Manual trigger (отправляет action в NanoClaw) |
| `/api/agents/[id]/start` | POST | Запуск NanoClaw + cron schedules |
| `/api/agents/[id]/stop` | POST | Остановка + cron cleanup |
| `/api/agents/[id]/status` | GET | Runtime статус |
| `/api/agents/[id]/logs` | GET | Логи агента (JSONL) |
| `/api/agents/[id]/logs` | DELETE | Очистить логи |
| `/api/scheduled-tasks` | GET | Все schedules из всех агентов |

### UI Components

| Компонент | Что делает |
|-----------|-----------|
| `Agents.tsx` | Grid карточек, Create/Delete/Start/Stop/Restart, Detail modal с Tabs (Overview + Logs) |
| `AgentChat.tsx` | Agent selector, health check через `/api/health`, localStorage persistence, SSE streaming, Clear chat |
| `ScheduledTasks.tsx` | Таблица schedules, Toggle enable/disable (пишет config.yaml), Manual trigger Run Now |
| `AppShell.tsx` | Удалены noop кнопки (Search, Notifications, User Profile) — TODO через NanoClaw |

### Logging

- Lifecycle events: `agent:start`, `agent:stop`, `agent:error`
- Cron events: `cron:trigger`, `cron:success`, `cron:error`
- Хранение: `data/logs/{agentId}.jsonl`
- API: `GET /api/agents/[id]/logs?limit=50&type=cron:error&since=2026-02-20T00:00:00Z`

---

## Roadmap — полный порядок выполнения

```
#13  Verify NanoClaw end-to-end                          ← НАЧАТЬ ЗДЕСЬ
 ├── #14  Extend NanoClaw HTTP API (multi-group)
 ├── #15  Build mcp/telegram-bot/ MCP server
 │    └── #16  Wire NanoClaw ↔ Telegram bot
 │         ├── #17  Build mcp/telegram-userbot/
 │         ├── #18  Integrate Google Calendar MCP
 │         ├── #19  Integrate Notion MCP
 │         │    └── #20  Morning briefing + deadline flows  (needs #18 + #19)
 │         └── #24  SMBOS UI: search, notifications, profile
 └── #21  Memory tools (update_memory, context injection)
      └── #22  edit_own_config meta-tool
           └── #23  Sub-agent creation (create + spawn)
                └── #25  Scaffold agents #2-6
```

Два параллельных трека после #13:
- **Каналы + интеграции:** Telegram → Calendar/Notion → briefings → UI
- **Self-improvement:** memory → config editing → sub-agents → остальные агенты

---

## ⬜ #13 — Verify NanoClaw end-to-end

**Блокер для всего.** Доказать что полный стек работает: SMBOS → NanoClaw → Claude → ответ.

- [ ] Build Docker image (`nanoclaw-agent:latest`)
- [ ] Настроить `.env` для personal agent (ANTHROPIC_API_KEY или CLAUDE_CODE_OAUTH_TOKEN)
- [ ] Start agent через SMBOS UI
- [ ] Отправить сообщение через AgentChat → получить ответ
- [ ] Починить что сломано в `nanoclaw/` или `lifecycle.ts`

---

## ⬜ #14 — Extend NanoClaw HTTP API (multi-group)

**Blocked by: #13**

Сейчас web-chat использует один хардкод group (`web-chat`). Расширить `POST /api/chat` чтобы принимать `groupId` — SMBOS сможет вести несколько разговоров на одного агента. Добавить `GET /api/sessions` для списка групп. Правки в `nanoclaw/src/http-server.ts`.

---

## ⬜ #15 — Build mcp/telegram-bot/ MCP server

**Blocked by: #13** | **Phase 2.1**

MCP server для Telegram Bot API. Tools: `send_message`, `get_updates`, `set_webhook`. Токен бота из `.env` агента. NanoClaw спавнит как stdio MCP server по config.yaml.

---

## ⬜ #16 — Wire NanoClaw ↔ Telegram bot (bidirectional)

**Blocked by: #15** | **Phase 2.3**

Входящие сообщения Telegram триггерят агента (webhook или polling). Ответы агента отправляются обратно через бота. Зарегистрировать Telegram как channel в NanoClaw. Правки в `nanoclaw/` — добавить Telegram channel рядом с WhatsApp и web-chat.

---

## ⬜ #17 — Build mcp/telegram-userbot/ MCP server

**Blocked by: #16** | **Phase 2.2**

TDLib-based юзербот для мониторинга чатов. Tools: `read_messages`, `send_as_user`, `list_chats`, `monitor_chat`. Работает от твоего Telegram аккаунта. Мощнее бота — читает любой чат где ты есть.

---

## ⬜ #18 — Integrate Google Calendar MCP server

**Blocked by: #16** | **Phase 3.1**

`@anthropic/google-calendar-mcp` или свой. Tools: `list_events`, `create_event`, `get_event`. OAuth2 для Google API. Агент читает расписание, создаёт напоминания. Подключить в config.yaml как MCP tool.

---

## ⬜ #19 — Integrate Notion MCP server

**Blocked by: #16** | **Phase 3.2**

`@anthropic/notion-mcp` или свой. Tools: `query_database`, `get_page`, `update_page`, `create_page`. Notion API key из `.env`. Агент трекает задачи, обновляет статусы проектов, читает дедлайны.

---

## ⬜ #20 — Morning briefing + deadline tracking

**Blocked by: #18, #19** | **Phase 3.3–3.4**

Cron schedules в personal agent:
- Morning briefing (`0 8 * * *`): Calendar + Notion + Telegram → сводка в Telegram бот
- Deadline check (`0 */4 * * *`): Notion → напоминание если < 24ч
- Evening review (`0 21 * * *`): что сделано, что осталось

---

## ⬜ #21 — Memory tools (update_memory, context injection)

**Blocked by: #13** | **Phase 4.1+4.3**

NanoClaw уже имеет CLAUDE.md per-group и auto-memory. Проверить что работает. Если нужно — добавить MCP tool `update_memory` для записи в `memory/`. Загрузка `memory/` файлов в контекст агента при старте сессии. Тест: агент узнаёт предпочтение → сохраняет → использует в следующей сессии.

---

## ⬜ #22 — edit_own_config meta-tool

**Blocked by: #21** | **Phase 4.2**

Агент может менять свой `agent.md`, `config.yaml` (НЕ `.env`). MCP tool или встроенный в NanoClaw. Use case: агент понимает что ему нужен новый tool → добавляет в config.yaml.

---

## ⬜ #23 — Sub-agent creation (create_agent + spawn_agent)

**Blocked by: #22** | **Phase 5**

`create_agent`: scaffold `agents/{id}/` с шаблоном. `spawn_agent`: запуск NanoClaw на динамическом порту (3101+). NanoClaw имеет Agent Swarms — оценить достаточно ли, или нужна SMBOS-side оркестрация. Inter-agent communication через MCP `send_message`.

---

## ⬜ #24 — SMBOS UI: search, notifications, user profile

**Blocked by: #16**

Вернуть удалённые кнопки в header, теперь через NanoClaw:
- **Search**: запрос агенту → поиск по skills, agents, memory → рендер
- **Notifications**: agent pushes events через SSE/event bus
- **User Profile**: agent управляет preferences в memory/

---

## ⬜ #25 — Scaffold agents #2–6 templates

**Blocked by: #23**

Создать папки агентов с конфигами:
- **Muqta** — поиск скидок, клиенты, аналитика
- **Business Projects** — данные, инвойсы, отчёты (ты + жена)
- **Marketing Studio** — tone of voice, генерация контента (клиент)
- **21dev** — Discord/Slack/Featurebase, тикеты (команда)
- **Delivery Flow** — WhatsApp кампании, поиск клиентов (команда)

Каждый: `agent.md` + `config.yaml` + `.env.example` + `memory/`. Tools и schedules как плейсхолдеры из `agent-system-plan.md`.

---

## Что НЕ делаем

- НЕ дублируем то что NanoClaw уже делает (сессии, MCP, scheduling engine)
- НЕ удаляем навыки — самодостаточные, не мешают
- НЕ меняем `DynamicSkillUI.tsx` — работает правильно

**NanoClaw — наше ядро.** Меняем когда нужно. Но перед правкой — читаем существующий код, понимаем архитектуру.

---

## Текущие файлы проекта

```
smbos/
├── app/
│   ├── page.tsx, layout.tsx, globals.scss
│   └── api/
│       ├── skills/           — GET list, GET [id], POST execute, PATCH config
│       ├── agents/           — GET/POST/DELETE, [id] GET/PATCH/POST, start, stop, status, logs
│       └── scheduled-tasks/  — GET (reads from agent configs)
├── components/
│   ├── AppShell.tsx + .scss  — Three-panel layout
│   ├── DynamicSkillUI.tsx + .scss — Skill renderer
│   ├── AgentChat.tsx         — Chat with health check + localStorage persistence
│   ├── Dashboard.tsx         — Skills grid + management tiles
│   ├── Agents.tsx            — Agent management with logs viewer
│   ├── ScheduledTasks.tsx    — Cron table with toggle + manual trigger
│   └── SkillsManagement.tsx  — Skill visibility + metadata editor
├── lib/
│   ├── skills/registry.ts    — Skill discovery from filesystem
│   ├── events/skillEvents.ts — Event bus
│   └── agents/
│       ├── types.ts, config.ts, registry.ts
│       ├── lifecycle.ts, scheduler.ts, logger.ts
├── skills/                   — 21 skills + _shared/
├── agents/                   — Agent folders (personal/)
├── data/                     — Runtime storage (logs/)
├── nanoclaw/                 — NanoClaw — наше ядро
├── CLAUDE.md                 — Agent rules (~70 строк)
├── REFACTOR_PLAN.md          — Этот файл
└── agent-system-plan.md      — Полный архитектурный план (6 агентов)
```
