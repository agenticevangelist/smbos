# SMBOS Agency Platform — Full OpenClaw Integration Proposition

> **Goal:** Run a complete AI agency from SMBOS. Create clients, provision agents for them,
> configure channels, personas, memory, scheduled tasks, subagents, webhooks, hooks, and
> monitor everything live — all through one UI backed by the OpenClaw Gateway RPC.

---

## Agency Data Model

```
Agency (your SMBOS instance)
  └── Clients  (your paying customers / projects)
        └── Agents  (one or more per client, each a fully isolated OpenClaw agent)
              ├── Identity          SOUL.md, AGENTS.md, IDENTITY.md, USER.md
              ├── Channels          Telegram bots, WhatsApp numbers, Discord bots, Slack, etc.
              ├── Bindings          routing rules: which channel/peer → this agent
              ├── Heartbeat         periodic agent turns with checklist
              ├── Cron Jobs         scheduled isolated or main-session tasks
              ├── Hooks             event-driven automation (session-memory, command-logger, boot-md, custom)
              ├── Webhooks          inbound HTTP triggers from external systems
              ├── Memory            MEMORY.md + daily memory/YYYY-MM-DD.md files, vector search
              ├── Sessions          per-channel/per-peer/per-subagent conversation history
              ├── Subagents         spawned background workers, orchestrator pattern
              ├── Skills            per-agent tool packs (enable/disable/install)
              ├── Models            primary + fallback chain per agent, per-channel overrides
              └── Nodes             connected iOS/Android/macOS/headless capability devices
```

---

## Full OpenClaw RPC Surface Available Today

All of this comes from one WebSocket connection to the Gateway on port 18789.

### Core RPC Methods

| Method | What it does |
|--------|-------------|
| `config.get` | Read entire `~/.openclaw/openclaw.json` |
| `config.patch` | Write any field in config (with base-hash collision guard) |
| `config.schema` | JSON Schema for all config fields → drive form rendering |
| `config.apply` | Apply + restart gateway after config change |
| `chat.send` | Start an agent run (non-blocking, streams via `chat` events) |
| `chat.history` | Load transcript for any session key |
| `chat.abort` | Abort a running turn (by runId or sessionKey) |
| `chat.inject` | Append an assistant note to transcript without triggering a run |
| `agents.list` | List agent ids + allowed subagent targets |
| `cron.list` | All cron jobs with schedule, last run, next run |
| `cron.add` | Create a cron job (one-shot or recurring, main or isolated) |
| `cron.update` | Patch a cron job (schedule, payload, delivery, model) |
| `cron.remove` | Delete a cron job |
| `cron.run` | Force-run a job immediately |
| `cron.runs` | Run history for a job (JSONL records) |
| `cron.status` | Status of the cron scheduler |
| `sessions.list` | All sessions for an agent with metadata (tokens, updatedAt, origin) |
| `sessions.patch` | Override thinking/verbose/model per session |
| `skills.list` | All skills + enabled/disabled status |
| `skills.enable` / `skills.disable` | Toggle a skill |
| `skills.install` | Install a skill from ClawHub |
| `skills.bins` | List skill binaries (for node auto-allow) |
| `exec.approvals.get` | Read exec allowlists (gateway + per node) |
| `exec.approvals.set` | Write exec allowlists |
| `exec.approval.resolve` | Approve or deny a pending exec request live |
| `node.list` | All connected nodes with caps, commands, permissions |
| `logs.tail` | Tail gateway log file with filter |
| `models.list` | Available models for the gateway |
| `health` | Full health snapshot (channels, sessions, probe results) |
| `status` | Gateway status summary |
| `system-presence` | All connected clients/nodes live |
| `update.run` | Trigger a package update + restart |
| `channels.status` | Per-channel connectivity status |

### Real-Time Events

| Event | What it carries |
|-------|----------------|
| `chat` | `state: delta/final`, text chunks, runId |
| `agent` | Tool calls, run start/end, subagent announce, status |
| `heartbeat` | Agent alive/idle ping per agent |
| `cron` | Job fired, job finished (with summary, stats) |
| `presence` | Connected clients list update |
| `exec.approval.requested` | Pending shell command needing approval |

---

## Feature Breakdown — What to Build

### 1. Client Management

