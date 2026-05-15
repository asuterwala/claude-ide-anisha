import { useState, useEffect } from 'react'
import { useAppState } from '../store'

export function SkillsLauncher() {
  const { state, dispatch } = useAppState()
  const [skills, setSkills] = useState<Array<{ name: string; description: string }>>([])

  useEffect(() => {
    window.api.listSkills().then(setSkills)
  }, [])

  const executeSkill = (skillName: string) => {
    const cmd = `/${skillName}`
    const terminalTab = state.tabs.find(t => t.type === 'terminal')
    if (terminalTab) {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: terminalTab.id })
      window.api.writePty(terminalTab.ptyId!, cmd + '\n')
    }
  }

  if (skills.length === 0) {
    return (
      <div style={panelStyle}>
        <h3 style={headerStyle}>Skills</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No skills found in ~/.claude/skills/</div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <h3 style={headerStyle}>Skills</h3>
      {skills.map(skill => (
        <div key={skill.name} onClick={() => executeSkill(skill.name)} style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr',
          gap: 24,
          padding: '8px',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          alignItems: 'start'
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <code style={{ color: 'var(--accent-primary)', lineHeight: 1.4 }}>/{skill.name}</code>
          <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{skill.description}</span>
        </div>
      ))}
    </div>
  )
}

const panelStyle = { background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(45, 55, 72, 0.05)' }
const headerStyle = { margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 as const }
