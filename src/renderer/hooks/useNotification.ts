// src/renderer/hooks/useNotification.ts
import { useCallback, useRef } from 'react'
import { useAppState } from '../store'
import { useConfig } from './useConfig'

export function useNotification() {
  const { state, dispatch } = useAppState()
  const config = useConfig()
  const lastOutputRef = useRef<string>('')
  const silenceUntilRef = useRef<number>(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const checkAndNotify = useCallback((terminalOutput: string) => {
    if (!config?.notifications.enabled) return
    if (!state.notifications.enabled) return
    if (Date.now() < silenceUntilRef.current) return

    // Check quiet hours
    if (config.notifications.quietHoursStart && config.notifications.quietHoursEnd) {
      const now = new Date()
      const hour = now.getHours()
      const start = parseInt(config.notifications.quietHoursStart.split(':')[0])
      const end = parseInt(config.notifications.quietHoursEnd.split(':')[0])
      if (hour >= start || hour < end) return
    }

    // Detect if Claude is waiting
    const lines = terminalOutput.trim().split('\n')
    const lastLine = lines[lines.length - 1] || ''

    // Skip if output hasn't changed
    if (lastLine === lastOutputRef.current) return
    lastOutputRef.current = lastLine

    // Clear any pending timer (output is still changing)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Check waiting conditions
    const isWaiting = (
      !lastLine.endsWith('$') &&
      !lastLine.endsWith('>') &&
      !lastLine.endsWith('%') &&
      (
        lastLine.endsWith('?') ||
        lastLine.includes('[Y/n]') ||
        lastLine.includes('[y/N]') ||
        lastLine.includes('(yes/no)') ||
        lastLine.includes('Allow?')
      )
    )

    if (isWaiting) {
      // Wait 2 seconds of no new output before notifying
      debounceTimerRef.current = setTimeout(() => {
        const questionPreview = lastLine.slice(0, 50) + (lastLine.length > 50 ? '...' : '')
        window.api.showNotification('Claude Code', `Waiting for your response: ${questionPreview}`)

        // Silence for 30 seconds to avoid spam
        silenceUntilRef.current = Date.now() + 30000
      }, 2000)
    }
  }, [config, state.notifications.enabled])

  return { checkAndNotify }
}
