import { useAppState } from '../store'

export default function StatusBar() {
  const { state } = useAppState()

  return (
    <div style={{
      background: '#007acc',
      padding: '4px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 11,
      color: '#fff',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <span>Today: {state.claudeStatus.cost || '—'}</span>
        <span>Tokens: {state.claudeStatus.tokens || '—'}</span>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <span>{state.claudeStatus.model || '—'}</span>
        <span>Context: {state.claudeStatus.context || '—'}</span>
        <span>{state.gitBranch || '—'}</span>
      </div>
    </div>
  )
}
