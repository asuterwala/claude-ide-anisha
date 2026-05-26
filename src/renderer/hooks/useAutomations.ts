import { useEffect, useState, useCallback } from 'react'
import type { Automation, Run, AutomationInput } from '../../shared/automation-types'

function startOfTodayUtc(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function useAutomations() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [a, r] = await Promise.all([
        window.api.listAutomations(),
        window.api.listRuns({ sinceDate: startOfTodayUtc() }),
      ])
      setAutomations(a)
      setRuns(r)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const unsubscribe = window.api.onRunUpdate((run: Run) => {
      setRuns(prev => {
        const idx = prev.findIndex(p => p.runId === run.runId)
        if (idx === -1) return [...prev, run]
        const copy = [...prev]
        copy[idx] = run
        return copy
      })
    })
    return unsubscribe
  }, [refresh])

  const runNow = useCallback(async (id: string) => {
    // Optimistic UI: show toast + insert a synthetic "running" Run so the
    // badge updates instantly. Chokidar will fire its own "running" event
    // ~200ms later (awaitWriteFinish debounce) with a real runId and slightly
    // later startedAt; RunList picks the latest by startedAt, so the real
    // entry will naturally win the display once it arrives.
    const automation = automations.find(a => a.id === id)
    if (automation) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `▶ Started ${automation.name}` }
      }))
    }
    const optimisticRunId = `optimistic-${id}-${Date.now()}`
    setRuns(prev => [...prev, {
      runId: optimisticRunId,
      automationId: id,
      state: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationMs: null,
      exitCode: null,
      tokensUsed: null,
      costUsd: null,
      triggeredBy: 'manual',
    } as Run])
    return window.api.runAutomationNow(id)
  }, [automations])

  return {
    automations, runs, loading, refresh,
    create: async (input: AutomationInput) => { await window.api.createAutomation(input); await refresh() },
    update: async (id: string, patch: Partial<AutomationInput>) => { await window.api.updateAutomation(id, patch); await refresh() },
    remove: async (id: string) => { await window.api.removeAutomation(id); await refresh() },
    runNow,
  }
}