**What it is:** A `Clients` section (top of left sidebar). Each client is a logical container
owned by the agency, holding one or more agents.

**Why it doesn't exist yet:** OpenClaw has `agents.list` but no concept of a "client" that groups them.
We store the client → agent mapping in a local SMBOS data layer (JSON file or SQLite, or just a metadata file per agent workspace).

**What to build:**
- Client list page: cards per client with agent count, active channel count, last activity
- Create client form: name, notes, pick/create agents
- Client overview: all agents in a row, each showing heartbeat status + last message

**Implementation:**
- Local Next.js API: `GET/POST/PATCH /api/clients` — JSON file at `~/.openclaw/smbos-clients.json`
- Each client has `{ id, name, agentIds[], createdAt, notes }`
- No gateway RPC needed — pure metadata layer

---

### 2. Agent Provisioning Wizard

**What it is:** "New Agent" wizard that fully provisions an isolated OpenClaw agent.

**What OpenClaw gives us:**
- `agents.list` in config declares agents under `agents.list[]`
- Each agent needs: `id`, `workspace`, `agentDir`, optional `name`, `model`, `heartbeat`, `sandbox`, `tools`
- The `openclaw agents add <id>` CLI command creates the workspace directory + starter files
  (`SOUL.md`, `AGENTS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `TOOLS.md`, `BOOTSTRAP.md`)

**Steps the wizard covers:**
1. Agent ID + display name + emoji (written to `IDENTITY.md`)
2. Model selection: primary model + fallback chain (`agents.list[].model.primary`, `.model.fallbacks[]`)
3. Persona template: pick from "Customer Support", "Sales Outreach", "Research Assistant",
   "Scheduler", "Personal Assistant" → seeds `SOUL.md` and `AGENTS.md`
4. Heartbeat: enable/disable, interval (e.g. 30m), active hours, delivery target
5. Session isolation: `dmScope` — `main`, `per-peer`, `per-channel-peer`, `per-account-channel-peer`
6. Sandbox: off / ask / allowlist / full docker
7. Confirm → `config.patch` with new agent + shell `openclaw agents add <id>`

**New API route:** `POST /api/openclaw/agent/create` — execs `openclaw agents add <id>` on the host

---

### 3. Agent Overview Page (Status Dashboard per Agent)

**What it is:** The default landing page when you click an agent — real-time status at a glance.

**Panels:**
- **Status bar**: agent running/idle (heartbeat event), gateway health (`health` RPC), uptime
- **Active sessions**: list from `sessions.list` — each row: session key, channel, last message time, token count
- **Active subagents**: live subagent runs from `agent` events filtered to this agent's sessions
- **Channel bindings**: which channel accounts are routed here (from `config.get` `bindings[]`)
- **Upcoming cron jobs**: next 3 fires from `cron.list` filtered by `agentId`
- **Memory**: count of daily files, last write date, MEMORY.md word count (read via `/api/workspace/<agentId>/files`)
- **Skills active**: count and names from `skills.list` filtered for this agent

**Implementation:** All data from Gateway RPC. Sessions from `sessions.list`, cron from `cron.list`,
events from `agent` WS events.

---

### 4. Real-Time Activity Feed

**What it is:** A live log of what the agent is doing — every run, tool call, subagent spawn.

**OpenClaw events to consume:**
- `agent` event with `type: "run"`, `status: "start" | "end"` — agent turn started/finished
- `agent` event with `type: "tool"` — tool call with name, params (exec, web_search, memory_write, sessions_spawn, etc.)
- `agent` event with `type: "subagent"` — subagent spawned or finished with announce
- `chat` event with `state: "final"` — final assistant reply
- `cron` event with job result — scheduled task fired

**Display:** Timeline rows like:
```
09:14 🔄 Heartbeat run started          (main session)
09:14 🛠 exec: git status               (tool call)
09:14 🛠 memory_write: daily note       (tool call)
09:14 ✅ Heartbeat complete             HEARTBEAT_OK
09:15 📩 Message received from Telegram  @user123
09:15 🔄 Agent run started
09:15 🛠 web_search: "competitor pricing"
09:15 🔀 Spawned subagent: research-worker
09:15 ✅ Run complete                   (142 tokens)
```

**Implementation:** WebSocket `agent` + `chat` event listener in `useOpenClaw`, filtered by agentId,
stored in local ring buffer (last 200 events), rendered as a scrollable feed.

---

### 5. Session Browser

**What it is:** Full view of all sessions for an agent — every conversation across every channel.

**What OpenClaw gives us:**
- `sessions.list` RPC returns all sessions with:
  - `sessionKey` (e.g. `agent:main:telegram:dm:123456789`)
  - `sessionId` (stable JSONL filename)
  - `updatedAt`, `inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`
  - `origin.label`, `origin.provider`, `origin.from` — human-readable labels
  - `displayName`, `channel`, `subject` for group sessions
- `sessions.patch` — override `thinking`, `verbose`, `model` per session
- `chat.history` — load full transcript for any session key

**UI:**
- Table view: session key decoded as "Telegram / @username", "Discord / #channel", "WhatsApp / +1xxx"
- Columns: channel, contact, tokens, last active, action buttons
- Click → opens chat sidebar with that session's transcript
- Per-session controls: force reset (via `chat.inject`), model override, verbose toggle
- **Session isolation config**: `dmScope` picker — change how DMs are grouped per agent

**dmScope options (critical for agency):**
- `main` — all DMs merge into one session (single user agent)
- `per-channel-peer` — each person on each channel gets own session (recommended for shared inboxes)
- `per-account-channel-peer` — full isolation across accounts + channels + senders

---

### 6. Channel & Binding Manager

**What it is:** Configure which channel accounts this agent uses and how messages route to it.

**What OpenClaw gives us:**
- `channels` config section: `telegram.accounts`, `discord.accounts`, `whatsapp.accounts`, `slack`, etc.
- `bindings[]` array: routing rules `{ agentId, match: { channel, accountId?, peer? } }`
- Most-specific-wins routing: peer → parentPeer → guildId+roles → guildId → teamId → accountId → channel → default
- Per-channel model override: `channels.modelByChannel.<channel>.<channelId>` → pinned model
- Per-group config: `telegram.groups`, `discord.guilds` — requireMention, skills, systemPrompt per group/channel
- Thread bindings: `discord.threadBindings` — spawn subagents per Discord thread, TTL

**UI per channel type:**
- **Telegram**: add bot token → `channels.telegram.accounts.<id>.botToken`, set dmPolicy, group allowlists
- **Discord**: add bot token → `channels.discord.accounts.<id>.token`, configure guilds + channels
- **WhatsApp**: link QR code flow (already have `web.login.*` RPC), multi-account management
- **Slack**: add botToken + appToken, configure channel allowlist
- **Webhook inbound**: enable `hooks.enabled`, set token, configure mappings

**Binding editor:** Visual rule builder:
```
IF channel = telegram AND accountId = "client-a-bot"
THEN → route to agent "client-a"
```

---

### 7. Heartbeat Manager

**What it is:** Per-agent heartbeat configuration — the agent's "always-on" background behavior.

**What OpenClaw gives us:**
- `agents.list[].heartbeat` block: `every`, `model`, `target`, `to`, `accountId`, `prompt`, `ackMaxChars`, `activeHours`, `includeReasoning`
- `HEARTBEAT.md` in workspace: the checklist the agent follows every N minutes
- `channels.defaults.heartbeat`: `showOk`, `showAlerts`, `useIndicator` per channel
- If any agent has a `heartbeat` block, only those agents run heartbeats
- Active hours: restrict to business hours (`09:00` – `22:00` in any timezone)
- Manual wake: RPC `system-event` with `mode: now`

**UI:**
- Toggle: heartbeat on/off for this agent
- Interval picker: 15m / 30m / 1h / 2h / custom
- Active hours: time range picker + timezone selector (IANA timezone list)
- Delivery target: last / telegram / whatsapp / discord / slack / none
- HEARTBEAT.md editor: markdown textarea with preview, auto-saves to workspace
- Model override: cheaper model for heartbeat runs to save tokens
- "Wake now" button: calls `system-event` RPC immediately
- `includeReasoning` toggle: show the agent's internal reasoning in heartbeat messages

---

### 8. Cron Job Manager (Enhanced)

**What it is:** Full cron job management — create, edit, run, view history.

**What OpenClaw gives us:**
- `cron.add` with:
  - `schedule`: `at` (ISO 8601 one-shot), `every` (ms interval), `cron` (5/6-field with timezone)
  - `sessionTarget`: `main` (heartbeat context) or `isolated` (fresh dedicated session)
  - `payload`: `systemEvent` (for main) or `agentTurn` (for isolated) with `message`, `model`, `thinking`, `timeoutSeconds`
  - `delivery`: `mode` (`announce` → deliver to channel, `webhook` → HTTP POST, `none` → internal only)
  - `delivery.channel`, `delivery.to` — where to send results
  - `agentId` — pin job to specific agent
  - `deleteAfterRun` for one-shot jobs
- `cron.runs` — full JSONL history per job
- `cron.run` — force run immediately
- Jobs persisted at `~/.openclaw/cron/jobs.json`

**UI enhancements over current:**
- **Visual schedule builder**: "Every X minutes" / "Daily at HH:MM" / "Custom cron" tabs
- **Session mode picker**: Main (shares context, sees memory + heartbeat) vs Isolated (fresh session, own context)
- **Delivery picker**: None (silent) / Announce to channel / Webhook URL
- **Model + thinking override**: for isolated jobs, pick a cheaper or smarter model
- **Run history table**: last 20 runs with status (ok/error/skipped), runtime, token usage
- **Job output preview**: click a run → see what the agent said (from `cron.runs`)
- **Multi-agent cron**: dropdown to assign job to specific agent (agency-wide cron dashboard)
- **Webhook delivery**: paste a webhook URL, set cron token → get results POSTed to your system

---

### 9. Hooks Manager

**What it is:** Manage OpenClaw hooks — event-driven automation scripts that fire on agent lifecycle events.

**What OpenClaw gives us (not yet exposed in SMBOS):**
- Hook event types:
  - `command:new` — fires when `/new` is sent (session reset)
  - `command:reset` — fires on `/reset`
  - `command:stop` — fires on `/stop`
  - `agent:bootstrap` — fires before workspace files are injected (can mutate bootstrap files)
  - `gateway:startup` — fires when gateway starts (e.g. run `BOOT.md`)
  - `message:received` — every inbound message from any channel (with from, content, channelId)
  - `message:sent` — every outbound message
- Bundled hooks: `session-memory`, `bootstrap-extra-files`, `command-logger`, `boot-md`
- Custom hooks: `~/.openclaw/hooks/<name>/HOOK.md` + `handler.ts`
- Hook management via RPC (list, enable, disable) or config `hooks.internal.entries`

**UI:**
- Hooks list: bundled hooks + any installed custom hooks, enable/disable toggle
- **session-memory hook**: when enabled, saves session context to `memory/YYYY-MM-DD-<slug>.md` on every `/new`
  — critical for agency: every client conversation gets auto-archived to memory
- **command-logger hook**: log all `/new`, `/stop`, `/reset` commands to JSONL — audit trail for the agency
- **boot-md hook**: runs `BOOT.md` on gateway startup — per-agent startup ritual
- **message-logger custom hook**: template to log every inbound message per agent/channel (we provide starter code)
- Status: show which hooks are eligible vs missing requirements (bins, env, config)

**Why this matters for agency:** The `session-memory` hook auto-saves conversations to memory files.
Combined with the Memory page and vector search, every client interaction is automatically preserved and searchable.

---

### 10. Webhook Inbound Manager

**What it is:** Configure HTTP webhook endpoints that trigger agent runs from external systems.

**What OpenClaw gives us:**
- `POST /hooks/wake` — enqueue a system event for the main session (wakes heartbeat)
- `POST /hooks/agent` — run an isolated agent turn with a message, optional delivery back to channel
  - Params: `message`, `agentId`, `sessionKey`, `wakeMode`, `deliver`, `channel`, `to`, `model`, `thinking`, `timeoutSeconds`
- `POST /hooks/<name>` — custom mapped hooks (payload templates, JS/TS transforms)
- Auth: `Authorization: Bearer <token>` or `x-openclaw-token` header
- `hooks.mappings` — transform arbitrary external payloads into agent runs
- `hooks.presets: ["gmail"]` — built-in Gmail Pub/Sub integration
- `hooks.allowedAgentIds` — restrict which agents can be targeted per hook

**UI:**
- Enable/disable webhook endpoint with token (generate random token)
- **Wake endpoint**: copy URL `POST /hooks/wake` + curl example — for simple external triggers
- **Agent endpoint**: copy URL + example payload — for running full agent turns from external systems
- **Webhook mappings**: visual builder for custom payload transforms:
  - Name: "GitHub PR"
  - Match: `payload.source == "github"`
  - Transform: message template `"New PR from {payload.user}: {payload.title}"`
  - Deliver to: specific channel + recipient
  - Agent: route to specific agent
- **Gmail integration**: one-click setup for `hooks.presets: ["gmail"]` — Gmail → agent pipeline
- Show recent webhook calls (from `command-logger` hook logs)

---

### 11. Subagent Activity Monitor

**What it is:** Real-time view of all spawned subagent sessions and their status.

**What OpenClaw gives us (not yet exposed in SMBOS):**
- `sessions.list` returns sessions with keys matching `agent:<id>:subagent:<uuid>`
- `agent` events include subagent run start/end/announce
- Sessions have `origin` metadata: `label`, `provider`, `from`
- Sub-agents run in dedicated sessions, announce back to requester
- Status: session key, sessionId, started, runtime, token usage, result
- `/subagents list|kill|log|info|send|steer` slash commands (we can surface these as RPC)
- `maxSpawnDepth: 2` enables orchestrator pattern: main → orchestrator → workers

**UI:**
- Subagent list per agent: active + recently completed sessions
- Each row: task/label, started at, runtime, status (running/done/timeout), token cost
- Expand → show the announce result (what the subagent reported back)
- Kill button → `chat.abort` for that session key
- Nested view for depth-2: orchestrator with child workers listed beneath
- Session transcript button → load `chat.history` for that subagent session key

---

### 12. Skills Manager

**What it is:** Enable, disable, and install skills per agent.

**What OpenClaw gives us (not yet exposed in SMBOS):**
- `skills.list` — all skills with enabled status, description, requirements
- `skills.enable` / `skills.disable` — toggle per skill
- `skills.install` — install from ClawHub registry (clawhub.com)
- Per-agent skills: live in `<workspace>/skills/` — only that agent sees them
- Shared skills: `~/.openclaw/skills/` — all agents
- Skills have YAML frontmatter: `name`, `description`, `homepage`, requires (bins, env vars, config)
- Skills inject tool descriptions into the model's system prompt

**UI:**
- Skills list: name, description, enabled/disabled toggle, source (bundled/workspace/shared)
- Requirements status: ✅ all met / ⚠️ missing `git` binary / ❌ missing API key
- Install skill: search ClawHub, one-click install to workspace or shared
- Per-agent context: from agent settings page, shows that agent's skills + shared
- API key fields: for skills that need `OPENAI_API_KEY` etc. — secure input that writes to `skills.entries.<name>.apiKey`

---

### 13. Exec Approvals Manager

**What it is:** Control what shell commands agents and nodes are allowed to run.

**What OpenClaw gives us (not yet exposed in SMBOS):**
- `exec.approvals.get` — current allowlist (gateway + per node)
- `exec.approvals.set` — write allowlist
- `exec.approval.requested` event — live pending approvals (agent wants to run a command)
- `exec.approval.resolve` — approve/deny live
- Three modes: `ask` (prompt each time), `allowlist` (pre-approved commands only), `full` (allow all)
- Per-node allowlists: each connected node has its own approval store

**UI:**
- Mode picker: Ask / Allowlist / Full (with security warning for Full)
- Allowlist table: add/remove specific command paths (e.g. `/usr/bin/git`)
- **Live approval queue**: when `exec.approval.requested` fires, show a notification:
  ```
  Agent wants to run: git commit -am "update"
  [Approve] [Deny] [Add to allowlist]
  ```
- Per-node tab: if nodes connected, manage each node's allowlist separately

---

### 14. Instances & Nodes Dashboard

**What it is:** See all connected devices/nodes and their capabilities.

**What OpenClaw gives us:**
- `system-presence` RPC — all connected clients with host, version, mode, deviceFamily
- `node.list` — all connected nodes with `caps` (camera, screen, canvas, location, voice, sms), `commands`, `permissions` map
- Node commands: `canvas.*`, `camera.*`, `screen.*`, `location.*`, `sms.*`, `system.*`
- Presence fields: `host`, `ip`, `version`, `mode` (ui/webchat/cli/node), `lastInputSeconds`
- Presence TTL: 5 minutes, max 200 entries

**UI:**
- Presence list: row per connected client — hostname, IP, version, mode, last seen
- Status indicator: 🟢 Active (< 1 min), 🟡 Idle (< 5 min), ⚫ Stale
- Nodes section: each node with capability badges (📷 Camera, 🖥 Screen, 📍 Location)
- Permission status: which permissions granted/denied per node
- Actions: `node.invoke` quick commands — take screenshot, get location

---

### 15. Gateway Logs Viewer

**What it is:** Live tail of gateway logs with filter — for debugging agent behavior.

**What OpenClaw gives us:**
- `logs.tail` RPC — tail gateway log file with filter string
- File format: JSONL (one JSON per line), fields: timestamp, level, message, subsystem
- Subsystems: `gateway`, `whatsapp/outbound`, `telegram`, `auto-reply`, `cron`, `hooks`, etc.
- `logging.level` config: debug/info/warn/error/trace

**UI:**
- Live log stream via `logs.tail` RPC (already in control-ui, not in SMBOS)
- Filter input: filter by subsystem, level, or text search
- Level badges: 🔴 error, 🟡 warn, 🔵 info, ⚫ debug
- Export: download last N lines as text
- Per-agent filter: filter lines containing `agentId` for focused debugging

---

### 16. Model & Provider Manager

**What it is:** Configure AI models — primary, fallbacks, per-agent, per-channel overrides.

**What OpenClaw gives us:**
- `models.list` RPC — available models from all configured providers
- Config fields:
  - `agents.defaults.model.primary` — default model for all agents
  - `agents.defaults.model.fallbacks[]` — fallback chain if primary fails
  - `agents.list[].model` — per-agent override
  - `channels.modelByChannel.<channel>.<channelId>` — pin a model to a specific channel/group
  - `models.providers.<provider>.models[].cost` — per-model pricing for cost tracking
- Auth profiles: `auth-profiles.json` per agent — API keys + OAuth tokens
- Model failover: auth profile rotation (round-robin by lastUsed) + model fallback chain
- Per-session model override via `sessions.patch`

**UI:**
- Global defaults: primary model picker, fallback chain (drag-to-order)
- Per-agent model override
- Per-channel model override (pin Opus to a high-value Discord channel, Haiku to a high-volume WhatsApp group)
- Model pricing table: fill in `cost.input`/`cost.output` per model → enables cost tracking in chat
- Auth profiles viewer: which API keys are active per agent (without showing the key), cooldown status

---

### 17. Config Schema-Driven Forms

**What it is:** For any config section not covered by a dedicated UI, auto-generate a form from the JSON Schema.

**What OpenClaw gives us:**
- `config.schema` RPC — returns full JSON Schema for all `openclaw.json` fields including plugin + channel schemas
- `config.get` / `config.patch` — read/write any field
- Base-hash guard on `config.patch` prevents overwriting concurrent edits

**UI:**
- "Advanced Config" page per agent: schema-driven form rendered from `config.schema`
- Edit any field with type-appropriate inputs (boolean toggle, string input, array editor, number slider)
- Raw JSON editor fallback (with syntax highlighting)
- `config.apply` button: apply config + restart gateway after changes

---

### 18. Agency-Level Dashboard (Replace Current Dashboard)

**What it is:** The top-level overview of the entire agency operation.

**Sections:**
- **Clients**: N clients, each card showing agent count + status dots
- **Live agents**: which agents are currently running a turn (from `agent` events)
- **Heartbeat health**: next heartbeat for each active agent, last OK/alert time
- **Cron queue**: jobs firing in next 24h across all agents, sorted by time
- **Gateway health**: uptime, connected channels count, model failures, WS latency (from `health` RPC)
- **Token burn today**: aggregated from `sessions.list` token counts across all agents
- **Pending approvals**: count of pending `exec.approval.requested` events

---

### 19. Memory Manager (Enhanced)

**What it is:** Already built as the Memory timeline page. Enhance it significantly.

**New capabilities OpenClaw gives us:**
- Memory files live at `~/.openclaw/agents/<agentId>/workspace/memory/YYYY-MM-DD.md`
- `MEMORY.md` — long-term curated memory (only injected in main/private sessions)
- `memory_search` tool — semantic + BM25 hybrid search with MMR and temporal decay
- `memory_get` tool — read specific file/line range
- Pre-compaction memory flush: agent auto-writes memory before context compacts
- Session memory hook (`session-memory`): auto-saves on every `/new` to `memory/YYYY-MM-DD-<slug>.md`
- QMD backend (optional): `memory.backend = "qmd"` for BM25 + vector + reranking

**Enhancements:**
- **Inline editing**: click any memory entry → edit markdown inline → `POST /api/workspace/<agentId>/memory/<date>`
- **Search**: text search across all memory files (client-side regex or call memory_search via RPC)
- **MEMORY.md editor**: dedicated tab for the long-term memory file (pinned facts, preferences)
- **Cross-agent view**: for a client with 3 agents, show all their memory timelines merged
- **Auto-save status**: show whether `session-memory` hook is enabled — the "auto-archiving" indicator

---

## What New API Routes Are Needed

| Route | Purpose |
|-------|---------|
| `POST /api/openclaw/agent/create` | Shell `openclaw agents add <id>`, create workspace dirs |
| `GET /api/clients` | List SMBOS clients (from `~/.openclaw/smbos-clients.json`) |
| `POST /api/clients` | Create/update client |
| `GET /api/workspace/:agentId/files` | List workspace files (memory count, SOUL.md size, etc.) |
| `GET /api/workspace/:agentId/memory/:filename` | Read a memory file |
| `PUT /api/workspace/:agentId/memory/:filename` | Write a memory file |
| `GET /api/workspace/:agentId/bootstrap/:filename` | Read SOUL.md / AGENTS.md / HEARTBEAT.md |
| `PUT /api/workspace/:agentId/bootstrap/:filename` | Write workspace bootstrap file |

Everything else (sessions, cron, skills, hooks, nodes, logs, models, config, chat) is available
directly over the Gateway WebSocket via `rpc()` in `useOpenClaw`.

---

## Build Priority

```
Phase 1 — Agency Foundation
  ✦ Client management (local data layer)
  ✦ Agent provisioning wizard (config.patch + openclaw agents add)
  ✦ Agent overview dashboard (sessions.list, cron.list, heartbeat events)

Phase 2 — Operations Core
  ✦ Real-time activity feed (agent + chat + cron events)
  ✦ Session browser (sessions.list, sessions.patch, chat.history)
  ✦ Heartbeat manager (config editor for heartbeat block + HEARTBEAT.md editor)
  ✦ Enhanced cron builder (visual + run history from cron.runs)

Phase 3 — Agency Automation
  ✦ Hooks manager (session-memory + command-logger enable/disable)
  ✦ Webhook inbound manager (hooks.enabled config + URL generator)
  ✦ Exec approvals live queue (exec.approval.requested events)
  ✦ Subagent monitor (sessions.list filtered to subagent keys)

Phase 4 — Advanced
  ✦ Skills manager (skills.* RPC)
  ✦ Channel binding editor (bindings[] visual builder)
  ✦ Model/provider manager (models.list + config.patch for model config)
  ✦ Gateway logs viewer (logs.tail RPC)
  ✦ Nodes/instances dashboard (system-presence + node.list)
  ✦ Agency-level dashboard (replace current Dashboard page)
```

---

## Key Technical Notes

**All config writes use `config.patch` with base-hash guard** — OpenClaw prevents you from
overwriting concurrent edits. Always read `config.get` first to get the current hash.

**Session keys decode the entire routing story:**
- `agent:main:main` — main agent main session
- `agent:client-a:telegram:dm:123456789` — client A's agent, Telegram DM from user 123456789
- `agent:client-a:subagent:abc-uuid` — client A's spawned background worker
- `cron:job-123` — isolated cron job session

**Heartbeat is the "always on" engine** — when `session-memory` hook is enabled + heartbeat is running,
agents continuously check their inboxes, write memory, and stay current. This is the backbone of
autonomous agency operation.

**`dmScope: "per-channel-peer"` is required for agency** — if multiple clients message the same agent,
without isolation their contexts bleed into each other. Each agent for a client should use isolated dmScope.

**Per-agent model costs** — fill `models.providers.anthropic.models[].cost.input/output` to get cost
tracking in `/status` and `/usage cost`. Critical for knowing your per-client AI spend.
