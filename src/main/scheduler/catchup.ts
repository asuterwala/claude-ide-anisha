import { promises as fs } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { RUNS_DIR, RUN_AUTOMATION_SCRIPT } from './paths'
import type { Automation, Run } from '../../shared/automation-types'

const DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000 // 7 days — covers weekly schedules
const BOUNDARY_SKEW_MS = 5 * 60 * 1000 // 5 min
const ORPHAN_AGE_MS = 60 * 60 * 1000 // 1h — running too long = orphaned

function parseSet(field: string, _min: number, _max: number): Set<number> | null {
  if (field === '*') return null
  const out = new Set<number>()
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      for (let i = a; i <= b; i++) out.add(i)
    } else {
      out.add(Number(part))
    }
  }
  return out
}

// Step backwards minute-by-minute up to `lookbackMs` to find when this cron most recently fired.
export function computeMostRecentSchedule(cron: string, now: Date, lookbackMs = DEFAULT_LOOKBACK_MS): Date | null {
  const [minF, hourF, domF, monthF, dowF] = cron.split(/\s+/)
  const minutes = parseSet(minF, 0, 59)
  const hours = parseSet(hourF, 0, 23)
  const doms = parseSet(domF, 1, 31)
  const months = parseSet(monthF, 1, 12)
  const dows = parseSet(dowF, 0, 7)?.size ? new Set([...(parseSet(dowF, 0, 7) ?? [])].map(d => d === 7 ? 0 : d)) : null

  const cutoff = now.getTime() - lookbackMs
  const t = new Date(now.getTime())
  t.setUTCSeconds(0, 0)
  while (t.getTime() >= cutoff) {
    if (
      (minutes === null || minutes.has(t.getUTCMinutes())) &&
      (hours === null || hours.has(t.getUTCHours())) &&
      (doms === null || doms.has(t.getUTCDate())) &&
      (months === null || months.has(t.getUTCMonth() + 1)) &&
      (dows === null || dows.has(t.getUTCDay()))
    ) {
      if (t.getTime() <= now.getTime()) return new Date(t.getTime())
    }
    t.setUTCMinutes(t.getUTCMinutes() - 1)
  }
  return null
}

export function shouldCatchUp(lastScheduled: Date, now: Date): boolean {
  return now.getTime() - lastScheduled.getTime() > BOUNDARY_SKEW_MS
}

async function hasRunSince(automationId: string, since: Date): Promise<boolean> {
  try {
    const dirs = await fs.readdir(RUNS_DIR, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      if (!d.name.startsWith(`${automationId}__`)) continue
      try {
        const raw = await fs.readFile(join(RUNS_DIR, d.name, 'status.json'), 'utf8')
        const r: Run = JSON.parse(raw)
        if (new Date(r.startedAt).getTime() >= since.getTime()) return true
      } catch {}
    }
  } catch {}
  return false
}

export async function runCatchup(automations: Automation[]): Promise<{ caughtUp: string[] }> {
  const caughtUp: string[] = []
  const now = new Date()
  for (const a of automations) {
    if (!a.enabled || !a.schedule) continue
    const last = computeMostRecentSchedule(a.schedule, now)
    if (!last) continue
    if (!shouldCatchUp(last, now)) continue
    if (await hasRunSince(a.id, last)) continue
    const child = spawn(RUN_AUTOMATION_SCRIPT, [a.id, 'catchup'], { detached: true, stdio: 'ignore' })
    child.unref()
    caughtUp.push(a.name)
  }
  return { caughtUp }
}

export async function sweepOrphans(): Promise<{ swept: string[] }> {
  const swept: string[] = []
  try {
    const dirs = await fs.readdir(RUNS_DIR, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      const statusFile = join(RUNS_DIR, d.name, 'status.json')
      try {
        const raw = await fs.readFile(statusFile, 'utf8')
        const r: Run = JSON.parse(raw)
        if (r.state !== 'running') continue
        const ageMs = Date.now() - new Date(r.startedAt).getTime()
        if (ageMs > ORPHAN_AGE_MS) {
          const updated: Run = {
            ...r,
            state: 'failed',
            finishedAt: new Date().toISOString(),
            failureReason: 'orphaned: still running on IDE startup',
            durationMs: ageMs,
            exitCode: r.exitCode ?? -1,
          }
          await fs.writeFile(statusFile, JSON.stringify(updated, null, 2))
          swept.push(d.name)
        }
      } catch {}
    }
  } catch {}
  return { swept }
}
