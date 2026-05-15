import { useEffect, useState, useCallback } from 'react'
import { useAppState } from './store'
import { useClaudeStatus } from './hooks/useClaudeStatus'
import TabBar from './components/TabBar'
import Sidebar from './components/Sidebar'
import FileExplorer from './components/FileExplorer'
import TerminalTab from './components/TerminalTab'
import EditorTab from './components/EditorTab'
import Dashboard from './components/Dashboard'
import StatusBar from './components/StatusBar'
import Toast from './components/Toast'

export default function App() {
  const { state, dispatch } = useAppState()
  useClaudeStatus()
  const [currentToast, setCurrentToast] = useState<{ id: string; message: string } | null>(null)

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

  const handleNewChat = useCallback(async () => {
    const ptyId = await window.api.createPty(null)
    const id = `chat-${Date.now()}`
    dispatch({
      type: 'ADD_TAB',
      tab: { id, kind: 'standalone-chat', label: 'Claude — Home', closeable: true, ptyId }
    })
  }, [dispatch])

  const dismissToast = useCallback(() => setCurrentToast(null), [])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <TabBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar onNewChat={handleNewChat}>
          <FileExplorer />
        </Sidebar>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Dashboard visible={state.activeTabId === 'dashboard'} />
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
    </div>
  )
}
