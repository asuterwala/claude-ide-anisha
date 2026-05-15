# Claude IDE v2 — Rebuild Design

**Date:** 2026-05-14
**Branch:** `v2`
**Status:** Approved during brainstorming; pending implementation plan.

## Goal

Replace the current Claude IDE renderer with the v2 mockup (`~/claude-ide-v2-mockup.html`), keep the existing Electron main process plumbing, and add a real automation scheduler that uses macOS `launchd`. The current IDE on `main` keeps working until v2 is ready.

## Non-goals

- No fresh repo. We branch off `main`.
- No rewrite of the main process (Claude bridge, file watcher, git status, IPC, terminal/PTY are kept as-is).
- No auto-seeding of automations. The user adds them manually inside the IDE; no existing skill is registered with `launchd` by default.
- No split-view editor.

## Architecture

Three components, each with one job:

### 1. Electron main process (`src/main/`)

Kept as-is, plus one new module:

- `claude-bridge.ts`, `file-watcher.ts`, `git-status.ts`, `index.ts`, `ipc-handlers.ts` — unchanged in design (minor IPC additions to expose scheduler operations to the renderer).
- **NEW** `scheduler.ts` — manages `automations.json`, writes/loads `launchd` plists, exposes IPC methods (`listAutomations`, `createAutomation`, `updateAutomation`, `deleteAutomation`, `runNow`, `getRunStatus`, `streamRunLog`).

### 2. Renderer (`src/renderer/`)

Rewritten to match the mockup. Kept components: `FileExplorer`, `EditorTab` (Monaco), `TerminalTab` (xterm + PTY), `RecentSessions` (relocated to sidebar). Removed components: `NotionPanel`, `QuickSlack`, `TipsPanel`, `TimeSaved`, `ProjectSearch`, `QuickOpen`, split-editor logic.

New / rewritten components:

| Component | Purpose |
|---|---|
| `Sidebar` | Frosted-glass left panel. New Claude chat button → Folders → Recent Chats → Automations → Quick Tools (Skills). |
| `TabBar` | Standalone tabs left, divider, folder groups with colored underline stripes. |
| `CommandPalette` | Cmd+K unified search across folders, recent chats, files, skills, "new chat" action. Replaces `ProjectSearch` and `QuickOpen`. |
| `AutomationsView` | Timeline + List toggle, status pills, "+ New Automation" button. |
| `StatusBar` | git branch · folder · model · tokens · cost · context %. |
| `theme.css` | Pastel sunrise palette (cream + lavender + peach + mint), frosted glass surfaces. |

State management (`store.tsx`) keeps the reducer pattern. New slices: `automations`, `automationRuns`, `commandPalette`. Removed slices: `notion`, `tips`, `timeSaved`.

Tab routing: every tab has `kind` (`standalone-chat` | `folder-chat` | `file` | `dashboard` | `automations`) and optional `folderPath`. Tabs with a `folderPath` render inside the matching folder group; tabs without one render in the standalone zone.

### 3. Run engine (outside the IDE process)

Lives at `~/.claude-ide/bin/run-automation` (shell script). One job: take an automation ID, run it, report status.

**On-disk layout under `~/.claude-ide/`:**
```
automations.json       user's list of automations
bin/run-automation     the run engine script
plists/                one launchd plist per scheduled automation
runs/                  run logs (one folder per run, with status.json + run.log)
```

Both `launchd` (on schedule) and the IDE ("Run now" button) invoke the same script with the same arguments. Status is read from `runs/` — the trigger doesn't matter to the UI.

## Data model

### `automations.json`
Array of automation entries. Schema:
```json
{
  "id": "refresh-benefits-model",
  "name": "Refresh Benefits Model",
  "icon": "📊",
  "skill": "refresh-benefits-model",
  "folder": "~/Documents/finance/benefits-model",
  "schedule": "0 8 * * 1",
  "enabled": true,
  "dependsOn": [],
  "timeoutMin": 30,
  "model": "opus"
}
```

Empty array on first install. The IDE owns reads/writes; the renderer never touches it directly (IPC only).

### `runs/<id>__<timestamp>/`
Per-run directory. Files:
- `status.json` — `{ state: "running" | "completed" | "failed" | "timeout" | "skipped", startedAt, finishedAt?, exitCode?, durationMs?, tokensUsed?, costUsd?, triggeredBy: "schedule" | "manual" | "catchup", dependencyOf?: string[] }`
- `run.log` — combined stdout/stderr stream.

The renderer watches `~/.claude-ide/runs/` via `chokidar` (already a dependency) and updates UI state on new/changed `status.json`.

### Plist files
One `~/.claude-ide/plists/<id>.plist` per `enabled: true` automation with a `schedule`. The plist invokes `~/.claude-ide/bin/run-automation <id>`. Registered with `launchctl load` on create, `unload + reload` on edit, `unload + remove` on delete or disable.

## Lifecycles

### Creating an automation
1. User clicks "+ New Automation" in the Automations view. Form fields: name, icon, skill, folder, schedule (cron), `dependsOn`, timeout, model.
2. Renderer dispatches `createAutomation` IPC call. Main process:
   1. Appends entry to `automations.json`.
   2. If `enabled && schedule` → writes plist, `launchctl load`.
3. IPC returns success; UI optimistically updates with the new row.

### Editing
Renderer sends `updateAutomation`. Main process: `unload` old plist, rewrites `automations.json` entry, writes new plist (if still scheduled), `load`. Atomic from the user's perspective.

