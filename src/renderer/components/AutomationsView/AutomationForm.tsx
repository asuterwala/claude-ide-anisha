import type { AutomationInput } from '../../../shared/automation-types'
interface Props { onSubmit: (input: AutomationInput) => void | Promise<void>; onCancel: () => void }
export default function AutomationForm({ onCancel }: Props) {
  return (
    <div className="form-modal" onClick={onCancel}>
      <div className="form" onClick={(e) => e.stopPropagation()}>
        <h3>New Automation</h3>
        <p>Form coming in Phase 9.4.</p>
        <div className="form-actions">
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
