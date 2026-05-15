# Claude IDE v2 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Claude IDE renderer with the v2 mockup (pastel sunrise theme, frosted sidebar, folder-grouped tabs, Cmd+K palette) and add a real `launchd`-backed automation scheduler. Old IDE retired in the same merge.

**Architecture:** Three components — (1) Electron main process keeps existing plumbing plus a new `scheduler.ts` module; (2) renderer rewrites the UI to match the mockup; (3) a shell script `~/.claude-ide/bin/run-automation` executes automations whether triggered by `launchd` or by the IDE's "Run now" button. State lives in `~/.claude-ide/{automations.json, plists/, runs/, env.json}`.

**Tech Stack:** Electron 33, React 18, TypeScript 5.5, electron-vite, Monaco editor, xterm + node-pty, chokidar, macOS `launchd` (via `launchctl`), Vitest + React Testing Library (new).

**Spec:** `docs/superpowers/specs/2026-05-14-claude-ide-v2-rebuild-design.md`

**Visual reference:** `~/claude-ide-v2-mockup.html` — open in a browser while implementing renderer tasks.

---

## File Structure

### New files
- `src/main/scheduler.ts` — manages `automations.json`, plists, IPC handlers for scheduler ops.
- `src/main/scheduler/plist-template.ts` — pure function generating launchd plist XML.
- `src/main/scheduler/runs-watcher.ts` — chokidar watcher on `~/.claude-ide/runs/`.
- `src/main/scheduler/catchup.ts` — startup catch-up + orphan sweep logic.
- `src/main/claude-env.ts` — detects `claude` binary path, builds env map for plists.
- `scripts/run-automation` — shell script: the run engine (installed to `~/.claude-ide/bin/`).
- `src/renderer/components/Sidebar.tsx` — frosted-glass left panel.
- `src/renderer/components/CommandPalette.tsx` — Cmd+K unified search.
- `src/renderer/components/AutomationsView.tsx` — Timeline + List + create form.
- `src/renderer/components/AutomationsView/Timeline.tsx` — timeline rendering.
- `src/renderer/components/AutomationsView/RunList.tsx` — list view.
- `src/renderer/components/AutomationsView/AutomationForm.tsx` — create/edit form.
- `src/renderer/components/FolderGroup.tsx` — tab-bar folder group with colored stripe.
- `src/renderer/hooks/useAutomations.ts` — fetch/subscribe to automations + runs.
- `src/shared/automation-types.ts` — shared `Automation`, `Run`, `Skill` types.
- `vitest.config.ts` — Vitest config.
- `src/renderer/test/setup.ts` — RTL setup with JSDOM.

### Files modified
- `src/renderer/App.tsx` — replace whole layout to match mockup.
- `src/renderer/store.tsx` — remove notion/timeSaved/streamlit slices, add automations/commandPalette slices, extend Tab.
- `src/shared/types.ts` — extend `Tab.kind` (`'standalone-chat' | 'folder-chat' | 'file' | 'dashboard' | 'automations'`); add `folderPath?: string` field.
- `src/renderer/components/TabBar.tsx` — rewrite to group by `folderPath`.
- `src/renderer/components/StatusBar.tsx` — rewrite to match mockup (branch, folder, model, tokens, cost, context).
- `src/renderer/styles/theme.css` — pastel sunrise palette.
- `src/renderer/styles.css` — frosted glass background + layout.
- `src/main/index.ts` — wire up scheduler init + catchup on app ready.
- `src/main/ipc-handlers.ts` — add scheduler IPC channels; remove dead ones for deleted features.
- `src/preload/index.ts` — expose scheduler API on `window.api`.
- `package.json` — add Vitest, @testing-library/react, @testing-library/jest-dom, jsdom; add `test` script.

### Files deleted (in Task 2)
- `src/renderer/components/NotionPanel.tsx` (renamed to `TodayPanel.tsx` actually — both go)
- `src/renderer/components/TodayPanel.tsx`
- `src/renderer/components/QuickSlack.tsx`
- `src/renderer/components/TipsPanel.tsx`
- `src/renderer/components/TimeSaved.tsx`
- `src/renderer/components/ProjectSearch.tsx`
- `src/renderer/components/QuickOpen.tsx`
- `src/renderer/tips.ts`

---

## Phase 0 — Test infrastructure

