import { describe, it, expect } from 'vitest'
import { timeToPct, runBlockPosition, AXIS_START_HOUR, AXIS_END_HOUR } from './timelinePosition'

describe('timelinePosition', () => {
  it('axis spans 4am–10pm (18 hours)', () => {
    expect(AXIS_START_HOUR).toBe(4)
    expect(AXIS_END_HOUR).toBe(22)
  })

  it('timeToPct maps 4am→0, 1pm→50, 10pm→100', () => {
    const at = (h: number, m = 0) => {
      const d = new Date(); d.setHours(h, m, 0, 0); return d
    }
    expect(timeToPct(at(4, 0))).toBeCloseTo(0, 1)
    expect(timeToPct(at(13, 0))).toBeCloseTo(50, 1)
    expect(timeToPct(at(22, 0))).toBeCloseTo(100, 1)
  })

  it('runBlockPosition returns left and width percent', () => {
    const start = new Date(); start.setHours(7, 0, 0, 0)
    const finish = new Date(); finish.setHours(7, 36, 0, 0)
    const pos = runBlockPosition(start, finish)
    expect(pos.leftPct).toBeCloseTo(100 * 3 / 18, 1)
    expect(pos.widthPct).toBeCloseTo(100 * 0.6 / 18, 1)
  })

  it('runBlockPosition floors width at 1.5% for visibility', () => {
    const start = new Date(); start.setHours(7, 0, 0, 0)
    const finish = new Date(); finish.setHours(7, 1, 0, 0)
    const pos = runBlockPosition(start, finish)
    expect(pos.widthPct).toBeGreaterThanOrEqual(1.5)
  })
})
