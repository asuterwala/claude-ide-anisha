import { useConfig } from '../hooks/useConfig'
import { useAppState } from '../store'

export function SkillsLauncher() {
  const config = useConfig()
  const { state, dispatch } = useAppState()

  const executeSkill = (cmd: string) => {
    const terminalTab = state.tabs.find(t => t.type === 'terminal')
    if (terminalTab) {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: terminalTab.id })
      window.api.sendToTerminal(terminalTab.ptyId, cmd + '\n')
      const weight = config?.skills.timeSavedWeights[cmd] || 10
      dispatch({ type: 'TIME_SAVED_ADD', payload: { action: cmd, minutes: weight } })
    }
  }

  if (!config?.skills.categories.length) {
    return (
      <div style={panelStyle}>
        <h3 style={headerStyle}>Skills</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No skills configured. Add skills in config.json.</div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <h3 style={headerStyle}>Skills</h3>
      {config.skills.categories.map(cat => (
        <div key={cat.label} style={{ marginBottom: 12 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase' }}>{cat.label}</div>
          {cat.skills.map(skill => (
            <div key={skill.cmd} onClick={() => executeSkill(skill.cmd)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <code style={{ color: 'var(--accent-primary)' }}>{skill.cmd}</code>
              <span style={{ color: 'var(--text-secondary)' }}>{skill.desc}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const panelStyle = { background: 'var(--panel-bg)', borderRadius: 8, padding: 16, border: '1px solid var(--panel-border)', boxShadow: 'var(--panel-shadow)' }
const headerStyle = { margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 as const }
