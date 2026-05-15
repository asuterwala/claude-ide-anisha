import { useAppState } from '../store'

function formatTokens(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n: number | null): string {
  if (n === null) return '—'
  return `$${n.toFixed(2)}`
}

function getFolderBasename(p: string | null): string {
  if (!p) return '—'
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export default function StatusBar() {
  const { state } = useAppState()
  const { gitBranch, projectPath, claudeStatus } = state
  return (
    <div className="statusbar">
      <span className="grp">⎇ <span className="accent">{gitBranch ?? '—'}</span></span>
      <span className="sep">·</span>
      <span className="grp">📂 {getFolderBasename(projectPath)}</span>
      <span className="sep">·</span>
      <span className="grp">
        ✻ <span className="accent">{claudeStatus.model ?? '—'}</span>
      </span>
      <span className="sep">·</span>
      <span className="grp">§ <span className="ok">{formatTokens(claudeStatus.tokens)} tokens</span></span>
      <span className="sep">·</span>
      <span className="grp">$ <span className="warn">{formatCost(claudeStatus.cost)}</span></span>
      <span className="sep">·</span>
      <span className="grp">
        ⌛ <span className="accent">{claudeStatus.context?.used ?? '—'}</span>
        <span style={{ color: 'var(--text-muted)' }}> ({claudeStatus.context?.pct ?? '—'}%)</span>
      </span>
    </div>
  )
}
