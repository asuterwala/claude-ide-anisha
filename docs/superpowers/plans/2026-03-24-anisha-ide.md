# Anisha IDE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the base Claude IDE into a custom IDE for Anisha with light theme, Notion integration, Streamlit panel, and productivity features.

**Architecture:** React frontend with Electron main process. New components for each panel, CSS variables for theming, IPC handlers for Notion/Streamlit/Slack integration via MCP tools.

**Tech Stack:** TypeScript, React, Electron, CSS variables, xterm.js, Monaco Editor

---

## File Structure

### Files to Create
- `src/renderer/styles/theme.css` - Light mode CSS variables
- `src/renderer/components/NotionPanel.tsx` - Notion meetings/tasks panel
- `src/renderer/components/ModelStatus.tsx` - Streamlit status panel
- `src/renderer/components/SkillsLauncher.tsx` - Skills launcher panel
- `src/renderer/components/QuickSlack.tsx` - Slack messaging panel
- `src/renderer/components/TipsPanel.tsx` - Enhanced tips panel
- `src/renderer/components/TimeSaved.tsx` - Time saved display
- `src/renderer/hooks/useNotification.ts` - Desktop notification hook
- `src/renderer/hooks/useConfig.ts` - Config loading hook
- `src/renderer/env.d.ts` - Window.api type declarations (extend existing)

### Files to Modify
- `src/shared/types.ts` - Add new type definitions
- `src/renderer/store.tsx` - Add new state slices
- `src/renderer/styles.css` - Import theme, update to light mode
- `src/renderer/components/Dashboard.tsx` - Integrate new panels
- `src/main/ipc-handlers.ts` - Add IPC handlers for new features
- `src/preload/index.ts` - Expose new APIs to renderer

---

## Task 1: Light Mode Theme CSS

**Files:**
- Create: `src/renderer/styles/theme.css`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Create theme.css with CSS variables**

```css
/* src/renderer/styles/theme.css */
:root {
  /* Backgrounds */
  --bg-primary: #F8F9FA;
  --bg-secondary: #FFFFFF;
  --bg-tertiary: #EDF2F7;
  --bg-code: #EDF2F7;

  /* Borders */
  --border-color: #E2E8F0;
  --border-light: #F0F4F8;

  /* Text */
  --text-primary: #2D3748;
  --text-secondary: #718096;
  --text-muted: #A0AEC0;

  /* Accents */
  --accent-primary: #5B8DEF;
  --accent-primary-hover: #4A7DD9;
  --accent-success: #68D391;
  --accent-warning: #F6AD55;
  --accent-error: #FC8181;

  /* Panels */
  --panel-bg: #FFFFFF;
  --panel-border: #E2E8F0;
  --panel-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

  /* Interactive */
  --hover-bg: #F0F4F8;
  --active-bg: #E2E8F0;

  /* Terminal */
  --terminal-bg: #FFFFFF;
  --terminal-text: #2D3748;
  --terminal-cursor: #5B8DEF;
}
```

- [ ] **Step 2: Update styles.css to import theme and apply light mode**

In `src/renderer/styles.css`, add at the top:
```css
@import './styles/theme.css';
```

Then update the body and base styles to use variables:
```css
body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

- [ ] **Step 3: Verify theme loads**

Run: `npm run dev`
Expected: App background should be light (#F8F9FA)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/styles/theme.css src/renderer/styles.css
git commit -m "feat: add light mode theme with CSS variables"
```

---

## Task 2: Type Definitions

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add new type definitions**

