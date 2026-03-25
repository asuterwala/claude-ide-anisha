// src/renderer/components/Dashboard.tsx
import { useConfig } from '../hooks/useConfig'
import { useAppState } from '../store'
import { NotionPanel } from './NotionPanel'
import { ModelStatus } from './ModelStatus'
import { RecentSessions } from './RecentSessions'
import { SkillsLauncher } from './SkillsLauncher'
import { TipsPanel } from './TipsPanel'

export default function Dashboard({ visible }: { visible: boolean }) {
  const config = useConfig()
  const { state, dispatch } = useAppState()

  const handleOpenProject = async () => {
    const dir = await window.api.selectDirectory()
    if (dir) {
      dispatch({ type: 'SET_PROJECT_PATH', path: dir })
      await window.api.watchProject(dir)
      await window.api.addRecentSession(dir)
      const branch = await window.api.getGitBranch(dir)
      dispatch({ type: 'SET_GIT_BRANCH', branch })
    }
  }

  if (!visible) return null

  return (
    <div style={{
      flex: 1,
      padding: 20,
      background: 'var(--bg-primary)',
      overflowY: 'auto'
    }}>
      {/* Header with Time Saved */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 24, fontWeight: 600 }}>
            Welcome back{config?.user.name ? `, ${config.user.name.split(' ')[0]}` : ''}!
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Let's keep building.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleOpenProject}
            style={{
              background: state.projectPath ? 'var(--bg-secondary)' : 'var(--accent-primary)',
              color: state.projectPath ? 'var(--text-primary)' : 'white',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {state.projectPath ? 'Change Project' : 'Open Project'}
          </button>
        </div>
      </div>

      {/* Main grid layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16
      }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <NotionPanel />
          <ModelStatus />
          <TipsPanel />
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SkillsLauncher />
          <RecentSessions />
        </div>
      </div>
    </div>
  )
}
