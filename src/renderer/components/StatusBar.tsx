import { useAppState } from '../store'

export default function StatusBar() {
  const { state } = useAppState()
  const { model, cost, tokens, context } = state.claudeStatus

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      padding: '6px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      color: 'var(--text-secondary)',
      flexShrink: 0,
      fontFamily: "'SF Mono', Menlo, monospace"
    }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {/* Project */}
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {state.projectPath?.split('/').pop() || 'No Project'}
        </span>

        {/* Branch */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--accent-primary)' }}>⎇</span>
          {state.gitBranch || '—'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {/* Model */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#C2E5DF' }}>✦</span>
          {model || '—'}
        </span>

        {/* Tokens */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#F3D4F3' }}>§</span>
          {tokens || '—'}
        </span>

        {/* Cost */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#FFCAA4' }}>◎</span>
          {cost || '—'}
        </span>

        {/* Context */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#FFD1D3' }}>◐</span>
          {context || '—'}
        </span>
      </div>
    </div>
  )
}
