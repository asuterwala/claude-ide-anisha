import type { Automation, Run } from '../../../shared/automation-types'
interface Props { automations: Automation[]; runs: Run[]; onRunNow: (id: string) => void }
export default function Timeline({ automations }: Props) {
  return <div className="auto-timeline">Timeline view — {automations.length} automation{automations.length === 1 ? '' : 's'}. (Phase 9.2 fills this in.)</div>
}
