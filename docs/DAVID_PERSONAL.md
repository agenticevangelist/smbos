# David's Personal Agents & Use Cases

Everything below is a specific implementation on top of the core platform. Removing this does not break the system.

---

## Agent #1: Personal Assistant (Andy)

| Field | Value |
|-------|-------|
| Name | Andy (configurable) |
| Role | Personal planner + assistant |
| Users | Only David |
| Channels | Telegram bot, SMBOS web, Telegram userbot (monitoring) |

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
| Morning briefing | `0 8 * * *` | Calendar + Notion + Telegram → summary to bot |
| Deadline check | `0 */4 * * *` | Notion deadlines → remind if < 24h |
| Evening review | `0 21 * * *` | What was done, what's left → send to bot |
| Telegram monitor | `*/5 * * * *` | Check monitored chats for messages needing attention |

### Personal Roadmap

| # | Task | Blocker | Purpose |
|---|------|---------|---------|
| 15 | Build `mcp/telegram-bot/` MCP server | #13 | Telegram Bot API tools |
| 16 | Wire NanoClaw ↔ Telegram bot (bidirectional) | #15 | Incoming messages trigger agent |
| 17 | Build `mcp/telegram-userbot/` (TDLib) | #16 | Monitor chats, act as user |
| 18 | Integrate Google Calendar MCP | #16 | Read/create events |
| 19 | Integrate Notion MCP | #16 | Track tasks, update statuses |
| 20 | Morning briefing + deadline tracking | #18, #19 | Automated daily flows |

---

## Agent #2: Muqta (Discount App)

```
agents/muqta/
```

| Field | Value |
|-------|-------|
| Users | David + co-founder |
| Purpose | Product search, client communication, analytics, discount uploads |
| Model | TBD |
| Primary channel | TBD |

### Tools needed

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| Product search source | MCP | Find products and discounts | Not built |
| Client messaging | MCP | Communicate with clients | Not built |
| Analytics dashboard | Skill | View discount performance | Not built |
| Discount uploader | MCP/CLI | Upload discounts to app backend | Not built |
| App backend API | MCP | CRUD operations on app data | Not built |

### Schedules

| Schedule | Cron | Action |
|----------|------|--------|
| Daily scan | TBD | Scan for new discounts |
| Client follow-up | TBD | Check client responses |
| Analytics report | TBD | Generate daily/weekly report |

### Open questions

- What is the app backend? (API URL, auth method)
- Where do discounts come from? (websites, APIs, manual)
- What client messaging platform? (WhatsApp, Telegram, in-app)
- What analytics metrics matter?

---

## Agent #3: Business Projects (David + Wife)

```
agents/business-projects/
```

| Field | Value |
|-------|-------|
| Users | David + wife (shared, possibly different permissions) |
| Purpose | Project management, data analysis, invoicing, reports |
| Model | TBD |
| Primary channel | TBD |

### Tools needed

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| Data analysis (Excel, Python, PDF) | CLI/MCP | Parse and analyze data | Not built |
| Client communication | MCP | Send invoices, reports, updates | Not built |
| Email | MCP | Read/send emails | Not built |
| Google Calendar | MCP | Shared calendar management | Reuse from Agent #1 |
| Notion/Obsidian | MCP | Shared workspace | Reuse from Agent #1 |
| Invoice generator | Skill | Create and send invoices | Not built |
| Report generator | Skill | Generate client reports | Not built |

### Schedules

| Schedule | Cron | Action |
|----------|------|--------|
| Task reminder | TBD | Remind both users about pending tasks |
| Path correction | TBD | Analyze project trajectory, alert if off-track |
| Client status check | TBD | Check client communication status |

### Open questions

- Same Telegram bot for both, or separate?
- Permission model: can wife see everything, or scoped access?
- What data formats? (Excel templates, PDF types)
- What email provider? (Gmail, Outlook, SMTP)
- What does "correct path" mean? (deadlines, budget, milestones)

