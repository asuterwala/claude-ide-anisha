import { useState, useEffect } from 'react'
import { useAppState } from '../store'

const TIPS = [
  { category: 'session', text: 'Use /compact to free up context in long sessions' },
  { category: 'session', text: 'Type /clear to start fresh without restarting' },
  { category: 'session', text: 'Check costs with /cost at any time' },
  { category: 'keyboard', text: 'Cmd+P opens any file by name - no clicking through folders' },
  { category: 'keyboard', text: 'Cmd+Shift+F searches across all files' },
  { category: 'keyboard', text: 'Select code, then Cmd+K to have Claude edit it inline' },
  { category: 'natural', text: 'Type "fix the bug in line 42" - Claude understands natural language' },
  { category: 'natural', text: 'Ask "explain this code" to get a walkthrough' },
  { category: 'natural', text: 'Say "add tests for this function" to generate tests' },
  { category: 'streamlit', text: 'Say "run my app" to start your Streamlit app' },
  { category: 'streamlit', text: 'Ask "add a chart showing X" to build visualizations' },
  { category: 'streamlit', text: 'Type "deploy to Snowflake" when ready to publish' },
]

export function TipsPanel() {
  const { state } = useAppState()
  const [visibleTips, setVisibleTips] = useState<typeof TIPS>([])
  const [expanded, setExpanded] = useState(false)
  const hasPython = state.streamlit.pythonFiles.length > 0

  useEffect(() => {
    const relevantTips = TIPS.filter(t => t.category !== 'streamlit' || hasPython)
    const selectTips = () => {
      const shuffled = [...relevantTips].sort(() => Math.random() - 0.5)
      setVisibleTips(shuffled.slice(0, 3))
    }
    selectTips()
    const interval = setInterval(selectTips, 180000)
    return () => clearInterval(interval)
  }, [hasPython])

  return (
    <div style={panelStyle}>
      <h3 style={headerStyle}>Tips</h3>
      {(expanded ? TIPS.filter(t => t.category !== 'streamlit' || hasPython) : visibleTips).map((tip, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12 }}>
          <span style={{ color: 'var(--accent-primary)' }}>💡</span>
          <span style={{ color: 'var(--text-secondary)' }}>{tip.text}</span>
        </div>
      ))}
      <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 11, cursor: 'pointer', marginTop: 8, padding: 0 }}>
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

const panelStyle = { background: 'var(--panel-bg)', borderRadius: 8, padding: 16, border: '1px solid var(--panel-border)', boxShadow: 'var(--panel-shadow)' }
const headerStyle = { margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 as const }
