import type { Run } from './automation-types'

export function monthToDateCost(runs: Run[], now: Date = new Date()): number {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  let sum = 0
  for (const r of runs) {
    if (r.costUsd == null) continue
    const d = new Date(r.startedAt)
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month) sum += r.costUsd
  }
  return sum
}

export function shouldSkipForBudget(monthCost: number, budget: number | null): boolean {
  if (budget == null) return false
  return monthCost > budget
}

export function softWarnAt80(monthCost: number, budget: number | null): boolean {
  if (budget == null) return false
  return monthCost >= budget * 0.8
}
