// src/renderer/hooks/useNotification.ts
import { useCallback, useRef, useEffect } from 'react'
import { useAppState } from '../store'
import { useConfig } from './useConfig'

const DEBOUNCE_MS = 2000
const SILENCE_MS = 30000

export function useNotification(): { checkAndNotify: (output: string) => void; cleanup: () => void } {
  const { state } = useAppState()
  const config = useConfig()
  const lastOutputRef = useRef<string>('')
  const silenceUntilRef = useRef<number>(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  const checkAndNotify = useCallback((terminalOutput: string) => {
    if (!config?.notifications?.enabled) return
    if (!state.notifications.enabled) return
    if (Date.now() < silenceUntilRef.current) return

    // Check quiet hours - handles both overnight and same-day ranges
    if (config.notifications.quietHoursStart && config.notifications.quietHoursEnd) {
      const now = new Date()
      const hour = now.getHours()
      const start = parseInt(config.notifications.quietHoursStart.split(':')[0])
      const end = parseInt(config.notifications.quietHoursEnd.split(':')[0])

      if (start > end) {
        // Overnight range (e.g., 22:00 - 06:00)
        if (hour >= start || hour < end) return
      } else {
        // Same-day range (e.g., 13:00 - 17:00)
        if (hour >= start && hour < end) return
      }
    }

    // Detect if Claude is waiting
    const lines = terminalOutput.trim().split('\n')
    const lastLine = lines[lines.length - 1] || ''

    // Skip if output hasn't changed
    if (lastLine === lastOutputRef.current) return
    lastOutputRef.current = lastLine

    // Clear any pending timer (output is still changing)
    cleanup()

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
      debounceTimerRef.current = setTimeout(() => {
        const questionPreview = lastLine.slice(0, 50) + (lastLine.length > 50 ? '...' : '')
        window.api.showNotification('Claude Code', `Waiting for your response: ${questionPreview}`)
        silenceUntilRef.current = Date.now() + SILENCE_MS
      }, DEBOUNCE_MS)
    }
  }, [config?.notifications, state.notifications.enabled, cleanup])

  return { checkAndNotify, cleanup }
}
