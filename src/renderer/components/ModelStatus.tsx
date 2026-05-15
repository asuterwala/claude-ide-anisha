import { useAppState } from '../store'

export function ModelStatus() {
  const { state } = useAppState()
  const { model, cost, tokens, context } = state.claudeStatus

  if (!model && !cost && !tokens && !context) return null

  return (
    <div style={{ background: 'var(--panel-bg)', borderRadius: 8, padding: 16, border: '1px solid var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Model Status</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {model && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Model</span>
            <span style={{ color: 'var(--text-primary)' }}>{model}</span>
          </div>
        )}
        {cost && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Cost</span>
            <span style={{ color: 'var(--text-primary)' }}>{cost}</span>
          </div>
        )}
        {tokens && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Tokens</span>
            <span style={{ color: 'var(--text-primary)' }}>{tokens}</span>
          </div>
        )}
        {context && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Context</span>
            <span style={{ color: 'var(--text-primary)' }}>{context}</span>
          </div>
        )}
      </div>
    </div>
  )
}
