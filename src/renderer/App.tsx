import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppState } from './store'
import { useClaudeStatus } from './hooks/useClaudeStatus'
import TabBar from './components/TabBar'
import Sidebar from './components/Sidebar'
import FileExplorer from './components/FileExplorer'
import { RecentSessions } from './components/RecentSessions'
import AutomationsPreview from './components/sidebar/AutomationsPreview'
import { SkillsLauncher } from './components/SkillsLauncher'
import TerminalTab from './components/TerminalTab'
import EditorTab from './components/EditorTab'
import Dashboard from './components/Dashboard'
import AutomationsView from './components/AutomationsView'
import StatusBar from './components/StatusBar'
import Toast from './components/Toast'
import CommandPalette from './components/CommandPalette'
import type { PaletteItem } from './components/CommandPalette/filter'

export default function App() {
  const { state, dispatch } = useAppState()
  useClaudeStatus()
  const [currentToast, setCurrentToast] = useState<{ id: string; message: string } | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteItems, setPaletteItems] = useState<PaletteItem[]>([])

  // Reload the active chat tab at the current window width: kill the running
  // claude process and re-launch it with `--resume <session-id>` so it re-draws
  // the full conversation history at whatever the terminal is sized to now.
  // Necessary because xterm can't reflow content that was drawn with hard
  // newlines (claude's TUI does this for boxes, markdown, code blocks).
  const handleReloadActiveTab = useCallback(async () => {
    const active = state.tabs.find(t => t.id === state.activeTabId)
    if (!active || (active.kind !== 'folder-chat' && active.kind !== 'standalone-chat')) return
    if (!active.detectedSessionId) {
      setCurrentToast({ id: String(Date.now()), message: 'Chat is still warming up — try again in a moment.' })
      return
    }
    try {
      if (active.ptyId) {
        window.api.destroyPty(active.ptyId)
      }
      const newPtyId = await window.api.createPty(active.folderPath ?? null, {
        resumeSessionId: active.detectedSessionId,
      })
      dispatch({ type: 'UPDATE_TAB_PTY', tabId: active.id, ptyId: newPtyId })
    } catch (err) {
      console.error('Failed to reload tab:', err)
      setCurrentToast({ id: String(Date.now()), message: 'Reload failed — see logs.' })
    }
  }, [state.tabs, state.activeTabId, dispatch])

  useEffect(() => {
    async function init() {
      // Check if first launch
      const sessions = await window.api.getRecentSessions()
      dispatch({ type: 'SET_FIRST_LAUNCH', isFirst: sessions.length === 0 })
      // No automatic directory selection - user can open project from Dashboard
    }
    init()
  }, [dispatch])

  useEffect(() => {
    if (!state.projectPath) return
    const interval = setInterval(async () => {
      const branch = await window.api.getGitBranch(state.projectPath!)
      dispatch({ type: 'SET_GIT_BRANCH', branch })
    }, 5000)
    return () => clearInterval(interval)
  }, [state.projectPath, dispatch])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      // Cmd+Shift+R: reload current chat at the current window width.
      // (Cmd+R would conflict with Electron's full-app reload.)
      if (isMod && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault()
        handleReloadActiveTab()
        return
      }
      // Cmd+W: Close active tab
      if (isMod && e.key === 'w') {
        e.preventDefault()
        const activeTab = state.tabs.find(t => t.id === state.activeTabId)
        if (activeTab?.closeable) {
          if (activeTab.ptyId) {
            window.api.destroyPty(activeTab.ptyId)
          }
          dispatch({ type: 'CLOSE_TAB', tabId: activeTab.id })
        }
      }
      // Cmd+T: Open new terminal tab
      if (isMod && e.key === 't') {
        e.preventDefault()
        const projectPath = state.projectPath || null
        window.api.createPty(projectPath).then(ptyId => {
          const id = `terminal-${Date.now()}`
          dispatch({
            type: 'ADD_TAB',
            tab: {
              id,
              kind: projectPath ? 'folder-chat' : 'standalone-chat',
              label: projectPath
                ? (projectPath.split('/').filter(Boolean).pop() ?? 'Chat')
                : 'Claude — Home',
              closeable: true,
              ptyId,
              folderPath: projectPath ?? undefined,
              createdAtMs: Date.now(),
            }
          })
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch, state.tabs, state.activeTabId, state.projectPath, handleReloadActiveTab])

  // TerminalTab intercepts Cmd+Shift+R inside xterm (otherwise xterm eats
  // the keystroke and forwards "R" to claude). It dispatches a custom event
  // we listen for here so the same shortcut works whether or not focus is
  // in the terminal.
  useEffect(() => {
    const handler = () => handleReloadActiveTab()
    window.addEventListener('reload-chat-tab', handler)
    return () => window.removeEventListener('reload-chat-tab', handler)
  }, [handleReloadActiveTab])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buildPaletteItems(): Promise<PaletteItem[]> {
    const items: PaletteItem[] = [
      { id: 'action:new-chat', kind: 'action', label: 'New Claude chat', hint: '⌘T' },
    ]
    // Recent chats
    try {
      const sessions = await window.api.getRecentSessions?.() ?? []
      for (const s of sessions.slice(0, 20)) {
        const name = s.projectPath.split('/').filter(Boolean).pop() ?? s.projectPath
        items.push({ id: `chat:${s.projectPath}`, kind: 'chat', label: name, hint: relativeTime(s.lastOpened), meta: s })
      }
    } catch {}
    // Skills (best-effort)
    try {
      const skills = await (window.api as any).getSkills?.() ?? []
      for (const sk of skills) items.push({ id: `skill:${sk.name}`, kind: 'skill', label: sk.name, hint: 'skill' })
    } catch {}
    return items
  }

  function relativeTime(ts?: string | number | null): string {
    if (!ts) return ''
    const ms = Date.now() - new Date(ts).getTime()
    const min = Math.round(ms / 60000)
    if (min < 60) return `${min}m`
    const hr = Math.round(min / 60)
    if (hr < 24) return `${hr}h`
    return `${Math.round(hr / 24)}d`
  }

  const handleNewChat = useCallback(async () => {
    const ptyId = await window.api.createPty(null)
    const id = `chat-${Date.now()}`
    dispatch({
      type: 'ADD_TAB',
      tab: {
        id, kind: 'standalone-chat', label: 'Claude — Home', closeable: true, ptyId,
        createdAtMs: Date.now(),
      }
    })
  }, [dispatch])

  const handleResumeSession = useCallback(async (sessionId: string, projectPath: string, title?: string) => {
    try {
      const ptyId = await window.api.createPty(projectPath, { resumeSessionId: sessionId })
      const id = `terminal-${Date.now()}`
      const trimmed = title ? title.slice(0, 30) + (title.length > 30 ? '…' : '') : 'Resumed chat'
      dispatch({
        type: 'ADD_TAB',
        tab: {
          id, kind: 'folder-chat', label: trimmed, closeable: true,
          ptyId, folderPath: projectPath,
          detectedSessionId: sessionId,
          createdAtMs: Date.now(),
        }
      })
    } catch (err) {
      console.error('Failed to resume session:', err)
    }
  }, [dispatch])

  function handlePaletteSelect(item: PaletteItem) {
    if (item.kind === 'action' && item.id === 'action:new-chat') {
      handleNewChat()
    } else if (item.kind === 'chat' && item.meta) {
      const session = item.meta as import('../shared/types').RecentSession
      handleResumeSession(session.projectPath, session.projectPath)
    } else if (item.kind === 'skill') {
      // Future: send /skill to active terminal. For MVP, just close.
    }
  }

  useEffect(() => {
    const off = window.api.onToast((payload: { message: string }) => {
      setCurrentToast({ id: String(Date.now()), message: payload.message })
    })
    return () => off?.()
  }, [])

  // In-app components dispatch CustomEvent('show-toast') for ephemeral
  // feedback (e.g. automation kickoff). Same display path as backend toasts.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string } | undefined
      if (!detail?.message) return
      setCurrentToast({ id: String(Date.now()), message: detail.message })
    }
    window.addEventListener('show-toast', handler)
    return () => window.removeEventListener('show-toast', handler)
  }, [])

  // Poll for tab-title updates: when claude assigns a name (custom-title / ai-title)
  // to the session backing a chat tab, refresh the tab label to match.
  // Use a ref so the interval is set up ONCE and not torn down on every tab change.
  const tabsRef = useRef(state.tabs)
  useEffect(() => { tabsRef.current = state.tabs }, [state.tabs])

  useEffect(() => {
    if (!window.api.findSessionTitle) return
    const runPoll = async () => {
      const chatTabs = tabsRef.current.filter(t => t.kind === 'folder-chat' || t.kind === 'standalone-chat')
      if (chatTabs.length === 0) return
      const claimed = new Set<string>(
        chatTabs.map(t => t.detectedSessionId).filter((s): s is string => Boolean(s))
      )
      for (const tab of chatTabs) {
        const folder = tab.folderPath ?? ''
        const since = tab.createdAtMs ?? 0
        const excludeForThis = [...claimed].filter(s => s !== tab.detectedSessionId)
        try {
          const res = await window.api.findSessionTitle(folder, since, excludeForThis, tab.detectedSessionId)
          if (!res) continue
          const trimmed = res.title.slice(0, 30) + (res.title.length > 30 ? '…' : '')
          // Only update if something actually changed. Compare via the ref's
          // current snapshot, not the closed-over `tab` (which could be stale).
          const live = tabsRef.current.find(t => t.id === tab.id)
          if (!live) continue
          if (trimmed !== live.label || res.sessionId !== live.detectedSessionId) {
            dispatch({ type: 'UPDATE_TAB_LABEL', tabId: tab.id, label: trimmed, detectedSessionId: res.sessionId })
            claimed.add(res.sessionId)
          }
        } catch {}
      }
    }
    // Fire once immediately, then every 4s.
    runPoll()
    const interval = setInterval(runPoll, 4000)
    return () => clearInterval(interval)
  }, [dispatch])

  const dismissToast = useCallback(() => setCurrentToast(null), [])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <TabBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar onNewChat={handleNewChat}>
          <FileExplorer />
          <RecentSessions onResumeSession={handleResumeSession} />
          <AutomationsPreview onOpen={() => dispatch({ type: 'SET_ACTIVE_TAB', tabId: 'automations' })} />
          <SkillsLauncher compact />
        </Sidebar>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Dashboard visible={state.activeTabId === 'dashboard'} />
          <AutomationsView visible={state.activeTabId === 'automations'} />
          {state.tabs
            .filter(t => (t.kind === 'folder-chat' || t.kind === 'standalone-chat') && t.ptyId)
            .map(tab => (
              <TerminalTab
                key={tab.id}
                ptyId={tab.ptyId!}
                visible={tab.id === state.activeTabId}
              />
            ))}
          {state.tabs
            .filter(t => t.kind === 'file' && t.filePath)
            .map(tab => (
              <EditorTab
                key={tab.id}
                tabId={tab.id}
                filePath={tab.filePath!}
                visible={tab.id === state.activeTabId}
              />
            ))}
        </div>
      </div>
      <StatusBar />
      {currentToast && (
        <Toast message={currentToast.message} onDismiss={dismissToast} />
      )}
      <CommandPalette
        visible={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
        onSelect={handlePaletteSelect}
      />
    </div>
  )
}
