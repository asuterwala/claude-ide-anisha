import type { Automation, Run } from '../../../shared/automation-types'
interface Props {
  automations: Automation[]; runs: Run[];
  onRunNow: (id: string) => void; onEdit: (a: Automation) => void; onRemove: (id: string) => void;
}
export default function RunList({ automations }: Props) {
  return <div className="auto-list">List view — {automations.length} automation{automations.length === 1 ? '' : 's'}. (Phase 9.3 fills this in.)</div>
}
