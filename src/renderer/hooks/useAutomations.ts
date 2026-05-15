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

  return {
    automations, runs, loading, refresh,
    create: async (input: AutomationInput) => { await window.api.createAutomation(input); await refresh() },
    update: async (id: string, patch: Partial<AutomationInput>) => { await window.api.updateAutomation(id, patch); await refresh() },
    remove: async (id: string) => { await window.api.removeAutomation(id); await refresh() },
    runNow: async (id: string) => window.api.runAutomationNow(id),
  }
}
