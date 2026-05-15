export const AXIS_START_HOUR = 4
export const AXIS_END_HOUR = 22
export const AXIS_SPAN_HOURS = AXIS_END_HOUR - AXIS_START_HOUR
const MIN_WIDTH_PCT = 1.5

export function timeToPct(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const clamped = Math.max(AXIS_START_HOUR, Math.min(AXIS_END_HOUR, hours))
  return ((clamped - AXIS_START_HOUR) / AXIS_SPAN_HOURS) * 100
}

export function runBlockPosition(startedAt: Date, finishedAt: Date | null): { leftPct: number; widthPct: number } {
  const leftPct = timeToPct(startedAt)
  const end = finishedAt ?? new Date()
  const rawWidth = timeToPct(end) - leftPct
  const widthPct = Math.max(MIN_WIDTH_PCT, rawWidth)
  return { leftPct, widthPct }
}
