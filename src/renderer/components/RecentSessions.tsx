import { useEffect, useState } from 'react'

interface ClaudeSession {
  id: string
  title: string
  projectPath: string
  timestamp: number
}

export function RecentSessions() {
  const [sessions, setSessions] = useState<ClaudeSession[]>([])

  useEffect(() => {
    // Fetch Claude Code sessions from IPC
    window.api.getClaudeSessions?.().then(setSessions).catch(() => setSessions([]))
  }, [])

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

  const handleClick = (session: ClaudeSession) => {
    // Open terminal and resume session
    window.api.resumeClaudeSession?.(session.id, session.projectPath)
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
      {sessions.slice(0, 5).map((session) => (
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
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
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
