import { describe, it, expect } from 'vitest'
import { isRunFinal, type Automation, type Run } from './automation-types'

describe('automation-types', () => {
  it('isRunFinal returns true for terminal states', () => {
    expect(isRunFinal({ state: 'completed' } as Run)).toBe(true)
    expect(isRunFinal({ state: 'failed' } as Run)).toBe(true)
    expect(isRunFinal({ state: 'timeout' } as Run)).toBe(true)
    expect(isRunFinal({ state: 'skipped' } as Run)).toBe(true)
    expect(isRunFinal({ state: 'skipped_budget' } as Run)).toBe(true)
  })

  it('isRunFinal returns false for running', () => {
    expect(isRunFinal({ state: 'running' } as Run)).toBe(false)
  })

  it('Automation type allows null monthlyBudgetUsd', () => {
    const a: Automation = {
      id: 'x', name: 'X', icon: '⚡', skill: 'foo', folder: '~',
      schedule: '0 8 * * 1', enabled: true, dependsOn: [],
      timeoutMin: 30, model: 'opus', monthlyBudgetUsd: null,
    }
    expect(a.monthlyBudgetUsd).toBeNull()
  })
})
