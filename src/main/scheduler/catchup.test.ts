import { describe, it, expect } from 'vitest'
import { computeMostRecentSchedule, shouldCatchUp } from './catchup'

describe('catchup', () => {
  it('finds the most recent past schedule for a cron expression', () => {
    // Saturday 2026-05-16 10:00 UTC; cron "0 8 * * 1" = Mondays 8am
    const now = new Date('2026-05-16T10:00:00Z')
    const last = computeMostRecentSchedule('0 8 * * 1', now)
    // Most recent Monday before Saturday 5/16 is Monday 5/11 at 08:00 UTC
    expect(last?.toISOString()).toBe('2026-05-11T08:00:00.000Z')
  })

  it('returns null if no schedule fired in lookback window', () => {
    const now = new Date('2026-05-16T10:00:00Z')
    const last = computeMostRecentSchedule('0 8 * * 1', now, 60 * 60 * 1000) // 1h lookback
    expect(last).toBeNull()
  })

  it('shouldCatchUp is false if schedule is within boundary skew', () => {
    const now = new Date('2026-05-11T08:02:00Z')
    const last = new Date('2026-05-11T08:00:00Z')
    expect(shouldCatchUp(last, now)).toBe(false)
  })

  it('shouldCatchUp is true if last schedule was > 5min ago', () => {
    const now = new Date('2026-05-11T09:00:00Z')
    const last = new Date('2026-05-11T08:00:00Z')
    expect(shouldCatchUp(last, now)).toBe(true)
  })
})
