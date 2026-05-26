import { useState, useEffect } from 'react'
import { useAppState } from '../store'

interface SkillsLauncherProps {
  compact?: boolean
}

export function SkillsLauncher({ compact }: SkillsLauncherProps = {}) {
  const { state, dispatch } = useAppState()
  const [skills, setSkills] = useState<Array<{ name: string; description: string }>>([])

  useEffect(() => {
    window.api.listSkills().then(setSkills)
  }, [])

  const executeSkill = (skillName: string) => {
    const cmd = `/${skillName}`
    const terminalTab = state.tabs.find(t => t.kind === 'folder-chat' || t.kind === 'standalone-chat')
    if (terminalTab) {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: terminalTab.id })
      window.api.writePty(terminalTab.ptyId!, cmd + '\n')
    } else {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Open a chat first, then click the skill.' }
      }))
    }
  }

  const [expanded, setExpanded] = useState(false)

  if (compact) {
    return (
      <section className="sidebar-section">
        <div className="sidebar-header"><span>Quick Tools</span></div>
        <div className="row" onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
          <span className="chev" style={{ width: 12, color: 'var(--text-muted)', fontSize: 9 }}>
            {expanded ? '▾' : '▸'}
          </span>
          <span className="name">Skills</span>
          <span className="pill">{skills.length}</span>
        </div>
        {expanded && (
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {skills.length === 0 && (
              <div style={{ padding: '6px 26px', color: 'var(--text-muted)', fontSize: 12 }}>
                No skills found
              </div>
            )}
            {skills.map(skill => (
              <div
                key={skill.name}
                className="row"
                onClick={() => executeSkill(skill.name)}
                title={skill.description}
                style={{ paddingLeft: 26, fontSize: 12 }}
              >
                <span style={{ color: 'var(--accent-primary)', fontFamily: "'iA Writer Mono S', 'SF Mono', monospace" }}>
                  /{skill.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    )
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
