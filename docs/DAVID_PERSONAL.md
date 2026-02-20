# David Personal Agent Plan (NanoClaw-Compatible)

This file describes personal use-cases and delivery priorities on top of existing NanoClaw capabilities.

## Scope

Agent #1 (`Andy`) is operated through:
- SMBOS web UI
- NanoClaw web chat
- NanoClaw built-in Telegram channel (when configured)

## Already Available (Do Not Rebuild)

From NanoClaw core:
- Chat sessions and message history
- Scheduler and task runtime
- MCP task tools (`schedule_task`, `list_tasks`, `pause_task`, `resume_task`, `cancel_task`)
- Telegram channel transport (`TELEGRAM_BOT_TOKEN`, optional `TELEGRAM_ONLY`)

From SMBOS:
- Agent lifecycle UI
- Runtime task/state dashboards
- Skill UI rendering

## Personal Agent Objectives

1. Proactive daily operations
- Morning briefing
- Deadline reminders
- Evening summary

2. External system integrations
- Calendar MCP
- Notion MCP

3. Memory quality
- Stable `memory/` conventions
- Preference retention across sessions

## Priority Backlog

## P0

- End-to-end runtime validation
- Telegram operational setup (using built-in channel)
- Calendar MCP integration
- Notion MCP integration
- Three default scheduled flows (morning/deadline/evening)

## P1

- Memory file conventions and auto-update strategy
- Agent self-edit capabilities (only if gap remains after NanoClaw-native options)
- Swarm usage for delegated tasks

## P2

- Additional channels and business-specific workflow templates

## Runtime Configuration Checklist

- `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`
- `ASSISTANT_NAME`
- `HTTP_PORT`
- `TELEGRAM_BOT_TOKEN` (optional)
- `TELEGRAM_ONLY` (optional)

## Anti-Duplication Rule

If NanoClaw already supports the function, the task is integration + configuration only.
