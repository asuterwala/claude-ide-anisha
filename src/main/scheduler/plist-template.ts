export interface PlistInput {
  label: string
  programArgs: string[]
  cron: string
  env: Record<string, string>
  stdoutPath: string
  stderrPath: string
}

function expandCronField(field: string, min: number, max: number): number[] {
  if (field === '*') return []
  const out: Set<number> = new Set()
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      for (let i = a; i <= b; i++) out.add(i)
    } else {
      out.add(Number(part))
    }
  }
  for (const v of out) if (v < min || v > max) throw new Error(`cron value ${v} out of range ${min}-${max}`)
  return [...out]
}

interface CalendarEntry {
  Minute?: number
  Hour?: number
  Day?: number
  Month?: number
  Weekday?: number
}

export function cronToCalendarEntries(cron: string): CalendarEntry[] {
  const [minF, hourF, domF, monthF, dowF] = cron.trim().split(/\s+/)
  const minutes = expandCronField(minF, 0, 59)
  const hours = expandCronField(hourF, 0, 23)
  const doms = expandCronField(domF, 1, 31)
  const months = expandCronField(monthF, 1, 12)
  const dows = expandCronField(dowF, 0, 7).map(d => d === 7 ? 0 : d)

  const entries: CalendarEntry[] = []
  const minuteList = minutes.length ? minutes : [undefined]
  const hourList = hours.length ? hours : [undefined]
  const domList = doms.length ? doms : [undefined]
  const monthList = months.length ? months : [undefined]
  const dowList = dows.length ? dows : [undefined]

  for (const M of minuteList) for (const H of hourList) for (const D of domList) for (const Mo of monthList) for (const W of dowList) {
    const e: CalendarEntry = {}
    if (M !== undefined) e.Minute = M
    if (H !== undefined) e.Hour = H
    if (D !== undefined) e.Day = D
    if (Mo !== undefined) e.Month = Mo
    if (W !== undefined) e.Weekday = W
    entries.push(e)
  }
  return entries
}

function calendarEntryXml(e: CalendarEntry): string {
  const parts: string[] = []
  if (e.Minute !== undefined) parts.push(`<key>Minute</key><integer>${e.Minute}</integer>`)
  if (e.Hour !== undefined) parts.push(`<key>Hour</key><integer>${e.Hour}</integer>`)
  if (e.Day !== undefined) parts.push(`<key>Day</key><integer>${e.Day}</integer>`)
  if (e.Month !== undefined) parts.push(`<key>Month</key><integer>${e.Month}</integer>`)
  if (e.Weekday !== undefined) parts.push(`<key>Weekday</key><integer>${e.Weekday}</integer>`)
  return `<dict>${parts.join('')}</dict>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function generatePlist(input: PlistInput): string {
  const cal = cronToCalendarEntries(input.cron)
  const calXml = cal.length === 1
    ? `<key>StartCalendarInterval</key>${calendarEntryXml(cal[0])}`
    : `<key>StartCalendarInterval</key><array>${cal.map(calendarEntryXml).join('')}</array>`
  const argsXml = input.programArgs.map(a => `<string>${escapeXml(a)}</string>`).join('')
  const envXml = Object.entries(input.env).map(([k, v]) =>
    `<key>${escapeXml(k)}</key><string>${escapeXml(v)}</string>`
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${escapeXml(input.label)}</string>
  <key>ProgramArguments</key><array>${argsXml}</array>
  ${calXml}
  <key>EnvironmentVariables</key><dict>${envXml}</dict>
  <key>StandardOutPath</key><string>${escapeXml(input.stdoutPath)}</string>
  <key>StandardErrorPath</key><string>${escapeXml(input.stderrPath)}</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>`
}
