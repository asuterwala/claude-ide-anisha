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

function relativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}

interface RecentSessionsProps {
  onResumeSession?: (sessionId: string, projectPath: string, title?: string) => void
  onNewChat?: () => void
}

export function RecentSessions({ onResumeSession, onNewChat }: RecentSessionsProps = {}) {
  const { dispatch } = useAppState()
  const [sessions, setSessions] = useState<ClaudeSession[]>([])

  useEffect(() => {
    window.api.getClaudeSessions?.(10).then((data: ClaudeSession[]) => {
      setSessions(data)
    }).catch(() => setSessions([]))
  }, [])

  const handleClick = async (session: ClaudeSession) => {
    if (onResumeSession) {
      onResumeSession(session.id, session.projectPath, session.title)
      return
    }
    try {
      const ptyId = await window.api.createPty(session.projectPath, { resumeSessionId: session.id })
      const id = `terminal-${Date.now()}`
      const tab: Tab = {
        id,
        kind: 'folder-chat',
        label: session.title.slice(0, 25) + (session.title.length > 25 ? '...' : ''),
        closeable: true,
        ptyId,
        folderPath: session.projectPath
      }
      dispatch({ type: 'ADD_TAB', tab })
    } catch (err) {
      console.error('Failed to open session:', err)
    }
  }

  return (
    <section className="sidebar-section">
      <div className="sidebar-header">
        <span>Recent Chats</span>
        <button
          className="add"
          title="Start a new Claude chat"
          aria-label="Start a new Claude chat"
          onClick={onNewChat}
          disabled={!onNewChat}
        >+</button>
      </div>
      {sessions.length === 0 ? (
        <div className="row" style={{ color: 'var(--text-muted)' }}>
          <span>💬</span>
          <span className="name">No recent chats</span>
        </div>
      ) : (
        sessions.slice(0, 6).map(session => (
          <div
            key={session.id}
            className="row"
            onClick={() => handleClick(session)}
          >
            <span>💬</span>
            <span className="name">{session.title}</span>
            <span className="meta">{relativeTime(session.timestamp)}</span>
          </div>
        ))
      )}
    </section>
  )
}