---

## Agent #4: Marketing Studio (Client)

```
agents/marketing-studio/
```

| Field | Value |
|-------|-------|
| Users | Marketing studio team (not David) |
| Purpose | Brand tone of voice, creative tools |
| Model | TBD |
| Tone of voice | Brand guidelines — embedded in agent.md |
| Primary channel | TBD |

### Tools needed

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| Text generator | Skill | Generate copy in brand voice | Not built |
| Image generator | MCP/CLI | DALL-E, Midjourney API | Not built |
| Brand guidelines checker | CLI | Validate content against brand rules | Not built |
| Content calendar | MCP | Plan and schedule content | Not built |
| Social media poster | MCP | Post to social platforms | Not built |

### Schedules

| Schedule | Cron | Action |
|----------|------|--------|
| Content calendar check | TBD | Remind about upcoming content deadlines |

### Open questions

- Which brand(s)? One agent per brand or multi-brand?
- Image generation service? (DALL-E, Midjourney, Stable Diffusion)
- Social platforms? (Instagram, Facebook, LinkedIn, TikTok)
- Who are the users? (copywriters, designers, managers)
- Access control model?

---

## Agent #5: 21dev (Developer Support)

```
agents/21dev/
```

| Field | Value |
|-------|-------|
| Users | David + team |
| Purpose | Monitor Discord, Slack, Featurebase — analyze tickets, respond |
| Model | TBD |
| Primary channel | TBD |

### Tools needed

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| Discord | MCP | Read messages, respond to tickets | Not built |
| Slack | MCP | Read messages, respond to tickets | Not built |
| Featurebase | MCP | Read/update feature requests and bugs | Not built |
| Knowledge base | MCP/CLI | Search docs, codebase, past answers | Not built |
| Ticket analyzer | Skill | Dashboard of ticket trends | Not built |

### Schedules

| Schedule | Cron | Action |
|----------|------|--------|
| Ticket scan | TBD | Check new tickets across all platforms |
| Daily summary | TBD | Summarize ticket activity, unresolved issues |

### Open questions

- Which Discord server(s) and channels?
- Which Slack workspace(s) and channels?
- Featurebase API access?
- Auto-respond or draft responses for approval?
- Knowledge base source? (docs, codebase, wiki)

---

## Agent #6: Delivery Flow

```
agents/delivery-flow/
```

| Field | Value |
|-------|-------|
| Users | David + team |
| Purpose | WhatsApp campaigns, find clients, validate, analyze |
| Model | claude-sonnet-4-6 |
| Primary channel | TBD |

### Tools needed

| Tool | Type | Purpose | Status |
|------|------|---------|--------|
| WhatsApp sender | Skill | Send campaign messages | Exists |
| Client finder | Skill | Find potential clients | Partially exists |
| Client validator | CLI/MCP | Validate client data | Not built |
| Delivery analytics | Skill | Analyze delivery performance | Exists |
| Customer CRM | Skill | Manage client relationships | Exists |

### Schedules

| Schedule | Cron | Action |
|----------|------|--------|
| Lead generation | TBD | Scan for new potential clients |
| Campaign follow-up | TBD | Check message delivery/responses |
| Analytics report | TBD | Generate performance report |

### Open questions

- Which WhatsApp number/account?
- Client validation criteria?
- Campaign frequency limits?
- Existing skills sufficient or need new ones?

---

## Scaffold Task (#25)

When #23 is complete, create all agent folders:

| Agent | Folder |
|-------|--------|
| Muqta | `agents/muqta/` |
| Business Projects | `agents/business-projects/` |
| Marketing Studio | `agents/marketing-studio/` |
| 21dev | `agents/21dev/` |
| Delivery Flow | `agents/delivery-flow/` |

Each: `agent.md` + `config.yaml` + `.env.example` + `memory/`. Tools and schedules as placeholders.
