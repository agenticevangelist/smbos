# SMBOS Refactor Plan (NanoClaw-First)

## Principle

**NanoClaw is the core runtime.**
SMBOS should only implement UI/orchestration layers that NanoClaw does not already provide.

## What Was Removed from the Plan

These were explicitly removed as duplicate work (already in NanoClaw):

- Building a separate scheduler engine
- Rebuilding chat sessions/state storage
- Re-implementing Telegram channel transport from scratch
- Creating custom task orchestration parallel to NanoClaw task tools

## Current Baseline (Implemented)

- Multi-agent lifecycle in SMBOS (`start/stop/restart` NanoClaw processes)
- Agent filesystem registry (`agents/<id>`)
- NanoClaw runtime dashboards:
  - task list / run logs (`/api/nanoclaw/tasks`)
  - state snapshot (`/api/nanoclaw/state`)
- Skill UI/rendering (`ui.json` + execute routes)
- Sidebar chat using NanoClaw SSE API

## Active Roadmap

## #13 Verify End-to-End Runtime

Goal: prove stable flow `SMBOS -> NanoClaw -> Claude -> response`.

Checklist:
- Build NanoClaw runtime image (`nanoclaw-agent:latest`)
- Configure auth token/key
- Start at least one agent from SMBOS UI
- Send chat and receive SSE response
- Confirm tasks/state endpoints return data

## #14 Multi-Agent Runtime Targeting

Goal: remove ambiguity when multiple agents are running.

Work:
- Ensure all NanoClaw proxy routes accept `agentId`
- Add explicit agent selectors in runtime views (tasks/state)
- Persist selected agent in UI state

## #15 Telegram Operations (Use Built-In Channel)

Goal: operationalize existing NanoClaw Telegram support.

Work:
- Configure `TELEGRAM_BOT_TOKEN` and optional `TELEGRAM_ONLY`
- Validate Telegram inbound/outbound flow
- Document group registration workflow via built-in `register_group`

Note: no custom Telegram transport implementation in SMBOS.

## #16 Calendar MCP Integration

Goal: connect a calendar MCP server for time-aware workflows.

Work:
- Add MCP server config for calendar
- Test `list_events/create_event` flows through agent
- Add minimal UI affordances only if needed

## #17 Notion MCP Integration

Goal: integrate Notion task/project data into agent workflows.

Work:
- Configure Notion MCP
- Validate database query/update flows
- Define memory + Notion sync conventions

## #18 Proactive Flows via NanoClaw Scheduler

Goal: ship proactive automations without SMBOS scheduler duplication.

Examples:
- Morning briefing
- Deadline checks
- Evening review

Implementation rule:
- Use `schedule_task`/`list_tasks`/`pause_task`/`resume_task`/`cancel_task`
- Observe from SMBOS runtime task dashboards

## #19 Memory Conventions

Goal: standardize agent memory usage without introducing parallel storage.

Work:
- Define `memory/` file conventions per agent
- Validate persistence across sessions
- Document safe write patterns

## #20 Meta-Tools Evaluation

Goal: decide if `edit_own_config`/`update_memory`/`create_agent`/`spawn_agent` are needed in this repo.

Work:
- Prefer existing NanoClaw mechanisms first
- Implement only if a gap is confirmed

## #21 Agent Swarms + Sub-Agent Orchestration

Goal: use NanoClaw Agent Swarms for complex delegation.

Work:
- Evaluate where swarms solve current orchestration tasks
- Define guardrails (resource limits, logging visibility)

## #24 SMBOS UX Features via Agent Core

Goal: bring back search/notifications/profile features with agent-backed logic.

Rule:
- SMBOS renders UI
- NanoClaw agents provide reasoning/event generation

## #25 Scaffold Additional Agent Templates

Goal: create reusable templates for agents #2-#6.

Each template includes:
- `agent.md`
- `config.yaml`
- `.env.example`
- `memory/`

No custom runtime logic per agent in SMBOS core.

## Guardrails

- Do not reimplement NanoClaw internals in SMBOS.
- Update documentation immediately when NanoClaw feature coverage changes.
- Keep SMBOS changes focused on UI, orchestration, and operator workflows.
