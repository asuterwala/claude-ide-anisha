// src/renderer/components/Dashboard.tsx
import { useConfig } from '../hooks/useConfig'
import { NotionPanel } from './NotionPanel'
import { ModelStatus } from './ModelStatus'
import { SkillsLauncher } from './SkillsLauncher'
import { QuickSlack } from './QuickSlack'
import { TipsPanel } from './TipsPanel'
import { TimeSaved } from './TimeSaved'

export default function Dashboard({ visible }: { visible: boolean }) {
  const config = useConfig()

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
        <TimeSaved />
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
          <QuickSlack />
        </div>
      </div>
    </div>
  )
}