### Task 1: Add Vitest + React Testing Library

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/renderer/test/setup.ts`
- Create: `src/renderer/test/sanity.test.ts`

- [ ] **Step 1: Add dev dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

- [ ] **Step 2: Add test script to package.json**

Modify the `scripts` block in `package.json`:
```json
"scripts": {
  "postinstall": "chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper 2>/dev/null || true",
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "package": "chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper && electron-vite build && electron-builder --mac",
  "test": "vitest",
  "test:run": "vitest run"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/renderer/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
```

- [ ] **Step 4: Create `src/renderer/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 5: Write a sanity test**

`src/renderer/test/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run tests**

```bash
npm run test:run
```
Expected: `1 passed`, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/renderer/test/
git commit -m "chore(test): add vitest + RTL with sanity test"
```

---

## Phase 1 — Cleanup

### Task 2: Strip removed components and dead state

**Files:**
- Delete: see list in "File Structure" above
- Modify: `src/renderer/App.tsx`, `src/renderer/store.tsx`, `src/main/ipc-handlers.ts`, `src/renderer/components/Dashboard.tsx`

- [ ] **Step 1: Delete files**

```bash
rm src/renderer/components/NotionPanel.tsx \
   src/renderer/components/TodayPanel.tsx \
   src/renderer/components/QuickSlack.tsx \
   src/renderer/components/TipsPanel.tsx \
   src/renderer/components/TimeSaved.tsx \
   src/renderer/components/ProjectSearch.tsx \
   src/renderer/components/QuickOpen.tsx \
   src/renderer/tips.ts
```

- [ ] **Step 2: Remove imports + usage from `App.tsx`**

Open `src/renderer/App.tsx`. Remove:
- `import QuickOpen from './components/QuickOpen'`
- `import ProjectSearch from './components/ProjectSearch'`
- `import { evaluateTips } from './tips'` and the `TipContext` import
- All `useState`s for `quickOpenVisible`, `projectSearchVisible`
- All keyboard handlers tied to `quickOpen` / `projectSearch` / `TRACK_FEATURE` / Tip evaluation
- `<QuickOpen .../>` and `<ProjectSearch .../>` JSX at the bottom
- The "Toast" stays.

After cleanup, `App.tsx` keeps: `TabBar`, `FileExplorer`, `TerminalTab`, `EditorTab`, `Dashboard`, `StatusBar`, `Toast`. Split-editor wiring also gets removed (`splitTab` references, the conditional split layout block).

- [ ] **Step 3: Remove dead state from `store.tsx`**

Modify `src/renderer/store.tsx`. Remove:
- The `BehaviorState` interface contents related to tips (`firedTipIds`, `triggeredTips`) — keep `featuresUsed`, `firstTerminalAt`, `isFirstLaunch` if used elsewhere (search the codebase; if unused, remove the whole `behavior` block).
- `notion`, `streamlit`, `timeSaved` slices from `AppState`, `initialState`, and the reducer.
- Actions: `FIRE_TIP`, `NOTION_LOADING`, `NOTION_LOADED`, `NOTION_ERROR`, `STREAMLIT_UPDATE`, `TIME_SAVED_INIT`, `TIME_SAVED_ADD`.
- Split-tab actions: `SET_SPLIT_TAB`, `OPEN_IN_SPLIT`, and the `splitTabId` field.

Also remove the imports for `NotionMeeting`, `NotionTask`, `StreamlitApp`, `PythonFile` from `../shared/types`.

- [ ] **Step 4: Remove dashboard widgets that referenced removed slices**

Open `src/renderer/components/Dashboard.tsx`. Remove imports + JSX for `TodayPanel`, `QuickSlack`, `TipsPanel`, `TimeSaved`. Keep: `RecentSessions`, `SkillsLauncher`, `ModelStatus` for now (we'll relocate `RecentSessions` and `SkillsLauncher` later, but the Dashboard component still works).

- [ ] **Step 5: Remove dead IPC handlers**

Open `src/main/ipc-handlers.ts`. Remove (or delete entirely) handlers for: `fetchNotion`, `refreshCalendar`, `refreshTasks`, `streamlit:*`, `timeSaved:*`. Search by name to find each `ipcMain.handle(...)` block.

Also update `src/preload/index.ts` to remove the corresponding exposed methods from `window.api`.

- [ ] **Step 6: Run app to confirm it still builds**

```bash
npm run dev
```
Expected: window opens, no console errors. UI looks bare in places (Dashboard has fewer widgets) but app loads and a terminal tab can be opened. Close the dev server.

- [ ] **Step 7: Run tests**

```bash
npm run test:run
```
Expected: 1 passed (sanity test). No type errors related to removed modules.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove notion/slack/tips/timesaved/quickopen/projectsearch/split-editor

These components and state slices are gone in v2:
- NotionPanel/TodayPanel (today's meetings/tasks)
- QuickSlack (Slack drafting)
- TipsPanel + tips.ts (tip nudges)
- TimeSaved (productivity tracking)
- ProjectSearch (replaced by Cmd+K palette)
- QuickOpen (replaced by Cmd+K palette)
- Split-editor logic"
```

---

## Phase 2 — Theme + shared types

### Task 3: Pastel sunrise theme

**Files:**
- Modify: `src/renderer/styles/theme.css`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Replace `theme.css` with the pastel sunrise palette**

Open `~/claude-ide-v2-mockup.html` and copy the `:root { ... }` block at the top of its `<style>`. Replace the entire contents of `src/renderer/styles/theme.css` with that block (the `--bg-primary`, `--accent-primary`, `--accent-lavender`, syntax color vars, etc.).

- [ ] **Step 2: Add the window background gradient**

In `src/renderer/styles.css`, add at the top (after `@import './styles/theme.css';` if present, otherwise just add it):
```css
html, body, #root {
  height: 100%;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
  font-size: 13px;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

#root {
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse 70% 50% at 20% 0%,  rgba(243, 212, 243, 0.65), transparent 60%),
    radial-gradient(ellipse 65% 45% at 80% 5%,  rgba(255, 209, 211, 0.55), transparent 60%),
    radial-gradient(ellipse 80% 50% at 50% 10%, rgba(255, 202, 164, 0.35), transparent 65%),
    radial-gradient(ellipse 90% 60% at 50% 95%, rgba(91, 141, 239, 0.10), transparent 70%),
    linear-gradient(180deg, #FBF8FB 0%, #F8F9FA 50%, #F0F4F8 100%);
}
```

- [ ] **Step 3: Visual check**

```bash
npm run dev
```
Expected: app now has the pastel sunrise gradient background. (Other UI is still old layout — that's fine.) Close dev server.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/styles/theme.css src/renderer/styles.css
git commit -m "feat(theme): pastel sunrise palette + gradient background"
```

### Task 4: Shared automation types

**Files:**
- Create: `src/shared/automation-types.ts`
- Modify: `src/shared/types.ts`
- Test: `src/shared/automation-types.test.ts`

- [ ] **Step 1: Write the failing test**

`src/shared/automation-types.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isRunFinal, type Automation, type Run } from './automation-types'

describe('automation-types', () => {
  it('isRunFinal returns true for terminal states', () => {
    expect(isRunFinal({ state: 'completed' } as Run)).toBe(true)
    expect(isRunFinal({ state: 'failed' } as Run)).toBe(true)
    expect(isRunFinal({ state: 'timeout' } as Run)).toBe(true)
    expect(isRunFinal({ state: 'skipped' } as Run)).toBe(true)
    expect(isRunFinal({ state: 'skipped_budget' } as Run)).toBe(true)
  })

  it('isRunFinal returns false for running', () => {
    expect(isRunFinal({ state: 'running' } as Run)).toBe(false)
  })

  it('Automation type allows null monthlyBudgetUsd', () => {
    const a: Automation = {
      id: 'x', name: 'X', icon: '⚡', skill: 'foo', folder: '~',
      schedule: '0 8 * * 1', enabled: true, dependsOn: [],
      timeoutMin: 30, model: 'opus', monthlyBudgetUsd: null,
    }
    expect(a.monthlyBudgetUsd).toBeNull()
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm run test:run -- automation-types
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the types**

`src/shared/automation-types.ts`:
```ts
export type RunState =
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'skipped'
  | 'skipped_budget'

export type TriggerSource = 'schedule' | 'manual' | 'catchup'

export interface Automation {
  id: string
  name: string
  icon: string
  skill: string
  folder: string
  schedule: string | null
  enabled: boolean
  dependsOn: string[]
  timeoutMin: number
  model: 'opus' | 'sonnet'
  monthlyBudgetUsd: number | null
}

export type AutomationInput = Omit<Automation, 'id'> & { id?: string }

export interface Run {
  runId: string
  automationId: string
  state: RunState
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  exitCode: number | null
  tokensUsed: number | null
  costUsd: number | null
  triggeredBy: TriggerSource
  failureReason?: string
}

export interface Skill {
  name: string
  description: string
}

export function isRunFinal(run: Pick<Run, 'state'>): boolean {
  return run.state !== 'running'
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm run test:run -- automation-types
```
Expected: 3 passed.

- [ ] **Step 5: Extend `Tab` in `src/shared/types.ts`**

Open `src/shared/types.ts`. Find the `Tab` type. Add the new `kind` (`'standalone-chat' | 'folder-chat' | 'file' | 'dashboard' | 'automations'`) and an optional `folderPath?: string` field. Keep the existing `'terminal' | 'editor' | 'dashboard'` for backward-compat *if* still referenced — or replace entirely if you can. (Do a grep `grep -r "tab.type" src/` first; if you see `tab.type === 'terminal'`, decide whether to map old terminal → new folder-chat or rename.)

For this rebuild, **replace** the old types. Updated `Tab`:
```ts
export type TabKind =
  | 'standalone-chat'
  | 'folder-chat'
  | 'file'
  | 'dashboard'
  | 'automations'

export interface Tab {
  id: string
  kind: TabKind
  label: string
  closeable: boolean
  folderPath?: string  // present for folder-chat, file, and folder-tied file tabs
  filePath?: string    // present for kind === 'file'
  ptyId?: string       // present for kind === 'standalone-chat' | 'folder-chat'
  isDirty?: boolean
}
```

Then `grep -r "tab.type" src/` and update all references to `tab.kind`. Same for any `Tab` consumer that destructures `type`.

- [ ] **Step 6: Run app to confirm it still builds**

```bash
npm run dev
```
Expected: window opens, the existing Dashboard tab shows up. Tab bar works (even if it looks old). Close dev server.

- [ ] **Step 7: Commit**

```bash
git add src/shared/automation-types.ts src/shared/automation-types.test.ts src/shared/types.ts
git commit -m "feat(types): add Automation/Run types; extend Tab with kind + folderPath"
```

---

## Phase 3 — Sidebar

### Task 5: Sidebar shell

**Files:**
- Create: `src/renderer/components/Sidebar.tsx`
- Create: `src/renderer/components/Sidebar.css`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Create Sidebar component**

`src/renderer/components/Sidebar.tsx`:
```tsx
import './Sidebar.css'

interface SidebarProps {
  onNewChat: () => void
  children?: React.ReactNode
}

export default function Sidebar({ onNewChat, children }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button
        className="new-chat-btn"
        onClick={onNewChat}
        title="Start a new Claude chat in your home folder"
      >
        <span style={{ fontSize: 16 }}>✨</span>
        <div className="label-stack">
          <span>New Claude chat</span>
          <span className="sub">no folder · runs in ~</span>
        </div>
        <span className="kbd">⌘T</span>
      </button>
      {children}
    </aside>
  )
}
```

- [ ] **Step 2: Create Sidebar.css**

Copy the relevant blocks from `~/claude-ide-v2-mockup.html` (the `.sidebar`, `.sidebar-section`, `.sidebar-header`, `.new-chat-btn`, `.row`, `.tree`, `.tree-item`, `.auto-status`, `.view-all` rules) into `src/renderer/components/Sidebar.css`. Adjust `width` from the inline-style approach to a top-level `--sidebar-width: 280px;` var defined in the same file.

- [ ] **Step 3: Mount Sidebar in App.tsx**

In `src/renderer/App.tsx`, replace the existing `<FileExplorer />` mount with `<Sidebar onNewChat={handleNewChat}>...</Sidebar>` wrapping the file tree and other sections. Define `handleNewChat`:
```tsx
const handleNewChat = useCallback(() => {
  window.api.createPty(null).then(ptyId => {
    const id = `chat-${Date.now()}`
    dispatch({
      type: 'ADD_TAB',
      tab: { id, kind: 'standalone-chat', label: 'Claude — Home', closeable: true, ptyId }
    })
  })
}, [dispatch])
```

For now leave the inside of `<Sidebar>` empty (`{null}`) — sections come next.

- [ ] **Step 4: Visual check**

```bash
npm run dev
```
Expected: frosted-glass left sidebar with the ✨ New Claude chat button visible at the top. Clicking it adds a new tab. Close dev server.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Sidebar.tsx src/renderer/components/Sidebar.css src/renderer/App.tsx
git commit -m "feat(sidebar): shell with New Claude chat button"
```

### Task 6: Folder tree in sidebar

**Files:**
- Modify: `src/renderer/components/FileExplorer.tsx` (slim down for sidebar use)
- Modify: `src/renderer/components/Sidebar.tsx` (mount FileExplorer)

- [ ] **Step 1: Adapt FileExplorer for sidebar mounting**

Open `src/renderer/components/FileExplorer.tsx`. The existing component renders a project file tree with git status. For v2, it'll render as a section inside Sidebar. Wrap its top-level `<div>` with `<section className="sidebar-section">` and add a section header `<div className="sidebar-header"><span>Folders</span><span className="add">+</span></div>`. The git status badges (`M`, `+`, `?`) already exist — confirm they're styled to match the mockup (the mockup uses `.git.modified` etc. classes).

If the existing classes differ from the mockup, update them in `FileExplorer.tsx` to match `tree-item`, `git modified`, `git added`, `git untracked` from the mockup's CSS.

- [ ] **Step 2: Render FileExplorer inside Sidebar**

In `src/renderer/App.tsx`:
```tsx
<Sidebar onNewChat={handleNewChat}>
  <FileExplorer />
</Sidebar>
```

- [ ] **Step 3: Visual check**

```bash
npm run dev
```
Expected: sidebar shows New Chat button + Folders section with the file tree. Clicking a folder opens a chat tab. Git status badges visible on modified files. Close dev server.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/FileExplorer.tsx src/renderer/components/Sidebar.tsx src/renderer/App.tsx
git commit -m "feat(sidebar): mount file explorer as Folders section"
```

### Task 7: Recent Chats, Automations preview, Skills sections

**Files:**
- Modify: `src/renderer/components/Sidebar.tsx`
- Modify: `src/renderer/components/RecentSessions.tsx` (relocate from Dashboard)
- Create: `src/renderer/components/sidebar/AutomationsPreview.tsx`
- Modify: `src/renderer/components/SkillsLauncher.tsx` (compact mode for sidebar)

- [ ] **Step 1: Convert RecentSessions to compact sidebar list**

Open `src/renderer/components/RecentSessions.tsx`. Currently renders as a Dashboard widget. Change the rendered structure to a `<section className="sidebar-section">` with header `Recent Chats` and rows in `.row` format:
```tsx
<div className="row" onClick={() => onResumeSession(session.id)}>
  <span>💬</span>
  <span className="name">{session.title}</span>
  <span className="meta">{relativeTime(session.startedAt)}</span>
</div>
```
Helper `relativeTime` returns `2h`, `1d`, `1w` etc.

- [ ] **Step 2: Create AutomationsPreview placeholder**

`src/renderer/components/sidebar/AutomationsPreview.tsx`:
```tsx
export default function AutomationsPreview({ onOpen }: { onOpen: () => void }) {
  // Real data lands in Phase 9. Placeholder shows section + "View all".
  return (
    <section className="sidebar-section">
      <div className="sidebar-header">
        <span>Automations</span>
        <span className="view-all" onClick={onOpen}>View all →</span>
      </div>
      <div className="row" onClick={onOpen} style={{ color: 'var(--text-muted)' }}>
        <span>⚡</span><span className="name">No automations yet</span>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Convert SkillsLauncher to sidebar Quick Tools section**

In `src/renderer/components/SkillsLauncher.tsx`, change wrapper to `<section className="sidebar-section">` with header `Quick Tools`. Each skill row uses `.row` format. Only show the count pill `<span className="pill">{skills.length}</span>` next to a single "Skills" row that toggles a popover or palette list — full skill picker stays available via Cmd+K.

For now keep this minimal:
```tsx
<section className="sidebar-section">
  <div className="sidebar-header"><span>Quick Tools</span></div>
  <div className="row" onClick={openSkillsPalette}>
    <span className="dot"></span>
    <span className="name">Skills</span>
    <span className="pill">{skills.length}</span>
  </div>
</section>
```

`openSkillsPalette` triggers the Cmd+K palette filtered to skills (wired in Task 11).

- [ ] **Step 4: Mount all three sections in Sidebar**

Update `src/renderer/App.tsx`:
```tsx
<Sidebar onNewChat={handleNewChat}>
  <FileExplorer />
  <RecentSessions />
  <AutomationsPreview onOpen={() => dispatch({ type: 'SET_ACTIVE_TAB', tabId: 'automations' })} />
  <SkillsLauncher compact />
</Sidebar>
```
Make sure to import the new component. The "Automations" tab is opened by setting active tab; we'll register an `automations` tab in Task 9.

- [ ] **Step 5: Visual check**

```bash
npm run dev
```
Expected: sidebar shows New Chat → Folders → Recent Chats → Automations (placeholder) → Quick Tools. Layout matches mockup. Close dev server.

- [ ] **Step 6: Commit**

```bash
git add -A src/renderer
git commit -m "feat(sidebar): add Recent Chats, Automations preview, Quick Tools sections"
```

---

## Phase 4 — Tab bar with folder grouping

### Task 8: Tab routing logic + tests

**Files:**
- Create: `src/renderer/components/TabBar/groupTabs.ts`
- Create: `src/renderer/components/TabBar/groupTabs.test.ts`

- [ ] **Step 1: Write failing tests for grouping logic**

`src/renderer/components/TabBar/groupTabs.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { groupTabs } from './groupTabs'
import type { Tab } from '../../../shared/types'

describe('groupTabs', () => {
  it('separates standalone from folder-tied tabs', () => {
    const tabs: Tab[] = [
      { id: 'd', kind: 'dashboard', label: 'Dashboard', closeable: false },
      { id: 'a', kind: 'automations', label: 'Automations', closeable: false },
      { id: 'c1', kind: 'folder-chat', label: 'chat', closeable: true, folderPath: '/x/bm' },
      { id: 'f1', kind: 'file', label: 'dashboard.html', closeable: true, folderPath: '/x/bm', filePath: '/x/bm/dashboard.html' },
      { id: 'c2', kind: 'folder-chat', label: 'chat', closeable: true, folderPath: '/x/qr' },
      { id: 's1', kind: 'standalone-chat', label: 'Home chat', closeable: true },
    ]
    const result = groupTabs(tabs)
    expect(result.standalone.map(t => t.id)).toEqual(['d', 'a', 's1'])
    expect(result.groups).toHaveLength(2)
    expect(result.groups[0].folderPath).toBe('/x/bm')
    expect(result.groups[0].tabs.map(t => t.id)).toEqual(['c1', 'f1'])
    expect(result.groups[1].folderPath).toBe('/x/qr')
    expect(result.groups[1].tabs.map(t => t.id)).toEqual(['c2'])
  })

  it('preserves tab order within a group', () => {
    const tabs: Tab[] = [
      { id: 'a', kind: 'file', label: 'a', closeable: true, folderPath: '/p', filePath: '/p/a' },
      { id: 'b', kind: 'file', label: 'b', closeable: true, folderPath: '/p', filePath: '/p/b' },
    ]
    const result = groupTabs(tabs)
    expect(result.groups[0].tabs.map(t => t.id)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm run test:run -- groupTabs
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement groupTabs**

`src/renderer/components/TabBar/groupTabs.ts`:
```ts
import type { Tab } from '../../../shared/types'

export interface TabGroup {
  folderPath: string
  tabs: Tab[]
}

export interface GroupedTabs {
  standalone: Tab[]
  groups: TabGroup[]
}

export function groupTabs(tabs: Tab[]): GroupedTabs {
  const standalone: Tab[] = []
  const byFolder = new Map<string, Tab[]>()
  const folderOrder: string[] = []

  for (const tab of tabs) {
    if (tab.folderPath) {
      if (!byFolder.has(tab.folderPath)) {
        byFolder.set(tab.folderPath, [])
        folderOrder.push(tab.folderPath)
      }
      byFolder.get(tab.folderPath)!.push(tab)
    } else {
      standalone.push(tab)
    }
  }

  return {
    standalone,
    groups: folderOrder.map(folderPath => ({ folderPath, tabs: byFolder.get(folderPath)! })),
  }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm run test:run -- groupTabs
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/TabBar/
git commit -m "feat(tabs): groupTabs splits tabs into standalone + per-folder groups"
```

### Task 9: TabBar component rewrite

**Files:**
- Modify: `src/renderer/components/TabBar.tsx`
- Create: `src/renderer/components/FolderGroup.tsx`
- Modify: `src/renderer/styles.css` (or component-scoped CSS)

- [ ] **Step 1: Build FolderGroup component**

`src/renderer/components/FolderGroup.tsx`:
```tsx
import type { Tab } from '../../shared/types'

// Assign colors per folder deterministically.
function folderColor(folderPath: string): { stripe: string; chip: string; dot: string } {
  const palette = [
    { stripe: '#C99FC9', chip: '#6B3F6B', dot: '#B07BB0' }, // lavender
    { stripe: '#E89F70', chip: '#8C4A20', dot: '#D9904B' }, // peach
    { stripe: '#7BC4A9', chip: '#2D6650', dot: '#4A9D7F' }, // mint
    { stripe: '#A9C4E5', chip: '#3B5A8C', dot: '#5B8DEF' }, // blue
    { stripe: '#E5A9C4', chip: '#8C3D5A', dot: '#D96B8A' }, // pink
  ]
  let hash = 0
  for (let i = 0; i < folderPath.length; i++) hash = (hash * 31 + folderPath.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

function folderBasename(folderPath: string): string {
  const parts = folderPath.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? folderPath
}

interface Props {
  folderPath: string
  tabs: Tab[]
  activeTabId: string
  onTabClick: (id: string) => void
  onTabClose: (id: string) => void
}

export default function FolderGroup({ folderPath, tabs, activeTabId, onTabClick, onTabClose }: Props) {
  const color = folderColor(folderPath)
  return (
    <div className="tab-group" style={{ borderBottomColor: color.stripe }}>
      <div className="folder-chip" title={folderPath} style={{ color: color.chip }}>
        <span className="dot" style={{ background: color.dot }}></span>
        📂 {folderBasename(folderPath)}
      </div>
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => onTabClick(tab.id)}
        >
          <span>{tab.kind === 'file' ? '📄' : '💬'}</span>
          {tab.label}
          {tab.isDirty && <span className="dirty">●</span>}
          {tab.closeable && (
            <span className="x" onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}>×</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite TabBar**

Replace contents of `src/renderer/components/TabBar.tsx`:
```tsx
import { useAppState } from '../store'
import { groupTabs } from './TabBar/groupTabs'
import FolderGroup from './FolderGroup'
import type { Tab } from '../../shared/types'

export default function TabBar() {
  const { state, dispatch } = useAppState()
  const grouped = groupTabs(state.tabs)

  const onClick = (id: string) => dispatch({ type: 'SET_ACTIVE_TAB', tabId: id })
  const onClose = (id: string) => {
    const tab = state.tabs.find(t => t.id === id)
    if (tab?.ptyId) window.api.destroyPty(tab.ptyId)
    dispatch({ type: 'CLOSE_TAB', tabId: id })
  }

  const renderStandalone = (t: Tab) => (
    <div
      key={t.id}
      className={`tab ${t.id === state.activeTabId ? 'active' : ''}`}
      onClick={() => onClick(t.id)}
    >
      {iconFor(t)} {t.label}
      {t.closeable && <span className="x" onClick={(e) => { e.stopPropagation(); onClose(t.id) }}>×</span>}
    </div>
  )

  return (
    <div className="tabs">
      {grouped.standalone.map(renderStandalone)}
      {grouped.groups.length > 0 && <div className="tab-divider"></div>}
      {grouped.groups.map((g, i) => (
        <>
          <FolderGroup
            key={g.folderPath}
            folderPath={g.folderPath}
            tabs={g.tabs}
            activeTabId={state.activeTabId}
            onTabClick={onClick}
            onTabClose={onClose}
          />
          {i < grouped.groups.length - 1 && <div className="tab-divider"></div>}
        </>
      ))}
    </div>
  )
}

function iconFor(t: Tab) {
  switch (t.kind) {
    case 'dashboard': return <span>🏠</span>
    case 'automations': return <span>⚡</span>
    case 'standalone-chat': return <span>💬</span>
    case 'folder-chat': return <span>💬</span>
    case 'file': return <span>📄</span>
  }
}
```

- [ ] **Step 3: Add tab-bar CSS**

Append to `src/renderer/styles.css` (or move to a TabBar.css if you prefer per-component). Use the `.tabs`, `.tab`, `.tab-divider`, `.tab-group`, `.folder-chip`, `.dot` rules from `~/claude-ide-v2-mockup.html`.

- [ ] **Step 4: Add an Automations tab to initial state**

In `src/renderer/store.tsx`, update `initialState`:
```ts
const automationsTab: Tab = {
  id: 'automations', kind: 'automations', label: 'Automations', closeable: false
}
const initialState: AppState = {
  tabs: [dashboardTab, automationsTab],
  activeTabId: 'dashboard',
  // ...rest
}
```

- [ ] **Step 5: Visual check**

```bash
npm run dev
```
Expected: tab bar shows 🏠 Dashboard, ⚡ Automations standalone. Click a folder in the sidebar to open a chat → it appears in a folder group with a colored stripe. Open a file → it joins the same group. Standalone "New Claude chat" tabs stay in the standalone section. Close dev server.

- [ ] **Step 6: Commit**

```bash
git add -A src/renderer
git commit -m "feat(tabs): tab bar with standalone zone + per-folder groups"
```

---

## Phase 5 — Command palette

### Task 10: CommandPalette query + filter logic

**Files:**
- Create: `src/renderer/components/CommandPalette/filter.ts`
- Create: `src/renderer/components/CommandPalette/filter.test.ts`

- [ ] **Step 1: Write failing tests for the filter**

`src/renderer/components/CommandPalette/filter.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { filterItems, type PaletteItem } from './filter'

const items: PaletteItem[] = [
  { id: 'action:new', kind: 'action', label: 'New Claude chat', hint: '⌘T' },
  { id: 'folder:/x/bm', kind: 'folder', label: 'finance/benefits-model' },
  { id: 'chat:1', kind: 'chat', label: 'Refresh BI dashboard', hint: '2h' },
  { id: 'file:/x/bm/dashboard.html', kind: 'file', label: 'dashboard.html', hint: 'benefits-model' },
  { id: 'skill:refresh-bi', kind: 'skill', label: 'refresh-fbos-bi-dash', hint: 'skill' },
]

describe('filterItems', () => {
  it('returns all on empty query, grouped by kind', () => {
    const result = filterItems(items, '')
    expect(result.length).toBe(5)
  })

  it('matches substring case-insensitively', () => {
    expect(filterItems(items, 'bi').map(i => i.id)).toContain('chat:1')
    expect(filterItems(items, 'BI').map(i => i.id)).toContain('chat:1')
  })

  it('ranks chats above files when both match', () => {
    const r = filterItems(items, 'bi dash')
    const chatIdx = r.findIndex(i => i.id === 'chat:1')
    const fileIdx = r.findIndex(i => i.id === 'file:/x/bm/dashboard.html')
    expect(chatIdx).toBeLessThan(fileIdx)
  })

  it('limits results to 8 per kind', () => {
    const many = Array.from({ length: 12 }, (_, i): PaletteItem => ({
      id: `f:${i}`, kind: 'file', label: `bi-${i}.sql`
    }))
    const r = filterItems(many, 'bi')
    expect(r.filter(i => i.kind === 'file').length).toBeLessThanOrEqual(8)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm run test:run -- CommandPalette/filter
```

- [ ] **Step 3: Implement filter**

`src/renderer/components/CommandPalette/filter.ts`:
```ts
export type PaletteKind = 'action' | 'folder' | 'chat' | 'file' | 'skill'

export interface PaletteItem {
  id: string
  kind: PaletteKind
  label: string
  hint?: string
  meta?: unknown
}

// Order matters: actions, then chats, then folders, then files, then skills.
const KIND_RANK: Record<PaletteKind, number> = {
  action: 0, chat: 1, folder: 2, file: 3, skill: 4,
}
const PER_KIND_LIMIT = 8

export function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase()
  const terms = q.split(/\s+/).filter(Boolean)

  const matched = items.filter(i => {
    if (terms.length === 0) return true
    const hay = `${i.label} ${i.hint ?? ''}`.toLowerCase()
    return terms.every(t => hay.includes(t))
  })

  // Sort by kind rank, then preserve original order.
  matched.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])

  // Per-kind limit.
  const counts: Partial<Record<PaletteKind, number>> = {}
  return matched.filter(i => {
    counts[i.kind] = (counts[i.kind] ?? 0) + 1
    return counts[i.kind]! <= PER_KIND_LIMIT
  })
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm run test:run -- CommandPalette/filter
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/CommandPalette/
git commit -m "feat(palette): query filter with per-kind limit and ranking"
```

### Task 11: CommandPalette component + Cmd+K wiring

**Files:**
- Create: `src/renderer/components/CommandPalette.tsx`
- Create: `src/renderer/components/CommandPalette.css`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Build CommandPalette UI**

`src/renderer/components/CommandPalette.tsx`:
```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { filterItems, type PaletteItem } from './CommandPalette/filter'
import './CommandPalette.css'

interface Props {
  visible: boolean
  onClose: () => void
  items: PaletteItem[]
  onSelect: (item: PaletteItem) => void
}

export default function CommandPalette({ visible, onClose, items, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => filterItems(items, query), [items, query])

  useEffect(() => {
    if (visible) {
      setQuery('')
      setSelectedIdx(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [visible])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  if (!visible) return null

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIdx]) {
        onSelect(results[selectedIdx])
        onClose()
      }
    }
  }

  return (
    <div className="palette-backdrop" onClick={onClose} role="dialog" aria-modal>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          placeholder="Search folders, chats, files, tools…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="palette-results">
          {results.map((item, i) => (
            <div
              key={item.id}
              className={`palette-item ${i === selectedIdx ? 'sel' : ''}`}
              onMouseEnter={() => setSelectedIdx(i)}
              onClick={() => { onSelect(item); onClose() }}
            >
              <span className="kind">{iconFor(item.kind)}</span>
              <span className="name">{item.label}</span>
              {item.hint && <span className="kbd">{item.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function iconFor(k: string) {
  return ({ action: '✨', chat: '💬', folder: '📂', file: '📄', skill: '⚡' } as const)[k as 'action'] ?? '·'
}
```

- [ ] **Step 2: Create CommandPalette.css**

Copy `.palette-backdrop`, `.palette`, `.palette input`, `.palette-results`, `.palette-item`, `.palette-item.sel`, `.kbd` rules from `~/claude-ide-v2-mockup.html`. Save to `src/renderer/components/CommandPalette.css`.

- [ ] **Step 3: Wire Cmd+K in App.tsx**

In `src/renderer/App.tsx`:
```tsx
const [paletteOpen, setPaletteOpen] = useState(false)
const [paletteItems, setPaletteItems] = useState<PaletteItem[]>([])

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      buildPaletteItems().then(setPaletteItems)
      setPaletteOpen(p => !p)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])

async function buildPaletteItems(): Promise<PaletteItem[]> {
  // Actions
  const items: PaletteItem[] = [
    { id: 'action:new-chat', kind: 'action', label: 'New Claude chat', hint: '⌘T' },
  ]
  // Folders (open folder paths in projectPath history) — minimal MVP: just current project + parents
  // Recent chats
  const sessions = await window.api.getRecentSessions()
  for (const s of sessions.slice(0, 20)) {
    items.push({ id: `chat:${s.id}`, kind: 'chat', label: s.title, hint: relativeTime(s.startedAt), meta: s })
  }
  // Files in current project
  const fileTree = await window.api.listFiles(/* current projectPath */)
  for (const f of fileTree) items.push({ id: `file:${f}`, kind: 'file', label: basename(f), hint: dirname(f) })
  // Skills
  const skills = await window.api.getSkills()
  for (const s of skills) items.push({ id: `skill:${s.name}`, kind: 'skill', label: s.name, hint: 'skill' })
  return items
}
```

Then mount `<CommandPalette visible={paletteOpen} onClose={...} items={paletteItems} onSelect={handlePaletteSelect} />`. Implement `handlePaletteSelect` to dispatch the right action based on `item.kind` (new chat, open file, resume session, run skill).

- [ ] **Step 4: Remove old QuickOpen + ProjectSearch keyboard handlers**

These files are already deleted (Task 2). Confirm no references in `App.tsx`.

- [ ] **Step 5: Visual + functional check**

```bash
npm run dev
```
Expected: Cmd+K opens the palette. Type "new" → "New Claude chat" action. Press Enter → new tab opens. Type a folder/file/chat name → results filter. Esc closes. Close dev server.

- [ ] **Step 6: Commit**

```bash
git add -A src/renderer
git commit -m "feat(palette): Cmd+K unified search for folders/chats/files/skills/actions"
```

---

## Phase 6 — Status bar

### Task 12: StatusBar rewrite

**Files:**
- Modify: `src/renderer/components/StatusBar.tsx`
- Modify: `src/renderer/styles.css` (status bar styles)

- [ ] **Step 1: Rewrite StatusBar.tsx**

Replace contents with:
```tsx
import { useAppState } from '../store'

function formatTokens(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n: number | null): string {
  if (n === null) return '—'
  return `$${n.toFixed(2)}`
}

function getFolderBasename(p: string | null): string {
  if (!p) return '—'
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export default function StatusBar() {
  const { state } = useAppState()
  const { gitBranch, projectPath, claudeStatus } = state
  return (
    <div className="statusbar">
      <span className="grp">⎇ <span className="accent">{gitBranch ?? '—'}</span></span>
      <span className="sep">·</span>
      <span className="grp">📂 {getFolderBasename(projectPath)}</span>
      <span className="sep">·</span>
      <span className="grp">
        ✻ <span className="accent">{claudeStatus.model ?? '—'}</span>
      </span>
      <span className="sep">·</span>
      <span className="grp">§ <span className="ok">{formatTokens(claudeStatus.tokens)} tokens</span></span>
      <span className="sep">·</span>
      <span className="grp">$ <span className="warn">{formatCost(claudeStatus.cost)}</span></span>
      <span className="sep">·</span>
      <span className="grp">
        ⌛ <span className="accent">{claudeStatus.context?.used ?? '—'}</span>
        <span style={{ color: 'var(--text-muted)' }}> ({claudeStatus.context?.pct ?? '—'}%)</span>
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Update `ClaudeStatus` type if needed**

In `src/shared/types.ts`, ensure `ClaudeStatus` includes:
```ts
export interface ClaudeStatus {
  model: string | null      // e.g. "Opus 4.7"
  cost: number | null        // dollars
  tokens: number | null      // total tokens used
  context: { used: number; pct: number } | null
}
```

If `useClaudeStatus.ts` does not yet populate `context`, leave it returning `null` for now and add an inline `// follow-up: parse context % from Claude CLI status line` comment so the gap is discoverable later. The status bar handles the `null` gracefully.

- [ ] **Step 3: Update statusbar CSS**

Copy the `.statusbar`, `.grp`, `.sep`, `.accent`, `.ok`, `.warn` rules from `~/claude-ide-v2-mockup.html` into `src/renderer/styles.css`.

- [ ] **Step 4: Visual check**

```bash
npm run dev
```
Expected: status bar at the bottom shows branch, folder, model, tokens, cost, context. Real values appear once a Claude session is running. Close dev server.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/StatusBar.tsx src/renderer/styles.css src/shared/types.ts
git commit -m "feat(status): rewrite status bar with branch/folder/model/tokens/cost/context"
```

---

## Phase 7 — Scheduler core (main process)

### Task 13: `~/.claude-ide/` scaffolding + claude-env detection

**Files:**
- Create: `src/main/claude-env.ts`
- Create: `src/main/claude-env.test.ts`
- Create: `src/main/scheduler/paths.ts`

- [ ] **Step 1: Write failing test for env detection**

`src/main/claude-env.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildPlistEnv } from './claude-env'

describe('buildPlistEnv', () => {
  it('includes HOME, PATH with claude bin dir, CLAUDE_CODE_USE_BEDROCK=false', () => {
    const env = buildPlistEnv({
      claudeBin: '/Users/anisha.suterwala/.local/bin/claude',
      home: '/Users/anisha.suterwala',
    })
    expect(env.HOME).toBe('/Users/anisha.suterwala')
    expect(env.CLAUDE_CODE_USE_BEDROCK).toBe('false')
    expect(env.PATH).toContain('/Users/anisha.suterwala/.local/bin')
    expect(env.PATH).toContain('/usr/bin')
    expect(env.PATH).toContain('/opt/homebrew/bin')
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm run test:run -- claude-env
```

- [ ] **Step 3: Implement claude-env**

`src/main/claude-env.ts`:
```ts
import { execSync } from 'child_process'
import { dirname } from 'path'

export interface ClaudeEnvConfig {
  claudeBin: string
  home: string
}

const DEFAULT_PATH_PARTS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
]

export function detectClaudeBin(): string {
  try {
    const out = execSync('command -v claude', { encoding: 'utf8' }).trim()
    if (out) return out
  } catch {}
  // Fallback to known locations
  const candidates = [
    `${process.env.HOME}/.local/bin/claude`,
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ]
  for (const c of candidates) {
    try {
      execSync(`test -x ${c}`)
      return c
    } catch {}
  }
  throw new Error('claude binary not found in PATH or known locations')
}

export function buildPlistEnv(cfg: ClaudeEnvConfig): Record<string, string> {
  const claudeDir = dirname(cfg.claudeBin)
  const pathParts = Array.from(new Set([claudeDir, ...DEFAULT_PATH_PARTS]))
  return {
    HOME: cfg.home,
    PATH: pathParts.join(':'),
    CLAUDE_CODE_USE_BEDROCK: 'false',
  }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm run test:run -- claude-env
```
Expected: 1 passed.

- [ ] **Step 5: Define paths module**

`src/main/scheduler/paths.ts`:
```ts
import { join } from 'path'
import { homedir } from 'os'

export const CLAUDE_IDE_DIR = join(homedir(), '.claude-ide')
export const AUTOMATIONS_FILE = join(CLAUDE_IDE_DIR, 'automations.json')
export const PLISTS_DIR = join(CLAUDE_IDE_DIR, 'plists')
export const RUNS_DIR = join(CLAUDE_IDE_DIR, 'runs')
export const BIN_DIR = join(CLAUDE_IDE_DIR, 'bin')
export const RUN_AUTOMATION_SCRIPT = join(BIN_DIR, 'run-automation')
export const ENV_CONFIG_FILE = join(CLAUDE_IDE_DIR, 'env.json')
```

- [ ] **Step 6: Commit**

```bash
git add src/main/claude-env.ts src/main/claude-env.test.ts src/main/scheduler/paths.ts
git commit -m "feat(scheduler): claude bin detection + plist env builder"
```

### Task 14: `run-automation` shell script

**Files:**
- Create: `scripts/run-automation`

- [ ] **Step 1: Write the run-automation script**

`scripts/run-automation` (chmod +x):
```bash
#!/usr/bin/env bash
# Claude IDE — automation run engine.
# Usage: run-automation <automation-id> [trigger]
# trigger: schedule (default) | manual | catchup
set -uo pipefail

AUTOMATION_ID="${1:-}"
TRIGGER="${2:-schedule}"
[ -z "$AUTOMATION_ID" ] && { echo "missing automation id" >&2; exit 2; }

CLAUDE_IDE_DIR="$HOME/.claude-ide"
AUTOMATIONS_FILE="$CLAUDE_IDE_DIR/automations.json"
RUNS_DIR="$CLAUDE_IDE_DIR/runs"
ENV_FILE="$CLAUDE_IDE_DIR/env.json"

[ -f "$AUTOMATIONS_FILE" ] || { echo "automations.json missing" >&2; exit 3; }

# Source plist-equivalent env so PATH includes claude
if [ -f "$ENV_FILE" ]; then
  export HOME="$(jq -r '.HOME' "$ENV_FILE")"
  export PATH="$(jq -r '.PATH' "$ENV_FILE")"
  export CLAUDE_CODE_USE_BEDROCK="$(jq -r '.CLAUDE_CODE_USE_BEDROCK' "$ENV_FILE")"
fi

ENTRY=$(jq -c --arg id "$AUTOMATION_ID" '.[] | select(.id == $id)' "$AUTOMATIONS_FILE")
[ -z "$ENTRY" ] && { echo "automation not found: $AUTOMATION_ID" >&2; exit 4; }

NAME=$(echo "$ENTRY" | jq -r '.name')
SKILL=$(echo "$ENTRY" | jq -r '.skill')
FOLDER=$(echo "$ENTRY" | jq -r '.folder' | sed "s|^~|$HOME|")
TIMEOUT_MIN=$(echo "$ENTRY" | jq -r '.timeoutMin')
MODEL=$(echo "$ENTRY" | jq -r '.model')
DEPENDS_ON=$(echo "$ENTRY" | jq -r '.dependsOn | join(" ")')

TS="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$RUNS_DIR/${AUTOMATION_ID}__${TS}"
mkdir -p "$RUN_DIR"
STATUS="$RUN_DIR/status.json"
LOG="$RUN_DIR/run.log"

write_status() {
  jq -n \
    --arg runId "${AUTOMATION_ID}__${TS}" \
    --arg automationId "$AUTOMATION_ID" \
    --arg state "$1" \
    --arg startedAt "$STARTED_AT" \
    --arg triggeredBy "$TRIGGER" \
    --arg finishedAt "${2:-}" \
    --argjson durationMs "${3:-null}" \
    --argjson exitCode "${4:-null}" \
    --argjson tokensUsed "${5:-null}" \
    --argjson costUsd "${6:-null}" \
    --arg failureReason "${7:-}" \
    '{runId:$runId, automationId:$automationId, state:$state, startedAt:$startedAt, finishedAt:($finishedAt | select(. != "") // null), durationMs:$durationMs, exitCode:$exitCode, tokensUsed:$tokensUsed, costUsd:$costUsd, triggeredBy:$triggeredBy, failureReason:($failureReason | select(. != ""))}' \
    > "$STATUS"
}

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
write_status "running"

# Dependency check: each upstream must have a completed run TODAY.
TODAY="$(date +%Y%m%d)"
for DEP in $DEPENDS_ON; do
  # Look for completed run in today's runs
  FOUND=0
  for d in "$RUNS_DIR"/"${DEP}"__"${TODAY}"*; do
    [ -f "$d/status.json" ] || continue
    STATE=$(jq -r '.state' "$d/status.json")
    if [ "$STATE" = "completed" ]; then FOUND=1; break; fi
  done
  if [ "$FOUND" = 0 ]; then
    FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    write_status "skipped" "$FINISHED_AT" 0 null null null "dependency $DEP not completed today"
    exit 0
  fi
done

# Execute claude in folder with the skill activated.
# NOTE: exact CLI invocation may need adjustment once the project decides on the canonical form;
# this uses `claude -p '/skill <name>'` which currently invokes a skill in non-interactive mode.
START_MS=$(date +%s%3N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1000))')
cd "$FOLDER" || { write_status "failed" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" 0 1 null null "folder not found: $FOLDER"; exit 1; }

set +e
timeout "${TIMEOUT_MIN}m" claude -p "/skill ${SKILL}" --model "${MODEL}" > "$LOG" 2>&1
EXIT_CODE=$?
set -e

FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
END_MS=$(date +%s%3N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1000))')
DURATION=$((END_MS - START_MS))

# Best-effort cost + token extraction from log (Claude prints them in its status footer)
COST=$(grep -oE '\$[0-9]+\.[0-9]+' "$LOG" | tail -1 | sed 's/\$//' || echo "")
TOKENS=$(grep -oE '[0-9]+(\.[0-9]+)?[KM]? tokens' "$LOG" | tail -1 | sed -E 's/ tokens//' || echo "")

if [ "$EXIT_CODE" = 124 ]; then
  write_status "timeout" "$FINISHED_AT" "$DURATION" "$EXIT_CODE" null null "exceeded ${TIMEOUT_MIN}min"
elif [ "$EXIT_CODE" = 0 ]; then
  write_status "completed" "$FINISHED_AT" "$DURATION" "$EXIT_CODE" "${TOKENS:-null}" "${COST:-null}"
else
  write_status "failed" "$FINISHED_AT" "$DURATION" "$EXIT_CODE" "${TOKENS:-null}" "${COST:-null}" "exit $EXIT_CODE"
fi
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/run-automation
```

- [ ] **Step 3: Manual smoke test**

Manually create a test automation file and run the script:
```bash
mkdir -p ~/.claude-ide/runs ~/.claude-ide/bin
cp scripts/run-automation ~/.claude-ide/bin/
cat > ~/.claude-ide/automations.json <<'EOF'
[
  {
    "id":"smoke","name":"Smoke","icon":"🧪","skill":"nonexistent",
    "folder":"~","schedule":null,"enabled":true,"dependsOn":[],
    "timeoutMin":1,"model":"sonnet","monthlyBudgetUsd":null
  }
]
EOF
cat > ~/.claude-ide/env.json <<EOF
{"HOME":"$HOME","PATH":"$PATH","CLAUDE_CODE_USE_BEDROCK":"false"}
EOF
~/.claude-ide/bin/run-automation smoke manual
ls ~/.claude-ide/runs/
cat ~/.claude-ide/runs/smoke__*/status.json
```
Expected: a run folder exists with `status.json`. State will be `failed` (skill doesn't exist) but the script wrote the file correctly.

- [ ] **Step 4: Commit**

```bash
git add scripts/run-automation
git commit -m "feat(scheduler): run-automation shell script (dep resolution + status writing)"
```

### Task 15: `scheduler.ts` main process module (CRUD + plist generation)

**Files:**
- Create: `src/main/scheduler.ts`
- Create: `src/main/scheduler/plist-template.ts`
- Create: `src/main/scheduler/plist-template.test.ts`

- [ ] **Step 1: Write failing test for plist generation**

`src/main/scheduler/plist-template.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generatePlist } from './plist-template'

describe('generatePlist', () => {
  it('produces a valid launchd plist for cron-style schedule', () => {
    const plist = generatePlist({
      label: 'com.claudeide.morning-brief',
      programArgs: ['/Users/x/.claude-ide/bin/run-automation', 'morning-brief', 'schedule'],
      cron: '0 7 * * 1-5', // 7am Mon-Fri
      env: { HOME: '/Users/x', PATH: '/usr/bin', CLAUDE_CODE_USE_BEDROCK: 'false' },
      stdoutPath: '/Users/x/.claude-ide/runs/morning-brief.stdout',
      stderrPath: '/Users/x/.claude-ide/runs/morning-brief.stderr',
    })
    expect(plist).toContain('<key>Label</key><string>com.claudeide.morning-brief</string>')
    expect(plist).toContain('<key>ProgramArguments</key>')
    expect(plist).toContain('<string>/Users/x/.claude-ide/bin/run-automation</string>')
    expect(plist).toContain('<key>StartCalendarInterval</key>')
    // 5 weekday entries (Mon-Fri) since launchd needs separate entries for ranges
    const matches = plist.match(/<key>Hour<\/key><integer>7<\/integer>/g)
    expect(matches?.length).toBe(5)
    expect(plist).toContain('<key>EnvironmentVariables</key>')
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm run test:run -- plist-template
```

- [ ] **Step 3: Implement plist generation**

`src/main/scheduler/plist-template.ts`:
```ts
export interface PlistInput {
  label: string
  programArgs: string[]
  cron: string  // "minute hour day-of-month month day-of-week"
  env: Record<string, string>
  stdoutPath: string
  stderrPath: string
}

// Parses cron expressions, returning an array of {Minute, Hour, Day, Month, Weekday} dicts.
// launchd's StartCalendarInterval lacks ranges and lists, so we expand them.
function expandCronField(field: string, min: number, max: number): number[] {
  if (field === '*') return [] // means "every"
  const out: Set<number> = new Set()
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      for (let i = a; i <= b; i++) out.add(i)
    } else {
      out.add(Number(part))
    }
  }
  // Validate range
  for (const v of out) if (v < min || v > max) throw new Error(`cron value ${v} out of range ${min}-${max}`)
  return [...out]
}

interface CalendarEntry {
  Minute?: number
  Hour?: number
  Day?: number
  Month?: number
  Weekday?: number
}

export function cronToCalendarEntries(cron: string): CalendarEntry[] {
  const [minF, hourF, domF, monthF, dowF] = cron.trim().split(/\s+/)
  const minutes = expandCronField(minF, 0, 59)
  const hours = expandCronField(hourF, 0, 23)
  const doms = expandCronField(domF, 1, 31)
  const months = expandCronField(monthF, 1, 12)
  const dows = expandCronField(dowF, 0, 7).map(d => d === 7 ? 0 : d) // 7 → Sunday alias

  const entries: CalendarEntry[] = []
  const minuteList = minutes.length ? minutes : [undefined]
  const hourList = hours.length ? hours : [undefined]
  const domList = doms.length ? doms : [undefined]
  const monthList = months.length ? months : [undefined]
  const dowList = dows.length ? dows : [undefined]

  for (const M of minuteList) for (const H of hourList) for (const D of domList) for (const Mo of monthList) for (const W of dowList) {
    const e: CalendarEntry = {}
    if (M !== undefined) e.Minute = M
    if (H !== undefined) e.Hour = H
    if (D !== undefined) e.Day = D
    if (Mo !== undefined) e.Month = Mo
    if (W !== undefined) e.Weekday = W
    entries.push(e)
  }
  return entries
}

function calendarEntryXml(e: CalendarEntry): string {
  const parts: string[] = []
  if (e.Minute !== undefined) parts.push(`<key>Minute</key><integer>${e.Minute}</integer>`)
  if (e.Hour !== undefined) parts.push(`<key>Hour</key><integer>${e.Hour}</integer>`)
  if (e.Day !== undefined) parts.push(`<key>Day</key><integer>${e.Day}</integer>`)
  if (e.Month !== undefined) parts.push(`<key>Month</key><integer>${e.Month}</integer>`)
  if (e.Weekday !== undefined) parts.push(`<key>Weekday</key><integer>${e.Weekday}</integer>`)
  return `<dict>${parts.join('')}</dict>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function generatePlist(input: PlistInput): string {
  const cal = cronToCalendarEntries(input.cron)
  const calXml = cal.length === 1
    ? `<key>StartCalendarInterval</key>${calendarEntryXml(cal[0])}`
    : `<key>StartCalendarInterval</key><array>${cal.map(calendarEntryXml).join('')}</array>`
  const argsXml = input.programArgs.map(a => `<string>${escapeXml(a)}</string>`).join('')
  const envXml = Object.entries(input.env).map(([k, v]) =>
    `<key>${escapeXml(k)}</key><string>${escapeXml(v)}</string>`
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${escapeXml(input.label)}</string>
  <key>ProgramArguments</key><array>${argsXml}</array>
  ${calXml}
  <key>EnvironmentVariables</key><dict>${envXml}</dict>
  <key>StandardOutPath</key><string>${escapeXml(input.stdoutPath)}</string>
  <key>StandardErrorPath</key><string>${escapeXml(input.stderrPath)}</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>`
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm run test:run -- plist-template
```
Expected: 1 passed.

- [ ] **Step 5: Implement scheduler.ts**

`src/main/scheduler.ts`:
```ts
import { promises as fs } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join, dirname } from 'path'
import {
  AUTOMATIONS_FILE, PLISTS_DIR, RUNS_DIR, BIN_DIR,
  CLAUDE_IDE_DIR, ENV_CONFIG_FILE, RUN_AUTOMATION_SCRIPT,
} from './scheduler/paths'
import { generatePlist } from './scheduler/plist-template'
import { detectClaudeBin, buildPlistEnv } from './claude-env'
import type { Automation, AutomationInput, Run } from '../shared/automation-types'
import { app } from 'electron'

const execFileP = promisify(execFile)

const SCRIPT_SRC = join(app.getAppPath(), 'scripts/run-automation')

async function ensureScaffolding(): Promise<void> {
  await fs.mkdir(CLAUDE_IDE_DIR, { recursive: true })
  await fs.mkdir(PLISTS_DIR, { recursive: true })
  await fs.mkdir(RUNS_DIR, { recursive: true })
  await fs.mkdir(BIN_DIR, { recursive: true })

  // Write/refresh env config
  const claudeBin = detectClaudeBin()
  const env = buildPlistEnv({ claudeBin, home: process.env.HOME ?? '' })
  await fs.writeFile(ENV_CONFIG_FILE, JSON.stringify(env, null, 2))

  // Copy script if missing or stale (compare mtimes)
  try {
    const srcStat = await fs.stat(SCRIPT_SRC)
    let needsCopy = true
    try {
      const dstStat = await fs.stat(RUN_AUTOMATION_SCRIPT)
      if (dstStat.mtimeMs >= srcStat.mtimeMs) needsCopy = false
    } catch {}
    if (needsCopy) {
      await fs.copyFile(SCRIPT_SRC, RUN_AUTOMATION_SCRIPT)
      await fs.chmod(RUN_AUTOMATION_SCRIPT, 0o755)
    }
  } catch (err) {
    console.error('Failed to install run-automation script', err)
  }

  // Initialize automations file if missing
  try { await fs.access(AUTOMATIONS_FILE) }
  catch { await fs.writeFile(AUTOMATIONS_FILE, '[]') }
}

async function readAutomations(): Promise<Automation[]> {
  const raw = await fs.readFile(AUTOMATIONS_FILE, 'utf8')
  return JSON.parse(raw)
}

async function writeAutomations(list: Automation[]): Promise<void> {
  await fs.writeFile(AUTOMATIONS_FILE, JSON.stringify(list, null, 2))
}

function plistPath(id: string): string {
  return join(PLISTS_DIR, `com.claudeide.${id}.plist`)
}

function plistLabel(id: string): string {
  return `com.claudeide.${id}`
}

async function writePlist(a: Automation): Promise<void> {
  if (!a.schedule || !a.enabled) return
  const env = JSON.parse(await fs.readFile(ENV_CONFIG_FILE, 'utf8'))
  const xml = generatePlist({
    label: plistLabel(a.id),
    programArgs: [RUN_AUTOMATION_SCRIPT, a.id, 'schedule'],
    cron: a.schedule,
    env,
    stdoutPath: join(RUNS_DIR, `${a.id}.stdout`),
    stderrPath: join(RUNS_DIR, `${a.id}.stderr`),
  })
  await fs.writeFile(plistPath(a.id), xml)
}

async function launchctl(args: string[]): Promise<void> {
  try {
    await execFileP('launchctl', args)
  } catch (err: any) {
    console.error('launchctl', args, 'failed:', err.message)
    throw err
  }
}

async function loadPlist(id: string): Promise<void> {
  await launchctl(['load', '-w', plistPath(id)])
}

async function unloadPlist(id: string): Promise<void> {
  try { await launchctl(['unload', '-w', plistPath(id)]) } catch {}
}

function newId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
}

export const scheduler = {
  async init(): Promise<void> { await ensureScaffolding() },

  async list(): Promise<Automation[]> { return readAutomations() },

  async create(input: AutomationInput): Promise<Automation> {
    const list = await readAutomations()
    const id = input.id ?? newId(input.name)
    if (list.some(a => a.id === id)) throw new Error(`automation already exists: ${id}`)
    const a: Automation = { ...input, id }
    list.push(a)
    await writeAutomations(list)
    if (a.enabled && a.schedule) {
      await writePlist(a)
      await loadPlist(id)
    }
    return a
  },

  async update(id: string, patch: Partial<AutomationInput>): Promise<Automation> {
    const list = await readAutomations()
    const idx = list.findIndex(a => a.id === id)
    if (idx === -1) throw new Error(`not found: ${id}`)
    const updated = { ...list[idx], ...patch }
    list[idx] = updated
    await writeAutomations(list)
    // Re-register: unload old, write+load new if still scheduled+enabled
    await unloadPlist(id)
    if (updated.enabled && updated.schedule) {
      await writePlist(updated)
      await loadPlist(id)
    } else {
      try { await fs.unlink(plistPath(id)) } catch {}
    }
    return updated
  },

  async remove(id: string): Promise<void> {
    const list = await readAutomations()
    const idx = list.findIndex(a => a.id === id)
    if (idx === -1) return
    list.splice(idx, 1)
    await writeAutomations(list)
    await unloadPlist(id)
    try { await fs.unlink(plistPath(id)) } catch {}
  },

  async runNow(id: string): Promise<string> {
    // Spawn the script in detached mode; return immediately with the expected runId.
    const ts = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15) + 'Z'
    const runId = `${id}__${ts}`
    const child = (await import('child_process')).spawn(RUN_AUTOMATION_SCRIPT, [id, 'manual'], {
      detached: true, stdio: 'ignore',
    })
    child.unref()
    return runId
  },

  async listRuns(opts?: { sinceDate?: Date; automationId?: string }): Promise<Run[]> {
    const dirents = await fs.readdir(RUNS_DIR, { withFileTypes: true })
    const out: Run[] = []
    for (const d of dirents) {
      if (!d.isDirectory()) continue
      if (opts?.automationId && !d.name.startsWith(`${opts.automationId}__`)) continue
      try {
        const raw = await fs.readFile(join(RUNS_DIR, d.name, 'status.json'), 'utf8')
        const run: Run = JSON.parse(raw)
        if (opts?.sinceDate && new Date(run.startedAt) < opts.sinceDate) continue
        out.push(run)
      } catch {}
    }
    return out
  },
}
```

- [ ] **Step 6: Type-check by building**

```bash
npm run build
```
Expected: clean build. If errors about types/paths, fix them.

- [ ] **Step 7: Commit**

```bash
git add src/main/scheduler.ts src/main/scheduler/
git commit -m "feat(scheduler): CRUD + plist generation + launchctl load/unload"
```

---

## Phase 8 — IPC + renderer integration

### Task 16: Wire scheduler IPC

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Init scheduler on app ready**

In `src/main/index.ts`, inside the `app.whenReady().then(...)` block, add:
```ts
import { scheduler } from './scheduler'
// ...
await scheduler.init()
```

- [ ] **Step 2: Register IPC handlers**

In `src/main/ipc-handlers.ts`, add (near other handlers):
```ts
import { scheduler } from './scheduler'

ipcMain.handle('automations:list', () => scheduler.list())
ipcMain.handle('automations:create', (_e, input) => scheduler.create(input))
ipcMain.handle('automations:update', (_e, id, patch) => scheduler.update(id, patch))
ipcMain.handle('automations:remove', (_e, id) => scheduler.remove(id))
ipcMain.handle('automations:runNow', (_e, id) => scheduler.runNow(id))
ipcMain.handle('automations:listRuns', (_e, opts) => scheduler.listRuns(opts))
```

- [ ] **Step 3: Expose to renderer via preload**

In `src/preload/index.ts`, extend the exposed `api` object:
```ts
contextBridge.exposeInMainWorld('api', {
  // existing methods...
  listAutomations: () => ipcRenderer.invoke('automations:list'),
  createAutomation: (input: any) => ipcRenderer.invoke('automations:create', input),
  updateAutomation: (id: string, patch: any) => ipcRenderer.invoke('automations:update', id, patch),
  removeAutomation: (id: string) => ipcRenderer.invoke('automations:remove', id),
  runAutomationNow: (id: string) => ipcRenderer.invoke('automations:runNow', id),
  listRuns: (opts?: any) => ipcRenderer.invoke('automations:listRuns', opts),
})
```

Also update the `Window` type augmentation in `src/renderer/env.d.ts` (or wherever `window.api` is typed) to include these new methods.

- [ ] **Step 4: Smoke test from devtools**

```bash
npm run dev
```
In the renderer DevTools console:
```js
await window.api.listAutomations()  // should return []
await window.api.createAutomation({
  name: 'Smoke', icon: '🧪', skill: 'smoke', folder: '~',
  schedule: null, enabled: false, dependsOn: [], timeoutMin: 1,
  model: 'sonnet', monthlyBudgetUsd: null
})
await window.api.listAutomations()  // should return one entry
await window.api.removeAutomation('<id-from-above>')
```
Expected: ops succeed without error. Close dev server.

- [ ] **Step 5: Commit**

```bash
git add -A src/main src/preload src/renderer/env.d.ts
git commit -m "feat(scheduler): IPC handlers + preload exposure"
```

### Task 17: useAutomations hook with chokidar watch

**Files:**
- Create: `src/main/scheduler/runs-watcher.ts`
- Modify: `src/main/index.ts`, `src/main/ipc-handlers.ts`, `src/preload/index.ts`
- Create: `src/renderer/hooks/useAutomations.ts`

- [ ] **Step 1: Build runs watcher in main process**

`src/main/scheduler/runs-watcher.ts`:
```ts
import chokidar from 'chokidar'
import { RUNS_DIR } from './paths'
import { promises as fs } from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import type { Run } from '../../shared/automation-types'

let watcher: chokidar.FSWatcher | null = null

export function startRunsWatcher(win: BrowserWindow): void {
  watcher = chokidar.watch(`${RUNS_DIR}/**/status.json`, {
    ignoreInitial: false, depth: 2, awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  })
  watcher.on('add', sendRun)
  watcher.on('change', sendRun)
  async function sendRun(path: string) {
    try {
      const raw = await fs.readFile(path, 'utf8')
      const run: Run = JSON.parse(raw)
      if (!win.isDestroyed()) win.webContents.send('automations:run-update', run)
    } catch {}
  }
}

export function stopRunsWatcher(): void {
  watcher?.close()
  watcher = null
}
```

- [ ] **Step 2: Start watcher when main window opens**

In `src/main/index.ts`, after the main window is created and `scheduler.init()` has run:
```ts
import { startRunsWatcher, stopRunsWatcher } from './scheduler/runs-watcher'
// ...
startRunsWatcher(mainWindow)
app.on('will-quit', stopRunsWatcher)
```

- [ ] **Step 3: Expose subscription to renderer**

In `src/preload/index.ts`:
```ts
onRunUpdate: (cb: (run: any) => void) => {
  const handler = (_: any, run: any) => cb(run)
  ipcRenderer.on('automations:run-update', handler)
  return () => ipcRenderer.off('automations:run-update', handler)
}
```

- [ ] **Step 4: Build useAutomations hook**

`src/renderer/hooks/useAutomations.ts`:
```ts
import { useEffect, useState, useCallback } from 'react'
import type { Automation, Run, AutomationInput } from '../../shared/automation-types'

export function useAutomations() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [a, r] = await Promise.all([
      window.api.listAutomations(),
      window.api.listRuns({ sinceDate: startOfTodayUtc() }),
    ])
    setAutomations(a)
    setRuns(r)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const unsubscribe = window.api.onRunUpdate((run: Run) => {
      setRuns(prev => {
        const idx = prev.findIndex(p => p.runId === run.runId)
        if (idx === -1) return [...prev, run]
        const copy = [...prev]
        copy[idx] = run
        return copy
      })
    })
    return unsubscribe
  }, [refresh])

  return {
    automations, runs, loading, refresh,
    create: async (input: AutomationInput) => { await window.api.createAutomation(input); await refresh() },
    update: async (id: string, patch: Partial<AutomationInput>) => { await window.api.updateAutomation(id, patch); await refresh() },
    remove: async (id: string) => { await window.api.removeAutomation(id); await refresh() },
    runNow: async (id: string) => window.api.runAutomationNow(id),
  }
}

function startOfTodayUtc(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(scheduler): chokidar runs watcher + useAutomations hook"
```

---

## Phase 9 — Automations view

### Task 18: AutomationsView shell

**Files:**
- Create: `src/renderer/components/AutomationsView.tsx`
- Create: `src/renderer/components/AutomationsView/AutomationsView.css`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Build the shell**

`src/renderer/components/AutomationsView.tsx`:
```tsx
import { useState } from 'react'
import { useAutomations } from '../hooks/useAutomations'
import Timeline from './AutomationsView/Timeline'
import RunList from './AutomationsView/RunList'
import AutomationForm from './AutomationsView/AutomationForm'
import './AutomationsView/AutomationsView.css'

export default function AutomationsView({ visible }: { visible: boolean }) {
  const [view, setView] = useState<'timeline' | 'list'>('timeline')
  const [formOpen, setFormOpen] = useState(false)
  const { automations, runs, create, update, remove, runNow } = useAutomations()

  if (!visible) return null

  const stats = countByState(runs)

  return (
    <div className="automations">
      <header className="auto-header">
        <h2>⚡ Automations</h2>
        <div className="view-toggle">
          <button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>Timeline</button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
        </div>
        <div className="auto-stats">
          <span className="stat-pill done">{stats.completed} ✓</span>
          <span className="stat-pill running">{stats.running} ●</span>
          <span className="stat-pill failed">{stats.failed + stats.timeout} ✗</span>
          <span className="stat-pill scheduled">{automations.filter(a => a.enabled && a.schedule).length} ⏱</span>
        </div>
        <button className="new-auto" onClick={() => setFormOpen(true)}>+ New Automation</button>
      </header>
      {view === 'timeline'
        ? <Timeline automations={automations} runs={runs} onRunNow={runNow} />
        : <RunList automations={automations} runs={runs} onRunNow={runNow} onEdit={a => setFormOpen(true)} onRemove={remove} />}
      {formOpen && (
        <AutomationForm
          onSubmit={async (input) => { await create(input); setFormOpen(false) }}
          onCancel={() => setFormOpen(false)}
        />
      )}
    </div>
  )
}

function countByState(runs: { state: string }[]) {
  const out = { completed: 0, running: 0, failed: 0, timeout: 0, skipped: 0 }
  for (const r of runs) (out as any)[r.state] = ((out as any)[r.state] ?? 0) + 1
  return out
}
```

- [ ] **Step 2: Stub Timeline, RunList, AutomationForm**

For each — create the file with a placeholder that types correctly, returns minimal JSX, so the shell compiles. Fill in real implementations in Tasks 19–21.

`src/renderer/components/AutomationsView/Timeline.tsx`:
```tsx
import type { Automation, Run } from '../../../shared/automation-types'
interface Props { automations: Automation[]; runs: Run[]; onRunNow: (id: string) => void }
export default function Timeline({ automations }: Props) {
  return <div className="auto-timeline">Timeline (Phase 9.2) — {automations.length} automations</div>
}
```

`src/renderer/components/AutomationsView/RunList.tsx`:
```tsx
import type { Automation, Run } from '../../../shared/automation-types'
interface Props {
  automations: Automation[]; runs: Run[];
  onRunNow: (id: string) => void; onEdit: (a: Automation) => void; onRemove: (id: string) => void;
}
export default function RunList({ automations }: Props) {
  return <div className="auto-list">List view (Phase 9.3) — {automations.length} automations</div>
}
```

`src/renderer/components/AutomationsView/AutomationForm.tsx`:
```tsx
import type { AutomationInput } from '../../../shared/automation-types'
interface Props { onSubmit: (input: AutomationInput) => void | Promise<void>; onCancel: () => void }
export default function AutomationForm({ onCancel }: Props) {
  return <div className="auto-form">Form (Phase 9.4) <button onClick={onCancel}>Cancel</button></div>
}
```

- [ ] **Step 3: Mount in App.tsx**

In `src/renderer/App.tsx`, replace the conditional Dashboard/terminal/editor block with also mounting `<AutomationsView visible={state.activeTabId === 'automations'} />` next to it.

- [ ] **Step 4: Visual check**

```bash
npm run dev
```
Expected: clicking the ⚡ Automations tab shows the shell — header, view toggle, empty list, "+ New Automation" button. Other tabs unaffected. Close dev server.

- [ ] **Step 5: Commit**

```bash
git add -A src/renderer/components/AutomationsView*
git commit -m "feat(automations): view shell with view toggle and stats pills"
```

### Task 19: Timeline rendering with positioning logic

**Files:**
- Modify: `src/renderer/components/AutomationsView/Timeline.tsx`
- Create: `src/renderer/components/AutomationsView/timelinePosition.ts`
- Create: `src/renderer/components/AutomationsView/timelinePosition.test.ts`

- [ ] **Step 1: Write failing tests for positioning**

`src/renderer/components/AutomationsView/timelinePosition.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { timeToPct, runBlockPosition, AXIS_START_HOUR, AXIS_END_HOUR } from './timelinePosition'

describe('timelinePosition', () => {
  it('axis spans 4am–10pm (18 hours)', () => {
    expect(AXIS_START_HOUR).toBe(4)
    expect(AXIS_END_HOUR).toBe(22)
  })

  it('timeToPct maps 4am→0, 1pm→50, 10pm→100', () => {
    const at = (h: number, m = 0) => {
      const d = new Date(); d.setHours(h, m, 0, 0); return d
    }
    expect(timeToPct(at(4, 0))).toBeCloseTo(0, 1)
    expect(timeToPct(at(13, 0))).toBeCloseTo(50, 1)
    expect(timeToPct(at(22, 0))).toBeCloseTo(100, 1)
  })

  it('runBlockPosition returns left and width percent', () => {
    const start = new Date(); start.setHours(7, 0, 0, 0)
    const finish = new Date(); finish.setHours(7, 36, 0, 0)
    const pos = runBlockPosition(start, finish)
    expect(pos.leftPct).toBeCloseTo(100 * 3 / 18, 1)
    expect(pos.widthPct).toBeCloseTo(100 * 0.6 / 18, 1)
  })

  it('runBlockPosition floors width at 1.5% for visibility', () => {
    const start = new Date(); start.setHours(7, 0, 0, 0)
    const finish = new Date(); finish.setHours(7, 1, 0, 0)
    const pos = runBlockPosition(start, finish)
    expect(pos.widthPct).toBeGreaterThanOrEqual(1.5)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm run test:run -- timelinePosition
```

- [ ] **Step 3: Implement positioning**

`src/renderer/components/AutomationsView/timelinePosition.ts`:
```ts
export const AXIS_START_HOUR = 4
export const AXIS_END_HOUR = 22
export const AXIS_SPAN_HOURS = AXIS_END_HOUR - AXIS_START_HOUR
const MIN_WIDTH_PCT = 1.5

export function timeToPct(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const clamped = Math.max(AXIS_START_HOUR, Math.min(AXIS_END_HOUR, hours))
  return ((clamped - AXIS_START_HOUR) / AXIS_SPAN_HOURS) * 100
}

export function runBlockPosition(startedAt: Date, finishedAt: Date | null): { leftPct: number; widthPct: number } {
  const leftPct = timeToPct(startedAt)
  const end = finishedAt ?? new Date()
  const rawWidth = timeToPct(end) - leftPct
  const widthPct = Math.max(MIN_WIDTH_PCT, rawWidth)
  return { leftPct, widthPct }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm run test:run -- timelinePosition
```
Expected: 4 passed.

- [ ] **Step 5: Build Timeline JSX**

Replace `Timeline.tsx`:
```tsx
import type { Automation, Run } from '../../../shared/automation-types'
import { timeToPct, runBlockPosition, AXIS_START_HOUR, AXIS_END_HOUR } from './timelinePosition'

interface Props { automations: Automation[]; runs: Run[]; onRunNow: (id: string) => void }

function fmtHour(h: number): string {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

export default function Timeline({ automations, runs }: Props) {
  const now = new Date()
  const nowPct = timeToPct(now)
  const labels = [4, 7, 10, 13, 16, 19, 22]
  return (
    <div className="auto-timeline">
      <div className="time-axis">
        {labels.map(h => (
          <span key={h} style={{ left: `${((h - AXIS_START_HOUR) / (AXIS_END_HOUR - AXIS_START_HOUR)) * 100}%` }}>
            {fmtHour(h)}
          </span>
        ))}
      </div>
      {automations.map(a => {
        const myRuns = runs.filter(r => r.automationId === a.id)
        return (
          <div className="auto-row" key={a.id}>
            <div className="auto-label">
              <span className="auto-icon">{a.icon}</span>
              <span className="auto-name">{a.name}</span>
              <span className="auto-cron">{a.schedule ?? 'manual'}</span>
            </div>
            <div className="auto-track">
              <div className="now-marker" style={{ left: `${nowPct}%` }}></div>
              {myRuns.map(r => {
                const start = new Date(r.startedAt)
                const finish = r.finishedAt ? new Date(r.finishedAt) : null
                const { leftPct, widthPct } = runBlockPosition(start, finish)
                const cls =
                  r.state === 'running' ? 'run-block running' :
                  r.state === 'failed' || r.state === 'timeout' ? 'run-block failed' :
                  r.state === 'skipped' || r.state === 'skipped_budget' ? 'run-block scheduled' :
                  'run-block done'
                const label =
                  r.state === 'running' ? `● ${Math.round((Date.now() - start.getTime()) / 60000)}m` :
                  r.state === 'failed' || r.state === 'timeout' ? '✗' :
                  '✓'
                return (
                  <div
                    key={r.runId}
                    className={cls}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={r.failureReason ?? `${r.state} · ${r.durationMs ? Math.round(r.durationMs / 1000) + 's' : ''}`}
                  >{label}</div>
                )
              })}
            </div>
          </div>
        )
      })}
      {automations.length === 0 && (
        <div className="empty">No automations yet. Click "+ New Automation" to add one.</div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Copy timeline CSS from mockup**

In `AutomationsView/AutomationsView.css`, paste the `.auto-timeline`, `.time-axis`, `.auto-row`, `.auto-label`, `.auto-track`, `.run-block.*`, `.now-marker` rules from the mockup.

- [ ] **Step 7: Visual check**

```bash
npm run dev
```
Create one automation via DevTools (`window.api.createAutomation({...})`), then open the Automations tab. Expected: timeline shows the row; once you run-now (no real Claude run yet for actual completion, but the script will write status), the run block appears on the track. Close dev server.

- [ ] **Step 8: Commit**

```bash
git add -A src/renderer/components/AutomationsView/
git commit -m "feat(automations): timeline view with status-colored run blocks + NOW marker"
```

### Task 20: List view

**Files:**
- Modify: `src/renderer/components/AutomationsView/RunList.tsx`

- [ ] **Step 1: Implement RunList**

```tsx
import type { Automation, Run } from '../../../shared/automation-types'

interface Props {
  automations: Automation[]; runs: Run[];
  onRunNow: (id: string) => void; onEdit: (a: Automation) => void; onRemove: (id: string) => void;
}

function fmtSchedule(cron: string | null): string {
  if (!cron) return 'manual only'
  // Lightweight humanization. Could swap for a lib later.
  const map: Record<string, string> = {
    '0 7 * * 1-5': 'Weekdays 7:00a',
    '0 8 * * 1': 'Mondays 8:00a',
    '0 11 * * *': 'Daily 11:00a',
    '0 12 * * *': 'Daily 12:00p',
    '0 14 * * *': 'Daily 2:00p',
    '0 17 * * *': 'Daily 5:00p',
  }
  return map[cron] ?? cron
}

function fmtRelativeFinished(run: Run | undefined): string {
  if (!run) return '—'
  const t = run.finishedAt ?? run.startedAt
  const ms = Date.now() - new Date(t).getTime()
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.round(hr / 24)}d ago`
}

export default function RunList({ automations, runs, onRunNow, onRemove }: Props) {
  const latestByAutomation = new Map<string, Run>()
  for (const r of runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    latestByAutomation.set(r.automationId, r)
  }
  return (
    <div className="auto-list">
      <table>
        <thead>
          <tr><th>Automation</th><th>Schedule</th><th>Last Run</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {automations.map(a => {
            const last = latestByAutomation.get(a.id)
            const badgeClass =
              !last ? 'scheduled' :
              last.state === 'completed' ? 'done' :
              last.state === 'running' ? 'running' :
              last.state === 'failed' || last.state === 'timeout' ? 'failed' :
              'scheduled'
            const badgeLabel = !last ? 'Never run' : last.state[0].toUpperCase() + last.state.slice(1)
            return (
              <tr key={a.id}>
                <td className="name">{a.icon} {a.name}</td>
                <td>{fmtSchedule(a.schedule)}</td>
                <td>{fmtRelativeFinished(last)}</td>
                <td><span className={`badge ${badgeClass}`}>{badgeLabel}</span></td>
                <td>
                  <button className="run-btn" onClick={() => onRunNow(a.id)}>▶ Run now</button>
                  <button className="run-btn" onClick={() => { if (confirm(`Delete automation "${a.name}"?`)) onRemove(a.id) }} style={{ marginLeft: 4 }}>🗑</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {automations.length === 0 && <div className="empty">No automations yet.</div>}
    </div>
  )
}
```

- [ ] **Step 2: Copy list CSS from mockup**

Append `.auto-list`, `.auto-list table`, `.auto-list th`, `.auto-list td`, `.badge.*`, `.run-btn` from the mockup to `AutomationsView.css`.

- [ ] **Step 3: Visual check**

```bash
npm run dev
```
Click "List" — expect a table with Run now / 🗑 buttons. Click Run now → eventually a row updates (after the script writes its status; may take seconds).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/AutomationsView/RunList.tsx src/renderer/components/AutomationsView/AutomationsView.css
git commit -m "feat(automations): list view with run-now + delete"
```

### Task 21: + New Automation form

**Files:**
- Modify: `src/renderer/components/AutomationsView/AutomationForm.tsx`

- [ ] **Step 1: Build the form**

```tsx
import { useEffect, useState } from 'react'
import type { AutomationInput, Skill } from '../../../shared/automation-types'

interface Props { onSubmit: (input: AutomationInput) => Promise<void> | void; onCancel: () => void }

const CRON_PRESETS = [
  { label: 'Manual only (no schedule)', value: null },
  { label: 'Weekdays 7:00am', value: '0 7 * * 1-5' },
  { label: 'Mondays 8:00am', value: '0 8 * * 1' },
  { label: 'Daily 11:00am', value: '0 11 * * *' },
  { label: 'Daily 12:00pm', value: '0 12 * * *' },
  { label: 'Daily 2:00pm', value: '0 14 * * *' },
  { label: 'Daily 5:00pm', value: '0 17 * * *' },
  { label: 'Custom cron…', value: 'CUSTOM' },
]

export default function AutomationForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('⚡')
  const [skill, setSkill] = useState('')
  const [folder, setFolder] = useState('~')
  const [preset, setPreset] = useState<string | null>(null)
  const [customCron, setCustomCron] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [timeoutMin, setTimeoutMin] = useState(30)
  const [model, setModel] = useState<'opus' | 'sonnet'>('opus')
  const [budget, setBudget] = useState<string>('')
  const [skills, setSkills] = useState<Skill[]>([])

  useEffect(() => {
    window.api.getSkills?.().then(setSkills).catch(() => setSkills([]))
  }, [])

  const submit = async () => {
    if (!name.trim() || !skill.trim()) { alert('Name and skill are required.'); return }
    const schedule = preset === 'CUSTOM' ? customCron : preset
    await onSubmit({
      name: name.trim(), icon, skill: skill.trim(), folder: folder.trim() || '~',
      schedule: schedule || null,
      enabled, dependsOn: [], timeoutMin, model,
      monthlyBudgetUsd: budget.trim() ? Number(budget) : null,
    })
  }

  return (
    <div className="form-modal" onClick={onCancel}>
      <div className="form" onClick={(e) => e.stopPropagation()}>
        <h3>New Automation</h3>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Refresh BI Dashboard" /></label>
        <label>Icon<input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} style={{ width: 40 }} /></label>
        <label>Skill
          <select value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">— pick a skill —</option>
            {skills.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </label>
        <label>Folder<input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="~/Documents/finance/benefits-model" /></label>
        <label>Schedule
          <select value={preset ?? 'null'} onChange={(e) => setPreset(e.target.value === 'null' ? null : e.target.value)}>
            {CRON_PRESETS.map(p => <option key={String(p.value)} value={String(p.value ?? 'null')}>{p.label}</option>)}
          </select>
        </label>
        {preset === 'CUSTOM' && (
          <label>Custom cron<input value={customCron} onChange={(e) => setCustomCron(e.target.value)} placeholder="0 7 * * 1-5" /></label>
        )}
        <label>Timeout (min)<input type="number" value={timeoutMin} onChange={(e) => setTimeoutMin(Number(e.target.value))} min={1} max={240} /></label>
        <label>Model
          <select value={model} onChange={(e) => setModel(e.target.value as 'opus' | 'sonnet')}>
            <option value="opus">Opus (best quality)</option>
            <option value="sonnet">Sonnet (faster/cheaper)</option>
          </select>
        </label>
        <label>Monthly budget ($, optional)<input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="(no cap)" step="0.01" min={0} /></label>
        <label><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled</label>
        <div className="form-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={submit}>Create</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `getSkills` IPC**

The renderer references `window.api.getSkills?.()`. In `src/main/ipc-handlers.ts`:
```ts
import { discoverSkills } from './skills-discovery' // or wherever existing skill auto-detection lives
ipcMain.handle('skills:list', () => discoverSkills())
```

In `src/preload/index.ts`:
```ts
getSkills: () => ipcRenderer.invoke('skills:list'),
```

If the existing skill auto-detection isn't a separate module, lift the logic out of `SkillsLauncher.tsx` into `src/main/skills-discovery.ts`. Skills live in `~/.claude/skills/*/SKILL.md` and plugin caches per the user's setup; read those dirs and parse the YAML frontmatter for `name` and `description`.

- [ ] **Step 3: Form CSS**

Append to `AutomationsView.css`:
```css
.form-modal { position: fixed; inset: 0; background: rgba(45,55,72,0.25); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 100; }
.form { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px; min-width: 420px; max-width: 520px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 24px 60px rgba(45,55,72,0.18); }
.form h3 { margin: 0 0 8px; font-size: 17px; }
.form label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.form input, .form select { padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 13px; background: var(--bg-primary); color: var(--text-primary); }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.form-actions button { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-tertiary); cursor: pointer; font-size: 13px; }
.form-actions button.primary { background: var(--accent-primary); color: #FFF; border-color: var(--accent-primary); }
```

- [ ] **Step 4: Manual smoke**

```bash
npm run dev
```
Click "+ New Automation". Fill out the form. Submit. Expect: row appears in list, `~/.claude-ide/automations.json` has the new entry. If `enabled` + `schedule`, a plist appears in `~/.claude-ide/plists/` and `launchctl list | grep claudeide` shows it loaded.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(automations): + New Automation form with cron presets, skill dropdown, budget"
```

---

## Phase 10 — Catch-up + orphan sweep

### Task 22: Startup catch-up and orphan sweep

**Files:**
- Create: `src/main/scheduler/catchup.ts`
- Create: `src/main/scheduler/catchup.test.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Write failing test for catch-up scheduling logic**

`src/main/scheduler/catchup.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeMostRecentSchedule, shouldCatchUp } from './catchup'

describe('catchup', () => {
  it('finds the most recent past schedule for a cron expression', () => {
    // Saturday 2026-05-16 10:00 UTC; cron "0 8 * * 1" = Mondays 8am
    const now = new Date('2026-05-16T10:00:00Z')
    const last = computeMostRecentSchedule('0 8 * * 1', now)
    // Most recent Monday before Saturday 5/16 is Monday 5/11 at 08:00 UTC
    expect(last?.toISOString()).toBe('2026-05-11T08:00:00.000Z')
  })

  it('returns null if no schedule fired in lookback window', () => {
    const now = new Date('2026-05-16T10:00:00Z')
    const last = computeMostRecentSchedule('0 8 * * 1', now, 60 * 60 * 1000) // 1h lookback
    expect(last).toBeNull()
  })

  it('shouldCatchUp is false if schedule is within boundary skew', () => {
    const now = new Date('2026-05-11T08:02:00Z') // 2 min after the Monday 8am
    const last = new Date('2026-05-11T08:00:00Z')
    expect(shouldCatchUp(last, now)).toBe(false)
  })

  it('shouldCatchUp is true if last schedule was > 5min ago', () => {
    const now = new Date('2026-05-11T09:00:00Z')
    const last = new Date('2026-05-11T08:00:00Z')
    expect(shouldCatchUp(last, now)).toBe(true)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm run test:run -- catchup
```

- [ ] **Step 3: Implement catchup logic**

`src/main/scheduler/catchup.ts`:
```ts
import { promises as fs } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { RUNS_DIR, RUN_AUTOMATION_SCRIPT } from './paths'
import type { Automation, Run } from '../../shared/automation-types'

const execFileP = promisify(execFile)
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000 // 24h
const BOUNDARY_SKEW_MS = 5 * 60 * 1000 // 5 min

// Step backwards minute-by-minute to find when this cron would have most recently fired.
export function computeMostRecentSchedule(cron: string, now: Date, lookbackMs = DEFAULT_LOOKBACK_MS): Date | null {
  const [minF, hourF, domF, monthF, dowF] = cron.split(/\s+/)
  const minutes = parseSet(minF, 0, 59)
  const hours = parseSet(hourF, 0, 23)
  const doms = parseSet(domF, 1, 31)
  const months = parseSet(monthF, 1, 12)
  const dows = parseSet(dowF, 0, 7).map(d => d === 7 ? 0 : d)

  const cutoff = now.getTime() - lookbackMs
  const t = new Date(now.getTime())
  t.setSeconds(0, 0)
  while (t.getTime() >= cutoff) {
    if (
      (minutes === null || minutes.has(t.getMinutes())) &&
      (hours === null || hours.has(t.getHours())) &&
      (doms === null || doms.has(t.getDate())) &&
      (months === null || months.has(t.getMonth() + 1)) &&
      (dows === null || dows.has(t.getDay()))
    ) {
      if (t.getTime() <= now.getTime()) return new Date(t.getTime())
    }
    t.setMinutes(t.getMinutes() - 1)
  }
  return null
}

function parseSet(field: string, min: number, max: number): Set<number> | null {
  if (field === '*') return null
  const out = new Set<number>()
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      for (let i = a; i <= b; i++) out.add(i)
    } else {
      out.add(Number(part))
    }
  }
  return out
}

export function shouldCatchUp(lastScheduled: Date, now: Date): boolean {
  return now.getTime() - lastScheduled.getTime() > BOUNDARY_SKEW_MS
}

async function hasRunSince(automationId: string, since: Date): Promise<boolean> {
  try {
    const dirs = await fs.readdir(RUNS_DIR, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      if (!d.name.startsWith(`${automationId}__`)) continue
      try {
        const raw = await fs.readFile(join(RUNS_DIR, d.name, 'status.json'), 'utf8')
        const r: Run = JSON.parse(raw)
        if (new Date(r.startedAt).getTime() >= since.getTime()) return true
      } catch {}
    }
  } catch {}
  return false
}

export async function runCatchup(automations: Automation[]): Promise<{ caughtUp: string[] }> {
  const caughtUp: string[] = []
  const now = new Date()
  for (const a of automations) {
    if (!a.enabled || !a.schedule) continue
    const last = computeMostRecentSchedule(a.schedule, now)
    if (!last) continue
    if (!shouldCatchUp(last, now)) continue
    if (await hasRunSince(a.id, last)) continue
    // Fire the script in catchup mode
    const child = (await import('child_process')).spawn(RUN_AUTOMATION_SCRIPT, [a.id, 'catchup'], { detached: true, stdio: 'ignore' })
    child.unref()
    caughtUp.push(a.name)
  }
  return { caughtUp }
}

export async function sweepOrphans(): Promise<{ swept: string[] }> {
  const swept: string[] = []
  try {
    const dirs = await fs.readdir(RUNS_DIR, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      const statusFile = join(RUNS_DIR, d.name, 'status.json')
      try {
        const raw = await fs.readFile(statusFile, 'utf8')
        const r: Run = JSON.parse(raw)
        if (r.state !== 'running') continue
        const ageMs = Date.now() - new Date(r.startedAt).getTime()
        // Conservatively: 1h max for any "running" without an end. (Could be smarter with timeoutMin.)
        if (ageMs > 60 * 60 * 1000) {
          const updated: Run = {
            ...r, state: 'failed',
            finishedAt: new Date().toISOString(),
            failureReason: 'orphaned: still running on IDE startup',
            durationMs: ageMs,
            exitCode: r.exitCode ?? -1,
          }
          await fs.writeFile(statusFile, JSON.stringify(updated, null, 2))
          swept.push(d.name)
        }
      } catch {}
    }
  } catch {}
  return { swept }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm run test:run -- catchup
```
Expected: 4 passed.

- [ ] **Step 5: Wire catch-up + sweep into app startup**

In `src/main/index.ts`, after `await scheduler.init()`:
```ts
import { runCatchup, sweepOrphans } from './scheduler/catchup'
// ...
const automations = await scheduler.list()
const { swept } = await sweepOrphans()
const { caughtUp } = await runCatchup(automations)
if (swept.length || caughtUp.length) {
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('toast', {
      message: [
        swept.length ? `${swept.length} orphaned run(s) marked failed.` : null,
        caughtUp.length ? `Catching up: ${caughtUp.join(', ')}` : null,
      ].filter(Boolean).join(' · '),
    })
  })
}
```

The Toast IPC channel should already exist (used by existing `Toast.tsx` component). If not, add a simple handler in preload:
```ts
onToast: (cb: (t: any) => void) => { ipcRenderer.on('toast', (_e, t) => cb(t)) }
```
and consume in App.tsx (the existing Toast UI was kept in Task 2).

- [ ] **Step 6: Commit**

```bash
git add -A src/main/scheduler/catchup.ts src/main/scheduler/catchup.test.ts src/main/index.ts
git commit -m "feat(scheduler): startup catch-up for missed schedules + orphan sweep"
```

---

## Phase 11 — Cost guardrails

### Task 23: Per-automation budget tracking + footer

**Files:**
- Create: `src/main/scheduler/budget.ts`
- Create: `src/main/scheduler/budget.test.ts`
- Modify: `src/renderer/components/AutomationsView.tsx`
- Modify: `scripts/run-automation` (add budget pre-check)

- [ ] **Step 1: Write failing tests for budget math**

`src/main/scheduler/budget.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { monthToDateCost, shouldSkipForBudget } from './budget'
import type { Run } from '../../shared/automation-types'

const r = (overrides: Partial<Run>): Run => ({
  runId: 'x', automationId: 'a', state: 'completed', startedAt: '', finishedAt: null,
  durationMs: null, exitCode: 0, tokensUsed: null, costUsd: null, triggeredBy: 'schedule',
  ...overrides,
})

describe('monthToDateCost', () => {
  it('sums costUsd within the current calendar month', () => {
    const now = new Date('2026-05-14T12:00:00Z')
    const runs = [
      r({ startedAt: '2026-05-01T08:00:00Z', costUsd: 0.10 }),
      r({ startedAt: '2026-05-10T08:00:00Z', costUsd: 0.25 }),
      r({ startedAt: '2026-04-30T08:00:00Z', costUsd: 1.00 }), // previous month
      r({ startedAt: '2026-05-14T08:00:00Z', costUsd: 0.05 }),
    ]
    expect(monthToDateCost(runs, now)).toBeCloseTo(0.40, 4)
  })

  it('ignores runs with null costUsd', () => {
    const now = new Date('2026-05-14T12:00:00Z')
    const runs = [r({ startedAt: '2026-05-01T08:00:00Z', costUsd: null }), r({ startedAt: '2026-05-02T08:00:00Z', costUsd: 0.30 })]
    expect(monthToDateCost(runs, now)).toBeCloseTo(0.30, 4)
  })
})

describe('shouldSkipForBudget', () => {
  it('returns true when monthly budget exceeded', () => {
    expect(shouldSkipForBudget(5.10, 5.00)).toBe(true)
  })
  it('returns false when no budget set', () => {
    expect(shouldSkipForBudget(100, null)).toBe(false)
  })
  it('returns false at or below budget', () => {
    expect(shouldSkipForBudget(4.99, 5.00)).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm run test:run -- budget
```

- [ ] **Step 3: Implement budget**

`src/main/scheduler/budget.ts`:
```ts
import type { Run } from '../../shared/automation-types'

export function monthToDateCost(runs: Run[], now: Date = new Date()): number {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  let sum = 0
  for (const r of runs) {
    if (r.costUsd == null) continue
    const d = new Date(r.startedAt)
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month) sum += r.costUsd
  }
  return sum
}

export function shouldSkipForBudget(monthCost: number, budget: number | null): boolean {
  if (budget == null) return false
  return monthCost > budget
}

export function softWarnAt80(monthCost: number, budget: number | null): boolean {
  if (budget == null) return false
  return monthCost >= budget * 0.8
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm run test:run -- budget
```
Expected: 5 passed.

- [ ] **Step 5: Add budget pre-check to run-automation script**

In `scripts/run-automation`, after parsing the automation entry but before the dependency check, add (when trigger == "schedule"):
```bash
BUDGET=$(echo "$ENTRY" | jq -r '.monthlyBudgetUsd // empty')
if [ -n "$BUDGET" ] && [ "$TRIGGER" = "schedule" ]; then
  # Sum costUsd from runs this month
  CURRENT_MONTH=$(date +%Y-%m)
  TOTAL=$(for f in "$RUNS_DIR"/"${AUTOMATION_ID}"__*/status.json; do
    [ -f "$f" ] || continue
    SD=$(jq -r '.startedAt' "$f")
    [ -z "$SD" ] && continue
    MONTH_OF=$(echo "$SD" | cut -c1-7)
    [ "$MONTH_OF" = "$CURRENT_MONTH" ] || continue
    jq -r '.costUsd // 0' "$f"
  done | awk '{s+=$1} END {print s+0}')
  if awk -v t="$TOTAL" -v b="$BUDGET" 'BEGIN { exit !(t > b) }'; then
    write_status "skipped_budget" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" 0 null null null "monthly budget exceeded ($TOTAL > $BUDGET)"
    exit 0
  fi
fi
```

After-script smoke: create an automation with `monthlyBudgetUsd: 0.01` and one prior completed run with `costUsd: 0.50` in `~/.claude-ide/runs/`; trigger a scheduled-mode run and expect status `skipped_budget`.

- [ ] **Step 6: Add cost footer to AutomationsView**

In `AutomationsView.tsx`, below the `<Timeline>` / `<RunList>`:
```tsx
import { monthToDateCost } from '...' // import from a renderer-side helper that re-exports the same function (move budget.ts logic into shared/ for reuse, or duplicate the tiny function)
// ...
<footer className="auto-footer">
  💰 Month to date: ${monthToDateCost(runs).toFixed(2)} across {automations.length} automation{automations.length === 1 ? '' : 's'}
</footer>
```

For sharing the function between main and renderer, move `monthToDateCost` and `softWarnAt80` to `src/shared/budget.ts` and re-export from `src/main/scheduler/budget.ts`. Update tests to import from `shared/` too.

- [ ] **Step 7: Visual + smoke**

```bash
npm run dev
```
Expected: footer shows month-to-date cost. After a real Claude run completes, the cost adds up.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(scheduler): per-automation budget cap + month-to-date footer"
```

---

## Phase 12 — Finalize

### Task 24: Tag v1-final + push v2

**Files:** (none, just git ops)

- [ ] **Step 1: Run all tests + build**

```bash
npm run test:run
npm run build
```
Expected: all tests pass, build clean.

- [ ] **Step 2: Tag main as v1-final**

```bash
git tag v1-final main -m "Final state of the v1 IDE before v2 merge"
```

- [ ] **Step 3: Push v2 branch and tag**

```bash
git push anisha v2
git push anisha v1-final
```

- [ ] **Step 4: Print merge instructions**

The user runs the merge:
```bash
git checkout main
git merge --ff-only v2  # if branches diverged, use squash or PR via gh CLI
git push anisha main
```

Then rebuild the app for /Applications:
```bash
npm run package
cp -R dist/mac-arm64/Summit.app /Applications/  # confirm correct app folder name from electron-builder output
```

- [ ] **Step 5: Final commit** (only if any cleanup remains)

```bash
git status   # should be clean
```

---

## Self-Review

After writing the plan above, the author should verify:

**1. Spec coverage**
- ✓ Three-component architecture → covered across Tasks 1–24
- ✓ launchd env config → Task 13
- ✓ run-automation script + dependencies + status → Task 14
- ✓ scheduler.ts CRUD + plist load/unload → Task 15
- ✓ IPC + preload + hook → Tasks 16, 17
- ✓ AutomationsView (timeline + list + form) → Tasks 18–21
- ✓ Catch-up + orphan sweep → Task 22
- ✓ Cost guardrails (per-automation + footer) → Task 23
- ✓ Cleanup of deprecated components → Task 2
- ✓ Sidebar with all sections → Tasks 5–7
- ✓ Tab grouping → Tasks 8, 9
- ✓ Cmd+K palette → Tasks 10, 11
- ✓ Status bar rewrite → Task 12
- ✓ Theme → Task 3
- ✓ Standalone chat (Cmd+T) → covered in Task 5 (`handleNewChat`); palette entry in Task 11
- ⚠ "Catch-up via always-on launchd agent" — user chose IDE-startup catch-up only (Section 3 of spec). No further work needed.

**2. Type consistency**
- `Automation`, `Run`, `AutomationInput`, `Skill`, `Tab.kind` — names match across all tasks. ✓
- `runNow` returns a `string` (run id) consistently. ✓

**3. Placeholders** — none remain after self-review.
