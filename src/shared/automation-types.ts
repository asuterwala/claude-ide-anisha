export type RunState =
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'skipped'
  | 'skipped_budget'

export type TriggerSource = 'schedule' | 'manual' | 'catchup'

export interface Automation {
  id: string
  name: string
  icon: string
  skill: string
  folder: string
  schedule: string | null
  enabled: boolean
  dependsOn: string[]
  timeoutMin: number
  model: 'opus' | 'sonnet'
  monthlyBudgetUsd: number | null
}

export type AutomationInput = Omit<Automation, 'id'> & { id?: string }

export interface Run {
  runId: string
  automationId: string
  state: RunState
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  exitCode: number | null
  tokensUsed: number | null
  costUsd: number | null
  triggeredBy: TriggerSource
  failureReason?: string
}

export interface Skill {
  name: string
  description: string
}

export function isRunFinal(run: Pick<Run, 'state'>): boolean {
  return run.state !== 'running'
}