### Deleting / disabling
`unload` and remove plist. `automations.json` entry deleted (or `enabled: false` for disable). UI reflects via `chokidar` watch on `automations.json`.

### Running (scheduled or manual)
1. `run-automation <id>` is invoked.
2. Script reads `automations.json`, locates entry. Errors out clearly if missing.
3. Creates `runs/<id>__<timestamp>/` with `status.json` (`state: "running"`, `triggeredBy: schedule|manual|catchup`).
4. Resolves `dependsOn`: for each upstream id, waits up to `timeoutMin` for its most-recent run today to be `completed`. If any upstream is `failed`/`timeout`/`skipped`, mark this run `skipped` and exit.
5. Spawns the Claude CLI in `folder` with the specified `skill` activated (exact CLI flag to be confirmed in the implementation plan). Pipes stdout/stderr to `run.log`. Captures token count and cost from Claude's output.
6. On exit: writes final `status.json` with `state`, `exitCode`, `durationMs`, `tokensUsed`, `costUsd`, `finishedAt`.

### Catch-up on startup
When the IDE starts, the main process:
1. Reads `automations.json`.
2. For each `enabled` entry with a `schedule`, computes the most recent scheduled time in the past 24 hours.
3. Checks `runs/` for a corresponding run after that time.
4. If none and the time is older than ~5 minutes (to avoid double-running near the schedule boundary), invokes `run-automation <id>` with `triggeredBy: "catchup"`. Logs a Toast in the IDE: "Caught up: Refresh Benefits Model (was due 8:00a)".

## IPC surface (renderer ↔ main)

New methods on `window.api`:
- `listAutomations(): Promise<Automation[]>`
- `createAutomation(input: AutomationInput): Promise<Automation>`
- `updateAutomation(id: string, patch: Partial<AutomationInput>): Promise<Automation>`
- `deleteAutomation(id: string): Promise<void>`
- `runNow(id: string): Promise<{ runId: string }>`
- `listRuns(opts?: { sinceDate?: Date, automationId?: string }): Promise<Run[]>`
- `onRunUpdate(handler: (run: Run) => void): UnsubscribeFn` — chokidar-backed stream.
- `getSkills(): Promise<Skill[]>` — for the "+ New Automation" form's skill dropdown. Reads from existing skills auto-detection logic.

## Error handling

- **launchctl failure** (e.g. plist invalid): scheduler surfaces the error via IPC; UI shows a Toast and marks the automation as disabled with a tooltip explaining why.
- **Missing skill or folder**: detected at create-time (folder existence) and run-time (skill not found). Run is marked `failed` with `exitCode != 0` and the failure reason is written to `run.log`.
- **launchd skips a scheduled run (laptop asleep)**: covered by catch-up on next IDE start.
- **chokidar watch fails**: log + UI Toast; fall back to a 30-second polling interval.
- **IDE crashes mid-run**: launchd-triggered runs are unaffected (they live in their own process). Manual runs are killed; their `status.json` remains stuck on `running`. A startup sweep marks any `running` runs older than `timeoutMin + 5min` as `failed: orphaned`.
- **Schedule edited while a run is in flight**: in-flight run completes against the old config (it's already loaded into memory in the run script). New plist takes effect for subsequent runs.

## Migration / branch strategy

1. Work entirely on `v2` branch. `main` remains the running IDE.
2. Implementation phases (each is a separate commit set):
   1. Theme + sidebar shell + tab bar with grouping (no functional changes to scheduler yet).
   2. Command palette (Cmd+K) unifying existing search + quick-open.
   3. Status bar rewrite.
   4. Scheduler module + `~/.claude-ide/` scaffolding + IPC surface.
   5. Automations view (Timeline + List + create/edit form).
   6. Catch-up + orphan sweep on startup.
   7. Removal of `NotionPanel`, `QuickSlack`, `TipsPanel`, `TimeSaved`, `ProjectSearch`, `QuickOpen`, split-editor.
3. Test alongside the old IDE: keep the `as-ide` package name unchanged so the OS doesn't track them as two separate apps. During dev mode (`npm run dev`), the title bar shows a branch suffix (e.g. `Claude IDE (v2)`) so the user can tell the two windows apart. Both can run via `npm run dev` from separate worktrees of `main` and `v2`.
4. When v2 is stable, merge `v2` into `main` and rebuild.

## Testing

- **Renderer components**: existing components have no tests today; we'll add Vitest + React Testing Library setup. Cover at minimum: `TabBar` folder grouping, `CommandPalette` query → result mapping, `AutomationsView` timeline positioning logic, `Sidebar` state.
- **Scheduler module**: integration tests using a real `launchctl` against fixtures in a temp `HOME` (`~/.claude-ide/` redirected). Covers create → load → run → status. Run only in a developer machine context (skip in CI if/when CI exists).
- **Run engine script**: shell tests via `bats` (or simple Node tape) — test dependency resolution, timeout handling, skip-on-upstream-fail.
- **Manual smoke**: a checklist (in this doc when implementation lands) — create an automation, run it manually, run it scheduled, kill the IDE mid-run, restart and see the orphan sweep.

## Open items deferred to the writing-plans phase

- Exact form layout for "+ New Automation".
- Whether to integrate `dependsOn` with cross-day boundaries (currently scoped to "today's runs").
- Telemetry / logging beyond `run.log` (e.g., a global runs index for fast list queries).
- Whether the macOS app menu needs updates (likely yes for Cmd+K, Cmd+T).
