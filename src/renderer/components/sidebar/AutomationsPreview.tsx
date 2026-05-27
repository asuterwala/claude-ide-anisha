import { useAutomations } from '../../hooks/useAutomations'
import type { Run } from '../../../shared/automation-types'

function latestRunFor(automationId: string, runs: Run[]): Run | undefined {
  let best: Run | undefined
  for (const r of runs) {
    if (r.automationId !== automationId) continue
    if (!best || r.startedAt > best.startedAt) best = r
  }
  return best
}

function statusFor(run: Run | undefined, hasSchedule: boolean): {
  cls: 'done' | 'running' | 'failed' | 'scheduled'
  glyph: string
  meta: string
} {
  if (!run) {
    return hasSchedule
      ? { cls: 'scheduled', glyph: '⏱', meta: 'scheduled' }
      : { cls: 'scheduled', glyph: '·', meta: 'manual' }
  }
  if (run.state === 'running') {
    const min = Math.round((Date.now() - new Date(run.startedAt).getTime()) / 60000)
    return { cls: 'running', glyph: '●', meta: `${min}m` }
  }
  if (run.state === 'failed' || run.state === 'timeout') {
    return { cls: 'failed', glyph: '✗', meta: run.state }
  }
  if (run.state === 'skipped' || run.state === 'skipped_budget') {
    return { cls: 'scheduled', glyph: '⏱', meta: 'skipped' }
  }
  // completed
  const min = Math.max(1, Math.round((Date.now() - new Date(run.startedAt).getTime()) / 60000))
  const ago = min < 60 ? `${min}m` : min < 1440 ? `${Math.round(min / 60)}h` : `${Math.round(min / 1440)}d`
  return { cls: 'done', glyph: '✓', meta: ago }
}

export default function AutomationsPreview({ onOpen }: { onOpen: () => void }) {
  const { automations, runs } = useAutomations()

  return (
    <section className="sidebar-section">
      <div className="sidebar-header">
        <span>Automations</span>
        <button
          type="button"
          className="view-all"
          onClick={onOpen}
          aria-label="View all automations"
        >View all →</button>
      </div>
      {automations.length === 0 ? (
        <div className="row" onClick={onOpen} style={{ color: 'var(--text-muted)' }}>
          <span>⚡</span><span className="name">No automations yet</span>
        </div>
      ) : (
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {automations.map(a => {
            const run = latestRunFor(a.id, runs)
            const status = statusFor(run, !!a.schedule)
            return (
              <div
                key={a.id}
                className="row"
                onClick={onOpen}
                title={status.meta}
              >
                <span className={`auto-status ${status.cls}`}>{status.glyph}</span>
                <span className="name">{a.icon} {a.name}</span>
                <span className="meta">{status.meta}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
