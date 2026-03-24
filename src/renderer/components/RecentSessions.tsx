import { useEffect, useState } from 'react'

interface Session {
  projectPath: string
  branch: string | null
  lastOpened: number
}

export function RecentSessions() {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    window.api.getRecentSessions().then(setSessions)
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

  const getProjectName = (path: string): string => {
    return path.split('/').pop() || path
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
      {sessions.slice(0, 5).map((session, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: i < Math.min(sessions.length, 5) - 1 ? '1px solid var(--border-color)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>📁</span>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>
                {getProjectName(session.projectPath)}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {session.projectPath}
              </div>
            </div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {formatTimeAgo(session.lastOpened)}
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
