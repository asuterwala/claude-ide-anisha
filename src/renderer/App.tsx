import { useEffect, useState, useCallback } from 'react'
import { useAppState } from './store'
import { useClaudeStatus } from './hooks/useClaudeStatus'
import TabBar from './components/TabBar'
import FileExplorer from './components/FileExplorer'
import TerminalTab from './components/TerminalTab'
import EditorTab from './components/EditorTab'
import Dashboard from './components/Dashboard'
import StatusBar from './components/StatusBar'
import QuickOpen from './components/QuickOpen'
import ProjectSearch from './components/ProjectSearch'

export default function App() {
  const { state, dispatch } = useAppState()
  useClaudeStatus()
  const [quickOpenVisible, setQuickOpenVisible] = useState(false)
  const [projectSearchVisible, setProjectSearchVisible] = useState(false)

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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key === 'p' && !e.shiftKey) {
        e.preventDefault()
        setQuickOpenVisible(v => !v)
        setProjectSearchVisible(false)
      }
      if (isMod && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setProjectSearchVisible(v => !v)
        setQuickOpenVisible(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const closeQuickOpen = useCallback(() => setQuickOpenVisible(false), [])
  const closeProjectSearch = useCallback(() => setProjectSearchVisible(false), [])

  // Find the active editor tab and split editor tab
  const activeTab = state.tabs.find(t => t.id === state.activeTabId)
  const splitTab = state.splitTabId ? state.tabs.find(t => t.id === state.splitTabId) : null

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
          {/* Editor area with optional split */}
          {activeTab?.type === 'editor' || splitTab ? (
            <div style={{
              flex: 1,
              display: state.tabs.some(t => t.type === 'editor' && (t.id === state.activeTabId || t.id === state.splitTabId)) ? 'flex' : 'none',
              overflow: 'hidden',
            }}>
              {/* Main editor pane */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {state.tabs
                  .filter(t => t.type === 'editor' && t.filePath && t.id !== state.splitTabId)
                  .map(tab => (
                    <EditorTab
                      key={tab.id}
                      tabId={tab.id}
                      filePath={tab.filePath!}
                      visible={tab.id === state.activeTabId}
                    />
                  ))}
              </div>
              {/* Split editor pane */}
              {splitTab && splitTab.type === 'editor' && splitTab.filePath && (
                <>
                  <div style={{ width: 1, background: '#3e3e3e', flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <div
                      onClick={() => dispatch({ type: 'SET_SPLIT_TAB', tabId: null })}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 8,
                        zIndex: 10,
                        color: '#888',
                        cursor: 'pointer',
                        fontSize: 16,
                        background: '#1e1e1e',
                        borderRadius: 4,
                        padding: '0 4px',
                        lineHeight: '20px',
                      }}
                      title="Close split"
                    >
                      ×
                    </div>
                    <EditorTab
                      tabId={splitTab.id}
                      filePath={splitTab.filePath}
                      visible={true}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            // Non-split editors (when no split is active and active tab is not an editor)
            state.tabs
              .filter(t => t.type === 'editor' && t.filePath)
              .map(tab => (
                <EditorTab
                  key={tab.id}
                  tabId={tab.id}
                  filePath={tab.filePath!}
                  visible={tab.id === state.activeTabId}
                />
              ))
          )}
        </div>
      </div>
      <StatusBar />
      <QuickOpen visible={quickOpenVisible} onClose={closeQuickOpen} />
      <ProjectSearch visible={projectSearchVisible} onClose={closeProjectSearch} />
    </div>
  )
}
