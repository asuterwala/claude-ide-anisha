import type { Automation, Run } from '../../../shared/automation-types'
import { timeToPct, runBlockPosition, AXIS_START_HOUR, AXIS_END_HOUR } from './timelinePosition'

interface Props { automations: Automation[]; runs: Run[]; onRunNow: (id: string) => void }

function fmtHour(h: number): string {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

export default function Timeline({ automations, runs }: Props) {
  const now = new Date()
  const nowPct = timeToPct(now)
  const labels = [4, 7, 10, 13, 16, 19, 22]
  return (
    <div className="auto-timeline">
      <div className="time-axis">
        {labels.map(h => (
          <span key={h} style={{ left: `${((h - AXIS_START_HOUR) / (AXIS_END_HOUR - AXIS_START_HOUR)) * 100}%` }}>
            {fmtHour(h)}
          </span>
        ))}
      </div>
      {automations.map(a => {
        const myRuns = runs.filter(r => r.automationId === a.id)
        return (
          <div className="auto-row" key={a.id}>
            <div className="auto-label">
              <span className="auto-icon">{a.icon}</span>
              <span className="auto-name">{a.name}</span>
              <span className="auto-cron">{a.schedule ?? 'manual'}</span>
            </div>
            <div className="auto-track">
              <div className="now-marker" style={{ left: `${nowPct}%` }}></div>
              {myRuns.map(r => {
                const start = new Date(r.startedAt)
                const finish = r.finishedAt ? new Date(r.finishedAt) : null
                const { leftPct, widthPct } = runBlockPosition(start, finish)
                const cls =
                  r.state === 'running' ? 'run-block running' :
                  r.state === 'failed' || r.state === 'timeout' ? 'run-block failed' :
                  r.state === 'skipped' || r.state === 'skipped_budget' ? 'run-block scheduled' :
                  'run-block done'
                const label =
                  r.state === 'running' ? `● ${Math.round((Date.now() - start.getTime()) / 60000)}m` :
                  r.state === 'failed' || r.state === 'timeout' ? '✗' :
                  '✓'
                return (
                  <div
                    key={r.runId}
                    className={cls}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={r.failureReason ?? `${r.state}${r.durationMs ? ' · ' + Math.round(r.durationMs / 1000) + 's' : ''}`}
                  >{label}</div>
                )
              })}
            </div>
          </div>
        )
      })}
      {automations.length === 0 && (
        <div className="empty">No automations yet. Click &quot;+ New Automation&quot; to add one.</div>
      )}
    </div>
  )
}