Append to `src/shared/types.ts`:
```typescript
// Notion types
export interface NotionMeeting {
  id: string
  title: string
  time: Date
  attendees?: number
}

export interface NotionTask {
  id: string
  title: string
  status: 'Not started' | 'In progress' | 'Done'
  due?: Date
}

// Streamlit types
export interface StreamlitApp {
  file: string
  port: number | null
  status: 'stopped' | 'running' | 'crashed' | 'external'
  pid: number | null
}

export interface PythonFile {
  path: string
  name: string
  isStreamlit: boolean
  lastModified: number
}

// Config types
export interface AppConfig {
  user: {
    name: string
    slackSignature: string
  }
  notion: {
    enabled: boolean
    dashboardId: string
    refreshIntervalMinutes: number
  }
  streamlit: {
    enabled: boolean
    defaultPort: number
    keepRunningOnClose: boolean
  }
  notifications: {
    enabled: boolean
    quietHoursStart: string | null
    quietHoursEnd: string | null
  }
  slack: {
    enabled: boolean
    draftVoice: string
    quickRecipients: Array<{ id: string; name: string; type: string }>
  }
  skills: {
    categories: Array<{
      label: string
      skills: Array<{ cmd: string; desc: string }>
    }>
    timeSavedWeights: Record<string, number>
  }
  theme: 'light'
}

// Time saved types
export interface TimeSavedData {
  [date: string]: {
    minutes: number
    actions: string[]
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Add window.api type declarations**

Extend `src/renderer/env.d.ts`:
```typescript
interface Window {
  api: {
    // Existing APIs...

    // New APIs for Anisha IDE
    loadConfig: () => Promise<import('../shared/types').AppConfig>
    fetchNotion: (dashboardId: string) => Promise<{ meetings: import('../shared/types').NotionMeeting[]; tasks: import('../shared/types').NotionTask[]; error: string | null }>
    listPythonFiles: (path: string) => Promise<import('../shared/types').PythonFile[]>
    runStreamlit: (file: string, port: number) => Promise<{ success: boolean; pid?: number; port?: number }>
    stopStreamlit: (file: string) => Promise<{ success: boolean; error?: string }>
    getStreamlitStatus: () => Promise<import('../shared/types').StreamlitApp[]>
    sendToTerminal: (ptyId: string, data: string) => Promise<void>
    sendSlack: (channelId: string, message: string) => Promise<{ success: boolean; error?: string }>
    loadTimeSaved: () => Promise<import('../shared/types').TimeSavedData>
    saveTimeSaved: (data: import('../shared/types').TimeSavedData) => Promise<{ success: boolean }>
    showNotification: (title: string, body: string) => Promise<{ shown: boolean; reason?: string }>
  }
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/renderer/env.d.ts
git commit -m "feat: add type definitions for Notion, Streamlit, config"
```

---

## Task 3: State Management Updates

**Files:**
- Modify: `src/renderer/store.tsx`

- [ ] **Step 1: Read current store.tsx**

Read the file to understand existing state structure.

- [ ] **Step 2: Add imports at top of file**

```typescript
import type { NotionMeeting, NotionTask, StreamlitApp, PythonFile, AppConfig } from '../shared/types'
```

- [ ] **Step 3: Add new state slices**

Add to the AppState interface:
```typescript
notion: {
  meetings: NotionMeeting[]
  tasks: NotionTask[]
  loading: boolean
  error: string | null
  lastFetched: number | null
}
streamlit: {
  apps: StreamlitApp[]
  pythonFiles: PythonFile[]
}
timeSaved: {
  todayMinutes: number
  actions: string[]
}
notifications: {
  enabled: boolean
  lastNotified: number | null
}
config: AppConfig | null
```

- [ ] **Step 4: Add reducer actions**

Add action types:
```typescript
| { type: 'NOTION_LOADING' }
| { type: 'NOTION_LOADED'; payload: { meetings: NotionMeeting[]; tasks: NotionTask[] } }
| { type: 'NOTION_ERROR'; payload: string }
| { type: 'STREAMLIT_UPDATE'; payload: { apps: StreamlitApp[]; pythonFiles: PythonFile[] } }
| { type: 'TIME_SAVED_INIT'; payload: { minutes: number; actions: string[] } }
| { type: 'TIME_SAVED_ADD'; payload: { action: string; minutes: number } }
| { type: 'CONFIG_LOADED'; payload: AppConfig }
| { type: 'NOTIFICATIONS_TOGGLE'; payload: boolean }
```

- [ ] **Step 5: Implement reducer cases**

Add reducer logic for each action type:
```typescript
case 'NOTION_LOADING':
  return { ...state, notion: { ...state.notion, loading: true, error: null } }
case 'NOTION_LOADED':
  return { ...state, notion: {
    meetings: action.payload.meetings,
    tasks: action.payload.tasks,
    loading: false,
    error: null,
    lastFetched: Date.now()
  } }
case 'NOTION_ERROR':
  return { ...state, notion: { ...state.notion, loading: false, error: action.payload } }
case 'STREAMLIT_UPDATE':
  return { ...state, streamlit: action.payload }
case 'TIME_SAVED_INIT':
  return { ...state, timeSaved: action.payload }
case 'TIME_SAVED_ADD':
  return { ...state, timeSaved: {
    todayMinutes: state.timeSaved.todayMinutes + action.payload.minutes,
    actions: [...state.timeSaved.actions, action.payload.action]
  } }
case 'CONFIG_LOADED':
  return { ...state, config: action.payload }
case 'NOTIFICATIONS_TOGGLE':
  return { ...state, notifications: { ...state.notifications, enabled: action.payload } }
```

- [ ] **Step 6: Add initial state**

```typescript
notion: { meetings: [], tasks: [], loading: false, error: null, lastFetched: null },
streamlit: { apps: [], pythonFiles: [] },
timeSaved: { todayMinutes: 0, actions: [] },
notifications: { enabled: true, lastNotified: null },
config: null,
```

- [ ] **Step 7: Verify store compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/renderer/store.tsx
git commit -m "feat: add state slices for Notion, Streamlit, time saved"
```

---

## Task 4: Config Loading Hook

**Files:**
- Create: `src/renderer/hooks/useConfig.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc-handlers.ts`

- [ ] **Step 1: Add IPC handler for config loading**

In `src/main/ipc-handlers.ts`, add:
```typescript
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const CONFIG_PATH = join(homedir(), '.config', 'claude-ide-mc', 'config.json')

const DEFAULT_CONFIG = {
  user: { name: '', slackSignature: '_Sent by Claude Code_ :claude:' },
  notion: { enabled: true, dashboardId: '', refreshIntervalMinutes: 30 },
  streamlit: { enabled: true, defaultPort: 8501, keepRunningOnClose: false },
  notifications: { enabled: true, quietHoursStart: null, quietHoursEnd: null },
  slack: { enabled: true, draftVoice: 'direct, concise, collaborative', quickRecipients: [] },
  skills: { categories: [], timeSavedWeights: {} },
  theme: 'light'
}

ipcMain.handle('config:load', async () => {
  try {
    if (!existsSync(CONFIG_PATH)) {
      const dir = join(homedir(), '.config', 'claude-ide-mc')
      if (!existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true })
      }
      writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
      return DEFAULT_CONFIG
    }
    const content = readFileSync(CONFIG_PATH, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) }
  } catch (error) {
    console.error('Failed to load config:', error)
    return DEFAULT_CONFIG
  }
})
```

- [ ] **Step 2: Expose in preload**

In `src/preload/index.ts`, add to the api object:
```typescript
loadConfig: () => ipcRenderer.invoke('config:load'),
```

- [ ] **Step 3: Create useConfig hook**

```typescript
// src/renderer/hooks/useConfig.ts
import { useEffect } from 'react'
import { useAppState } from '../store'
import type { AppConfig } from '../../shared/types'

export function useConfig() {
  const { state, dispatch } = useAppState()

  useEffect(() => {
    if (!state.config) {
      window.api.loadConfig().then((config: AppConfig) => {
        dispatch({ type: 'CONFIG_LOADED', payload: config })
      })
    }
  }, [state.config, dispatch])

  return state.config
}
```

- [ ] **Step 4: Verify hook compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/useConfig.ts src/preload/index.ts src/main/ipc-handlers.ts
git commit -m "feat: add config loading with defaults"
```

---

## Task 5: Notion Panel

**Files:**
- Create: `src/renderer/components/NotionPanel.tsx`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add Notion IPC handler**

In `src/main/ipc-handlers.ts`:
```typescript
ipcMain.handle('notion:fetch', async (_event, dashboardId: string) => {
  // This will be called via Claude CLI with MCP
  // For now, return mock data structure
  // Real implementation spawns: claude -p "fetch notion data" --tool mcp__notiongusto__notion-fetch
  return {
    meetings: [],
    tasks: [],
    error: null
  }
})
```

- [ ] **Step 2: Expose in preload**

```typescript
fetchNotion: (dashboardId: string) => ipcRenderer.invoke('notion:fetch', dashboardId),
```

- [ ] **Step 3: Create NotionPanel component with retry logic**

```typescript
// src/renderer/components/NotionPanel.tsx
import { useEffect, useCallback, useRef } from 'react'
import { useAppState } from '../store'
import { useConfig } from '../hooks/useConfig'

// Retry with exponential backoff: 1s, 2s, 4s
async function fetchWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }
  throw lastError
}

