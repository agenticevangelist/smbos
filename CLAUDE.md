# SMBOS — Agent Rules

Work until task is fully resolved. If a tool fails, try a different approach. Never guess — read files first.

## Behavior

1. **Task tracking.** Before non-trivial tasks, create TODO list (TaskCreate). Update status as you go (pending → in_progress → completed). Skip for one-line edits.
2. **Persistence.** Don't stop halfway unless action is destructive.
3. **Read before edit.** Always read a file before modifying it.
4. **Minimal changes.** Only what's requested. No drive-by refactors, no extra docs, no premature abstractions.
5. **Ask before destructive actions.** Force push, delete branches, publish — confirm first.

## Architecture (invariants)

1. **NanoClaw is the core.** All intelligence, search, notifications, scheduling, and inter-service communication goes through NanoClaw agents. SMBOS is a UI shell — it renders data and sends user actions to agents. Don't build standalone frontend logic for things an agent should handle.
2. **Skills are self-contained.** `skills/<id>/` with `SKILL.md` + `ui.json` + `scripts/execute.ts`. Zero changes outside skill folder.
3. **ui.json = single source of truth** for rendering. No skill-specific logic in DynamicSkillUI.
4. **One execution route:** `POST /api/skills/[id]/execute` for all skills. No per-skill endpoints.
5. **Registry discovers from filesystem.** `lib/skills/registry.ts` scans `skills/`. No hardcoded lists.
6. **Carbon only.** `@carbon/react` + `@carbon/icons-react`. No other UI libs.
7. **localStorage for UI state** (`smbos_` prefix), event bus (`lib/events/skillEvents.ts`) for runtime sync.

## Skill creation

Reference skills: simple → `google-maps-leads/`, tabs → `order-manager/`, sections → `api-connector/`.

Files: `SKILL.md` (frontmatter) → `ui.json` (`id` = folder name) → `scripts/execute.ts` (named export `execute`).

Silent failures: `id` ≠ folder name, `rootPath` ≠ execute() return key, `{{id}}` in bodyMapping ≠ input id.

## Don'ts

- Hardcode skills in DynamicSkillUI.tsx or AppShell.tsx
- `@ts-ignore` without comment
- Add npm packages without checking existing deps
- `console.log` in committed code
- Modify `nanoclaw/` without reading existing code first (it's our core — changes welcome, but understand before editing)
- Force push to main

## Verify before done

1. `npx tsc --noEmit` — no TS errors (ignore `nanoclaw/`)
2. `npm run dev` — starts without crash
3. New skill → appears in sidebar

## Conventions

- Folders: kebab-case. Components: PascalCase. Functions: camelCase. Constants: UPPER_SNAKE_CASE.
- Imports: `@/*` alias in components/lib. Relative only inside `skills/` to `_shared/`.
- Styles: co-located `.scss`, Carbon tokens only (`$spacing-05`, `var(--cds-background)`).
- Git: bump version, prefix `feat:`/`fix:`/`refactor:`/`docs:`/`chore:`.

## Storage

- Simple CRUD → `data/*.json`
- Business data → Supabase via `skills/_shared/supabase.ts`
- UI preferences → localStorage (`smbos_` prefix)

## Project structure

Next.js 16 + React 19 + Carbon v11. Three-panel layout: left nav, center content, right agent chat.

Key paths: `app/` (router + API), `components/` (7 components), `lib/skills/registry.ts`, `lib/events/skillEvents.ts`, `skills/` (21 skills), `skills/_shared/` (supabase, wolt), `data/` (JSON storage).

Skill flow: click skill → fetch ui.json → render form → bodyMapping → POST execute → rootPath extracts result → render.

Incomplete: cron engine, agent chat fallback, skill matcher, `/api/agent/chat`.
