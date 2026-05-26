import { useEffect, useState } from 'react'
import type { AutomationInput, Skill } from '../../../shared/automation-types'

interface Props {
  onSubmit: (input: AutomationInput) => Promise<void> | void
  onCancel: () => void
}

const ICON_PRESETS: string[] = [
  '⚡', '🔄', '📊', '📈',
  '💰', '📅', '📝', '📬',
  '🎯', '🔔', '🤖', '✨',
]

const CRON_PRESETS: Array<{ label: string; value: string | 'CUSTOM' | null }> = [
  { label: 'Manual only (no schedule)', value: null },
  { label: 'Weekdays 7:00am',           value: '0 7 * * 1-5' },
  { label: 'Mondays 8:00am',            value: '0 8 * * 1' },
  { label: 'Tuesdays 9:00am',           value: '0 9 * * 2' },
  { label: 'Daily 11:00am',             value: '0 11 * * *' },
  { label: 'Daily 12:00pm',             value: '0 12 * * *' },
  { label: 'Fridays 1:00pm',            value: '0 13 * * 5' },
  { label: 'Daily 2:00pm',              value: '0 14 * * *' },
  { label: 'Daily 5:00pm',              value: '0 17 * * *' },
  { label: 'Custom cron…',              value: 'CUSTOM' },
]

export default function AutomationForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('⚡')
  const [skill, setSkill] = useState('')
  const [folder, setFolder] = useState('~')
  const [preset, setPreset] = useState<string | null>(null)
  const [customCron, setCustomCron] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [timeoutMin, setTimeoutMin] = useState(30)
  const [model, setModel] = useState<'opus' | 'sonnet'>('opus')
  const [budget, setBudget] = useState<string>('')
  const [skills, setSkills] = useState<Skill[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const list = await (window.api.getSkills?.() ?? window.api.listSkills?.())
        setSkills(list ?? [])
      } catch { setSkills([]) }
    })()
  }, [])

  const submit = async () => {
    if (!name.trim() || !skill.trim()) {
      alert('Name and skill are required.')
      return
    }
    const schedule = preset === 'CUSTOM' ? (customCron || null) : preset
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        icon,
        skill: skill.trim(),
        folder: folder.trim() || '~',
        schedule: schedule,
        enabled,
        dependsOn: [],
        timeoutMin,
        model,
        monthlyBudgetUsd: budget.trim() ? Number(budget) : null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="form-modal" onClick={onCancel}>
      <div className="form" onClick={(e) => e.stopPropagation()}>
        <h3>New Automation</h3>

        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Refresh BI Dashboard" autoFocus /></label>

        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Icon</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
            {ICON_PRESETS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                style={{
                  fontSize: 18,
                  padding: '6px 0',
                  borderRadius: 6,
                  border: icon === emoji ? '2px solid var(--accent-primary, #5B8DEF)' : '1px solid var(--border-color, #E2E8F0)',
                  background: icon === emoji ? 'rgba(91, 141, 239, 0.08)' : '#FFFFFF',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                aria-label={`Pick icon ${emoji}`}
              >{emoji}</button>
            ))}
          </div>
        </div>

        <label>
          Skill
          <select value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">— pick a skill —</option>
            {skills.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </label>

        <label>Folder<input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="~/Documents/finance/benefits-model" /></label>

        <label>Schedule
          <select
            value={preset === null ? 'null' : preset}
            onChange={(e) => setPreset(e.target.value === 'null' ? null : e.target.value)}
          >
            {CRON_PRESETS.map(p => (
              <option key={String(p.value)} value={String(p.value ?? 'null')}>{p.label}</option>
            ))}
          </select>
        </label>
        {preset === 'CUSTOM' && (
          <label>Custom cron<input value={customCron} onChange={(e) => setCustomCron(e.target.value)} placeholder="0 7 * * 1-5" /></label>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>Timeout (min)<input type="number" value={timeoutMin} onChange={(e) => setTimeoutMin(Number(e.target.value))} min={1} max={240} /></label>
          <label style={{ flex: 1 }}>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value as 'opus' | 'sonnet')}>
              <option value="opus">Opus (best quality)</option>
              <option value="sonnet">Sonnet (faster/cheaper)</option>
            </select>
          </label>
        </div>

        <label>Monthly budget ($, optional)<input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="(no cap)" step="0.01" min={0} /></label>

        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled (will register with launchd if scheduled)
        </label>

        <div className="form-actions">
          <button onClick={onCancel} disabled={submitting}>Cancel</button>
          <button className="primary" onClick={submit} disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  )
}
