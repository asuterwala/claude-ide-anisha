// src/renderer/components/Dashboard.tsx
import { useAppState } from '../store'
import './Dashboard.css'

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
  if (!visible) return null

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
        <p className="empty">Once automations start running, you'll see them here.</p>
      </section>
    </div>
  )
}
