import { useEffect, useState } from 'react'
import { useAppState } from '../store'
import type { Tab } from '../../shared/types'

interface ClaudeSession {
  id: string
  title: string
  projectPath: string
  projectDir: string
  timestamp: number
}

export function RecentSessions() {
  const { state, dispatch } = useAppState()
  const [sessions, setSessions] = useState<ClaudeSession[]>([])
  const [limit, setLimit] = useState(5)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    window.api.getClaudeSessions?.(limit).then((data: ClaudeSession[]) => {
      setSessions(data)
      setHasMore(data.length === limit)
    }).catch(() => setSessions([]))
  }, [limit])

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const handleClick = async (session: ClaudeSession) => {
    try {
      // Create a PTY for the session's project
      const ptyId = await window.api.createPty(session.projectPath)

      // Create terminal tab
      const id = `terminal-${Date.now()}`
      const tab: Tab = {
        id,
        type: 'terminal',
        label: session.title.slice(0, 25) + (session.title.length > 25 ? '...' : ''),
        closeable: true,
        ptyId,
        projectPath: session.projectPath
      }
      dispatch({ type: 'ADD_TAB', tab })

      // Send resume command after a short delay for terminal to initialize
      setTimeout(() => {
        window.api.writePty(ptyId, `claude --resume ${session.id}\n`)
      }, 500)
    } catch (err) {
      console.error('Failed to open session:', err)
    }
  }

  const loadMore = () => {
    setLimit(prev => prev + 10)
  }

  if (sessions.length === 0) {
    return (
      <div style={panelStyle}>
        <h3 style={headerStyle}>Recent Sessions</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          No recent sessions
        </div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <h3 style={headerStyle}>Recent Sessions</h3>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => handleClick(session)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              padding: '10px 8px',
              marginBottom: 4,
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: 'var(--text-primary)',
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {session.title}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                {session.projectPath.split('/').pop()}
              </div>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 12, flexShrink: 0 }}>
              {formatTimeAgo(session.timestamp)}
            </div>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={loadMore}
            style={{
              width: '100%',
              padding: '8px',
              marginTop: 8,
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  )
}

const panelStyle = {
  background: 'var(--bg-secondary)',
  borderRadius: 8,
  padding: 16,
  border: '1px solid var(--border-color)',
  boxShadow: '0 1px 3px rgba(45, 55, 72, 0.05)'
}

const headerStyle = {
  margin: '0 0 12px',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontWeight: 600
}
