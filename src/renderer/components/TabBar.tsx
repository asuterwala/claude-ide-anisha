import { useAppState } from '../store'
import type { Tab, TabType } from '../../shared/types'

const tabColors: Record<TabType, string> = {
  dashboard: '#89d185',
  terminal: '#4fc1ff',
  editor: '#dcdcaa'
}

export default function TabBar() {
  const { state, dispatch } = useAppState()

  const handleAdd = async () => {
    let projectPath = state.projectPath
    if (!projectPath) {
      const dir = await window.api.selectDirectory()
      if (!dir) return
      projectPath = dir
      dispatch({ type: 'SET_PROJECT_PATH', path: dir })
      await window.api.watchProject(dir)
      await window.api.addRecentSession(dir)
      const branch = await window.api.getGitBranch(dir)
      dispatch({ type: 'SET_GIT_BRANCH', branch })
    }
    try {
      const id = `terminal-${Date.now()}`
      const ptyId = await window.api.createPty(projectPath)
      const tab: Tab = {
        id,
        type: 'terminal',
        label: `Terminal ${state.tabs.filter(t => t.type === 'terminal').length + 1}`,
        closeable: true,
        ptyId,
        projectPath
      }
      dispatch({ type: 'ADD_TAB', tab })
    } catch (err) {
      console.error('[TabBar] Error creating terminal:', err)
    }
  }

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    const tab = state.tabs.find(t => t.id === tabId)
    if (tab?.ptyId) {
      window.api.destroyPty(tab.ptyId)
    }
    dispatch({ type: 'CLOSE_TAB', tabId })
  }

  return (
    <div style={{
      background: '#252526',
      display: 'flex',
      alignItems: 'stretch',
      borderBottom: '1px solid #3e3e3e',
      height: 35,
      WebkitAppRegion: 'drag' as any,
      paddingLeft: 80
    }}>
      {state.tabs.map(tab => (
        <div
          key={tab.id}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tabId: tab.id })}
          style={{
            padding: '8px 16px',
            background: tab.id === state.activeTabId ? '#1e1e1e' : '#2d2d2d',
            color: tab.id === state.activeTabId ? '#fff' : '#999',
            borderRight: '1px solid #3e3e3e',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag' as any,
          }}
        >
          <span style={{ color: tabColors[tab.type], fontSize: 10 }}>●</span>
          {tab.label}
          {tab.isDirty && <span style={{ color: '#fff' }}>●</span>}
          {tab.closeable && (
            <span
              onClick={(e) => handleClose(e, tab.id)}
              style={{ color: '#666', cursor: 'pointer', marginLeft: 4 }}
            >
              ×
            </span>
          )}
        </div>
      ))}
      <div
        onClick={handleAdd}
        style={{
          padding: '8px 16px',
          color: '#666',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          WebkitAppRegion: 'no-drag' as any,
        }}
      >
        +
      </div>
    </div>
  )
}
