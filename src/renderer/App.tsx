import { useEffect } from 'react'
import { useAppState } from './store'
import { useClaudeStatus } from './hooks/useClaudeStatus'
import TabBar from './components/TabBar'
import FileExplorer from './components/FileExplorer'
import TerminalTab from './components/TerminalTab'
import EditorTab from './components/EditorTab'
import Dashboard from './components/Dashboard'
import StatusBar from './components/StatusBar'

export default function App() {
  const { state, dispatch } = useAppState()
  useClaudeStatus()

  useEffect(() => {
    async function init() {
      // Small delay to ensure window is fully ready before showing dialog
      await new Promise(r => setTimeout(r, 500))
      try {
        const dir = await window.api.selectDirectory()
        if (dir) {
          dispatch({ type: 'SET_PROJECT_PATH', path: dir })
          await window.api.watchProject(dir)
          await window.api.addRecentSession(dir)
          const branch = await window.api.getGitBranch(dir)
          dispatch({ type: 'SET_GIT_BRANCH', branch })
        }
      } catch (err) {
        console.error('[App] init error:', err)
      }
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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <TabBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <FileExplorer />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Dashboard visible={state.activeTabId === 'dashboard'} />
          {state.tabs
            .filter(t => t.type === 'terminal' && t.ptyId)
            .map(tab => (
              <TerminalTab
                key={tab.id}
                ptyId={tab.ptyId!}
                visible={tab.id === state.activeTabId}
              />
            ))}
          {state.tabs
            .filter(t => t.type === 'editor' && t.filePath)
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
    </div>
  )
}