export function NotionPanel() {
  const { state, dispatch } = useAppState()
  const config = useConfig()
  const { meetings, tasks, loading, error, lastFetched } = state.notion
  // Cache for stale data display during errors
  const cacheRef = useRef<{ meetings: typeof meetings; tasks: typeof tasks } | null>(null)

  const fetchData = useCallback(async () => {
    if (!config?.notion.enabled || !config.notion.dashboardId) return

    dispatch({ type: 'NOTION_LOADING' })
    try {
      const data = await fetchWithRetry(() => window.api.fetchNotion(config.notion.dashboardId))
      if (data.error) {
        dispatch({ type: 'NOTION_ERROR', payload: data.error })
      } else {
        cacheRef.current = { meetings: data.meetings, tasks: data.tasks }
        dispatch({ type: 'NOTION_LOADED', payload: data })
      }
    } catch (err) {
      dispatch({ type: 'NOTION_ERROR', payload: 'Failed to connect to Notion after 3 attempts' })
    }
  }, [config, dispatch])

  // Display cached data during error state
  const displayMeetings = error && cacheRef.current ? cacheRef.current.meetings : meetings
  const displayTasks = error && cacheRef.current ? cacheRef.current.tasks : tasks

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, (config?.notion.refreshIntervalMinutes || 30) * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData, config])

  if (!config?.notion.enabled) return null

  return (
    <div className="notion-panel" style={{
      background: 'var(--panel-bg)',
      borderRadius: 8,
      padding: 16,
      border: '1px solid var(--panel-border)',
      boxShadow: 'var(--panel-shadow)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Notion</h3>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-primary)',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--accent-error)', fontSize: 12, marginBottom: 8 }}>
          {error}
          {cacheRef.current && <span style={{ color: 'var(--text-muted)' }}> (showing cached data)</span>}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' }}>
          Meetings Today
        </div>
        {displayMeetings.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No meetings today</div>
        ) : (
          displayMeetings.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '4px 0' }}>
              <span style={{ color: 'var(--text-secondary)', minWidth: 60 }}>
                {new Date(m.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{m.title}</span>
            </div>
          ))
        )}
      </div>

      <div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' }}>
          Tasks ({displayTasks.filter(t => t.status !== 'Done').length} pending)
        </div>
        {displayTasks.filter(t => t.status !== 'Done').length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No pending tasks</div>
        ) : (
          displayTasks.filter(t => t.status !== 'Done').map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '4px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>☐</span>
              <span style={{ color: 'var(--text-primary)' }}>{t.title}</span>
            </div>
          ))
        )}
      </div>

      {lastFetched && (
        <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 12 }}>
          Updated {new Date(lastFetched).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify component compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/NotionPanel.tsx src/main/ipc-handlers.ts src/preload/index.ts
git commit -m "feat: add Notion panel with meetings and tasks"
```

---

## Task 6: Streamlit Model Status Panel

**Files:**
- Create: `src/renderer/components/ModelStatus.tsx`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add Streamlit IPC handlers**

In `src/main/ipc-handlers.ts`:
```typescript
import { spawn, exec } from 'child_process'
import { readdirSync, readFileSync, statSync } from 'fs'

const streamlitProcesses = new Map<string, { pid: number; port: number }>()

ipcMain.handle('streamlit:list', async (_event, projectPath: string) => {
  const files: PythonFile[] = []
  try {
    const entries = readdirSync(projectPath)
    for (const entry of entries) {
      if (entry.endsWith('.py')) {
        const fullPath = join(projectPath, entry)
        const content = readFileSync(fullPath, 'utf-8')
        const isStreamlit = content.includes('import streamlit') || content.includes('from streamlit')
        const stat = statSync(fullPath)
        files.push({
          path: fullPath,
          name: entry,
          isStreamlit,
          lastModified: stat.mtimeMs
        })
      }
    }
  } catch (error) {
    console.error('Failed to list Python files:', error)
  }
  return files
})

ipcMain.handle('streamlit:run', async (_event, filePath: string, port: number) => {
  return new Promise((resolve) => {
    const proc = spawn('streamlit', ['run', filePath, '--server.port', String(port)], {
      detached: true,
      stdio: 'ignore'
    })
    proc.unref()
    streamlitProcesses.set(filePath, { pid: proc.pid!, port })
    resolve({ success: true, pid: proc.pid, port })
  })
})

ipcMain.handle('streamlit:stop', async (_event, filePath: string) => {
  const proc = streamlitProcesses.get(filePath)
  if (proc) {
    try {
      process.kill(proc.pid)
      streamlitProcesses.delete(filePath)
      return { success: true }
    } catch {
      return { success: false, error: 'Process not found' }
    }
  }
  return { success: false, error: 'No process tracked' }
})

ipcMain.handle('streamlit:status', async () => {
  const apps: StreamlitApp[] = []
  for (const [file, { pid, port }] of streamlitProcesses) {
    try {
      process.kill(pid, 0) // Check if process exists
      apps.push({ file, port, status: 'running', pid })
    } catch {
      streamlitProcesses.delete(file)
      apps.push({ file, port: null, status: 'stopped', pid: null })
    }
  }
  return apps
})
```

- [ ] **Step 2: Expose in preload**

```typescript
listPythonFiles: (path: string) => ipcRenderer.invoke('streamlit:list', path),
runStreamlit: (file: string, port: number) => ipcRenderer.invoke('streamlit:run', file, port),
stopStreamlit: (file: string) => ipcRenderer.invoke('streamlit:stop', file),
getStreamlitStatus: () => ipcRenderer.invoke('streamlit:status'),
```

- [ ] **Step 3: Create ModelStatus component**

```typescript
// src/renderer/components/ModelStatus.tsx
import { useEffect, useState, useCallback } from 'react'
import { useAppState } from '../store'
import { useConfig } from '../hooks/useConfig'
import type { PythonFile, StreamlitApp } from '../../shared/types'

export function ModelStatus({ projectPath }: { projectPath?: string }) {
  const { state, dispatch } = useAppState()
  const config = useConfig()
  const [nextPort, setNextPort] = useState(config?.streamlit.defaultPort || 8501)

  // Use projectPath prop, or get from active terminal tab, or default to home
  const activePath = projectPath || state.tabs.find(t => t.type === 'terminal')?.projectPath || '~'

  const refresh = useCallback(async () => {
    if (!activePath || activePath === '~') return
    const [files, apps] = await Promise.all([
      window.api.listPythonFiles(activePath),
      window.api.getStreamlitStatus()
    ])
    dispatch({ type: 'STREAMLIT_UPDATE', payload: { pythonFiles: files, apps } })
  }, [activePath, dispatch])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleRun = async (file: string) => {
    const result = await window.api.runStreamlit(file, nextPort)
    if (result.success) {
      setNextPort(prev => prev + 1)
      refresh()
    }
  }

  const handleStop = async (file: string) => {
    await window.api.stopStreamlit(file)
    refresh()
  }

  const handleOpen = (port: number) => {
    window.open(`http://localhost:${port}`, '_blank')
  }

  if (!config?.streamlit.enabled) return null

  const { pythonFiles, apps } = state.streamlit
  const streamlitFiles = pythonFiles.filter(f => f.isStreamlit)

  return (
    <div className="model-status" style={{
      background: 'var(--panel-bg)',
      borderRadius: 8,
      padding: 16,
      border: '1px solid var(--panel-border)',
      boxShadow: 'var(--panel-shadow)'
    }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
        Models
      </h3>

      {streamlitFiles.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          No Streamlit apps detected. Create app.py to get started.
        </div>
      ) : (
        streamlitFiles.map(file => {
          const app = apps.find(a => a.file === file.path)
          const isRunning = app?.status === 'running'

          return (
            <div key={file.path} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid var(--border-light)'
            }}>
              <div>
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{file.name}</div>
                {isRunning && (
                  <div style={{ color: 'var(--accent-success)', fontSize: 11 }}>
                    Running on localhost:{app.port}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isRunning ? (
                  <>
                    <button onClick={() => handleOpen(app.port!)} style={buttonStyle}>Open</button>
                    <button onClick={() => handleStop(file.path)} style={{ ...buttonStyle, color: 'var(--accent-error)' }}>Stop</button>
                  </>
                ) : (
                  <button onClick={() => handleRun(file.path)} style={buttonStyle}>Run</button>
                )}
              </div>
            </div>
          )
        })
      )}

      {pythonFiles.filter(f => !f.isStreamlit).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 8 }}>Other Python Files</div>
          {pythonFiles.filter(f => !f.isStreamlit).map(file => (
            <div key={file.path} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 0' }}>
              {file.name} <span style={{ fontSize: 10 }}>Modified {formatTimeAgo(file.lastModified)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const buttonStyle = {
  background: 'none',
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 11,
  color: 'var(--accent-primary)',
  cursor: 'pointer'
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}
```

- [ ] **Step 4: Verify component compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/ModelStatus.tsx src/main/ipc-handlers.ts src/preload/index.ts
git commit -m "feat: add Streamlit model status panel"
```

---

## Task 7: Skills Launcher Panel

**Files:**
- Create: `src/renderer/components/SkillsLauncher.tsx`

- [ ] **Step 1: Create SkillsLauncher component**

```typescript
// src/renderer/components/SkillsLauncher.tsx
import { useConfig } from '../hooks/useConfig'
import { useAppState } from '../store'

export function SkillsLauncher() {
  const config = useConfig()
  const { state, dispatch } = useAppState()

  const executeSkill = (cmd: string) => {
    // Find active terminal tab
    const terminalTab = state.tabs.find(t => t.type === 'terminal')
    if (terminalTab) {
      // Focus the terminal and send the command
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: terminalTab.id })
      // Send keystroke to terminal via IPC
      window.api.sendToTerminal(terminalTab.ptyId, cmd + '\n')

      // Track time saved
      const weight = config?.skills.timeSavedWeights[cmd] || 10
      dispatch({ type: 'TIME_SAVED_ADD', payload: { action: cmd, minutes: weight } })
    }
  }

  if (!config?.skills.categories.length) {
    return (
      <div className="skills-launcher" style={panelStyle}>
        <h3 style={headerStyle}>Skills</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          No skills configured. Add skills in config.json.
        </div>
      </div>
    )
  }

  return (
    <div className="skills-launcher" style={panelStyle}>
      <h3 style={headerStyle}>Skills</h3>

      {config.skills.categories.map(category => (
        <div key={category.label} style={{ marginBottom: 12 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase' }}>
            {category.label}
          </div>
          {category.skills.map(skill => (
            <div
              key={skill.cmd}
              onClick={() => executeSkill(skill.cmd)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <code style={{ color: 'var(--accent-primary)' }}>{skill.cmd}</code>
              <span style={{ color: 'var(--text-secondary)' }}>{skill.desc}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const panelStyle = {
  background: 'var(--panel-bg)',
  borderRadius: 8,
  padding: 16,
  border: '1px solid var(--panel-border)',
  boxShadow: 'var(--panel-shadow)'
}

const headerStyle = {
  margin: '0 0 12px',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontWeight: 600
}
```

- [ ] **Step 2: Add sendToTerminal to preload**

In `src/preload/index.ts`:
```typescript
sendToTerminal: (ptyId: string, data: string) => ipcRenderer.invoke('pty:write', ptyId, data),
```

- [ ] **Step 3: Verify component compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/SkillsLauncher.tsx src/preload/index.ts
git commit -m "feat: add skills launcher panel"
```

---

## Task 8: Quick Slack Panel

**Files:**
- Create: `src/renderer/components/QuickSlack.tsx`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add Slack IPC handler**

In `src/main/ipc-handlers.ts`:
```typescript
ipcMain.handle('slack:send', async (_event, channelId: string, message: string) => {
  // This will call MCP tool via Claude CLI
  // For now, return success - real implementation spawns claude with MCP
  try {
    // spawn('claude', ['-p', `send slack message to ${channelId}: ${message}`, '--tool', 'mcp__slackgustoofficialmcp__slack_send_message'])
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
```

- [ ] **Step 2: Expose in preload**

```typescript
sendSlack: (channelId: string, message: string) => ipcRenderer.invoke('slack:send', channelId, message),
```

- [ ] **Step 3: Create QuickSlack component**

```typescript
// src/renderer/components/QuickSlack.tsx
import { useState } from 'react'
import { useConfig } from '../hooks/useConfig'
import { useAppState } from '../store'

export function QuickSlack() {
  const config = useConfig()
  const { dispatch } = useAppState()
  const [recipient, setRecipient] = useState('')
  const [intent, setIntent] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const handleDraft = () => {
    // Generate draft based on intent and voice
    const voice = config?.slack.draftVoice || 'direct, concise'
    // In real implementation, this would call Claude to draft
    const generatedDraft = `${intent}\n\n${config?.user.slackSignature || '_Sent by Claude Code_ :claude:'}`
    setDraft(generatedDraft)
  }

  const handleSend = async () => {
    if (!recipient || !draft) return
    setSending(true)
    const result = await window.api.sendSlack(recipient, draft)
    setSending(false)
    if (result.success) {
      setIntent('')
      setDraft('')
      dispatch({ type: 'TIME_SAVED_ADD', payload: { action: 'slack-send', minutes: 5 } })
    }
  }

  if (!config?.slack.enabled) return null

  const recipients = config.slack.quickRecipients || []

  return (
    <div className="quick-slack" style={panelStyle}>
      <h3 style={headerStyle}>Quick Slack</h3>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>To:</label>
        <select
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          style={selectStyle}
        >
          <option value="">Select recipient...</option>
          {recipients.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Intent:</label>
        <input
          type="text"
          value={intent}
          onChange={e => setIntent(e.target.value)}
          placeholder="What do you want to say?"
          style={inputStyle}
        />
        <button onClick={handleDraft} style={{ ...buttonStyle, marginTop: 8 }}>Draft</button>
      </div>

      {draft && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Preview:</label>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={handleDraft} style={buttonStyle}>Redraft</button>
            <button onClick={handleSend} disabled={sending} style={{ ...buttonStyle, background: 'var(--accent-primary)', color: 'white' }}>
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const panelStyle = {
  background: 'var(--panel-bg)',
  borderRadius: 8,
  padding: 16,
  border: '1px solid var(--panel-border)',
  boxShadow: 'var(--panel-shadow)'
}

const headerStyle = { margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }
const labelStyle = { display: 'block', color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' as const }
const inputStyle = { width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 13, background: 'var(--bg-primary)' }
const selectStyle = { ...inputStyle, cursor: 'pointer' }
const buttonStyle = { padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', background: 'var(--bg-secondary)' }
```

- [ ] **Step 4: Verify component compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/QuickSlack.tsx src/main/ipc-handlers.ts src/preload/index.ts
git commit -m "feat: add Quick Slack panel"
```

---

## Task 9: Tips Panel

**Files:**
- Create: `src/renderer/components/TipsPanel.tsx`

- [ ] **Step 1: Create TipsPanel component**

```typescript
// src/renderer/components/TipsPanel.tsx
import { useState, useEffect } from 'react'
import { useAppState } from '../store'

const TIPS = [
  { category: 'session', text: 'Use /compact to free up context in long sessions' },
  { category: 'session', text: 'Type /clear to start fresh without restarting' },
  { category: 'session', text: 'Check costs with /cost at any time' },
  { category: 'keyboard', text: 'Cmd+P opens any file by name - no clicking through folders' },
  { category: 'keyboard', text: 'Cmd+Shift+F searches across all files' },
  { category: 'keyboard', text: 'Select code, then Cmd+K to have Claude edit it inline' },
  { category: 'natural', text: 'Type "fix the bug in line 42" - Claude understands natural language' },
  { category: 'natural', text: 'Ask "explain this code" to get a walkthrough' },
  { category: 'natural', text: 'Say "add tests for this function" to generate tests' },
  { category: 'streamlit', text: 'Say "run my app" to start your Streamlit app' },
  { category: 'streamlit', text: 'Ask "add a chart showing X" to build visualizations' },
  { category: 'streamlit', text: 'Type "deploy to Snowflake" when ready to publish' },
]

export function TipsPanel() {
  const { state } = useAppState()
  const [visibleTips, setVisibleTips] = useState<typeof TIPS>([])
  const [expanded, setExpanded] = useState(false)

  // Check if project has Python files for contextual tips
  const hasPython = state.streamlit.pythonFiles.length > 0

  useEffect(() => {
    const relevantTips = TIPS.filter(t =>
      t.category !== 'streamlit' || hasPython
    )

    // Rotate tips every 3 minutes
    const selectTips = () => {
      const shuffled = [...relevantTips].sort(() => Math.random() - 0.5)
      setVisibleTips(shuffled.slice(0, 3))
    }

    selectTips()
    const interval = setInterval(selectTips, 180000)
    return () => clearInterval(interval)
  }, [hasPython])

  return (
    <div className="tips-panel" style={panelStyle}>
      <h3 style={headerStyle}>Tips</h3>

      {(expanded ? TIPS.filter(t => t.category !== 'streamlit' || hasPython) : visibleTips).map((tip, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12 }}>
          <span style={{ color: 'var(--accent-primary)' }}>💡</span>
          <span style={{ color: 'var(--text-secondary)' }}>{tip.text}</span>
        </div>
      ))}

      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent-primary)',
          fontSize: 11,
          cursor: 'pointer',
          marginTop: 8,
          padding: 0
        }}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

const panelStyle = {
  background: 'var(--panel-bg)',
  borderRadius: 8,
  padding: 16,
  border: '1px solid var(--panel-border)',
  boxShadow: 'var(--panel-shadow)'
}

const headerStyle = { margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }
```

- [ ] **Step 2: Verify component compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/TipsPanel.tsx
git commit -m "feat: add Tips panel with contextual tips"
```

---

## Task 10: Time Saved Display

**Files:**
- Create: `src/renderer/components/TimeSaved.tsx`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add time saved persistence handlers**

In `src/main/ipc-handlers.ts`:
```typescript
const TIME_SAVED_PATH = join(homedir(), '.memory', 'mission-control', 'time-saved.json')

ipcMain.handle('timeSaved:load', async () => {
  try {
    if (!existsSync(TIME_SAVED_PATH)) return {}
    return JSON.parse(readFileSync(TIME_SAVED_PATH, 'utf-8'))
  } catch {
    return {}
  }
})

ipcMain.handle('timeSaved:save', async (_event, data: any) => {
  try {
    const dir = join(homedir(), '.memory', 'mission-control')
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true })
    }
    writeFileSync(TIME_SAVED_PATH, JSON.stringify(data, null, 2))
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
```

- [ ] **Step 2: Expose in preload**

```typescript
loadTimeSaved: () => ipcRenderer.invoke('timeSaved:load'),
saveTimeSaved: (data: any) => ipcRenderer.invoke('timeSaved:save', data),
```

- [ ] **Step 3: Create TimeSaved component**

```typescript
// src/renderer/components/TimeSaved.tsx
import { useEffect } from 'react'
import { useAppState } from '../store'
import { useConfig } from '../hooks/useConfig'

export function TimeSaved() {
  const { state, dispatch } = useAppState()
  const config = useConfig()
  const { todayMinutes, actions } = state.timeSaved

  // Load on mount - use TIME_SAVED_INIT to set full state (avoids duplicates)
  useEffect(() => {
    const loadData = async () => {
      const data = await window.api.loadTimeSaved()
      const today = new Date().toISOString().split('T')[0]
      if (data[today]) {
        dispatch({ type: 'TIME_SAVED_INIT', payload: data[today] })
      }
    }
    loadData()
  }, [dispatch])

  // Save when state changes
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    window.api.saveTimeSaved({
      [today]: { minutes: todayMinutes, actions }
    })
  }, [todayMinutes, actions])

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderRadius: 8,
      padding: 12,
      border: '1px solid var(--panel-border)',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }}>
      <span style={{ fontSize: 16 }}>⏱️</span>
      <div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>
          Time Saved Today
        </div>
        <div style={{ color: 'var(--accent-success)', fontSize: 18, fontWeight: 600 }}>
          ~{formatTime(todayMinutes)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify component compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/TimeSaved.tsx src/main/ipc-handlers.ts src/preload/index.ts
git commit -m "feat: add Time Saved tracking with persistence"
```

---

## Task 11: Desktop Notifications

**Files:**
- Create: `src/renderer/hooks/useNotification.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add notification IPC handler**

In `src/main/ipc-handlers.ts`:
```typescript
import { Notification, BrowserWindow } from 'electron'

ipcMain.handle('notify:show', async (_event, title: string, body: string) => {
  const win = BrowserWindow.getFocusedWindow()
  if (win && win.isFocused()) {
    // Don't notify if window is focused
    return { shown: false, reason: 'window-focused' }
  }

  const notification = new Notification({
    title,
    body,
    silent: false
  })

  notification.on('click', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      windows[0].focus()
    }
  })

  notification.show()
  return { shown: true }
})
```

- [ ] **Step 2: Expose in preload**

```typescript
showNotification: (title: string, body: string) => ipcRenderer.invoke('notify:show', title, body),
```

- [ ] **Step 3: Create useNotification hook**

```typescript
// src/renderer/hooks/useNotification.ts
import { useCallback, useRef } from 'react'
import { useAppState } from '../store'
import { useConfig } from './useConfig'

export function useNotification() {
  const { state, dispatch } = useAppState()
  const config = useConfig()
  const lastOutputRef = useRef<string>('')
  const silenceUntilRef = useRef<number>(0)

  const checkAndNotify = useCallback((terminalOutput: string) => {
    if (!config?.notifications.enabled) return
    if (!state.notifications.enabled) return
    if (Date.now() < silenceUntilRef.current) return

    // Check quiet hours
    if (config.notifications.quietHoursStart && config.notifications.quietHoursEnd) {
      const now = new Date()
      const hour = now.getHours()
      const start = parseInt(config.notifications.quietHoursStart.split(':')[0])
      const end = parseInt(config.notifications.quietHoursEnd.split(':')[0])
      if (hour >= start || hour < end) return
    }

    // Detect if Claude is waiting
    const lines = terminalOutput.trim().split('\n')
    const lastLine = lines[lines.length - 1] || ''

    // Skip if output hasn't changed
    if (lastLine === lastOutputRef.current) return
    lastOutputRef.current = lastLine

    // Check waiting conditions
    const isWaiting = (
      !lastLine.endsWith('$') &&
      !lastLine.endsWith('>') &&
      !lastLine.endsWith('%') &&
      (
        lastLine.endsWith('?') ||
        lastLine.includes('[Y/n]') ||
        lastLine.includes('[y/N]') ||
        lastLine.includes('(yes/no)') ||
        lastLine.includes('Allow?')
      )
    )

    if (isWaiting) {
      const questionPreview = lastLine.slice(0, 50) + (lastLine.length > 50 ? '...' : '')
      window.api.showNotification('Claude Code', `Waiting for your response: ${questionPreview}`)

      // Silence for 30 seconds to avoid spam
      silenceUntilRef.current = Date.now() + 30000
      dispatch({ type: 'NOTIFICATIONS_TOGGLE', payload: true })
    }
  }, [config, state.notifications.enabled, dispatch])

  return { checkAndNotify }
}
```

- [ ] **Step 4: Verify hook compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/useNotification.ts src/main/ipc-handlers.ts src/preload/index.ts
git commit -m "feat: add desktop notifications for Claude waiting"
```

---

## Task 12: Integrate Dashboard

**Files:**
- Modify: `src/renderer/components/Dashboard.tsx`

- [ ] **Step 1: Read current Dashboard.tsx**

Read to understand current structure.

- [ ] **Step 2: Rewrite Dashboard with new panels**

```typescript
// src/renderer/components/Dashboard.tsx
import { useConfig } from '../hooks/useConfig'
import { NotionPanel } from './NotionPanel'
import { ModelStatus } from './ModelStatus'
import { SkillsLauncher } from './SkillsLauncher'
import { QuickSlack } from './QuickSlack'
import { TipsPanel } from './TipsPanel'
import { TimeSaved } from './TimeSaved'

export default function Dashboard({ visible }: { visible: boolean }) {
  const config = useConfig()

  if (!visible) return null

  return (
    <div style={{
      flex: 1,
      padding: 20,
      background: 'var(--bg-primary)',
      overflowY: 'auto'
    }}>
      {/* Header with Time Saved */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 24, fontWeight: 600 }}>
            Welcome back{config?.user.name ? `, ${config.user.name.split(' ')[0]}` : ''}!
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Let's keep building.
          </p>
        </div>
        <TimeSaved />
      </div>

      {/* Main grid layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16
      }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <NotionPanel />
          <ModelStatus />
          <TipsPanel />
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SkillsLauncher />
          <QuickSlack />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify Dashboard compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Test dashboard renders**

Run: `npm run dev`
Expected: Dashboard shows with all panels in light mode

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Dashboard.tsx
git commit -m "feat: integrate all panels into Dashboard"
```

---

## Task 13: Final Polish - Terminal Theme

**Files:**
- Modify: `src/renderer/components/TerminalTab.tsx`

- [ ] **Step 1: Read TerminalTab.tsx**

Read to find xterm theme configuration.

- [ ] **Step 2: Update terminal theme to light**

Find the xterm Terminal initialization and update theme:
```typescript
const term = new Terminal({
  theme: {
    background: '#FFFFFF',
    foreground: '#2D3748',
    cursor: '#5B8DEF',
    cursorAccent: '#FFFFFF',
    selection: 'rgba(91, 141, 239, 0.3)',
    black: '#2D3748',
    red: '#E53E3E',
    green: '#38A169',
    yellow: '#D69E2E',
    blue: '#3182CE',
    magenta: '#805AD5',
    cyan: '#319795',
    white: '#E2E8F0',
    brightBlack: '#718096',
    brightRed: '#FC8181',
    brightGreen: '#68D391',
    brightYellow: '#F6AD55',
    brightBlue: '#5B8DEF',
    brightMagenta: '#B794F4',
    brightCyan: '#4FD1C5',
    brightWhite: '#F7FAFC'
  },
  // ... rest of config
})
```

- [ ] **Step 3: Test terminal in light mode**

Run: `npm run dev`
Expected: Terminal has light background with dark text

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/TerminalTab.tsx
git commit -m "feat: update terminal to light theme"
```

---

## Task 14: Final Polish - Monaco Editor Theme

**Files:**
- Modify: `src/renderer/components/EditorTab.tsx`

- [ ] **Step 1: Read EditorTab.tsx**

Read to find Monaco theme configuration.

- [ ] **Step 2: Update Monaco to light theme**

Find monaco-editor initialization and update:
```typescript
monaco.editor.create(containerRef.current, {
  theme: 'vs', // Changed from 'vs-dark'
  // ... rest of config
})
```

- [ ] **Step 3: Test editor in light mode**

Run: `npm run dev`
Expected: Code editor has light background

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/EditorTab.tsx
git commit -m "feat: update Monaco editor to light theme"
```

---

## Task 15: Build and Test

**Files:** None (testing only)

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Build the app**

Run: `npm run build`
Expected: Build completes without errors

- [ ] **Step 3: Test the packaged app**

Run: `npm run dist`
Then open the built app and verify:
- Light theme throughout
- Dashboard shows all panels
- Notion panel loads (or shows empty state)
- Streamlit panel shows Python files
- Skills are clickable
- Tips rotate

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: complete Anisha IDE implementation"
```

---

## Summary

| Task | Component | Estimated Time |
|------|-----------|----------------|
| 1 | Light Mode Theme | 5 min |
| 2 | Type Definitions | 5 min |
| 3 | State Management | 10 min |
| 4 | Config Loading | 10 min |
| 5 | Notion Panel | 15 min |
| 6 | Streamlit Panel | 15 min |
| 7 | Skills Launcher | 10 min |
| 8 | Quick Slack | 15 min |
| 9 | Tips Panel | 10 min |
| 10 | Time Saved | 10 min |
| 11 | Notifications | 10 min |
| 12 | Dashboard Integration | 10 min |
| 13 | Terminal Theme | 5 min |
| 14 | Monaco Theme | 5 min |
| 15 | Build & Test | 10 min |

**Total: ~2.5 hours**
