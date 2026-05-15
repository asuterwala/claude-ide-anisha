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
    const projectPath = state.projectPath || null
    try {
      const id = `terminal-${Date.now()}`
      const ptyId = await window.api.createPty(projectPath)
      const tab: Tab = {
        id,
        type: 'terminal',
        label: `Terminal ${state.tabs.filter(t => t.type === 'terminal').length + 1}`,
        closeable: true,
        ptyId,
        projectPath: projectPath ?? undefined
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
      background: 'var(--bg-secondary)',
      display: 'flex',
      alignItems: 'stretch',
      borderBottom: '1px solid var(--border-color)',
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
            background: tab.id === state.activeTabId ? 'var(--bg-primary)' : 'var(--bg-secondary)',
            color: tab.id === state.activeTabId ? 'var(--text-primary)' : 'var(--text-muted)',
            borderRight: '1px solid var(--border-color)',
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
          {tab.isDirty && <span style={{ color: 'var(--accent-primary)' }}>●</span>}
          {tab.closeable && (
            <span
              onClick={(e) => handleClose(e, tab.id)}
              style={{ color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 4 }}
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
          color: 'var(--text-muted)',
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
