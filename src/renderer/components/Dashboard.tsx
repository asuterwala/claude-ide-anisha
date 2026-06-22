// src/renderer/components/Dashboard.tsx
import { useAppState } from '../store'
import { useAutomations } from '../hooks/useAutomations'
import type { Run } from '../../shared/automation-types'
import './Dashboard.css'

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.round(hr / 24)}d ago`
}

function runGlyph(state: Run['state']): { icon: string; cls: string } {
  if (state === 'completed') return { icon: '✓', cls: 'done' }
  if (state === 'running') return { icon: '●', cls: 'running' }
  if (state === 'failed' || state === 'timeout') return { icon: '✗', cls: 'failed' }
  return { icon: '○', cls: 'scheduled' }
}

interface Props { visible: boolean }

const QUICK_START = [
  {
    id: 'new-chat',
    icon: '✨',
    title: 'Start a new Claude chat',
    subtitle: 'In your home folder · ⌘T',
    tint: 'lavender',
  },
  {
    id: 'open-folder',
    icon: '📂',
    title: 'Open a project folder',
    subtitle: 'Pick from your files',
    tint: 'peach',
  },
  {
    id: 'automations',
    icon: '⚡',
    title: 'Manage automations',
    subtitle: 'Scheduled & manual runs',
    tint: 'mint',
  },
]

export default function Dashboard({ visible }: Props) {
  const { dispatch } = useAppState()
  const { automations, runs } = useAutomations()
  if (!visible) return null

  // Top 5 most recent runs across all automations, freshest first.
  const recentRuns = [...runs]
    .filter(r => !r.runId.startsWith('optimistic-'))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5)
  const automationById = new Map(automations.map(a => [a.id, a]))

  const handleQuick = async (id: string) => {
    if (id === 'new-chat') {
      const ptyId = await window.api.createPty(null)
      dispatch({
        type: 'ADD_TAB',
        tab: {
          id: `chat-${Date.now()}`,
          kind: 'standalone-chat',
          label: 'Claude — Home',
          closeable: true,
          ptyId,
        },
      })
    } else if (id === 'open-folder') {
      // Uses the same selectDirectory API the old Dashboard used
      const folder = await window.api.selectDirectory()
      if (folder) {
        dispatch({ type: 'SET_PROJECT_PATH', path: folder })
        await window.api.watchProject(folder)
        await window.api.addRecentSession(folder)
        const branch = await window.api.getGitBranch(folder)
        dispatch({ type: 'SET_GIT_BRANCH', branch })
        const ptyId = await window.api.createPty(folder)
        dispatch({
          type: 'ADD_TAB',
          tab: {
            id: `chat-${Date.now()}`,
            kind: 'folder-chat',
            label: 'Claude chat',
            closeable: true,
            ptyId,
            folderPath: folder,
          },
        })
      }
    } else if (id === 'automations') {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: 'automations' })
    }
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="dashboard">
      <section className="dashboard-card welcome">
        <h1>Welcome back, Anisha</h1>
        <p className="sub">{today}</p>
      </section>

      <section className="quick-start">
        {QUICK_START.map(qs => (
          <button
            key={qs.id}
            className={`quick-card tint-${qs.tint}`}
            onClick={() => handleQuick(qs.id)}
          >
            <span className="icon">{qs.icon}</span>
            <span className="title">{qs.title}</span>
            <span className="card-sub">{qs.subtitle}</span>
          </button>
        ))}
      </section>

      <section className="dashboard-card activity">
        <h2>Recent activity</h2>
        {recentRuns.length === 0 ? (
          <p className="empty">Once automations start running, you'll see them here.</p>
        ) : (
          <ul className="activity-list">
            {recentRuns.map(r => {
              const a = automationById.get(r.automationId)
              const g = runGlyph(r.state)
              const detail = r.failureReason
                || (r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : '')
              return (
                <li key={r.runId} className="activity-row">
                  <span className={`activity-glyph ${g.cls}`}>{g.icon}</span>
                  <span className="activity-name">{a?.icon ?? '⚡'} {a?.name ?? r.automationId}</span>
                  <span className="activity-state">{r.state}</span>
                  <span className="activity-detail">{detail}</span>
                  <span className="activity-when">{relativeTime(r.startedAt)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

    </div>
  )
}
