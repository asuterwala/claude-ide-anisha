import { useEffect, useState, useCallback } from 'react'
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
              kind: 'folder-chat',
              label: `Terminal ${state.tabs.filter(t => t.kind === 'folder-chat' || t.kind === 'standalone-chat').length + 1}`,
              closeable: true,
              ptyId,
              folderPath: projectPath ?? undefined
            }
          })
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch, state.tabs, state.activeTabId, state.projectPath])

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
        items.push({ id: `chat:${s.id}`, kind: 'chat', label: s.title ?? 'Untitled', hint: relativeTime(s.startedAt), meta: s })
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
      tab: { id, kind: 'standalone-chat', label: 'Claude — Home', closeable: true, ptyId }
    })
  }, [dispatch])

  const handleResumeSession = useCallback(async (sessionId: string, projectPath: string) => {
    try {
      const ptyId = await window.api.createPty(projectPath)
      const id = `terminal-${Date.now()}`
      dispatch({
        type: 'ADD_TAB',
        tab: { id, kind: 'folder-chat', label: 'Resumed chat', closeable: true, ptyId, folderPath: projectPath }
      })
      setTimeout(() => {
        window.api.writePty(ptyId, `claude --resume ${sessionId}\n`)
      }, 500)
    } catch (err) {
      console.error('Failed to resume session:', err)
    }
  }, [dispatch])

  function handlePaletteSelect(item: PaletteItem) {
    if (item.kind === 'action' && item.id === 'action:new-chat') {
      handleNewChat()
    } else if (item.kind === 'chat' && item.meta) {
      const session = item.meta as any
      handleResumeSession(session.id, session.projectPath ?? '')
    } else if (item.kind === 'skill') {
      // Future: send /skill to active terminal. For MVP, just close.
    }
  }

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
