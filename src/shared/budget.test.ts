import { describe, it, expect } from 'vitest'
import { monthToDateCost, shouldSkipForBudget, softWarnAt80 } from './budget'
import type { Run } from './automation-types'

const r = (overrides: Partial<Run>): Run => ({
  runId: 'x', automationId: 'a', state: 'completed', startedAt: '', finishedAt: null,
  durationMs: null, exitCode: 0, tokensUsed: null, costUsd: null, triggeredBy: 'schedule',
  ...overrides,
})

describe('monthToDateCost', () => {
  it('sums costUsd within the current calendar month (UTC)', () => {
    const now = new Date('2026-05-14T12:00:00Z')
    const runs = [
      r({ startedAt: '2026-05-01T08:00:00Z', costUsd: 0.10 }),
      r({ startedAt: '2026-05-10T08:00:00Z', costUsd: 0.25 }),
      r({ startedAt: '2026-04-30T08:00:00Z', costUsd: 1.00 }), // previous month
      r({ startedAt: '2026-05-14T08:00:00Z', costUsd: 0.05 }),
    ]
    expect(monthToDateCost(runs, now)).toBeCloseTo(0.40, 4)
  })

  it('ignores runs with null costUsd', () => {
    const now = new Date('2026-05-14T12:00:00Z')
    const runs = [
      r({ startedAt: '2026-05-01T08:00:00Z', costUsd: null }),
      r({ startedAt: '2026-05-02T08:00:00Z', costUsd: 0.30 }),
    ]
    expect(monthToDateCost(runs, now)).toBeCloseTo(0.30, 4)
  })
})

describe('shouldSkipForBudget', () => {
  it('returns true when monthly budget exceeded', () => {
    expect(shouldSkipForBudget(5.10, 5.00)).toBe(true)
  })
  it('returns false when no budget set', () => {
    expect(shouldSkipForBudget(100, null)).toBe(false)
  })
  it('returns false at or below budget', () => {
    expect(shouldSkipForBudget(4.99, 5.00)).toBe(false)
    expect(shouldSkipForBudget(5.00, 5.00)).toBe(false)
  })
})

describe('softWarnAt80', () => {
  it('warns at >= 80% of budget', () => {
    expect(softWarnAt80(4.00, 5.00)).toBe(true)   // 80%
    expect(softWarnAt80(4.50, 5.00)).toBe(true)   // 90%
    expect(softWarnAt80(3.99, 5.00)).toBe(false)  // 79.8%
    expect(softWarnAt80(0, null)).toBe(false)
  })
})
