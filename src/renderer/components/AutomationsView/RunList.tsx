import type { Automation, Run } from '../../../shared/automation-types'

interface Props {
  automations: Automation[]
  runs: Run[]
  onRunNow: (id: string) => void
  onRemove: (id: string) => void
}

function fmtSchedule(cron: string | null): string {
  if (!cron) return 'manual only'
  const map: Record<string, string> = {
    '0 7 * * 1-5': 'Weekdays 7:00a',
    '0 8 * * 1':   'Mondays 8:00a',
    '0 9 * * 2':   'Tuesdays 9:00a',
    '0 11 * * *':  'Daily 11:00a',
    '0 12 * * *':  'Daily 12:00p',
    '0 13 * * 5':  'Fridays 1:00p',
    '0 14 * * *':  'Daily 2:00p',
    '0 17 * * *':  'Daily 5:00p',
  }
  return map[cron] ?? cron
}

function fmtRelativeFinished(run: Run | undefined): string {
  if (!run) return '—'
  const t = run.finishedAt ?? run.startedAt
  const ms = Date.now() - new Date(t).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.round(hr / 24)}d ago`
}

export default function RunList({ automations, runs, onRunNow, onRemove }: Props) {
  // Most recent run per automation (by startedAt)
  const latestByAutomation = new Map<string, Run>()
  const sorted = [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const r of sorted) latestByAutomation.set(r.automationId, r)

  return (
    <div className="auto-list">
      <table>
        <thead>
          <tr>
            <th>Automation</th>
            <th>Schedule</th>
            <th>Last Run</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {automations.map(a => {
            const last = latestByAutomation.get(a.id)
            const badgeClass =
              !last ? 'scheduled' :
              last.state === 'completed' ? 'done' :
              last.state === 'running' ? 'running' :
              last.state === 'failed' || last.state === 'timeout' ? 'failed' :
              'scheduled'
            const badgeLabel = !last
              ? 'Never run'
              : last.state[0].toUpperCase() + last.state.slice(1)
            return (
              <tr key={a.id}>
                <td className="name">{a.icon} {a.name}</td>
                <td>{fmtSchedule(a.schedule)}</td>
                <td>{fmtRelativeFinished(last)}</td>
                <td><span className={`badge ${badgeClass}`}>{badgeLabel}</span></td>
                <td>
                  <button
                    className="run-btn"
                    onClick={() => onRunNow(a.id)}
                    disabled={last?.state === 'running'}
                  >
                    {last?.state === 'running' ? '● Running…' : '▶ Run now'}
                  </button>
                  <button
                    className="run-btn"
                    style={{ marginLeft: 4 }}
                    onClick={() => { if (confirm(`Delete automation "${a.name}"?`)) onRemove(a.id) }}
                    title="Delete"
                  >🗑</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {automations.length === 0 && <div className="empty">No automations yet.</div>}
    </div>
  )
}
