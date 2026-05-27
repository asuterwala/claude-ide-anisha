import { useState } from 'react'
import { useAutomations } from '../hooks/useAutomations'
import Timeline from './AutomationsView/Timeline'
import RunList from './AutomationsView/RunList'
import AutomationForm from './AutomationsView/AutomationForm'
import { monthToDateCost } from '../../shared/budget'
import './AutomationsView/AutomationsView.css'

interface Props { visible: boolean }

function countByState(runs: { state: string }[]) {
  const out: Record<string, number> = { completed: 0, running: 0, failed: 0, timeout: 0, skipped: 0, skipped_budget: 0 }
  for (const r of runs) out[r.state] = (out[r.state] ?? 0) + 1
  return out
}

export default function AutomationsView({ visible }: Props) {
  const [view, setView] = useState<'timeline' | 'list'>('list')
  const [formOpen, setFormOpen] = useState(false)
  const { automations, runs, create, remove, runNow } = useAutomations()

  if (!visible) return null

  const stats = countByState(runs)
  const scheduledCount = automations.filter(a => a.enabled && a.schedule).length

  return (
    <div className="automations">
      <header className="auto-header">
        <h2>⚡ Automations</h2>
        <div className="view-toggle">
          <button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>Timeline</button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
        </div>
        <div className="auto-stats">
          <span className="stat-pill done">{stats.completed} ✓</span>
          <span className="stat-pill running">{stats.running} ●</span>
          <span className="stat-pill failed">{stats.failed + stats.timeout} ✗</span>
          <span className="stat-pill scheduled">{scheduledCount} ⏱</span>
        </div>
        <button className="new-auto" onClick={() => setFormOpen(true)}>+ New Automation</button>
      </header>
      {view === 'timeline'
        ? <Timeline automations={automations} runs={runs} onRunNow={runNow} />
        : <RunList automations={automations} runs={runs} onRunNow={runNow} onRemove={remove} />}
      <footer className="auto-footer">
        💰 Month to date: ${monthToDateCost(runs).toFixed(2)}
        {' '}across {automations.length} automation{automations.length === 1 ? '' : 's'}
      </footer>
      {formOpen && (
        <AutomationForm
          onSubmit={async (input) => { await create(input); setFormOpen(false) }}
          onCancel={() => setFormOpen(false)}
        />
      )}
    </div>
  )
}
